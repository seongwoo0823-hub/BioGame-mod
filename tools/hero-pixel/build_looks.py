import math, sys, os
from PIL import Image
from rig import render, hexc
from chars import CHARS
from anim import pose, STATES
C = 88; FOOT = 80; OUT = '/home/user/test-mod/games/il-assets/px/looks/'
os.makedirs(OUT, exist_ok=True)
SMEAR = {'guardian': ('#fff6c0', '#ffc840'), 'swordsman': ('#ffffff', '#4ae0ff'), 'alchemist': ('#e0ffd0', '#7aff5a'), 'mancer': ('#fff0c0', '#ffa02a')}
GL = dict(b='blade', u='blunt', p='pole', w='wand')
def one(c, t, g, s):
    name = OUT + f'hero_{c}_{t}{g}{s}.webp'
    if os.path.exists(name): return
    look = dict(t=t, g=GL[g], s=s)
    sh = Image.new('RGBA', (16 * C, 32 * C), (0, 0, 0, 0))
    for d in range(8):
        yaw = d * math.pi / 4
        for si, (st, n) in enumerate(STATES):
            prev = None
            for f in range(n):
                q = pose(c, st, f, n); q['look'] = look
                if GL[g] in ('pole',) and c != 'mancer' and st in ('idle', 'walk', 'run'): q['w1'] = (0.05, 1.0, 0.15)
                M = CHARS[c](q, f); sm = None
                if st == 'attack' and prev is not None and 2 <= f <= 5:
                    segs = [(prev[w], M.tips[w], 3 if f in (3, 4) else 1) for w in M.tips if w in prev]
                    cc = SMEAR[c]; sm = (segs, (hexc(cc[0]), hexc(cc[1]))) if segs else None
                prev = dict(M.tips)
                sh.alpha_composite(Image.fromarray(render(M, yaw, C, C, FOOT, smear=sm)), (((si % 2) * 8 + f) * C, (d * 4 + si // 2) * C))
    sh.save(name, 'WEBP', lossless=True, method=4); print(name, os.path.getsize(name) // 1024, flush=True)
jobs = [(c, t, g, s) for c in CHARS for t in range(3) for g in 'bupw' for s in (0, 1)]
part, nparts = int(sys.argv[1]), int(sys.argv[2])
for j in jobs[part::nparts]: one(*j)
