# 헬릭스 적 몬스터 8종: 3D 기본 도형 모델 + 동작
# 주인공과 같은 렌더러(tools/helix-hero/rig.py)를 씀. 캐릭터 공간: +x 왼쪽, +y 위, +z 앞, 바닥 y=0
import sys, os, math
import numpy as np
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../helix-hero'))
from rig import *
from hero import ik, skeleton as hskel, BASE as HBASE

TAU = 2 * math.pi
def M_(ramp, em=False, glow=None): return Mat(ramp, em, glow)
def lerp(a, b, t): return a + (b - a) * t
def ss(t): t = min(1, max(0, t)); return t * t * (3 - 2 * t)
def nz(v): v = np.array(v, float); return v / (np.linalg.norm(v) + 1e-9)
def V(*a): return np.array(a, float)
def limb(M, a, b, r1, r2, mat, pid=None): M.add(capsule(a, b, r1, r2), mat, pid)
def chain(M, pts, rads, mat, pid=None):
    for k in range(len(pts) - 1):
        r1 = rads[k] if np.ndim(rads) else rads; r2 = rads[k + 1] if np.ndim(rads) else rads
        limb(M, pts[k], pts[k + 1], r1, r2, mat, pid)
def keys(t, ks):
    if t <= ks[0][0]: return dict(ks[0][1])
    for (t0, a), (t1, b) in zip(ks, ks[1:]):
        if t <= t1:
            u = ss((t - t0) / max(1e-6, t1 - t0)); out = {}
            for k in set(a) | set(b):
                va = a.get(k, b.get(k)); vb = b.get(k, a.get(k))
                out[k] = lerp(np.array(va, float), np.array(vb, float), u) if isinstance(va, (list, tuple, np.ndarray)) else lerp(va, vb, u)
            return out
    return dict(ks[-1][1])

def icosa(c, r, R=np.eye(3)):
    """면이 각진 정이십면체 (바이러스 머리)"""
    t = (1 + 5 ** .5) / 2
    Vt = np.array([[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]], float)
    Vt /= np.linalg.norm(Vt[0]); Vt = Vt * r @ R.T + c
    F = [(0, 11, 5), (0, 5, 1), (0, 1, 7), (0, 7, 10), (0, 10, 11), (1, 5, 9), (5, 11, 4), (11, 10, 2), (10, 7, 6), (7, 1, 8),
         (3, 9, 4), (3, 4, 2), (3, 2, 6), (3, 6, 8), (3, 8, 9), (4, 9, 5), (2, 4, 11), (6, 2, 10), (8, 6, 7), (9, 8, 1)]
    ps, ns, faces = [], [], []
    for a, b, d in F:
        A, B, D = Vt[a], Vt[b], Vt[d]
        n = np.cross(B - A, D - A); n = nz(n)
        if np.dot(n, (A + B + D) / 3 - c) < 0: n = -n
        k = int(np.linalg.norm(B - A) * DENS * 1.3) + 2
        for i in range(k + 1):
            for j in range(k + 1 - i):
                u = i / k; v = j / k; ps.append(A + (B - A) * u + (D - A) * v); ns.append(n)
        faces.append(((A + B + D) / 3, n, (A, B, D)))
    return (np.array(ps), np.array(ns)), faces

# ======================================================================== 1. 파지 거미
PH_HEAD = M_(['#1e1430', '#3a2860', '#6a4ea0', '#a888e0', '#e8dcff'])
PH_METAL = M_(['#141824', '#2c3446', '#545f7a', '#9aa6c0'])
PH_RING = M_(['#2a1838', '#523070', '#8a54b0', '#c69ae6'])
PH_CORE = M_(['#8a1050', '#e0307a', '#ff8ab8', '#ffe6f2'], True, '#ff4a98')
def phage(anim, t, v=None):
    v = v or {}; M = Model()
    PH_HEAD_, PH_CORE_ = v.get('head', PH_HEAD), v.get('core', PH_CORE)
    q = dict(bob=0.0, tilt=0.0, sheath=1.0, spread=0.0, fwd=0.0, gait=0.0, gamp=0.0, up=0.0, fall=0.0, glow=0.5)
    if anim == 'idle':
        q.update(bob=0.5 * math.sin(TAU * t), tilt=0.05 * math.sin(TAU * t + 1), glow=0.4 + 0.3 * math.sin(TAU * t))
    elif anim == 'move':
        q.update(gait=t, gamp=1.0, bob=0.5 * abs(math.sin(TAU * t * 2)), tilt=0.12)
    elif anim == 'attack':   # 일어섰다가 꼬리를 내리꽂아 유전자 주입
        q.update(keys(t, [(0, dict(up=0, tilt=0, sheath=1, spread=0, fwd=0, glow=0.5)),
                          (0.35, dict(up=5, tilt=-0.5, sheath=1.15, spread=0.3, fwd=-1, glow=0.8)),
                          (0.55, dict(up=-2, tilt=0.55, sheath=0.55, spread=0.8, fwd=5, glow=1.0)),
                          (0.75, dict(up=-2, tilt=0.5, sheath=0.6, spread=0.8, fwd=5, glow=0.7)),
                          (1, dict(up=0, tilt=0, sheath=1, spread=0, fwd=0, glow=0.5))]))
    elif anim == 'hit':
        k = [1, 0.7, 0.4, 0.1][min(3, int(t * 3 + 0.5))]; q.update(tilt=-0.35 * k, fwd=-2 * k, up=-1 * k)
    elif anim == 'death':
        a = ss(t / 0.6); q.update(up=-6 * a, spread=1.4 * a, tilt=0.3 * a, fall=0.9 * ss((t - 0.2) / 0.6), glow=0.5 * (1 - a))
    H = 11.0 + q['bob'] + q['up']
    bp = V(0, H, q['fwd'])
    Rb = rot_x(q['tilt']) @ rot_z(0.4 * q['fall'])
    # 다리 6개 (삼각 보행)
    for i in range(6):
        a = (i + 0.5) * TAU / 6; d = V(math.sin(a), 0, math.cos(a))
        hip = bp + Rb @ (d * 2.6 + V(0, -0.6, 0))
        ph = TAU * q['gait'] + (math.pi if i % 2 else 0)
        sz = 2.8 * q['gamp'] * math.sin(ph); lift = 2.6 * q['gamp'] * max(0, math.cos(ph))
        foot = V(d[0] * (12.5 + 3 * q['spread']), lift, d[2] * (12.5 + 3 * q['spread']) + sz + q['fwd'] * 0.4)
        if q['fall'] > 0: foot = foot + V(0, 0, 0) ; foot[1] = max(0.0, foot[1])
        knee = (hip + foot) / 2 + V(0, 6.5 - 2 * q['spread'], 0) + d * 1.5
        chain(M, [hip, knee], [0.75, 0.6], PH_METAL, pid=10 + i)
        chain(M, [knee, foot + V(0, 0.4, 0)], [0.6, 0.3], PH_METAL, pid=20 + i)
        M.add(ellipsoid(knee, 0.85), PH_RING, pid=30 + i)
        limb(M, foot + V(0, 0.4, 0), foot + d * 1.6 + V(0, 0.2, 0), 0.35, 0.2, PH_METAL, pid=20 + i)
    # 기판 + 꼬리 칼집 + 목깃
    M.add(oriented_ellipsoid(bp, Rb, (3.6, 0.9, 3.6)), PH_METAL, pid=40)
    for k in range(6):
        a = k * TAU / 6; M.add(ellipsoid(bp + Rb @ V(math.sin(a) * 3.3, -0.6, math.cos(a) * 3.3), 0.6), PH_RING, pid=41)
    L = 9.0 * q['sheath']; top = bp + Rb @ V(0, L, 0)
    limb(M, bp, top, 1.7, 1.7, PH_METAL, pid=42)
    nr = 7
    for k in range(nr):
        c = bp + Rb @ V(0, L * (k + 0.5) / nr, 0)
        M.add(oriented_ellipsoid(c, Rb, (2.1, 0.45, 2.1)), PH_RING, pid=43)
    M.add(oriented_ellipsoid(top, Rb, (3.0, 0.8, 3.0)), PH_METAL, pid=44)
    # 머리 (각진 정이십면체) + 앞면의 빛나는 유전 물질
    hc = top + Rb @ V(0, 6.6, 0.4)
    Rh = Rb @ rot_y(0.3) @ rot_x(0.35)
    (ps, ns), faces = icosa(hc, 7.0, Rh)
    M.add((ps, ns), PH_HEAD_, pid=50)
    for fc, n, tri in faces:
        if n[2] > 0.25 or n[1] > 0.85:
            for a, b in ((0, 1), (1, 2), (2, 0)):
                M.add(capsule(tri[a] + n * 0.15, tri[b] + n * 0.15, 0.22, 0.22), PH_RING, pid=51)
    g = q['glow']
    for fc, n, tri in faces:
        if n[2] > 0.55:
            M.add(oriented_ellipsoid(fc + n * 0.25, frame_from(n), (1.3 + 0.6 * g, 0.2, 1.3 + 0.6 * g)), PH_CORE_, pid=52)
    if v.get('crown'):   # 여왕: 머리 위 왕관 가시
        for fc, n, tri in faces:
            if n[1] > 0.3: limb(M, fc, fc + n * 4.2, 0.9, 0.15, v.get('crownmat', PH_RING), pid=53)
    M.tips['mouth'] = bp; M.root = V(0, 0, q['fwd'])
    if q['fall'] > 0:
        piv = V(0, 0, 0)
        M.parts = [(np.c_[p[:, 0], np.maximum(p[:, 1] - q['fall'] * 4, p[:, 1] * (1 - 0.4 * q['fall'])), p[:, 2]], n, m, i) for p, n, m, i in M.parts]
    return M

