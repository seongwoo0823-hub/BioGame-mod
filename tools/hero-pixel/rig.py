# 관절 뼈대 기반 도트 캐릭터 렌더러: 기본 도형을 3D로 배치 → 방향별 회전 → 1픽셀 단위 깊이버퍼 → 4단 명암 + 외곽선
import numpy as np, math
from PIL import Image

def hexc(h): h = h.lstrip('#'); return np.array([int(h[i:i+2], 16) for i in (0, 2, 4)], np.uint8)

class Mat:
    def __init__(s, ramp, emissive=False, outline=None, glow=None):
        s.ramp = [hexc(c) for c in ramp]; s.em = emissive
        s.outline = hexc(outline) if outline else None; s.glow = hexc(glow) if glow else None

def _basis(d):
    d = d / (np.linalg.norm(d) + 1e-9)
    a = np.array([1.0, 0, 0]) if abs(d[0]) < 0.9 else np.array([0, 1.0, 0])
    u = np.cross(d, a); u /= np.linalg.norm(u); v = np.cross(d, u)
    return d, u, v

DENS = 3.4  # 단위 길이당 표본 수
SCALE = 1.28  # 캐릭터 확대 (디테일)
def ellipsoid(c, r):
    r = np.array(r, float) if np.ndim(r) else np.array([r, r, r], float)
    area = 4 * math.pi * (np.prod(r)) ** (2 / 3)
    n = max(24, int(area * DENS * DENS))
    i = np.arange(n) + 0.5; phi = np.arccos(1 - 2 * i / n); th = math.pi * (1 + 5 ** 0.5) * i
    u = np.stack([np.cos(th) * np.sin(phi), np.cos(phi), np.sin(th) * np.sin(phi)], 1)
    p = u * r + c; nrm = u / r; nrm /= np.linalg.norm(nrm, axis=1, keepdims=True)
    return p, nrm

def capsule(a, b, r1, r2=None):
    r2 = r1 if r2 is None else r2
    a = np.array(a, float); b = np.array(b, float); d = b - a; L = np.linalg.norm(d)
    out_p, out_n = [], []
    if L > 1e-3:
        dd, u, v = _basis(d)
        nt = max(2, int(L * DENS)); na = max(8, int(2 * math.pi * max(r1, r2) * DENS))
        t = (np.arange(nt) + 0.5) / nt; ang = np.arange(na) / na * 2 * math.pi
        T, A = np.meshgrid(t, ang); T = T.ravel(); A = A.ravel()
        R = r1 + (r2 - r1) * T
        dirs = np.cos(A)[:, None] * u + np.sin(A)[:, None] * v
        out_p.append(a + T[:, None] * d + R[:, None] * dirs)
        slope = (r1 - r2) / L; nn = dirs + slope * dd; nn /= np.linalg.norm(nn, axis=1, keepdims=True); out_n.append(nn)
    for c, r in ((a, r1), (b, r2)):
        p, n = ellipsoid(c, r); out_p.append(p); out_n.append(n)
    return np.concatenate(out_p), np.concatenate(out_n)

def box(c, ax, half):
    """ax: 3x3 행렬(열 = 축), half: 반길이"""
    c = np.array(c, float); ax = np.array(ax, float); half = np.array(half, float)
    ps, ns = [], []
    for k in range(3):
        i, j = [m for m in range(3) if m != k]
        ni = max(2, int(2 * half[i] * DENS)); nj = max(2, int(2 * half[j] * DENS))
        s = (np.arange(ni) + 0.5) / ni * 2 - 1; t = (np.arange(nj) + 0.5) / nj * 2 - 1
        S, Tt = np.meshgrid(s, t); S = S.ravel(); Tt = Tt.ravel()
        for sg in (-1, 1):
            p = c + ax[:, k] * half[k] * sg + np.outer(S * half[i], ax[:, i]) + np.outer(Tt * half[j], ax[:, j])
            ps.append(p); ns.append(np.tile(ax[:, k] * sg, (len(p), 1)))
    return np.concatenate(ps), np.concatenate(ns)

