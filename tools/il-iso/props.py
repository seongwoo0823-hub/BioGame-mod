# 감염의 군주: 레퍼런스풍(쿼터뷰 도트) 장식 소품 — 장마다 deco8_c*.webp 를 같은 칸 배치로 다시 그림
#   절벽 옆 소품 12종(64) · 불꽃 4프레임(56) · 화로 6프레임(64) · 큰 기둥/나무(112) · 바닥 무늬 12종(64, 평면)
#   python3 props.py  → games/il-assets/px/deco8_c1~5.webp (칸 위치는 il-assets/meta.js 의 deco8 그대로)
import os, sys, json, math, random
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '../immune-strike'))
from pixel import Sprite, ramp, hexrgb
OUT = os.path.join(HERE, '../../games/il-assets/px')
INK = (34, 26, 30)


def load_meta():
    s = open(os.path.join(HERE, '../../games/il-assets/meta.js'), encoding='utf-8').read()
    i = s.index('"deco8"'); j = s.index('{', i); d = 0
    for k in range(j, len(s)):
        d += s[k] == '{'; d -= s[k] == '}'
        if d == 0: break
    return json.loads(s[j:k + 1])


class P(Sprite):
    """명암·테두리를 그린 뒤 마지막에 바깥 테두리를 한 번에 (부드러운 갈색 잉크)"""
    def done(self):
        a = self.px[..., 3] > 0; e = np.zeros_like(a)
        e[1:] |= a[:-1]; e[:-1] |= a[1:]; e[:, 1:] |= a[:, :-1]; e[:, :-1] |= a[:, 1:]
        e &= ~a; self.px[e, :3] = INK; self.px[e, 3] = 255
        return self.image()

    def sh(self, m, col, **k):   # 칸별 외곽선 없이 명암만 (마지막에 전체 외곽선)
        self.shade(m, col, outline=False, **k)


# ---------------- 소품 그리는 함수들 (c: 칸 크기, 바닥은 아래쪽) ----------------
def rock(s, rng, col='#8a8478', big=1.0):
    c = s.w; gy = c - 4; n = 2 + int(rng.random() * 3)
    for k in range(n):
        rx = c * (.12 + rng.random() * .14) * big; ry = rx * (.55 + rng.random() * .25)
        x = c / 2 + (rng.random() - .5) * c * .4; y = gy - ry
        s.sh(s.m_ellipse(x, y, rx, ry), col)


def stalagmite(s, rng, col='#c8b8a0', n=3):
    c = s.w; gy = c - 3
    for k in range(n):
        h = c * (.4 + rng.random() * .5); w = c * (.08 + rng.random() * .08); x = c / 2 + (k - (n - 1) / 2) * w * 1.2 + (rng.random() - .5) * 4
        s.sh(s.m_poly([(x - w, gy), (x + w, gy), (x + w * .25, gy - h), (x - w * .1, gy - h * 1.02)]), col)
        for t in range(3): s.dot(x - w * .3, gy - h * (.3 + t * .2), ramp(col)[0])


def crystal(s, rng, col='#e8f4ff', n=4):
    c = s.w; gy = c - 4
    for k in range(n):
        h = c * (.35 + rng.random() * .5); w = c * (.06 + rng.random() * .05); x = c / 2 + (rng.random() - .5) * c * .45; lean = (rng.random() - .5) * .5
        tip = (x + lean * h, gy - h)
        s.sh(s.m_poly([(x - w, gy), (x + w, gy), (tip[0] + w * .6, tip[1] + w * 1.5), tip, (tip[0] - w * .6, tip[1] + w * 1.5)]), col, light=(-.9, -.4))
    s.sh(s.m_ellipse(c / 2, gy, c * .28, 3), '#6a645a')


def bush(s, rng, col='#5a8a3a', flowers=None):
    c = s.w; gy = c - 4
    for k in range(5):
        x = c / 2 + (rng.random() - .5) * c * .45; y = gy - c * (.16 + rng.random() * .18); r = c * (.12 + rng.random() * .1)
        s.sh(s.m_ellipse(x, y, r, r * .8), col)
    if flowers:
        for _ in range(8): s.dot(c / 2 + (rng.random() - .5) * c * .5, gy - 6 - rng.random() * 18, flowers)


