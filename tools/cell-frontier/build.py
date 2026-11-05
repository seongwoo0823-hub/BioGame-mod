# 세포 개척단 에셋 만들기: python3 build.py [출력 폴더]
#   pics/p00~p15.png  숨은 그림 16장, covers c0~c3, sprites.png + sprites.json, map.png
import sys, os, json, math
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pix import Pix, ramp
from pictures import PICS, PINK, PURP, GRN, CYAN, RED, YEL, BRN, BLUE, caps
import sprites as S

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '../../games/cell-frontier')
os.makedirs(OUT, exist_ok=True)


def save(p, name):
    p.img().save(os.path.join(OUT, name), optimize=True)


# ---------------------------------------------------------------- 그림 · 덮개
for i, f in enumerate(PICS): save(f(), f'p{i:02d}.png')
for w in range(4): save(S.cover(w), f'c{w}.png')

# ---------------------------------------------------------------- 스프라이트 묶음
rows = []   # (id, frames[Pix])
rows.append(('probe', S.spr(13, 13, S.probe(False), 8)))
rows.append(('probe_draw', S.spr(13, 13, S.probe(True), 8)))
for k, f in S.BOSSES.items(): rows.append(('b_' + k, S.spr(32, 32, f, 6)))
for k, f in S.ROAMERS.items(): rows.append(('r_' + k, S.spr(14, 14, f, 4)))
for k, f in S.PATROLS.items(): rows.append(('s_' + k, S.spr(12, 12, f, 4)))
for k in S.ITEMS: rows.append(('i_' + k, S.spr(14, 14, S.item(k), 8)))
rows.append(('sting', S.spr(7, 7, S.bullet_sting, 1)))
rows.append(('spore', S.spr(7, 7, S.bullet_spore, 1)))
rows.append(('boom', S.spr(32, 32, S.fx_boom, 8, outline=False)))
rows.append(('pop', S.spr(16, 16, S.fx_pop, 6, outline=False)))
rows.append(('sparkle', S.spr(9, 9, S.fx_sparkle, 6, outline=False)))
rows.append(('fuse', S.spr(7, 7, S.fx_fuse, 4, outline=False)))
Wd = max(sum(p.w for p in fr) for _, fr in rows)
Ht = sum(fr[0].h + 1 for _, fr in rows)
sheet = Image.new('RGBA', (Wd, Ht), (0, 0, 0, 0)); meta = {}; y = 0
for name, fr in rows:
    x = 0
    for p in fr: sheet.paste(p.img(), (x, y)); x += p.w
    meta[name] = dict(x=0, y=y, w=fr[0].w, h=fr[0].h, n=len(fr))
    y += fr[0].h + 1
sheet.save(os.path.join(OUT, 'sprites.png'), optimize=True)
json.dump(meta, open(os.path.join(OUT, 'sprites.json'), 'w'))

# ---------------------------------------------------------------- 세계 지도 (나라 4곳)
m = Pix(320, 240); rng = np.random.default_rng(77)
m.vgrad(ramp('#1a6aa8', '#145a94', '#0e4a80', '#0a3a6a'))
for y in range(6, 240, 9):
    for x in range(int(rng.integers(0, 20)), 320, 34): m.line([(x, y), (x + 6, y - 1), (x + 12, y)], '#3a8ac8', 1)


def island(cx, cy, rx, ry, seed, land, beach='#f0d890'):
    r2 = np.random.default_rng(seed)
    ph = r2.random(3) * 6
    pts = [(cx + (rx + 4 * math.sin(3 * u + ph[0]) + 2 * math.sin(7 * u + ph[1])) * math.cos(u), cy + (ry + 4 * math.sin(4 * u + ph[2]) + 2 * math.sin(6 * u)) * math.sin(u)) for u in np.linspace(0, 2 * math.pi, 90)]
    sh = m.pmask([(x + 2, y + 3) for x, y in pts]); m.fill(sh, '#0a2e58')
    big = m.pmask([(cx + (x - cx) * 1.08, cy + (y - cy) * 1.08) for x, y in pts]); m.fill(big, '#5ab0e0')
    b = m.pmask(pts); m.fill(b, beach)
    inner = m.pmask([(cx + (x - cx) * 0.86, cy + (y - cy) * 0.86) for x, y in pts])
    m.shade_mask(inner, land, cx - rx * 0.3, cy - ry * 0.4, max(rx, ry) * 1.2, amb=0.35)
    return inner


