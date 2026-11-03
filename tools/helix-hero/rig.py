# 헬릭스 주인공용 도트 렌더러
# 기본 도형(타원체·캡슐·상자)을 점으로 샘플링 → 8방향 회전 → 픽셀 깊이버퍼 → 색상 단계 명암
# → 부품 경계 내부선 → 색이 섞인 외곽선(sel-out) → 무기 잔상(스미어)
import numpy as np, math

def hexc(h): h = h.lstrip('#'); return np.array([int(h[i:i+2], 16) for i in (0, 2, 4)], np.uint8)

class Mat:
    """ramp: 어두움→밝음 4~5단계. em: 스스로 빛남. glow: 외곽선 대신 쓰는 빛 색"""
    def __init__(s, ramp, em=False, glow=None, spec=None):
        s.ramp = [hexc(c) for c in ramp]; s.em = em; s.glow = hexc(glow) if glow else None
        s.spec = hexc(spec) if spec else None
        s.line = (s.ramp[0].astype(np.int32) * 0.45 + np.array([10, 6, 16]) * 0.55).astype(np.uint8)

DENS = 5.2      # 단위 길이당 표본 수
SCALE = 2.0     # 1단위 → 픽셀
PITCH = math.radians(38)   # 위에서 비스듬히 내려다보는 시점
LIGHT = np.array([-0.5, 0.78, 0.55]); LIGHT /= np.linalg.norm(LIGHT)

def _basis(d):
    d = d / (np.linalg.norm(d) + 1e-9)
    a = np.array([1.0, 0, 0]) if abs(d[0]) < 0.9 else np.array([0, 1.0, 0])
    u = np.cross(d, a); u /= np.linalg.norm(u); v = np.cross(d, u)
    return d, u, v

def ellipsoid(c, r):
    c = np.array(c, float)
    r = np.array(r, float) if np.ndim(r) else np.array([r, r, r], float)
    area = 4 * math.pi * (np.prod(r)) ** (2 / 3)
    n = max(30, int(area * DENS * DENS))
    i = np.arange(n) + 0.5; phi = np.arccos(1 - 2 * i / n); th = math.pi * (1 + 5 ** 0.5) * i
    u = np.stack([np.cos(th) * np.sin(phi), np.cos(phi), np.sin(th) * np.sin(phi)], 1)
    p = u * r + c; nrm = u / r; nrm /= np.linalg.norm(nrm, axis=1, keepdims=True)
    return p, nrm

def oriented_ellipsoid(c, ax, r):
    """ax: 3x3 (열 = 로컬 축)"""
    p, n = ellipsoid(np.zeros(3), r)
    ax = np.array(ax, float)
    return p @ ax.T + np.array(c, float), n @ ax.T

def capsule(a, b, r1, r2=None, caps=True):
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
    if caps or L <= 1e-3:
        for c, r in ((a, r1), (b, r2)):
            p, n = ellipsoid(c, r); out_p.append(p); out_n.append(n)
    return np.concatenate(out_p), np.concatenate(out_n)

def box(c, ax, half):
    c = np.array(c, float); ax = np.array(ax, float); half = np.array(half, float)
    ps, ns = [], []
    for k in range(3):
        i, j = [m for m in range(3) if m != k]
        ni = max(2, int(2 * half[i] * DENS) + 1); nj = max(2, int(2 * half[j] * DENS) + 1)
        s = (np.arange(ni) + 0.5) / ni * 2 - 1; t = (np.arange(nj) + 0.5) / nj * 2 - 1
        S, Tt = np.meshgrid(s, t); S = S.ravel(); Tt = Tt.ravel()
        for sg in (-1, 1):
            p = c + ax[:, k] * half[k] * sg + np.outer(S * half[i], ax[:, i]) + np.outer(Tt * half[j], ax[:, j])
            ps.append(p); ns.append(np.tile(ax[:, k] * sg, (len(p), 1)))
    return np.concatenate(ps), np.concatenate(ns)

