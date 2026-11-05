# 도트 그림 도구: 음영 구(球)·타원·다각형·선·외곽선·디더링 그라데이션
import math
import numpy as np
from PIL import Image, ImageDraw

BAYER = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0 + 1 / 32


def hexc(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)] + [255], np.uint8)


def ramp(*cols):
    return [hexc(c) for c in cols]


class Pix:
    def __init__(s, w, h, bg=None):
        s.w, s.h = w, h
        s.a = np.zeros((h, w, 4), np.uint8)
        if bg: s.a[:] = hexc(bg)
        s.Y, s.X = np.mgrid[0:h, 0:w]

    # ---- 기본
    def put(s, x, y, c):
        x, y = int(round(x)), int(round(y))
        if 0 <= x < s.w and 0 <= y < s.h: s.a[y, x] = c if not isinstance(c, str) else hexc(c)

    def fill(s, mask, c):
        s.a[mask] = hexc(c) if isinstance(c, str) else c

    def rect(s, x, y, w, h, c):
        s.a[max(0, y):max(0, y + h), max(0, x):max(0, x + w)] = hexc(c) if isinstance(c, str) else c

    def dith(s, mask, v, rp):
        """v(0~1) 값을 색 단계 rp로 디더링해서 칠함"""
        n = len(rp)
        b = BAYER[s.Y % 4, s.X % 4]
        f = np.clip(v, 0, 1) * (n - 1)
        idx = np.clip(np.floor(f + (f - np.floor(f) > b)), 0, n - 1).astype(int)
        cols = np.array(rp)
        s.a[mask] = cols[idx[mask]]

    # ---- 그라데이션 배경
    def vgrad(s, rp, y0=0, y1=None, mask=None):
        y1 = s.h if y1 is None else y1
        v = np.clip((s.Y - y0) / max(1, y1 - y0), 0, 1)
        m = (s.Y >= y0) & (s.Y < y1)
        if mask is not None: m &= mask
        s.dith(m, v, rp)

    def rgrad(s, cx, cy, r, rp, mask=None):
        v = np.clip(np.hypot(s.X - cx, s.Y - cy) / r, 0, 1)
        m = np.ones_like(v, bool) if mask is None else mask
        s.dith(m, v, rp)

    # ---- 도형 마스크
    def emask(s, cx, cy, rx, ry, rot=0.0):
        dx, dy = s.X - cx, s.Y - cy
        c, sn = math.cos(rot), math.sin(rot)
        u, v = dx * c + dy * sn, -dx * sn + dy * c
        return (u / max(rx, 0.5)) ** 2 + (v / max(ry, 0.5)) ** 2 <= 1.0, u, v

    def pmask(s, pts):
        im = Image.new('L', (s.w, s.h), 0)
        ImageDraw.Draw(im).polygon([tuple(p) for p in pts], fill=255)
        return np.array(im) > 0

    def lmask(s, pts, width=1):
        im = Image.new('L', (s.w, s.h), 0)
        d = ImageDraw.Draw(im)
        d.line([tuple(p) for p in pts], fill=255, width=width)
        if width > 2:
            for p in pts: d.ellipse([p[0] - width / 2 + .5, p[1] - width / 2 + .5, p[0] + width / 2 - .5, p[1] + width / 2 - .5], fill=255)
        return np.array(im) > 0

    # ---- 음영 도형
    def ball(s, cx, cy, rx, ry, rp, rot=0.0, light=(-0.55, -0.65), amb=0.18, mask=None, spec=True):
        m, u, v = s.emask(cx, cy, rx, ry, rot)
        if mask is not None: m &= mask
        nx, ny = u / max(rx, 0.5), v / max(ry, 0.5)
        c, sn = math.cos(rot), math.sin(rot)
        gx, gy = nx * c - ny * sn, nx * sn + ny * c
        nz = np.sqrt(np.clip(1 - gx * gx - gy * gy, 0, 1))
        lz = math.sqrt(max(0, 1 - light[0] ** 2 - light[1] ** 2))
        d = gx * light[0] + gy * light[1] + nz * lz
        val = np.clip(amb + (1 - amb) * d, 0, 1)
        s.dith(m, val, rp)
        if spec and min(rx, ry) >= 4:
            sx, sy = cx + light[0] * rx * 0.45, cy + light[1] * ry * 0.45
            hm, _, _ = s.emask(sx, sy, max(1, rx * 0.16), max(1, ry * 0.12))
            s.a[hm & m] = (np.array(rp[-1]).astype(int) * 0.4 + 255 * 0.6).astype(np.uint8)
        return m

    def shade_mask(s, m, rp, cx, cy, r, light=(-0.55, -0.65), amb=0.2):
        """아무 모양 마스크에 둥근 음영 (중심 기준 가짜 구)"""
        nx, ny = (s.X - cx) / r, (s.Y - cy) / r
        nz = np.sqrt(np.clip(1 - nx * nx - ny * ny, 0.05, 1))
        lz = math.sqrt(max(0, 1 - light[0] ** 2 - light[1] ** 2))
        d = np.clip(nx * light[0] + ny * light[1] + nz * lz, 0, 1)
        s.dith(m, amb + (1 - amb) * d, rp)

    def line(s, pts, c, width=1):
        m = s.lmask(pts, width)
        s.fill(m, c)
        return m

    def ring(s, cx, cy, rx, ry, c, th=1.5, rot=0.0):
        m1, _, _ = s.emask(cx, cy, rx, ry, rot)
        m2, _, _ = s.emask(cx, cy, rx - th, ry - th, rot)
        m = m1 & ~m2
        s.fill(m, c)
        return m

    def outline(s, c='#0c0a14', only_empty=True):
        a = s.a[:, :, 3] > 0
        n = np.zeros_like(a)
        n[1:, :] |= a[:-1, :]; n[:-1, :] |= a[1:, :]; n[:, 1:] |= a[:, :-1]; n[:, :-1] |= a[:, 1:]
        m = n & ~a
        s.a[m] = hexc(c)

    def inner_line(s, mask, c):
        """마스크 안쪽 가장자리 1픽셀"""
        e = mask.copy()
        e[1:, :] &= mask[:-1, :]; e[:-1, :] &= mask[1:, :]; e[:, 1:] &= mask[:, :-1]; e[:, :-1] &= mask[:, 1:]
        s.fill(mask & ~e, c)

    def blend(s, mask, c, k):
        col = hexc(c)[:3].astype(float)
        s.a[mask, :3] = (s.a[mask, :3] * (1 - k) + col * k).astype(np.uint8)

    def stars(s, n, rng, cols, mask=None):
        for _ in range(n):
            x, y = rng.integers(0, s.w), rng.integers(0, s.h)
            if mask is not None and not mask[y, x]: continue
            s.put(x, y, cols[rng.integers(0, len(cols))])

    def paste(s, o, x, y):
        """다른 Pix를 (x, y)에 알파로 붙임"""
        h, w = o.a.shape[:2]
        x0, y0 = max(0, x), max(0, y); x1, y1 = min(s.w, x + w), min(s.h, y + h)
        if x1 <= x0 or y1 <= y0: return
        src = o.a[y0 - y:y1 - y, x0 - x:x1 - x]
        m = src[:, :, 3] > 0
        s.a[y0:y1, x0:x1][m] = src[m]

    def img(s):
        return Image.fromarray(s.a, 'RGBA')