# ======================================================================== 2. 아메바 포식자
AM_BODY = M_(['#0b3d34', '#17705c', '#33b08c', '#86eac6', '#e4fff4'])
AM_NUC = M_(['#2a0e3a', '#4e1c6a', '#7e34a2', '#b874d8'])
AM_VAC = M_(['#3a8a70', '#8ae0c0', '#d8fff0', '#ffffff'], True, '#9affd8')
AM_EYE = M_(['#5a4a00', '#e0c020', '#fff080', '#ffffff'], True, '#ffe040')
def amoeba(anim, t):
    M = Model()
    q = dict(sy=1.0, sx=1.0, reach=0.0, shift=0.0, wob=0.0, lunge=0.0, open=0.0, flat=0.0)
    ph = TAU * t
    if anim == 'idle': q.update(sy=1 + 0.08 * math.sin(ph), sx=1 - 0.05 * math.sin(ph), wob=t)
    elif anim == 'move': q.update(reach=0.5 + 0.5 * math.sin(ph), shift=1.8 * math.sin(ph - 1.2), sy=1 - 0.08 * math.sin(ph), wob=t)
    elif anim == 'attack':
        q.update(keys(t, [(0, dict(sy=1, sx=1, lunge=0, open=0)), (0.35, dict(sy=1.55, sx=0.8, lunge=-2, open=0.4)),
                          (0.58, dict(sy=0.7, sx=1.35, lunge=8, open=1.0)), (0.78, dict(sy=0.8, sx=1.25, lunge=7, open=0.6)), (1, dict(sy=1, sx=1, lunge=0, open=0))]))
        q['wob'] = t
    elif anim == 'hit':
        k = [1, 0.7, 0.4, 0.1][min(3, int(t * 3 + 0.5))]; q.update(sy=1 - 0.3 * k, sx=1 + 0.25 * k, shift=-2 * k)
    elif anim == 'death':
        a = ss(t / 0.7); q.update(sy=1 - 0.8 * a, sx=1 + 0.7 * a, flat=a, wob=t * 0.5)
    sx, sy = q['sx'], q['sy']; z0 = q['shift'] + q['lunge']
    c = V(0, 5.2 * sy, z0); M.root = V(0, 0, q['lunge'])
    M.add(ellipsoid(c, (7.0 * sx, 5.2 * sy, 7.4 * sx)), AM_BODY, pid=1)
    # 일렁이는 혹들
    for k in range(7):
        a = k * TAU / 7 + 0.3
        r = 6.2 * sx + 1.2 * math.sin(TAU * q['wob'] + k * 1.9)
        cc = c + V(math.sin(a) * r * 0.75, -2.2 * sy + 0.6 * math.sin(k * 2.3), math.cos(a) * r * 0.75)
        M.add(ellipsoid(cc, (3.3 * sx, 2.8 * sy, 3.3 * sx)), AM_BODY, pid=1)
    # 위족(앞으로 뻗는 팔) 3개
    for k, a in enumerate((-0.6, 0.0, 0.6)):
        L = 4 + 7 * q['reach'] * (1.0 if k == 1 else 0.6) + 6 * q['open']
        a2 = a * (1 + q['open'] * 0.8)
        b0 = c + V(math.sin(a2) * 5 * sx, -2.6 * sy, math.cos(a2) * 5 * sx)
        b1 = b0 + V(math.sin(a2) * L, -1.4 * sy + 2.5 * q['open'], math.cos(a2) * L)
        limb(M, b0, b1, 2.6 * sx, 1.0, AM_BODY, pid=2)
    # 뒤쪽 꼬리 혹
    limb(M, c + V(0, -2.5 * sy, -5 * sx), c + V(0, -3.6 * sy, -9 * sx + 1.5 * q['reach']), 2.4, 1.2, AM_BODY, pid=2)
    # 핵(살짝 튀어나온 보라색) + 빛나는 액포
    M.add(ellipsoid(c + V(-0.6, 3.6 * sy, -1.4), (2.8, 2.0 * sy + 0.2, 2.6)), AM_NUC, pid=3)
    M.decal(c + V(-0.6, 5.6 * sy + 0.2, -1.2), '#e0a8ff', 1, 1.5)
    for k, (x, z) in enumerate(((2.8, 1.5), (-3.2, 2.0), (3.5, -2.5), (-1.5, -4.0))):
        M.add(ellipsoid(c + V(x * sx, 3.6 * sy - abs(x) * 0.2, z * sx), 0.9), AM_VAC, pid=4 + k)
    # 눈 두 개 + 입(공격 때 벌어짐)
    for s in (1, -1):
        M.add(ellipsoid(c + V(s * 2.0, 2.6 * sy, 6.2 * sx), 1.0), AM_EYE, pid=10)
        M.decal(c + V(s * 2.0, 2.6 * sy, 7.2 * sx), '#1a1000', 1, 1.0)
    if q['open'] > 0.05:
        M.add(oriented_ellipsoid(c + V(0, 0.2 * sy, 7.0 * sx), np.eye(3), (3.0 * q['open'] + 0.5, 1.6 * q['open'] + 0.2, 0.6)), AM_NUC, pid=11)
    return M

