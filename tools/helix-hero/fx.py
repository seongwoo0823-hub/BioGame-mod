# 주인공 전용 효과 스프라이트 (2D 도트로 직접 그림)
#   python3 fx.py [출력폴더]
import sys, os, math, json, random
import numpy as np
from PIL import Image

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '../../games/helix/assets/hero/')
def hx(h): h = h.lstrip('#'); return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))
# 초록·청록 발광 단계 (어두움 → 밝음)
G = [hx(c) for c in ('#063a2c', '#0b6e4e', '#13a874', '#2ee09a', '#8affc8', '#e8fff4')]
B = [hx(c) for c in ('#062c46', '#0a5a86', '#1490c4', '#2ccbf2', '#98ecff', '#f0fcff')]
Y = [hx(c) for c in ('#5a3a06', '#a8700e', '#e8a81e', '#ffd84a', '#fff2a8', '#ffffff')]

class Canvas:
    def __init__(s, w, h): s.w, s.h = w, h; s.a = np.zeros((h, w, 4), np.uint8); s.v = np.full((h, w), -1.0)
    def put(s, x, y, col, lvl=0.0):
        x = int(math.floor(x)); y = int(math.floor(y))
        if 0 <= x < s.w and 0 <= y < s.h and lvl >= s.v[y, x]:
            s.a[y, x, :3] = col; s.a[y, x, 3] = 255; s.v[y, x] = lvl
    def ramp(s, x, y, R, v):
        """v∈[0,1] 밝기 → 단계 색"""
        if v <= 0.02: return
        i = min(len(R) - 1, int(v * (len(R) - 1) + 0.15)); s.put(x, y, R[i], v)
    def disc(s, cx, cy, r, R, v=1.0, sy=1.0, soft=True):
        for y in range(int(cy - r * sy) - 1, int(cy + r * sy) + 2):
            for x in range(int(cx - r) - 1, int(cx + r) + 2):
                d = math.hypot((x + 0.5 - cx) / r, (y + 0.5 - cy) / (r * sy))
                if d <= 1: s.ramp(x, y, R, v * ((1 - d * 0.75) if soft else 1))
    def ellipse_ring(s, cx, cy, rx, ry, R, v, th=1.0, a0=0, a1=2 * math.pi, dash=None):
        n = int(max(rx, ry) * 8) + 16
        for k in range(n):
            a = a0 + (a1 - a0) * k / n
            if dash and int(a / dash) % 2: continue
            for t in np.linspace(-th / 2, th / 2, max(1, int(th * 2))):
                s.ramp(cx + math.cos(a) * (rx + t), cy + math.sin(a) * (ry + t * ry / rx), R, v)
    def line(s, x0, y0, x1, y1, R, v0, v1=None, w=1):
        v1 = v0 if v1 is None else v1; n = int(math.hypot(x1 - x0, y1 - y0) * 2) + 2
        for k in range(n + 1):
            t = k / n; x = x0 + (x1 - x0) * t; y = y0 + (y1 - y0) * t
            for dx in range(-(w // 2), w // 2 + 1):
                for dy in range(-(w // 2), w // 2 + 1):
                    s.ramp(x + dx, y + dy, R, v0 + (v1 - v0) * t)
    def outline(s, col=(6, 14, 16), alpha=255):
        al = s.a[..., 3] > 0; o = np.zeros_like(al)
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)): o |= np.roll(np.roll(al, dy, 0), dx, 1) & ~al
        s.a[o, :3] = col; s.a[o, 3] = alpha
    def img(s): return Image.fromarray(s.a)

def strip(frames):
    w, h = frames[0].size; im = Image.new('RGBA', (w * len(frames), h))
    for i, f in enumerate(frames): im.paste(f, (i * w, 0))
    return im

def glyph_ring(c, cx, cy, rx, ry, rot, R, v):
    """의식 원 안쪽의 유전 부호(A·T·G·C 막대 무늬)"""
    for k in range(24):
        a = rot + k * 2 * math.pi / 24
        L = [2, 4, 3, 5][k % 4]
        x0 = cx + math.cos(a) * rx; y0 = cy + math.sin(a) * ry
        x1 = cx + math.cos(a) * (rx - L); y1 = cy + math.sin(a) * (ry - L * ry / rx)
        c.line(x0, y0, x1, y1, R, v)

# 1) 유전자 의식 바닥 원 (12프레임, 160x80)
def ritual():
    fr = []
    for f in range(12):
        c = Canvas(160, 80); cx, cy = 80, 40
        grow = min(1, (f + 1) / 4); fade = 1 if f < 9 else (12 - f) / 3
        v = 0.95 * fade; rot = f * 0.18
        c.ellipse_ring(cx, cy, 70 * grow, 34 * grow, G, v, 2)
        c.ellipse_ring(cx, cy, 62 * grow, 30 * grow, B, v * 0.8, 1, dash=0.22 if f % 2 else 0.2)
        glyph_ring(c, cx, cy, 58 * grow, 28 * grow, rot, G, v * 0.85)
        c.ellipse_ring(cx, cy, 40 * grow, 19.5 * grow, G, v * 0.9, 1.5)
        # 육각형(벤젠 고리) + 이중나선 교차선
        for k in range(6):
            a0 = -rot * 1.5 + k * math.pi / 3; a1 = a0 + math.pi / 3
            c.line(cx + math.cos(a0) * 34 * grow, cy + math.sin(a0) * 16.5 * grow, cx + math.cos(a1) * 34 * grow, cy + math.sin(a1) * 16.5 * grow, B, v)
        for k in range(3):
            a = rot * 2 + k * math.pi / 3
            c.line(cx + math.cos(a) * 34 * grow, cy + math.sin(a) * 16.5 * grow, cx - math.cos(a) * 34 * grow, cy - math.sin(a) * 16.5 * grow, G, v * 0.55)
        c.disc(cx, cy, 6 * grow, G, v, 0.5)
        rnd = random.Random(f)
        for k in range(10):
            a = rnd.random() * 6.28; r = rnd.random() * 60 * grow
            c.ramp(cx + math.cos(a) * r, cy + math.sin(a) * r * 0.49 - rnd.random() * 6 * f / 12, G, 0.9 * fade)
        fr.append(c.img())
    return strip(fr)

# 2) DNA 빛기둥 (10프레임, 80x160)
def pillar():
    fr = []
    for f in range(10):
        c = Canvas(80, 160); cx = 40; base = 150
        hgt = 140 * min(1, (f + 1) / 4); fade = 1 if f < 7 else (10 - f) / 3
        wid = 14 * (1 if f < 7 else fade)
        for y in range(int(base - hgt), base):
            t = (base - y) / 140
            for x in range(int(cx - wid), int(cx + wid) + 1):
                d = abs(x + 0.5 - cx) / max(1, wid)
                c.ramp(x, y, G, (0.55 - 0.45 * d) * fade * (1 - t * 0.4))
            ph = y * 0.16 - f * 0.9
            for s_, R in ((0, G), (math.pi, B)):
                xx = cx + math.sin(ph + s_) * wid * 0.95; front = math.cos(ph + s_) > 0
                c.ramp(xx, y, R, (0.98 if front else 0.7) * fade)
                c.ramp(xx + 1, y, R, (0.9 if front else 0.6) * fade)
            if int(y) % 6 == 0:
                c.line(cx + math.sin(ph) * wid * 0.95, y, cx + math.sin(ph + math.pi) * wid * 0.95, y, G, 0.8 * fade)
        c.disc(cx, base, 18, G, fade, 0.35)
        rnd = random.Random(f + 50)
        for k in range(14):
            c.ramp(cx + rnd.uniform(-20, 20), base - rnd.random() * hgt, G if k % 2 else B, 0.95 * fade)
        fr.append(c.img())
    return strip(fr)

# 3) 시약 병 (회전 4프레임 32x32) + 4) 시약 폭발 (10프레임 128x80)
def flask_spin():
    fr = []
    for f in range(4):
        c = Canvas(32, 32); a = f * math.pi / 2
        cx, cy = 16, 17
        c.disc(cx, cy, 6, B, 1.0, 1.0)
        nx, ny = math.sin(a) * 7, -math.cos(a) * 7
        c.line(cx + nx * 0.6, cy + ny * 0.6, cx + nx * 1.3, cy + ny * 1.3, B, 0.8, 0.9, w=2)
        c.put(cx + nx * 1.45, cy + ny * 1.45, hx('#5a3a28'), 1)
        c.put(cx - 2, cy - 2, hx('#ffffff'), 1)
        c.outline()
        fr.append(c.img())
    return strip(fr)

def splash():
    fr = []; rnd = random.Random(7)
    drops = [(rnd.uniform(0, 6.28), rnd.uniform(0.5, 1.0), rnd.uniform(0.6, 1.2)) for _ in range(18)]
    for f in range(10):
        c = Canvas(128, 80); cx, cy = 64, 52; t = f / 9; fade = 1 if f < 6 else (10 - f) / 4
        r = 10 + 46 * (1 - (1 - t) ** 2)
        c.disc(cx, cy, r, B, 0.5 * fade, 0.45)
        c.ellipse_ring(cx, cy, r, r * 0.45, B, 0.95 * fade, 2)
        if f < 5: c.disc(cx, cy - 4, 14 * (1 - t * 1.5) + 4, B, 1.0, 0.8, soft=False)
        for a, sp, up in drops:
            d = r * sp; h = math.sin(min(1, t * 1.4) * math.pi) * 22 * up
            x = cx + math.cos(a) * d; y = cy + math.sin(a) * d * 0.45 - h
            c.disc(x, y, 2.2 * (1 - t * 0.6), B, 0.95 * fade)
        # 바닥에 남는 거품
        for k in range(8):
            a = k * 0.8 + 0.3; d = r * 0.6
            if f > 3: c.disc(cx + math.cos(a) * d, cy + math.sin(a) * d * 0.45, 2 + (k % 3), B, 0.75 * fade, 0.6)
        if f < 3:
            for k in range(8):
                a = k * math.pi / 4
                c.line(cx, cy - 4, cx + math.cos(a) * (18 + f * 8), cy - 4 + math.sin(a) * (9 + f * 4), B[3:], 0.95)
        fr.append(c.img())
    return strip(fr)

# 5) 유전자총 탄환 (4프레임 48x24) + 6) 명중 불꽃 (6프레임 48x48)
def bullet():
    fr = []
    for f in range(4):
        c = Canvas(48, 24); cy = 12
        for x in range(4, 40):
            t = (x - 4) / 36
            ph = x * 0.5 - f * 1.4
            c.ramp(x, cy + math.sin(ph) * 3 * t, G, 0.25 + 0.7 * t)
            c.ramp(x, cy - math.sin(ph) * 3 * t, B, 0.25 + 0.7 * t)
        c.disc(41, cy, 4.5, G, 1.0, 0.9)
        c.put(41, cy - 1, hx('#ffffff'), 2)
        fr.append(c.img())
    return strip(fr)

def spark():
    fr = []
    for f in range(6):
        c = Canvas(48, 48); cx = cy = 24; t = f / 5; fade = 1 - t * 0.8
        if f < 3: c.disc(cx, cy, 7 - f * 2, G, 1.0, 1.0, soft=False)
        for k in range(8):
            a = k * math.pi / 4 + (0.39 if k % 2 else 0)
            L0 = 4 + 16 * t; L1 = L0 + (10 if k % 2 == 0 else 6) * (1 - t)
            c.line(cx + math.cos(a) * L0, cy + math.sin(a) * L0, cx + math.cos(a) * L1, cy + math.sin(a) * L1, G if k % 2 else B, 0.98 * fade, 0.5 * fade)
        c.ellipse_ring(cx, cy, 6 + 16 * t, 6 + 16 * t, G, 0.85 * fade, 1)
        fr.append(c.img())
    return strip(fr)

# 7) 도약 강타 충격파 (10프레임 192x96)
def shock():
    fr = []; rnd = random.Random(3)
    shards = [(rnd.uniform(0, 6.28), rnd.uniform(0.3, 1.0), rnd.uniform(0.5, 1.3)) for _ in range(16)]
    for f in range(10):
        c = Canvas(192, 96); cx, cy = 96, 60; t = f / 9; fade = 1 if f < 5 else (10 - f) / 5
        r = 8 + 82 * (1 - (1 - t) ** 2.2)
        c.ellipse_ring(cx, cy, r, r * 0.42, G, 0.95 * fade, 3 * (1 - t) + 1)
        c.ellipse_ring(cx, cy, r * 0.72, r * 0.3, B, 0.8 * fade, 1.5)
        # 바닥 갈라짐
        for k in range(7):
            a = k * 0.9 + 0.2; L = min(r * 0.8, 60)
            px, py = cx, cy
            for j in range(5):
                nx = cx + math.cos(a + math.sin(j * 2.1 + k) * 0.25) * L * (j + 1) / 5
                ny = cy + math.sin(a + math.sin(j * 2.1 + k) * 0.25) * L * 0.42 * (j + 1) / 5
                c.line(px, py, nx, ny, G, 0.9 * fade * (1 - j / 6)); px, py = nx, ny
        if f < 4: c.disc(cx, cy - 6, 18 - f * 3, G, 1.0, 0.7)
        for a, sp, up in shards:
            d = r * sp; h = math.sin(min(1, t * 1.3) * math.pi) * 28 * up
            x = cx + math.cos(a) * d; y = cy + math.sin(a) * d * 0.42 - h
            c.line(x, y, x + 2, y - 3, G if up > 0.9 else B, 0.95 * fade, 0.7 * fade, w=1)
        fr.append(c.img())
    return strip(fr)

# 8) 돌진 잔상 줄기 (6프레임 128x64)
def dash_trail():
    fr = []; rnd = random.Random(11)
    lines = [(rnd.uniform(8, 56), rnd.uniform(20, 60), rnd.uniform(0, 30)) for _ in range(9)]
    for f in range(6):
        c = Canvas(128, 64); fade = 1 - f / 6
        for y, L, x0 in lines:
            x1 = 120 - x0 - f * 10; x2 = x1 - L * (1 - f / 8)
            c.line(x2, y, x1, y, G, 0.25 * fade, 0.95 * fade)
        for k in range(10):
            c.ramp(rnd.uniform(10, 120 - f * 12), rnd.uniform(40, 62), G, 0.9 * fade)
        fr.append(c.img())
    return strip(fr)

# 9) 세포분열 거품 (8프레임 96x96)
def bubbles():
    fr = []; rnd = random.Random(5)
    bs = [(rnd.uniform(-30, 30), rnd.uniform(-10, 40), rnd.uniform(2, 6), rnd.uniform(0.6, 1.4)) for _ in range(14)]
    for f in range(8):
        c = Canvas(96, 96); t = f / 7; fade = 1 if f < 5 else (8 - f) / 3
        for x, y, r, sp in bs:
            cx = 48 + x * (0.6 + t * 0.6); cy = 70 - y - t * 30 * sp; rr = r * (0.6 + 0.6 * t)
            c.ellipse_ring(cx, cy, rr, rr, G, 0.95 * fade, 1)
            c.put(cx - rr * 0.4, cy - rr * 0.4, hx('#e8fff4'), 2)
        # 분열하는 세포 두 개
        d = 4 + 10 * t
        for s_ in (-1, 1):
            c.ellipse_ring(48 + s_ * d, 48, 9, 9, G, 0.9 * fade, 1.5)
            c.disc(48 + s_ * d, 48, 3, G, 0.9 * fade)
        # 사이를 잇는 나선
        for k in range(20):
            x = 48 - d + 2 * d * k / 19
            c.ramp(x, 48 + math.sin(k * 0.9 + f) * 3, B, 0.8 * fade)
        fr.append(c.img())
    return strip(fr)

# 10) 재구성 소용돌이 (10프레임 96x128) — 부활·등장용
def reform():
    fr = []
    for f in range(10):
        c = Canvas(96, 128); t = f / 9; fade = 1 if f < 7 else (10 - f) / 3
        for k in range(120):
            u = k / 120; y = 118 - u * 100 * min(1, t * 1.6 + 0.2)
            a = u * 14 + f * 0.8; r = 22 * (1 - u * 0.5) * (1 - t * 0.5)
            front = math.sin(a) > 0
            c.ramp(48 + math.cos(a) * r, y + math.sin(a) * r * 0.25, G if k % 2 else B, (0.95 if front else 0.55) * fade)
        c.ellipse_ring(48, 118, 26, 9, G, 0.9 * fade, 1.5)
        rnd = random.Random(f + 9)
        for k in range(12):
            c.ramp(48 + rnd.uniform(-24, 24), 118 - rnd.random() * 100, G, 0.95 * fade)
        fr.append(c.img())
    return strip(fr)

FXLIST = [('fx_ritual', ritual, '유전자 의식 바닥 원'), ('fx_pillar', pillar, 'DNA 빛기둥'), ('fx_flask', flask_spin, '시약 병(날아가는 중)'),
          ('fx_splash', splash, '시약 폭발'), ('fx_bullet', bullet, '유전자총 탄환'), ('fx_spark', spark, '명중 불꽃'),
          ('fx_shock', shock, '도약 강타 충격파'), ('fx_dash', dash_trail, '돌진 잔상'), ('fx_bubbles', bubbles, '세포분열 거품'),
          ('fx_reform', reform, '재구성 소용돌이')]

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True); meta = []
    for nm, fn, label in FXLIST:
        im = fn(); h = im.height; n = {'fx_ritual': 12, 'fx_pillar': 10, 'fx_flask': 4, 'fx_splash': 10, 'fx_bullet': 4, 'fx_spark': 6, 'fx_shock': 10, 'fx_dash': 6, 'fx_bubbles': 8, 'fx_reform': 10}[nm]
        im.save(os.path.join(OUT, nm + '.webp'), 'WEBP', lossless=True, method=6)
        meta.append(dict(id=nm, name=label, frames=n, w=im.width // n, h=h, file=nm + '.webp'))
        print(nm, im.size)
    json.dump(meta, open(os.path.join(OUT, 'fx.json'), 'w'), ensure_ascii=False, indent=1)
