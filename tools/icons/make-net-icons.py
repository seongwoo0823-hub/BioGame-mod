# 교실 서버용 설치 아이콘 만들기: 파란 기본 아이콘에서 색만 바꾸고 배지를 붙임
#   랜선(유선) = 초록 + 네트워크 배지 → icons/*-lan-*
#   와이파이   = 빨강 + 와이파이 배지 → icons/*-wifi-*
# 실행: python3 tools/icons/make-net-icons.py
import os, numpy as np
from PIL import Image, ImageDraw
ROOT = os.path.join(os.path.dirname(__file__), '..', '..', 'icons')

def hue_shift(im, deg, sat=1.0):
    rgba = im.convert('RGBA'); a = np.array(rgba)[..., 3]
    hsv = np.array(rgba.convert('RGB').convert('HSV')).astype(np.int32)
    hsv[..., 0] = (hsv[..., 0] + int(round(deg / 360 * 256))) % 256
    hsv[..., 1] = np.clip(hsv[..., 1] * sat, 0, 255)
    out = Image.fromarray(hsv.astype(np.uint8), 'HSV').convert('RGB').convert('RGBA')
    out.putalpha(Image.fromarray(a)); return out

def badge(size, kind, col):
    S = size * 4; im = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.ellipse((0, 0, S - 1, S - 1), fill=(255, 255, 255, 255))
    b = int(S * 0.06); d.ellipse((b, b, S - 1 - b, S - 1 - b), fill=col)
    W = (255, 255, 255, 255); c = S / 2
    if kind == 'wifi':
        lw = int(S * 0.075)
        for r in (0.36, 0.25, 0.14):
            R = S * r; d.arc((c - R, c - R + S * 0.1, c + R, c + R + S * 0.1), 225, 315, fill=W, width=lw)
        R = S * 0.055; d.ellipse((c - R, c + S * 0.2 - R, c + R, c + S * 0.2 + R), fill=W)
    else:  # 랜선: 네트워크(위 1개 → 아래 3개) 모양
        u = S * 0.085; lw = int(S * 0.05)
        d.rounded_rectangle((c - u * 1.3, S * 0.22, c + u * 1.3, S * 0.22 + u * 2.0), radius=u * 0.35, fill=W)
        y1 = S * 0.22 + u * 2.0; ym = S * 0.53; yb = S * 0.6
        d.line((c, y1, c, ym), fill=W, width=lw)
        d.line((c - u * 3.2, ym, c + u * 3.2, ym), fill=W, width=lw)
        for x in (c - u * 3.2, c, c + u * 3.2):
            d.line((x, ym, x, yb), fill=W, width=lw)
            d.rounded_rectangle((x - u * 1.05, yb, x + u * 1.05, yb + u * 1.7), radius=u * 0.3, fill=W)
    return im.resize((size, size), Image.LANCZOS)

def make(src, dst, deg, sat, kind, col, out_size=None, pos=(0.78, 0.22), bsize=0.30, mode=None):
    base = Image.open(os.path.join(ROOT, src))
    work = base.resize((1024, 1024), Image.LANCZOS) if base.size[0] < 1024 else base
    im = hue_shift(work, deg, sat)
    W = im.size[0]; bs = int(W * bsize); bg = badge(bs, kind, col)
    im.alpha_composite(bg, (int(W * pos[0] - bs / 2), int(W * pos[1] - bs / 2)))
    im = im.resize((out_size or base.size[0],) * 2, Image.LANCZOS)
    if base.mode == 'RGB': im = im.convert('RGB')
    im.save(os.path.join(ROOT, dst), optimize=True); print('saved', dst, im.size)

SETS = {'lan': (-105, 1.05, 'lan', (22, 163, 74, 255)), 'wifi': (135, 1.1, 'wifi', (220, 38, 38, 255))}
for tag, (deg, sat, kind, col) in SETS.items():
    make('icon-v2-512.png', f'icon-{tag}-512.png', deg, sat, kind, col)
    make('icon-v2-512.png', f'icon-{tag}-192.png', deg, sat, kind, col, out_size=192)
    make('icon-v2-maskable-512.png', f'icon-{tag}-maskable-512.png', deg, sat, kind, col, pos=(0.68, 0.32), bsize=0.24)
    make('apple-touch-icon-v2.png', f'apple-touch-icon-{tag}.png', deg, sat, kind, col)
    make('icon-v2-512.png', f'favicon-{tag}-32.png', deg, sat, kind, col, out_size=32, pos=(0.74, 0.26), bsize=0.46)