# ======================================================================== 3. 대장균 돌격병
BA_BODY = M_(['#3a0a2c', '#701a52', '#b03680', '#e670b2', '#ffc8e6'])
BA_PILI = M_(['#4a1a3a', '#8a3a6a', '#c070a0', '#f0b0d8'])
BA_FLAG = M_(['#3a1a30', '#6a3a5a', '#a06a8e', '#d8a8c8'])
BA_EYE = M_(['#5a4800', '#e8c020', '#fff6a0', '#ffffff'], True, '#ffe040')
def bacillus(anim, t):
    M = Model()
    q = dict(h=6.0, fwd=0.0, roll=0.0, sq=1.0, ph=t, amp=1.0, pitch=0.0, flat=0.0)
    if anim == 'idle': q.update(h=6 + 0.6 * math.sin(TAU * t), roll=0.1 * math.sin(TAU * t), ph=t)
    elif anim == 'move': q.update(h=6 + 0.4 * math.sin(TAU * t * 2), roll=0.15 * math.sin(TAU * t), ph=t * 2, amp=1.4, pitch=0.08)
    elif anim == 'attack':
        q.update(keys(t, [(0, dict(fwd=0, sq=1, pitch=0)), (0.35, dict(fwd=-3, sq=0.78, pitch=-0.12)), (0.55, dict(fwd=9, sq=1.25, pitch=0.12)),
                          (0.75, dict(fwd=7, sq=0.9, pitch=-0.05)), (1, dict(fwd=0, sq=1, pitch=0))]))
        q['ph'] = t * 3; q['amp'] = 1.6
    elif anim == 'hit':
        k = [1, 0.7, 0.4, 0.1][min(3, int(t * 3 + 0.5))]; q.update(fwd=-2.5 * k, pitch=-0.2 * k, sq=1 - 0.12 * k)
    elif anim == 'death':
        a = ss(t / 0.6); q.update(h=6 - 3.4 * a, roll=1.4 * a, flat=a, amp=1 - a)
    R = rot_x(q['pitch']) @ rot_z(q['roll'])
    c = V(0, q['h'], q['fwd']); M.root = V(0, 0, q['fwd'])
    L = 7.0 * q['sq']; r = 3.3 / math.sqrt(q['sq'])
    a, b = c + R @ V(0, 0, -L), c + R @ V(0, 0, L)
    limb(M, a, b, r, r, BA_BODY, pid=1)
    # 섬모(짧은 털)
    rnd = np.random.RandomState(3)
    for k in range(46):
        zz = rnd.uniform(-L - r * 0.6, L + r * 0.6); an = rnd.uniform(0, TAU)
        if abs(zz) > L:   # 끝 반구
            s = (abs(zz) - L) / (r * 0.6); rr = r * math.sqrt(max(0, 1 - s * s * 0.9))
        else: rr = r
        base = c + R @ V(math.cos(an) * rr, math.sin(an) * rr, zz)
        out = R @ nz(V(math.cos(an), math.sin(an), 0.3 * np.sign(zz) if abs(zz) > L else 0))
        wig = 0.3 * math.sin(TAU * q['ph'] + k)
        limb(M, base, base + out * 1.5 + R @ V(0, 0, wig), 0.22, 0.14, BA_PILI, pid=2)
    # 편모 3가닥 (뒤로 채찍질)
    for k in range(3):
        a0 = k * TAU / 3 + 0.5
        root = c + R @ V(math.cos(a0) * 1.4, math.sin(a0) * 1.4, -L - r + 0.6)
        pts = []
        for j in range(18):
            s = j / 17
            w = q['amp'] * 1.8 * s * math.sin(TAU * (s * 1.6 - q['ph'] * 2) + k)
            pts.append(root + R @ V(math.cos(a0) * (w + s * 2), math.sin(a0) * w * 0.6 - s * 1.5, -s * 13))
        chain(M, pts, [0.42 - 0.2 * j / 17 for j in range(18)], BA_FLAG, pid=3 + k)
    # 내부 핵양체 무늬 + 눈
    for k in range(5):
        M.decal(c + R @ V(math.sin(k * 2.1) * 1.2, r * 0.98, -L * 0.6 + k * L * 0.3), '#ff9ad0', 2, 1.2)
    for s in (1, -1):
        e = c + R @ V(s * 1.5, r * 0.55, L + r * 0.62)
        M.add(ellipsoid(e, 0.95), BA_EYE, pid=10)
        M.decal(e + R @ V(0, 0, 0.95), '#200a00', 1, 1.2)
    if q['flat'] > 0:
        M.parts = [(np.c_[p[:, 0], np.maximum(0.3, p[:, 1]), p[:, 2]], n, m, i) for p, n, m, i in M.parts]
    return M

