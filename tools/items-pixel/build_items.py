import sys, json, os
sys.path.insert(0, '/home/user/ilwork/items')
from items import *
OUT = sys.argv[1]
WK = ['scalpel', 'saw', 'clamp', 'dagger', 'spear', 'maul', 'xbow', 'pipette', 'wand', 'whip']
PFX = dict(off='o', helm='h', armor='a', gloves='g', boots='b', belt='e', ring='r', amulet='m')
ONE = {'ring', 'amulet', 'belt'}
entries = []
for slot in ['weapon', 'armor', 'helm', 'gloves', 'boots', 'belt', 'off', 'ring', 'amulet']:
    for ki in range(10):
        for t in range(3):
            bid = ('w_' + WK[ki] if slot == 'weapon' else PFX[slot] + '_' + ('wall' if slot == 'off' and ki == 0 else str(ki))) + '_' + str(t)
            w, h = (48, 48) if slot in ONE else (48, 96)
            img = draw(SLOTFN[slot], w, h, ki, t)
            entries.append((bid, img))
POTS = dict(hp1=('#e03030', 0), hp2=('#e03030', 1), hp3=('#e03030', 2), hp4=('#e03030', 3), mp1=('#3050e0', 0), mp2=('#3050e0', 1), mp3=('#3050e0', 2), mp4=('#3050e0', 3), rj=('#b040e0', 1), rjf=('#b040e0', 3), ad=('#3ac060', 1))
for pid, (col, kind) in POTS.items(): entries.append(('pot_' + pid, draw(potion, 48, 48, col, kind)))
# 배치: 1x2 먼저, 한 줄 24칸
W = 24 * 48; x = y = 0; rowh = 0; meta = {}; placed = []
for bid, img in sorted(entries, key=lambda e: -e[1].height):
    if x + img.width > W: x = 0; y += rowh; rowh = 0
    placed.append((bid, img, x, y)); meta[bid] = [x, y, img.width, img.height]; x += img.width; rowh = max(rowh, img.height)
H = y + rowh; sheet = Image.new('RGBA', (W, H), (0, 0, 0, 0))
for bid, img, x, y in placed: sheet.alpha_composite(img, (x, y))
sheet.save(OUT + 'items8.webp', 'WEBP', lossless=True, method=6); json.dump(meta, open(OUT + 'items8.json', 'w'), separators=(',', ':'))
print(sheet.size, len(meta))
