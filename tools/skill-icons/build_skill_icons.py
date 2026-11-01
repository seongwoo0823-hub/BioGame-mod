# 스킬 아이콘 도트 생성기: 스킬마다 고유한 32x32 그림 (배경 색 + 1~3개 문양 조합)
# 사용: python3 build_skill_icons.py <출력 webp> <출력 json>
import sys, math, json
from PIL import Image, ImageDraw
N = 32
def hx(c): c = c.lstrip('#'); return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))
def mix(a, b, t): return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))
def ramp(c): c = hx(c); return dict(b=c, l=mix(c, (255, 255, 240), 0.45), d=mix(c, (10, 6, 14), 0.5))

class L:  # 문양 한 장 (투명 바탕)
    def __init__(s): s.im = Image.new('RGBA', (N, N), (0, 0, 0, 0)); s.d = ImageDraw.Draw(s.im)
    def poly(s, pts, c): s.d.polygon([(round(x), round(y)) for x, y in pts], fill=c + (255,))
    def rect(s, x0, y0, x1, y1, c): s.d.rectangle([round(x0), round(y0), round(x1), round(y1)], fill=c + (255,))
    def ell(s, x0, y0, x1, y1, c): s.d.ellipse([round(x0), round(y0), round(x1), round(y1)], fill=c + (255,))
    def line(s, pts, c, w=1): s.d.line([(round(x), round(y)) for x, y in pts], fill=c + (255,), width=w)
    def px(s, x, y, c):
        if 0 <= x < N and 0 <= y < N: s.im.putpixel((int(x), int(y)), c + (255,))

def rot(pts, a, cx=16, cy=16): ca, sa = math.cos(a), math.sin(a); return [(cx + (x - cx) * ca - (y - cy) * sa, cy + (x - cx) * sa + (y - cy) * ca) for x, y in pts]

# ---------------- 문양 ----------------
def m_hammer(g, R, a=-0.6):
    g.poly(rot([(15, 10), (17, 10), (17, 29), (15, 29)], a), R['d'])
    g.poly(rot([(8, 4), (24, 4), (24, 12), (8, 12)], a), R['b']); g.poly(rot([(8, 4), (24, 4), (24, 6), (8, 6)], a), R['l'])
def m_sword(g, R, a=-0.785, len_=22):
    g.poly(rot([(15, 3), (17, 3), (18, 6), (18, 6 + len_ - 4), (14, 6 + len_ - 4), (14, 6)], a), R['l'])
    g.poly(rot([(16, 4), (18, 6), (18, len_ + 2), (16, len_ + 2)], a), R['b'])
    g.poly(rot([(10, len_ + 2), (22, len_ + 2), (22, len_ + 4), (10, len_ + 4)], a), (200, 160, 60))
    g.poly(rot([(15, len_ + 4), (17, len_ + 4), (17, 30), (15, 30)], a), (90, 60, 40))
def m_dagger(g, R, a=-0.785): m_sword(g, R, a, 14)
def m_axe(g, R, a=-0.5):
    g.poly(rot([(15, 6), (17, 6), (17, 30), (15, 30)], a), (110, 74, 44))
    g.poly(rot([(17, 5), (27, 2), (29, 10), (27, 18), (17, 14)], a), R['b']); g.poly(rot([(27, 2), (29, 10), (27, 18), (26, 10)], a), R['l'])
def m_shield(g, R):
    g.poly([(7, 5), (25, 5), (25, 16), (16, 28), (7, 16)], R['d']); g.poly([(9, 7), (23, 7), (23, 15), (16, 25), (9, 15)], R['b'])
    g.poly([(9, 7), (16, 7), (16, 25), (9, 15)], R['l']); g.rect(15, 9, 17, 21, R['d']); g.rect(11, 12, 21, 14, R['d'])
