# 상호작용 소품 시트만 다시 그리기 (props8.webp + props8.json)
import sys, math, json, os, numpy as np
sys.path.insert(0, '/home/user/ilwork/hero'); sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
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
        if im[0, :, 3].any() and not im[1:4, :, 3].any(): im = im.copy(); im[0] = 0   # 테두리 처리에서 아래 끝이 위로 넘어온 한 줄 제거
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
    c = int(round(size * DEN / 4) * 4); foot = int(c * (0.64 if name.startswith('wp_') else 0.7 if name.startswith('stash') else 0.6 if name.startswith('crates') else 0.8 if name.startswith(('gate', 'cart')) else 0.9)); flat = name.startswith('tile0')
    kw = {'col': arg} if arg else {}
    if name.startswith('chest'):
        imgs = [frames(lambda M, t, s: p_chest(M, t, s, opened=False), c, 1, foot)[0], frames(lambda M, t, s: p_chest(M, t, s, opened=True), c, 1, foot)[0]]
    else: imgs = frames(fn, c, n, foot, flat=flat, yaw=0.0, kw=kw, steep=name.startswith(('exit_', 'wp_', 'gate')))
    if name.startswith(('stash', 'wp_', 'gate', 'cart', 'crates')):   # 받침돌이 땅속에 묻히지 않도록 발 위치 = 그림의 맨 아래
        foot = max(int(np.nonzero(np.array(im)[:, :, 3].any(axis=1))[0].max()) + 1 for im in imgs)
    x, y = pk.add(imgs, c); meta['prop8'][name] = dict(x=x, y=y, c=c, n=len(imgs), foot=round((c // 2 if flat else foot) / c, 3), size=size)
    print('prop', name, c, len(imgs), flush=True)
print('props8', pk.save(OUT + 'props8.webp'))
json.dump(meta, open(OUT + 'props8.json', 'w'), separators=(',', ':'))
