# 헬릭스 지역별 바닥·벽·절벽 타일과 바닥 장식 (도트 직접 생성)
#   python3 tiles.py [출력폴더]
# 바닥 타일 48x30 (월드 48x48을 쿼터뷰로 눌러 본 크기), 벽 앞면 48x64, 벽 윗면 48x14, 절벽 48x28, 장식 48x30
import sys, os, json, math
import numpy as np
from PIL import Image

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '../../games/helix/assets/world/')
TW, TH = 48, 30
def hx(h): h = h.lstrip('#'); return np.array([int(h[i:i+2], 16) for i in (0, 2, 4)], float)
def rng(s): return np.random.default_rng(s)

def vnoise(w, h, cell, seed, wrap=True):
    """타일이 이어지는 값 노이즈"""
    r = rng(seed); gw, gh = max(1, w // cell), max(1, h // cell)
    g = r.random((gh + 1, gw + 1))
    if wrap: g[-1, :] = g[0, :]; g[:, -1] = g[:, 0]
    ys, xs = np.mgrid[0:h, 0:w]
    fx = xs / w * gw; fy = ys / h * gh
    x0 = np.floor(fx).astype(int); y0 = np.floor(fy).astype(int); tx = fx - x0; ty = fy - y0
    tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty)
    a = g[y0, x0]; b = g[y0, x0 + 1]; c = g[y0 + 1, x0]; d = g[y0 + 1, x0 + 1]
    return a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty

def fbm(w, h, seed, cells=(12, 6, 3)):
    out = np.zeros((h, w)); amp = 0.55; tot = 0
    for k, c in enumerate(cells):
        out += vnoise(w, h, c, seed + k * 17) * amp; tot += amp; amp *= 0.5
    return out / tot

def pal(img, ramp, v):
    """v(0~1) → 단계 색 (도트 느낌을 위해 계단식)"""
    R = np.stack([hx(c) for c in ramp]); i = np.clip((v * len(R)).astype(int), 0, len(R) - 1)
    img[..., :3] = R[i]; img[..., 3] = 255

def new(w=TW, h=TH): return np.zeros((h, w, 4), float)
def save(a): return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
def put(a, x, y, col, alpha=255):
    x = int(x) % a.shape[1]; y = int(y)
    if 0 <= y < a.shape[0]: a[y, x, :3] = hx(col) if isinstance(col, str) else col; a[y, x, 3] = alpha
def line(a, x0, y0, x1, y1, col, wrap=True):
    n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
    for k in range(n + 1):
        t = k / max(1, n); put(a, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, col)
def blob(a, cx, cy, rx, ry, col, alpha=255, seed=0, rough=0.25):
    r = rng(seed); h, w = a.shape[:2]
    for y in range(int(cy - ry - 2), int(cy + ry + 3)):
        for x in range(int(cx - rx - 2), int(cx + rx + 3)):
            ang = math.atan2(y - cy, x - cx); k = 1 + rough * math.sin(ang * 3 + seed) + rough * 0.5 * math.sin(ang * 5 + seed * 2)
            if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= k * k * 0.85 and 0 <= y < h:
                a[y, x % w, :3] = hx(col); a[y, x % w, 3] = alpha
def crack(a, x, y, n, col, seed):
    r = rng(seed); px, py = x, y
    for k in range(n):
        nx = px + r.integers(-1, 2) * 1 + r.choice([-2, 2]); ny = py + r.integers(-1, 2)
        line(a, px, py, nx, ny, col); px, py = nx, ny
def shade_edges(a, light=12, dark=-18, w=1):
    """타일 경계 입체감: 위·왼쪽 밝게, 아래·오른쪽 어둡게"""
    a[:w, :, :3] += light; a[:, :w, :3] += light * 0.6; a[-w:, :, :3] += dark; a[:, -w:, :3] += dark * 0.6
    return a

# ------------------------------------------------------------------ 지역 정의
AREAS = {}
def area(name):
    def deco(f): AREAS[name] = f; return f
    return deco

