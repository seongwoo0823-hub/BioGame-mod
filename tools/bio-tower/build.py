# 바이오 타워 에셋: python3 build.py [출력 폴더]
#   pieces.png + pieces.json (조각 그림·충돌 형태), island.png, clouds.png, hills.png, faces.png
import sys, os, json, math
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pieces import PIECES, collision, OL, eye, DGRN
from pix import Pix, ramp, hexc
from pictures import PINK, PURP, ORNG, GRN, CYAN, BLUE, RED, YEL, BRN, WHT, caps

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '../../games/bio-tower')
os.makedirs(OUT, exist_ok=True)

# ---------------------------------------------------------------- 조각
pad = 2; ims = []; meta = {}
for pid, name, fn, (w, h), dens, kind, fact in PIECES:
    p = Pix(w + pad * 2, h + pad * 2)
    sub = Pix(w, h); fn(sub); p.paste(sub, pad, pad); p.outline(OL)
    a = p.a[:, :, 3] > 0
    ys, xs = np.where(a); cx, cy = (xs.min() + xs.max() + 1) / 2, (ys.min() + ys.max() + 1) / 2
    ent = dict(name=name, w=p.w, h=p.h, ox=round(cx, 1), oy=round(cy, 1), dens=dens, fact=fact)
    if kind == 'circle': ent['r'] = round(min(xs.max() - xs.min(), ys.max() - ys.min()) / 2 - 0.5, 1)
    else: ent['parts'] = collision(a, cx, cy)
    meta[pid] = ent; ims.append((pid, p))
# 한 줄로 이어 붙이기 (줄바꿈 512px)
x = y = rowh = 0; W = 512
for pid, p in ims:
    if x + p.w > W: x = 0; y += rowh + 1; rowh = 0
    meta[pid]['x'], meta[pid]['y'] = x, y; x += p.w + 1; rowh = max(rowh, p.h)
sheet = Image.new('RGBA', (W, y + rowh + 1), (0, 0, 0, 0))
for pid, p in ims: sheet.paste(p.img(), (meta[pid]['x'], meta[pid]['y']))
sheet.save(os.path.join(OUT, 'pieces.png'), optimize=True)
json.dump(meta, open(os.path.join(OUT, 'pieces.json'), 'w'), ensure_ascii=False)

# ---------------------------------------------------------------- 떠 있는 섬 (받침대)
def island():
    p = Pix(200, 84); rng = np.random.default_rng(3)
    # 아래 흙덩이 (거꾸로 된 산 모양) + 뿌리
    pts = [(4, 14), (196, 14), (184, 34), (160, 52), (130, 66), (104, 82), (78, 66), (46, 50), (18, 32)]
    soil = p.pmask(pts); p.shade_mask(soil, ramp('#2a1608', '#5a3414', '#8a5a2a', '#b08050'), 70, 20, 90, amb=0.35)
    for _ in range(140):
        x, y = rng.integers(10, 190), rng.integers(16, 78)
        if soil[y, x]: p.put(x, y, ['#3a220e', '#a07040', '#6a6a6a'][rng.integers(0, 3)])
    for x0 in (40, 90, 140, 170):
        pts2 = [(x0 + 4 * math.sin(t / 5), 30 + t) for t in range(0, 40, 3)]
        p.fill(p.lmask(pts2, 1) & ~soil, '#6a4a2a')
    # 돌 · 수정
    for x, y in [(60, 40), (120, 50), (150, 32)]: p.ball(x, y, 6, 4, ramp('#3a3a4a', '#6a6a7a', '#a0a0b0'), spec=False)
    p.ball(100, 58, 4, 6, ramp('#1a5a8a', '#3ab0e0', '#a0f0ff'), spec=True)
    # 윗면 잔디 (평평한 받침)
    p.rect(2, 6, 196, 9, '#2a7a20')
    p.vgrad(ramp('#9ae060', '#5ab030', '#2a7a20', '#1a4a14'), 4, 16, mask=(p.Y >= 4) & (p.Y < 16) & (p.X >= 2) & (p.X < 198))
    for x in range(2, 198, 3): p.put(x, 3 + (x % 2), '#b8f080')
    for x in range(6, 196, 9): p.put(x, 16, '#2a7a20'); p.put(x + 1, 17, '#1a4a14')
    # 꽃
    for x, c in [(12, '#ff7ab0'), (30, '#ffe060'), (172, '#80c0ff'), (188, '#ff7ab0')]: p.put(x, 3, c); p.put(x - 1, 2, c); p.put(x + 1, 2, c)
    p.outline(OL)
    return p


