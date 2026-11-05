# 움직이는 도트 스프라이트: 주인공 탐침, 보스 8종, 떠도는 적 4종, 테두리 순찰 4종, 아이템 5종, 탄, 효과
import math
import numpy as np
from pix import Pix, ramp, hexc
from pictures import PINK, PURP, ORNG, GRN, CYAN, BLUE, RED, YEL, BRN, WHT, TEAL, caps

TAU = 2 * math.pi
OL = '#120a18'


def spr(w, h, fn, n, outline=True):
    out = []
    for f in range(n):
        p = Pix(w, h); fn(p, f / n, f)
        if outline: p.outline(OL)
        out.append(p)
    return out


# ---------------------------------------------------------------- 주인공: 나노 탐침
def probe(drawing):
    def f(p, t, i):
        c = 6.5
        glow = ramp('#ff5a2a', '#ffa040', '#fff0a0') if drawing else ramp('#1a8a7a', '#3cffcf', '#e0fff8')
        for k in range(3):   # 둘레를 도는 나선 점
            a = t * TAU + k * TAU / 3
            p.put(c + 5 * math.cos(a), c + 5 * math.sin(a), glow[1] if k else glow[2])
        p.ball(c, c, 4.2, 4.2, ramp('#2a3a5a', '#6a80b0', '#c0d0f0', '#ffffff'), amb=0.35)
        pulse = 1.2 + 0.8 * (0.5 + 0.5 * math.sin(t * TAU * 2))
        p.ball(c, c, pulse, pulse, glow, spec=False, amb=0.8)
    return f


# ---------------------------------------------------------------- 보스 8종 (32×32)
def boss_phage(p, t, i):
    c = 16; a = t * TAU
    for k in range(6):  # 다리
        x0 = 16 + (k - 2.5) * 3.2
        kick = 2 * math.sin(a * 2 + k)
        p.line([(16, 22), (x0 + (k - 2.5) * 2, 27 + kick * 0.3), (x0 + (k - 2.5) * 3.4, 31)], '#c0c8e0', 1)
    caps(p, 16, 13, 16, 23, 2.2, ramp('#4a5070', '#9aa0c0', '#e0e4f8'))
    for dy in (15, 18, 21): p.line([(14, dy), (18, dy)], '#4a5070', 1)
    # 머리(정이십면체 느낌)
    hm = p.pmask([(16, 1), (24, 5), (24, 12), (16, 16), (8, 12), (8, 5)])
    p.shade_mask(hm, ramp('#4a1a70', '#8a3ac0', '#c070ff', '#f0c0ff'), 13, 6, 10, amb=0.3)
    p.line([(16, 1), (16, 16)], '#5a2a8a', 1); p.line([(8, 5), (24, 12)], '#5a2a8a', 1); p.line([(24, 5), (8, 12)], '#5a2a8a', 1)
    p.put(14, 5 + int(math.sin(a) > 0), '#ffffff')


def boss_amoeba(p, t, i):
    a = t * TAU
    pts = [(16 + (11 + 2.5 * math.sin(3 * u + a) + 1.5 * math.sin(5 * u - 2 * a)) * math.cos(u), 16 + (10 + 2.5 * math.sin(3 * u + a + 1) + 1.5 * math.sin(4 * u + a)) * math.sin(u)) for u in np.linspace(0, TAU, 60)]
    m = p.pmask(pts)
    p.shade_mask(m, ramp('#1a5a1a', '#3aa030', '#80e050', '#d0ff90', '#f4ffe0'), 12, 11, 15, amb=0.35)
    p.ball(17 + math.sin(a), 16, 4.5, 4, ramp('#2a4a10', '#4a7a20', '#7ab040'))
    for k in range(4):
        u = k * 1.6 + a
        p.ball(16 + 7 * math.cos(u), 16 + 6 * math.sin(u), 1.5, 1.5, ramp('#5a8a20', '#a0d050'), spec=False)
    for k in (-1, 1): p.ball(13 + k * 4, 12, 2, 2.4, ramp('#000000', '#1a1a1a', '#ffffff'), spec=False)