# ======================================================================== 4. 암세포 거수 (대형)
BR_FLESH = M_(['#2e0a1c', '#5e1634', '#94294a', '#cc5664', '#f6a092'])
BR_LUMP = M_(['#4a1430', '#86264e', '#c04c6c', '#ec8a90', '#ffd0c0'])
BR_VEIN = M_(['#5a1690', '#9a3ae0', '#d08aff', '#f6e0ff'], True, '#b45aff')
BR_BONE = M_(['#5a5040', '#9a8a6a', '#d6c8a2', '#fff6dc'])
BR_EYE = M_(['#7a5a00', '#ffc800', '#fff2a0', '#ffffff'], True, '#ffd000')
def brute(anim, t, v=None):
    v = v or {}; M = Model()
    BR_FLESH_, BR_LUMP_ = v.get('flesh', BR_FLESH), v.get('lump', BR_LUMP)
    q = dict(drop=0.0, lean=0.45, twist=0.0, lth=0.1, lkn=0.3, rth=-0.1, rkn=0.3, rh=V(-9, 9, 6), lh=V(9, 8, 5), hp=0.0, fall=0.0, breathe=0.0, jaw=0.0)
    if anim == 'idle':
        b = math.sin(TAU * t); q.update(drop=0.6 + 0.6 * b, breathe=b, rh=V(-9.5, 7.5 + 0.8 * b, 6), lh=V(9, 7 + 0.6 * b, 5))
    elif anim == 'move':
        ph = TAU * t
        q.update(lth=0.6 * math.sin(ph), rth=-0.6 * math.sin(ph), lkn=0.3 + 0.9 * max(0, math.cos(ph)), rkn=0.3 + 0.9 * max(0, -math.cos(ph)),
                 drop=1.0 + 1.4 * abs(math.sin(ph)), twist=0.18 * math.sin(ph), lean=0.5,
                 rh=V(-9.5, 7.5, 6 + 3 * math.sin(ph)), lh=V(9, 7, 5 - 3 * math.sin(ph)))
    elif anim == 'attack':
        q.update(keys(t, [(0, dict(rh=V(-9.5, 7.5, 6), lh=V(9, 7, 5), lean=0.45, drop=0.6, twist=0, jaw=0)),
                          (0.38, dict(rh=V(-5, 25, -2), lh=V(5, 24, -2), lean=-0.15, drop=-0.5, twist=0, hp=-0.3, jaw=0.6)),
                          (0.55, dict(rh=V(-4, 3, 15), lh=V(4, 3, 14), lean=0.85, drop=5, twist=0, hp=0.2, lth=0.6, lkn=0.9, rth=-0.4, rkn=0.6, jaw=1)),
                          (0.75, dict(rh=V(-4, 2.5, 15), lh=V(4, 2.5, 14), lean=0.85, drop=5.2, hp=0.2, lth=0.6, lkn=0.9, rth=-0.4, rkn=0.6, jaw=0.5)),
                          (1, dict(rh=V(-9.5, 7.5, 6), lh=V(9, 7, 5), lean=0.45, drop=0.6, jaw=0))]))
    elif anim == 'roar':
        q.update(keys(t, [(0, dict(lean=0.45, hp=0, jaw=0, rh=V(-9.5, 7.5, 6), lh=V(9, 7, 5), drop=0.6)),
                          (0.3, dict(lean=-0.25, hp=-0.55, jaw=1, rh=V(-16, 17, 0), lh=V(16, 17, 0), drop=0, breathe=1)),
                          (0.7, dict(lean=-0.25, hp=-0.5, jaw=1, rh=V(-16.5, 18, 0), lh=V(16.5, 18, 0), drop=0, breathe=1)),
                          (1, dict(lean=0.45, hp=0, jaw=0, rh=V(-9.5, 7.5, 6), lh=V(9, 7, 5), drop=0.6))]))
        q['twist'] = 0.06 * math.sin(TAU * t * 4) * (0.3 < t < 0.75)
    elif anim == 'hit':
        k = [1, 0.7, 0.4, 0.1][min(3, int(t * 3 + 0.5))]; q.update(lean=0.45 - 0.4 * k, hp=-0.3 * k, drop=1.2 * k, rh=V(-11, 9 + 2 * k, 3), lh=V(11, 9 + 2 * k, 2))
    elif anim == 'death':
        a = ss(t / 0.5); b = ss((t - 0.3) / 0.5)
        q.update(lkn=0.3 + 1.4 * a, rkn=0.3 + 1.3 * a, lth=0.8 * a, rth=0.7 * a, drop=8 * a, lean=0.45 + 0.4 * a, rh=V(-11, 2, 8), lh=V(11, 2, 8), fall=1.3 * b, hp=0.3 * a)
    pel = V(0, 17.0 - q['drop'], 0)
    # 다리 (굵고 짧음)
    feet = {}
    for side, nm in ((1, 'l'), (-1, 'r')):
        hip = pel + V(side * 5.0, 0, 0)
        th, kn = q[nm + 'th'], q[nm + 'kn']
        kd = nz(V(side * 0.25, -math.cos(th), math.sin(th))); K = hip + kd * 8.5
        sd = nz(V(side * 0.15, -math.cos(th - kn), math.sin(th - kn))); A = K + sd * 8.0
        limb(M, hip, K, 4.2, 3.6, BR_FLESH_, pid=1); limb(M, K, A, 3.6, 3.0, BR_FLESH_, pid=2)
        M.add(ellipsoid(A + V(0, -1.0, 1.5), (3.6, 2.2, 4.6)), BR_FLESH_, pid=3)
        for k in range(3): limb(M, A + V(side * (k - 1) * 1.6, -1.6, 4.5), A + V(side * (k - 1) * 1.9, -2.6, 6.8), 0.9, 0.4, BR_BONE, pid=4)
        feet[nm] = A
    R = rot_y(q['twist']) @ rot_x(q['lean'])
    def up(v): return pel + R @ np.array(v, float)
    # 몸통: 혹이 붙은 거대한 덩어리
    M.add(ellipsoid(up([0, 4, 0]), (7.5, 6.0, 6.0)), BR_FLESH_, pid=10)
    br = 1 + 0.04 * q['breathe']
    M.add(oriented_ellipsoid(up([0, 13, -1]), R, (11.5 * br, 9.0 * br, 8.5 * br)), BR_FLESH_, pid=11)
    lumps = [(6, 19, -4, 4.2), (-7, 18, -5, 4.8), (0, 21, -6, 5.0), (9, 12, -3, 3.4), (-10, 13, -2, 3.8), (3, 9, -8, 3.6), (-4, 15, -9, 3.2), (8, 18, 1, 3.0)]
    for x, y, z, r in lumps:
        M.add(ellipsoid(up([x, y, z]), r * br), BR_LUMP_, pid=12)
    # 빛나는 혈관
    for k in range(6):
        a = k * 1.05
        p0 = up([math.sin(a) * 6, 8 + k, math.cos(a) * 6]); p1 = up([math.sin(a + 0.6) * 10, 14 + k * 0.8, math.cos(a + 0.6) * 7])
        limb(M, p0, p1, 0.4, 0.3, BR_VEIN, pid=13)
    # 등 뼈 가시
    for k in range(4):
        b0 = up([(-1) ** k * 2, 19 - k * 3, -8]); limb(M, b0, b0 + R @ V((-1) ** k * 1.2, 3.5, -3), 1.2, 0.3, BR_BONE, pid=14)
    if v.get('crown'):
        for k in range(7):
            a = -1.2 + k * 0.4; b0 = up([math.sin(a) * 6, 23, math.cos(a) * 3 - 3]); limb(M, b0, b0 + R @ V(math.sin(a) * 2, 6 - abs(a) * 2, -1.5), 1.3, 0.3, BR_BONE, pid=15)
    # 머리: 어깨에 파묻힌 작은 머리 + 눈 여러 개 + 턱
    Rh = R @ rot_x(q['hp'] - 0.25)
    hd = up([0, 19.5, 6.5])
    M.add(oriented_ellipsoid(hd, Rh, (4.4, 3.8, 4.2)), BR_LUMP_, pid=20)
    for x, y in ((-1.8, 1.0), (1.8, 1.2), (0, 2.2), (-3.0, -0.2), (3.0, 0.0)):
        e = hd + Rh @ V(x, y, 3.7 - abs(x) * 0.25)
        M.add(ellipsoid(e, 0.75 if y < 2 else 0.95), BR_EYE, pid=21)
        M.decal(e + Rh @ V(0, 0, 0.8), '#2a0a00', 1, 1.0)
    jaw = q['jaw']
    M.add(oriented_ellipsoid(hd + Rh @ V(0, -2.6 - 1.6 * jaw, 2.4), Rh @ rot_x(0.5 * jaw), (3.6, 1.4, 2.8)), BR_FLESH_, pid=22)
    if jaw > 0.1:
        M.add(oriented_ellipsoid(hd + Rh @ V(0, -1.9 - 0.7 * jaw, 3.6), Rh, (2.6, 0.9 * jaw + 0.2, 0.6)), M_(['#1a0408', '#3a0a14', '#5a1420', '#7a2030']), pid=23)
        for k in range(5): M.add(capsule(hd + Rh @ V(-2 + k, -1.2, 3.8), hd + Rh @ V(-2 + k, -1.9, 3.9), 0.3, 0.12), BR_BONE, pid=24)
    # 팔: 왼팔 보통 + 오른팔 거대한 종양 몽둥이
    for side, nm in ((1, 'l'), (-1, 'r')):
        S = up([side * 10.5, 17, 0.5])
        E, Hd = ik(S, up(q[nm + 'h']), side, R, L1=9.5, L2=9.0, pole=[side * 0.6, -0.2, -0.8])
        big = nm == 'r' or v.get('twin')
        limb(M, S, E, 3.6 if big else 3.0, 3.2 if big else 2.6, BR_FLESH_, pid=30)
        M.add(ellipsoid(S, 4.4 if big else 3.6), BR_LUMP_, pid=31)
        fa = nz(Hd - E)
        if big:
            pts = [E + fa * k * 2.6 for k in range(5)]
            for k, p in enumerate(pts): M.add(ellipsoid(p + V(0, 0.3 * math.sin(k * 2), 0), 3.0 + k * 0.9), BR_LUMP_ if k % 2 else BR_FLESH_, pid=32)
            fist = Hd + fa * 2.0
            M.add(ellipsoid(fist, (6.2, 5.6, 6.2)), BR_FLESH_, pid=33)
            for k in range(7):
                a = k * 0.9; d = nz(V(math.sin(a), math.cos(a * 1.3), math.cos(a)))
                M.add(ellipsoid(fist + d * 5.0, 2.3), BR_LUMP_, pid=34)
                if k % 2 == 0: limb(M, fist + d * 5.2, fist + d * 8.2, 1.0, 0.25, BR_BONE, pid=35)
            M.tips['fist'] = fist; M.tips['elbow'] = E
        else:
            limb(M, E, Hd, 2.6, 2.4, BR_FLESH_, pid=36)
            for k in range(3): limb(M, Hd + fa * 1.5 + V((k - 1) * 1.2, 0, 0), Hd + fa * 4.0 + V((k - 1) * 1.6, -1, 0), 0.8, 0.3, BR_BONE, pid=37)
    if q['fall'] > 0:
        Rf = rot_x(q['fall']); piv = V(0, 0, 4)
        M.parts = [((p - piv) @ Rf.T + piv, n @ Rf.T, m, i) for p, n, m, i in M.parts]
        lo = min(p[:, 1].min() for p, n, m, i in M.parts)
        M.parts = [(p - V(0, lo, 0), n, m, i) for p, n, m, i in M.parts]
        M.decals = [(((d - piv) @ Rf.T + piv) - V(0, lo, 0), c, s, b) for d, c, s, b in M.decals]
        M.tips = {k: ((v - piv) @ Rf.T + piv) - V(0, lo, 0) for k, v in M.tips.items()}
    return M