def grass(s, rng, col='#6a8a3a'):
    c = s.w; gy = c - 3
    for k in range(14):
        x = c / 2 + (rng.random() - .5) * c * .6; h = c * (.12 + rng.random() * .22); lean = (rng.random() - .5) * 8
        s.line([(x, gy), (x + lean * .5, gy - h * .5), (x + lean, gy - h)], ramp(col)[int(rng.random() * 3)])


def tree(s, rng, leaf='#e8b830', trunk='#7a5030', big=False):
    c = s.w; gy = c - 3; tw = c * (.07 if big else .08)
    s.sh(s.m_poly([(c / 2 - tw * 1.6, gy), (c / 2 + tw * 1.6, gy), (c / 2 + tw * .7, gy - c * .45), (c / 2 - tw * .7, gy - c * .45)]), trunk)
    for k in range(4):   # 가지
        a = -1.57 + (k - 1.5) * .55; x0, y0 = c / 2, gy - c * .4
        s.line([(x0, y0), (x0 + math.cos(a) * c * .22, y0 + math.sin(a) * c * .2)], ramp(trunk)[3])
    for k in range(22):  # 잎 덩이
        a = rng.random() * 6.28; d = math.sqrt(rng.random()) * c * .36
        x = c / 2 + math.cos(a) * d; y = gy - c * .62 + math.sin(a) * d * .65; r = c * (.06 + rng.random() * .05)
        s.sh(s.m_ellipse(x, y, r, r * .85), leaf)
    for _ in range(14): s.dot(c / 2 + (rng.random() - .5) * c * .8, gy - rng.random() * 4, ramp(leaf)[1])   # 떨어진 잎


def barrel(s, rng, col='#8a5a30'):
    c = s.w; gy = c - 4; w = c * .26; h = c * .55
    m = s.m_capsule(c / 2, gy - h + w * .4, c / 2, gy - w * .4, w)
    m &= s.m_poly([(0, gy - h), (c, gy - h), (c, gy), (0, gy)])
    s.sh(m, col)
    for yy in (gy - h * .2, gy - h * .8): s.line([(c / 2 - w, yy), (c / 2 + w, yy)], '#4a4a52')
    s.sh(s.m_ellipse(c / 2, gy - h, w * .95, w * .35), ramp(col)[1])


def crate(s, rng, col='#a07040'):
    c = s.w; gy = c - 4; w = c * .28; h = c * .46
    s.sh(s.m_poly([(c / 2 - w, gy), (c / 2 + w, gy), (c / 2 + w, gy - h), (c / 2 - w, gy - h)]), col)
    s.sh(s.m_poly([(c / 2 - w, gy - h), (c / 2 + w, gy - h), (c / 2 + w * .6, gy - h - w * .45), (c / 2 - w * 1.3, gy - h - w * .45)]), ramp(col)[1])
    s.line([(c / 2 - w, gy), (c / 2 + w, gy - h)], ramp(col)[3]); s.line([(c / 2 - w, gy - h), (c / 2 + w, gy)], ramp(col)[3])


def fence(s, rng, col='#8a6038'):
    c = s.w; gy = c - 4
    for k in range(4):
        x = c * .15 + k * c * .23; h = c * .3 + (k % 2) * 3
        s.sh(s.m_capsule(x, gy - h, x, gy, 2), col)
    for yy in (gy - c * .22, gy - c * .1): s.sh(s.m_capsule(c * .12, yy + 2, c * .86, yy - 2, 1.4), ramp(col)[1])


