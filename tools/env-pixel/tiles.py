# 장별 도트 바닥·벽 타일 (이음매 없는 반복)
import numpy as np, math, colorsys
from PIL import Image
def hx(h): h = h.lstrip('#'); return np.array([int(h[i:i+2], 16) for i in (0, 2, 4)], np.float32)
def ramp(c, n=6, hs=0.04):
    r, g, b = hx(c) / 255; h, l, s = colorsys.rgb_to_hls(r, g, b); out = []
    for k in range(n):
        t = k / (n - 1); ll = 0.08 + t * 0.8 * (l / 0.45 if l < 0.45 else 1) * 0.9; ll = min(0.9, 0.06 + (l * 1.6) * t + 0.02)
        hh = (h + hs * (0.5 - t)) % 1; ss = min(1, s * (1.15 - 0.3 * t))
        out.append(np.array(colorsys.hls_to_rgb(hh, ll, ss)) * 255)
    return np.array(out)
def vnoise(S, cell, seed):
    rng = np.random.default_rng(seed); k = max(1, S // cell); g = rng.random((k, k)).astype(np.float32)
    g = np.tile(g, (3, 3)); from PIL import Image as I
    big = np.array(I.fromarray((g * 255).astype(np.uint8)).resize((S * 3, S * 3), I.BICUBIC)).astype(np.float32) / 255
    return big[S:2 * S, S:2 * S]
def voronoi(S, n, seed, jitter=1.0):
    rng = np.random.default_rng(seed); pts = rng.random((n, 2)) * S
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float32)
    d1 = np.full((S, S), 1e9, np.float32); d2 = np.full((S, S), 1e9, np.float32); idx = np.zeros((S, S), np.int32)
    for i, (px, py) in enumerate(pts):
        for ox in (-S, 0, S):
            for oy in (-S, 0, S):
                d = np.hypot(xx - px - ox, yy - py - oy)
                closer = d < d1; d2 = np.where(closer, d1, np.minimum(d2, d)); idx = np.where(closer, i, idx); d1 = np.where(closer, d, d1)
    return d1, d2, idx, pts