# ======================================================================== 5. 감염된 연구원
HZ_SUIT = M_(['#4a3a06', '#8a6e10', '#c8a420', '#ecd25a', '#fff2b0'])
HZ_DARK = M_(['#0c0e0a', '#1a1e16', '#2c3226', '#44503a'])
HZ_VISOR = M_(['#0a1e1a', '#123a32', '#2a6a5a', '#7ad8b8'])
HZ_FUNG = M_(['#2a0a3a', '#561a70', '#8a34a8', '#c27ae0', '#f0c8ff'])
HZ_GLOW = M_(['#6a2a8a', '#c05aff', '#ecb0ff', '#ffffff'], True, '#c05aff')
HZ_CLAW = M_(['#3a2a3a', '#6e5468', '#a88aa0', '#e8d4e0'])
def researcher(anim, t):
    M = Model()
    q = dict(HBASE)
    q.update(lean=0.3, hp=0.25, ht=0.15, drop=0.6, rh=(-7.5, 5, 4), lh=(7.2, 2, 1.5), w=(0, 1, 0), twist=0.0)
    if anim == 'idle':
        b = math.sin(TAU * t); jerk = 0.12 * (math.sin(TAU * t * 3) > 0.85)
        q.update(drop=0.6 + 0.4 * b, ht=0.15 + jerk, hp=0.25 + 0.05 * b, rh=(-7.5, 5 + 0.5 * b, 4), lh=(7.2, 2 + 0.3 * b, 1.5))
    elif anim == 'move':   # 절뚝이며 걷기
        ph = TAU * t
        q.update(lth=0.55 * math.sin(ph), rth=-0.45 * math.sin(ph), lkn=0.15 + 0.9 * max(0, math.cos(ph)), rkn=0.25 + 0.5 * max(0, -math.cos(ph)),
                 drop=0.8 + 0.9 * max(0, math.sin(ph)), tilt=0.12 * math.sin(ph), lean=0.38, ht=0.2 * math.sin(ph + 1),
                 rh=(-7.5, 6, 5 + 2 * math.sin(ph)), lh=(7, 2.5, 1 - 2 * math.sin(ph)))
    elif anim == 'attack':
        q.update(keys(t, [(0, dict(rh=(-7.5, 5, 4), twist=0, lean=0.3, drop=0.6)),
                          (0.35, dict(rh=(-9, 15, -4), twist=-0.6, lean=0.0, drop=0.8, hp=0.0, lth=0.2, rth=-0.3)),
                          (0.55, dict(rh=(3, 4, 12), twist=0.5, lean=0.55, drop=2.0, fwd=3.5, lth=0.7, lkn=0.6, rth=-0.5, rkn=0.4)),
                          (0.75, dict(rh=(5, 3, 9), twist=0.6, lean=0.5, drop=1.8, fwd=3.5, lth=0.6, lkn=0.6, rth=-0.5, rkn=0.4)),
                          (1, dict(rh=(-7.5, 5, 4), twist=0, lean=0.3, drop=0.6, fwd=0))]))
    elif anim == 'hit':
        k = [1, 0.7, 0.4, 0.1][min(3, int(t * 3 + 0.5))]; q.update(lean=0.3 - 0.45 * k, hp=0.25 - 0.4 * k, fwd=-1.5 * k, drop=0.6 + 0.6 * k, lh=(8, 4 + 3 * k, -1))
    elif anim == 'death':
        a = ss(t / 0.45); b = ss((t - 0.3) / 0.5)
        q.update(lkn=0.2 + 1.5 * a, rkn=0.2 + 1.4 * a, lth=0.8 * a * (1 - b), rth=0.6 * a * (1 - b), drop=6 * a, lean=0.3 + 0.5 * a, hp=0.25 + 0.3 * a,
                 rh=(-7, 2 + 4 * b, 6), lh=(7, 2, 6))
        q['fall'] = -1.35 * b   # 앞으로 엎어짐
    J = hskel(q); M.root = V(0, 0, q.get('fwd', 0.0))
    R = J['R']
    for s in 'lr':
        limb(M, J[s + 'hip'], J[s + 'kn'], 2.9, 2.5, HZ_SUIT, pid=1)
        limb(M, J[s + 'kn'], J[s + 'an'] + V(0, 1.4, 0), 2.5, 2.2, HZ_SUIT, pid=2)
        A = J[s + 'an']
        limb(M, A + V(0, 1.8, 0), A + V(0, -0.6, 0), 2.3, 2.2, HZ_DARK, pid=3)
        limb(M, A + V(0, -1.0, -0.6), A + V(0, -1.3, 3.6), 1.9, 1.6, HZ_DARK, pid=3)
    M.add(oriented_ellipsoid(J['pel'] + R @ V(0, 1, 0), R, (5.2, 3.2, 3.6)), HZ_SUIT, pid=4)
    M.add(oriented_ellipsoid(J['abd'], R, (4.8, 4.2, 3.6)), HZ_SUIT, pid=5)
    M.add(oriented_ellipsoid(J['chest'], R, (6.0, 5.2, 4.0)), HZ_SUIT, pid=6)
    M.add(oriented_ellipsoid(J['pel'] + R @ V(0, 2.6, 0), R, (5.4, 0.8, 3.9)), HZ_DARK, pid=7)
    # 가슴 경고 표식 + 산소통
    for k in range(3):
        a = k * TAU / 3 + 0.5; M.decal(J['chest'] + R @ V(math.cos(a) * 1.0, 0.5 + math.sin(a) * 1.0, 4.1), '#1a1408', 1, 1.6)
    tank = J['chest'] + R @ V(0, -0.5, -4.8)
    limb(M, tank + R @ V(0, -4, 0), tank + R @ V(0, 4, 0), 2.2, 2.2, M_(['#20262e', '#3e4a58', '#66788c', '#a8bacc']), pid=8)
    # 곰팡이 혹(등·왼어깨) + 빛나는 포자 점
    grow = [((2.5, 3.0, -6.5), 3.2), ((-1.5, 5.5, -6.0), 2.6), ((5.5, 12.5, -1.0), 2.8), ((4.0, 14.5, -2.5), 2.0), ((-2.0, 0.5, -6.8), 2.2), ((6.8, 10.0, 1.2), 1.8)]
    for (x, y, z), r in grow:
        c = J['pel'] + R @ V(x, y + 9.2, z)
        M.add(ellipsoid(c, r), HZ_FUNG, pid=9)
        M.add(ellipsoid(c + R @ nz(V(x * 0.2, 1, z * 0.15)) * r * 0.9, r * 0.35), HZ_GLOW, pid=10)
    # 팔: 왼팔 보통, 오른팔은 뼈 발톱으로 변이
    for s in 'lr':
        sh, el, ha = J[s + 'sh'], J[s + 'el'], J[s + 'ha']
        M.add(ellipsoid(sh, 2.8), HZ_SUIT, pid=11)
        limb(M, sh, el, 2.4, 2.2, HZ_SUIT, pid=12)
        fa = nz(ha - el)
        if s == 'l':
            limb(M, el, ha - fa * 0.6, 2.2, 1.9, HZ_SUIT, pid=13); M.add(ellipsoid(ha + fa * 0.4, 1.7), HZ_DARK, pid=14)
        else:
            limb(M, el, ha - fa * 2.0, 2.2, 2.0, HZ_FUNG, pid=15)
            M.add(ellipsoid(ha - fa * 1.0, 2.4), HZ_FUNG, pid=16)
            side = nz(np.cross(fa, R @ V(0, 1, 0))); upv = nz(np.cross(side, fa))
            for k in (-1, 0, 1):
                b0 = ha + side * k * 1.1
                pts = [b0, b0 + fa * 3.5 + side * k * 1.0 + upv * 0.6, b0 + fa * 7.0 + side * k * 1.4 - upv * 0.8]
                chain(M, pts, [0.8, 0.5, 0.15], HZ_CLAW, pid=17)
            M.tips['claw'] = ha + fa * 7.0; M.tips['wrist'] = ha + fa * 2.5
    # 머리: 후드 + 깨진 보호창
    H = J['head']; Rh = J['Rh']
    M.add(oriented_ellipsoid(H + Rh @ V(0, 0.4, -0.3), Rh, (5.0, 5.4, 5.0)), HZ_SUIT, pid=20)
    M.add(oriented_ellipsoid(H + Rh @ V(0, 0.2, 3.6), Rh, (3.6, 3.0, 1.6)), HZ_VISOR, pid=21)
    for a, b in (((-1.5, 1.4), (0.3, -0.6)), ((0.3, -0.6), (1.6, 0.2)), ((0.3, -0.6), (-0.2, -2.0))):
        M.add(capsule(H + Rh @ V(a[0], a[1], 5.1), H + Rh @ V(b[0], b[1], 5.1), 0.18, 0.18), M_(['#a0f0d0', '#d8fff0', '#ffffff', '#ffffff'], True), pid=22)
    for s in (1, -1): M.decal(H + Rh @ V(s * 1.2, 0.3, 5.2), '#c05aff', 1, 1.2)
    M.add(ellipsoid(H + Rh @ V(-3.5, 2.6, -1.5), 2.0), HZ_FUNG, pid=23); M.add(ellipsoid(H + Rh @ V(-3.8, 3.8, -1.2), 0.8), HZ_GLOW, pid=24)
    # 바닥 맞추기 + 엎어짐
    soles = min(J['lan'][1], J['ran'][1]) - 2.4
    T = V(0, -soles, 0)
    fall = q.get('fall', 0)
    Rf = rot_x(-fall); piv = V(0, 0, 3.0)
    def tf(p):
        p = p + T
        if fall: p = (p - piv) @ Rf.T + piv
        return p
    M.parts = [(tf(p), n @ Rf.T if fall else n, m, i) for p, n, m, i in M.parts]
    if fall:
        lo = min(p[:, 1].min() for p, n, m, i in M.parts)
        M.parts = [(p - V(0, lo, 0), n, m, i) for p, n, m, i in M.parts]; T2 = V(0, -lo, 0)
    else: T2 = V(0, 0, 0)
    M.decals = [(tf(d[None])[0] + T2, c, s, b) for d, c, s, b in M.decals]
    M.tips = {k: tf(v[None])[0] + T2 for k, v in M.tips.items()}
    return M

