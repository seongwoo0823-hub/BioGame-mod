# 몬스터 공격·죽음 효과 (2D 도트)
#   python3 fx.py [출력폴더]
import sys, os, math, json, random
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../helix-hero'))
from fx import Canvas, strip, hx

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '../../games/helix/assets/mobs/')
P = [hx(c) for c in ('#2a0a3a', '#561a7a', '#8a34b8', '#c070ff', '#e8b8ff', '#ffffff')]     # 보라(바이러스·암)
Y = [hx(c) for c in ('#2a3a06', '#4e700e', '#7ab01e', '#a8ff3a', '#e0ffa0', '#ffffff')]     # 연두(포자)
R = [hx(c) for c in ('#3a060c', '#7a101c', '#c0202e', '#ff4a4a', '#ffb0a0', '#ffffff')]     # 빨강(피)

def dither(c, k):
    """k(1=그대로 → 0=사라짐)만큼 픽셀을 고르게 지움"""
    if k >= 1: return
    import numpy as np
    yy, xx = np.mgrid[0:c.h, 0:c.w]
    bayer = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0
    c.a[bayer[yy % 4, xx % 4] >= k, 3] = 0

def spore():
    fr = []
    for f in range(4):
        c = Canvas(28, 28); cx = cy = 14
        c.disc(cx, cy, 6.5, Y, 0.95)
        for k in range(6):
            a = k * math.pi / 3 + f * 0.5
            c.disc(cx + math.cos(a) * 7.5, cy + math.sin(a) * 7.5, 1.6, Y, 0.8)
        c.put(cx - 2, cy - 2, hx('#ffffff'), 2); c.outline((10, 20, 4))
        fr.append(c.img())
    return strip(fr)

def puff():
    fr = []; rnd = random.Random(2)
    blobs = [(rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(0.5, 1)) for _ in range(12)]
    for f in range(8):
        c = Canvas(96, 96); t = f / 7; fade = 1 if f < 4 else (8 - f) / 4
        for x, y, s in blobs:
            r = (6 + 10 * s) * (0.4 + 0.8 * t)
            c.disc(48 + x * 30 * (0.3 + t), 52 + y * 22 * (0.3 + t) - 10 * t, r, Y, 0.7 * fade)
        for k in range(16):
            a = rnd.uniform(0, 6.28); d = rnd.uniform(5, 40) * (0.3 + t)
            c.ramp(48 + math.cos(a) * d, 50 + math.sin(a) * d * 0.7 - 12 * t, Y, 0.95 * fade)
        dither(c, fade + 0.15); fr.append(c.img())
    return strip(fr)

def inject():
    fr = []; rnd = random.Random(8)
    drops = [(rnd.uniform(0, 6.28), rnd.uniform(0.4, 1)) for _ in range(12)]
    for f in range(8):
        c = Canvas(112, 56); cx, cy = 56, 34; t = f / 7; fade = 1 if f < 5 else (8 - f) / 3
        r = 6 + 34 * (1 - (1 - t) ** 2)
        c.disc(cx, cy, r, P, 0.55 * fade, 0.45)
        c.ellipse_ring(cx, cy, r, r * 0.45, P, 0.9 * fade, 1.5)
        # 나선 무늬(유전자 주입)
        for k in range(30):
            a = k * 0.42 + f * 0.6; rr = k / 30 * r * 0.8
            c.ramp(cx + math.cos(a) * rr, cy + math.sin(a) * rr * 0.45, P, 0.95 * fade)
        for a, s in drops:
            h = math.sin(min(1, t * 1.5) * math.pi) * 14 * s
            c.disc(cx + math.cos(a) * r * s, cy + math.sin(a) * r * s * 0.45 - h, 1.6, P, 0.9 * fade)
        dither(c, fade + 0.15); fr.append(c.img())
    return strip(fr)

def slam():
    fr = []; rnd = random.Random(4)
    rocks = [(rnd.uniform(0, 6.28), rnd.uniform(0.3, 1.0), rnd.uniform(0.5, 1.3)) for _ in range(18)]
    for f in range(10):
        c = Canvas(208, 104); cx, cy = 104, 66; t = f / 9; fade = 1 if f < 5 else (10 - f) / 5
        r = 10 + 88 * (1 - (1 - t) ** 2.2)
        c.ellipse_ring(cx, cy, r, r * 0.42, P, 0.95 * fade, 3.5 * (1 - t) + 1)
        for k in range(8):
            a = k * 0.8 + 0.3; L = min(r * 0.85, 70); px, py = cx, cy
            for j in range(6):
                nx = cx + math.cos(a + math.sin(j * 1.7 + k) * 0.3) * L * (j + 1) / 6
                ny = cy + math.sin(a + math.sin(j * 1.7 + k) * 0.3) * L * 0.42 * (j + 1) / 6
                c.line(px, py, nx, ny, P, 0.9 * fade * (1 - j / 7), w=1 if j > 2 else 2); px, py = nx, ny
        if f < 4: c.disc(cx, cy - 6, 22 - f * 4, P, 1.0, 0.7)
        for a, sp, up in rocks:
            d = r * sp; h = math.sin(min(1, t * 1.3) * math.pi) * 32 * up
            x = cx + math.cos(a) * d; y = cy + math.sin(a) * d * 0.42 - h
            c.disc(x, y, 1.8, [hx('#2a1a24'), hx('#4a2e3e'), hx('#6e4a5e'), hx('#94708a'), hx('#b89ab0'), hx('#d8c0d0')], 0.8 * fade)
        dither(c, fade + 0.15); fr.append(c.img())
    return strip(fr)

def burst(PAL):
    fr = []; rnd = random.Random(6)
    gl = [(rnd.uniform(0, 6.28), rnd.uniform(0.3, 1.0), rnd.uniform(0.6, 1.4)) for _ in range(20)]
    for f in range(8):
        c = Canvas(112, 96); cx, cy = 56, 64; t = f / 7; fade = 1 if f < 4 else (8 - f) / 4
        if f < 3: c.disc(cx, cy - 10, 14 - f * 3, PAL, 1.0, 1.0)
        for a, s, up in gl:
            d = 40 * s * (0.2 + t); h = math.sin(min(1, t * 1.2) * math.pi) * 26 * up
            c.disc(cx + math.cos(a) * d, cy + math.sin(a) * d * 0.5 - h - 6, 2.6 * (1 - t * 0.5), PAL, 0.9 * fade)
        c.disc(cx, cy, 10 + 26 * t, PAL, 0.45 * fade, 0.4)
        dither(c, fade + 0.1); fr.append(c.img())
    return strip(fr)

FXLIST = [('fx_spore', spore, '포자탄', 4), ('fx_puff', puff, '포자 구름', 8), ('fx_inject', inject, '유전자 주입 자국', 8),
          ('fx_slam', slam, '암세포 내려치기 충격', 10), ('fx_burst_p', lambda: burst(P), '죽음 파열(보라)', 8),
          ('fx_burst_y', lambda: burst(Y), '죽음 파열(연두)', 8), ('fx_burst_r', lambda: burst(R), '죽음 파열(빨강)', 8)]

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True); meta = []
    for nm, fn, label, n in FXLIST:
        im = fn(); im.save(os.path.join(OUT, nm + '.webp'), 'WEBP', lossless=True, method=6)
        meta.append(dict(id=nm, name=label, frames=n, w=im.width // n, h=im.height, file=nm + '.webp')); print(nm, im.size)
    json.dump(meta, open(os.path.join(OUT, 'fx.json'), 'w'), ensure_ascii=False, indent=1)