def boss_jelly(p, t, i):
    a = t * TAU; sq = 1 + 0.12 * math.sin(a)
    for k in range(-2, 3):
        pts = [(16 + k * 3 + 2 * math.sin(y / 3 + a + k), 15 + y) for y in range(0, 16)]
        p.line(pts, '#ff80c0', 1)
    p.ball(16, 13, 12 * sq, 9 / sq, ramp('#6a1a4a', '#c03a8a', '#ff7ac0', '#ffc0e0', '#fff0f8'), mask=p.Y <= 15, amb=0.4)
    for x in range(5, 28, 3): p.put(x, 15, '#ffc0e0')
    for k in (-1, 1): p.ball(16 + k * 4, 10, 1.5, 2, ramp('#000000', '#1a1a1a', '#ffffff'), spec=False)


def boss_paramecium(p, t, i):
    a = t * TAU
    m = p.ball(16, 16, 14, 7, ramp('#5a3a08', '#a8801a', '#f0d050', '#fff4a8', '#ffffe8'), rot=0.25 * math.sin(a), amb=0.35)
    # 섬모
    for u in np.linspace(0, TAU, 28, endpoint=False):
        x, y = 16 + 15 * math.cos(u), 16 + 8 * math.sin(u)
        w = math.sin(u * 3 + a * 2)
        p.put(x + w * 0.8 * math.cos(u), y + w * 0.8 * math.sin(u), '#fff8c0')
    p.ball(18, 15, 3.5, 2.5, ramp('#5a2a08', '#a85a1a', '#e09040'), spec=False)
    p.ring(10, 17, 2, 2, '#c0a040', 1)
    for k in (-1, 1): p.ball(26, 15 + k * 1.5, 1, 1, ramp('#000000', '#ffffff'), spec=False)


def boss_hornet(p, t, i):
    a = t * TAU; flap = math.sin(a * 4)
    for k in (-1, 1):
        wm = p.ball(14 + k * 2, 9 - 2 * flap, 8, 4 + 1.5 * flap, ramp('#7a9ab8', '#c0dcf0', '#f0faff'), rot=-0.6 * k, amb=0.7, spec=False)
    body = p.ball(13, 18, 10, 6, ramp('#5a3a00', '#c08a00', '#ffd020', '#fff090'), rot=0.2)
    for dx in (-4, 1, 6):
        m, _, _ = p.emask(13 + dx, 18 + dx * 0.2, 1.4, 7, 0.2); p.fill(m & body, '#1a1006')
    p.ball(25, 15, 5, 5, ramp('#1a1006', '#3a2a14', '#6a5030'))
    p.ball(27, 14, 1.6, 1.6, ramp('#8a0000', '#ff3030', '#ffb0b0'), spec=False)
    p.line([(3, 20), (0, 22)], '#1a1006', 1)   # 침
    p.line([(26, 11), (29, 6)], '#1a1006', 1)


def boss_spider(p, t, i):
    a = t * TAU
    for k in range(4):
        for s in (-1, 1):
            ph = a * 2 + k * 1.3 + (s > 0) * 1.5
            kx, ky = 16 + s * (7 + k * 0.5), 14 + k * 2.6
            p.line([(16 + s * 3, 14 + k * 1.5), (kx + s * 3, ky - 5 + math.sin(ph)), (kx + s * 7, ky + 4 + math.sin(ph) * 1.5)], '#2a1a14', 1)
    p.ball(16, 20, 8, 7, ramp('#1a0e0a', '#4a2a1e', '#8a5a3a', '#c09060'))
    p.fill(p.pmask([(16, 16), (19, 20), (16, 25), (13, 20)]), '#d02020')
    p.ball(16, 11, 5, 4.5, ramp('#1a0e0a', '#4a2a1e', '#8a5a3a'))
    for dx in (-2, -1, 1, 2): p.put(16 + dx, 9 + (abs(dx) == 1), '#ff4040')


def boss_cancer(p, t, i):
    a = t * TAU
    pts = [(16 + (12 + 2 * math.sin(7 * u + a * 2) + 1.2 * math.sin(3 * u)) * math.cos(u), 16 + (11 + 2 * math.sin(6 * u - a) + 1.2 * math.sin(4 * u)) * math.sin(u)) for u in np.linspace(0, TAU, 70)]
    m = p.pmask(pts)
    p.shade_mask(m, ramp('#3a0a3a', '#7a1a6a', '#c03a9a', '#f080c8', '#ffd0ec'), 12, 11, 15, amb=0.3)
    for (x, y, r) in [(12, 14, 4), (20, 18, 3.5), (17, 10, 2.5)]: p.ball(x, y, r, r, ramp('#2a0a2a', '#5a1a5a', '#9a3a8a'), spec=False)
    for k in range(5):
        u = k * 1.25 + a * 0.5
        p.put(16 + 9 * math.cos(u), 16 + 8 * math.sin(u), '#ffe0ff')