def bones(s, rng, col='#e8e0cc', skull=True):
    c = s.w; gy = c - 5
    for k in range(3):
        x = c / 2 + (rng.random() - .5) * c * .45; a = rng.random() * 3.14; L = c * .2
        s.sh(s.m_capsule(x - math.cos(a) * L, gy - math.sin(a) * 2, x + math.cos(a) * L, gy + math.sin(a) * 2, 1.4), col)
    if skull:
        x = c / 2 + 3; y = gy - 9
        s.sh(s.m_ellipse(x, y, 9, 7.5), col); s.sh(s.m_ellipse(x + 1, y + 6, 6, 3.5), col)
        s.fill(s.m_ellipse(x - 3, y, 2, 2.4), (40, 30, 30)); s.fill(s.m_ellipse(x + 3.5, y, 2, 2.4), (40, 30, 30))


def mushroom(s, rng, cap='#c84a4a', glow=False):
    c = s.w; gy = c - 4
    for k in range(3):
        x = c / 2 + (k - 1) * c * .22 + (rng.random() - .5) * 4; h = c * (.18 + rng.random() * .22); r = c * (.11 + rng.random() * .07)
        s.sh(s.m_capsule(x, gy - h, x, gy, 1.6), '#e8dcc0')
        s.sh(s.m_ellipse(x, gy - h, r, r * .6), cap)
        for _ in range(2): s.dot(x + (rng.random() - .5) * r, gy - h - r * .2, '#ffffff' if not glow else '#e0ffff')


def urn(s, rng, col='#a0603a'):
    c = s.w; gy = c - 4
    s.sh(s.m_ellipse(c / 2, gy - c * .24, c * .22, c * .23), col)
    s.sh(s.m_capsule(c / 2, gy - c * .38, c / 2, gy - c * .3, c * .06), ramp(col)[1])
    s.line([(c / 2 - c * .14, gy - c * .2), (c / 2 + c * .14, gy - c * .2)], ramp(col)[3])


def broken_pillar(s, rng, col='#a89a86'):
    c = s.w; gy = c - 3; w = c * .14; h = c * (.45 + rng.random() * .3)
    s.sh(s.m_poly([(c / 2 - w, gy), (c / 2 + w, gy), (c / 2 + w, gy - h + 4), (c / 2 + w * .3, gy - h), (c / 2 - w * .4, gy - h + 6), (c / 2 - w, gy - h + 2)]), col)
    for k in range(3): s.line([(c / 2 - w + 3 + k * w * .6, gy - 2), (c / 2 - w + 3 + k * w * .6, gy - h + 8)], ramp(col)[3])
    s.sh(s.m_poly([(c / 2 - w * 1.3, gy), (c / 2 + w * 1.3, gy), (c / 2 + w * 1.15, gy - 5), (c / 2 - w * 1.15, gy - 5)]), ramp(col)[2])
    rock(s, rng, col, .35)


def boat(s, rng, col='#7a5a3a'):
    c = s.w; gy = c - 6
    s.sh(s.m_poly([(c * .08, gy - c * .12), (c * .92, gy - c * .2), (c * .78, gy), (c * .2, gy + 1)]), col)
    for k in range(5): s.line([(c * .18 + k * c * .14, gy - c * .14 - k), (c * .2 + k * c * .14, gy)], ramp(col)[3])
    s.sh(s.m_capsule(c * .5, gy - c * .5, c * .5, gy - c * .15, 1.6), ramp(col)[1])   # 부러진 돛대


def winch(s, rng, col='#8a6a48'):
    c = s.w; gy = c - 5
    for x in (c * .32, c * .68): s.sh(s.m_capsule(x, gy - c * .3, x, gy, 2.2), col)
    s.sh(s.m_ellipse(c / 2, gy - c * .26, c * .18, c * .1), '#c8b890')
    for k in range(4): s.line([(c * .34, gy - c * .3 + k * 2), (c * .66, gy - c * .3 + k * 2)], '#9a8a68')
    s.line([(c * .68, gy - c * .22), (c * .8, gy - c * .1), (c * .78, gy - c * .02)], '#c8b890')


