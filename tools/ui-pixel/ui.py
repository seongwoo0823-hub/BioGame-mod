# 도트 UI 부품: 패널 테두리(9분할) · 버튼 · 칸 · 구슬 테두리 · 체력/마나 구슬
import numpy as np, math
from PIL import Image
def hx(h): h = h.lstrip('#'); return np.array([int(h[i:i+2], 16) for i in (0, 2, 4)] + [255], np.uint8)
OUT = '/home/user/test-mod/games/il-assets/px/ui/'
import os; os.makedirs(OUT, exist_ok=True)
def frame9(S=48, b=12, base='#1a1410', edge='#6b5a3e', hi='#c8a868', dark='#0a0806', gem='#c84a5a', inner='#120e0b'):
    a = np.zeros((S, S, 4), np.uint8); a[:] = hx(inner)
    for y in range(S):
        for x in range(S):
            d = min(x, y, S - 1 - x, S - 1 - y)
            if d == 0: a[y, x] = hx(dark)
            elif d == 1: a[y, x] = hx(hi) if (x < S / 2 and y < S / 2) else hx(edge)
            elif d in (2, 3): a[y, x] = hx(edge) if (x + y) % 2 else hx(base)
            elif d == 4: a[y, x] = hx(dark)
            elif d == 5: a[y, x] = hx('#2a2018')
    # 모서리 장식 (금속 판 + 보석)
    for cx, cy in ((5, 5), (S - 6, 5), (5, S - 6), (S - 6, S - 6)):
        for dy in range(-4, 5):
            for dx in range(-4, 5):
                if abs(dx) + abs(dy) <= 5: a[cy + dy, cx + dx] = hx(hi if dx + dy < 0 else edge)
        for dy in range(-1, 2):
            for dx in range(-1, 2): a[cy + dy, cx + dx] = hx(gem if dx + dy >= 0 else '#ff9a9a')
        a[cy - 4, cx] = a[cy + 4, cx] = a[cy, cx - 4] = a[cy, cx + 4] = hx(dark)
    return Image.fromarray(a)
def button(W=48, H=24, top='#4a3e2e', bot='#1e1812', edge='#8a7248', hi='#e8c878'):
    a = np.zeros((H, W, 4), np.uint8)
    for y in range(H):
        t = y / (H - 1); c = hx(top) * (1 - t) + hx(bot) * t
        for x in range(W):
            d = min(x, y, W - 1 - x, H - 1 - y)
            a[y, x] = hx('#0a0806') if d == 0 else (hx(hi) if y == 1 else hx(edge)) if d == 1 else c.astype(np.uint8)
            if d >= 2 and (x // 2 + y // 2) % 7 == 0 and y < H / 2: a[y, x] = (c * 1.15).clip(0, 255).astype(np.uint8)
    return Image.fromarray(a)
def slot(S=40):
    a = np.zeros((S, S, 4), np.uint8); a[:] = hx('#0c0a08')
    for y in range(S):
        for x in range(S):
            d = min(x, y, S - 1 - x, S - 1 - y)
            if d == 0: a[y, x] = hx('#000000')
            elif d == 1: a[y, x] = hx('#5a4a32') if (x + y) < S else hx('#2a2218')
            elif d == 2: a[y, x] = hx('#1a1510')
    return Image.fromarray(a)
def orb(S=136, col=('#3a0204', '#8a0a0a', '#d0201a', '#ff7a6a', '#ffe0d8')):
    a = np.zeros((S, S, 4), np.uint8); c = S / 2; R = S / 2 - 2
    B = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16
    for y in range(S):
        for x in range(S):
            d = math.hypot(x - c, y - c) / R
            if d > 1: continue
            nx, ny = (x - c) / R, (y - c) / R; nz = math.sqrt(max(0, 1 - nx * nx - ny * ny))
            l = max(0, -0.45 * nx - 0.6 * ny + 0.65 * nz) * 0.85 + 0.15 * nz
            k = int(min(4, max(0, l * 4.2 + B[y % 4, x % 4] * 0.9)))
            a[y, x] = hx(col[k])
    for y in range(S):   # 반사광
        for x in range(S):
            if (x - c * 0.7) ** 2 / 300 + (y - c * 0.55) ** 2 / 120 < 1 and a[y, x, 3]: a[y, x] = (a[y, x].astype(int) * 0.4 + np.array([255, 255, 255, 255]) * 0.6).astype(np.uint8)
    return Image.fromarray(a)
def ring(S=160, inner=68):
    a = np.zeros((S, S, 4), np.uint8); c = S / 2
    for y in range(S):
        for x in range(S):
            d = math.hypot(x - c + 0.5, y - c + 0.5)
            if inner <= d <= inner + 12:
                t = d - inner; ang = math.atan2(y - c, x - c)
                col = '#0a0806' if t < 1 or t > 11 else '#e8c878' if t < 3 and ang < -0.5 else '#8a6a3a' if t < 6 else '#5a4426' if t < 9 else '#2a2014'
                if 4 < t < 9 and int((ang + math.pi) / (2 * math.pi) * 24) % 3 == 0: col = '#b8904e'
                a[y, x] = hx(col)
    for k in range(8):   # 장식 징
        ang = k / 8 * 2 * math.pi; px, py = c + math.cos(ang) * (inner + 6), c + math.sin(ang) * (inner + 6)
        for dy in range(-2, 3):
            for dx in range(-2, 3):
                if dx * dx + dy * dy <= 5: a[int(py) + dy, int(px) + dx] = hx('#ffe8a0' if dx + dy < 0 else '#c89a48')
    return Image.fromarray(a)
frame9().save(OUT + 'frame.png'); frame9(S=36, b=9, gem='#5ab8ff').save(OUT + 'frame_s.png')
button().save(OUT + 'btn.png'); button(top='#5a4a7a', bot='#24183a', edge='#a888d8', hi='#f0d8ff').save(OUT + 'btn2.png'); slot().save(OUT + 'slot.png')
orb().save(OUT + 'orb_hp.png'); orb(col=('#02043a', '#0a1a8a', '#1a48d0', '#6a9aff', '#e0e8ff')).save(OUT + 'orb_mp.png'); orb(col=('#0a2a02', '#1a6a0a', '#3aa81a', '#a8ff7a', '#f0ffe0')).save(OUT + 'orb_ps.png')
ring().save(OUT + 'ring.png')
print('ok')