def boss_plasmodium(p, t, i):
    a = t * TAU
    pts = [(4 + k * 1.2, 16 + 6 * math.sin(k * 0.35 + a * 2)) for k in range(0, 21)]
    for k, (x, y) in enumerate(pts):
        r = 2 + 3.5 * math.sin(math.pi * k / 20)
        p.ball(x, y, r, r, ramp('#3a0a1a', '#8a1a3a', '#e04a6a', '#ffa0b0'), spec=False, amb=0.4)
    p.ball(*pts[12], 2.5, 2.5, ramp('#1a0a2a', '#4a1a6a', '#8a4ac0'), spec=False)
    p.ball(pts[19][0] + 2, pts[19][1], 1.2, 1.2, ramp('#000000', '#ffffff'), spec=False)
    p.line([pts[0], (pts[0][0] - 3, pts[0][1] + 2 * math.sin(a * 3))], '#ffa0b0', 1)


BOSSES = {'phage': boss_phage, 'amoeba': boss_amoeba, 'jelly': boss_jelly, 'paramecium': boss_paramecium,
          'hornet': boss_hornet, 'spider': boss_spider, 'cancer': boss_cancer, 'plasmodium': boss_plasmodium}


# ---------------------------------------------------------------- 떠도는 작은 적 (14×14) — 가두면 잡힘
def r_bacillus(p, t, i):
    a = t * TAU
    caps(p, 4, 7 + math.sin(a), 10, 7 - math.sin(a), 3, ramp('#2a5a10', '#5aa020', '#a0e050', '#e0ffb0'))
    p.line([(2, 7), (0, 7 + 2 * math.sin(a * 2))], '#a0e050', 1)


def r_krill(p, t, i):
    a = t * TAU
    p.ball(7, 7, 5, 2.5, ramp('#6a1a2a', '#d04a6a', '#ff9ab0', '#ffe0e8'), rot=0.2 * math.sin(a))
    for k in range(4): p.line([(5 + k * 1.5, 9), (5 + k * 1.5 + math.sin(a * 2 + k), 12)], '#ff9ab0', 1)
    p.line([(11, 6), (13, 3)], '#ffc0d0', 1); p.put(10, 6, '#000000')


def r_mosquito(p, t, i):
    a = t * TAU
    for k in (-1, 1): p.ball(7 + k * 2, 4 - math.sin(a * 6), 3, 1.5, ramp('#a0b0c0', '#e0f0ff'), rot=k * 0.6, spec=False, amb=0.8)
    p.ball(7, 8, 4, 1.8, ramp('#2a2018', '#5a4a3a', '#9a8a6a'))
    p.line([(11, 8), (13.5, 9)], '#2a2018', 1)
    for k in range(3): p.line([(5 + k * 2, 9), (4 + k * 2, 12)], '#2a2018', 1)


def r_coccus(p, t, i):
    a = t * TAU
    for k in range(3):
        u = a + k * TAU / 3
        p.ball(7 + 3 * math.cos(u), 7 + 3 * math.sin(u), 2.8, 2.8, ramp('#5a3a08', '#c08a20', '#ffd060', '#fff4c0'))


ROAMERS = {'bacillus': r_bacillus, 'krill': r_krill, 'mosquito': r_mosquito, 'coccus': r_coccus}


# ---------------------------------------------------------------- 테두리 순찰 (12×12) — 선 위를 달림
def p_ribosome(p, t, i):
    a = t * TAU
    p.ball(6, 7, 4.5, 3.5, ramp('#3a1a6a', '#7a4ad0', '#b090ff', '#f0e0ff'))
    p.ball(6, 3.5, 3, 2.2, ramp('#3a1a6a', '#7a4ad0', '#c0a0ff'))
    p.put(6 + 3 * math.cos(a * 2), 7 + 2 * math.sin(a * 2), '#ffffff')


