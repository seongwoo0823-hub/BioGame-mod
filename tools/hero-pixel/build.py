import math, json, sys, os, numpy as np
from PIL import Image
from rig import render, hexc
from chars import CHARS
from anim import pose, STATES
C = 88; FOOT = 80
OUT = sys.argv[1] if len(sys.argv) > 1 else '/home/user/test-mod/games/il-assets/px/'
SMEAR = {'guardian': ('#fff6c0', '#ffc840'), 'swordsman': ('#ffffff', '#4ae0ff'), 'alchemist': ('#e0ffd0', '#7aff5a'), 'mancer': ('#fff0c0', '#ffa02a')}
KEY = {'guardian': 'guardian', 'alchemist': 'alchemist', 'swordsman': 'swordsman', 'mancer': 'mancer'}
only = sys.argv[2:] or list(CHARS)
for c in only:
    sh = Image.new('RGBA', (16 * C, 32 * C), (0, 0, 0, 0))
    for d in range(8):
        yaw = d * math.pi / 4
        for si, (st, n) in enumerate(STATES):
            prev = None
            for f in range(n):
                q = pose(c, st, f, n); M = CHARS[c](q, f)
                sm = None
                if st == 'attack' and prev is not None and 2 <= f <= 5:
                    segs = []
                    for w in M.tips:
                        if w in prev: segs.append((prev[w], M.tips[w], 3 if f in (3, 4) else 1))
                    cc = SMEAR[c]; sm = (segs, (hexc(cc[0]), hexc(cc[1]))) if segs else None
                prev = dict(M.tips)
                im = Image.fromarray(render(M, yaw, C, C, FOOT, smear=sm))
                sh.alpha_composite(im, (((si % 2) * 8 + f) * C, (d * 4 + si // 2) * C))
    sh.save(OUT + f'hero_{c}.webp', 'WEBP', lossless=True, method=6)
    print(c, os.path.getsize(OUT + f'hero_{c}.webp') // 1024, 'KB')