# ===== 마을 '쉼터': 이끼 낀 돌길, 풀밭, 나무 데크
@area('hub')
def hub():
    T = {}
    STONE = ['#2a2e2a', '#3c423a', '#4e5648', '#646c58', '#7a8268']
    GRASS = ['#14261a', '#1c3622', '#26462a', '#305636', '#3c6a40']
    for v in range(6):
        a = new(); n = fbm(TW, TH, 10 + v)
        pal(a, GRASS, 0.15 + n * 0.75)
        r = rng(30 + v)
        for k in range(26):   # 풀잎
            x, y = r.integers(0, TW), r.integers(1, TH)
            put(a, x, y, '#4a7c46'); put(a, x, y - 1, '#5a9050')
        if v >= 4:
            for k in range(4): blob(a, r.integers(4, 44), r.integers(4, 26), 1.6, 1.2, ['#c8f0a0', '#f0e080', '#8ae0ff'][k % 3], seed=k)   # 꽃·발광 버섯
        T[f'grass{v}'] = a
    for v in range(6):   # 판석 길
        a = new(); n = fbm(TW, TH, 50 + v); pal(a, STONE, 0.25 + n * 0.6)
        r = rng(70 + v)
        # 불규칙한 판석 줄눈
        for y in (0, 15):
            line(a, 0, y, TW, y, '#1e221e')
        off = r.integers(6, 20)
        for x in (off, off + 22):
            line(a, x % TW, 0, x % TW, 14, '#1e221e')
        for x in (off + 11, off + 33):
            line(a, x % TW, 15, x % TW, 29, '#1e221e')
        a[1, :, :3] += 10
        a[16, :, :3] += 10
        for k in range(10): put(a, r.integers(0, TW), r.integers(0, TH), '#3a5a36')   # 이끼
        if v == 5: crack(a, 20, 8, 6, '#1a1e1a', 5)
        T[f'path{v}'] = a
    for v in range(3):   # 나무 데크
        a = new(); n = fbm(TW, TH, 90 + v, (24, 8, 3))
        pal(a, ['#2a1a10', '#3e2818', '#523622', '#68462c', '#7e5636'], 0.3 + n * 0.55)
        for y in range(0, TH, 6): line(a, 0, y, TW, y, '#1e120a'); a[min(TH - 1, y + 1), :, :3] += 12
        r = rng(95 + v)
        for k in range(5): put(a, r.integers(0, TW), r.integers(0, TH), '#1e120a')
        T[f'deck{v}'] = a
    floors = dict(base=['path0', 'path1', 'path2', 'path3', 'path4', 'path5'], alt=['grass0', 'grass1', 'grass2', 'grass3', 'grass4', 'grass5'], deck=['deck0', 'deck1', 'deck2'])
    # 벽: 돌담 + 넝쿨
    W = []
    for v in range(3):
        a = new(TW, 64); n = fbm(TW, 64, 120 + v)
        pal(a, ['#1e221e', '#2c322a', '#3a4236', '#4a5444', '#5c6852'], 0.2 + n * 0.6)
        r = rng(130 + v)
        for row, y in enumerate(range(0, 64, 12)):
            line(a, 0, y, TW, y, '#141814'); off = (row % 2) * 12 + r.integers(0, 4)
            for x in range(off, TW + 24, 24): line(a, x % TW, y, x % TW, y + 11, '#141814')
        for k in range(3 + v):   # 넝쿨
            x = r.integers(2, 46); L = r.integers(10, 40)
            for y in range(0, L): put(a, x + int(2 * math.sin(y * 0.4 + k)), y, '#2e5a2c' if y % 3 else '#4a8a3e')
        a[-4:, :, :3] *= 0.7
        W.append(a)
    top = new(TW, 14); pal(top, ['#1a2a1a', '#22361e', '#2c4426', '#36522e'], 0.3 + fbm(TW, 14, 140) * 0.6)
    return dict(tiles=T, floors=floors, walls=W, top=top, cliff=cliff(['#0e100e', '#181c16', '#22281e', '#2c3426']), void='#0a0e0c', decals=decals_hub())

def cliff(ramp, seed=5):
    a = new(TW, 28); n = fbm(TW, 28, seed, (8, 4, 2))
    ys = np.mgrid[0:28, 0:TW][0] / 28
    pal(a, ramp, np.clip(0.75 - ys * 0.65 + (n - 0.5) * 0.3, 0, 0.999))
    a[:, :, 3] = (255 * np.clip(1.25 - ys * 1.1, 0, 1))
    return a

def decal_set(specs):
    out = []
    for f in specs:
        a = new(); f(a); out.append(a)
    return out