def p_starfish(p, t, i):
    a = t * TAU
    pts = []
    for k in range(10):
        u = a * 0.5 + k * TAU / 10 - math.pi / 2
        r = 5.6 if k % 2 == 0 else 2.4
        pts.append((6 + r * math.cos(u), 6 + r * math.sin(u)))
    m = p.pmask(pts); p.shade_mask(m, ramp('#6a1a08', '#d04a20', '#ff8a4a', '#ffd0a0'), 5, 5, 6)
    p.put(6, 6, '#ffe0c0')


def p_ant(p, t, i):
    a = t * TAU
    for k in range(3):
        for s in (-1, 1): p.line([(4 + k * 2, 7), (3 + k * 2 + math.sin(a * 2 + k) * s, 7 + s * 4)], '#3a1a0a', 1)
    for x, r in ((3, 2), (6, 1.6), (9, 2.2)): p.ball(x, 6, r, r * 0.9, ramp('#1a0a04', '#5a2a10', '#a05a2a'), spec=False)
    p.line([(10, 4), (12, 1)], '#3a1a0a', 1)


def p_wbc(p, t, i):
    a = t * TAU
    pts = [(6 + (4.6 + 0.8 * math.sin(5 * u + a * 2)) * math.cos(u), 6 + (4.6 + 0.8 * math.sin(5 * u + a * 2)) * math.sin(u)) for u in np.linspace(0, TAU, 40)]
    m = p.pmask(pts); p.shade_mask(m, ramp('#6a7a9a', '#b0c0e0', '#eef4ff', '#ffffff'), 4, 4, 6, amb=0.4)
    for (x, y) in [(5, 5), (7, 7), (5, 8)]: p.ball(x, y, 1.4, 1.2, ramp('#3a1a6a', '#7a4ac0'), spec=False)


PATROLS = {'ribosome': p_ribosome, 'starfish': p_starfish, 'ant': p_ant, 'wbc': p_wbc}


# ---------------------------------------------------------------- 아이템 (14×14)
def item(kind):
    COL = {'speed': YEL, 'shield': CYAN, 'freeze': BLUE, 'clock': GRN, 'life': PINK}[kind]

    def f(p, t, i):
        bob = math.sin(t * TAU)
        p.ball(7, 7 + bob * 0.6, 6, 6, COL, amb=0.45)
        c = '#ffffff'; y = 7 + bob * 0.6
        if kind == 'speed': p.line([(5, y - 3), (8, y), (6, y), (9, y + 3)], c, 1)
        elif kind == 'shield': p.fill(p.pmask([(4, y - 3), (10, y - 3), (10, y), (7, y + 4), (4, y)]), c)
        elif kind == 'freeze':
            for u in (0, 1.05, 2.1): p.line([(7 - 3.5 * math.cos(u), y - 3.5 * math.sin(u)), (7 + 3.5 * math.cos(u), y + 3.5 * math.sin(u))], c, 1)
        elif kind == 'clock': p.ring(7, y, 3.5, 3.5, c, 1); p.line([(7, y), (7, y - 2.5)], c, 1); p.line([(7, y), (9, y)], c, 1)
        elif kind == 'life':
            p.fill(p.pmask([(7, y + 3.5), (3.5, y), (3.5, y - 1.5), (5, y - 3), (7, y - 1.5), (9, y - 3), (10.5, y - 1.5), (10.5, y)]), c)
        k = int(t * 8) % 8   # 반짝
        if k < 2: p.put(4, 3 + bob, '#ffffff'); p.put(3, 4 + bob, '#ffffff')
    return f


ITEMS = ['speed', 'shield', 'freeze', 'clock', 'life']


# ---------------------------------------------------------------- 탄 · 효과
def bullet_sting(p, t, i):
    p.ball(3, 3, 2.5, 2.5, ramp('#8a1a5a', '#ff5ab0', '#ffd0f0'), spec=False, amb=0.6)
    p.put(3, 3, '#ffffff')


def bullet_spore(p, t, i):
    p.ball(3, 3, 2.5, 2.5, ramp('#2a5a10', '#7ad040', '#e0ffb0'), spec=False, amb=0.6)