def frame_from(dirv, up=(0, 1, 0)):
    """dirv를 y축(길이 방향)으로 하는 회전 행렬 (열: x, y, z)"""
    y = np.array(dirv, float); y /= np.linalg.norm(y) + 1e-9
    upv = np.array(up, float)
    if abs(np.dot(upv, y)) > 0.95: upv = np.array([0, 0, 1.0])
    x = np.cross(y, upv); x /= np.linalg.norm(x); z = np.cross(x, y)
    return np.stack([x, y, z], 1)

class Model:
    def __init__(s): s.parts = []; s.decals = []; s.tips = {}
    def add(s, pn, mat, pid=None):
        p, n = pn; s.parts.append((p, n, mat, pid if pid is not None else len(s.parts)))
    def decal(s, pos, color, size=1, bias=1.2):
        s.decals.append((np.array(pos, float), hexc(color), size, bias))

def rot_y(a): c, s_ = math.cos(a), math.sin(a); return np.array([[c, 0, s_], [0, 1, 0], [-s_, 0, c]])
def rot_x(a): c, s_ = math.cos(a), math.sin(a); return np.array([[1, 0, 0], [0, c, -s_], [0, s_, c]])
def rot_z(a): c, s_ = math.cos(a), math.sin(a); return np.array([[c, -s_, 0], [s_, c, 0], [0, 0, 1]])

PITCH = math.radians(28)
LIGHT = np.array([-0.55, 0.75, 0.62]); LIGHT /= np.linalg.norm(LIGHT)

def view_xform(P, yaw):
    """캐릭터 공간 → 화면: (sx, sy_up, depth)"""
    R = rot_y(yaw); Q = (P @ R.T) * SCALE
    cp, sp = math.cos(PITCH), math.sin(PITCH)
    sx = Q[:, 0]; sy = Q[:, 1] * cp - Q[:, 2] * sp; dep = Q[:, 1] * sp + Q[:, 2] * cp
    return sx, sy, dep, Q

def view_normal(N, yaw):
    R = rot_y(yaw); Q = N @ R.T
    cp, sp = math.cos(PITCH), math.sin(PITCH)
    return np.stack([Q[:, 0], Q[:, 1] * cp - Q[:, 2] * sp, Q[:, 1] * sp + Q[:, 2] * cp], 1)