def m_flask(g, R, x=16, y=17, s=1.0):
    g.rect(x - 2 * s, y - 12 * s, x + 2 * s, y - 6 * s, (200, 210, 220)); g.rect(x - 3 * s, y - 13 * s, x + 3 * s, y - 12 * s, (150, 110, 80))
    g.ell(x - 8 * s, y - 7 * s, x + 8 * s, y + 9 * s, (200, 220, 230)); g.ell(x - 7 * s, y - 3 * s, x + 7 * s, y + 8 * s, R['b']); g.ell(x - 5 * s, y - 2 * s, x - 1 * s, y + 2 * s, R['l'])
def m_flasks3(g, R): m_flask(g, R, 9, 21, 0.6); m_flask(g, R, 23, 21, 0.6); m_flask(g, R, 16, 15, 0.7)
def m_bomb(g, R):
    g.ell(6, 10, 26, 30, (40, 36, 48)); g.ell(9, 13, 15, 19, (110, 100, 130)); g.rect(15, 6, 17, 10, (140, 120, 90))
    g.line([(17, 6), (21, 2)], (255, 220, 120)); g.ell(19, 0, 25, 6, R['l']); g.px(22, 3, (255, 255, 255))
def m_bolt(g, R, s=1.0, x=0, y=0):
    P = [(18, 2), (8, 17), (15, 17), (11, 30), (25, 12), (17, 12), (22, 2)]
    g.poly([(x + 16 + (px - 16) * s, y + 16 + (py - 16) * s) for px, py in P], R['l'])
    g.poly([(x + 16 + (px - 16) * s, y + 16 + (py - 16) * s) for px, py in [(18, 2), (12, 13), (17, 12), (22, 2)]], (255, 255, 230))
def m_flame(g, R, s=1.0, x=0, y=0):
    T = lambda P: [(x + 16 + (px - 16) * s, y + 16 + (py - 16) * s) for px, py in P]
    g.poly(T([(16, 2), (24, 14), (25, 22), (20, 29), (12, 29), (7, 22), (9, 13), (12, 17)]), R['d'])
    g.poly(T([(16, 6), (22, 16), (22, 23), (18, 28), (13, 28), (10, 22), (12, 15), (14, 19)]), R['b'])
    g.poly(T([(16, 13), (19, 20), (18, 26), (14, 26), (13, 21)]), R['l'])
def m_snow(g, R):
    for a in range(6):
        t = a * math.pi / 3; ex, ey = 16 + math.cos(t) * 13, 16 + math.sin(t) * 13; g.line([(16, 16), (ex, ey)], R['l'], 2)
        for k in (0.55, 0.8): bx, by = 16 + math.cos(t) * 13 * k, 16 + math.sin(t) * 13 * k; g.line([(bx, by), (bx + math.cos(t + 0.9) * 3, by + math.sin(t + 0.9) * 3)], R['b']); g.line([(bx, by), (bx + math.cos(t - 0.9) * 3, by + math.sin(t - 0.9) * 3)], R['b'])
    g.ell(13, 13, 19, 19, (255, 255, 255))
def m_shard(g, R, n=3):
    for k in range(n):
        a = -0.5 + k * 0.5; g.poly(rot([(16, 3), (20, 14), (16, 26), (12, 14)], a, 16, 22), R['b' if k % 2 else 'l'])
def m_skull(g, R):
    g.ell(7, 4, 25, 22, R['l']); g.rect(10, 18, 22, 26, R['l']); g.ell(10, 10, 15, 16, (20, 10, 20)); g.ell(17, 10, 22, 16, (20, 10, 20))
    g.poly([(16, 16), (14, 20), (18, 20)], (20, 10, 20));
    for x in (12, 15, 18): g.rect(x, 23, x + 1, 26, (20, 10, 20))