def fx_boom(p, t, i):
    r = 3 + t * 13
    rng = np.random.default_rng(i * 7 + 3)
    if t < 0.75:
        p.ball(16, 16, r * 0.7 * (1 - t), r * 0.7 * (1 - t), ramp('#ff5a2a', '#ffc040', '#ffffe0'), spec=False, amb=0.9)
    p.ring(16, 16, r, r, ['#ffffff', '#fff0a0', '#ffc040', '#ff7a30', '#c03a20', '#802010', '#401008', '#200804'][i], 1.5)
    for k in range(10):
        a = k * TAU / 10 + rng.random() * 0.3
        p.put(16 + (r + 2) * math.cos(a), 16 + (r + 2) * math.sin(a), '#ffe080' if i < 5 else '#a04020')


def fx_pop(p, t, i):
    r = 2 + t * 7
    p.ring(8, 8, r, r, ['#ffffff', '#e0fff8', '#a0ffe0', '#5affc0', '#2ac090', '#108060'][i], 1)
    for k in range(6):
        a = k * TAU / 6 + t
        p.put(8 + r * 0.6 * math.cos(a), 8 + r * 0.6 * math.sin(a), '#ffffff')


def fx_sparkle(p, t, i):
    s = [1, 2, 4, 3, 2, 1][i]
    for d in range(-s, s + 1): p.put(4 + d, 4, '#fffbe0'); p.put(4, 4 + d, '#fffbe0')
    p.put(4, 4, '#ffffff')


def fx_fuse(p, t, i):
    p.ball(3, 3, 2.5 + (i % 2) * 0.6, 2.5 + (i % 2) * 0.6, ramp('#c02a10', '#ff8a20', '#ffff80'), spec=False, amb=0.8)


# ---------------------------------------------------------------- 덮개 (게임판에 아직 드러나지 않은 곳)
def cover(world):
    p = Pix(320, 240); rng = np.random.default_rng(100 + world)
    if world == 0:   # 현미경 프레파라트: 격자와 흐릿한 세포
        p.vgrad(ramp('#0e1a2a', '#14263a', '#0e1a2a'))
        for k in range(40):
            x, y, r = rng.integers(0, 320), rng.integers(0, 240), rng.integers(6, 20)
            p.ring(x, y, r, r * 0.8, '#1c3248', 1)
        for x in range(0, 320, 16): p.line([(x, 0), (x, 240)], '#18304a', 1)
        for y in range(0, 240, 16): p.line([(0, y), (320, y)], '#18304a', 1)
    elif world == 1:   # 깊은 바다 물결
        p.vgrad(ramp('#06203a', '#08284a', '#06203a'))
        for y in range(4, 240, 10):
            pts = [(x, y + 3 * math.sin(x / 12 + y)) for x in range(0, 321, 4)]
            p.line(pts, '#0c3a5e', 1)
        p.stars(200, rng, ['#1a5a80'])
    elif world == 2:   # 어두운 잎 무늬
        p.vgrad(ramp('#0e2410', '#123018', '#0e2410'))
        for _ in range(70):
            x, y, a = rng.integers(0, 320), rng.integers(0, 240), rng.random() * 3.14
            m, _, _ = p.emask(x, y, 12, 5, a); p.fill(m, '#163a1c'); p.line([(x - 10 * math.cos(a), y - 10 * math.sin(a)), (x + 10 * math.cos(a), y + 10 * math.sin(a))], '#1e4a24', 1)
    else:   # 조직: 육각 세포
        p.vgrad(ramp('#2a0a14', '#36101c', '#2a0a14'))
        for gy in range(0, 260, 18):
            for gx in range(0, 340, 20):
                ox = 10 if (gy // 18) % 2 else 0
                pts = [(gx + ox + 9 * math.cos(u), gy + 9 * math.sin(u)) for u in np.linspace(math.pi / 6, math.pi / 6 + TAU, 7)]
                p.line(pts, '#4a1626', 1); p.put(gx + ox, gy, '#5a1e30')
    # 물음표 대신 공통: 가운데 희미한 돋보기 표시
    p.ring(160, 116, 22, 22, '#ffffff22' if False else '#2a3a4a' if world == 0 else '#123a5a' if world == 1 else '#1e4a24' if world == 2 else '#4a1a2a', 3)
    p.line([(176, 132), (192, 148)], '#2a3a4a' if world == 0 else '#123a5a' if world == 1 else '#1e4a24' if world == 2 else '#4a1a2a', 5)
    return p