def render(model, yaw, W=88, H=88, foot_y=80, smear=None, fit=True):
    allp = []; alln = []; mats = []; pids = []
    for (p, n, m, pid) in model.parts:
        allp.append(p); alln.append(n); mats += [m]; pids.append(np.full(len(p), len(mats) - 1))
    P = np.concatenate(allp); N = np.concatenate(alln); MI = np.concatenate(pids)
    PID = np.concatenate([np.full(len(p), pid) for (p, n, m, pid) in model.parts])
    sx, sy, dep, _ = view_xform(P, yaw); vn = view_normal(N, yaw)
    ox = 0.0; oy = 0.0
    if fit:
        x0, x1 = sx.min(), sx.max(); y1 = sy.max(); y0 = sy.min()
        if x0 + W / 2 < 1: ox = 1 - (x0 + W / 2)
        if x1 + W / 2 > W - 2: ox = (W - 2) - (x1 + W / 2)
        if foot_y - y1 < 1: oy = -(1 - (foot_y - y1))
    ix = np.round(W / 2 + sx + ox - 0.5).astype(int); iy = np.round(foot_y - sy + oy - 0.5).astype(int)
    ok = (ix >= 0) & (ix < W) & (iy >= 0) & (iy < H)
    ix, iy, dep, vn, MI, PID = ix[ok], iy[ok], dep[ok], vn[ok], MI[ok], PID[ok]
    key = iy * W + ix
    order = np.lexsort((dep, key)); key_s = key[order]
    last = np.r_[key_s[1:] != key_s[:-1], True]; sel = order[last]
    zbuf = np.full(W * H, -1e9); midx = np.full(W * H, -1); pidb = np.full(W * H, -1); lam = np.zeros(W * H)
    zbuf[key[sel]] = dep[sel]; midx[key[sel]] = MI[sel]; pidb[key[sel]] = PID[sel]
    lam[key[sel]] = vn[sel] @ LIGHT
    # 명암 단계
    tone = np.where(lam < -0.08, 0, np.where(lam < 0.38, 1, np.where(lam < 0.8, 2, 3)))
    img = np.zeros((H, W, 4), np.uint8)
    zb = zbuf.reshape(H, W); mb = midx.reshape(H, W); pb = pidb.reshape(H, W); tb = tone.reshape(H, W)
    solid = mb >= 0
    # 안쪽 경계선: 앞의 부품과 맞닿은 뒤쪽 픽셀은 한 단계 어둡게
    inner = np.zeros_like(solid)
    for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
        sh_p = np.roll(np.roll(pb, dy, 0), dx, 1); sh_z = np.roll(np.roll(zb, dy, 0), dx, 1); sh_s = np.roll(np.roll(solid, dy, 0), dx, 1)
        inner |= solid & sh_s & (sh_p != pb) & (sh_z > zb + 1.6)
    for y in range(H):
        for x in range(W):
            m = mb[y, x]
            if m < 0: continue
            mt = mats[m]; t = tb[y, x]
            if mt.em: t = 3 if t >= 2 else 2
            if inner[y, x] and not mt.em: t = max(0, t - 1) if t > 0 else 0
            c = mt.ramp[t]
            if inner[y, x] and not mt.em and tb[y, x] == 0: c = (mt.ramp[0] * 0.7).astype(np.uint8)
            img[y, x, :3] = c; img[y, x, 3] = 255
    # 장식(눈 등)
    for pos, col, size, bias in model.decals:
        s1, s2, d1, _ = view_xform(pos[None], yaw)
        x = int(round(W / 2 + s1[0] + ox - 0.5)); y = int(round(foot_y - s2[0] + oy - 0.5))
        if 0 <= x < W and 0 <= y < H and d1[0] + bias >= zb[y, x]:
            for k in range(size):
                if x + k < W and solid[y, x + k]: img[y, x + k, :3] = col
    # 무기 잔상
    if smear is not None:
        pts, col = smear
        for (a, b, w) in pts:
            for t in np.linspace(0, 1, 14):
                q = a + (b - a) * t
                s1, s2, d1, _ = view_xform(q[None], yaw)
                x = int(round(W / 2 + s1[0] + ox - 0.5)); y = int(round(foot_y - s2[0] + oy - 0.5))
                for dx_ in range(-w // 2, w // 2 + 1):
                    for dy_ in range(-w // 2, w // 2 + 1):
                        xx, yy = x + dx_, y + dy_
                        if 0 <= xx < W and 0 <= yy < H and (not solid[yy, xx] or d1[0] > zb[yy, xx]):
                            img[yy, xx, :3] = col[0] if (dx_ == 0 and dy_ == 0) else col[1]; img[yy, xx, 3] = 255
    # 외곽선 (빛나는 부품 옆은 빛 색)
    al = img[..., 3] > 0
    out = np.zeros_like(al); glowc = np.zeros((H, W, 3), np.int32); gl = np.zeros_like(al)
    for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
        nb = np.roll(np.roll(al, dy, 0), dx, 1); out |= nb & ~al
        nm = np.roll(np.roll(mb, dy, 0), dx, 1)
        for yy, xx in zip(*np.nonzero(nb & ~al & (nm >= 0))):
            mt = mats[nm[yy, xx]]
            if mt.em and mt.glow is not None: gl[yy, xx] = True; glowc[yy, xx] = mt.glow
    res = img.copy()
    res[out, :3] = OUTLINE; res[out, 3] = 255
    res[gl, :3] = glowc[gl]; res[gl, 3] = 255
    return res

OUTLINE = hexc('#140c14')