def sheet(P, nrm_hint=None, both=True):
    """점 격자(…×…×3) 형태의 면 → 점·법선 (옷자락 등 얇은 천)"""
    P = np.array(P, float); nu, nv = P.shape[:2]
    du = np.gradient(P, axis=0); dv = np.gradient(P, axis=1)
    n = np.cross(du, dv); n /= np.linalg.norm(n, axis=2, keepdims=True) + 1e-9
    # 촘촘하게 보간
    pts = []; nrs = []
    for i in range(nu - 1):
        for j in range(nv - 1):
            a, b, c, d = P[i, j], P[i + 1, j], P[i, j + 1], P[i + 1, j + 1]
            L = max(np.linalg.norm(b - a), np.linalg.norm(c - a), np.linalg.norm(d - c), np.linalg.norm(d - b))
            k = max(2, int(L * DENS * 1.2) + 1)
            s = (np.arange(k) + 0.5) / k
            S, T = np.meshgrid(s, s); S = S.ravel()[:, None]; T = T.ravel()[:, None]
            q = a * (1 - S) * (1 - T) + b * S * (1 - T) + c * (1 - S) * T + d * S * T
            nn = n[i, j] * (1 - S) * (1 - T) + n[i + 1, j] * S * (1 - T) + n[i, j + 1] * (1 - S) * T + n[i + 1, j + 1] * S * T
            nn /= np.linalg.norm(nn, axis=1, keepdims=True) + 1e-9
            pts.append(q); nrs.append(nn)
    p = np.concatenate(pts); nn = np.concatenate(nrs)
    if nrm_hint is not None:
        flip = (nn @ np.array(nrm_hint, float)) < 0; nn[flip] *= -1
    return p, nn

def frame_from(dirv, up=(0, 1, 0)):
    y = np.array(dirv, float); y /= np.linalg.norm(y) + 1e-9
    upv = np.array(up, float)
    if abs(np.dot(upv, y) / (np.linalg.norm(upv) + 1e-9)) > 0.95: upv = np.array([0, 0, 1.0]) if abs(y[2]) < 0.9 else np.array([1.0, 0, 0])
    x = np.cross(y, upv); x /= np.linalg.norm(x); z = np.cross(x, y)
    return np.stack([x, y, z], 1)

def rot_y(a): c, s_ = math.cos(a), math.sin(a); return np.array([[c, 0, s_], [0, 1, 0], [-s_, 0, c]])
def rot_x(a): c, s_ = math.cos(a), math.sin(a); return np.array([[1, 0, 0], [0, c, -s_], [0, s_, c]])
def rot_z(a): c, s_ = math.cos(a), math.sin(a); return np.array([[c, -s_, 0], [s_, c, 0], [0, 0, 1]])
def rot_axis(ax, a):
    ax = np.array(ax, float); ax /= np.linalg.norm(ax); x, y, z = ax; c, s = math.cos(a), math.sin(a); C = 1 - c
    return np.array([[c + x * x * C, x * y * C - z * s, x * z * C + y * s], [y * x * C + z * s, c + y * y * C, y * z * C - x * s], [z * x * C - y * s, z * y * C + x * s, c + z * z * C]])

class Model:
    def __init__(s): s.parts = []; s.decals = []; s.tips = {}; s.smear = []
    def add(s, pn, mat, pid=None):
        p, n = pn; s.parts.append((p, n, mat, pid if pid is not None else len(s.parts)))
    def decal(s, pos, color, size=1, bias=1.2):
        s.decals.append((np.array(pos, float), hexc(color), size, bias))
    def transform(s, f):
        """모든 점에 f(점)→점 적용 (법선은 수치 근사)"""
        s.parts = [(f(p), n, m, i) for p, n, m, i in s.parts]

def view_xform(P, yaw):
    R = rot_y(yaw); Q = (np.atleast_2d(P) @ R.T) * SCALE
    cp, sp = math.cos(PITCH), math.sin(PITCH)
    sx = Q[:, 0]; sy = Q[:, 1] * cp - Q[:, 2] * sp; dep = Q[:, 1] * sp + Q[:, 2] * cp
    return sx, sy, dep

def view_normal(N, yaw):
    R = rot_y(yaw); Q = N @ R.T
    cp, sp = math.cos(PITCH), math.sin(PITCH)
    return np.stack([Q[:, 0], Q[:, 1] * cp - Q[:, 2] * sp, Q[:, 1] * sp + Q[:, 2] * cp], 1)

OUTLINE = hexc('#0c0a12')

