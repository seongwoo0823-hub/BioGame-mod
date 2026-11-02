# 변이(능력) · 보상 · 재화 · 강화 아이콘 32x32 도트
#   python3 icons.py [출력폴더]
import sys, os, math, json
import numpy as np
from PIL import Image
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '../../games/helix/assets/world/')
S = 32
def hx(h): h = h.lstrip('#'); return np.array([int(h[i:i+2], 16) for i in (0, 2, 4)], float)
def new(): return np.zeros((S, S, 4), float)
def put(a, x, y, c):
    x, y = int(round(x)), int(round(y))
    if 0 <= x < S and 0 <= y < S: a[y, x, :3] = hx(c) if isinstance(c, str) else c; a[y, x, 3] = 255
def disc(a, cx, cy, r, c, ry=None):
    ry = ry or r
    for y in range(S):
        for x in range(S):
            if ((x + 0.5 - cx) / r) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1: put(a, x, y, c)
def ring(a, cx, cy, r, w, c):
    for y in range(S):
        for x in range(S):
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
            if r - w <= d <= r: put(a, x, y, c)
def line(a, x0, y0, x1, y1, c, w=1):
    n = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
    for k in range(n + 1):
        t = k / n; x = x0 + (x1 - x0) * t; y = y0 + (y1 - y0) * t
        for dx in range(-(w // 2), w - w // 2):
            for dy in range(-(w // 2), w - w // 2): put(a, x + dx, y + dy, c)
def poly(a, pts, c):
    from PIL import ImageDraw
    im = Image.new('L', (S, S), 0); ImageDraw.Draw(im).polygon(pts, fill=255); m = np.array(im) > 0
    a[m, :3] = hx(c); a[m, 3] = 255
def outline(a, c='#08060c'):
    al = a[..., 3] > 0; o = np.zeros_like(al)
    for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
        sh = np.zeros_like(al)
        ys = slice(max(0, dy), S + min(0, dy)); yd = slice(max(0, -dy), S + min(0, -dy))
        xs = slice(max(0, dx), S + min(0, dx)); xd = slice(max(0, -dx), S + min(0, -dx))
        sh[yd, xd] = al[ys, xs]; o |= sh & ~al
    a[o, :3] = hx(c); a[o, 3] = 255
    return a
def lit(c, k): return np.clip(hx(c) * k, 0, 255)

LIN = dict(enzyme=('#ff8a2a', '#ffd0a0', '#7a3a08'), immune=('#3a8aff', '#b0d8ff', '#0a2a6a'), neuro=('#ffe040', '#fff6b0', '#6a5a00'), symbio=('#3cffae', '#c0ffe8', '#0a5a3a'))

def badge(a, col):
    c, l, d = LIN[col]
    disc(a, 16, 16, 14.5, d); disc(a, 16, 16, 13, lit(c, 0.45)); ring(a, 16, 16, 14.5, 1.5, c)
    put(a, 9, 7, l); put(a, 10, 6, l)

def m_attack(a, c, l):   # 낫 날
    for k in range(20):
        t = k / 19; ang = -2.4 + t * 1.9; r = 10 - t * 2
        x = 17 + math.cos(ang) * r; y = 19 + math.sin(ang) * r
        line(a, x, y, x + math.cos(ang) * (3 - t * 2.5), y + math.sin(ang) * (3 - t * 2.5), l if t > 0.3 else c, 2)
    line(a, 17, 19, 24, 27, '#b0a8c0', 2)
def m_special(a, c, l):   # 회전
    for k in range(28):
        t = k / 27 * 1.7 * math.pi; put(a, 16 + math.cos(t) * 8, 16 + math.sin(t) * 8, l); put(a, 16 + math.cos(t) * 7, 16 + math.sin(t) * 7, c)
    line(a, 16 + 8, 16, 26, 12, l, 2); line(a, 24, 16, 27, 19, l, 2)
    disc(a, 16, 16, 3, l)
def m_cast(a, c, l):   # 시약 병
    disc(a, 16, 19, 6.5, '#c8e8f0'); disc(a, 16, 20, 5, c); line(a, 16, 8, 16, 13, '#c8e8f0', 3); line(a, 16, 7, 16, 8, '#8a5a3a', 3); put(a, 14, 17, '#ffffff')
def m_dash(a, c, l):   # 겹 화살표
    for k, x in enumerate((9, 15)):
        line(a, x, 9, x + 6, 16, l if k else c, 2); line(a, x + 6, 16, x, 23, l if k else c, 2)
    line(a, 5, 16, 9, 16, c, 1)
def m_pass(a, c, l):   # 육각 세포
    for k in range(6):
        a0 = k * math.pi / 3; a1 = a0 + math.pi / 3
        line(a, 16 + math.cos(a0) * 8, 16 + math.sin(a0) * 8, 16 + math.cos(a1) * 8, 16 + math.sin(a1) * 8, l, 2)
    disc(a, 16, 16, 3.2, c); put(a, 15, 15, '#ffffff')
SLOTM = dict(attack=m_attack, special=m_special, cast=m_cast, dash=m_dash, passive=m_pass)

def ic_atp(a):   # ATP 에너지 결정(재화)
    disc(a, 16, 16, 11, '#7a5a08'); disc(a, 16, 16, 9.5, '#e0b020'); disc(a, 14, 14, 5, '#ffe070')
    for k, y in enumerate((11, 16, 21)): line(a, 12, y, 20, y, '#7a5a08'); put(a, 21, y, '#fff6c0')
def ic_dna(a):   # DNA 샘플(영구 재화)
    line(a, 16, 4, 16, 6, '#8a8a9a', 3); disc(a, 16, 18, 8, '#c8e8f0', 11); disc(a, 16, 19, 6.5, '#1a2a3a', 9.5)
    for y in range(10, 28):
        put(a, 16 + 4 * math.sin(y * 0.6), y, '#3cffae'); put(a, 16 - 4 * math.sin(y * 0.6), y, '#ff5ad0')
        if y % 3 == 0: line(a, 16 + 4 * math.sin(y * 0.6), y, 16 - 4 * math.sin(y * 0.6), y, '#c8c8f0')
def ic_heart(a, big=False):   # 적혈구 체력
    disc(a, 16, 17, 11 if big else 9, '#8a0a1a', 8 if big else 7); disc(a, 16, 17, 9.5 if big else 7.5, '#e0303a', 6.6 if big else 5.6)
    disc(a, 16, 17, 4, '#a01a24', 2.6); put(a, 11, 13, '#ffb0b0'); put(a, 12, 12, '#ffd0d0')
    if big:
        line(a, 23, 5, 23, 11, '#3cffae', 2); line(a, 20, 8, 26, 8, '#3cffae', 2)
def ic_up(a):   # 변이 강화
    poly(a, [(16, 4), (27, 16), (21, 16), (21, 27), (11, 27), (11, 16), (5, 16)], '#3cffae'); poly(a, [(16, 8), (23, 15), (18, 15), (18, 24), (14, 24), (14, 15), (9, 15)], '#c0ffe8')
def ic_shop(a):
    poly(a, [(7, 12), (25, 12), (27, 28), (5, 28)], '#8a5a2a'); poly(a, [(9, 14), (23, 14), (25, 26), (7, 26)], '#c8863a')
    ring(a, 16, 12, 6, 1.5, '#e0b020'); disc(a, 16, 20, 3, '#ffe070')
def ic_rest(a):   # 재생 배양조
    disc(a, 16, 18, 10, '#c8e8f0', 9); disc(a, 16, 19, 8.5, '#1aa060', 7.5); line(a, 16, 5, 16, 9, '#8a8a9a', 3)
    for k in range(4): put(a, 12 + k * 3, 16 + (k % 2) * 3, '#c0ffe0')
def ic_skull(a, col='#ff5a6a'):
    disc(a, 16, 14, 10, '#d8d0c0', 9); poly(a, [(10, 18), (22, 18), (21, 27), (11, 27)], '#d8d0c0')
    disc(a, 12, 14, 2.8, '#1a0a0a'); disc(a, 20, 14, 2.8, '#1a0a0a'); put(a, 12, 14, col); put(a, 20, 14, col)
    for x in (13, 16, 19): line(a, x, 22, x, 26, '#1a0a0a')
def ic_crown(a):
    ic_skull(a, '#ffc040'); poly(a, [(7, 7), (11, 2), (14, 6), (16, 1), (18, 6), (21, 2), (25, 7), (24, 9), (8, 9)], '#ffc040')
def ic_ritual(a):
    ring(a, 16, 16, 13, 1.5, '#3cffae'); ring(a, 16, 16, 8, 1, '#36ccff')
    for k in range(6):
        a0 = k * math.pi / 3; line(a, 16 + math.cos(a0) * 8, 16 + math.sin(a0) * 8, 16 + math.cos(a0) * 13, 16 + math.sin(a0) * 13, '#3cffae')
    disc(a, 16, 16, 3, '#e0fff4')
def ic_blade(a): m_attack(a, '#c0c8d8', '#ffffff')
def ic_revive(a):
    disc(a, 16, 16, 11, '#0a5a3a'); disc(a, 16, 16, 9.5, '#1ac080'); line(a, 16, 9, 16, 23, '#e0fff4', 3); line(a, 9, 16, 23, 16, '#e0fff4', 3)
def ic_luck(a):
    for k in range(4):
        ang = k * math.pi / 2 + math.pi / 4; disc(a, 16 + math.cos(ang) * 5, 16 + math.sin(ang) * 5, 4.5, '#3cb84a')
    disc(a, 16, 16, 2.5, '#a0ff8a'); line(a, 16, 18, 20, 28, '#2a7a2a', 2)
def ic_charm(a, c1, c2):   # 기념품: 목걸이 펜던트
    for k in range(14):
        t = k / 13 * math.pi; put(a, 16 + math.cos(t) * 10, 4 + math.sin(t) * 9, '#c8a050')
    disc(a, 16, 20, 7, c1); disc(a, 16, 20, 4.5, c2); put(a, 14, 18, '#ffffff')
def ic_key(a):
    ring(a, 11, 16, 6, 2, '#e0b020'); line(a, 16, 16, 27, 16, '#e0b020', 2); line(a, 24, 16, 24, 21, '#e0b020', 2); line(a, 21, 16, 21, 20, '#e0b020', 2)
def ic_speed(a):
    for k, y in enumerate((10, 16, 22)): line(a, 6 + k * 2, y, 22 + k * 2, y, '#ffe040', 2)
    poly(a, [(22, 8), (28, 16), (22, 24)], '#ffe040')
def ic_shield(a):
    poly(a, [(16, 4), (27, 9), (25, 20), (16, 28), (7, 20), (5, 9)], '#3a8aff'); poly(a, [(16, 8), (23, 11), (22, 19), (16, 24), (10, 19), (9, 11)], '#b0d8ff')

ICONS = {}
for lin in LIN:
    for slot, fn in SLOTM.items():
        def mk(lin=lin, fn=fn):
            a = new(); badge(a, lin); c, l, d = LIN[lin]; fn(a, c, l); return a
        ICONS[f'{lin}_{slot}'] = mk
for name, fn in dict(atp=ic_atp, dna=ic_dna, heal=ic_heart, maxhp=lambda a: ic_heart(a, True), upgrade=ic_up, shop=ic_shop, rest=ic_rest, boss=ic_skull,
                     midboss=ic_crown, ritual=ic_ritual, blade=ic_blade, revive=ic_revive, luck=ic_luck, key=ic_key, speed=ic_speed, shield=ic_shield,
                     charm_a=lambda a: ic_charm(a, '#7a0a1a', '#ff5a6a'), charm_b=lambda a: ic_charm(a, '#0a3a7a', '#5ab0ff'),
                     charm_c=lambda a: ic_charm(a, '#0a5a3a', '#3cffae'), charm_d=lambda a: ic_charm(a, '#5a4a00', '#ffe040')).items():
    def mk(fn=fn):
        a = new(); fn(a); return a
    ICONS[name] = mk
# 계통 변이 구슬 (보상 표시용)
for lin, (c, l, d) in LIN.items():
    def mk(c=c, l=l, d=d):
        a = new(); disc(a, 16, 16, 12, d); disc(a, 16, 16, 10.5, c)
        for y in range(8, 25): put(a, 16 + 4 * math.sin(y * 0.55), y, l); put(a, 16 - 4 * math.sin(y * 0.55), y, '#ffffff')
        put(a, 11, 10, '#ffffff'); return a
    ICONS[f'orb_{lin}'] = mk

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    names = list(ICONS); cols = 16; rows = (len(names) + cols - 1) // cols
    sh = np.zeros((rows * S, cols * S, 4))
    idx = {}
    for i, n in enumerate(names):
        a = outline(ICONS[n]()); r, c = divmod(i, cols); sh[r * S:(r + 1) * S, c * S:(c + 1) * S] = a; idx[n] = i
    Image.fromarray(sh.astype(np.uint8)).save(os.path.join(OUT, 'icons.webp'), 'WEBP', lossless=True, method=6)
    json.dump(dict(size=S, cols=cols, index=idx), open(os.path.join(OUT, 'icons.json'), 'w'), ensure_ascii=False, indent=1)
    print(len(names), 'icons')
