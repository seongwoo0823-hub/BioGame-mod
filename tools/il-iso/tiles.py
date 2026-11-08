# 감염의 군주 1단계: 레퍼런스풍(쿼터뷰 도트) 바닥·절벽 질감 — 장마다 하나씩, 이음매 없이 반복되게
#   바닥: 384×384 (월드 11칸 = 바닥 한 장, 카메라가 대각선으로 내려다봐서 네모 타일이 마름모로 보임)
#   절벽(벽): 128×192 블록 기둥 + 위쪽 이끼
#   python3 tiles.py  → games/il-assets/px/floor_c*.webp, wall_c*.webp (+ 큰 그림용 il-assets/ 에 2배)
import os, math, random
import numpy as np
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '../../games/il-assets')
S = 384


def hx(c):
    if not isinstance(c, str): return np.array(c, float)
    c = c.lstrip('#'); return np.array([int(c[i:i + 2], 16) for i in (0, 2, 4)], float)


def shade(c, k):   # k>0 밝게, k<0 어둡게 (어두울수록 살짝 푸른 보라로)
    c = hx(c) if isinstance(c, str) else c
    if k >= 0: return c + (255 - c) * k
    return c * (1 + k) + np.array([6, 4, 14]) * (-k)


class Canvas:
    def __init__(s, w, h, base):
        s.w, s.h = w, h; s.a = np.zeros((h, w, 3)); s.a[:] = hx(base)

    def px(s, x, y, c):
        s.a[int(y) % s.h, int(x) % s.w] = c

    def rect(s, x, y, w, h, c):
        for yy in range(int(y), int(y + h)):
            for xx in range(int(x), int(x + w)): s.a[yy % s.h, xx % s.w] = c

    def blob(s, cx, cy, rx, ry, c, rng=None, rough=0.0):
        for yy in range(int(cy - ry - 1), int(cy + ry + 2)):
            for xx in range(int(cx - rx - 1), int(cx + rx + 2)):
                d = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2
                if rough and rng: d += (rng.random() - .5) * rough
                if d <= 1: s.a[yy % s.h, xx % s.w] = c

    def noise(s, rng, amt=6):
        n = rng.normal(0, amt, (s.h, s.w, 1)); s.a = s.a + n

    def img(s, levels=None):
        a = np.clip(s.a, 0, 255)
        return Image.fromarray(a.astype(np.uint8), 'RGB')


def stone_tile(cv, x, y, w, h, base, rng, crack=0.2, bevel=True):
    """도트 돌 한 장: 위·왼쪽 밝은 테, 아래·오른쪽 어두운 테, 안쪽 작은 얼룩"""
    t = (rng.random() - .5) * .16
    cv.rect(x + 1, y + 1, w - 2, h - 2, shade(base, t))
    if bevel:
        cv.rect(x + 1, y + 1, w - 2, 1, shade(base, t + .22)); cv.rect(x + 1, y + 1, 1, h - 2, shade(base, t + .14))
        cv.rect(x + 1, y + h - 2, w - 2, 1, shade(base, t - .28)); cv.rect(x + w - 2, y + 1, 1, h - 2, shade(base, t - .22))
    for _ in range(int(w * h / 40)):
        cv.px(x + 2 + rng.random() * (w - 4), y + 2 + rng.random() * (h - 4), shade(base, t + (rng.random() - .5) * .3))
    if rng.random() < crack:
        cx, cy = x + 3 + rng.random() * (w - 6), y + 3 + rng.random() * (h - 6)
        for _ in range(int(min(w, h) * .6)):
            cv.px(cx, cy, shade(base, -.45)); cx += rng.choice([-1, 0, 1]); cy += rng.choice([0, 1])