def render(model, yaw, W=128, H=128, foot_y=104, tint=None, dissolve=0.0, seed=0, ox=0.0, oy=0.0):
    """tint: (색, 세기) — 유령/분열 효과용 단색 덮기"""
    allp = []; alln = []; mats = []; mi = []; pid = []
    for (p, n, m, i) in model.parts:
        allp.append(p); alln.append(n); mats.append(m); mi.append(np.full(len(p), len(mats) - 1)); pid.append(np.full(len(p), i))
    P = np.concatenate(allp); N = np.concatenate(alln); MI = np.concatenate(mi); PID = np.concatenate(pid)
    sx, sy, dep = view_xform(P, yaw); vn = view_normal(N, yaw)
    fx = W / 2 + sx + ox; fy = foot_y - sy + oy
    ix = np.floor(fx).astype(int); iy = np.floor(fy).astype(int)
    ok = (ix >= 0) & (ix < W) & (iy >= 0) & (iy < H)
    ix, iy, dep, vn, MI, PID = ix[ok], iy[ok], dep[ok], vn[ok], MI[ok], PID[ok]
    key = iy * W + ix
    order = np.lexsort((dep, key)); ks = key[order]
    last = np.r_[ks[1:] != ks[:-1], True]; sel = order[last]
    zb = np.full(W * H, -1e9); mb = np.full(W * H, -1); pb = np.full(W * H, -1); lam = np.zeros(W * H); facing = np.zeros(W * H)
    zb[key[sel]] = dep[sel]; mb[key[sel]] = MI[sel]; pb[key[sel]] = PID[sel]
    lam[key[sel]] = vn[sel] @ LIGHT; facing[key[sel]] = vn[sel][:, 2]
    zb = zb.reshape(H, W); mb = mb.reshape(H, W); pb = pb.reshape(H, W); lam = lam.reshape(H, W); facing = facing.reshape(H, W)
    solid = mb >= 0
    # 단계 명암 (+ 아주 약한 체크 디더로 경계 부드럽게)
    yy, xx = np.mgrid[0:H, 0:W]; chk = 0.0
    l2 = lam + chk
    tone = np.where(l2 < -0.15, 0, np.where(l2 < 0.25, 1, np.where(l2 < 0.62, 2, 3)))
    # 테두리 쪽(시선과 거의 수직) 반사광: 어두운 면 가장자리를 한 단계 밝게
    rim = (facing < 0.18) & (tone == 0) & (lam > -0.6)
    tone = np.where(rim, 1, tone)
    # 부품 경계 내부선
    inner = np.zeros_like(solid)
    for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
        sp_ = np.roll(np.roll(pb, dy, 0), dx, 1); sz = np.roll(np.roll(zb, dy, 0), dx, 1); ss_ = np.roll(np.roll(solid, dy, 0), dx, 1)
        inner |= solid & ss_ & (sp_ != pb) & (sz > zb + 2.2)
    img = np.zeros((H, W, 4), np.uint8)
    nr = max(len(m.ramp) for m in mats)
    for k, mt in enumerate(mats):
        msk = mb == k
        if not msk.any(): continue
        t = tone.copy()
        if mt.em: t = np.where(t >= 2, 3, 2)
        L = len(mt.ramp)
        if L == 5: t = np.where((lam > 0.86) & (t == 3), 4, t)
        if not mt.em: t = np.where(inner, np.maximum(0, t - 1), t)
        t = np.clip(t, 0, L - 1)
        ramp = np.stack(mt.ramp)
        col = ramp[t]
        if not mt.em:
            col = np.where((inner & (tone == 0))[..., None], mt.line, col)
        img[msk, :3] = col[msk]; img[msk, 3] = 255
    # 장식 점
    for pos, col, size, bias in model.decals:
        s1, s2, d1 = view_xform(pos, yaw)
        x = int(math.floor(W / 2 + s1[0] + ox)); y = int(math.floor(foot_y - s2[0] + oy))
        if 0 <= x < W and 0 <= y < H and solid[y, x] and d1[0] + bias >= zb[y, x]:
            for k in range(size):
                if x + k < W and solid[y, x + k]: img[y, x + k, :3] = col
    # 외곽선: 바깥 픽셀을 인접 재질의 어두운 색으로 (빛나는 재질은 빛 색)
    al = img[..., 3] > 0
    res = img.copy()
    outm = np.zeros_like(al); ocol = np.zeros((H, W, 3), np.int32); ocnt = np.zeros((H, W), np.int32); gl = np.zeros_like(al); gcol = np.zeros((H, W, 3), np.int32)
    lines = np.stack([m.line for m in mats]).astype(np.int32)
    glows = np.stack([m.glow if (m.em and m.glow is not None) else np.zeros(3, np.uint8) for m in mats]).astype(np.int32)
    isg = np.array([bool(m.em and m.glow is not None) for m in mats])
    for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
        nb = np.roll(np.roll(al, dy, 0), dx, 1); nm = np.roll(np.roll(mb, dy, 0), dx, 1)
        e = nb & ~al & (nm >= 0)
        outm |= nb & ~al
        idx = np.where(e, nm, 0)
        ocol += np.where(e[..., None], lines[idx], 0); ocnt += e
        g = e & isg[idx]; gl |= g; gcol = np.where(g[..., None], glows[idx], gcol)
    oc = np.where(ocnt[..., None] > 0, ocol // np.maximum(ocnt, 1)[..., None], OUTLINE.astype(np.int32))
    # 아래쪽 외곽선은 더 진하게 (바닥 쪽 그림자감)
    below = np.roll(al, -1, 0) & ~al
    oc = np.where(below[..., None], (oc * 0.6).astype(np.int32), oc)
    res[outm, :3] = oc[outm].astype(np.uint8); res[outm, 3] = 255
    res[gl, :3] = gcol[gl].astype(np.uint8); res[gl, 3] = 255
    # np.roll 이 가장자리를 넘어 반대편에 그린 외곽선 지우기
    for sl in ((0, slice(None)), (H - 1, slice(None)), (slice(None), 0), (slice(None), W - 1)):
        e = res[sl]; e[~al[sl]] = 0
    # 잔상 (스미어): 몸 뒤/앞 깊이 비교 후 칠함
    for sm in model.smear:
        draw_smear(res, zb, al, sm, yaw, W, H, foot_y, ox, oy)
    if tint is not None:
        col, k = tint; c = hexc(col).astype(float)
        a = res[..., 3] > 0
        lum = res[..., :3].astype(float).mean(2, keepdims=True) / 255
        tc = np.clip(c * (0.35 + 1.1 * lum), 0, 255)
        res[a, :3] = (res[a, :3] * (1 - k) + tc[a] * k).astype(np.uint8)
    if dissolve > 0:
        h = (((xx * 73856093) ^ (yy * 19349663) ^ (seed * 83492791)) % 1000) / 1000.0
        res[(h < dissolve) & (res[..., 3] > 0), 3] = 0
    return res

def draw_smear(res, zb, body, sm, yaw, W, H, foot_y, ox, oy):
    """sm = dict(strips=[(안쪽점들, 바깥점들)], cols=[가장자리, 중간, 안쪽], front=True)"""
    inner, outer = sm['in'], sm['out']; cols = [hexc(c) for c in sm['cols']]
    n = len(inner)
    if n < 2: return
    def prj(P):
        s1, s2, d = view_xform(np.array(P), yaw)
        return W / 2 + s1 + ox, foot_y - s2 + oy, d
    ax_, ay_, ad = prj(inner); bx_, by_, bd = prj(outer)
    acc = np.zeros((H, W)); dep = np.full((H, W), -1e9)
    # 각 띠 조각(사각형)을 촘촘한 표본으로 채움, 위치 비율 v(0 안쪽 → 1 바깥), 시간 u(0 오래됨 → 1 최근)
    for i in range(n - 1):
        for u in np.linspace(0, 1, 8):
            x0 = ax_[i] + (ax_[i + 1] - ax_[i]) * u; y0 = ay_[i] + (ay_[i + 1] - ay_[i]) * u; d0 = ad[i] + (ad[i + 1] - ad[i]) * u
            x1 = bx_[i] + (bx_[i + 1] - bx_[i]) * u; y1 = by_[i] + (by_[i + 1] - by_[i]) * u; d1 = bd[i] + (bd[i + 1] - bd[i]) * u
            L = max(2, int(math.hypot(x1 - x0, y1 - y0) * 2) + 1)
            age = (i + u) / (n - 1)
            for v in np.linspace(0, 1, L):
                x = int(math.floor(x0 + (x1 - x0) * v)); y = int(math.floor(y0 + (y1 - y0) * v))
                if 0 <= x < W and 0 <= y < H:
                    # 오래된 쪽일수록 바깥 가장자리만 남음
                    if v < 1 - (0.25 + 0.75 * age): continue
                    acc[y, x] = max(acc[y, x], 0.35 + 0.65 * v)
                    dep[y, x] = max(dep[y, x], d0 + (d1 - d0) * v)
    m = acc > 0
    vis = m & (~body | (dep > zb + 0.5))
    c = np.where(acc[..., None] > 0.86, cols[0], np.where(acc[..., None] > 0.62, cols[1], cols[2]))
    res[vis, :3] = c[vis]; res[vis, 3] = 255
