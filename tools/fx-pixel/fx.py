# 도트 이펙트 플립북 (원소별)
import numpy as np, math, json, sys
from PIL import Image
def hx(h): h = h.lstrip('#'); return np.array([int(h[i:i+2], 16) for i in (0, 2, 4)], np.uint8)
PAL = dict(phys=['#4a3e32', '#a89a80', '#e8e0d0', '#ffffff'], fire=['#6a1a08', '#d04a10', '#ff9a2a', '#fff0a0'], cold=['#0a3a6a', '#2a8ad8', '#8ad8ff', '#ffffff'],
           ltng=['#5a4a0a', '#d8c020', '#fff07a', '#ffffff'], pois=['#1a4a0a', '#3aa81a', '#8aff4a', '#e8ffc0'], mag=['#3a1a6a', '#8a4ad8', '#d0a0ff', '#ffffff'], holy=['#6a5a10', '#d8b83a', '#ffe88a', '#ffffff'],
           smoke=['#1a161a', '#3a343a', '#6a626a', '#9a929a'])
class Canvas:
    def __init__(s, W, H): s.W, s.H = W, H; s.v = np.zeros((H, W), np.float32)   # 밝기 0~4
    def dot(s, x, y, v, r=0):
        x, y = int(round(x)), int(round(y))
        for dy in range(-r, r + 1):
            for dx in range(-r, r + 1):
                if dx * dx + dy * dy <= r * r + r and 0 <= x + dx < s.W and 0 <= y + dy < s.H: s.v[y + dy, x + dx] = max(s.v[y + dy, x + dx], v)
    def line(s, x0, y0, x1, y1, v, r=0):
        n = int(max(abs(x1 - x0), abs(y1 - y0)) + 1)
        for k in range(n + 1): t = k / max(1, n); s.dot(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, v, r)
    def disc(s, cx, cy, R, v0, v1):
        yy, xx = np.mgrid[0:s.H, 0:s.W]; d = np.hypot(xx - cx, yy - cy) / max(R, 1e-3); m = d <= 1
        s.v[m] = np.maximum(s.v[m], (v1 + (v0 - v1) * d[m]))
    def img(s, pal):
        P = [hx(c) for c in pal]; out = np.zeros((s.H, s.W, 4), np.uint8); q = np.clip(np.round(s.v), 0, 4).astype(int)
        for k in range(1, 5): m = q == k; out[m, :3] = P[k - 1]; out[m, 3] = 255
        # 1px 어두운 외곽 (가장 어두운 색)
        a = out[..., 3] > 0; ring = np.zeros_like(a)
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)): ring |= np.roll(np.roll(a, dy, 0), dx, 1) & ~a
        out[ring, :3] = (P[0] * 0.6).astype(np.uint8); out[ring, 3] = 200
        return Image.fromarray(out)
def impact(el, f, n=8, S=64, seed=1):
    rng = np.random.default_rng(seed); t = f / (n - 1); C = Canvas(S, S); c = S / 2
    core = 13 * (1 - t) ** 1.6
    if core > 1: C.disc(c, c, core, 2.2, 4.2)
    R = 5 + 24 * (1 - (1 - t) ** 2)
    for k in range(14):
        a = k / 14 * 2 * math.pi + rng.uniform(-0.2, 0.2); r0 = R * rng.uniform(0.6, 1.0); v = 3.6 * (1 - t) + 0.8
        x, y = c + math.cos(a) * r0, c + math.sin(a) * r0 * 0.8
        if el == 'fire': C.line(x, y, x + math.cos(a) * 2, y - 4 - 6 * (1 - t), v, 1 if t < 0.5 else 0)
        elif el == 'cold':
            for d in range(3): C.dot(x + math.cos(a) * d * 2, y + math.sin(a) * d * 2, v - d * 0.6, 1 if d == 0 and t < 0.6 else 0)
        elif el == 'ltng':
            px, py = c, c
            for j in range(4): nx = c + math.cos(a) * r0 * (j + 1) / 4 + rng.uniform(-3, 3); ny = c + math.sin(a) * r0 * 0.8 * (j + 1) / 4 + rng.uniform(-3, 3); C.line(px, py, nx, ny, v); px, py = nx, ny
        elif el == 'pois': C.dot(x, y + 6 * t, v, 1 + (k % 2) * (t < 0.6))
        elif el in ('mag', 'holy'): C.dot(x, y, v); C.dot(x + 1, y, v - 1); C.dot(x - 1, y, v - 1); C.dot(x, y + 1, v - 1); C.dot(x, y - 1, v - 1)
        else: C.dot(x, y + 4 * t * t, v * 0.8, 1 if k % 3 == 0 else 0)
    if t > 0.15 and t < 0.85:
        for k in range(32): a = k / 32 * 2 * math.pi; C.dot(c + math.cos(a) * R, c + math.sin(a) * R * 0.8, 1.6 * (1 - t) + 0.6)
    return C.img(PAL[el])