# ---------------- 장별 바닥 ----------------
def floor_c1(rng):
    """세포 폐허 → 돌길 마을: 작은 돌 포장 + 잔디 + 노란 잎"""
    grout = '#3a3628'; cv = Canvas(S, S, grout)
    for y in range(0, S, 16):
        off = (y // 16 % 2) * 8
        for x in range(-8, S, 16): stone_tile(cv, x + off, y, 16, 16, '#8c8670' if rng.random() < .8 else '#7a8a6a', rng, .12)
    for _ in range(18):   # 잔디 덩이
        cx, cy, r = rng.random() * S, rng.random() * S, 6 + rng.random() * 16
        cv.blob(cx, cy, r, r * .8, shade('#4e6e34', (rng.random() - .5) * .2), rng, .5)
        for _ in range(int(r * 3)):
            a = rng.random() * 6.28; d = rng.random() * r
            cv.px(cx + math.cos(a) * d, cy + math.sin(a) * d * .8, shade('#6a8a42', rng.random() * .25))
    for _ in range(160):  # 노란 잎
        x, y = rng.random() * S, rng.random() * S; c = shade('#f0c030', (rng.random() - .3) * .3)
        cv.px(x, y, c); cv.px(x + 1, y, c); cv.px(x, y + 1, shade(c, -.2))
    cv.noise(rng, 3); return cv


def floor_c2(rng):
    """미생물 심연 → 모래 해안: 물결무늬 모래 + 조약돌 + 풀 포기"""
    cv = Canvas(S, S, '#d8b078')
    for y in range(S):
        for x in range(S):
            v = math.sin((x * .9 + y * .45) * .32 + math.sin(y * .05) * 2) * .5 + .5
            cv.a[y, x] = shade('#d8b078', (v - .5) * .1 + (rng.random() - .5) * .06)
    for _ in range(900):   # 모래 알갱이
        cv.px(rng.random() * S, rng.random() * S, shade('#d8b078', rng.choice([-.18, .18, -.1])))
    for _ in range(40):    # 조약돌
        cx, cy, r = rng.random() * S, rng.random() * S, 2 + rng.random() * 4
        cv.blob(cx, cy + 1, r, r * .7, shade('#7a6a5a', -.3)); cv.blob(cx, cy, r, r * .7, shade('#a8a098', (rng.random() - .5) * .2))
        cv.px(cx - r * .3, cy - r * .3, shade('#e8e0d8', 0))
    for _ in range(18):    # 풀 포기
        cx, cy = rng.random() * S, rng.random() * S
        for k in range(9):
            a = -1.57 + (k - 4) * .22; L = 4 + rng.random() * 6
            for t in range(int(L)): cv.px(cx + math.cos(a) * t, cy + math.sin(a) * t, shade('#6a8a3a', t / L * .3 - .1))
    cv.noise(rng, 2); return cv


def floor_c3(rng):
    """면역 성소 → 신전 바닥: 큰 돌판 + 무늬 띠"""
    cv = Canvas(S, S, '#2e2a26')
    for y in range(0, S, 24):
        for x in range(0, S, 24): stone_tile(cv, x, y, 24, 24, '#6e6458', rng, .25)
    # 장식 띠 (사각 고리 무늬): 192 간격
    for b in (0, 192):
        for k in range(0, S, 8):
            for (x, y) in ((k, b + 4), (b + 4, k)):
                cv.rect(x, y, 8, 8, shade('#8a7e6a', .05)); cv.rect(x + 2, y + 2, 4, 4, shade('#4a4238', 0)); cv.px(x + 3, y + 3, shade('#a89a82', 0))
            cv.rect(k, b + 2, 8, 1, shade('#2a2420', 0)); cv.rect(k, b + 13, 8, 1, shade('#2a2420', 0))
            cv.rect(b + 2, k, 1, 8, shade('#2a2420', 0)); cv.rect(b + 13, k, 1, 8, shade('#2a2420', 0))
    cv.noise(rng, 3); return cv


def floor_c4(rng):
    """유전자 망각 → 흙빛 동굴: 갈라진 판석"""
    cv = Canvas(S, S, '#5a3e36')
    pts = [(rng.random() * S, rng.random() * S) for _ in range(90)]
    P = np.array(pts)
    yy, xx = np.mgrid[0:S, 0:S]
    best = np.full((S, S), 1e9); second = np.full((S, S), 1e9); idx = np.zeros((S, S), int)
    for i, (px_, py_) in enumerate(pts):
        dx = np.abs(xx - px_); dx = np.minimum(dx, S - dx); dy = np.abs(yy - py_); dy = np.minimum(dy, S - dy)
        d = np.sqrt(dx * dx + dy * dy)
        m = d < best; second = np.where(m, best, np.minimum(second, d)); idx = np.where(m, i, idx); best = np.minimum(best, d)
    tone = np.array([(rng.random() - .5) * .16 for _ in pts])
    base = hx('#b08a72')
    for y in range(S):
        for x in range(S):
            t = tone[idx[y, x]]; edge = second[y, x] - best[y, x]
            if edge < 1.6: cv.a[y, x] = shade('#4a3028', 0)
            elif edge < 3: cv.a[y, x] = shade(base, t - .18)
            else: cv.a[y, x] = shade(base, t + (.08 if (x + y) % 7 == 0 else 0))
    for _ in range(50): cv.blob(rng.random() * S, rng.random() * S, 1.5, 1.2, shade('#7a5a4a', -.2))
    cv.noise(rng, 3); return cv


def floor_c5(rng):
    """생명의 기원 → 이끼 낀 어두운 동굴: 검은 흙 + 이끼 + 작은 결정"""
    cv = Canvas(S, S, '#3a3630')
    for _ in range(1400): cv.px(rng.random() * S, rng.random() * S, shade('#3a3630', rng.choice([-.25, .15, .25])))
    for _ in range(36):   # 이끼
        cx, cy, r = rng.random() * S, rng.random() * S, 6 + rng.random() * 20
        for _ in range(int(r * r * .9)):
            a = rng.random() * 6.28; d = math.sqrt(rng.random()) * r
            cv.px(cx + math.cos(a) * d, cy + math.sin(a) * d * .7, shade('#6a7a2a', (rng.random() - .3) * .4))
    for _ in range(30):   # 돌 조각
        cx, cy, r = rng.random() * S, rng.random() * S, 2 + rng.random() * 3
        cv.blob(cx, cy, r, r * .7, shade('#6a645a', (rng.random() - .5) * .3)); cv.px(cx - 1, cy - 1, shade('#9a948a', 0))
    for _ in range(14):   # 작은 결정
        cx, cy = rng.random() * S, rng.random() * S
        for k in range(5): cv.px(cx, cy - k, shade('#c8e8f0', .1 - k * .05)); cv.px(cx + 1, cy - k, shade('#8ab0c0', -k * .05))
    cv.noise(rng, 2); return cv


# ---------------- 장별 절벽(벽) ----------------
WALL = [('#7a7462', '#5e8a3a'), ('#9a7a5a', '#7a8a3a'), ('#6e665a', '#5a7a3a'), ('#8a6a5a', '#6a6a3a'), ('#5a564a', '#6a7a2a')]


def wall(ci, rng):
    """블록이 쌓인 절벽 기둥: 세로로 긴 돌 기둥들 + 맨 위 이끼 (128×192)"""
    w, h = 128, 192; stone, moss = WALL[ci]
    cv = Canvas(w, h, shade(stone, -.55))
    x = 0
    while x < w:
        cw = rng.choice([12, 16, 16, 20])
        y = 0
        while y < h:
            bh = rng.choice([14, 18, 22, 26])
            stone_tile(cv, x, y, cw, bh, stone, rng, .15)
            y += bh
        cv.rect(x + cw - 1, 0, 1, h, shade(stone, -.6))   # 기둥 사이 그림자
        x += cw
    for xx in range(w):     # 위쪽 이끼 (흘러내림)
        d = 6 + int(4 * math.sin(xx * .4) + rng.random() * 6)
        for yy in range(d): cv.px(xx, yy, shade(moss, (1 - yy / d) * .1 - .3 + (rng.random() - .5) * .15))
    cv.noise(rng, 3); return cv


def top(ci, rng):
    """절벽 윗면 (64×64): 이끼 낀 돌 + 풀"""
    stone, moss = WALL[ci]; cv = Canvas(64, 64, shade(stone, -.15))
    for y in range(0, 64, 16):   # 윗면 돌판
        for x in range(0, 64, 16): stone_tile(cv, x + (y // 16 % 2) * 8, y, 16, 16, shade(stone, -.05), rng, .2)
    for _ in range(5):           # 이끼 덩이 (어둡고 작게)
        cx, cy, r = rng.random() * 64, rng.random() * 64, 3 + rng.random() * 6
        for _ in range(int(r * r * 1.5)):
            a = rng.random() * 6.28; d = math.sqrt(rng.random()) * r
            cv.px(cx + math.cos(a) * d, cy + math.sin(a) * d, shade(moss, -.35 + rng.random() * .25))
    cv.noise(rng, 3); return cv


def save(im, name, hi_scale):
    os.makedirs(os.path.join(OUT, 'px'), exist_ok=True)
    im.save(os.path.join(OUT, 'px', name + '.webp'), 'WEBP', lossless=True)
    im.resize((im.width * hi_scale, im.height * hi_scale), Image.NEAREST).save(os.path.join(OUT, name + '.webp'), 'WEBP', quality=92)


def water(rng, deep='#1a6ab0', mid='#2a8ad0', foam='#e8f8ff'):
    """바다 (128×128): 파란 물결 + 흰 물결선"""
    w = 128; cv = Canvas(w, w, deep)
    for y in range(w):
        for x in range(w):
            v = math.sin((x * .7 + y * .35) * .25 + math.sin(y * .09) * 1.6) * .5 + .5
            cv.a[y, x] = shade(mid, (v - .5) * .25) if v > .45 else shade(deep, (v - .5) * .2)
    for _ in range(40):   # 흰 물결선
        x, y = rng.random() * w, rng.random() * w; L = 4 + int(rng.random() * 8)
        for t in range(L): cv.px(x + t, y + math.sin(t * .6) * 1.2, shade(foam, -t / L * .3))
    return cv


def abyss(rng):
    """어둠 (128×128): 거의 검은 바탕 + 아주 희미한 바위 결"""
    w = 128; cv = Canvas(w, w, '#0a0806')
    for _ in range(300): cv.px(rng.random() * w, rng.random() * w, shade('#1a1612', rng.random() * .2))
    return cv


if __name__ == '__main__':
    rr = random.Random(9)
    class RW: random = rr.random; choice = rr.choice
    save(water(RW).img(), 'water', 4); save(abyss(RW).img(), 'abyss', 4)
    for ci, fn in enumerate([floor_c1, floor_c2, floor_c3, floor_c4, floor_c5]):
        rng = random.Random(100 + ci); np.random.seed(100 + ci)
        r2 = np.random.default_rng(100 + ci)
        class R:   # random + normal
            random = rng.random; choice = rng.choice
            normal = r2.normal
        save(fn(R).img(), f'floor_c{ci + 1}', 3)
        save(wall(ci, R).img(), f'wall_c{ci + 1}', 4)
        save(top(ci, R).img(), f'top_c{ci + 1}', 4)
        print('chapter', ci + 1)
