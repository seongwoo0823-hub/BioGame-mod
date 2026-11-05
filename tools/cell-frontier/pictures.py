# 숨은 그림 16장 (320×240 도트): 나라 4곳 × 지역 4곳, 모두 생명과학 주제
import math
import numpy as np
from pix import Pix, ramp, hexc

W, H = 320, 240
R = np.random.default_rng

# 자주 쓰는 색 단계
PINK = ramp('#5a1a3a', '#a83a6a', '#e070a0', '#ffb0d0', '#ffe6f0')
PURP = ramp('#2a1050', '#5a2a9a', '#8a5ad0', '#c09aff', '#f0e0ff')
ORNG = ramp('#5a2208', '#a8480e', '#f08a20', '#ffc060', '#fff0c0')
GRN = ramp('#0e3a14', '#1e7a2a', '#3cb040', '#90e060', '#e0ffb0')
CYAN = ramp('#08304a', '#10708a', '#30b0c8', '#80e8f0', '#e0ffff')
BLUE = ramp('#0a1a4a', '#1a3a8a', '#3a6ad0', '#80aaff', '#e0ecff')
RED = ramp('#3a0610', '#8a1020', '#d02a30', '#ff7060', '#ffd0c0')
YEL = ramp('#5a4a08', '#a88a10', '#f0d020', '#fff080', '#ffffe0')
BRN = ramp('#2a1608', '#5a3414', '#8a5a2a', '#c09060', '#f0d8b0')
WHT = ramp('#5a6070', '#9aa0b0', '#d0d4e0', '#f4f6fa', '#ffffff')
TEAL = ramp('#063a34', '#0e7a6a', '#20c0a0', '#80f0d0', '#e0fff4')


def caps(p, x0, y0, x1, y1, r, rp, light=(-0.55, -0.65)):
    """둥근 막대(캡슐) 음영"""
    ang = math.atan2(y1 - y0, x1 - x0); L = math.hypot(x1 - x0, y1 - y0)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    return p.ball(cx, cy, L / 2 + r, r, rp, rot=ang, light=light)


def wobble_ellipse(p, cx, cy, rx, ry, amp, k, ph=0.0):
    pts = [(cx + (rx + amp * math.sin(k * t + ph)) * math.cos(t), cy + (ry + amp * math.sin(k * t + ph)) * math.sin(t)) for t in np.linspace(0, 2 * math.pi, 120)]
    return p.pmask(pts)


# ================================================================ 1. 세포 왕국
def animal_cell():
    p = Pix(W, H); rng = R(1)
    p.rgrad(160, 120, 230, ramp('#1a1440', '#120e30', '#0a0820', '#06040e'))
    p.stars(160, rng, ['#3a3070', '#2a2460', '#504a90'])
    cell = wobble_ellipse(p, 160, 122, 142, 104, 4, 5, 0.6)
    p.shade_mask(cell, ramp('#7a3a6a', '#b06090', '#e098b8', '#f8c8dc', '#fff0f6'), 130, 95, 190, amb=0.35)
    # 세포막 이중선
    outer = wobble_ellipse(p, 160, 122, 146, 108, 4, 5, 0.6); inner = wobble_ellipse(p, 160, 122, 140, 102, 4, 5, 0.6)
    p.fill(outer & ~cell, '#ff8ab8'); p.fill(cell & ~inner, '#c0507e')
    # 소포체: 핵 주변 물결 띠 + 리보솜
    for k, rr in enumerate([52, 60, 68]):
        pts = [(150 + (rr + 3 * math.sin(9 * t)) * math.cos(t), 112 + (rr * 0.8 + 3 * math.sin(9 * t)) * math.sin(t)) for t in np.linspace(-2.2, 1.0, 60)]
        p.line(pts, '#7a7ad8', 3); p.line(pts, '#a8a8ff', 1)
        for t in np.linspace(-2.2, 1.0, 14): p.put(150 + (rr + 5) * math.cos(t), 112 + (rr * 0.8 + 5) * math.sin(t), '#3a2a8a')
    # 핵
    p.ball(150, 112, 44, 38, PURP, amb=0.25)
    p.ring(150, 112, 44, 38, '#3a1a6a', 1.6)
    for t in np.linspace(0, 2 * math.pi, 22, endpoint=False): p.put(150 + 43 * math.cos(t), 112 + 37 * math.sin(t), '#d0b0ff')
    p.ball(158, 118, 14, 12, ramp('#1a0a3a', '#3a1a70', '#6a3ab0', '#9a70e0'), amb=0.3)
    for _ in range(40):  # 염색질
        a, r = rng.random() * 6.28, rng.random() * 32
        p.put(150 + r * math.cos(a), 112 + r * 0.85 * math.sin(a), '#4a2a8a')
    # 미토콘드리아
    for x, y, a in [(74, 160, 0.4), (238, 92, -0.6), (230, 178, 0.2), (92, 70, -0.3)]:
        m = p.ball(x, y, 20, 10, ORNG, rot=a)
        for k in range(-14, 15, 5):
            q = [(x + math.cos(a) * k + math.cos(a + 1.57) * dy, y + math.sin(a) * k + math.sin(a + 1.57) * dy) for dy in (-6, -2, 2, 6)]
            p.line([q[0], q[1]], '#8a3a0a', 1); p.line([q[2], q[3]], '#8a3a0a', 1)
        p.ring(x, y, 20, 10, '#6a2a08', 1.2, rot=a)
    # 골지체
    for k in range(5):
        pts = [(214 + k * 6 + 6 * math.sin(t * 2.4), 128 + t * 26) for t in np.linspace(-1, 1, 20)]
        p.line(pts, ['#2a8ad0', '#3aa0e0', '#4ab8f0', '#60c8ff', '#80d8ff'][k], 4)
    for (x, y) in [(246, 112), (250, 140), (244, 156)]: p.ball(x, y, 4, 4, CYAN)
    # 리소좀 · 소포 · 중심체
    for _ in range(9):
        x, y = rng.integers(40, 280), rng.integers(40, 200)
        if (x - 150) ** 2 / 60 ** 2 + (y - 112) ** 2 / 50 ** 2 < 1 or not cell[y, x]: continue
        p.ball(x, y, 5, 5, GRN)
    for x, y in [(110, 182), (118, 186)]: caps(p, x - 4, y, x + 4, y, 2.5, YEL)
    p.stars(70, rng, ['#c070a0'], mask=cell)
    return p