def m_mush(g, R, x=16, y=16, s=1.0):
    g.rect(x - 3 * s, y - 2 * s, x + 3 * s, y + 12 * s, (230, 220, 200)); g.ell(x - 12 * s, y - 12 * s, x + 12 * s, y + 4 * s, R['b'])
    g.ell(x - 12 * s, y - 12 * s, x + 4 * s, y - 2 * s, R['l']); g.ell(x - 6 * s, y - 9 * s, x - 2 * s, y - 5 * s, (255, 250, 230)); g.ell(x + 3 * s, y - 7 * s, x + 6 * s, y - 4 * s, (255, 250, 230))
def m_spore(g, R, x=16, y=16, r=7):
    g.ell(x - r, y - r, x + r, y + r, R['b']); g.ell(x - r + 1, y - r + 1, x, y, R['l'])
    for k in range(8): a = k * math.pi / 4; g.px(x + math.cos(a) * (r + 2), y + math.sin(a) * (r + 2), R['l'])
def m_spores(g, R): m_spore(g, R, 10, 12, 5); m_spore(g, R, 22, 10, 4); m_spore(g, R, 17, 23, 6)
def m_web(g, R):
    for k in range(8): a = k * math.pi / 4; g.line([(16, 16), (16 + math.cos(a) * 15, 16 + math.sin(a) * 15)], R['l'])
    for r in (5, 9, 13): g.d.polygon([(16 + math.cos(k * math.pi / 4) * r, 16 + math.sin(k * math.pi / 4) * r) for k in range(8)], outline=R['b'] + (255,))
def m_eye(g, R):
    g.poly([(3, 16), (10, 9), (22, 9), (29, 16), (22, 23), (10, 23)], (240, 235, 220)); g.ell(10, 10, 22, 22, R['b']); g.ell(13, 13, 19, 19, (20, 10, 20)); g.px(14, 14, (255, 255, 255))
def m_heart(g, R): g.ell(5, 6, 17, 18, R['b']); g.ell(15, 6, 27, 18, R['b']); g.poly([(5, 13), (27, 13), (16, 28)], R['b']); g.ell(8, 8, 12, 12, R['l'])
def m_drop(g, R, x=16, y=16, s=1.0): g.poly([(x, y - 13 * s), (x + 8 * s, y + 2 * s), (x - 8 * s, y + 2 * s)], R['b']); g.ell(x - 8 * s, y - 5 * s, x + 8 * s, y + 11 * s, R['b']); g.ell(x - 5 * s, y - 1 * s, x - 1 * s, y + 3 * s, R['l'])
def m_helix(g, R):
    for y in range(2, 31):
        t = y / 30 * math.pi * 3; a, b = 16 + math.sin(t) * 9, 16 - math.sin(t) * 9
        g.rect(a - 1, y, a + 1, y, R['l']); g.rect(b - 1, y, b + 1, y, R['b'])
        if y % 4 == 0: g.line([(a, y), (b, y)], R['d'])
def m_burst(g, R, n=12, r0=5, r1=15):
    pts = []
    for k in range(n * 2): a = k * math.pi / n; r = r1 if k % 2 == 0 else r0; pts.append((16 + math.cos(a) * r, 16 + math.sin(a) * r))
    g.poly(pts, R['b']); g.ell(11, 11, 21, 21, R['l']); g.ell(14, 14, 18, 18, (255, 255, 240))
def m_ring(g, R):
    g.d.ellipse([2, 2, 29, 29], outline=R['l'] + (255,), width=3); g.d.ellipse([7, 7, 24, 24], outline=R['b'] + (255,), width=2)
def m_meteor(g, R):
    for k in range(4): g.line([(4 + k * 3, 2), (18 + k * 2, 18)], R['d' if k % 2 else 'b'], 2)
    g.ell(14, 14, 28, 28, R['b']); g.ell(16, 16, 22, 22, R['l'])
def m_whirl(g, R):
    for k in range(70):
        t = k / 70 * math.pi * 4; r = 2 + k / 70 * 13; g.rect(16 + math.cos(t) * r, 16 + math.sin(t) * r, 16 + math.cos(t) * r + 1, 16 + math.sin(t) * r + 1, R['l'] if k % 7 < 4 else R['b'])
