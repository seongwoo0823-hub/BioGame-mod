# 면역 특공대 주인공용 2D 도트 래스터라이저
# 도형(타원·캡슐·다각형)을 4x4 초표본으로 칠한 뒤 → 1픽셀로 내려 찍고 → 색 단계 명암
# → 부품 사이 내부선 → 바깥 외곽선(밝은 쪽은 재질색, 어두운 쪽은 검보라)
import numpy as np, math

S = 4
LIGHT = np.array([-0.55, -0.62, 0.56]); LIGHT /= np.linalg.norm(LIGHT)
OUT = np.array([0x16, 0x09, 0x1e], np.uint8)


def hexc(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], np.uint8)


class Mat:
    def __init__(s, ramp, bias=0.0):
        s.ramp = [hexc(c) for c in ramp]; s.bias = bias

    def back(s):
        """뒤쪽 팔·다리용: 한 단계 어둡게"""
        m = Mat.__new__(Mat); m.ramp = [s.ramp[0]] + s.ramp[:-1]; m.bias = s.bias - 0.04
        return m


def rot(v, a):
    c, s_ = math.cos(a), math.sin(a)
    return np.array([v[0] * c - v[1] * s_, v[0] * s_ + v[1] * c])


class Canvas:
    def __init__(s, w, h, ox, oy, k=1.0):
        s.w, s.h, s.ox, s.oy, s.k = w, h, ox, oy, k
        s.pid = np.full((h * S, w * S), -1, np.int32)
        s.sh = np.zeros((h * S, w * S), np.float32)
        s.parts = []; s.decals = []
        ys = ((np.arange(h * S) + 0.5) / S - oy) / k; xs = ((np.arange(w * S) + 0.5) / S - ox) / k
        s.X, s.Y = np.meshgrid(xs, ys)

    def set_spin(s, c, a):
        """몸 전체 회전: 표본 격자를 거꾸로 돌려서 도형이 회전된 채로 찍히게"""
        s.spin = (np.asarray(c, float), a)
        X = s.X - c[0]; Y = s.Y - c[1]; ca, sa = math.cos(-a), math.sin(-a)
        s.X = X * ca - Y * sa + c[0]; s.Y = X * sa + Y * ca + c[1]
        s.bbox_all = True

    def _part(s, mat, group, over, flat):
        s.parts.append(dict(mat=mat, group=group, over=over, flat=flat)); return len(s.parts) - 1

    def _bbox(s, x0, y0, x1, y1):
        if getattr(s, 'bbox_all', False): return slice(0, s.h * S), slice(0, s.w * S)
        k = s.k
        i0 = max(0, int((y0 * k + s.oy) * S) - 1); i1 = min(s.h * S, int((y1 * k + s.oy) * S) + 2)
        j0 = max(0, int((x0 * k + s.ox) * S) - 1); j1 = min(s.w * S, int((x1 * k + s.ox) * S) + 2)
        i0 = max(0, i0); j0 = max(0, j0)
        if i1 <= i0 or j1 <= j0: return slice(0, 0), slice(0, 0)
        return slice(i0, i1), slice(j0, j1)

    def _put(s, sl, mask, n, mat, group, over, flat, lift):
        if mask is None or not mask.any(): return -1
        k = s._part(mat, group, over, flat)
        lam = n[..., 0] * LIGHT[0] + n[..., 1] * LIGHT[1] + n[..., 2] * LIGHT[2]
        v = 0.5 * lam + 0.5 + mat.bias + lift
        P = s.pid[sl]; H = s.sh[sl]
        P[mask] = k; H[mask] = v[mask]
        return k

    def ellipse(s, c, rx, ry, a=0.0, mat=None, group='', over=(), lift=0.0, flat=None):
        r = max(rx, ry) + 1
        sl = s._bbox(c[0] - r, c[1] - r, c[0] + r, c[1] + r)
        dx = s.X[sl] - c[0]; dy = s.Y[sl] - c[1]
        ca, sa = math.cos(-a), math.sin(-a)
        u = (dx * ca - dy * sa) / rx; v = (dx * sa + dy * ca) / ry
        d2 = u * u + v * v; m = d2 <= 1
        nz = np.sqrt(np.clip(1 - d2, 0, 1))
        cb, sb = math.cos(a), math.sin(a)
        nx = u * cb - v * sb; ny = u * sb + v * cb
        n = np.stack([nx, ny, nz * 1.1], -1); n /= np.linalg.norm(n, axis=-1, keepdims=True) + 1e-9
        if flat is not None: n[:] = flat
        return s._put(sl, m, n, mat, group, over, flat, lift)

    def capsule(s, a, b, r1, r2=None, mat=None, group='', over=(), lift=0.0, flat=None):
        r2 = r1 if r2 is None else r2
        a = np.asarray(a, float); b = np.asarray(b, float); r = max(r1, r2) + 1
        sl = s._bbox(min(a[0], b[0]) - r, min(a[1], b[1]) - r, max(a[0], b[0]) + r, max(a[1], b[1]) + r)
        X = s.X[sl]; Y = s.Y[sl]; d = b - a; L2 = float(d @ d) or 1e-6
        t = np.clip(((X - a[0]) * d[0] + (Y - a[1]) * d[1]) / L2, 0, 1)
        px = a[0] + t * d[0]; py = a[1] + t * d[1]
        ex = X - px; ey = Y - py; dist = np.sqrt(ex * ex + ey * ey); R = r1 + (r2 - r1) * t
        m = dist <= R; k = np.clip(dist / R, 0, 1)
        nn = np.stack([ex / (dist + 1e-9) * k, ey / (dist + 1e-9) * k, np.sqrt(1 - k * k) * 1.1], -1)
        nn /= np.linalg.norm(nn, axis=-1, keepdims=True) + 1e-9
        if flat is not None: nn[:] = flat
        return s._put(sl, m, nn, mat, group, over, flat, lift)

    def poly(s, pts, mat=None, group='', over=(), lift=0.0, dome=None, flat=None):
        pts = np.asarray(pts, float)
        sl = s._bbox(pts[:, 0].min(), pts[:, 1].min(), pts[:, 0].max(), pts[:, 1].max())
        X = s.X[sl]; Y = s.Y[sl]; m = np.zeros(X.shape, bool); n_ = len(pts)
        for i in range(n_):
            x0, y0 = pts[i]; x1, y1 = pts[(i + 1) % n_]
            c = ((y0 <= Y) & (y1 > Y)) | ((y1 <= Y) & (y0 > Y))
            xi = x0 + (Y - y0) / ((y1 - y0) if y1 != y0 else 1e-9) * (x1 - x0)
            m ^= c & (X < xi)
        if dome is not None:
            (cx, cy), rr = dome
            u = (X - cx) / rr; v = (Y - cy) / rr; d2 = np.clip(u * u + v * v, 0, 1)
            n = np.stack([u, v, np.sqrt(1 - d2) * 1.1], -1)
        else:
            n = np.zeros(X.shape + (3,)); n[..., 2] = 1
        n /= np.linalg.norm(n, axis=-1, keepdims=True) + 1e-9
        if flat is not None: n[:] = flat
        return s._put(sl, m, n, mat, group, over, flat, lift)

    def decal(s, x, y, color, on=None):
        """on: 부품 번호나 그룹 이름 (그 위일 때만 찍음), None이면 무조건"""
        if getattr(s, 'spin', None) is not None:
            c, a = s.spin; v = np.array([x, y]) - c; ca, sa = math.cos(a), math.sin(a)
            x, y = c[0] + v[0] * ca - v[1] * sa, c[1] + v[0] * sa + v[1] * ca
        s.decals.append((x, y, hexc(color) if isinstance(color, str) else color, on))

    def line_decal(s, a, b, color, on=None):
        n = int(max(abs(b[0] - a[0]), abs(b[1] - a[1])) * 2 * s.k) + 1
        seen = set()
        for i in range(n + 1):
            t = i / n; x = a[0] + (b[0] - a[0]) * t; y = a[1] + (b[1] - a[1]) * t
            k = (math.floor(x * s.k + s.ox), math.floor(y * s.k + s.oy))
            if k in seen: continue
            seen.add(k); s.decal(x, y, color, on)

    # ---------------- 내려 찍기 ----------------
    def render(s, outline=True):
        h, w = s.h, s.w
        B = s.pid.reshape(h, S, w, S).transpose(0, 2, 1, 3).reshape(h, w, S * S)
        V = s.sh.reshape(h, S, w, S).transpose(0, 2, 1, 3).reshape(h, w, S * S)
        P = np.full((h, w), -1, np.int32); SH = np.zeros((h, w), np.float32)
        cov = (B >= 0).sum(-1)
        for i, j in zip(*np.nonzero(cov >= 6)):
            b = B[i, j]; ids, cnt = np.unique(b[b >= 0], return_counts=True)
            ok = ids[cnt >= 5]
            k = ok.max() if len(ok) else ids[cnt.argmax()]
            P[i, j] = k; SH[i, j] = V[i, j][b == k].mean()
        img = np.zeros((h, w, 4), np.uint8)
        for i, j in zip(*np.nonzero(P >= 0)):
            p = s.parts[P[i, j]]; r = p['mat'].ramp; n = len(r)
            v = SH[i, j]
            if n >= 5: q = 1 + (v > 0.47) + (v > 0.7) + (v > 0.9)
            else: q = 1 + (v > 0.52) + (v > 0.86)
            q = min(q, n - 1)
            img[i, j, :3] = r[q]; img[i, j, 3] = 255
        # 내부선: 위에 올라온 부품이 'over' 그룹을 덮는 경계 → 아래 부품 쪽 픽셀을 가장 어두운 색으로
        line = img.copy()
        for i, j in zip(*np.nonzero(P >= 0)):
            k = P[i, j]; me = s.parts[k]
            for di, dj in ((0, 1), (0, -1), (1, 0), (-1, 0)):
                y, x = i + di, j + dj
                if not (0 <= y < h and 0 <= x < w): continue
                k2 = P[y, x]
                if k2 <= k: continue
                up = s.parts[k2]
                if up['group'] == me['group']: continue
                if up['over'] == 'all' or me['group'] in up['over']:
                    line[i, j, :3] = me['mat'].ramp[0]; break
        img = line
        # 무늬
        for (x, y, c, on) in s.decals:
            j = math.floor(x * s.k + s.ox); i = math.floor(y * s.k + s.oy)
            if not (0 <= i < h and 0 <= j < w): continue
            k = P[i, j]
            if on is not None:
                if k < 0: continue
                if isinstance(on, str):
                    if s.parts[k]['group'] not in on.split('|'): continue
                elif k != on: continue
            img[i, j, :3] = c; img[i, j, 3] = 255
            if k < 0: P[i, j] = -2
        if outline:
            filled = img[..., 3] > 0; out = img.copy()
            for i, j in zip(*np.nonzero(~filled)):
                nb = []
                for di, dj in ((0, 1), (0, -1), (1, 0), (-1, 0)):
                    y, x = i + di, j + dj
                    if 0 <= y < h and 0 <= x < w and filled[y, x]: nb.append((y, x, di, dj))
                if not nb: continue
                # 위/왼쪽(빛 받는 쪽) 가장자리는 재질의 어두운 색으로, 나머지는 검보라
                lit = any(di == 1 or dj == 1 for (_, _, di, dj) in nb) and all(di >= 0 and dj >= 0 for (_, _, di, dj) in nb)
                y, x = nb[0][0], nb[0][1]; k = P[y, x]
                c = OUT
                if lit and k >= 0:
                    c = (s.parts[k]['mat'].ramp[0].astype(int) * 0.55 + OUT * 0.45).astype(np.uint8)
                out[i, j, :3] = c; out[i, j, 3] = 255
            img = out
        s.P = P
        return img

    def px(s, x, y):
        return math.floor(x * s.k + s.ox), math.floor(y * s.k + s.oy)