def plant_cell():
    p = Pix(W, H); rng = R(2)
    p.vgrad(ramp('#0e2a10', '#14401a', '#0e2a10'))
    # 옆 세포 벽 (벌집 무늬)
    for gx in range(-40, 360, 80):
        for gy in range(-30, 280, 64):
            if abs(gx - 160) < 40 and abs(gy - 120) < 40: continue
            m = p.pmask([(gx - 36, gy - 28), (gx + 36, gy - 28), (gx + 36, gy + 28), (gx - 36, gy + 28)])
            p.fill(m, '#1a5020'); p.inner_line(m, '#2a7030')
            p.ball(gx + 10, gy - 4, 6, 4, ramp('#1e5a1a', '#2e8a2a', '#4ab040'), spec=False)
    # 세포벽 · 세포막
    wall = p.pmask([(22, 30), (298, 22), (306, 214), (14, 222)])
    p.fill(wall, '#7a5a20')
    p.inner_line(wall, '#c09040')
    mem = p.pmask([(32, 40), (288, 33), (295, 204), (25, 211)])
    p.shade_mask(mem, ramp('#7aa060', '#a0c880', '#c8e8a8', '#e8ffd8'), 120, 90, 230, amb=0.4)
    p.inner_line(mem, '#4a8a3a')
    # 액포
    vac = p.pmask([(120, 58), (270, 52), (276, 190), (126, 196), (104, 130)])
    p.shade_mask(vac, ramp('#4ab8d8', '#7ad8f0', '#b8f0ff', '#e8ffff'), 170, 90, 180, amb=0.5)
    p.inner_line(vac, '#2a8ab0')
    # 핵
    p.ball(70, 150, 30, 26, PURP); p.ball(76, 154, 9, 8, ramp('#2a1050', '#5a2a9a', '#7a4ac0'))
    # 엽록체
    for x, y, a in [(60, 72, 0.3), (96, 50, -0.2), (290 - 30, 205 - 8, 0.1), (200, 205, -0.15), (150, 210, 0.2), (46, 196, -0.4), (92, 206, 0.3), (284, 120, 1.4)]:
        p.ball(x, y, 14, 8, GRN, rot=a)
        for k in (-7, -2, 3, 8): p.line([(x + math.cos(a) * k - math.sin(a) * 4, y + math.sin(a) * k + math.cos(a) * 4), (x + math.cos(a) * k + math.sin(a) * 4, y + math.sin(a) * k - math.cos(a) * 4)], '#0e4a14', 2)
    # 미토콘드리아
    for x, y, a in [(48, 110, 1.2), (112, 196, 0.4)]: p.ball(x, y, 9, 5, ORNG, rot=a)
    p.stars(60, rng, ['#e8ffd0'], mask=mem & ~vac)
    return p


