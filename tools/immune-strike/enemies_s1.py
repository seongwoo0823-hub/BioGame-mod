# 면역 특공대 1스테이지 세균 10종 — 의인화한 2~3등신 도트 (주인공 원화와 같은 화풍)
#   오른쪽을 봄, 한 칸 32×32, 발끝 y=30
#   칸: 0 서기 / 1 걷기 / 2 공격
#   python3 enemies_s1.py  →  games/immune-strike/enemies-s1.png, art/enemies-s1-preview.png
import math, os
import numpy as np
from pixel import Sprite, sheet, preview, OUTLINE

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '../../games/immune-strike')
C = 32
GY = 30
MOUTH = '#4a1830'


# ---------------- 공통 몸 부품 ----------------
def legs(sp, cx, f, col, gap=5, top=26):
    """뭉툭한 다리 두 개: 0 서기, 1 걷기(앞뒤), 2 공격(앞으로 디딤)"""
    off = [(0, 0), (-2, 2), (-2, 3)][f]
    for i, dx in enumerate((-gap // 2 - 1, gap // 2)):
        sx = cx + dx + off[i]
        m = sp.m_capsule(sx, top, sx, GY - 1, 1.6)
        sp.outline(m); sp.shade(m, col, outline=False)
        foot = sp.m_capsule(sx, GY - 1, sx + 2, GY - 1, 1.1)
        sp.outline(foot); sp.fill(foot, '#2e2440')


def arm(sp, x0, y0, x1, y1, col, hand=None):
    m = sp.m_capsule(x0, y0, x1, y1, 1.3)
    sp.outline(m); sp.shade(m, col, outline=False)
    h = sp.m_ellipse(x1 + .5, y1 + .5, 1.7, 1.7)
    sp.outline(h); sp.shade(h, hand or col, outline=False)


def face(sp, x, y, mood='mad', mouth='line', look=1, gap=4):
    """눈 두 개(3×4) + 눈썹 + 입. x,y = 왼쪽 눈 왼쪽 위"""
    sp.eye(x, y, 4, 3, look); sp.eye(x + gap, y, 4, 3, look)
    if mood == 'mad':
        sp.dot(x, y - 2, OUTLINE); sp.dot(x + 1, y - 2, OUTLINE); sp.dot(x + 2, y - 1, OUTLINE)
        sp.dot(x + gap, y - 1, OUTLINE); sp.dot(x + gap + 1, y - 2, OUTLINE); sp.dot(x + gap + 2, y - 2, OUTLINE)
    elif mood == 'smug':
        for i in range(3): sp.dot(x + i, y - 1, OUTLINE); sp.dot(x + gap + i, y - 1, OUTLINE)
    mx = x + gap // 2 + 1; my = y + 6
    if mouth == 'open':
        sp.fill(sp.m_ellipse(mx + .5, my + .5, 1.8, 1.5), MOUTH); sp.dot(mx, my, '#ff8aa0')
    elif mouth == 'grin':
        sp.line([(mx - 2, my), (mx + 2, my)], MOUTH); sp.dot(mx - 1, my + 1, '#ffffff'); sp.dot(mx + 1, my + 1, '#ffffff')
    elif mouth == 'fang':
        sp.line([(mx - 2, my), (mx + 2, my)], MOUTH); sp.dot(mx + 1, my + 1, '#ffffff')
    else:
        sp.line([(mx - 1, my), (mx + 1, my)], MOUTH)


def rod_body(sp, col, cx=15, top=10, bot=25, r=7, dy=0):
    m = sp.m_capsule(cx, top + r + dy, cx, bot - r + dy, r)
    sp.shade(m, col)
    return m


# ---------------- 무기·소품 ----------------
def club(sp, x, y, ang, col='#a0703a'):
    x1, y1 = x + math.cos(ang) * 9, y + math.sin(ang) * 9
    m = sp.m_capsule(x, y, x1, y1, 1.2); sp.outline(m); sp.fill(m, '#6a4628')
    h = sp.m_capsule(x + math.cos(ang) * 5, y + math.sin(ang) * 5, x1, y1, 2.4); sp.shade(h, col)


def spear(sp, x, y, ang, col='#c0c8d8'):
    x1, y1 = x + math.cos(ang) * 13, y + math.sin(ang) * 13
    m = sp.m_capsule(x - math.cos(ang) * 3, y - math.sin(ang) * 3, x1, y1, .9); sp.outline(m); sp.fill(m, '#7a5030')
    tip = [(x1 + math.cos(ang) * 4, y1 + math.sin(ang) * 4), (x1 + math.cos(ang + 1.9) * 2.2, y1 + math.sin(ang + 1.9) * 2.2),
           (x1 + math.cos(ang - 1.9) * 2.2, y1 + math.sin(ang - 1.9) * 2.2)]
    sp.shade(sp.m_poly(tip), col)


def blaster(sp, x, y, col='#5a6a80', glow='#7af0d8'):
    m = sp.m_capsule(x, y, x + 6, y, 1.6); sp.shade(m, col)
    g = sp.m_capsule(x + 1, y + 1, x + 1, y + 3, 1); sp.outline(g); sp.fill(g, '#3a4458')
    sp.dot(x + 7, y, glow)


def flask(sp, x, y, liquid='#90e050'):
    sp.shade(sp.m_ellipse(x, y + 1, 2.8, 2.6), liquid)
    neck = sp.m_capsule(x, y - 3, x, y - 1, .8); sp.outline(neck); sp.fill(neck, '#d8e8f0')
    sp.dot(x - 1, y, '#f0ffe0')


def bomb(sp, x, y, lit=False):
    sp.shade(sp.m_ellipse(x, y, 3.2, 3.2), '#3a3448')
    sp.dot(x - 1, y - 1, '#8a84a0')
    sp.line([(x + 1, y - 3), (x + 2, y - 5)], '#c8a060')
    if lit: sp.dot(x + 3, y - 6, '#ffe060'); sp.dot(x + 2, y - 6, '#ff8030')


def glove(sp, x, y, col='#e04848'):
    sp.shade(sp.m_ellipse(x, y, 2.8, 2.5), col)
    sp.dot(x - 1, y - 1, '#ffb0b0')


def fork(sp, x, y, ang):
    x1, y1 = x + math.cos(ang) * 10, y + math.sin(ang) * 10
    m = sp.m_capsule(x, y, x1, y1, .8); sp.outline(m); sp.fill(m, '#c8d0e0')
    px, py = -math.sin(ang), math.cos(ang)
    for k in (-1.6, 0, 1.6):
        sx, sy = x1 + px * k, y1 + py * k
        t = sp.m_capsule(sx, sy, sx + math.cos(ang) * 3, sy + math.sin(ang) * 3, .5); sp.outline(t); sp.fill(t, '#e8eef8')


# ================= 10종 =================
def ecoli(sp, f):
    """대장균: 초록 막대 몸, 뒤로 휘날리는 편모 머리카락, 몽둥이"""
    b = 1 if f == 1 else 0
    for k in range(3):
        pts = [(9 - t * 1.6, 11 + k * 3 + math.sin(f * 1.5 + k + t) * 1.2 - b) for t in range(5)]
        sp.line(pts, '#3d7a28')
    legs(sp, 15, f, '#6aae45')
    arm(sp, 12, 19 - b, 9, 21 - b, '#7cc055')
    rod_body(sp, '#8fd060', dy=-b)
    face(sp, 13, 13 - b, 'mad', 'open' if f == 2 else 'fang')
    if f == 2: club(sp, 21, 15, -.2)
    else: club(sp, 21, 21 - b, 1.05)
    arm(sp, 18, 20 - b, 21, 21 - b if f != 2 else 15, '#7cc055')


def staph(sp, f):
    """포도상구균: 포도송이 몸의 근육질 권투 선수"""
    b = 1 if f == 1 else 0
    legs(sp, 15, f, '#c8a030')
    for x, y, r in ((10, 13, 4), (11, 21, 4.5), (20, 13, 4), (19, 22, 4.5)):
        sp.shade(sp.m_ellipse(x, y - b, r, r), '#d8b038')
    sp.shade(sp.m_ellipse(15.5, 17 - b, 6.5, 6.5), '#f0cc48')
    face(sp, 13, 14 - b, 'mad', 'grin' if f != 2 else 'open')
    glove(sp, 9, 20 - b)
    if f == 2: arm(sp, 20, 19, 25, 18, '#e8c040', '#e04848'); glove(sp, 26, 18)
    else: glove(sp, 22, 20 - b)


def strep(sp, f):
    """연쇄상구균: 공 사슬이 몸통+모자, 사슬 채찍"""
    b = 1 if f == 1 else 0
    legs(sp, 15, f, '#8a5ac8')
    sp.shade(sp.m_ellipse(15, 20 - b, 6, 6), '#a070e0')
    sp.shade(sp.m_ellipse(14, 11 - b, 4, 4), '#b080f0')
    sp.shade(sp.m_ellipse(11, 6 - b, 2.6, 2.6), '#c090ff')
    face(sp, 13, 17 - b, 'mad', 'fang' if f != 2 else 'open', gap=4)
    if f == 2: pts = [(21, 19), (24, 17), (27, 16), (30, 16)]
    else: pts = [(21, 21 - b), (22, 24 - b), (21, 27 - b)]
    for x, y in pts: sp.shade(sp.m_ellipse(x, y, 1.6, 1.6), '#c8b8e8')
    arm(sp, 19, 20 - b, 21, 21 - b if f != 2 else 19, '#a070e0')


def salmo(sp, f):
    """살모넬라: 편모 모히칸 머리, 포크를 든 식중독 악당"""
    b = 1 if f == 1 else 0
    legs(sp, 15, f, '#c0503a')
    for k in range(5):
        x = 10 + k * 2.4
        sp.line([(x, 11 - b), (x - 1 + math.sin(f + k) * 1.2, 7 - b), (x + .5, 4 - b)], '#b04a30')
    arm(sp, 12, 19 - b, 9, 21 - b, '#e07050')
    rod_body(sp, '#e86a4a', dy=-b)
    face(sp, 13, 14 - b, 'smug', 'grin' if f != 2 else 'open')
    fork(sp, 20, 22 - b if f != 2 else 18, -.9 if f != 2 else -.15)
    arm(sp, 18, 20 - b, 20, 21 - b if f != 2 else 18, '#e07050')


def clos(sp, f):
    """클로스트리디움 포자: 큰 둥근 포자 머리 + 막대 몸, 포자 폭탄"""
    b = 1 if f == 1 else 0
    legs(sp, 15, f, '#8a6838')
    sp.shade(sp.m_capsule(15, 19 - b, 15, 23 - b, 4.5), '#b08850')
    sp.shade(sp.m_ellipse(15.5, 11.5 - b, 7.5, 7), '#d8b878')
    sp.fill(sp.m_ellipse(11, 8 - b, 1.2, 1), '#f2e0b0')
    face(sp, 13, 10 - b, 'mad', 'fang' if f != 2 else 'open')
    arm(sp, 12, 20 - b, 9, 22 - b, '#b08850')
    if f == 2: arm(sp, 18, 19, 22, 15, '#b08850'); bomb(sp, 24, 13, True)
    else: arm(sp, 18, 20 - b, 20, 22 - b, '#b08850'); bomb(sp, 22, 24 - b)


def tb(sp, f):
    """결핵균: 밀랍 갑옷을 두른 덩치, 투구 + 방패"""
    b = 1 if f == 1 else 0
    legs(sp, 15, f, '#9a8a50', gap=7)
    m = sp.m_capsule(15, 15 - b, 15, 20 - b, 9)
    sp.shade(m, '#c8b878')
    for x in (9, 13, 17, 21):
        ys = np.nonzero(m[:, x])[0]
        if len(ys): sp.line([(x, ys.min() + 2), (x, ys.max() - 2)], '#a8985a')
    hm = sp.m_poly([(7, 11 - b), (15, 4 - b), (23, 11 - b), (23, 13 - b), (7, 13 - b)])
    sp.shade(hm, '#8a8aa0')
    sp.dot(15, 5 - b, '#d0d0e0')
    face(sp, 14, 14 - b, 'mad', 'open' if f == 2 else 'line')
    sx = 23 if f != 2 else 25
    sh = sp.m_ellipse(sx, 20 - b, 3.6, 5.5); sp.shade(sh, '#a06040')
    sp.fill(sp.m_ellipse(sx + .3, 20 - b, 1.3, 2.2), '#e0b060')


def helico(sp, f):
    """헬리코박터: 나선 꼬리로 나는 비행사 (고글)"""
    yb = [0, -1, 1][f]
    for i in range(5):
        x = 9 - i * 1.6; y = 22 + math.sin(f * 1.4 + i * 1.3) * 2.4 + yb
        sp.shade(sp.m_ellipse(x, y, 2, 2), '#c8c850')
    for k in range(3):
        a = f * 1.1 + k * 2.1
        sp.line([(4, 22 + yb), (4 + math.cos(a) * 3, 22 + yb + math.sin(a) * 4)], '#8a8a30')
    sp.shade(sp.m_capsule(15, 15 + yb, 15, 21 + yb, 6.5), '#e0e070')
    gm = sp.m_capsule(11, 9 + yb, 20, 9 + yb, 2.2); sp.shade(gm, '#6a5a3a')
    sp.fill(sp.m_ellipse(13, 9.5 + yb, 1.5, 1.5), '#80d0ff'); sp.fill(sp.m_ellipse(18, 9.5 + yb, 1.5, 1.5), '#80d0ff')
    face(sp, 13, 13 + yb, 'smug', 'grin' if f != 2 else 'open')
    arm(sp, 19, 19 + yb, 23, 17 + yb if f == 2 else 21 + yb, '#d0d060')
    if f == 2: blaster(sp, 24, 17 + yb, glow='#ffe060')


def botul(sp, f):
    """보툴리누스균: 방독면을 쓴 독약 박사"""
    b = 1 if f == 1 else 0
    legs(sp, 15, f, '#7a5a38')
    arm(sp, 12, 20 - b, 9, 22 - b, '#a07a50')
    rod_body(sp, '#a07a50', dy=-b)
    mm = sp.m_ellipse(17, 16 - b, 5, 4); sp.shade(mm, '#5a4a5a')
    sp.fill(sp.m_ellipse(15, 15 - b, 1.5, 1.5), '#a0ff70'); sp.fill(sp.m_ellipse(19.5, 15 - b, 1.5, 1.5), '#a0ff70')
    sp.dot(14, 14 - b, '#ffffff')
    fm = sp.m_ellipse(17.5, 19.5 - b, 1.8, 1.5); sp.shade(fm, '#3a3040')
    if f == 2: arm(sp, 18, 21, 22, 16, '#a07a50'); flask(sp, 24, 14)
    else: arm(sp, 18, 21 - b, 21, 23 - b, '#a07a50'); flask(sp, 23, 23 - b)


def bacil(sp, f):
    """바실러스: 두 마디 막대 몸, 머리띠 + 창"""
    b = 1 if f == 1 else 0
    legs(sp, 15, f, '#a85a90')
    sp.shade(sp.m_capsule(15, 20 - b, 15, 23 - b, 5), '#c06aa0')
    sp.shade(sp.m_capsule(15, 11 - b, 15, 14 - b, 6), '#d07ab0')
    band = sp.m_capsule(9, 10 - b, 21, 10 - b, 1.2); sp.fill(band, '#3a70e0')
    sp.line([(8, 10 - b), (5, 12 - b), (4, 11 - b)], '#3a70e0')
    face(sp, 13, 12 - b, 'mad', 'open' if f == 2 else 'line')
    if f == 2: spear(sp, 18, 19, -.05)
    else: spear(sp, 19, 26 - b, -1.35)
    arm(sp, 18, 20 - b, 20, 20 - b if f != 2 else 19, '#d07ab0')


def pseudo(sp, f):
    """녹농균: 끈적한 점액을 흘리는 청록 막대, 점액 물총"""
    b = 1 if f == 1 else 0
    sp.line([(9, 13 - b), (6, 12 - b), (4, 14 - b), (2, 12 - b + f % 2)], '#2a9a80')
    legs(sp, 15, f, '#30a890')
    arm(sp, 12, 20 - b, 9, 22 - b, '#40c8a8')
    rod_body(sp, '#40d0b0', dy=-b)
    for x, y in ((11, 24), (13, 26)):
        sp.fill(sp.m_ellipse(x, y - b + (f == 1), 1, 1.5), '#8af8e0')
    face(sp, 13, 14 - b, 'smug', 'fang' if f != 2 else 'open')
    blaster(sp, 20, 20 - b if f != 2 else 18, '#3a8a80', '#8af8e0')
    arm(sp, 18, 20 - b, 20, 20 - b if f != 2 else 18, '#40c8a8')
    if f == 2:
        for k in range(3): sp.fill(sp.m_ellipse(28 + k * 1.2, 18 + (k % 2), 1, 1), '#8af8e0')


ENEMIES = [('ecoli', ecoli), ('staph', staph), ('strep', strep), ('salmo', salmo), ('clos', clos),
           ('tb', tb), ('helico', helico), ('botul', botul), ('bacil', bacil), ('pseudo', pseudo)]


def build():
    rows = []
    for name, fn in ENEMIES:
        row = []
        for f in range(3):
            sp = Sprite(C, C); fn(sp, f); row.append(sp.image())
        rows.append(row)
    img = sheet(rows, (C, C))
    os.makedirs(OUT, exist_ok=True)
    img.save(os.path.join(OUT, 'enemies-s1.png'))
    half = (len(rows) + 1) // 2
    blank = Sprite(C, C).image()
    two = sheet([rows[i] + [blank] + (rows[i + half] if i + half < len(rows) else []) for i in range(half)], (C, C))
    preview(two, os.path.join(HERE, 'art/enemies-s1-preview.png'), 5)
    return img


if __name__ == '__main__':
    build(); print('enemies-s1.png', len(ENEMIES), 'x 3')