# ======================================================================== 6. 모기 매개체 (비행)
MQ_BODY = M_(['#140c08', '#2c1c12', '#4a3220', '#725038', '#a07a58'])
MQ_STRIPE = M_(['#4a4a44', '#8a8a80', '#c8c8b8', '#f4f4e8'])
MQ_BLOOD = M_(['#6a0a10', '#c01a24', '#ff4a4a', '#ffb0a0'], True, '#ff3a3a')
MQ_EYE = M_(['#5a0a0a', '#c0202a', '#ff6a5a', '#ffd0c0'], True, '#ff4040')
MQ_WING = M_(['#4a5a6a', '#7a8ea4', '#a8bed2', '#d4e6f2'])
MQ_LEG = M_(['#100a06', '#241810', '#3e2c1e', '#5e4430'])
def mosquito(anim, t):
    M = Model()
    q = dict(h=19.0, fwd=0.0, pitch=0.15, flap=0.0, fall=0.0, legs=0.0, belly=1.0)
    fl = lambda ph: math.sin(ph)
    if anim == 'idle': q.update(h=19 + 1.2 * math.sin(TAU * t), flap=math.sin(TAU * t * 3))
    elif anim == 'move': q.update(h=19 + 0.8 * math.sin(TAU * t * 2), flap=math.sin(TAU * t * 3), pitch=0.45, legs=0.6)
    elif anim == 'attack':
        q.update(keys(t, [(0, dict(h=19, fwd=0, pitch=0.15)), (0.35, dict(h=23, fwd=-3, pitch=-0.25)), (0.55, dict(h=9, fwd=9, pitch=0.85)),
                          (0.75, dict(h=10, fwd=9, pitch=0.8)), (1, dict(h=19, fwd=0, pitch=0.15))]))
        q['flap'] = math.sin(TAU * t * 4); q['legs'] = 0.8 if 0.3 < t < 0.8 else 0.2
    elif anim == 'hit':
        k = [1, 0.7, 0.4, 0.1][min(3, int(t * 3 + 0.5))]; q.update(h=19 - 2 * k, fwd=-2.5 * k, pitch=-0.3 * k, flap=0.5)
    elif anim == 'death':
        a = ss(t / 0.6); q.update(h=19 - 16 * a, pitch=0.15 + 1.2 * a, fall=a, flap=0.7 * (1 - a), legs=-a)
    R = rot_x(q['pitch']) @ rot_z(0.6 * q['fall'])
    c = V(0, q['h'], q['fwd']); M.root = V(0, 0, q['fwd'])
    def P(v): return c + R @ np.array(v, float)
    # 가슴(흉부) + 배(피로 부푼 붉은 배) + 머리
    M.add(oriented_ellipsoid(P([0, 0, 0]), R, (2.6, 2.6, 3.2)), MQ_BODY, pid=1)
    ab = [P([0, -0.8 - k * 0.9, -3.0 - k * 1.9]) for k in range(6)]
    for k, p in enumerate(ab):
        r = [2.2, 2.7, 3.0, 2.9, 2.4, 1.6][k] * q['belly']
        M.add(oriented_ellipsoid(p, R, (r * 0.9, r * 0.85, 1.4)), MQ_BODY if k % 2 == 0 else MQ_STRIPE, pid=2 + k)
        if 1 <= k <= 4: M.add(oriented_ellipsoid(p + R @ V(0, -r * 0.45, 0), R, (r * 0.6, r * 0.45, 1.0)), MQ_BLOOD, pid=10 + k)
    hd = P([0, 0.6, 3.6])
    M.add(ellipsoid(hd, 1.7), MQ_BODY, pid=20)
    for s in (1, -1): M.add(oriented_ellipsoid(hd + R @ V(s * 1.2, 0.3, 0.6), R, (1.0, 1.25, 1.0)), MQ_EYE, pid=21)
    limb(M, hd + R @ V(0, -0.6, 1.2), hd + R @ V(0, -4.5, 7.5), 0.35, 0.12, MQ_LEG, pid=22)   # 주둥이(침)
    for s in (1, -1): limb(M, hd + R @ V(s * 0.6, 0.6, 1.4), hd + R @ V(s * 2.6, 2.4, 4.6), 0.22, 0.1, MQ_LEG, pid=23)   # 더듬이
    M.tips['stinger'] = hd + R @ V(0, -4.5, 7.5)
    # 다리 6개 (가늘고 길게 늘어짐)
    for k in range(3):
        for s in (1, -1):
            root = P([s * 1.6, -1.6, 1.2 - k * 1.4])
            spread = 1 + 0.5 * q['legs']
            kn = root + R @ V(s * 3.5 * spread, 1.2, (1.6 - k * 1.6) * spread)
            ft = kn + V(s * 1.2, -7.5 + 3 * max(0, q['legs']), (1.0 - k * 1.2) * spread) + (V(0, 6, 0) if q['legs'] < 0 else 0) * -q['legs']
            chain(M, [root, kn, ft], [0.3, 0.25, 0.12], MQ_LEG, pid=30 + k)
    # 날개 2쌍 (얇은 판, 빠른 날갯짓)
    fa = q['flap']
    for s in (1, -1):
        for j, (ln, off) in enumerate(((10.0, 0.0), (6.5, -1.4))):
            root = P([s * 1.8, 1.4, 0.6 + off])
            ang = (0.25 + 0.95 * fa) * s
            d = R @ nz(V(s * math.cos(0.55 * fa + 0.1), math.sin(0.9 * fa + 0.15), -0.45))
            ctr = root + d * ln * 0.5
            side = nz(np.cross(d, R @ V(0, 1, 0)));
            if np.linalg.norm(side) < 1e-3: side = R @ V(0, 0, 1)
            nrm = nz(np.cross(d, side))
            M.add(oriented_ellipsoid(ctr, np.stack([d, side, nrm], 1), (ln * 0.5, 1.9 if j == 0 else 1.4, 0.18)), MQ_WING, pid=40 + j + (s > 0) * 2)
            for k in range(3): M.decal(root + d * ln * (0.3 + k * 0.25), '#5a6a7a', 1, 0.8)
    return M