def lantern(s, rng, col='#5a4a3a', light='#ffd060'):
    c = s.w; gy = c - 3
    s.sh(s.m_capsule(c / 2, gy - c * .7, c / 2, gy, 1.6), col)
    s.sh(s.m_poly([(c / 2 - 6, gy - c * .74), (c / 2 + 6, gy - c * .74), (c / 2 + 4, gy - c * .58), (c / 2 - 4, gy - c * .58)]), light)
    s.sh(s.m_poly([(c / 2 - 8, gy - c * .74), (c / 2 + 8, gy - c * .74), (c / 2, gy - c * .84)]), col)


def web(s, rng, col='#e0e0e8'):
    c = s.w; cx, cy = c / 2, c * .45
    for k in range(8):
        a = k / 8 * 6.28; s.line([(cx, cy), (cx + math.cos(a) * c * .38, cy + math.sin(a) * c * .38)], col)
    for r in (c * .12, c * .24, c * .36):
        pts = [(cx + math.cos(k / 8 * 6.28) * r, cy + math.sin(k / 8 * 6.28) * r) for k in range(9)]
        s.line(pts, col)


def roots(s, rng, col='#6a4a2a'):
    c = s.w; gy = c - 3
    for k in range(5):
        x = c * .2 + rng.random() * c * .6; pts = [(x, gy)]
        for t in range(4): pts.append((pts[-1][0] + (rng.random() - .5) * 8, pts[-1][1] - 5))
        s.line(pts, col)
    rock(s, rng, '#6a645a', .5)


def shells(s, rng):
    c = s.w; gy = c - 4
    for k in range(4):
        x = c / 2 + (rng.random() - .5) * c * .55
        col = rng.choice(['#f0d8c0', '#e8a890', '#f0e8d0'])
        s.sh(s.m_poly([(x - 6, gy), (x + 6, gy), (x, gy - 9)]), col)
    grass(s, rng, '#7a8a4a')


def coral(s, rng, col='#e86a6a'):
    c = s.w; gy = c - 3
    for k in range(4):
        x = c / 2 + (k - 1.5) * 10; pts = [(x, gy)]
        for t in range(5): pts.append((pts[-1][0] + (rng.random() - .5) * 8, pts[-1][1] - 7))
        for (a, b) in zip(pts, pts[1:]): s.sh(s.m_capsule(a[0], a[1], b[0], b[1], 2.6), col)


def stump(s, rng, col='#7a5030'):
    c = s.w; gy = c - 4
    s.sh(s.m_poly([(c * .25, gy), (c * .75, gy), (c * .7, gy - c * .3), (c * .3, gy - c * .3)]), col)
    s.sh(s.m_ellipse(c / 2, gy - c * .3, c * .2, c * .08), '#c8a070')


# ---------------- 큰 기둥 / 나무 (112) ----------------
def big_tree(s, rng, leaf, trunk):
    tree(s, rng, leaf, trunk, big=True)


def column(s, rng, col):
    c = s.w; gy = c - 3; w = c * .12
    s.sh(s.m_poly([(c / 2 - w * 1.5, gy), (c / 2 + w * 1.5, gy), (c / 2 + w * 1.3, gy - 8), (c / 2 - w * 1.3, gy - 8)]), ramp(col)[2])
    s.sh(s.m_poly([(c / 2 - w, gy - 8), (c / 2 + w, gy - 8), (c / 2 + w, gy - c * .78), (c / 2 - w, gy - c * .78)]), col)
    for k in range(4): s.line([(c / 2 - w + 2 + k * w * .55, gy - 10), (c / 2 - w + 2 + k * w * .55, gy - c * .76)], ramp(col)[3])
    s.sh(s.m_poly([(c / 2 - w * 1.5, gy - c * .78), (c / 2 + w * 1.5, gy - c * .78), (c / 2 + w * 1.3, gy - c * .86), (c / 2 - w * 1.3, gy - c * .86)]), ramp(col)[1])


def big_stalag(s, rng, col):
    stalagmite(s, rng, col, n=4)


