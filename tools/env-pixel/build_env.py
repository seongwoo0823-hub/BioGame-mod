import sys, math, json, os, numpy as np
sys.path.insert(0, '/home/user/ilwork/hero'); sys.path.insert(0, '/home/user/ilwork/env')
import rig
from rig import Model, render
from PIL import Image
from props import *
from monsters import settle
OUT = sys.argv[1]
DEN = 24
def autoscale(fn, cell, fill=0.82, flat=False, **kw):
    M = Model(); fn(M, **kw)
    P = np.concatenate([p for p, n, m, i in M.parts]); ext = max(P[:, 1].max() - P[:, 1].min(), (P[:, 0].max() - P[:, 0].min()) * 0.8, (P[:, 2].max() - P[:, 2].min()) * 0.7)
    if flat: ext = max(P[:, 0].max() - P[:, 0].min(), P[:, 2].max() - P[:, 2].min())
    return fill * cell / ext
def frames(fn, cell, n, foot, flat=False, yaw=0.0, kw=None, steep=False):
    kw = kw or {}; out = []
    s = autoscale(lambda M, **a: fn(M, 0.0, 1.0, **a) if fn.__code__.co_argcount >= 3 else fn(M, 0.0, 1.0), cell, flat=flat, **kw)
    for f in range(n):
        M = Model(); fn(M, f / n, s, **kw)
        if flat:
            old = rig.PITCH; rig.PITCH = math.radians(88)
            try: im = render(M, yaw, cell, cell, cell // 2, scale=1.0, fit=False)
            finally: rig.PITCH = old
        else:
            settle(M)
            if steep:
                old = rig.PITCH; rig.PITCH = math.radians(42)
                try: im = render(M, yaw, cell, cell, foot, scale=1.0)
                finally: rig.PITCH = old
            else: im = render(M, yaw, cell, cell, foot, scale=1.0)
        out.append(Image.fromarray(im))
    return out
class Packer:
    def __init__(s, W): s.W = W; s.x = s.y = s.shelf = 0; s.items = []; s.maxw = 0
    def add(s, imgs, c):
        w = c * len(imgs)
        if s.x + w > s.W: s.x = 0; s.y += s.shelf; s.shelf = 0
        pos = (s.x, s.y); s.items.append((pos, imgs, c)); s.x += w; s.shelf = max(s.shelf, c); s.maxw = max(s.maxw, s.x); return pos
    def save(s, path):
        H = s.y + s.shelf; sh = Image.new('RGBA', (s.maxw, H), (0, 0, 0, 0))
        for (x, y), imgs, c in s.items:
            for k, im in enumerate(imgs): sh.alpha_composite(im, (x + k * c, y))
        sh.save(path, 'WEBP', lossless=True, method=4); return sh.size
meta = {'prop8': {}, 'deco8': {}}
# ---- 상호작용 소품 ----
pk = Packer(2048)
for name, (fn, size, n, arg) in PROPS.items():
    c = int(round(size * DEN / 4) * 4); foot = int(c * 0.9); flat = name.startswith('tile0')
    kw = {'col': arg} if arg else {}
    if name.startswith('chest'):
        imgs = [frames(lambda M, t, s: p_chest(M, t, s, opened=False), c, 1, foot)[0], frames(lambda M, t, s: p_chest(M, t, s, opened=True), c, 1, foot)[0]]
    else: imgs = frames(fn, c, n, foot, flat=flat, yaw=0.0, kw=kw, steep=name.startswith(('exit_', 'wp_', 'gate')))
    x, y = pk.add(imgs, c); meta['prop8'][name] = dict(x=x, y=y, c=c, n=len(imgs), foot=round((c // 2 if flat else foot) / c, 3), size=size)
    print('prop', name, c, len(imgs), flush=True)
print('props8', pk.save(OUT + 'props8.webp'))
# ---- 장별 장식 ----
for ch in range(5):
    c_ = CHC[ch]; pk = Packer(2048); d = {'edge': [], 'glow': None, 'brazier': None, 'pillar': None, 'decal': []}
    for k, fn in enumerate(EDGE[ch]):
        for v in range(2):
            r = np.random.default_rng(ch * 100 + k * 10 + v); cell = 64
            imgs = frames(lambda M, t, s: fn(M, c_, s, np.random.default_rng(ch * 100 + k * 10 + v)), cell, 1, 58, yaw=v * 0.7)
            x, y = pk.add(imgs, cell); d['edge'].append(dict(x=x, y=y, c=cell, n=1, foot=round(58 / cell, 3)))
    imgs = frames(lambda M, t, s: glow_prop(M, c_, s, None, t), 56, 4, 50); x, y = pk.add(imgs, 56); d['glow'] = dict(x=x, y=y, c=56, n=4, foot=round(50 / 56, 3))
    imgs = frames(lambda M, t, s: brazier(M, c_, s, None, t), 64, 6, 58); x, y = pk.add(imgs, 64); d['brazier'] = dict(x=x, y=y, c=64, n=6, foot=round(58 / 64, 3))
    imgs = frames(lambda M, t, s: pillar(M, c_, s, None), 112, 1, 104); x, y = pk.add(imgs, 112); d['pillar'] = dict(x=x, y=y, c=112, n=1, foot=round(104 / 112, 3))
    for kind in range(6):
        for v in range(2):
            imgs = frames(lambda M, t, s: decal(M, c_, s, np.random.default_rng(ch * 50 + kind * 7 + v), kind), 64, 1, 32, flat=True)
            x, y = pk.add(imgs, 64); d['decal'].append(dict(x=x, y=y, c=64, n=1, kind=kind))
    meta['deco8'][ch + 1] = d
    print('deco', ch + 1, pk.save(OUT + f'deco8_c{ch + 1}.webp'), flush=True)
json.dump(meta, open(OUT + 'env8.json', 'w'), separators=(',', ':'))