def m_wave(g, R):
    for row, c in ((10, 'l'), (17, 'b'), (24, 'd')):
        g.line([(x, row + math.sin(x / 32 * math.pi * 3) * 3) for x in range(2, 31)], R[c], 3)
def m_shout(g, R):
    g.ell(3, 9, 15, 23, R['b']); g.ell(7, 13, 12, 19, (30, 10, 10))
    for k, r in enumerate((6, 10, 14)): g.d.arc([14 - r, 16 - r, 14 + r, 16 + r], -45, 45, fill=R['l'] + (255,), width=2)
def m_scroll(g, R):
    g.rect(7, 6, 25, 26, (230, 210, 160)); g.ell(4, 3, 10, 9, (200, 170, 120)); g.ell(22, 23, 28, 29, (200, 170, 120))
    for y in (10, 14, 18, 22): g.line([(10, y), (22, y)], R['d'])
    g.ell(18, 18, 24, 24, R['b'])
def m_fist(g, R):
    g.rect(8, 10, 24, 24, R['b']); g.rect(8, 10, 24, 12, R['l'])
    for x in (8, 12, 16, 20): g.line([(x, 10), (x, 17)], R['d'])
    g.rect(10, 24, 22, 30, R['d'])
def m_golem(g, R):
    g.rect(9, 5, 23, 14, R['b']); g.rect(6, 13, 26, 25, R['b']); g.rect(6, 13, 26, 15, R['l']); g.rect(8, 25, 13, 30, R['d']); g.rect(19, 25, 24, 30, R['d'])
    g.rect(12, 8, 14, 10, (255, 230, 120)); g.rect(18, 8, 20, 10, (255, 230, 120))
def m_tree(g, R):
    g.rect(14, 16, 18, 30, (110, 70, 40)); g.ell(4, 2, 28, 20, R['b']); g.ell(6, 3, 18, 13, R['l'])
    for x in (10, 22): g.line([(16, 20), (x, 14)], (110, 70, 40), 2)
def m_person(g, R, x=16):
    g.ell(x - 4, 3, x + 4, 11, R['l']); g.poly([(x - 7, 12), (x + 7, 12), (x + 5, 24), (x - 5, 24)], R['b']); g.rect(x - 5, 24, x - 2, 30, R['d']); g.rect(x + 2, 24, x + 5, 30, R['d'])
def m_clone(g, R): m_person(g, dict(b=R['d'], l=R['b'], d=R['d']), 11); m_person(g, R, 20)
def m_dash(g, R):
    for k, y in enumerate((9, 15, 21)): g.line([(3 + k * 2, y), (16 + k * 2, y)], R['d' if k == 1 else 'b'], 2)
    g.poly([(18, 6), (29, 16), (18, 26), (21, 16)], R['l'])
def m_hole(g, R): g.ell(3, 14, 29, 28, R['d']); g.ell(7, 17, 25, 26, (8, 4, 10)); m_spore(g, R, 16, 9, 4)
def m_chain(g, R):
    for k in range(4): x = 4 + k * 7; y = 6 + k * 6; g.d.ellipse([x, y, x + 9, y + 7], outline=R['l' if k % 2 else 'b'] + (255,), width=2)
def m_target(g, R):
    g.d.ellipse([3, 3, 29, 29], outline=R['b'] + (255,), width=2); g.d.ellipse([9, 9, 23, 23], outline=R['l'] + (255,), width=2)
    g.line([(16, 1), (16, 31)], R['l']); g.line([(1, 16), (31, 16)], R['l']); g.ell(14, 14, 18, 18, (255, 60, 60))
def m_down(g, R): g.poly([(10, 4), (22, 4), (22, 16), (28, 16), (16, 29), (4, 16), (10, 16)], R['b']); g.poly([(10, 4), (15, 4), (15, 16), (10, 16)], R['l'])
def m_coil(g, R):
    g.rect(13, 4, 19, 28, (120, 130, 150)); 
    for y in range(6, 26, 4): g.ell(8, y, 24, y + 3, (200, 150, 60))
    g.ell(11, 0, 21, 8, R['l'])