# ---------------- 불꽃 · 화로 ----------------
def flame(s, f, n, base=None):
    c = s.w; gy = c - 4; ph = f / n * 6.28
    if base: s.sh(s.m_capsule(c / 2, gy - c * .32, c / 2, gy, 2), base)
    for k, (col, sc) in enumerate((('#ff6a1a', 1.0), ('#ffb02a', .7), ('#fff0a0', .4))):
        h = c * .34 * sc * (1 + .12 * math.sin(ph + k)); w = c * .1 * sc
        y0 = gy - c * .3; x = c / 2 + math.sin(ph * 2 + k) * 1.2
        s.fill(s.m_poly([(x - w, y0), (x + w, y0), (x + w * .3, y0 - h * .6), (x + math.sin(ph) * 2, y0 - h), (x - w * .4, y0 - h * .5)]), col)


def brazier(s, f, n, col='#6a5a4a'):
    c = s.w; gy = c - 3
    s.sh(s.m_poly([(c / 2 - 3, gy), (c / 2 + 3, gy), (c / 2 + 2, gy - c * .3), (c / 2 - 2, gy - c * .3)]), col)
    s.sh(s.m_poly([(c / 2 - 10, gy - c * .3), (c / 2 + 10, gy - c * .3), (c / 2 + 6, gy - c * .4), (c / 2 - 6, gy - c * .4)]), ramp(col)[1])
    ph = f / n * 6.28
    for k, (colr, sc) in enumerate((('#ff5a1a', 1.0), ('#ffb02a', .65), ('#fff0b0', .35))):
        h = c * .32 * sc * (1 + .15 * math.sin(ph + k)); w = c * .12 * sc; y0 = gy - c * .4; x = c / 2 + math.sin(ph * 2 + k)
        s.fill(s.m_poly([(x - w, y0), (x + w, y0), (x + w * .2, y0 - h * .6), (x + math.sin(ph) * 2, y0 - h), (x - w * .3, y0 - h * .5)]), colr)


# ---------------- 바닥 무늬 (위에서 본 평면) ----------------
def decal(s, rng, kind, pal):
    c = s.w; cx = cy = c / 2
    if kind == 'leaves':
        for _ in range(26): x, y = cx + (rng.random() - .5) * c * .8, cy + (rng.random() - .5) * c * .8; s.dot(x, y, pal[0]); s.dot(x + 1, y, pal[1])
    elif kind == 'pebbles':
        for _ in range(8): s.sh(s.m_ellipse(cx + (rng.random() - .5) * c * .6, cy + (rng.random() - .5) * c * .6, 2 + rng.random() * 2, 1.5 + rng.random()), pal[0])
    elif kind == 'crack':
        x, y = cx - c * .3, cy
        for _ in range(int(c * .7)): s.dot(x, y, pal[0]); x += 1; y += rng.choice([-1, 0, 0, 1])
    elif kind == 'puddle':
        s.fill(s.m_ellipse(cx, cy, c * .3, c * .2), pal[0]); s.fill(s.m_ellipse(cx - 3, cy - 2, c * .12, c * .05), pal[1])
    elif kind == 'moss':
        for _ in range(140):
            a = rng.random() * 6.28; d = math.sqrt(rng.random()) * c * .32; s.dot(cx + math.cos(a) * d, cy + math.sin(a) * d * .8, pal[int(rng.random() * len(pal))])
    elif kind == 'bones':
        for _ in range(3):
            a = rng.random() * 3.14; L = c * .14; x, y = cx + (rng.random() - .5) * c * .4, cy + (rng.random() - .5) * c * .4
            s.fill(s.m_capsule(x - math.cos(a) * L, y - math.sin(a) * L, x + math.cos(a) * L, y + math.sin(a) * L, 1.3), pal[0])
    elif kind == 'ripple':
        for k in range(4): s.line([(cx - c * .3, cy - 6 + k * 4), (cx, cy - 8 + k * 4), (cx + c * .3, cy - 6 + k * 4)], pal[0])