# ======================================================================== 7. 촌충 (땅에서 솟는 벌레)
WM_BODY = M_(['#4a3a2a', '#8a7058', '#c8ac88', '#ecd6b4', '#fff6e4'])
WM_RING = M_(['#5a2a2a', '#9a4a48', '#d4807a', '#f4b8a8'])
WM_HOOK = M_(['#3a3430', '#6e6458', '#b0a490', '#ece4d4'])
WM_MAW = M_(['#5a0a2a', '#c0205a', '#ff6a9a', '#ffd0e0'], True, '#ff4a8a')
WM_SUCK = M_(['#1a0a10', '#3a1620', '#5a2834', '#7a3c48'])
def worm(anim, t):
    M = Model()
    q = dict(rise=1.0, wave=0.0, amp=0.6, lunge=0.0, coil=0.0, open=0.3, flat=0.0, hb=0.0)
    if anim == 'idle': q.update(wave=t, amp=0.7, hb=0.6 * math.sin(TAU * t), open=0.25 + 0.15 * math.sin(TAU * t))
    elif anim == 'move': q.update(wave=t * 2, amp=1.6, rise=0.75, open=0.2)
    elif anim == 'attack':
        q.update(keys(t, [(0, dict(lunge=0, coil=0, open=0.3, rise=1)), (0.35, dict(lunge=-3, coil=1, open=0.6, rise=1.15)),
                          (0.55, dict(lunge=11, coil=-0.3, open=1.0, rise=0.75)), (0.75, dict(lunge=10, coil=-0.2, open=0.2, rise=0.75)),
                          (1, dict(lunge=0, coil=0, open=0.3, rise=1))]))
        q['wave'] = t * 0.5
    elif anim == 'hit':
        k = [1, 0.7, 0.4, 0.1][min(3, int(t * 3 + 0.5))]; q.update(lunge=-3 * k, coil=0.6 * k, rise=1 - 0.2 * k)
    elif anim == 'death':
        a = ss(t / 0.7); q.update(rise=1 - a, flat=a, amp=0.6 + 1.2 * a, wave=t, open=0.3 + 0.7 * a)
    N = 16; pts = []
    for k in range(N + 1):
        s = k / N
        # 땅을 기는 꼬리 → 솟아오른 몸통 → 머리
        z = -15 + 17 * min(s, 0.6) / 0.6
        y = 1.6
        if s > 0.55:
            u = (s - 0.55) / 0.45
            hgt = 16 * q['rise'] * math.sin(u * math.pi / 2) + q['hb'] * u
            y = 1.6 + hgt * (1 - 0.15 * q['coil'])
            z = 2 + u * (5 - 6 * q['coil']) + q['lunge'] * u ** 2
            y -= q['lunge'] * 0.55 * u ** 3 * (q['lunge'] > 0)
        x = q['amp'] * 2.4 * math.sin(TAU * (s * 1.3 - q['wave'])) * (1 - s * 0.7)
        if q['flat'] > 0: y = lerp(y, 1.4 + 0.6 * math.sin(s * 9), q['flat'])
        pts.append(V(x, max(y, 1.2), z))
    rads = [1.2 + 1.6 * math.sin(min(1, k / N * 1.4) * math.pi / 2) for k in range(N + 1)]
    for k in range(N + 1):
        p = pts[k]; d = nz(pts[min(N, k + 1)] - pts[max(0, k - 1)])
        ax = frame_from(d, V(0, 1, 0) if abs(d[1]) < 0.9 else V(0, 0, 1))
        M.add(oriented_ellipsoid(p, ax, (rads[k] * 1.15, 0.95, rads[k] * 0.95)), WM_BODY, pid=1 + k % 2)
        if k % 2: M.add(oriented_ellipsoid(p, ax, (rads[k] * 1.2, 0.35, rads[k] * 1.0)), WM_RING, pid=40)
    # 머리 (갈고리 왕관 + 빨판 4개 + 빛나는 입)
    hd = pts[-1]; d = nz(pts[-1] - pts[-3])
    ax = frame_from(d, V(0, 0, 1) if abs(d[1]) > 0.9 else V(0, 1, 0))
    fwd = d; side = nz(np.cross(fwd, V(0, 1, 0))) if abs(fwd[1]) < 0.95 else V(1, 0, 0); up_ = nz(np.cross(side, fwd))
    hc = hd + fwd * 1.6
    M.add(ellipsoid(hc, 3.3), WM_BODY, pid=50)
    for k in range(4):
        a = k * TAU / 4 + 0.785
        sp = hc + (side * math.cos(a) + up_ * math.sin(a)) * 2.4 + fwd * 1.2
        M.add(oriented_ellipsoid(sp, np.stack([side, up_, fwd], 1), (1.0, 1.0, 0.6)), WM_SUCK, pid=51)
    for k in range(10):
        a = k * TAU / 10
        r0 = hc + fwd * 2.6 + (side * math.cos(a) + up_ * math.sin(a)) * 1.6
        tip = r0 + fwd * (1.2 + 1.4 * q['open']) + (side * math.cos(a) + up_ * math.sin(a)) * (0.6 + 2.0 * q['open'])
        limb(M, r0, tip, 0.35, 0.12, WM_HOOK, pid=52)
    M.add(oriented_ellipsoid(hc + fwd * 2.9, np.stack([side, up_, fwd], 1), (0.6 + 1.0 * q['open'], 0.6 + 1.0 * q['open'], 0.4)), WM_MAW, pid=53)
    M.tips['head'] = hc
    return M

# ======================================================================== 8. 포자 버섯 포탑
SH_CAP = M_(['#4a0e06', '#8a2210', '#c84a1e', '#f08a3e', '#ffd09a'])
SH_STALK = M_(['#5a5040', '#9a8c70', '#d4c6a2', '#f6ecd0'])
SH_GILL = M_(['#3a2a20', '#5e4634', '#86684c', '#ae8e6a'])
SH_SAC = M_(['#3a6a10', '#7ac81e', '#c8ff6a', '#f4ffd0'], True, '#a8ff3a')
SH_ROOT = M_(['#2a2018', '#4a3a2a', '#6e5a42', '#94805e'])
SH_EYE = M_(['#4a5a00', '#b8e010', '#eaff7a', '#ffffff'], True, '#c8ff20')
def shroom(anim, t, v=None):
    v = v or {}; M = Model()
    SH_CAP_, SH_SAC_ = v.get('cap', SH_CAP), v.get('sac', SH_SAC)
    q = dict(sq=1.0, hop=0.0, lean=0.0, puff=0.0, droop=0.0, step=0.0, mouth=0.3, spore=0.0)
    if anim == 'idle': q.update(sq=1 + 0.05 * math.sin(TAU * t), mouth=0.3 + 0.1 * math.sin(TAU * t))
    elif anim == 'move':
        ph = TAU * t; q.update(hop=2.2 * abs(math.sin(ph)), sq=1 - 0.12 * math.cos(2 * ph), lean=0.12 * math.sin(ph), step=t)
    elif anim == 'attack':
        q.update(keys(t, [(0, dict(sq=1, puff=0, mouth=0.3, lean=0)), (0.35, dict(sq=0.72, puff=-0.3, mouth=0.1, lean=-0.1)),
                          (0.55, dict(sq=1.18, puff=1.0, mouth=1.0, lean=0.18)), (0.75, dict(sq=1.05, puff=0.6, mouth=0.7, lean=0.1)),
                          (1, dict(sq=1, puff=0, mouth=0.3, lean=0))]))
        q['spore'] = ss((t - 0.45) / 0.15) * (1 - ss((t - 0.7) / 0.3))
    elif anim == 'special':   # 납작 웅크렸다가 사방으로 포자 폭발
        q.update(keys(t, [(0, dict(sq=1, puff=0, mouth=0.3)), (0.4, dict(sq=0.6, puff=-0.4, mouth=0.1)),
                          (0.58, dict(sq=1.3, puff=1.5, mouth=1.0)), (0.8, dict(sq=1.1, puff=0.9, mouth=0.6)), (1, dict(sq=1, puff=0, mouth=0.3))]))
        q['spore'] = 1.6 * ss((t - 0.5) / 0.12) * (1 - ss((t - 0.75) / 0.25))
    elif anim == 'hit':
        k = [1, 0.7, 0.4, 0.1][min(3, int(t * 3 + 0.5))]; q.update(sq=1 - 0.25 * k, lean=-0.25 * k)
    elif anim == 'death':
        a = ss(t / 0.7); q.update(droop=a, sq=1 - 0.45 * a, lean=0.5 * a, mouth=0.6)
    R = rot_x(q['lean']) @ rot_z(0.4 * q['droop'])
    base = V(0, 2.2 + q['hop'], 0)
    # 뿌리 다리 4개
    for k in range(4):
        a = k * TAU / 4 + 0.785 + 0.3 * math.sin(TAU * q['step'] + k)
        r0 = base + V(math.sin(a) * 2.0, 0.5, math.cos(a) * 2.0)
        ft = V(math.sin(a) * 6.0, 0.4 + max(0, q['hop'] - 1.5) * 0.6, math.cos(a) * 6.0)
        chain(M, [r0, (r0 + ft) / 2 + V(0, 1.4, 0), ft], [1.3, 0.9, 0.5], SH_ROOT, pid=1)
    # 자루
    h = 9.5 * q['sq']
    top = base + R @ V(0, h, 0)
    limb(M, base, top, 3.4, 2.8, SH_STALK, pid=2)
    M.add(ellipsoid(base + V(0, 0.8, 0), (3.9, 1.8, 3.9)), SH_STALK, pid=2)
    # 얼굴 (자루 앞쪽): 눈 + 입
    fc = base + R @ V(0, h * 0.55, 3.0)
    for s in (1, -1):
        M.add(ellipsoid(fc + R @ V(s * 1.3, 0.9, 0.2), 0.8), SH_EYE, pid=3)
        M.decal(fc + R @ V(s * 1.3, 0.9, 1.0), '#1a2000', 1, 1.0)
    M.add(oriented_ellipsoid(fc + R @ V(0, -1.3, 0.1), R, (1.2 + 0.6 * q['mouth'], 0.3 + 0.9 * q['mouth'], 0.5)), SH_GILL if q['mouth'] < 0.5 else M_(['#1a0a04', '#3a1608', '#5a2210', '#7a3018']), pid=4)
    # 갓: 아래 주름 + 위 갓 + 흰 점 + 빛나는 포자 주머니
    pf = q['puff']; dr = q['droop']
    Rc = R @ rot_x(0.6 * dr)
    cc = top + Rc @ V(0, 1.2 - 2.0 * dr, 0)
    rx = 8.2 * (1 + 0.12 * pf) * (1 - 0.15 * dr); ry = 4.4 * (1 + 0.25 * pf) * (1 - 0.3 * dr)
    M.add(oriented_ellipsoid(cc + Rc @ V(0, -0.8, 0), Rc, (rx * 0.92, 1.3, rx * 0.92)), SH_GILL, pid=5)
    for k in range(16):
        a = k * TAU / 16
        M.add(capsule(cc + Rc @ V(math.sin(a) * 2.5, -1.0, math.cos(a) * 2.5), cc + Rc @ V(math.sin(a) * rx * 0.9, -0.9 - 1.2 * dr, math.cos(a) * rx * 0.9), 0.3, 0.25, caps=False), SH_ROOT, pid=6)
    pc, pn = ellipsoid(V(0, 0, 0), (rx, ry, rx))
    keep = pc[:, 1] > -0.6
    M.add(((pc[keep] @ Rc.T) + cc, pn[keep] @ Rc.T), SH_CAP_, pid=7)
    for k, (a, e) in enumerate(((0.3, 0.55), (1.6, 0.4), (2.7, 0.62), (3.9, 0.45), (5.0, 0.6), (5.8, 0.3), (1.0, 0.85), (3.3, 0.85))):
        d = V(math.sin(a) * math.cos(e), math.sin(e), math.cos(a) * math.cos(e))
        sp = cc + Rc @ (d * V(rx, ry, rx))
        if k % 3 == 0:
            M.add(ellipsoid(sp, 1.15 + 0.5 * pf), SH_SAC_, pid=8 + k)
        else:
            for dx, dz in ((0, 0), (0.7, 0), (0, 0.7), (-0.7, 0), (0, -0.7)): M.decal(sp + Rc @ V(dx, 0.3, dz), '#fff0dc', 1, 1.6)
    # 공격: 갓 위로 포자 구름
    if q['spore'] > 0.05:
        rnd = np.random.RandomState(4)
        for k in range(14 + 10 * (q['spore'] > 1.05)):
            a = rnd.uniform(0, TAU); r = rnd.uniform(1, 9) * q['spore']
            M.add(ellipsoid(cc + V(math.sin(a) * r, ry + 1 + rnd.uniform(0, 7) * q['spore'], math.cos(a) * r), 0.5 + 1.0 * q['spore'] * rnd.uniform(0.4, 1)), SH_SAC_, pid=30 + k)
    if v.get('horns'):   # 거목: 갓 테두리의 뿔 균사
        for k in range(10):
            a = k * TAU / 10
            p0 = cc + Rc @ V(math.sin(a) * rx * 0.95, -0.4, math.cos(a) * rx * 0.95)
            limb(M, p0, p0 + Rc @ V(math.sin(a) * 2.5, -3.5, math.cos(a) * 2.5), 0.7, 0.2, SH_ROOT, pid=60)
        for k in range(5):
            a = k * TAU / 5 + 0.3; r0 = base + V(math.sin(a) * 3, 0.5, math.cos(a) * 3)
            chain(M, [r0, r0 + V(math.sin(a) * 5, 2, math.cos(a) * 5), V(math.sin(a) * 11, 0.3, math.cos(a) * 11)], [1.4, 1.0, 0.5], SH_ROOT, pid=61)
    M.tips['cap'] = cc + V(0, ry, 0)
    return M

