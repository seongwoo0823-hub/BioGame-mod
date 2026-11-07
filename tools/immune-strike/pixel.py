# 면역 특공대 도트 그리기 도구 (직접 그리는 도트용)
#   게임 해상도(480×270) 그대로의 도트를 칸 단위로 그림.
#   부품(타원·캡슐·원·선)을 그리면 왼쪽 위에서 빛이 오는 명암, 부품마다 1도트 외곽선이 자동으로 들어감.
#   주인공 원화(tools/immune-strike/art/heroes-1.png)의 화풍: 동글동글한 몸, 진한 보라 외곽선, 까만 눈 + 흰 반짝임
import colorsys, math
import numpy as np
from PIL import Image

OUTLINE = (26, 16, 38)


def hexrgb(h):
    h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def ramp(base, n=5):
    """기본색 → [하이라이트, 밝음, 기본, 그림자, 깊은 그림자] (그림자는 보라 쪽, 밝은 쪽은 노랑 쪽으로 색상을 살짝 돌림)"""
    r, g, b = [v / 255 for v in (hexrgb(base) if isinstance(base, str) else base)]
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    out = []
    for k, (dl, dh, ds) in enumerate([(.22, -.03, -.05), (.1, -.015, 0), (0, 0, 0), (-.14, .03, .02), (-.26, .06, .0)][:n]):
        hh = (h + dh) % 1
        if dh > 0 and (h > .5 or h < .05): hh = (h + dh) % 1     # 그림자는 보라 쪽
        ll = max(.04, min(.96, l + dl)); ss = max(0, min(1, s + ds))
        rr, gg, bb = colorsys.hls_to_rgb(hh, ll, ss)
        out.append((int(rr * 255), int(gg * 255), int(bb * 255)))
    return out


class Sprite:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.px = np.zeros((h, w, 4), np.uint8)
        yy, xx = np.mgrid[0:h, 0:w]
        self.xx, self.yy = xx + .5, yy + .5

    # ---------- 모양(마스크) ----------
    def m_ellipse(self, cx, cy, rx, ry):
        return ((self.xx - cx) / rx) ** 2 + ((self.yy - cy) / ry) ** 2 <= 1.0

    def m_capsule(self, x0, y0, x1, y1, r):
        px, py = self.xx - x0, self.yy - y0
        dx, dy = x1 - x0, y1 - y0
        L = dx * dx + dy * dy or 1e-6
        t = np.clip((px * dx + py * dy) / L, 0, 1)
        return (px - t * dx) ** 2 + (py - t * dy) ** 2 <= r * r

    def m_poly(self, pts):
        from PIL import ImageDraw
        im = Image.new('L', (self.w, self.h), 0)
        ImageDraw.Draw(im).polygon([tuple(p) for p in pts], fill=255)
        return np.asarray(im) > 0

    # ---------- 칠하기 ----------
    def shade(self, mask, base, cx=None, cy=None, rx=None, ry=None, outline=True, light=(-.62, -.78), flat=False):
        """mask 영역을 base 색 명암으로 칠함. 중심/반지름을 주면 공처럼, 안 주면 mask 범위로 추정"""
        if not mask.any(): return
        R = ramp(base)
        ys, xs = np.nonzero(mask)
        if cx is None:
            cx = (xs.min() + xs.max() + 1) / 2; cy = (ys.min() + ys.max() + 1) / 2
            rx = max(1, (xs.max() - xs.min() + 1) / 2); ry = max(1, (ys.max() - ys.min() + 1) / 2)
        nx = (self.xx - cx) / rx; ny = (self.yy - cy) / ry
        d = nx * light[0] + ny * light[1]       # 빛 쪽일수록 큼
        idx = np.full(mask.shape, 2)
        if not flat:
            idx[d > .78] = 0; idx[(d > .38) & (d <= .78)] = 1
            idx[(d < -.38)] = 3; idx[(d < -.82)] = 4
        col = np.array(R)[idx]
        self.px[mask, :3] = col[mask]; self.px[mask, 3] = 255
        if outline: self.outline(mask)

    def fill(self, mask, color):
        c = hexrgb(color) if isinstance(color, str) else color
        self.px[mask, :3] = c; self.px[mask, 3] = 255

    def outline(self, mask, color=OUTLINE):
        """mask 바깥 테두리 1도트 (이미 다른 부품이 있으면 그 위에 선을 그어 부품을 구분)"""
        e = np.zeros_like(mask)
        e[1:] |= mask[:-1]; e[:-1] |= mask[1:]; e[:, 1:] |= mask[:, :-1]; e[:, :-1] |= mask[:, 1:]
        e &= ~mask
        self.px[e, :3] = color; self.px[e, 3] = 255

    def dot(self, x, y, color):
        x, y = int(round(x)), int(round(y))
        if 0 <= x < self.w and 0 <= y < self.h:
            c = hexrgb(color) if isinstance(color, str) else color
            self.px[y, x, :3] = c; self.px[y, x, 3] = 255

    def line(self, pts, color, outline=False):
        """점들을 잇는 1도트 선 (outline=True면 바깥에 외곽선)"""
        m = np.zeros((self.h, self.w), bool)
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            n = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
            for k in range(n + 1):
                t = k / n; x = int(math.floor(x0 + (x1 - x0) * t)); y = int(math.floor(y0 + (y1 - y0) * t))
                if 0 <= x < self.w and 0 <= y < self.h: m[y, x] = True
        if outline: self.outline(m)
        self.fill(m, color)
        return m

    def eye(self, x, y, h=4, w=3, look=1):
        """까만 눈 + 흰 반짝임 (x,y는 왼쪽 위). 3×4는 둥근 타원, 그 밖에는 꽉 찬 사각"""
        D, Wt = (20, 14, 30), (255, 255, 255)
        if (w, h) == (3, 4): pat = ['WXX', 'XXX', 'XXX', '.X.']
        elif (w, h) == (4, 3): pat = ['WXX.', 'XXXX', '.XX.']
        else: pat = ['W' + 'X' * (w - 1)] + ['X' * w] * (h - 1)
        for j, row in enumerate(pat):
            for i, ch in enumerate(row):
                ii = i if look > 0 else w - 1 - i
                if ch == 'X': self.dot(x + ii, y + j, D)
                elif ch == 'W': self.dot(x + ii, y + j, Wt)

    def angry(self, x, y, w=3, left=True):
        """화난 눈썹"""
        for i in range(w):
            self.dot(x + i, y + (i if left else w - 1 - i) // 2, OUTLINE)

    def image(self):
        return Image.fromarray(self.px, 'RGBA')


def sheet(rows, cell, bg=None):
    """rows: [[Image,...],...] → 한 장"""
    nr = len(rows); nc = max(len(r) for r in rows)
    out = Image.new('RGBA', (cell[0] * nc, cell[1] * nr), bg or (0, 0, 0, 0))
    for j, r in enumerate(rows):
        for i, im in enumerate(r):
            out.alpha_composite(im, (i * cell[0], j * cell[1]))
    return out


def preview(img, path, scale=5, bg=(24, 30, 52, 255), grid=None):
    p = Image.new('RGBA', img.size, bg); p.alpha_composite(img)
    p = p.resize((img.width * scale, img.height * scale), Image.NEAREST)
    if grid:
        from PIL import ImageDraw
        d = ImageDraw.Draw(p)
        for x in range(0, p.width, grid[0] * scale): d.line([(x, 0), (x, p.height)], fill=(60, 70, 100, 255))
        for y in range(0, p.height, grid[1] * scale): d.line([(0, y), (p.width, y)], fill=(60, 70, 100, 255))
    p.save(path)