# ---------------- 장별 구성 ----------------
CH = {
    1: dict(  # 세포 폐허 → 돌길 마을 (은행나무)
        edge=[lambda s, r: tree(s, r, '#e8b830', '#7a5030'), lambda s, r: bush(s, r, '#5a8a3a', '#ffe060'), lambda s, r: barrel(s, r), lambda s, r: fence(s, r),
              lambda s, r: rock(s, r, '#9a9488'), lambda s, r: grass(s, r), lambda s, r: crate(s, r), lambda s, r: stump(s, r),
              lambda s, r: lantern(s, r), lambda s, r: bush(s, r, '#4a7a34', '#ff9ac0'), lambda s, r: tree(s, r, '#f0c840', '#6a4428'), lambda s, r: mushroom(s, r, '#e86a3a')],
        pillar=lambda s, r: big_tree(s, r, '#f0bc28', '#7a5030'),
        decal=[('leaves', ['#f0c030', '#c89a20']), ('leaves', ['#e8b830', '#a07818']), ('pebbles', ['#9a9488']), ('moss', ['#4e6e34', '#5e7e3c']),
               ('crack', ['#3a3628']), ('puddle', ['#6a8aa8', '#a8c8e0'])] * 2,
        base='#5a4a3a'),
    2: dict(  # 미생물 심연 → 모래 해안 (난파선)
        edge=[lambda s, r: rock(s, r, '#8a8a8a'), lambda s, r: grass(s, r, '#7a8a3a'), lambda s, r: boat(s, r), lambda s, r: winch(s, r),
              lambda s, r: shells(s, r), lambda s, r: barrel(s, r, '#7a5a3a'), lambda s, r: crate(s, r, '#9a7048'), lambda s, r: coral(s, r, '#e86a6a'),
              lambda s, r: rock(s, r, '#a09a90', 1.3), lambda s, r: grass(s, r, '#8a9a4a'), lambda s, r: roots(s, r, '#8a6a4a'), lambda s, r: coral(s, r, '#f0a060')],
        pillar=lambda s, r: big_tree(s, r, '#6a9a3a', '#7a5a3a'),
        decal=[('ripple', ['#c09860']), ('pebbles', ['#8a8278']), ('ripple', ['#b08850']), ('puddle', ['#4aa0c8', '#a0e0f0']),
               ('pebbles', ['#a8a098']), ('moss', ['#6a8a3a', '#7a9a4a'])] * 2,
        base='#6a5a4a'),
    3: dict(  # 면역 성소 → 돌 신전 (해골·기둥)
        edge=[lambda s, r: bones(s, r), lambda s, r: broken_pillar(s, r), lambda s, r: urn(s, r), lambda s, r: rock(s, r, '#8a8478'),
              lambda s, r: bones(s, r, skull=False), lambda s, r: broken_pillar(s, r, '#9a8e7a'), lambda s, r: lantern(s, r, '#4a4038', '#ffb040'), lambda s, r: urn(s, r, '#8a6a4a'),
              lambda s, r: grass(s, r, '#5a7a3a'), lambda s, r: bones(s, r), lambda s, r: rock(s, r, '#9a9080', 1.2), lambda s, r: crate(s, r, '#8a6040')],
        pillar=lambda s, r: column(s, r, '#a89a86'),
        decal=[('crack', ['#2a2420']), ('bones', ['#d8d0bc']), ('puddle', ['#3a6a8a', '#8ab8d0']), ('moss', ['#4a6a2a', '#5a7a34']),
               ('crack', ['#3a322a']), ('pebbles', ['#8a8070'])] * 2,
        base='#4a4038'),
    4: dict(  # 유전자 망각 → 흙빛 동굴 (종유석·거미줄)
        edge=[lambda s, r: stalagmite(s, r, '#d8c0a8'), lambda s, r: stalagmite(s, r, '#c8b098', 2), lambda s, r: rock(s, r, '#a08070'), lambda s, r: bones(s, r),
              lambda s, r: web(s, r), lambda s, r: mushroom(s, r, '#9a6ac8', True), lambda s, r: stalagmite(s, r, '#e0c8b0', 4), lambda s, r: crystal(s, r, '#f0d8e8', 3),
              lambda s, r: rock(s, r, '#8a6a5a', 1.3), lambda s, r: roots(s, r), lambda s, r: stalagmite(s, r, '#c8a890', 3), lambda s, r: grass(s, r, '#8a7a4a')],
        pillar=lambda s, r: big_stalag(s, r, '#d8c0a8'),
        decal=[('crack', ['#4a3028']), ('pebbles', ['#8a6a5a']), ('bones', ['#e0d0bc']), ('crack', ['#3a2420']),
               ('moss', ['#7a6a3a', '#8a7a4a']), ('puddle', ['#5a4a6a', '#8a7aa8'])] * 2,
        base='#5a4a3a'),
    5: dict(  # 생명의 기원 → 이끼 낀 어두운 동굴 (흰 결정)
        edge=[lambda s, r: crystal(s, r, '#f0f8ff'), lambda s, r: crystal(s, r, '#e0f0ff', 5), lambda s, r: stalagmite(s, r, '#8a8a5a'), lambda s, r: rock(s, r, '#6a645a'),
              lambda s, r: mushroom(s, r, '#4ae0c8', True), lambda s, r: grass(s, r, '#7a8a2a'), lambda s, r: crystal(s, r, '#d8e8ff', 3), lambda s, r: stalagmite(s, r, '#7a7a4a', 2),
              lambda s, r: bones(s, r), lambda s, r: roots(s, r, '#5a4a2a'), lambda s, r: rock(s, r, '#7a7262', 1.3), lambda s, r: crystal(s, r, '#f8f0ff', 4)],
        pillar=lambda s, r: big_stalag(s, r, '#8a8a5a'),
        decal=[('moss', ['#6a7a2a', '#7a8a32', '#5a6a22']), ('pebbles', ['#6a645a']), ('moss', ['#5a6a24', '#6a7a2a']), ('crack', ['#2a2620']),
               ('bones', ['#d8d0bc']), ('puddle', ['#3a5a5a', '#7aa8a8'])] * 2,
        base='#4a4a3a'),
}