def decals_hub():
    def leaves(a):
        r = rng(1)
        for k in range(14): put(a, r.integers(8, 40), r.integers(6, 24), ['#5a7a2a', '#7a8a2a', '#9a6a2a'][k % 3])
    def flowers(a):
        for k, (x, y) in enumerate(((10, 10), (20, 18), (32, 8), (38, 20), (26, 12))):
            blob(a, x, y, 1.5, 1.1, ['#ff9ac0', '#fff0a0', '#a0e8ff'][k % 3], seed=k); put(a, x, y, '#ffffff')
    def puddle(a): blob(a, 24, 15, 11, 5, '#1c3a3a', 200, 3); blob(a, 22, 13, 5, 2, '#3a6a6a', 200, 4)
    def glowshroom(a):
        for k, (x, y) in enumerate(((14, 18), (22, 14), (30, 20))):
            line(a, x, y, x, y - 3, '#d8d0b0'); blob(a, x, y - 4, 2.4, 1.3, '#5ae8d0', seed=k)
    return decal_set([leaves, flowers, puddle, glowshroom])

# ===== 1장 배양실: 흰 실험실 타일
@area('lab')
def lab():
    T = {}
    TILE = ['#4e5862', '#5e6872', '#6c7680', '#7a848e', '#88929c']
    for v in range(8):
        a = new(); n = fbm(TW, TH, 200 + v, (16, 8, 4)); pal(a, TILE, 0.45 + n * 0.4)
        # 2x2 타일 줄눈
        for x in (0, 24): line(a, x, 0, x, TH, '#3e4650')
        for y in (0, 15): line(a, 0, y, TW, y, '#3e4650')
        for x in (1, 25): a[:, x, :3] += 14
        for y in (1, 16): a[y, :, :3] += 14
        for x in (23, 47): a[:, x, :3] -= 10
        r = rng(210 + v)
        if v in (2, 5): crack(a, r.integers(6, 40), r.integers(4, 26), 7, '#5a626c', v)
        if v in (3, 6):   # 배지 얼룩
            blob(a, r.integers(10, 38), r.integers(8, 22), 6, 3.5, '#7ab86a', 255, v); blob(a, 20, 14, 2, 1, '#9ad88a', 255, v + 1)
        if v == 7:   # 바닥 배수구
            for y in range(10, 20):
                for x in range(18, 30):
                    a[y, x, :3] = hx('#4a525c') if (x + y) % 3 else hx('#2a3038')
        T[f'lab{v}'] = a
    for v in range(2):   # 경고 줄무늬 타일
        a = new(); pal(a, ['#c8a020', '#e0b82a', '#f0cc40', '#f8dc60'], 0.5 + fbm(TW, TH, 230 + v) * 0.3)
        for x in range(-30, TW + 30, 10):
            for y in range(TH): xx = x + y
            line(a, x, 0, x + TH, TH, '#2a2a2a'); line(a, x + 1, 0, x + TH + 1, TH, '#2a2a2a'); line(a, x + 2, 0, x + TH + 2, TH, '#2a2a2a'); line(a, x + 3, 0, x + TH + 3, TH, '#2a2a2a')
        T[f'warn{v}'] = a
    floors = dict(base=['lab0', 'lab1', 'lab2', 'lab4', 'lab5', 'lab7'], alt=['lab3', 'lab6'])
    W = []
    for v in range(3):
        a = new(TW, 64); pal(a, ['#5a626c', '#6c747e', '#7e8690', '#9098a2', '#a2aab2'], 0.5 + fbm(TW, 64, 250 + v) * 0.3)
        for x in (0, 24): line(a, x, 0, x, 63, '#646c76')
        line(a, 0, 30, TW, 30, '#646c76')
        a[40:46, :, :3] = hx('#2a7ab8'); a[40, :, :3] = hx('#5aaae0'); a[45, :, :3] = hx('#1a4a7a')   # 파란 띠
        if v == 1:   # 환기구
            for y in range(8, 22, 3): line(a, 8, y, 20, y, '#4a525c'); line(a, 8, y + 1, 20, y + 1, '#c8d0d8')
        if v == 2:   # 생물 위험 표지
            blob(a, 34, 16, 6, 6, '#e0b020', seed=2, rough=0); blob(a, 34, 16, 2, 2, '#1a1a1a', seed=2, rough=0)
            for k in range(3): ang = k * 2.09 - 1.57; blob(a, 34 + math.cos(ang) * 3.5, 16 + math.sin(ang) * 3.5, 1.6, 1.6, '#1a1a1a', rough=0)
        a[-4:, :, :3] *= 0.72
        W.append(a)
    top = new(TW, 14); pal(top, ['#4a525c', '#5a626c', '#6a727c', '#7a828c'], 0.4 + fbm(TW, 14, 260) * 0.4)
    def spill(a): blob(a, 24, 15, 13, 6, '#4aa83a', 220, 7); blob(a, 20, 13, 6, 2.5, '#8ae86a', 230, 8); put(a, 18, 12, '#e0ffd0')
    def glass(a):
        r = rng(9)
        for k in range(10): x, y = r.integers(10, 38), r.integers(6, 24); put(a, x, y, '#e8f8ff'); put(a, x + 1, y, '#a8d8f0')
    def dish(a): blob(a, 24, 15, 8, 4.5, '#c8e0e8', 255, 1, 0); blob(a, 24, 15, 6.5, 3.4, '#e0b0c8', 255, 2, 0.1); blob(a, 22, 14, 2, 1, '#f8e0f0', 255, 3, 0)
    def scorch(a): blob(a, 24, 15, 10, 5, '#3a3a2a', 140, 11); blob(a, 24, 15, 5, 2.5, '#2a2a1a', 180, 12)
    return dict(tiles=T, floors=floors, walls=W, top=top, cliff=cliff(['#101418', '#1a2028', '#262e38', '#343e4a']), void='#0c1016', decals=decal_set([spill, glass, dish, scorch]))

