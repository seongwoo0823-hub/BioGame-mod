# 주인공 4종 스프라이트 시트 생성: python3 build.py [neut macro tc nk]
#   → games/is-assets/<id>.png + heroes.js(모든 캐릭터 메타)
import os, sys, json, math
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from raster import Canvas
import chars

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
OUT = os.path.join(ROOT, 'games', 'is-assets')
CW, CH_, OX, OY = 56, 56, 28, 50
ARM = 44


def chains_for(h, sks, ticks, loop, wind):
    res = {}
    for w in h.CH:
        if w == 'tail':
            res['tail'] = []
            for t in range(h.TAILS):
                o, a = h.simulate(sks, ticks, 'tail', loop=loop, wind=wind, rest_rot=0.35 * (h.TAILS - 1 - t))
                res['tail'].append((o, a))
        else:
            res[w] = h.simulate(sks, ticks, w, loop=loop, wind=wind)
    def at(i):
        c = {}
        for w, v in res.items():
            if w == 'tail': c['tail'] = [o[i] for o, a in v]; c['tail_a'] = [a[i] for o, a in v]
            else: c[w] = v[0][i]; c[w + '_a'] = v[1][i]
        return c
    return at


def frames_for(h, spec):
    poses, ticks, loop, wind, face, armtilt = spec
    sks = [h.skeleton(p) for p in poses]
    for sk in sks:
        sm_ = sk['p']['smear']
        if sm_ is not None and len(sm_) == 2: sk['p']['smear'] = (sk['shF'] + sk['fw'] * 1.5, h.UA + h.FA + 2.6, sm_[0], sm_[1])
        elif sm_ is not None and len(sm_) == 3:   # (중심 이름, 시작각, 끝각)
            c = {'hip': sk['hip'], 'hand': sk.get('hF', sk['shF']), 'foot': sk['anF']}[sm_[0]]
            sk['p']['smear'] = (c, {'hip': 9.0, 'hand': 3.4, 'foot': 3.0}[sm_[0]], sm_[1], sm_[2])
    at = chains_for(h, sks, ticks, loop, wind)
    out = []
    for i, sk in enumerate(sks):
        cv = Canvas(CW, CH_, OX, OY, h.K)
        if sk['p']['spin']: cv.set_spin(sk['center'], sk['p']['spin'])
        h.draw_body(cv, sk, at(i))
        if face: h.bake_face(cv, sk, face)
        img = cv.render()
        sh = np.round(sk['shF'] * h.K).astype(int); hd = np.round(sk['head'] * h.K).astype(int)
        out.append(dict(img=img, sh=[int(sh[0]), int(sh[1])], hd=[int(hd[0]), int(hd[1])],
                        face=0 if (face or sk['p']['spin']) else 1, ov=1 if sk['p']['armF'] is None else 0))
    return out


def portrait(h, face, pose):
    sk = h.skeleton(pose); at = chains_for(h, [sk], 5, True, (0, 0))
    hd = sk['head'] * h.K
    cv = Canvas(22, 20, 11 - hd[0], 11 - hd[1], h.K)
    h.draw_body(cv, sk, at(0)); h.bake_face(cv, sk, face)
    return cv.render()


class Packer:
    def __init__(s, W=1024): s.W = W; s.x = 0; s.y = 0; s.rh = 0; s.items = []
    def add(s, img):
        h, w = img.shape[:2]
        if s.x + w > s.W: s.x = 0; s.y += s.rh; s.rh = 0
        pos = (s.x, s.y); s.items.append((pos, img)); s.x += w; s.rh = max(s.rh, h); return pos
    def image(s):
        im = np.zeros((s.y + s.rh, s.W, 4), np.uint8)
        for (x, y), img in s.items: im[y:y + img.shape[0], x:x + img.shape[1]] = img
        return im


def build(h):
    pk = Packer(); meta = dict(cell=[CW, CH_], o=[OX, OY], arm=ARM, A={}, ARM={}, F={}, P={})
    an = h.anims()
    for name, spec in an.items():
        fr = frames_for(h, spec)
        meta['A'][name] = dict(t=spec[1], loop=1 if spec[2] else 0, at=spec[5],
                               f=[[*pk.add(f['img']), *f['sh'], *f['hd'], f['face'], f['ov']] for f in fr])
    for gun in (1, 0):
        for rc in ((0, 1, 2) if gun else (0,)):
            for a in range(-105, 106, 15):
                img, muz, hand = h.render_arm(math.radians(a), rc, gun=bool(gun), size=ARM)
                meta['ARM']['%s%d_%d' % ('g' if gun else 'h', rc, a)] = [*pk.add(img), *(round(float(v * h.K), 2) for v in (*muz, *hand))]
    for nm in h.FACES: meta['F'][nm] = list(pk.add(h.face_stamp(nm)))
    meta['FO'] = [h.FX0, h.FY0]
    p0 = an['idle'][0][0]
    for nm in ('normal', 'hurt', 'tired', 'joy', 'fierce'): meta['P'][nm] = list(pk.add(portrait(h, nm, p0)))
    sheet = pk.image()
    Image.fromarray(sheet).save(os.path.join(OUT, h.id + '.png'), optimize=True)
    print(h.id, len(an), 'anims', sum(len(v['f']) for v in meta['A'].values()), 'frames', sheet.shape, os.path.getsize(os.path.join(OUT, h.id + '.png')))
    return meta


def main(ids):
    os.makedirs(OUT, exist_ok=True)
    jp = os.path.join(OUT, 'heroes.js'); allm = {}
    if os.path.exists(jp):
        allm = json.loads(open(jp).read().split('=', 1)[1].strip().rstrip(';'))
    for i in ids: allm[i] = build(chars.ALL[i]())
    with open(jp, 'w') as f:
        f.write('/* 면역 특공대 주인공 4종 도트 스프라이트 메타 (tools/immune-hero/build.py로 생성) */\n')
        f.write('window.IS_HEROES=' + json.dumps(allm, separators=(',', ':')) + ';\n')


if __name__ == '__main__':
    main(sys.argv[1:] or list(chars.ALL))
