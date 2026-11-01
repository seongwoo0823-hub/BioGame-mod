import math, json, sys, os
from PIL import Image
from rig import render
from monsters import build
from specs import prep
OUT = sys.argv[1]
SEQ = [('idle', 4), ('walk', 8), ('attack', 7), ('hit', 2), ('death', 6)]; NF = 27; cols = 14; rpd = 2
SUM = [dict(id='sum_lacto', c1='#e8d8a0', c2='#8aff6a', size=0.65, plan='worm', seg=5, legs=False, n_eye=2, n_spot=3, bulk=1.1, ai='melee'),
       dict(id='sum_phage', c1='#7ab8ff', c2='#e0f4ff', size=0.7, plan='phage', spikes=0, n_eye=1, n_spot=2, ai='melee'),
       dict(id='sum_golem', c1='#5a8a7a', c2='#8affd0', size=1.15, plan='biped', spikes=3, horns=False, n_eye=1, n_spot=2, bulk=1.2, arm=1.2, ai='brute'),
       dict(id='sum_nk', c1='#c8b0ff', c2='#ff8ae8', size=1.1, plan='beast', spikes=5, horns=True, n_eye=2, n_spot=3, ai='melee')]
meta = {}; blocks = []
for sp in SUM:
    sp.update(boss=False, ch=0); hpx = prep(sp); c = int(math.ceil((hpx * 1.55 + 10) / 4) * 4); foot = int(c * 0.86)
    blk = Image.new('RGBA', (cols * c, 5 * rpd * c), (0, 0, 0, 0))
    for d in range(5):
        col = 0
        for st, n in SEQ:
            for f in range(n):
                t = f / n if st in ('idle', 'walk') else f / max(1, n - 1)
                im = render(build(sp, st, t), d * math.pi / 4, c, c, foot, scale=1.0, dissolve=max(0, (t - 0.55) / 0.45) * 0.92 if st == 'death' else 0, dark=0.3 * t if st == 'death' else 0)
                blk.alpha_composite(Image.fromarray(im), ((col % cols) * c, (d * rpd + col // cols) * c)); col += 1
    blocks.append((sp, c, foot, blk)); print(sp['id'], c, flush=True)
W = max(b[3].width for b in blocks); H = sum(b[3].height for b in blocks); sh = Image.new('RGBA', (W, H), (0, 0, 0, 0)); y = 0
for sp, c, foot, blk in blocks:
    sh.alpha_composite(blk, (0, y)); meta[sp['id']] = dict(k='sum8', x=0, y=y, c=c, foot=foot, h=round(sp['hpx'], 1), plan=sp['plan'], cols=cols, rpd=rpd); y += blk.height
sh.save(OUT + 'sum8.webp', 'WEBP', lossless=True, method=4); json.dump(meta, open(OUT + 'sum8.json', 'w')); print(sh.size)