def mitochondria():
    p = Pix(W, H); rng = R(3)
    p.rgrad(160, 120, 220, ramp('#3a1a3a', '#2a102a', '#1a0a1e', '#0e0612'))
    for _ in range(140):
        x, y = rng.integers(0, W), rng.integers(0, H); p.put(x, y, '#6a3a6a'); p.put(x + 1, y, '#4a2a4a')
    a = -0.18
    outer = p.ball(160, 122, 140, 70, ramp('#4a1a06', '#8a3a0e', '#d06a18', '#ffa040', '#ffd890'), rot=a, amb=0.3)
    p.ring(160, 122, 140, 70, '#3a1004', 2, rot=a)
    mat, u, v = p.emask(160, 122, 130, 60, a)
    p.shade_mask(mat, ramp('#6a2a5a', '#9a4a7a', '#c870a0', '#f0a0c8'), 120, 95, 160, amb=0.4)
    # 크리스타(안쪽 막 주름)
    c, s = math.cos(a), math.sin(a)
    for k in range(-112, 120, 16):
        top = 1 if (k // 16) % 2 == 0 else -1
        L = 52 * math.sqrt(max(0, 1 - (k / 130) ** 2))
        pts = []
        for t in np.linspace(-L * top, (L - 20) * top, 18):
            w = 4 * math.sin(t / 6)
            pts.append((160 + c * (k + w) - s * t, 122 + s * (k + w) + c * t))
        p.line(pts, '#ffb060', 5); p.line(pts, '#8a3a0e', 1)
    p.inner_line(mat, '#ffc070')
    # ATP 반짝임 · 리보솜 · DNA 고리
    for _ in range(26):
        x, y = rng.integers(40, 280), rng.integers(70, 175)
        if not mat[y, x]: continue
        for d in (-2, -1, 0, 1, 2): p.put(x + d, y, '#fff6a0'); p.put(x, y + d, '#fff6a0')
        p.put(x, y, '#ffffff')
    p.ring(206, 140, 9, 7, '#e0d0ff', 1.2)
    for _ in range(50):
        x, y = rng.integers(0, W), rng.integers(0, H)
        if outer[y, x]: continue
        p.put(x, y, '#c08ac0')
    return p


def dna():
    p = Pix(W, H); rng = R(4)
    p.vgrad(ramp('#0a1030', '#101a48', '#0a1030', '#060818'))
    p.stars(220, rng, ['#2a3a7a', '#4a5aa0', '#8090d0'])
    # 염색체 (왼쪽 아래)
    for dx, sg in ((-7, 1), (7, -1)):
        caps(p, 54 + dx, 140, 54 + dx + sg * 10, 100, 7, PINK)
        caps(p, 54 + dx, 140, 54 + dx - sg * 8, 192, 7, PINK)
    p.ball(54, 140, 6, 5, ramp('#4a1030', '#8a2050', '#c04a80'))
    for y in range(104, 190, 6): p.line([(44, y), (66, y)], '#7a2a5a', 1)
    # 이중나선 (앞뒤 깊이 순서)
    items = []
    for k in range(0, 52):
        y = 6 + k * 4.5; ph = k * 0.36
        x1, z1 = 195 + 46 * math.sin(ph), math.cos(ph)
        x2, z2 = 195 + 46 * math.sin(ph + math.pi), math.cos(ph + math.pi)
        items.append((min(z1, z2) - 0.01, 'rung', (x1, y, x2, y, k)))
        items.append((z1, 'b', (x1, y, z1, 0)))
        items.append((z2, 'b', (x2, y, z2, 1)))
    PAIR = [('#ff5a6a', '#5ad0ff'), ('#ffd040', '#7aff7a')]
    for z, kind, d in sorted(items, key=lambda t: t[0]):
        if kind == 'rung':
            x1, y, x2, _, k = d; cA, cB = PAIR[k % 2] if k % 3 else PAIR[(k + 1) % 2]
            mid = (x1 + x2) / 2
            p.line([(x1, y), (mid, y)], cA, 2); p.line([(mid, y), (x2, y)], cB, 2)
        else:
            x, y, zz, side = d
            rp = BLUE if side == 0 else PINK
            p.ball(x, y, 5 + zz * 1.2, 4 + zz, rp, amb=0.25 + 0.2 * (zz + 1) / 2, spec=zz > 0.3)
    # 떠다니는 뉴클레오타이드
    for _ in range(9):
        x, y = rng.integers(100, 300), rng.integers(10, 230)
        if abs(x - 195) < 60: continue
        p.ball(x, y, 3, 3, YEL); p.line([(x + 3, y), (x + 8, y + 2)], '#8090d0', 1)
    return p


# ================================================================ 2. 푸른 바다
def ocean_bg(p, rng, top='#2a8ab8', bot='#062a4a'):
    p.vgrad(ramp(top, '#1a6a98', '#0e4a78', bot))
    for k in range(6):  # 빛줄기
        x = 30 + k * 55 + rng.integers(-10, 10)
        m = p.pmask([(x, 0), (x + 16, 0), (x + 60, H), (x + 30, H)])
        p.blend(m, '#c8f0ff', 0.08)


def bubbles(p, rng, n):
    for _ in range(n):
        x, y, r = rng.integers(5, W - 5), rng.integers(5, H - 5), rng.integers(1, 4)
        p.ring(x, y, r + .5, r + .5, '#c8f8ff', 1); p.put(x - r / 2, y - r / 2, '#ffffff')


def plankton():
    p = Pix(W, H); rng = R(5)
    ocean_bg(p, rng, '#3ab0c8', '#0a3a58')
    for _ in range(120): p.put(rng.integers(0, W), rng.integers(0, H), '#6ad0e0')
    # 둥근 규조류
    for x, y, r in [(70, 70, 26), (238, 168, 30), (150, 196, 16), (270, 54, 14)]:
        p.ball(x, y, r, r, ramp('#5a4a10', '#a08a20', '#e0c860', '#fff0a8', '#ffffe8'), amb=0.35)
        for t in np.linspace(0, 2 * math.pi, 24, endpoint=False): p.line([(x + r * 0.25 * math.cos(t), y + r * 0.25 * math.sin(t)), (x + r * 0.95 * math.cos(t), y + r * 0.95 * math.sin(t))], '#8a7020', 1)
        p.ring(x, y, r * 0.55, r * 0.55, '#c0a040', 1); p.ring(x, y, r, r, '#5a4a10', 1.2)
    # 길쭉한 규조류
    for x, y, a in [(130, 88, 0.5), (200, 60, -0.3), (60, 170, -0.8)]:
        p.ball(x, y, 30, 7, ramp('#4a5a10', '#8aa020', '#c8e050', '#f0ffa0'), rot=a)
        for k in range(-24, 26, 4): p.put(x + math.cos(a) * k, y + math.sin(a) * k, '#4a5a10')
    # 요각류
    cx, cy = 182, 120
    p.ball(cx, cy, 24, 14, ramp('#6a2010', '#c04a20', '#ff8a4a', '#ffc8a0'), rot=-0.3)
    for k in range(4): p.ball(cx + 22 + k * 7, cy + 8 + k * 2, 6 - k, 5 - k, ramp('#6a2010', '#c04a20', '#ff8a4a'), spec=False)
    p.line([(cx - 20, cy - 8), (cx - 70, cy - 46), (cx - 110, cy - 50)], '#ffb080', 1)
    p.line([(cx - 18, cy - 4), (cx - 72, cy - 20), (cx - 112, cy - 12)], '#ffb080', 1)
    for k in range(5): p.line([(cx - 4 + k * 6, cy + 10), (cx - 8 + k * 6, cy + 22)], '#c04a20', 1)
    p.ball(cx - 16, cy - 2, 3, 3, ramp('#000000', '#3a0a0a', '#ff2020'))
    # 와편모류
    for x, y in [(96, 140), (262, 108)]:
        p.ball(x, y, 11, 13, ramp('#1a5a2a', '#2a9a4a', '#6ad080', '#c0ffd0')); p.line([(x - 11, y), (x + 11, y)], '#0e3a1a', 1)
        p.line([(x, y + 13), (x + 4, y + 22), (x - 2, y + 30)], '#c0ffd0', 1)
    bubbles(p, rng, 26)
    return p


def coral_reef():
    p = Pix(W, H); rng = R(6)
    ocean_bg(p, rng, '#3ac0e0', '#0a4a78')
    sand = p.pmask([(0, 196)] + [(x, 190 + 8 * math.sin(x / 30)) for x in range(0, 321, 8)] + [(320, 240), (0, 240)])
    p.vgrad(ramp('#f0d8a0', '#d8b878', '#a88a50'), 185, 240, mask=sand)
    p.stars(140, rng, ['#c09a60', '#fff0c8'], mask=sand)

    def branch(x, y, a, L, w, d, col):
        if d == 0 or L < 3: return
        x2, y2 = x + math.cos(a) * L, y + math.sin(a) * L
        p.line([(x, y), (x2, y2)], col[0], int(w) + 2); p.line([(x, y), (x2, y2)], col[1], max(1, int(w)))
        p.put(x2, y2, col[2])
        branch(x2, y2, a - 0.42 + rng.random() * 0.1, L * 0.78, w * 0.75, d - 1, col)
        branch(x2, y2, a + 0.42 - rng.random() * 0.1, L * 0.78, w * 0.75, d - 1, col)
    branch(60, 200, -1.57, 28, 5, 6, ('#6a1030', '#ff5a8a', '#ffd0e0'))
    branch(262, 206, -1.6, 24, 4, 6, ('#5a2a08', '#ff9a30', '#fff0a0'))
    # 뇌산호
    bm = p.ball(170, 200, 36, 24, ramp('#4a5a10', '#8a9a20', '#c8d860', '#f0ffb0'))
    for k in range(7):
        pts = [(140 + t, 186 + k * 5 + 2 * math.sin(t / 4 + k)) for t in range(0, 62, 2)]
        m = p.lmask(pts, 1) & bm; p.fill(m, '#5a6a14')
    # 말미잘
    for t in np.linspace(-2.8, -0.3, 13):
        pts = [(112 + 6 * math.cos(t) + s * math.cos(t) * 22 + 3 * math.sin(s * 5), 196 + s * math.sin(t) * 26) for s in np.linspace(0, 1, 10)]
        p.line(pts, '#c040c0', 3); p.put(*pts[-1], '#ffb0ff')
    p.ball(112, 200, 12, 7, ramp('#4a1050', '#8a2a9a', '#c060d0'))
    # 해초
    for x0 in (20, 300, 228):
        pts = [(x0 + 6 * math.sin(y / 14), y) for y in range(240, 120, -4)]
        p.line(pts, '#1a7a2a', 4); p.line(pts, '#4ac050', 1)

    def fish(x, y, s, body, stripe=None, flip=1):
        p.ball(x, y, 14 * s, 8 * s, body)
        tail = p.pmask([(x - flip * 12 * s, y), (x - flip * 22 * s, y - 8 * s), (x - flip * 22 * s, y + 8 * s)])
        p.fill(tail, body[2]); p.inner_line(tail, body[0])
        if stripe:
            for dx in stripe:
                m, _, _ = p.emask(x + flip * dx * s, y, 1.6 * s, 7.6 * s); p.fill(m & (p.emask(x, y, 14 * s, 8 * s)[0]), '#ffffff')
        p.ball(x + flip * 8 * s, y - 2 * s, 2 * s, 2 * s, ramp('#000000', '#202030', '#ffffff'), spec=False)
    fish(206, 70, 1.6, ORNG, stripe=(-4, 5))
    fish(90, 100, 1.2, ramp('#0a1a5a', '#1a40c0', '#3a80ff', '#a0d0ff'), flip=-1)
    fish(270, 130, 0.9, YEL, flip=-1)
    for k in range(7): fish(130 + k * 9, 40 + (k % 3) * 7, 0.45, CYAN)
    bubbles(p, rng, 20)
    return p


def jellyfish():
    p = Pix(W, H); rng = R(7)
    p.vgrad(ramp('#0a2a5a', '#081a40', '#06102a', '#040814'))
    for _ in range(160): p.put(rng.integers(0, W), rng.integers(0, H), ['#2a4a8a', '#4a8ac0', '#a0e0ff'][rng.integers(0, 3)])

    def jelly(cx, cy, r, rp, glow):
        # 촉수 (먼저 그림)
        for k in range(-3, 4):
            pts = [(cx + k * r / 4 + 5 * math.sin(t / 9 + k), cy + t) for t in range(0, int(r * 3.2), 3)]
            p.line(pts, rp[1], 1)
        for k in (-1, 1):
            pts = [(cx + k * r / 5 + 8 * math.sin(t / 12 + k * 2), cy + t) for t in range(0, int(r * 1.8), 2)]
            p.line(pts, rp[2], 4); p.line(pts, rp[3], 1)
        bell = p.ball(cx, cy, r, r * 0.75, rp, mask=p.Y <= cy + 2, amb=0.4)
        p.ring(cx, cy, r, r * 0.75, rp[3], 1)
        for t in np.linspace(math.pi, 2 * math.pi, 9):
            p.line([(cx + r * 0.2 * math.cos(t), cy + r * 0.15 * math.sin(t)), (cx + r * 0.8 * math.cos(t), cy + r * 0.6 * math.sin(t))], rp[2], 1)
        for x in range(int(cx - r), int(cx + r) + 1, 4): p.ball(x, cy + 2, 2, 1.5, rp, spec=False)
        p.blend(p.emask(cx, cy - r * 0.2, r * 1.6, r * 1.3)[0] & ~bell, glow, 0.08)
    jelly(96, 70, 42, PINK, '#ff80c0')
    jelly(236, 118, 34, CYAN, '#60e0ff')
    jelly(160, 172, 22, PURP, '#c080ff')
    jelly(276, 40, 14, ramp('#5a3a08', '#c08a20', '#ffd060', '#fff4c0'), '#ffe080')
    return p


def whale():
    p = Pix(W, H); rng = R(8)
    ocean_bg(p, rng, '#5ac8e8', '#06244a')
    # 수면
    for x in range(0, W, 6): p.line([(x, 8 + 2 * math.sin(x / 9)), (x + 6, 8 + 2 * math.sin((x + 6) / 9))], '#e0fbff', 1)
    # 크릴 떼
    for _ in range(170):
        x, y = rng.normal(250, 28), rng.normal(70, 18)
        p.put(x, y, '#ff8aa0'); p.put(x + 1, y, '#ff5a7a')
    # 작은 물고기 떼
    for k in range(26):
        x, y = 40 + (k % 9) * 10 + rng.integers(-3, 3), 40 + (k // 9) * 8
        p.ball(x, y, 4, 2, ramp('#4a5a7a', '#8aa0c0', '#d0e8ff'), spec=False); p.put(x - 5, y, '#8aa0c0')
    # 고래
    body = p.pmask([(20, 150), (60, 120), (150, 112), (240, 128), (288, 150), (300, 156), (284, 162), (236, 176), (140, 190), (60, 186), (28, 170)])
    p.shade_mask(body, ramp('#0a1a3a', '#1a3a6a', '#2a5a98', '#5a8ac8', '#a0c8f0'), 140, 110, 180, amb=0.3)
    belly = body & (p.Y > 165 + (p.X - 160) * 0.04)
    p.dith(belly, np.clip((p.Y - 160) / 30.0, 0, 1), ramp('#5a7aa0', '#90b0d0', '#c0d8f0'))
    for k in range(7): p.line([(70 + k * 4, 172 + k), (210, 178 + k * 1.2)], '#3a5a8a', 1)
    tail = p.pmask([(286, 152), (316, 120), (308, 150), (318, 182)])
    p.shade_mask(tail, ramp('#0a1a3a', '#1a3a6a', '#2a5a98'), 300, 140, 40)
    fin = p.pmask([(130, 176), (150, 206), (164, 214), (150, 186)])
    p.fill(fin, '#2a4a80'); p.inner_line(fin, '#0a1a3a')
    p.inner_line(body, '#06102a')
    p.ball(64, 150, 3, 3, ramp('#000000', '#101830', '#ffffff'), spec=False)
    p.line([(30, 162), (90, 168)], '#06102a', 1)
    bubbles(p, rng, 22)
    return p


PICS_A = [animal_cell, plant_cell, mitochondria, dna, plankton, coral_reef, jellyfish, whale]


# ================================================================ 3. 초록 숲
def sky_meadow(p, rng, hy=150):
    p.vgrad(ramp('#5ab0f0', '#8ad0ff', '#c8ecff'), 0, hy)
    for cx, cy, r in [(60, 40, 14), (78, 34, 18), (98, 42, 12), (232, 30, 12), (250, 26, 16), (268, 32, 11)]:
        p.ball(cx, cy, r, r * 0.7, ramp('#b0c8e0', '#e0ecf8', '#ffffff'), spec=False, amb=0.6)
    gm = p.pmask([(0, hy)] + [(x, hy - 6 * math.sin(x / 40) - 4) for x in range(0, 321, 8)] + [(320, 240), (0, 240)])
    p.vgrad(ramp('#7ad048', '#4aa030', '#2a7020', '#164a14'), hy - 10, 240, mask=gm)
    for _ in range(260):
        x, y = rng.integers(0, W), rng.integers(hy, H)
        if gm[y, x]: p.line([(x, y), (x + rng.integers(-2, 3), y - rng.integers(2, 6))], '#9ae060' if rng.random() < 0.5 else '#1e6a1a', 1)
    return gm


def flower_bee():
    p = Pix(W, H); rng = R(9)
    sky_meadow(p, rng, 160)
    # 작은 꽃들
    for x, y, c in [(30, 190, PINK), (280, 200, YEL), (250, 178, PURP), (60, 216, ORNG)]:
        p.line([(x, y), (x + 2, y + 30)], '#2a7a20', 2)
        for t in np.linspace(0, 2 * math.pi, 6, endpoint=False): p.ball(x + 6 * math.cos(t), y + 6 * math.sin(t), 4, 4, c, spec=False)
        p.ball(x, y, 3, 3, YEL)
    # 큰 꽃
    cx, cy = 140, 110
    p.line([(cx, cy), (cx + 10, 180), (cx + 4, 240)], '#1e6a1a', 6); p.line([(cx, cy), (cx + 10, 180), (cx + 4, 240)], '#3aa030', 2)
    leaf = p.pmask([(cx + 8, 190), (cx + 60, 170), (cx + 80, 186), (cx + 40, 200)]); p.shade_mask(leaf, GRN, cx + 40, 180, 40)
    for t in np.linspace(0, 2 * math.pi, 10, endpoint=False):
        p.ball(cx + 34 * math.cos(t), cy + 30 * math.sin(t), 24, 12, ramp('#7a1040', '#c8306a', '#ff6a9a', '#ffb0c8', '#fff0f4'), rot=t, amb=0.35)
    p.ball(cx, cy, 20, 18, ramp('#5a3008', '#a86010', '#f0a020', '#ffd860'))
    for _ in range(60):
        a, r = rng.random() * 6.28, rng.random() * 17
        p.put(cx + r * math.cos(a), cy + r * math.sin(a), '#fff6a0' if rng.random() < 0.6 else '#6a3a08')
    # 꿀벌
    bx, by = 236, 76
    for k in (-1, 1):
        wm = p.ball(bx - 4 + k * 4, by - 14, 12, 7, ramp('#80b0d0', '#c0e0f8', '#f0faff'), rot=-0.5 + k * 0.6, spec=False, amb=0.7)
        p.inner_line(wm, '#5a7a9a')
    body = p.ball(bx, by, 20, 12, YEL, rot=0.15)
    for dx in (-8, 0, 8):
        m, _, _ = p.emask(bx + dx, by + dx * 0.15, 3, 13, 0.15); p.fill(m & body, '#2a1a08')
    p.ball(bx + 22, by + 2, 8, 8, ramp('#0a0806', '#2a2018', '#5a4a3a'))
    p.ball(bx + 25, by, 2, 2, ramp('#000000', '#ffffff'), spec=False)
    p.line([(bx + 26, by - 6), (bx + 34, by - 16)], '#2a1a08', 1); p.line([(bx + 22, by - 6), (bx + 26, by - 18)], '#2a1a08', 1)
    p.line([(bx - 20, by + 2), (bx - 26, by + 3)], '#2a1a08', 2)
    for k in range(3): p.line([(bx - 6 + k * 7, by + 11), (bx - 8 + k * 7, by + 20)], '#2a1a08', 1)
    p.ball(bx + 4, by + 14, 3, 3, ramp('#a86010', '#f0b020', '#ffe080'))  # 꽃가루 바구니
    for k in range(12): p.put(bx - 30 - k * 6, by + 14 + k * 2.6 + 2 * math.sin(k), '#ffe060')  # 꽃가루 자취
    return p


def frog_cycle():
    p = Pix(W, H); rng = R(10)
    p.vgrad(ramp('#3a9a8a', '#2a7a7a', '#1a5a64', '#0e3a48'))
    for _ in range(40):
        x, y = rng.integers(0, W), rng.integers(0, H); p.line([(x, y), (x + 8, y)], '#5ab8a8', 1)
    for x, y, r in [(40, 30, 26), (290, 210, 30), (282, 36, 20)]:
        pad = p.ball(x, y, r, r * 0.6, GRN, amb=0.4, spec=False)
        m = p.pmask([(x, y), (x + r * 1.2, y - 4), (x + r * 1.2, y + 4)]); p.fill(m & pad, '#3a9a8a')
    cx, cy = 160, 120
    # 순환 화살표
    for k in range(5):
        a0, a1 = -math.pi / 2 + k * 2 * math.pi / 5 + 0.38, -math.pi / 2 + (k + 1) * 2 * math.pi / 5 - 0.38
        pts = [(cx + 84 * math.cos(t), cy + 80 * math.sin(t)) for t in np.linspace(a0, a1, 12)]
        p.line(pts, '#e8fff8', 2)
        ex, ey = pts[-1]; dx, dy = pts[-1][0] - pts[-2][0], pts[-1][1] - pts[-2][1]; L = math.hypot(dx, dy) or 1; dx, dy = dx / L, dy / L
        p.fill(p.pmask([(ex + dx * 5, ey + dy * 5), (ex - dy * 4, ey + dx * 4), (ex + dy * 4, ey - dx * 4)]), '#e8fff8')
    pos = [(cx + 84 * math.cos(-math.pi / 2 + k * 2 * math.pi / 5), cy + 80 * math.sin(-math.pi / 2 + k * 2 * math.pi / 5)) for k in range(5)]
    # 1 알
    x, y = pos[0]
    for dx, dy in [(-8, -4), (0, -6), (8, -3), (-5, 4), (4, 5), (12, 4), (-12, 3)]:
        p.ball(x + dx, y + dy, 5, 5, ramp('#6a8a9a', '#a8c8d0', '#e0f8ff'), amb=0.6); p.ball(x + dx, y + dy, 2, 2, ramp('#000000', '#202020', '#404040'), spec=False)
    # 2 올챙이
    x, y = pos[1]
    p.line([(x + 4, y), (x + 14, y + 2 * math.sin(1)), (x + 22, y - 3)], '#3a3020', 3)
    p.ball(x, y, 8, 6, ramp('#1a140a', '#3a3020', '#6a5a40'))
    # 3 뒷다리 올챙이
    x, y = pos[2]
    p.line([(x + 4, y), (x + 16, y + 2), (x + 22, y - 2)], '#3a4a20', 3)
    p.ball(x, y, 9, 7, ramp('#1a2a0a', '#3a5a20', '#6a8a40'))
    p.line([(x + 6, y + 5), (x + 10, y + 11), (x + 14, y + 12)], '#3a5a20', 2)
    # 4 새끼 개구리
    x, y = pos[3]
    p.line([(x + 8, y + 2), (x + 18, y + 4)], '#4a7a20', 2)
    p.ball(x, y, 10, 8, ramp('#1e4a10', '#3a8a20', '#7ac040', '#c0f080'))
    for d in (-1, 1): p.ball(x - 4 + d * 4, y - 7, 3, 3, ramp('#2a2a0a', '#e0e060', '#ffffff'), spec=False)
    # 5 개구리 (크게, 가운데 위)
    x, y = cx, cy + 6
    p.ball(x - 20, y + 16, 10, 7, ramp('#1e4a10', '#3a8a20', '#7ac040'), spec=False)
    p.ball(x + 20, y + 16, 10, 7, ramp('#1e4a10', '#3a8a20', '#7ac040'), spec=False)
    body = p.ball(x, y, 28, 20, ramp('#0e3a0a', '#2a7a1a', '#5ab030', '#a0e060', '#e8ffc0'))
    p.ball(x, y + 8, 18, 9, ramp('#8a9a50', '#c8d890', '#f0ffd0'), spec=False, amb=0.6)
    for d in (-1, 1):
        p.ball(x + d * 14, y - 16, 8, 8, ramp('#1e4a10', '#3a8a20', '#7ac040'))
        p.ball(x + d * 14, y - 17, 5, 5, ramp('#3a2a00', '#c0a000', '#ffe040'), spec=False); p.line([(x + d * 14 - 3, y - 17), (x + d * 14 + 3, y - 17)], '#000000', 1)
    for _ in range(14):
        a, r = rng.random() * 6.28, rng.random() * 20
        if body[int(y + r * 0.6 * math.sin(a)), int(x + r * math.cos(a))]: p.ball(x + r * math.cos(a), y - 4 + r * 0.6 * math.sin(a), 2, 2, ramp('#0e3a0a', '#1e5a10'), spec=False)
    p.line([(x - 10, y + 2), (x, y + 5), (x + 10, y + 2)], '#0e3a0a', 1)
    return p


def butterfly():
    p = Pix(W, H); rng = R(11)
    p.vgrad(ramp('#ffd8a0', '#c8e8ff', '#8ac8f0'))
    # 가지와 잎
    p.line([(0, 200), (120, 170), (220, 190), (320, 150)], '#3a2210', 9); p.line([(0, 198), (120, 168), (220, 188), (320, 148)], '#6a4220', 3)
    for x, y, a in [(70, 176, -0.9), (170, 170, 0.8), (260, 170, -1.1), (40, 200, 0.6)]:
        lm = p.ball(x + math.cos(a) * 18, y + math.sin(a) * 18, 22, 10, GRN, rot=a, amb=0.35)
        p.line([(x, y), (x + math.cos(a) * 38, y + math.sin(a) * 38)], '#1e6a1a', 1)
    # 알
    for k in range(5): p.ball(56 + k * 5, 158 - k * 4, 2.5, 2.5, ramp('#8a8a6a', '#e8e8c8', '#ffffff'), spec=False)
    # 애벌레
    for k in range(8):
        x, y = 150 + k * 9, 168 - 4 * math.sin(k * 0.8)
        p.ball(x, y, 6, 6, ramp('#2a5a10', '#5aa020', '#a0e040', '#e0ffa0'))
        p.put(x, y - 3, '#ffe020'); p.put(x + 1, y - 3, '#202000')
    p.ball(222, 160, 7, 7, ramp('#4a3a10', '#8a7020', '#e0c060'))
    p.put(225, 158, '#000000')
    # 번데기
    p.line([(250, 172), (252, 180)], '#6a4220', 1)
    pm = p.ball(253, 196, 7, 14, ramp('#1e5a1a', '#3a9a3a', '#7ad070', '#c8ffc0'))
    for k in range(4): p.put(250 + k * 2, 188 + k * 3, '#ffd040')
    # 나비
    cx, cy = 150, 80
    for d in (-1, 1):
        up = p.ball(cx + d * 34, cy - 18, 34, 26, ramp('#5a1a00', '#c84a08', '#ff8a1a', '#ffc070'), rot=d * 0.5, amb=0.45, spec=False)
        lo = p.ball(cx + d * 24, cy + 18, 22, 18, ramp('#5a1a00', '#c84a08', '#ff8a1a', '#ffc070'), rot=-d * 0.4, amb=0.45, spec=False)
        wing = up | lo
        # 날개맥 · 테두리 무늬
        for t in np.linspace(-1.2, 1.2, 5): p.fill(p.lmask([(cx, cy), (cx + d * 64 * math.cos(t), cy - 10 + 50 * math.sin(t))], 1) & wing, '#2a0a00')
        e1 = p.emask(cx + d * 34, cy - 18, 34, 26, d * 0.5)[0] & ~p.emask(cx + d * 34, cy - 18, 29, 21, d * 0.5)[0]
        e2 = p.emask(cx + d * 24, cy + 18, 22, 18, -d * 0.4)[0] & ~p.emask(cx + d * 24, cy + 18, 18, 14, -d * 0.4)[0]
        p.fill((e1 | e2) & wing, '#1a0800')
        for t in np.linspace(0, 1, 7):
            a = -0.9 + t * 1.6; x, y = cx + d * (34 + 30 * math.cos(a)), cy - 18 + 22 * math.sin(a)
            p.put(x, y, '#ffffff')
        p.ball(cx + d * 40, cy - 26, 5, 5, ramp('#000000', '#1a0800', '#ffe8a0'), spec=False)
        p.inner_line(wing, '#1a0800')
    caps(p, cx, cy - 22, cx, cy + 22, 4, ramp('#0a0806', '#2a2018', '#5a4a3a'))
    p.line([(cx, cy - 24), (cx - 10, cy - 44)], '#1a1008', 1); p.line([(cx, cy - 24), (cx + 10, cy - 44)], '#1a1008', 1)
    p.put(cx - 10, cy - 44, '#000000'); p.put(cx + 10, cy - 44, '#000000')
    return p


def mushroom():
    p = Pix(W, H); rng = R(12)
    p.vgrad(ramp('#1a3a2a', '#2a5a3a', '#4a7a4a'), 0, 110)
    for x0, w in [(10, 26), (250, 34)]:  # 나무
        p.rect(x0, 0, w, 116, '#3a2414'); p.rect(x0 + 4, 0, 6, 116, '#5a3a20')
    ground = p.Y >= 110
    p.vgrad(ramp('#4a2e14', '#3a2210', '#2a180a', '#1a0e06'), 110, 240, mask=ground)
    p.stars(500, rng, ['#5a3a1e', '#24140a', '#6a4a2a'], mask=ground)
    for _ in range(12):  # 돌
        x, y = rng.integers(0, W), rng.integers(130, 235)
        p.ball(x, y, rng.integers(3, 7), rng.integers(2, 5), ramp('#3a3a3a', '#6a6a6a', '#9a9a9a'), spec=False)
    # 나무뿌리
    for x0 in (22, 266):
        for k in range(4):
            pts = [(x0 + 4 * k + (t / 4) * (k - 1.5) * 3, 110 + t) for t in range(0, 90, 6)]
            p.line(pts, '#5a3a1e', 3)
    # 균사 그물
    def hy(x, y, a, L, d):
        if d == 0: return
        pts = [(x, y)]
        for _ in range(int(L)):
            a += rng.normal(0, 0.25); x += math.cos(a) * 2; y += math.sin(a) * 2
            if y < 114: y = 114; a = abs(a)
            pts.append((x, y))
        p.line(pts, '#e8e0c8', 1)
        for _ in range(2): hy(x, y, a + rng.normal(0, 0.9), L * 0.7, d - 1)
    for x in (90, 160, 220): hy(x, 120, math.pi / 2, 24, 5)
    for x in (60, 130, 200, 280):
        for _ in range(3): hy(x, 112, rng.uniform(0.3, 2.8), 30, 3)
    # 버섯
    def shroom(x, y, s, cap, spots):
        caps(p, x, y, x, y - 30 * s, 6 * s, ramp('#8a7a5a', '#d0c4a8', '#f4ecd8'))
        p.ball(x, y - 18 * s, 9 * s, 3 * s, ramp('#b0a080', '#e8dcc0'), spec=False)  # 턱받이
        cm = p.ball(x, y - 32 * s, 26 * s, 18 * s, cap, mask=p.Y <= y - 30 * s, amb=0.35)
        gills = p.emask(x, y - 31 * s, 24 * s, 4 * s)[0] & (p.Y > y - 32 * s)
        p.fill(gills, '#e8d8b8')
        for k in range(-20, 21, 4): p.put(x + k * s, y - 30 * s, '#a89070')
        if spots:
            for dx, dy, r in [(-12, -42, 4), (2, -46, 5), (14, -38, 3), (-4, -36, 3), (18, -44, 2)]:
                m, _, _ = p.emask(x + dx * s, y + dy * s, r * s, r * s * 0.8); p.fill(m & cm, '#fff8f0')
    shroom(120, 112, 1.5, RED, True)
    shroom(200, 112, 1.0, ramp('#3a1a08', '#7a4a1a', '#b07a3a', '#e0b070'), False)
    shroom(66, 112, 0.7, ORNG, True)
    shroom(232, 112, 0.55, RED, True)
    for _ in range(40):  # 포자
        x, y = rng.integers(60, 260), rng.integers(10, 90)
        p.put(x, y, '#f0e8c0')
    return p


# ================================================================ 4. 인체 탐험
def heart():
    p = Pix(W, H); rng = R(13)
    p.rgrad(160, 110, 220, ramp('#3a0a1a', '#2a0612', '#1a040c', '#0e0206'))
    for _ in range(80): p.put(rng.integers(0, W), rng.integers(0, H), '#5a1a2a')
    # 대정맥 · 폐동맥 · 대동맥
    p.line([(132, 70), (130, 20), (128, 0)], '#2a3a8a', 16); p.line([(132, 70), (130, 20), (128, 0)], '#4a6ad0', 8)
    p.line([(184, 70), (190, 34), (230, 20), (262, 26)], '#2a3a8a', 14); p.line([(184, 70), (190, 34), (230, 20), (262, 26)], '#4a6ad0', 6)
    aorta = [(160, 80), (156, 30), (176, 12), (204, 14), (214, 40), (214, 70)]
    p.line(aorta, '#7a0a14', 20); p.line(aorta, '#d02a30', 12); p.line([(a - 3, b) for a, b in aorta], '#ff7060', 3)
    for x in (166, 180, 196): p.line([(x, 14), (x - 2, 0)], '#d02a30', 6)
    # 심장 몸통
    body = p.pmask([(110, 80), (150, 64), (200, 68), (234, 92), (240, 130), (220, 172), (186, 206), (160, 222), (126, 196), (100, 156), (96, 112)])
    p.shade_mask(body, ramp('#4a0610', '#8a1020', '#c82a34', '#ff6a5a', '#ffb8a8'), 140, 100, 150, amb=0.3)
    # 심방 (위쪽 혹)
    p.ball(118, 98, 26, 22, ramp('#4a0610', '#8a1426', '#c03040', '#f07070'), amb=0.35)
    p.ball(214, 96, 22, 18, ramp('#4a0610', '#8a1426', '#c03040', '#f07070'), amb=0.35)
    p.inner_line(body, '#3a040a')
    # 관상혈관
    for pts, c in [([(200, 84), (186, 120), (176, 160), (162, 210)], '#ffd040'), ([(198, 86), (220, 120), (226, 150)], '#ffd040'), ([(150, 90), (128, 130), (124, 170)], '#5a7aff')]:
        p.line(pts, '#5a0a0a', 4); p.line(pts, c, 2)
        for k in range(len(pts) - 1):
            mx, my = (pts[k][0] + pts[k + 1][0]) / 2, (pts[k][1] + pts[k + 1][1]) / 2
            p.line([(mx, my), (mx + 10, my + 6)], c, 1)
    # 심전도
    ecg = []
    for x in range(0, W, 2):
        u = (x % 80)
        y = 230 - (14 if u == 40 else -6 if u == 42 else 4 if 50 < u < 58 else 0)
        ecg.append((x, y))
    p.line(ecg, '#3aff8a', 1)
    return p


def neuron():
    p = Pix(W, H); rng = R(14)
    p.rgrad(160, 120, 240, ramp('#0a1a3a', '#081430', '#060c20', '#030612'))
    for _ in range(200): p.put(rng.integers(0, W), rng.integers(0, H), ['#1a2a5a', '#2a4a8a'][rng.integers(0, 2)])

    def dend(x, y, a, L, w, d):
        if d == 0: return
        x2, y2 = x + math.cos(a) * L, y + math.sin(a) * L
        p.line([(x, y), (x2, y2)], '#6a3a9a', int(w) + 2); p.line([(x, y), (x2, y2)], '#c890ff', max(1, int(w)))
        for s in (-1, 1): dend(x2, y2, a + s * (0.35 + rng.random() * 0.3), L * 0.7, w * 0.7, d - 1)
    neurons = [(70, 70), (250, 120), (110, 190)]
    for k, (x, y) in enumerate(neurons):
        for t in np.linspace(0, 2 * math.pi, 6, endpoint=False): dend(x, y, t + k, 18, 3, 4)
    # 축삭과 말이집
    links = [((70, 70), (250, 120)), ((250, 120), (110, 190)), ((110, 190), (300, 230))]
    for (x0, y0), (x1, y1) in links:
        pts = [(x0 + (x1 - x0) * t + 12 * math.sin(t * 6), y0 + (y1 - y0) * t) for t in np.linspace(0, 1, 30)]
        p.line(pts, '#5a3a20', 3); p.line(pts, '#ffd080', 1)
        for t in np.linspace(0.12, 0.82, 6):
            i = int(t * 29); (ax, ay), (bx, by) = pts[i], pts[min(29, i + 2)]
            caps(p, ax, ay, bx, by, 3.5, ramp('#5a4a2a', '#c0a060', '#fff0c0'))
        ex, ey = pts[-3]
        for s in range(-2, 3):
            p.line([(ex, ey), (ex + 8 * math.cos(s * 0.5 + 0.3), ey + 8 * math.sin(s * 0.5 + 0.3))], '#ffd080', 1)
            p.ball(ex + 9 * math.cos(s * 0.5 + 0.3), ey + 9 * math.sin(s * 0.5 + 0.3), 2, 2, YEL, spec=False)
        # 신호 반짝임
        for t in (0.3, 0.62):
            x, y = pts[int(t * 29)]
            for d in range(-3, 4): p.put(x + d, y, '#fffff0'); p.put(x, y + d, '#fffff0')
    for x, y in neurons:
        p.ball(x, y, 14, 12, PURP, amb=0.3); p.ball(x + 2, y + 1, 5, 4, ramp('#1a0a3a', '#4a2a8a', '#8a6ac0'))
    return p


def lungs():
    p = Pix(W, H); rng = R(15)
    p.vgrad(ramp('#e8f4ff', '#c8e0f8', '#a8c8f0'))
    # 기관과 연골 고리
    p.rect(152, 0, 16, 70, '#c8a8a0')
    for y in range(4, 70, 6): p.line([(150, y), (170, y)], '#f0e0d8', 2)
    # 폐
    for d in (-1, 1):
        lm = (p.emask(160 + d * 62, 146, 44, 70)[0] | p.emask(160 + d * 50, 100, 30, 40)[0]) & ~p.emask(160 + d * 6, 176, 26, 30)[0]
        p.shade_mask(lm, ramp('#7a2a3a', '#c05a6a', '#f090a0', '#ffc8d0', '#fff0f4'), 160 + d * 50, 110, 110, amb=0.3)
        p.inner_line(lm, '#7a2a3a')
        p.line([(160 + d * 26, 150), (160 + d * 96, 128)], '#a04050', 1)
        for _ in range(60):
            x, y = 160 + d * rng.integers(24, 98), rng.integers(80, 205)
            if lm[y, x]: p.put(x, y, '#e07a8a')
    # 기관지 나무
    def br(x, y, a, L, w, d):
        if d == 0: return
        x2, y2 = x + math.cos(a) * L, y + math.sin(a) * L
        p.line([(x, y), (x2, y2)], '#8a5a50', int(w) + 2); p.line([(x, y), (x2, y2)], '#e8d0c8', max(1, int(w)))
        for s in (-1, 1): br(x2, y2, a + s * 0.45, L * 0.72, w * 0.7, d - 1)
    br(160, 68, math.pi / 2 + 0.6, 30, 6, 6); br(160, 68, math.pi / 2 - 0.6, 30, 6, 6)
    # 폐포 확대 원
    cx, cy, r = 268, 52, 44
    p.ball(cx, cy, r, r, ramp('#d0e8ff', '#f0f8ff', '#ffffff'), amb=0.8, spec=False)
    clip = p.emask(cx, cy, r - 2, r - 2)[0]
    for k in range(9):
        a = k * 0.7; rr = 10 + (k % 3) * 8
        x, y = cx + rr * math.cos(a), cy + rr * math.sin(a)
        p.ball(x, y, 9, 9, ramp('#8a2a40', '#d05a70', '#ff9aaa', '#ffd8e0'), mask=clip)
        p.fill(p.lmask([(x - 9, y), (x + 9, y + 3)], 1) & clip, '#d02a30')
        p.fill(p.lmask([(x, y - 9), (x - 3, y + 9)], 1) & clip, '#3a5ad0')
    p.ring(cx, cy, r, r, '#4a6a9a', 2)
    p.line([(cx - r * 0.7, cy + r * 0.7), (208, 130)], '#4a6a9a', 2)
    return p


def eye():
    p = Pix(W, H); rng = R(16)
    p.vgrad(ramp('#0a1a3a', '#122a58', '#0a1a3a'))
    for _ in range(60): p.put(rng.integers(0, W), rng.integers(0, H), '#3a5a9a')
    cx, cy, r = 176, 120, 92
    p.ball(cx, cy, r, r, WHT, amb=0.45)                                   # 공막
    ret = p.emask(cx, cy, r - 6, r - 6)[0] & (p.X > cx - 50)
    p.fill(ret & ~p.emask(cx, cy, r - 11, r - 11)[0], '#e05a3a')       # 망막
    p.fill(p.emask(cx, cy, r - 11, r - 11)[0], '#dff0ff')                # 유리체
    p.rgrad(cx + 10, cy, r, ramp('#f0faff', '#d8ecff', '#b8d8f0'), mask=p.emask(cx, cy, r - 11, r - 11)[0])
    p.fill(ret & ~p.emask(cx, cy, r - 11, r - 11)[0] & (p.X > cx + 40), '#f07040')
    # 각막 · 홍채 · 수정체
    p.ball(cx - r + 6, cy, 22, 40, ramp('#a0d0f0', '#d0f0ff', '#ffffff'), amb=0.7, mask=p.X < cx - r + 8)
    for d in (-1, 1): p.fill(p.pmask([(cx - r + 14, cy + d * 14), (cx - r + 22, cy + d * 14), (cx - r + 18, cy + d * 44), (cx - r + 10, cy + d * 44)]), '#3a8a5a')
    p.ball(cx - r + 30, cy, 12, 20, ramp('#6a8aa0', '#b0d0e8', '#f0faff'), amb=0.6)
    # 시신경
    p.line([(cx + r - 4, cy + 14), (cx + r + 30, cy + 26), (320, cy + 30)], '#c8a060', 14); p.line([(cx + r - 4, cy + 14), (cx + r + 30, cy + 26), (320, cy + 30)], '#f0d090', 6)
    # 혈관
    for a in np.linspace(-0.9, 0.9, 5):
        pts = [(cx + r * 0.84 + 6 * math.cos(a), cy + 14 + 0.0), (cx + (r - 14) * math.cos(a), cy + (r - 14) * math.sin(a))]
        p.line(pts, '#c02020', 1)
    # 빛이 모이는 선
    for dy in (-30, -15, 0, 15, 30):
        p.line([(0, cy + dy), (cx - r + 30, cy + dy * 0.6)], '#ffe860', 1)
        p.line([(cx - r + 30, cy + dy * 0.6), (cx + r - 10, cy)], '#fff4a0', 1)
    p.ball(cx + r - 10, cy, 4, 4, YEL, spec=False)
    p.ring(cx, cy, r, r, '#5a6070', 1.5)
    return p


PICS_B = [flower_bee, frog_cycle, butterfly, mushroom, heart, neuron, lungs, eye]
PICS = PICS_A + PICS_B