# 세포 왕국: 분홍 세포 섬 + 핵 산
i0 = island(78, 64, 58, 44, 1, ramp('#7a2a5a', '#c05a8a', '#f090b8', '#ffd0e4'))
m.ball(84, 60, 18, 14, PURP); m.ball(88, 62, 6, 5, ramp('#2a1050', '#5a2a9a', '#8a5ad0'))
for x, y, a in [(50, 80, 0.4), (110, 76, -0.4), (60, 44, 0.2)]: m.ball(x, y, 8, 4, ramp('#5a2208', '#a8480e', '#f08a20', '#ffc060'), rot=a)
# 푸른 바다: 산호 환초
i1 = island(244, 64, 56, 42, 2, ramp('#0e5a6a', '#1a8a9a', '#40c0c8', '#a0f0f0'))
m.ball(244, 64, 30, 20, ramp('#2a9ad0', '#5ac0f0', '#a0e8ff'), amb=0.6, spec=False)
for k in range(9):
    a = k * 0.7
    S_ = 1
    m.ball(244 + 40 * math.cos(a), 64 + 30 * math.sin(a), 4, 4, ramp('#7a1a3a', '#ff5a8a', '#ffc0d0'))
m.ball(240, 58, 7, 5, ramp('#6a1a4a', '#c03a8a', '#ff7ac0', '#ffc0e0'), mask=m.Y <= 59)
for k in range(-2, 3): m.line([(240 + k * 2, 59), (240 + k * 2 + 1, 66)], '#ff7ac0', 1)
# 초록 숲
i2 = island(80, 178, 60, 44, 3, ramp('#0e3a14', '#1e7a2a', '#3cb040', '#90e060'))
for x, y in [(52, 168), (64, 196), (100, 190), (44, 186), (110, 162), (78, 150)]:
    m.rect(x - 1, y, 3, 6, '#5a3414'); m.ball(x, y - 2, 7, 6, ramp('#0e3a14', '#1e6a1a', '#3a9a2a', '#7ad050'))
caps(m, 84, 182, 84, 170, 2.5, ramp('#8a7a5a', '#e0d4b8')); m.ball(84, 168, 9, 6, ramp('#5a0a10', '#c02a30', '#ff6a5a'), mask=m.Y <= 169)
for dx in (-4, 2, 5): m.put(84 + dx, 165, '#ffffff')
# 인체 탐험: 심장 모양 대륙 + 혈관 강
cx, cy = 242, 178
hp = [(cx + 16 * (16 * math.sin(t) ** 3) / 16 * 3.4, cy - 4 - (13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)) * 2.9) for t in np.linspace(0, 2 * math.pi, 120)]
sh = m.pmask([(x + 2, y + 3) for x, y in hp]); m.fill(sh, '#0a2e58')
b = m.pmask([(cx + (x - cx) * 1.06, cy + (y - cy) * 1.06) for x, y in hp]); m.fill(b, '#f0d890')
hm = m.pmask(hp); m.shade_mask(hm, ramp('#5a0a14', '#a01a2a', '#e04a4a', '#ff9a8a'), cx - 20, cy - 26, 60, amb=0.35)
m.line([(cx - 34, cy - 16), (cx - 10, cy), (cx + 6, cy + 24)], '#ffd0c0', 2)
m.line([(cx + 30, cy - 18), (cx + 10, cy + 2), (cx + 6, cy + 24)], '#5a7aff', 2)
# 항로
for (a, b_) in [((120, 72), (190, 70)), ((240, 100), (240, 140)), ((190, 178), (130, 178))]:
    for k in range(0, 11):
        t = k / 10; x, y = a[0] + (b_[0] - a[0]) * t, a[1] + (b_[1] - a[1]) * t
        if k % 2 == 0: m.rect(int(x), int(y), 2, 2, '#ffffff')
save(m, 'map.png')
print('assets ->', OUT, 'sprites', sheet.size)

# 숨은 그림 16장과 스프라이트는 첨부 그림(ref/)에서 잘라 만든 것으로 덮어씀
import from_ref
from_ref.build_pictures(); from_ref.build_sprites()
print('pictures/sprites from ref/')