# ===== 2장 하수 저장고: 젖은 돌바닥 + 물길
@area('sewer')
def sewer():
    T = {}
    COB = ['#121a1a', '#1c2626', '#28342e', '#344238', '#425244']
    for v in range(8):
        a = new(); n = fbm(TW, TH, 300 + v); pal(a, COB, 0.2 + n * 0.55)
        r = rng(310 + v)
        # 둥근 조약돌
        for k in range(7):
            cx, cy = r.integers(0, TW), r.integers(0, TH)
            blob(a, cx, cy, r.integers(4, 7), r.integers(3, 4), ['#2e3a32', '#36443a', '#3e4c40'][k % 3], seed=k + v * 9, rough=0.15)
            put(a, cx - 2, cy - 2, '#56685a')
        if v in (2, 6):   # 물웅덩이(반사)
            blob(a, r.integers(12, 36), r.integers(8, 22), 8, 3.5, '#1a3a40', 255, v); line(a, 16, 12, 22, 12, '#5a9aa0')
        if v in (3, 7):
            for k in range(12): put(a, r.integers(0, TW), r.integers(0, TH), '#4a7a3a')   # 이끼
        T[f'cob{v}'] = a
    for v in range(4):   # 철망 바닥(배수 격자)
        a = new(); pal(a, ['#1a1e20', '#262c30', '#323a40', '#40484e'], 0.3 + fbm(TW, TH, 330 + v) * 0.5)
        for x in range(0, TW, 6): line(a, x, 0, x, TH, '#0c1012')
        for y in range(0, TH, 5): line(a, 0, y, TW, y, '#4a545a')
        T[f'grate{v}'] = a
    floors = dict(base=[f'cob{v}' for v in range(8)], alt=[f'grate{v}' for v in range(4)])
    W = []
    for v in range(3):
        a = new(TW, 64); pal(a, ['#1a1612', '#2a221a', '#3a2e22', '#4a3a2a', '#5a4632'], 0.25 + fbm(TW, 64, 350 + v) * 0.55)
        for row, y in enumerate(range(0, 64, 8)):
            line(a, 0, y, TW, y, '#120e0a'); off = (row % 2) * 8
            for x in range(off, TW + 16, 16): line(a, x % TW, y, x % TW, y + 7, '#120e0a')
        if v == 1:   # 수평 배관
            a[24:32, :, :3] = hx('#3a4a44'); a[24, :, :3] = hx('#6a8478'); a[31, :, :3] = hx('#1a2420')
            for x in (10, 34): a[22:34, x:x + 3, :3] = hx('#5a6a62')
        if v == 2:   # 녹물 줄
            for x in (12, 13, 30):
                for y in range(10, 60): put(a, x, y, '#6a4a1a' if y % 4 else '#8a5a20')
        a[-6:, :, :3] = a[-6:, :, :3] * 0.6 + np.array([10, 30, 26]) * 0.4   # 아래쪽 이끼 낀 물때
        W.append(a)
    top = new(TW, 14); pal(top, ['#14100c', '#1e1812', '#2a2218', '#362c20'], 0.3 + fbm(TW, 14, 360) * 0.5)
    def bones(a):
        line(a, 14, 16, 26, 12, '#d8d0b8'); put(a, 13, 16, '#f0e8d0'); put(a, 27, 12, '#f0e8d0'); blob(a, 32, 18, 3, 2, '#d8d0b8', seed=2, rough=0.1); put(a, 31, 18, '#2a2418')
    def slime(a): blob(a, 24, 15, 12, 5, '#3a5a1a', 220, 5); blob(a, 26, 14, 5, 2, '#6a9a2a', 230, 6)
    def drain(a):
        blob(a, 24, 15, 9, 5, '#2a3034', 255, 0, 0)
        for x in range(17, 32, 3): line(a, x, 11, x, 19, '#0a0c0e')
    def leaves(a):
        r = rng(4)
        for k in range(16): put(a, r.integers(8, 40), r.integers(6, 24), ['#3a5a2a', '#5a7a3a', '#2a3a1a'][k % 3])
    return dict(tiles=T, floors=floors, walls=W, top=top, cliff=cliff(['#060a0a', '#0c1414', '#122020', '#1a2c2a'], 9), void='#060a0a',
                water=water_frames(), decals=decal_set([bones, slime, drain, leaves]))