def m_vent(g, R):
    g.ell(5, 22, 27, 30, (90, 90, 70)); g.ell(9, 23, 23, 28, (30, 40, 10))
    for k, (x, y, r) in enumerate(((14, 17, 4), (19, 10, 5), (12, 5, 4))): g.ell(x - r, y - r, x + r, y + r, R['b' if k % 2 else 'l'])
def m_gear(g, R):
    for k in range(8): a = k * math.pi / 4; g.poly(rot([(14, 1), (18, 1), (18, 7), (14, 7)], a), R['b'])
    g.ell(5, 5, 27, 27, R['b']); g.ell(11, 11, 21, 21, (20, 14, 22)); g.ell(7, 7, 16, 16, R['l']); g.ell(11, 11, 21, 21, (20, 14, 22))
def m_orbit(g, R):
    g.d.ellipse([3, 3, 29, 29], outline=R['d'] + (255,), width=1)
    for k in range(3):
        a = k * math.pi * 2 / 3; x, y = 16 + math.cos(a) * 11, 16 + math.sin(a) * 11; g.poly(rot([(x - 1, y - 6), (x + 2, y - 6), (x + 1, y + 6), (x - 2, y + 6)], a + 1.2, x, y), R['l'])
    g.ell(13, 13, 19, 19, R['b'])
def m_syringe(g, R):
    g.poly(rot([(13, 6), (19, 6), (19, 22), (13, 22)], 0.785), (220, 230, 240)); g.poly(rot([(14, 10), (18, 10), (18, 21), (14, 21)], 0.785), R['b'])
    g.poly(rot([(15, 22), (17, 22), (16.5, 31), (15.5, 31)], 0.785), (200, 200, 210)); g.poly(rot([(11, 3), (21, 3), (21, 6), (11, 6)], 0.785), (150, 150, 160))
def m_arrow(g, R, a=-0.785):
    g.poly(rot([(15, 6), (17, 6), (17, 29), (15, 29)], a), (150, 110, 70)); g.poly(rot([(16, 1), (21, 9), (11, 9)], a), R['l'])
    g.poly(rot([(13, 25), (19, 25), (21, 30), (11, 30)], a), R['b'])
def m_bow(g, R): g.d.arc([2, 2, 30, 30], 120, 300, fill=(150, 100, 60, 255), width=3); g.line([(9, 4), (23, 28)], (230, 230, 210)); m_arrow(g, R, -1.05)
def m_spear(g, R, a=-0.785):
    g.poly(rot([(15, 8), (17, 8), (17, 31), (15, 31)], a), (130, 90, 50)); g.poly(rot([(16, 0), (20, 10), (16, 14), (12, 10)], a), R['l'])
def m_cloud(g, R, dark=False):
    c = R['d'] if dark else R['l']; g.ell(4, 8, 16, 20, c); g.ell(11, 4, 25, 18, c); g.ell(18, 9, 29, 20, c); g.rect(7, 14, 26, 21, c)
def m_storm(g, R): m_cloud(g, dict(b=(80, 80, 110), l=(150, 150, 190), d=(70, 70, 100))); m_bolt(g, R, 0.55, 0, 7)
def m_wall(g, R):
    for row in range(4):
        for k in range(4): x = 2 + k * 7 + (row % 2) * 3; g.rect(x, 6 + row * 6, x + 5, 10 + row * 6, R['b' if (k + row) % 2 else 'l'])