# ======================================================================== 목록
STD = [('idle', 8, True, '대기'), ('move', 8, True, '이동'), ('attack', 8, False, '공격'), ('hit', 4, False, '피격'), ('death', 8, False, '죽음')]
MOBS = {
    'phage':   dict(name='파지 거미', desc='정이십면체 머리에 꼬리 섬유 여섯 개로 걷는 박테리오파지. 몸을 일으켰다가 꼬리를 내리꽂아 유전자를 주입한다.', fn=phage, scale=1.15, rootmul=2.0, cell=144, foot=112, tint='#c070ff', role='근접 돌격'),
    'amoeba':  dict(name='아메바 포식자', desc='위족을 뻗어 기어 오는 젤리 같은 원생생물. 몸을 크게 부풀려 덮쳐서 삼킨다.', fn=amoeba, scale=1.45, rootmul=2.5, cell=160, foot=118, tint='#46e0a8', role='느린 탱커'),
    'bacillus': dict(name='대장균 돌격병', desc='섬모로 덮인 막대 모양 세균. 편모를 채찍질하며 떠다니다가 일직선으로 들이받는다.', fn=bacillus, scale=1.35, rootmul=3.0, cell=144, foot=108, tint='#ff70c0', role='돌진'),
    'brute':   dict(name='암세포 거수', desc='끝없이 분열한 세포가 뭉친 거대한 덩어리. 종양 몽둥이 팔로 땅을 내려친다.', fn=brute, cell=192, foot=158, tint='#c04aff', role='정예 · 대형', extra=[('roar', 8, False, '포효')]),
    'researcher': dict(name='감염된 연구원', desc='곰팡이에 잠식된 방호복 연구원. 뼈 발톱으로 변한 오른팔을 휘두른다.', fn=researcher, rootmul=1.6, cell=160, foot=124, tint='#c05aff', role='근접'),
    'mosquito': dict(name='모기 매개체', desc='피로 부푼 배를 단 거대 모기. 공중을 맴돌다 침을 내리꽂는다.', fn=mosquito, scale=1.3, rootmul=2.5, cell=144, foot=126, tint='#ff4a4a', role='비행 · 급습'),
    'worm':    dict(name='촌충', desc='바닥을 기다 몸을 세우는 마디 벌레. 갈고리 입으로 앞으로 덮쳐 문다.', fn=worm, scale=1.3, cell=160, foot=118, tint='#ff7aa0', role='근접 · 돌출'),
    'shroom':  dict(name='포자 버섯', desc='뿌리 다리로 뒤뚱거리는 버섯. 갓을 부풀렸다 터뜨려 포자 구름을 뿜는다.', fn=shroom, scale=1.45, cell=144, foot=116, tint='#a8ff3a', role='원거리 포탑'),
}
for k, m in MOBS.items():
    m['anims'] = STD[:3] + m.get('extra', []) + STD[3:]
    if k == 'mosquito': m['anims'] = [('idle', 6, True, '대기'), ('move', 6, True, '비행')] + STD[2:]
    if k == 'brute': m['anims'] = [('idle', 8, True, '대기'), ('move', 8, True, '이동'), ('attack', 10, False, '내려치기'), ('roar', 8, False, '포효'), ('hit', 4, False, '피격'), ('death', 10, False, '죽음')]
SMEAR = {('brute', 'attack'): ('elbow', 'fist', 0.42, 0.62), ('researcher', 'attack'): ('wrist', 'claw', 0.38, 0.62)}

def make(mid, aid, t):
    """동작 시각 t의 모델: 크기 배율, 강화형 설정, 제자리 이동량(root) 분리"""
    m = MOBS[mid]; k = m.get('scale', 1.0)
    a = m.get('alias', {}).get(aid, aid)
    M = m['fn'](a, t, m['v']) if m.get('v') is not None else m['fn'](a, t)
    root = getattr(M, 'root', None)
    if root is not None and m.get('rootmul', 0) > 0:
        off = V(root[0], 0, root[2])
        M.parts = [(p - off, n, mm, i) for p, n, mm, i in M.parts]
        M.decals = [(d - off, c, s_, b) for d, c, s_, b in M.decals]
        M.tips = {kk: vv - off for kk, vv in M.tips.items()}
        M.rootpx = float(root[2]) * k * 2.0 * m['rootmul']
    else: M.rootpx = 0.0
    if k != 1.0:
        M.parts = [(p * k, n, mm, i) for p, n, mm, i in M.parts]
        M.decals = [(d * k, c, s_, b) for d, c, s_, b in M.decals]
        M.tips = {kk: vv * k for kk, vv in M.tips.items()}
    return M
