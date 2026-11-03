# 적·보스 시트 생성: python3 build.py → games/is-assets/foes.png + foes.js
#   적 60종 = grunt_roster.py (의인화 병원균 병사), 보스 9종 + 노드 = mech.py (기계 병기)
import os, sys, json
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import Canvas, Foe
from mech import B
from grunt_roster import G
from grunt_build import render_grunt

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
OUT = os.path.join(ROOT, 'games', 'is-assets')


def render_boss(name):
    d = B[name]; S_ = d['size']; ox = S_ // 2; oy = d['oy']; fr = {}
    for an, n in d['frames'].items():
        out = []
        for i in range(n):
            cv = Canvas(S_, S_, ox, oy, 1.0); F = Foe(cv)
            d['fn'](F, an, i / n if an in ('mv', 'core', 'rage', 'ph2') else i / max(1, n - 1))
            out.append(cv.render())
        fr[an] = out
    return fr, ox, oy


def crop(fr, ox, oy):
    a = None
    for v in fr.values():
        for f in v: a = (f[..., 3] > 0) if a is None else (a | (f[..., 3] > 0))
    ys, xs = np.nonzero(a); y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    return {k: [f[y0:y1, x0:x1] for f in v] for k, v in fr.items()}, (int(x1 - x0), int(y1 - y0), int(ox - x0), int(oy - y0))


class Packer:
    def __init__(s, W=1024): s.W = W; s.x = 0; s.y = 0; s.rh = 0; s.items = []
    def add(s, img):
        h, w = img.shape[:2]
        if s.x + w > s.W: s.x = 0; s.y += s.rh; s.rh = 0
        pos = (s.x, s.y); s.items.append((pos, img)); s.x += w + 1; s.rh = max(s.rh, h + 1); return pos
    def image(s):
        im = np.zeros((s.y + s.rh, s.W, 4), np.uint8)
        for (x, y), img in s.items: im[y:y + img.shape[0], x:x + img.shape[1]] = img
        return im


def main():
    pk = Packer(); meta = {}
    jobs = [(n, render_grunt) for n in G] + [(n, render_boss) for n in B]
    for name, fn in jobs:
        fr, (w, h, ox, oy) = crop(*fn(name))
        meta[name] = dict(w=w, h=h, o=[ox, oy], A={k: [list(pk.add(f)) for f in v] for k, v in fr.items()})
    sheet = pk.image()
    Image.fromarray(sheet).save(os.path.join(OUT, 'foes.png'), optimize=True)
    with open(os.path.join(OUT, 'foes.js'), 'w') as f:
        f.write('/* 면역 특공대 적 60종(의인화) + 보스 9종(기계 병기) 도트 메타 (tools/immune-foes/build.py로 생성) */\n')
        f.write('window.IS_FOES=' + json.dumps(meta, separators=(',', ':')) + ';\n')
    print(len(meta), 'entries', sheet.shape, os.path.getsize(os.path.join(OUT, 'foes.png')))


if __name__ == '__main__':
    main()
