# 호중구 스프라이트 시트 생성: python3 build.py  →  games/is-assets/neut.png + neut.js
import os, sys, json, math
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from raster import Canvas
from hero import *
import anim

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'games', 'is-assets')
CW, CH_, OX, OY = 56, 56, 28, 50
ARM = 40


def frames_for(name, spec):
    poses, ticks, loop, wind, face, armtilt = spec
    sks = [skeleton(p) for p in poses]
    for sk in sks:
        sm_ = sk['p']['smear']
        if sm_ is not None and len(sm_) == 2: sk['p']['smear'] = (sk['shF'] + sk['fw'] * 1.5, UA + FA + 2.6, sm_[0], sm_[1])
    ch = {}
    for w in ('pony', 'coat', 'coat2'):
        o, a = simulate(sks, ticks, w, loop=loop, wind=wind); ch[w] = o; ch[w + '_a'] = a
    t1, a1 = simulate(sks, ticks, 'tail', loop=loop, wind=wind)
    t2, a2 = simulate(sks, ticks, 'tail', loop=loop, wind=wind, rest_rot=0.35)
    out = []
    for i, sk in enumerate(sks):
        chains = {w: ch[w][i] for w in ('pony', 'coat', 'coat2')}
        chains.update({w + '_a': ch[w + '_a'][i] for w in ('pony', 'coat', 'coat2')})
        chains['tail'] = [t2[i], t1[i]]; chains['tail_a'] = [a2[i], a1[i]]
        cv = Canvas(CW, CH_, OX, OY, K)
        if sk['p']['spin']: cv.set_spin(sk['center'], sk['p']['spin'])
        draw_body(cv, sk, chains)
        if face: bake_face(cv, sk, face)
        img = cv.render()
        sh = np.round(sk['shF'] * K).astype(int); hd = np.round(sk['head'] * K).astype(int)
        ov = sk['p']['armF'] is None
        out.append(dict(img=img, sh=[int(sh[0]), int(sh[1])], hd=[int(hd[0]), int(hd[1])], face=0 if (face or sk['p']['spin']) else 1, ov=1 if ov else 0))
    return out, ticks, loop, armtilt


def portrait(face):
    sk = skeleton(anim.idle()[0])
    ch = {}
    for w in ('pony', 'coat', 'coat2'):
        o, a = simulate([sk], 5, w); ch[w] = o[0]; ch[w + '_a'] = a[0]
    t1, a1 = simulate([sk], 5, 'tail'); ch['tail'] = [t1[0]]; ch['tail_a'] = [a1[0]]
    hd = sk['head'] * K
    cv = Canvas(22, 20, 11 - hd[0], 11 - hd[1], K)
    draw_body(cv, sk, ch); bake_face(cv, sk, face)
    return cv.render()


class Packer:
    def __init__(s, W=1024): s.W = W; s.x = 0; s.y = 0; s.rh = 0; s.items = []
    def add(s, img):
        h, w = img.shape[:2]
        if s.x + w > s.W: s.x = 0; s.y += s.rh; s.rh = 0
        pos = (s.x, s.y); s.items.append((pos, img)); s.x += w; s.rh = max(s.rh, h); return pos
    def image(s):
        H = s.y + s.rh; im = np.zeros((H, s.W, 4), np.uint8)
        for (x, y), img in s.items: im[y:y + img.shape[0], x:x + img.shape[1]] = img
        return im


def main():
    os.makedirs(OUT, exist_ok=True)
    pk = Packer(); meta = dict(cell=[CW, CH_], o=[OX, OY], arm=ARM, A={}, ARM={}, F={}, P={}, K=K)
    prev = {}
    for name, spec in anim.ANIMS().items():
        fr, ticks, loop, armtilt = frames_for(name, spec)
        meta['A'][name] = dict(t=ticks, loop=1 if loop else 0, at=armtilt, f=[[*pk.add(f['img']), *f['sh'], *f['hd'], f['face'], f['ov']] for f in fr])
        prev[name] = (fr, ticks)
        print(name, len(fr))
    angs = list(range(-105, 106, 15))
    for gun in (1, 0):
        for rc in ((0, 1, 2) if gun else (0,)):
            for a in angs:
                img, muz, hand = render_arm(math.radians(a), rc, gun=bool(gun), size=ARM)
                meta['ARM']['%s%d_%d' % ('g' if gun else 'h', rc, a)] = [*pk.add(img), round(float(muz[0] * K), 2), round(float(muz[1] * K), 2), round(float(hand[0] * K), 2), round(float(hand[1] * K), 2)]
    for nm in FACES:
        meta['F'][nm] = list(pk.add(face_stamp(nm)))
    meta['FO'] = [FX0, FY0]
    for nm in ('normal', 'hurt', 'tired', 'joy', 'fierce'):
        meta['P'][nm] = list(pk.add(portrait(nm)))
    sheet = pk.image()
    Image.fromarray(sheet).save(os.path.join(OUT, 'neut.png'), optimize=True)
    with open(os.path.join(OUT, 'neut.js'), 'w') as f:
        f.write('/* 면역 특공대 · 호중구 주인공 도트 스프라이트 메타 (tools/immune-hero/build.py로 생성) */\n')
        f.write('window.IS_NEUT=' + json.dumps(meta, separators=(',', ':')) + ';\n')
    print('sheet', sheet.shape, os.path.getsize(os.path.join(OUT, 'neut.png')))
    return meta, prev


if __name__ == '__main__':
    main()