def cloud(w, h, seed):
    p = Pix(w, h); rng = np.random.default_rng(seed)
    for _ in range(7):
        x, y, r = rng.uniform(w * 0.2, w * 0.8), rng.uniform(h * 0.45, h * 0.6), rng.uniform(h * 0.25, h * 0.45)
        p.ball(x, y, r * 1.3, r, ramp('#b8c8e0', '#e0ecf8', '#ffffff'), spec=False, amb=0.7)
    return p


def hills():
    p = Pix(480, 90); rng = np.random.default_rng(9)
    far = p.pmask([(0, 90)] + [(x, 40 - 18 * math.sin(x / 70) - 10 * math.sin(x / 23 + 1)) for x in range(0, 481, 6)] + [(480, 90)])
    p.vgrad(ramp('#7ab0d8', '#6a9ac8', '#5a88b8'), 10, 90, mask=far)
    near = p.pmask([(0, 90)] + [(x, 60 - 12 * math.sin(x / 50 + 2) - 6 * math.sin(x / 17)) for x in range(0, 481, 6)] + [(480, 90)])
    p.vgrad(ramp('#6ac050', '#4a9a3a', '#2a6a28'), 40, 90, mask=near)
    for _ in range(26):   # 나무
        x = rng.integers(0, 480); y = int(60 - 12 * math.sin(x / 50 + 2) - 6 * math.sin(x / 17))
        p.ball(x, y - 3, 5, 6, ramp('#1a4a14', '#2a7a20', '#5ab030'), spec=False)
    return p


def faces():
    """플레이어 4명 얼굴 (세포 친구들) 32×32"""
    out = []
    def base(rp, fn):
        p = Pix(32, 32); fn(p, rp); p.outline(OL); return p
    def f_rbc(p, rp):
        p.ball(16, 17, 14, 12, RED, amb=0.4); p.ball(16, 16, 7, 5, ramp('#6a0a14', '#a01a24', '#d03a40'), spec=False)
        eye(p, 11, 15, 2.2); eye(p, 21, 15, 2.2); p.line([(13, 22), (16, 24), (19, 22)], '#4a0610', 1)
    def f_leaf(p, rp):
        p.ball(16, 16, 13, 14, GRN, amb=0.4); p.line([(16, 4), (16, 28)], '#1e7a2a', 1)
        eye(p, 11, 14, 2.2); eye(p, 21, 14, 2.2); p.line([(13, 21), (16, 23), (19, 21)], '#0e3a14', 1)
    def f_neuron(p, rp):
        for a in np.linspace(0, 2 * math.pi, 6, endpoint=False): p.line([(16, 16), (16 + 14 * math.cos(a), 16 + 14 * math.sin(a))], '#c890ff', 2)
        p.ball(16, 16, 10, 10, PURP, amb=0.4); eye(p, 12, 15, 2); eye(p, 20, 15, 2); p.line([(13, 21), (16, 22), (19, 21)], '#2a1050', 1)
    def f_bact(p, rp):
        caps(p, 6, 16, 26, 16, 10, YEL); eye(p, 12, 14, 2.2); eye(p, 20, 14, 2.2); p.line([(13, 21), (16, 23), (19, 21)], '#5a4a08', 1)
        for x in (4, 28): p.line([(x, 16), (x + (2 if x < 16 else -2) * -1, 8)], '#f0d020', 1)
    for f in (f_rbc, f_leaf, f_neuron, f_bact): out.append(base(None, f))
    sh = Image.new('RGBA', (32 * 4, 32), (0, 0, 0, 0))
    for i, p in enumerate(out): sh.paste(p.img(), (i * 32, 0))
    return sh


island().img().save(os.path.join(OUT, 'island.png'))
cl = Image.new('RGBA', (120 * 3, 50), (0, 0, 0, 0))
for i, (w, h) in enumerate([(120, 50), (90, 40), (70, 30)]): cl.paste(cloud(w, h, i + 1).img(), (i * 120, 0))
cl.save(os.path.join(OUT, 'clouds.png'))
hills().img().save(os.path.join(OUT, 'hills.png'))
faces().save(os.path.join(OUT, 'faces.png'))
print('pieces', len(meta), 'sheet', sheet.size, 'parts avg', round(sum(len(m.get('parts', [1])) for m in meta.values()) / len(meta), 1))
