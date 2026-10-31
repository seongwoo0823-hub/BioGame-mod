import math, json, sys, os, numpy as np
from PIL import Image
from rig import render
from monsters import build
from specs import load, prep, D
OUT = '/home/user/test-mod/games/il-assets/px/'
SEQ = [('idle', 4), ('walk', 8), ('attack', 7), ('hit', 2), ('death', 6)]
NF = sum(n for _, n in SEQ); MAXW = 3072
mons, bosses = load()
meta = {'D': D, 'nf': NF, 'states': {}, 'list': {}}
o = 0
for st, n in SEQ: meta['states'][st] = [o, n]; o += n
chs = [int(a) for a in sys.argv[1:]] or [1, 2, 3, 4, 5]
if os.path.exists(OUT + 'mon8.json'): meta['list'] = json.load(open(OUT + 'mon8.json'))['list']
def sheet_for(ch, items, key, cols):
    blocks = []
    for sp in items:
        hpx = prep(sp); c = int(math.ceil((hpx * (1.55 if not sp['boss'] else 1.45) + 10) / 4) * 4); foot = int(c * 0.86)
        rpd = math.ceil(NF / cols)   # 방향당 줄 수
        blk = Image.new('RGBA', (cols * c, 5 * rpd * c), (0, 0, 0, 0))
        for d in range(5):
            col = 0
            for st, n in SEQ:
                for f in range(n):
                    t = f / n if st in ('idle', 'walk') else f / max(1, n - 1)
                    M = build(sp, st, t)
                    im = render(M, d * math.pi / 4, c, c, foot, scale=1.0, dissolve=max(0, (t - 0.55) / 0.45) * 0.92 if st == 'death' else 0, dark=0.3 * t if st == 'death' else 0)
                    blk.alpha_composite(Image.fromarray(im), ((col % cols) * c, (d * rpd + col // cols) * c)); col += 1
        blocks.append((sp, c, foot, blk))
        print(ch, sp['id'], sp['plan'], c, flush=True)
    # 선반 배치
    blocks.sort(key=lambda b: -b[1]); x = y = shelf = 0; W = 0; pos = []
    for sp, c, foot, blk in blocks:
        if x + blk.width > MAXW: x = 0; y += shelf; shelf = 0
        pos.append((x, y)); x += blk.width; shelf = max(shelf, blk.height); W = max(W, x)
    H = y + shelf; sheet = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    for (sp, c, foot, blk), (px, py) in zip(blocks, pos):
        sheet.alpha_composite(blk, (px, py))
        meta['list'][sp['id']] = dict(k=key + str(ch), x=px, y=py, c=c, foot=foot, h=round(sp['hpx'], 1), plan=sp['plan'], cols=cols, rpd=math.ceil(NF / cols))
    sheet.save(OUT + f'{key}{ch}.webp', 'WEBP', lossless=True, method=4)
    print('sheet', key, ch, sheet.size, os.path.getsize(OUT + f'{key}{ch}.webp') // 1024, 'KB', flush=True)
for ch in chs:
    sheet_for(ch, [s for s in mons if s['ch'] == ch], 'mon8_c', 14)
    sheet_for(ch, [s for s in bosses if s['ch'] == ch], 'boss8_c', 14)
json.dump(meta, open(OUT + 'mon8.json', 'w'), separators=(',', ':'))