BAYER = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0
def quant(val, R):
    """0~1 값을 팔레트 단계로 (규칙 디더)"""
    S = val.shape[0]; b = np.tile(BAYER, (S // 4 + 1, S // 4 + 1))[:S, :S]
    k = np.clip(np.floor(val * (len(R) - 1) + b * 0.9), 0, len(R) - 1).astype(int)
    return R[k]

def stone_floor(S, seed, base, grout, n, bevel=2.2, accent=None, accent_k=0.0, crack=0.0, moss=None, moss_k=0.0, glowline=None):
    d1, d2, idx, pts = voronoi(S, n, seed)
    edge = d2 - d1
    rng = np.random.default_rng(seed + 1); tone = rng.random(n) * 0.35 - 0.12
    R = ramp(base, 7); G = ramp(grout, 4)
    # 돌 높이: 가장자리로 갈수록 낮음 → 왼쪽 위 빛
    gy, gx = np.gradient(np.minimum(edge, 6.0))
    light = np.clip(0.55 + tone[idx] + (-gx - gy) * 0.22 + (vnoise(S, 16, seed + 2) - 0.5) * 0.25 + (vnoise(S, 4, seed + 3) - 0.5) * 0.16, 0, 1)
    img = quant(light, R)
    groutm = edge < bevel
    gl = np.clip(0.4 + (vnoise(S, 8, seed + 4) - 0.5) * 0.5, 0, 1); img[groutm] = quant(gl, G)[groutm]
    # 테두리 강조(위·왼쪽 밝은 선)
    hi = (edge >= bevel) & (edge < bevel + 1.2) & ((-gx - gy) > 0.15); img[hi] = R[-2]
    if crack > 0:
        cr = (np.abs(vnoise(S, 24, seed + 5) - 0.5) < 0.012 * crack * 2) & ~groutm; img[cr] = G[0]
    if accent is not None:
        A = ramp(accent, 5); sel = rng.random(n) < accent_k
        m = sel[idx] & ~groutm; img[m] = quant(np.clip(light * 0.9 + 0.1, 0, 1), A)[m]
    if moss is not None:
        mm = (vnoise(S, 48, seed + 6) * 0.7 + vnoise(S, 6, seed + 7) * 0.3) > (1 - moss_k); Mr = ramp(moss, 4)
        mm &= (edge < bevel + 3); img[mm] = quant(vnoise(S, 3, seed + 8), Mr)[mm]
    if glowline is not None:
        ln = np.abs(vnoise(S, 40, seed + 9) - 0.5) < 0.01; ln |= np.abs(vnoise(S, 28, seed + 10) - 0.5) < 0.007
        img[ln & groutm] = hx(glowline); img[ln & ~groutm & (vnoise(S, 2, seed + 11) > 0.7)] = hx(glowline) * 0.7
    return img.astype(np.uint8)

def wall_tex(W, H, seed, base, mortar, rows=5, organic=False, vein=None):
    img = np.zeros((H, W, 3), np.float32); R = ramp(base, 7); Mo = ramp(mortar, 4); rng = np.random.default_rng(seed)
    rh = H / rows
    for r in range(rows):
        y0 = int(r * rh); y1 = int((r + 1) * rh); x = -int(rng.integers(0, W // 2)) if r % 2 else 0
        while x < W:
            bw = int(rng.integers(W // 3, W // 2 + 4)); tone = rng.random() * 0.3 - 0.1
            for yy in range(y0, y1):
                for xx in range(max(0, x), min(W, x + bw)):
                    ex = min(xx - x, x + bw - 1 - xx); ey = min(yy - y0, y1 - 1 - yy)
                    if ex < 1 or ey < 1: img[yy, xx] = Mo[1]; continue
                    v = 0.5 + tone + (0.18 if ey == 1 or ex == 1 and xx - x < 3 else 0) - (0.2 if yy == y1 - 2 or x + bw - 2 == xx else 0) + (rng.random() - 0.5) * 0.12
                    img[yy, xx] = R[int(np.clip(round(v * 6), 0, 6))]
            x += bw
    if organic:
        n = vnoise(W, 8, seed)[:H % W or W, :] if H <= W else None
    if vein is not None:
        for k in range(1):
            x = rng.integers(0, W); 
            for yy in range(H):
                x = (x + rng.integers(-1, 2)) % W; img[yy, x] = img[yy, x] * 0.4 + hx(vein) * 0.6
    return img.astype(np.uint8)

CH = [
    dict(name='세포 폐허', floor=dict(base='#6a7a5e', grout='#1e2a1c', n=70, accent='#7a9a5a', accent_k=0.18, moss='#7ad05a', moss_k=0.22), wall=dict(base='#6e6a58', mortar='#22261c', vein='#5aa04a')),
    dict(name='미생물 협곡', floor=dict(base='#7a4c38', grout='#24140e', n=55, accent='#8a6a3a', accent_k=0.2, moss='#a8c84a', moss_k=0.16), wall=dict(base='#7a4a36', mortar='#2a160e', vein='#a8c84a')),
    dict(name='발열 지대', floor=dict(base='#a08654', grout='#3a2614', n=90, accent='#c88a4a', accent_k=0.15, moss='#ff7a3a', moss_k=0.08), wall=dict(base='#9a7e52', mortar='#3a2814', vein='#ff6a2a')),
    dict(name='신경 숲', floor=dict(base='#3a5478', grout='#0c1424', n=60, accent='#4a6a9a', accent_k=0.2, glowline='#5ae8ff'), wall=dict(base='#405a86', mortar='#0e1628', vein='#5ae8ff')),
    dict(name='생명의 기원', floor=dict(base='#5e4272', grout='#1a0e22', n=75, accent='#8a5a9a', accent_k=0.2, moss='#ff7ad8', moss_k=0.1), wall=dict(base='#6a4a7e', mortar='#1e1028', vein='#ff7ad8')),
]
if __name__ == '__main__':
    import sys
    OUT = sys.argv[1]
    for i, c in enumerate(CH):
        f = stone_floor(384, 11 + i * 7, **c['floor'])
        Image.fromarray(f).save(OUT + f'floor_c{i + 1}.webp', 'WEBP', lossless=True)
        w = wall_tex(64, 96, 5 + i, **c['wall'])
        Image.fromarray(w).save(OUT + f'wall_c{i + 1}.webp', 'WEBP', lossless=True)
        print(c['name'])