def m_plus(g, R, x=24, y=8): g.rect(x - 1, y - 5, x + 1, y + 5, (255, 255, 255)); g.rect(x - 5, y - 1, x + 5, y + 1, (255, 255, 255))
def m_up(g, R, x=24, y=8): g.poly([(x, y - 6), (x + 5, y), (x + 2, y), (x + 2, y + 6), (x - 2, y + 6), (x - 2, y), (x - 5, y)], (255, 255, 255))
def m_speed(g, R):
    for y in (6, 12, 18, 24): g.line([(2, y), (9, y)], (255, 255, 255))
def m_sparks(g, R):
    for x, y in ((5, 5), (27, 6), (4, 26), (26, 27), (16, 2)): g.px(x, y, (255, 255, 230)); g.px(x + 1, y, R['l']); g.px(x, y + 1, R['l'])
def m_twin(g, R): m_sword(g, R, -0.6, 18); m_sword(g, dict(b=R['d'], l=R['b'], d=R['d']), 0.6, 18)
def m_hand(g, R):
    g.rect(9, 12, 23, 28, R['b']);
    for k, x in enumerate((9, 13, 17, 21)): g.rect(x, 4 + (k % 2) * 2, x + 2, 13, R['b'])
    g.rect(23, 14, 27, 20, R['b']); g.ell(12, 16, 20, 24, R['l'])
def m_mouth(g, R):
    g.ell(3, 6, 29, 28, R['d']); g.ell(7, 12, 25, 24, (30, 6, 10))
    for x in range(8, 25, 4): g.poly([(x, 12), (x + 3, 12), (x + 1.5, 17)], (240, 235, 220)); g.poly([(x, 24), (x + 3, 24), (x + 1.5, 19)], (240, 235, 220))
def m_cross(g, R): g.rect(13, 3, 19, 29, R['b']); g.rect(5, 10, 27, 16, R['b']); g.rect(13, 3, 15, 29, R['l'])
def m_atp(g, R):
    for k, (x, y) in enumerate(((10, 10), (22, 10), (16, 21))): g.ell(x - 6, y - 6, x + 6, y + 6, R['b' if k else 'l']); g.ell(x - 2, y - 2, x + 2, y + 2, (255, 255, 230))
    g.line([(10, 10), (22, 10), (16, 21), (10, 10)], R['d'])

