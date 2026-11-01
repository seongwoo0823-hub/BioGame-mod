import math, sys, json, os
from PIL import Image
from rig import render
from npcs import NPCS
import anim
from anim import pose, STATES
OUT = sys.argv[1]; C = 88; FOOT = 80
ORDER = ['elder', 'shop', 'alch', 'heal', 'vault', 'merc', 'seer', 'archon']
for k in ORDER:
    st = dict(la=0.25, lb=0.2, le=0.5, ra=0.3, rb=0.2, re=0.6, w1=(0.05, 1.0, 0.15))
    if k == 'merc': st = dict(la=0.9, lb=0.25, le=0.9, ra=0.35, rb=0.25, re=0.7, w1=(0.0, 1.0, 0.35))
    anim.STANCE[k] = st
def talk(k, f):
    q = pose(k, 'idle', f, 8); t = f / 8
    q['ra'] = 1.0 + 0.5 * math.sin(2 * math.pi * t); q['re'] = 1.2; q['rb'] = 0.35; q['hp'] = 0.08 * math.sin(4 * math.pi * t); q['hy'] = 0.15 * math.sin(2 * math.pi * t)
    if k in ('seer', 'heal', 'alch'): q['la'] = 0.9 + 0.3 * math.sin(2 * math.pi * t + 1); q['le'] = 1.0
    q['glow'] = 0.5 + 0.5 * math.sin(2 * math.pi * t)
    return q
sh = Image.new('RGBA', (16 * C, 5 * len(ORDER) * C), (0, 0, 0, 0))
for i, k in enumerate(ORDER):
    for d in range(5):
        for f in range(8):
            q = pose(k, 'idle', f, 8); q['glow'] = 0.3
            sh.alpha_composite(Image.fromarray(render(NPCS[k](q, f), d * math.pi / 4, C, C, FOOT)), (f * C, (i * 5 + d) * C))
            sh.alpha_composite(Image.fromarray(render(NPCS[k](talk(k, f), f), d * math.pi / 4, C, C, FOOT)), ((8 + f) * C, (i * 5 + d) * C))
    print('npc', k, flush=True)
sh.save(OUT + 'npc8.webp', 'WEBP', lossless=True, method=4)