def projectile(style, f, n=4, W=64, H=32):
    C = Canvas(W, H); cy = H / 2; ph = f / n * 2 * math.pi; hx_ = W * 0.72
    el = dict(fireball='fire', icebolt='cold', spark='ltng', spit='pois', bolt='mag', needle='phys', flask='pois', bladewave='cold', spore='pois', spear='phys', arrow='phys', fire='fire').get(style, 'mag')
    if style in ('fireball', 'fire'):
        for k in range(12): t = k / 11; C.dot(hx_ - t * 34, cy + math.sin(ph * 2 + t * 9) * 3 * t, 4 - t * 3, int(5 * (1 - t)) // 2 + (1 if t < 0.3 else 0))
        C.disc(hx_, cy, 7, 3, 4.2)
    elif style == 'icebolt':
        C.line(hx_ - 26, cy, hx_ + 6, cy, 3, 1); C.line(hx_, cy - 5, hx_ + 9, cy, 4); C.line(hx_, cy + 5, hx_ + 9, cy, 4)
        for k in range(5): C.dot(hx_ - 10 - k * 6, cy + math.sin(ph + k) * 4, 2.5 - k * 0.3)
    elif style == 'spark':
        rng = np.random.default_rng(f + 3); C.disc(hx_, cy, 5, 3.4, 4.2)
        for k in range(5):
            a = rng.uniform(0, 2 * math.pi); px, py = hx_, cy
            for j in range(3): nx, ny = px + math.cos(a) * 4 + rng.uniform(-2, 2), py + math.sin(a) * 4 + rng.uniform(-2, 2); C.line(px, py, nx, ny, 3.2); px, py = nx, ny
    elif style in ('spit', 'spore'):
        C.disc(hx_, cy, 6, 2.4, 3.8)
        for k in range(6): C.dot(hx_ - 8 - k * 5, cy + math.sin(ph + k * 1.4) * 3, 3 - k * 0.4, 1 if k < 2 else 0)
        if style == 'spore':
            for k in range(8): a = k / 8 * 2 * math.pi + ph; C.dot(hx_ + math.cos(a) * 8, cy + math.sin(a) * 8, 2.4)
    elif style == 'flask':
        a = ph; dx, dy = math.cos(a), math.sin(a)
        C.disc(hx_, cy, 5, 2.2, 3.6); C.line(hx_ + dx * 5, cy + dy * 5, hx_ + dx * 10, cy + dy * 10, 3, 1)
        for k in range(4): C.dot(hx_ - 10 - k * 6, cy + (k % 2) * 2, 2 - k * 0.3)
    elif style == 'bladewave':
        for k in range(16): a = -1.2 + k / 15 * 2.4; C.dot(hx_ + math.cos(a) * 9, cy + math.sin(a) * 13, 4 - abs(a) * 0.9, 1)
        for k in range(10): a = -1.0 + k / 9 * 2.0; C.dot(hx_ - 6 + math.cos(a) * 7, cy + math.sin(a) * 10, 2.2)
    elif style in ('needle', 'spear', 'arrow'):
        L = 34 if style == 'spear' else 26; C.line(hx_ - L, cy, hx_ + 6, cy, 3, 0 if style != 'spear' else 1); C.line(hx_ + 2, cy - 3, hx_ + 8, cy, 4); C.line(hx_ + 2, cy + 3, hx_ + 8, cy, 4)
        if style == 'arrow': C.line(hx_ - L, cy - 3, hx_ - L + 5, cy, 2); C.line(hx_ - L, cy + 3, hx_ - L + 5, cy, 2)
    else:  # bolt
        C.disc(hx_, cy, 6, 2.6, 4.2)
        for k in range(8): C.dot(hx_ - 6 - k * 4, cy + math.sin(ph + k) * 2, 3 - k * 0.3)
        for k in range(4): a = ph + k * 1.57; C.dot(hx_ + math.cos(a) * 9, cy + math.sin(a) * 9, 3)
    return C.img(PAL[el])
def slash(f, n=6, S=96):
    C = Canvas(S, S); c = S / 2; t = f / (n - 1); a0 = -1.4; a1 = a0 + 2.8 * min(1, t * 1.6)
    for k in range(60):
        u = k / 59; a = a0 + (a1 - a0) * u
        if a > a1: break
        fade = 1 - max(0, t - 0.55) / 0.45; w = (1 - abs(u - 0.75) * 1.4) * fade
        if w <= 0: continue
        for r in range(3): C.dot(c + math.cos(a) * (36 - r * 2.5), c + math.sin(a) * (36 - r * 2.5), (4.2 - r * 1.1) * w + 0.4 * (r == 0), 1 if r == 0 else 0)
    return C.img(PAL['phys'])
def beam(f, n=8, W=48, H=112, el='holy'):
    C = Canvas(W, H); t = f / (n - 1); c = W / 2
    w = 14 * math.sin(math.pi * min(1, t * 1.2))
    for y in range(H):
        ww = w * (0.6 + 0.4 * math.sin(y * 0.2 + t * 8))
        for x in range(int(c - ww), int(c + ww) + 1): C.v[y, max(0, min(W - 1, x))] = max(C.v[y, max(0, min(W - 1, x))], 4.2 - abs(x - c) / max(ww, 1) * 3)
    rng = np.random.default_rng(f)
    for k in range(10): C.dot(c + rng.uniform(-16, 16), H - 1 - ((t * 120 + k * 11) % H), 3)
    return C.img(PAL[el])
def puff(f, n=8, S=64):
    C = Canvas(S, S); t = f / (n - 1); rng = np.random.default_rng(9)
    for k in range(9):
        a = k / 9 * 2 * math.pi; r = 4 + 18 * t; C.disc(S / 2 + math.cos(a) * r, S / 2 + 8 - math.sin(a) * r * 0.6 - 10 * t, 7 * (1 - t) + 2, 3.2 - 2 * t, 3.6 - 2 * t)
    return C.img(PAL['smoke'])
if __name__ == '__main__':
    OUT = sys.argv[1]; items = []
    for el in ['phys', 'fire', 'cold', 'ltng', 'pois', 'mag', 'holy']: items.append(('hit_' + el, [impact(el, f, seed=hash(el) % 100) for f in range(8)]))
    for st in ['bolt', 'fireball', 'icebolt', 'spark', 'spit', 'needle', 'flask', 'bladewave', 'spore', 'spear', 'arrow']: items.append(('pj_' + st, [projectile(st, f) for f in range(4)]))
    items.append(('slash', [slash(f) for f in range(6)])); items.append(('beam', [beam(f) for f in range(8)])); items.append(('puff', [puff(f) for f in range(8)]))
    W = 1024; x = y = rowh = 0; meta = {}; place = []
    for nm, fr in items:
        w = fr[0].width * len(fr); h = fr[0].height
        if x + w > W: x = 0; y += rowh; rowh = 0
        place.append((x, y, fr)); meta[nm] = [x, y, fr[0].width, fr[0].height, len(fr)]; x += w; rowh = max(rowh, h)
    sh = Image.new('RGBA', (W, y + rowh), (0, 0, 0, 0))
    for x, y, fr in place:
        for k, im in enumerate(fr): sh.alpha_composite(im, (x + k * im.width, y))
    sh.save(OUT + 'fx8.webp', 'WEBP', lossless=True, method=6); json.dump(meta, open(OUT + 'fx8.json', 'w'), separators=(',', ':')); print(sh.size)