MOT = {k[2:]: v for k, v in globals().items() if k.startswith('m_')}
# 원소·계열 색
EL = dict(phys='#c8b89a', fire='#ff7a2a', cold='#6ad0ff', ltng='#ffe24a', pois='#7ae04a', mag='#c78aff', holy='#ffe9a0', blood='#e8384a', gold='#e8b84a', steel='#b8c4d8', wood='#a87a4a', mush='#d8783a', spore='#c8a8ff', green='#5ae07a', teal='#4ad8c8', pink='#ff7ab8', dna='#ff9ad8', dark='#7a5aa8', white='#e8f0ff')
BG = dict(macro='#3a2a12', tcell='#13301a', plasma='#141e3a', dend='#2a1638', none='#2a2030')
# 스킬별 그림: (배경 계열, [(문양, 색), ...])
R_ = {
 'attack': ('none', [('sword', 'steel')]),
 # 수호자
 'm_p_strike': ('macro', [('hammer', 'steel'), ('sparks', 'gold')]), 'm_p_cleave': ('macro', [('wave', 'gold'), ('axe', 'steel')]), 'm_p_ember': ('macro', [('flame', 'fire'), ('hammer', 'gold')]),
 'm_bash': ('macro', [('hammer', 'gold')]), 'm_devour': ('macro', [('hammer', 'green'), ('heart', 'blood')]), 'm_whirl': ('macro', [('whirl', 'gold'), ('hammer', 'steel')]),
 'm_leap': ('macro', [('down', 'steel'), ('sparks', 'gold')]), 'm_engulf': ('macro', [('burst', 'blood'), ('helix', 'dna')]), 'm_red': ('macro', [('shield', 'dna'), ('plus', 'white')]),
 'm_howl': ('macro', [('shout', 'fire')]), 'm_fever': ('macro', [('flame', 'fire'), ('ring', 'fire')]), 'm_orders': ('macro', [('scroll', 'gold'), ('plus', 'gold')]),
 'm_burst': ('macro', [('burst', 'gold'), ('sparks', 'white')]), 'm_resist': ('macro', [('ring', 'teal'), ('shield', 'teal')]), 'm_mastery': ('macro', [('hammer', 'steel'), ('up', 'gold')]),
 'm_acid': ('macro', [('flask', 'green'), ('plus', 'green')]), 'm_iron': ('macro', [('shield', 'steel'), ('wall', 'steel')]), 'm_rupture': ('macro', [('burst', 'pois'), ('skull', 'pois')]),
 'm_charge': ('macro', [('dash', 'gold'), ('shield', 'steel')]),
 # 연금술사
 't_p_vial': ('tcell', [('flask', 'pois')]), 't_p_shard': ('tcell', [('shard', 'cold')]), 't_p_spark': ('tcell', [('flame', 'fire'), ('sparks', 'gold')]),
 't_multi': ('tcell', [('flasks3', 'green')]), 't_guided': ('tcell', [('target', 'green'), ('flask', 'teal')]), 't_explode': ('tcell', [('bomb', 'fire')]),
 't_freeze': ('tcell', [('flask', 'cold'), ('snow', 'cold')]), 't_strafe': ('tcell', [('flasks3', 'pois'), ('speed', 'white')]), 't_ftrap': ('tcell', [('gear', 'fire'), ('flame', 'fire')]),
 't_ptrap': ('tcell', [('vent', 'pois')]), 't_ltrap': ('tcell', [('coil', 'ltng')]), 't_blade': ('tcell', [('orbit', 'teal')]), 't_dtrap': ('tcell', [('gear', 'steel'), ('sparks', 'fire')]),
 't_speed': ('tcell', [('syringe', 'blood'), ('speed', 'white')]), 't_dodge': ('tcell', [('person', 'green'), ('dash', 'teal')]), 't_clone': ('tcell', [('clone', 'teal')]),
 't_crit': ('tcell', [('target', 'blood'), ('flask', 'gold')]), 't_step': ('tcell', [('cloud', 'white'), ('speed', 'white')]), 't_vault': ('tcell', [('person', 'teal'), ('up', 'white')]),
 # 신경검객
 'p_p_jab': ('plasma', [('dagger', 'ltng'), ('sparks', 'ltng')]), 'p_p_arc': ('plasma', [('wave', 'ltng'), ('dagger', 'steel')]), 'p_p_pulse': ('plasma', [('ring', 'ltng'), ('bolt', 'ltng')]),
 'p_fbolt': ('plasma', [('sword', 'ltng'), ('bolt', 'white')]), 'p_fball': ('plasma', [('wave', 'cold')]), 'p_wall': ('plasma', [('ring', 'ltng'), ('sparks', 'white')]),
 'p_mast': ('plasma', [('bolt', 'cold'), ('up', 'white')]), 'p_meteor': ('plasma', [('meteor', 'ltng')]), 'p_ibolt': ('plasma', [('twin', 'steel')]),
 'p_nova': ('plasma', [('whirl', 'cold'), ('sword', 'steel')]), 'p_armor': ('plasma', [('eye', 'ltng')]), 'p_blizz': ('plasma', [('dash', 'cold'), ('sword', 'white')]),
 'p_cmast': ('plasma', [('sword', 'gold'), ('up', 'gold')]), 'p_cbolt': ('plasma', [('spore', 'ltng'), ('sparks', 'white')]), 'p_static': ('plasma', [('web', 'ltng')]),
 'p_chain': ('plasma', [('chain', 'ltng')]), 'p_tele': ('plasma', [('person', 'cold'), ('sparks', 'cold')]), 'p_storm': ('plasma', [('storm', 'cold')]), 'p_blink': ('plasma', [('bolt', 'ltng'), ('speed', 'white')]),
 # 균사술사
 'd_p_spore': ('dend', [('arrow', 'spore'), ('spore', 'mag')]), 'd_p_frost': ('dend', [('snow', 'cold')]), 'd_p_leech': ('dend', [('drop', 'pois'), ('plus', 'blood')]),
 'd_lacto': ('dend', [('mush', 'mush')]), 'd_mast': ('dend', [('mush', 'spore'), ('up', 'white')]), 'd_phage': ('dend', [('bow', 'mush')]), 'd_golem': ('dend', [('golem', 'wood')]),
 'd_nk': ('dend', [('tree', 'green')]), 'd_mark': ('dend', [('target', 'spore')]), 'd_slow': ('dend', [('web', 'white')]), 'd_tap': ('dend', [('drop', 'blood'), ('hand', 'dark')]),
 'd_terror': ('dend', [('spores', 'pink'), ('eye', 'pink')]), 'd_lower': ('dend', [('down', 'dark')]), 'd_teeth': ('dend', [('spores', 'wood')]),
 'd_armor': ('dend', [('web', 'spore'), ('shield', 'spore')]), 'd_spear': ('dend', [('spear', 'spore')]), 'd_explode': ('dend', [('skull', 'white'), ('burst', 'mush')]),
 'd_pnova': ('dend', [('cloud', 'pois')]), 'd_burrow': ('dend', [('hole', 'spore')]),
}
def background(cls, seed):
    base = hx(BG[cls]); im = Image.new('RGBA', (N, N)); 
    for y in range(N):
        for x in range(N):
            r = math.hypot(x - 13, y - 12) / 22; c = mix(mix(base, (255, 255, 255), 0.18), (6, 4, 8), min(1, r)); 
            if ((x + y + seed) % 7 == 0) and r > 0.5: c = mix(c, (0, 0, 0), 0.3)
            im.putpixel((x, y), c + (255,))
    return im