def build(ci, meta):
    m = meta[str(ci)]; spec = CH[ci]; rng = random.Random(500 + ci)
    W = max(e['x'] + e['c'] * e.get('n', 1) for e in m['edge'] + [m['glow'], m['brazier'], m['pillar']] + m['decal'])
    H = max(e['y'] + e['c'] for e in m['edge'] + [m['glow'], m['brazier'], m['pillar']] + m['decal'])
    sheet = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    def put(e, img, k=0): sheet.alpha_composite(img, (e['x'] + k * e['c'], e['y']))
    for e, fn in zip(m['edge'], spec['edge']):
        s = P(e['c'], e['c']); fn(s, rng); put(e, s.done())
    g = m['glow']
    for f in range(g['n']): s = P(g['c'], g['c']); flame(s, f, g['n'], spec['base']); put(g, s.done(), f)
    b = m['brazier']
    for f in range(b['n']): s = P(b['c'], b['c']); brazier(s, f, b['n'], spec['base']); put(b, s.done(), f)
    p = m['pillar']; s = P(p['c'], p['c']); spec['pillar'](s, rng); put(p, s.done())
    for e, (kind, pal) in zip(m['decal'], spec['decal']):
        s = P(e['c'], e['c']); decal(s, rng, kind, pal); put(e, s.image())
    sheet.save(os.path.join(OUT, f'deco8_c{ci}.webp'), 'WEBP', lossless=True)
    return sheet


if __name__ == '__main__':
    meta = load_meta(); prev = []
    for ci in range(1, 6):
        sh = build(ci, meta); prev.append(sh); print('deco8_c%d' % ci, sh.size)
    W = max(p.width for p in prev); can = Image.new('RGBA', (W, sum(p.height for p in prev)), (60, 70, 60, 255)); y = 0
    for p in prev: can.alpha_composite(p, (0, y)); y += p.height
    can.resize((can.width * 2 // 3, can.height * 2 // 3), Image.NEAREST).save('/tmp/claude-0/-home-user-test-mod/97c24a57-7ac8-5d65-afbb-e7e2c529deb0/scratchpad/deco.png')