def water_frames():
    fr = []
    for f in range(4):
        a = new(); n = fbm(TW, TH, 400 + f, (12, 6, 3))
        pal(a, ['#0e2420', '#14322c', '#1c4038', '#2a5448', '#3e6c5a'], 0.25 + n * 0.5)
        r = rng(410)
        for k in range(8):
            x = (r.integers(0, TW) + f * 3) % TW; y = r.integers(2, TH - 2)
            line(a, x, y, x + 4, y, '#6a9a80')
        fr.append(a)
    return fr

# ===== 3장 격리 병동: 청록 비닐 바닥 + 곰팡이
@area('ward')
def ward():
    T = {}
    for v in range(8):
        a = new(); n = fbm(TW, TH, 500 + v, (14, 7, 3))
        pal(a, ['#2a4a4a', '#345a58', '#3e6a66', '#4a7a74', '#588a82'], 0.35 + n * 0.45)
        # 체크무늬
        for y in range(TH):
            for x in range(TW):
                if ((x // 12) + (y // 8)) % 2: a[y, x, :3] *= 0.86
        r = rng(510 + v)
        if v in (2, 5):
            for k in range(3): blob(a, r.integers(6, 42), r.integers(4, 26), r.integers(3, 6), r.integers(2, 3), '#5a2a6a', 255, k + v)   # 곰팡이
            for k in range(6): put(a, r.integers(6, 42), r.integers(4, 26), '#c86aff')
        if v in (3, 6): line(a, 4, r.integers(5, 25), 44, r.integers(5, 25), '#2a3a3a')   # 끌린 자국
        T[f'vin{v}'] = a
    for v in range(3):   # 곰팡이 잠식 바닥
        a = new(); pal(a, ['#1e1026', '#2e1838', '#40224c', '#542c62', '#6a3a7a'], 0.25 + fbm(TW, TH, 540 + v) * 0.6)
        r = rng(545 + v)
        for k in range(10): blob(a, r.integers(0, TW), r.integers(0, TH), 1.6, 1.2, '#b45aff' if k % 3 == 0 else '#7a3a9a', seed=k)
        T[f'fung{v}'] = a
    floors = dict(base=[f'vin{v}' for v in range(8)], alt=[f'fung{v}' for v in range(3)])
    W = []
    for v in range(3):
        a = new(TW, 64); pal(a, ['#4a5856', '#5a6a68', '#6a7c78', '#7c8e8a', '#90a29c'], 0.4 + fbm(TW, 64, 550 + v) * 0.35)
        for y in range(0, 64, 8): line(a, 0, y, TW, y, '#3e4a48')
        for x in range(0, TW, 8): line(a, x, 0, x, 36, '#3e4a48')
        a[38:64, :, :3] = a[38:64, :, :3] * 0.6 + hx('#2a5a5a') * 0.4   # 아래 판넬
        line(a, 0, 38, TW, 38, '#a0b8b4')
        if v == 1:   # 관찰창
            a[8:28, 10:38, :3] = hx('#14262c'); a[8, 10:38, :3] = hx('#3a5a62'); line(a, 14, 12, 22, 24, '#4a7a86')
        if v == 2:   # 벽을 타고 오르는 곰팡이
            r = rng(560)
            for k in range(6): blob(a, r.integers(4, 44), r.integers(30, 60), r.integers(3, 6), r.integers(3, 6), '#4a2058', 255, k)
            for k in range(8): put(a, r.integers(4, 44), r.integers(30, 60), '#c86aff')
        a[-4:, :, :3] *= 0.7
        W.append(a)
    top = new(TW, 14); pal(top, ['#1e2a2a', '#283636', '#324242', '#3c4e4c'], 0.35 + fbm(TW, 14, 570) * 0.5)
    def blood(a): blob(a, 24, 15, 9, 4, '#5a1018', 210, 2); blob(a, 30, 18, 3, 1.5, '#7a1a22', 220, 3)
    def spores(a):
        r = rng(6)
        for k in range(14): put(a, r.integers(8, 40), r.integers(5, 25), '#c86aff' if k % 3 else '#f0c0ff')
    def paper(a):
        for k, (x, y) in enumerate(((12, 10), (26, 16))):
            a[y:y + 6, x:x + 9, :3] = hx('#d8d4c8'); a[y:y + 6, x:x + 9, 3] = 255
            for yy in range(y + 1, y + 6, 2): line(a, x + 1, yy, x + 7, yy, '#8a8678')
    def hazard(a):
        for x in range(4, 44):
            for y in range(12, 18): a[y, x, :3] = hx('#e0b020') if ((x + y) // 3) % 2 else hx('#1a1a1a'); a[y, x, 3] = 255
    return dict(tiles=T, floors=floors, walls=W, top=top, cliff=cliff(['#08100e', '#0e1a18', '#162624', '#1e3230'], 11), void='#081010', decals=decal_set([blood, spores, paper, hazard]))

# ===== 4장 유전체 금고: 어두운 금속판 + 빛나는 회로·나선
@area('vault')
def vault():
    T = {}
    for v in range(8):
        a = new(); n = fbm(TW, TH, 700 + v, (16, 8, 4))
        pal(a, ['#0c0a16', '#141022', '#1c1830', '#262040', '#30284e'], 0.3 + n * 0.5)
        line(a, 0, 0, TW, 0, '#08060e'); line(a, 0, 0, 0, TH, '#08060e'); a[1, :, :3] += 16; a[:, 1, :3] += 10
        for (x, y) in ((3, 3), (44, 3), (3, 26), (44, 26)): put(a, x, y, '#5a5070')   # 리벳
        r = rng(710 + v)
        if v in (1, 4, 6):   # 회로선
            x = r.integers(8, 40); y = r.integers(6, 24)
            line(a, 0, y, x, y, '#2ac8a0'); line(a, x, y, x, TH if v % 2 else 0, '#2ac8a0'); put(a, x, y, '#a0ffe0')
        if v in (2, 5):
            line(a, 0, 15, TW, 15, '#7a3ac0'); put(a, 24, 15, '#e0a8ff')
        if v == 7:   # 이중나선 문양
            for x in range(TW):
                y1 = 15 + 6 * math.sin(x / TW * 4 * math.pi); y2 = 15 - 6 * math.sin(x / TW * 4 * math.pi)
                put(a, x, y1, '#3cffae'); put(a, x, y2, '#d050ff')
                if x % 6 == 0: line(a, x, y1, x, y2, '#5a5a8a')
        T[f'met{v}'] = a
    for v in range(3):   # 육각 결정 바닥
        a = new(); pal(a, ['#140a26', '#1e1038', '#2a184c', '#382262'], 0.3 + fbm(TW, TH, 740 + v) * 0.5)
        for cy in range(-4, TH + 8, 9):
            for cx in range(-6, TW + 12, 12):
                ox = 6 if (cy // 9) % 2 else 0
                for k in range(6):
                    a0 = k * math.pi / 3; a1 = a0 + math.pi / 3
                    line(a, cx + ox + math.cos(a0) * 6, cy + math.sin(a0) * 4, cx + ox + math.cos(a1) * 6, cy + math.sin(a1) * 4, '#5a3a9a')
        T[f'hex{v}'] = a
    floors = dict(base=[f'met{v}' for v in range(8)], alt=[f'hex{v}' for v in range(3)])
    W = []
    for v in range(3):
        a = new(TW, 64); pal(a, ['#0a0812', '#120e1e', '#1a162a', '#241e38', '#2e2846'], 0.3 + fbm(TW, 64, 750 + v) * 0.5)
        line(a, 0, 20, TW, 20, '#08060e'); line(a, 0, 44, TW, 44, '#08060e')
        for x in (0, 24): line(a, x, 0, x, 63, '#08060e')
        col = ['#2ac8a0', '#7a3ac0', '#2a9ae0'][v]
        for y in (10, 32, 54): line(a, 4, y, 20, y, col); put(a, 20, y, '#ffffff')
        if v == 1:   # 나선 무늬 창
            for y in range(4, 60):
                put(a, 36 + 5 * math.sin(y * 0.35), y, '#3cffae'); put(a, 36 - 5 * math.sin(y * 0.35), y, '#d050ff')
        a[-4:, :, :3] *= 0.7
        W.append(a)
    top = new(TW, 14); pal(top, ['#06040c', '#0c0a16', '#141020', '#1c162c'], 0.3 + fbm(TW, 14, 760) * 0.5)
    def glyph(a):
        for k in range(6):
            ang = k * math.pi / 3; put(a, 24 + math.cos(ang) * 8, 15 + math.sin(ang) * 5, '#3cffae')
        put(a, 24, 15, '#e0fff4')
    def shard(a):
        r = rng(3)
        for k in range(6): x, y = r.integers(10, 38), r.integers(6, 24); line(a, x, y, x + 2, y - 3, '#c8a8ff'); put(a, x + 2, y - 3, '#ffffff')
    def burn(a): blob(a, 24, 15, 10, 5, '#1a0a2a', 180, 4); blob(a, 24, 15, 4, 2, '#5a2a9a', 200, 5)
    def data(a):
        for k, y in enumerate((9, 14, 19)): line(a, 10 + k * 3, y, 36 - k * 2, y, '#2a9ae0'); put(a, 36 - k * 2, y, '#a0e0ff')
    return dict(tiles=T, floors=floors, walls=W, top=top, cliff=cliff(['#04020a', '#08061a', '#100c26', '#1a1434'], 13), void='#05030a', decals=decal_set([glyph, shard, burn, data]))

# ------------------------------------------------------------------ 시트로 저장
if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True); meta = {}
    for name, fn in AREAS.items():
        d = fn()
        tiles = d['tiles']; keys = list(tiles)
        # 시트 배치: 1행 = 바닥 타일들, 2행 = 장식, 3행 = 물(있으면), 벽은 별도 줄
        n = max(len(keys), len(d['decals']), 4)
        Wd = n * TW; H = TH * 3 + 64 + 14 + 28
        sh = np.zeros((H, Wd, 4))
        for i, k in enumerate(keys): sh[0:TH, i * TW:(i + 1) * TW] = tiles[k]
        for i, a in enumerate(d['decals']): sh[TH:2 * TH, i * TW:(i + 1) * TW] = a
        for i, a in enumerate(d.get('water', [])): sh[2 * TH:3 * TH, i * TW:(i + 1) * TW] = a
        y = 3 * TH
        for i, a in enumerate(d['walls']): sh[y:y + 64, i * TW:(i + 1) * TW] = a
        sh[y + 64:y + 78, 0:TW] = d['top']
        sh[y + 78:y + 106, 0:TW] = d['cliff']
        save(sh).save(os.path.join(OUT, f'tiles_{name}.webp'), 'WEBP', lossless=True, method=6)
        meta[name] = dict(file=f'tiles_{name}.webp', tw=TW, th=TH, tiles=keys, floors=d['floors'], decals=len(d['decals']), water=len(d.get('water', [])),
                          walls=len(d['walls']), wallY=3 * TH, wallH=64, topY=3 * TH + 64, topH=14, cliffY=3 * TH + 78, cliffH=28, void=d['void'])
        print(name, sh.shape)
    json.dump(meta, open(os.path.join(OUT, 'tiles.json'), 'w'), ensure_ascii=False, indent=1)