def outline(layer):
    a = layer.split()[3]; o = Image.new('RGBA', (N, N), (0, 0, 0, 0)); ap = a.load(); op = o.load()
    for y in range(N):
        for x in range(N):
            if ap[x, y]: continue
            if any(0 <= x + dx < N and 0 <= y + dy < N and ap[x + dx, y + dy] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))): op[x, y] = (14, 8, 12, 255)
    return o
def frame(im, cls):
    c = mix(hx(BG[cls]), (255, 230, 170), 0.55); d = ImageDraw.Draw(im)
    d.rectangle([0, 0, N - 1, N - 1], outline=(10, 6, 8, 255)); d.line([(1, 1), (N - 2, 1)], fill=c + (255,)); d.line([(1, 1), (1, N - 2)], fill=c + (255,))
    d.line([(1, N - 2), (N - 2, N - 2)], fill=mix(c, (0, 0, 0), 0.6) + (255,)); d.line([(N - 2, 1), (N - 2, N - 2)], fill=mix(c, (0, 0, 0), 0.6) + (255,))
def build(ids):
    cols = 10; rows = (len(ids) + cols - 1) // cols; sheet = Image.new('RGBA', (cols * N, rows * N), (0, 0, 0, 0)); idx = {}
    for i, sid in enumerate(ids):
        cls, mots = R_[sid]; im = background(cls, i)
        for name, col in mots:
            g = L(); MOT[name](g, ramp(EL[col])); im.alpha_composite(outline(g.im)); im.alpha_composite(g.im)
        frame(im, cls); sheet.alpha_composite(im, ((i % cols) * N, (i // cols) * N)); idx[sid] = i
    return sheet, idx, cols
if __name__ == '__main__':
    ids = list(R_.keys()); sheet, idx, cols = build(ids)
    sheet.save(sys.argv[1], 'WEBP', lossless=True); json.dump({'cols': cols, 'n': N, 'ix': idx}, open(sys.argv[2], 'w'), separators=(',', ':'))
    print(len(ids), sheet.size)
