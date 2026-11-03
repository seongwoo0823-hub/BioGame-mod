# 헬릭스 일반 몬스터 9~16번 (강화형 지원: v)
from mobs import *
import rig

def tri_mesh(M, tris, mat, pid=None, center=None):
    """평평한 면 삼각형 목록 → 점 (각진 결정용)"""
    ps, ns = [], []
    for A, B, D in tris:
        n = nz(np.cross(B - A, D - A))
        if center is not None and np.dot(n, (A + B + D) / 3 - center) < 0: n = -n
        k = int(max(np.linalg.norm(B - A), np.linalg.norm(D - A)) * DENS * 1.3) + 2
        for i in range(k + 1):
            for j in range(k + 1 - i):
                ps.append(A + (B - A) * i / k + (D - A) * j / k); ns.append(n)
    M.add((np.array(ps), np.array(ns)), mat, pid)

def crystal(M, c, d, L, r, mat, pid=None, n=6, rot=0.0, back=0.35):
    d = nz(d); _, u, w = rig._basis(d)
    top = c + d * L * (1 - back); bot = c - d * L * back
    ring = [c + (u * math.cos(rot + k * TAU / n) + w * math.sin(rot + k * TAU / n)) * r for k in range(n)]
    tris = []
    for k in range(n):
        a, b = ring[k], ring[(k + 1) % n]; tris.append((top, a, b)); tris.append((bot, b, a))
    tri_mesh(M, tris, mat, pid, center=c)
    return top

# ======================================================================== 9. 프리온 결정
PR_CRY = M_(['#2e0c2a', '#6a2058', '#a84a8e', '#e294c8', '#fff0fa'])
PR_DARK = M_(['#14060e', '#2e1020', '#4e1e38', '#723456'])
PR_CORE = M_(['#7a0a24', '#e01e4a', '#ff7a96', '#ffe0e8'], True, '#ff3a6a')
def prion(anim, t, v=None):
    v = v or {}; M = Model()
    q = dict(h=11.0, spin=t * TAU * 0.25, open=0.0, shot=0.0, tilt=0.0, fwd=0.0, shatter=0.0, glow=0.5)
    if anim == 'idle': q.update(h=11 + 0.8 * math.sin(TAU * t), glow=0.5 + 0.3 * math.sin(TAU * t))
    elif anim == 'move': q.update(h=11 + 0.5 * math.sin(TAU * t * 2), spin=t * TAU * 0.5, tilt=0.25)
    elif anim == 'attack':
        q.update(keys(t, [(0, dict(open=0, shot=0, glow=0.5)), (0.4, dict(open=-0.35, shot=0, glow=1.5)), (0.55, dict(open=0.5, shot=1, glow=1.2)),
                          (0.8, dict(open=0.2, shot=1, glow=0.6)), (1, dict(open=0, shot=0, glow=0.5))]))
    elif anim == 'special':   # 결정이 활짝 펼쳐져 회전하며 사방으로 쏨
        q.update(keys(t, [(0, dict(open=0, glow=0.5)), (0.35, dict(open=-0.4, glow=1.8)), (0.55, dict(open=1.1, glow=2.0)), (0.8, dict(open=0.8, glow=1.2)), (1, dict(open=0, glow=0.5))]))
        q['spin'] = TAU * ss(t) * 1.5
    elif anim == 'hit':
        k = [1, 0.7, 0.4, 0.1][min(3, int(t * 3 + 0.5))]; q.update(tilt=-0.4 * k, h=11 - 1.5 * k, open=0.2 * k)
    elif anim == 'death':
        a = ss(t / 0.7); q.update(shatter=a, h=11 - 6 * a, glow=0.5 * (1 - a))
    c = V(0, q['h'], 0); R = rot_x(q['tilt'])
    g = q['glow']; big = v.get('giant')
    M.add(ellipsoid(c, 2.0 + 0.5 * g), PR_CORE, pid=1)
    crystal(M, c, V(0, 1, 0), 6.5, 1.7, PR_CRY, pid=2, rot=q['spin'])
    nsh = 9 if big else 6
    for k in range(nsh):
        a = q['spin'] + k * TAU / nsh; el = 0.5 * math.sin(k * 2.3)
        d = R @ nz(V(math.cos(a) * math.cos(el), math.sin(el) + 0.15, math.sin(a) * math.cos(el)))
        o = 2.4 + 2.0 * q['open'] + 9 * q['shatter'] * (0.6 + 0.4 * math.sin(k * 3.1))
        base = c + d * o
        if q['shatter'] > 0: base = base + V(0, -q['shatter'] * (4 + 3 * math.sin(k)), 0); base[1] = max(1.0, base[1])
        L = [5.5, 4.2, 6.5, 3.8, 5.0, 4.6, 5.8, 4.0, 6.0][k] * (1.25 if big else 1.0)
        crystal(M, base, d + V(0, 0.2 * math.sin(k), 0), L, 1.1 + 0.25 * (k % 2), PR_CRY if k % 3 else PR_DARK, pid=10 + k, rot=k)
    # 앞쪽 발사 결정
    if q['shot'] > 0:
        s = q['shot']; fp = c + R @ V(0, 0, 3 + 16 * s)
        crystal(M, fp, R @ V(0, 0, 1), 4.5, 1.0, PR_CRY, pid=30)
        M.add(ellipsoid(fp - R @ V(0, 0, 1.5), 0.9), PR_CORE, pid=31)
    if big:   # 거상: 바닥에서 솟은 결정 받침 + 띠
        for k in range(7):
            a = k * TAU / 7 + 0.3; p = V(math.cos(a) * 7, 0, math.sin(a) * 7)
            crystal(M, p, V(math.cos(a) * 0.3, 1, math.sin(a) * 0.3), 6 + 2 * (k % 3), 1.4, PR_DARK, pid=40 + k, back=0.05)
        for k in range(16):
            a = q['spin'] * 2 + k * TAU / 16; M.add(ellipsoid(c + V(math.cos(a) * 9, math.sin(a * 3) * 1.2, math.sin(a) * 9), 0.55), PR_CORE, pid=50)
    M.root = V(0, 0, q['fwd']); M.tips['core'] = c
    return M

# ======================================================================== 10. 플라나리아
PL_BODY = M_(['#120c06', '#2a1e10', '#4a3620', '#745634', '#a2805a'])
PL_BELLY = M_(['#3a2a1a', '#6a5038', '#9a7a58', '#c8a880'])
PL_PHAR = M_(['#5a2030', '#a04a5a', '#e08a96', '#ffd0d6'])
def planaria(anim, t, v=None):
    M = Model()
    q = dict(wave=t, amp=0.5, lunge=0.0, rear=0.0, phar=0.0, flat=0.0, sq=1.0)
    if anim == 'idle': q.update(wave=t, amp=0.35, rear=0.15 + 0.1 * math.sin(TAU * t))
    elif anim == 'move': q.update(wave=t * 2, amp=0.9, sq=1 + 0.06 * math.sin(TAU * t * 2))
    elif anim == 'attack':
        q.update(keys(t, [(0, dict(lunge=0, rear=0.15, phar=0, sq=1)), (0.35, dict(lunge=-2, rear=1.0, phar=0, sq=0.85)), (0.55, dict(lunge=7, rear=0.0, phar=1.0, sq=1.15)),
                          (0.78, dict(lunge=6, rear=0.0, phar=0.8, sq=1.1)), (1, dict(lunge=0, rear=0.15, phar=0, sq=1))]))
    elif anim == 'hit':
        k = [1, 0.7, 0.4, 0.1][min(3, int(t * 3 + 0.5))]; q.update(lunge=-2 * k, sq=1 - 0.2 * k, rear=0.4 * k)
    elif anim == 'death':
        a = ss(t / 0.7); q.update(flat=a, amp=0.5 + a, sq=1 + 0.2 * a)
    N = 16; L = 22 * q['sq']
    pts = []; wid = []
    for k in range(N + 1):
        s = k / N
        z = -L * 0.55 + L * s + q['lunge'] * s
        x = q['amp'] * 1.8 * math.sin(TAU * (s * 1.2 - q['wave'])) * (1 - s * 0.6)
        y = 1.0 + q['rear'] * 7 * max(0, s - 0.65) ** 1.5 * 3
        pts.append(V(x, y, z))
        w = 2.2 + 2.0 * math.sin(min(1, s * 1.1) * math.pi) ** 0.7
        if s > 0.82: w = 2.8 + 3.2 * (s - 0.82) / 0.18 * (1 - (s - 0.82) / 0.18 * 0.55)   # 화살촉 머리
        wid.append(w * (1 + 0.6 * q['flat']))
    for k in range(N + 1):
        d = nz(pts[min(N, k + 1)] - pts[max(0, k - 1)]); ax = frame_from(d, V(0, 1, 0))
        M.add(oriented_ellipsoid(pts[k], ax, (wid[k], 1.4 * (1 - 0.5 * q['flat']), 1.2)), PL_BODY, pid=1)
        M.add(oriented_ellipsoid(pts[k] + V(0, -0.5, 0), ax, (wid[k] * 0.95, 0.8, 1.2)), PL_BELLY, pid=2)
    hd = pts[-1]; d = nz(pts[-1] - pts[-2]); side = nz(np.cross(V(0, 1, 0), d))
    # 귀(머리 양옆 뾰족) + 사팔눈
    for s in (1, -1):
        M.add(oriented_ellipsoid(hd + side * s * 4.2 - d * 0.6, frame_from(side * s + d * 0.4, V(0, 1, 0)), (0.9, 2.0, 0.7)), PL_BODY, pid=3)
        e = hd + side * s * 1.3 + V(0, 1.2, 0) - d * 0.4
        M.add(ellipsoid(e, (0.9, 0.5, 0.9)), M_(['#c8c4b8', '#ece8dc', '#ffffff', '#ffffff']), pid=4)
        M.decal(e + V(0, 0.5, 0) + side * s * 0.4, '#0a0806', 1, 1.0)
    # 등 무늬
    for k in range(2, N - 2, 2): M.decal(pts[k] + V(0, 1.4, 0), '#8a6a44', 1, 1.0)
    # 공격: 배 쪽 인두관이 앞으로 뻗음
    if q['phar'] > 0:
        mid = pts[N // 2] + V(0, -0.2, 0)
        limb(M, mid, mid + d * (3 + 9 * q['phar']) + V(0, 0.5, 0), 1.1, 0.8, PL_PHAR, pid=5)
        M.add(ellipsoid(mid + d * (3.5 + 9 * q['phar']) + V(0, 0.5, 0), 1.2), PL_PHAR, pid=6)
    M.root = V(0, 0, q['lunge']); M.tips['head'] = hd
    return M

# ======================================================================== 11. 상자해파리
JL_BELL = M_(['#0a3444', '#16667e', '#2e9ebc', '#80def0', '#e2fcff'])
JL_IN = M_(['#5a0a4a', '#c02a96', '#ff7ad8', '#ffe0f6'], True, '#ff5ad0')
JL_TEN = M_(['#3a6a7a', '#6aa8bc', '#a8e0ee', '#e8fcff'])
JL_TIP = M_(['#6a1a5a', '#d04ab0', '#ff9ae8', '#ffffff'], True, '#ff6ae0')
def jelly(anim, t, v=None):
    M = Model()
    q = dict(h=15.0, pulse=0.0, tilt=0.0, whip=0.0, sink=0.0, ph=t)
    if anim == 'idle': q.update(h=15 + 1.0 * math.sin(TAU * t), pulse=0.5 + 0.5 * math.sin(TAU * t))
    elif anim == 'move': q.update(h=15 + 0.8 * math.sin(TAU * t * 2), pulse=0.5 + 0.5 * math.sin(TAU * t * 2), tilt=0.35, ph=t * 2)
    elif anim == 'attack':
        q.update(keys(t, [(0, dict(pulse=0.5, whip=0, tilt=0)), (0.38, dict(pulse=1.0, whip=-0.4, tilt=-0.2)), (0.56, dict(pulse=0.0, whip=1.0, tilt=0.45)),
                          (0.78, dict(pulse=0.2, whip=0.8, tilt=0.35)), (1, dict(pulse=0.5, whip=0, tilt=0))]))
    elif anim == 'hit':
        k = [1, 0.7, 0.4, 0.1][min(3, int(t * 3 + 0.5))]; q.update(pulse=k, tilt=-0.3 * k, h=15 - k)
    elif anim == 'death':
        a = ss(t / 0.75); q.update(sink=a, h=15 - 11 * a, pulse=1.0 * a, tilt=0.6 * a)
    R = rot_x(q['tilt']); c = V(0, q['h'], 0)
    p = q['pulse']; rx = 7.4 * (1 - 0.14 * p); ry = 6.4 * (1 + 0.2 * p)
    pc, pn = ellipsoid(V(0, 0, 0), (rx, ry, rx))
    # 상자 모양: 옆면을 조금 각지게
    sq = np.sign(pc[:, [0, 2]]) * np.abs(pc[:, [0, 2]]) ** 0.85 * rx ** 0.15; pc[:, 0] = sq[:, 0]; pc[:, 2] = sq[:, 1]
    keep = pc[:, 1] > ry * 0.02
    pc[:, 1] -= ry * 0.02
    M.add(((pc[keep] @ R.T) + c, pn[keep] @ R.T), JL_BELL, pid=1)
    # 안쪽 빛나는 생식선(벨 표면 가까이 보이게)
    for k in range(4):
        a = k * TAU / 4 + 0.785
        for j in range(5):
            u = j / 4
            el = 0.25 + 1.0 * u; pp = c + R @ V(math.cos(a) * rx * math.cos(el) * 0.97, ry * math.sin(el) * 0.97, math.sin(a) * rx * math.cos(el) * 0.97)
            M.add(ellipsoid(pp, 0.75), JL_IN, pid=2)
    # 벨 테두리 + 네 모서리 촉수 다발
    rim = c + R @ V(0, -0.2, 0)
    M.add(oriented_ellipsoid(rim, R, (rx * 1.04, 0.7, rx * 1.04)), JL_TEN, pid=3)
    for k in range(16):
        a = k * TAU / 16; M.add(ellipsoid(rim + R @ V(math.cos(a) * rx * 1.02, -0.5, math.sin(a) * rx * 1.02), 0.8), JL_TIP if k % 4 == 2 else JL_TEN, pid=3)
    for k in range(4):
        a = k * TAU / 4 + 0.785
        corner = rim + R @ V(math.cos(a) * rx * 0.92, 0, math.sin(a) * rx * 0.92)
        for j in range(5):
            pts = []
            for i in range(10):
                s = i / 9; sw = math.sin(TAU * (q['ph'] + s * 0.8) + k + j * 1.3)
                fwdpull = q['whip'] * s * s * 10 * (1 if math.sin(a) > -0.2 else 0.6)
                pts.append(corner + V(math.cos(a) * (0.5 + s * 1.5) + (j - 2) * 0.45 + sw * 1.6 * s, -s * (13 + 2 * (j % 2) - 3 * q['sink']) + abs(fwdpull) * 0.3, math.sin(a) * (1 + s * 2) + sw * 0.8 * s + fwdpull))
            for pp in pts: pp[1] = max(0.4, pp[1])
            chain(M, pts, [0.32 - 0.2 * i / 9 for i in range(10)], JL_TEN if j % 2 else JL_TIP, pid=10 + k)
    # 가운데 입 줄기
    limb(M, rim, rim + V(0, -4.5, 0.5 * q['whip'] * 4), 1.2, 0.6, JL_IN, pid=30)
    M.tips['bell'] = c
    return M

# ======================================================================== 12. 진드기
TK_SHELL = M_(['#120a06', '#2a1a10', '#4a301e', '#70503a', '#a07a5a'])
TK_BELLY = M_(['#2a2e3a', '#4c5266', '#7a8298', '#b0b8cc', '#e4e8f4'])
TK_LEG = M_(['#1a100a', '#382416', '#5a3c26', '#82603e'])
TK_EGG = M_(['#5a4a00', '#c8a810', '#ffe46a', '#fffbe0'], True, '#ffd820')
def tick(anim, t, v=None):
    v = v or {}; M = Model()
    q = dict(h=4.2, gait=0.0, gamp=0.0, rear=0.0, fwd=0.0, swell=0.0, flip=0.0)
    if anim == 'idle': q.update(swell=0.05 * math.sin(TAU * t), h=4.2 + 0.2 * math.sin(TAU * t))
    elif anim == 'move': q.update(gait=t * 2, gamp=1.0, h=4.4 + 0.3 * abs(math.sin(TAU * t * 2)))
    elif anim == 'attack':
        q.update(keys(t, [(0, dict(rear=0, fwd=0, h=4.2)), (0.35, dict(rear=0.6, fwd=-1.5, h=5.0)), (0.55, dict(rear=-0.25, fwd=8, h=7.0)),
                          (0.72, dict(rear=-0.2, fwd=8, h=4.0)), (1, dict(rear=0, fwd=0, h=4.2))]))
    elif anim == 'special':   # 알주머니를 부풀려 새끼를 퍼뜨림
        q.update(keys(t, [(0, dict(swell=0, rear=0)), (0.45, dict(swell=0.45, rear=-0.25)), (0.65, dict(swell=0.1, rear=0.1)), (1, dict(swell=0, rear=0))]))
    elif anim == 'hit':
        k = [1, 0.7, 0.4, 0.1][min(3, int(t * 3 + 0.5))]; q.update(rear=0.3 * k, fwd=-1.5 * k)
    elif anim == 'death':
        a = ss(t / 0.6); q.update(flip=a, h=4.2 + 2 * math.sin(a * math.pi))
    R = rot_x(-q['rear']) @ rot_z(math.pi * q['flip'])
    c = V(0, q['h'], q['fwd'])
    def P(x): return c + R @ np.array(x, float)
    sw = 1 + q['swell']
    M.add(oriented_ellipsoid(P([0, 0.3, -2.5]), R, (5.2 * sw, 3.6 * sw, 6.0 * sw)), TK_BELLY, pid=1)
    for k in range(5): M.decal(P([(k - 2) * 1.6, 3.7 * sw, -3.0]), '#363a48', 1, 1.0)
    M.add(oriented_ellipsoid(P([0, 1.5, 1.8]), R @ rot_x(0.25), (4.0, 1.6, 3.6)), TK_SHELL, pid=2)   # 등 방패
    M.add(oriented_ellipsoid(P([0, 0.6, 4.3]), R, (1.8, 1.3, 1.8)), TK_SHELL, pid=3)               # 머리(입틀)
    for s in (1, -1): limb(M, P([s * 0.8, 0.4, 5.6]), P([s * 1.2, 0.0, 7.8]), 0.5, 0.3, TK_LEG, pid=4)
    limb(M, P([0, 0.2, 5.4]), P([0, -0.4, 8.2]), 0.45, 0.15, TK_SHELL, pid=5)
    for s in (1, -1): M.add(ellipsoid(P([s * 1.2, 1.2, 5.2]), 0.45), M_(['#4a0a0a', '#a01a1a', '#ff5a4a', '#ffd0c0'], True), pid=6)
    for i in range(4):
        for s in (1, -1):
            hip = P([s * 3.0, 0.2, 2.6 - i * 1.6])
            ph = TAU * q['gait'] + (math.pi if (i + (s > 0)) % 2 else 0)
            sz = 1.6 * q['gamp'] * math.sin(ph); lift = 1.4 * q['gamp'] * max(0, math.cos(ph))
            spread = [1.0, 0.4, -0.3, -0.9][i]
            foot = V(s * 9.0, lift, c[2] + spread * 5.0 + sz)
            if q['flip'] > 0.5: foot = hip + V(s * 3.0, 4.0, spread * 2.0)
            knee = (hip + foot) / 2 + V(s * 0.5, 3.4, 0)
            chain(M, [hip, knee, foot], [0.6, 0.45, 0.2], TK_LEG, pid=10 + i)
    if v.get('eggs'):
        rnd = np.random.RandomState(7)
        for k in range(18):
            a = rnd.uniform(0, TAU); e = rnd.uniform(0.2, 1.2)
            p = P([math.cos(a) * 4.6 * sw * math.cos(e) * 0.95, 3.6 * sw * math.sin(e) * 0.9 + 0.3, -2.5 + math.sin(a) * 5.6 * sw * math.cos(e)])
            M.add(ellipsoid(p, 0.7 + 0.3 * q['swell']), TK_EGG, pid=40)
        for k in range(6):   # 등에 매달린 새끼
            a = k * TAU / 6; p = P([math.cos(a) * 3.0, 3.6 * sw + 0.8, -2.5 + math.sin(a) * 3.5])
            M.add(ellipsoid(p, (0.9, 0.6, 1.1)), TK_SHELL, pid=41)
    M.root = V(0, 0, q['fwd']); M.tips['mouth'] = P([0, 0, 8])
    return M

# ======================================================================== 13. 코로나 바이러스
CV_BODY = M_(['#1a2a30', '#2e4a54', '#4e7480', '#86aab4', '#d0e8ee'])
CV_SPIKE = M_(['#4a0a0a', '#8e1a1a', '#d03a2a', '#ff7a5a', '#ffd0b8'])
CV_GLOW = M_(['#7a3a00', '#e07a10', '#ffc04a', '#fff2c0'], True, '#ffa020')
def corona(anim, t, v=None):
    v = v or {}; M = Model()
    q = dict(roll=0.0, swell=1.0, fwd=0.0, pop=0.0, glow=0.0, ext=1.0, spin=0.0, h=0.0)
    if anim == 'idle': q.update(swell=1 + 0.04 * math.sin(TAU * t), spin=TAU * t * 0.25, h=0.4 * math.sin(TAU * t))
    elif anim == 'move': q.update(roll=TAU * t, h=0.6 * abs(math.sin(TAU * t * 2)))
    elif anim == 'attack':
        q.update(keys(t, [(0, dict(swell=1, glow=0, fwd=0, roll=0)), (0.4, dict(swell=1.25, glow=1, fwd=-1, roll=-0.6)), (0.62, dict(swell=0.95, glow=0.6, fwd=10, roll=3.5)),
                          (0.8, dict(swell=1.0, glow=0.2, fwd=10, roll=4.2)), (1, dict(swell=1, glow=0, fwd=0, roll=TAU))]))
    elif anim == 'special':   # 돌기를 길게 뻗고 회전하며 사방에 퍼뜨림
        q.update(keys(t, [(0, dict(ext=1, glow=0, swell=1)), (0.4, dict(ext=0.6, glow=1.2, swell=1.2)), (0.6, dict(ext=1.8, glow=1.5, swell=1.05)), (0.85, dict(ext=1.5, glow=0.8, swell=1)), (1, dict(ext=1, glow=0, swell=1))]))
        q['spin'] = TAU * ss(t) * 1.2
    elif anim == 'hit':
        k = [1, 0.7, 0.4, 0.1][min(3, int(t * 3 + 0.5))]; q.update(swell=1 - 0.15 * k, fwd=-2 * k)
    elif anim == 'death':
        a = ss(t / 0.5); q.update(pop=a, swell=1 + 0.4 * a, glow=1 - a)
    r = 5.8 * q['swell']; c = V(0, r + 2.4 + q['h'], q['fwd'])
    R = rot_y(q['spin']) @ rot_x(q['roll'])
    if q['pop'] < 0.6:
        M.add(ellipsoid(c, r * (1 - 0.6 * q['pop'])), CV_BODY, pid=1)
        for k in range(7):
            a = k * 1.7; d = R @ nz(V(math.cos(a), math.sin(k * 2.2) * 0.8, math.sin(a)))
            M.add(ellipsoid(c + d * r * 0.92, 0.9), CV_GLOW if q['glow'] > 0.3 or v.get('gold') else M_(['#2a4a3a', '#4a7a5e', '#7ab08a', '#c0e8cc']), pid=2)
    # 스파이크 단백질 (피보나치 분포)
    n = 34 if v.get('gold') else 26
    spk = v.get('spike', CV_SPIKE)
    for k in range(n):
        ph = math.acos(1 - 2 * (k + 0.5) / n); th = math.pi * (1 + 5 ** .5) * k
        d = R @ V(math.cos(th) * math.sin(ph), math.cos(ph), math.sin(th) * math.sin(ph))
        fly = q['pop'] * (8 + 4 * math.sin(k))
        base = c + d * (r * 0.95 + fly)
        if q['pop'] > 0: base = base + V(0, -q['pop'] * 6 * (0.5 + 0.5 * math.sin(k * 1.3)), 0); base[1] = max(0.6, base[1])
        L = 2.6 * q['ext']
        limb(M, base, base + d * L, 0.4, 0.35, spk, pid=10)
        M.add(oriented_ellipsoid(base + d * (L + 0.8), frame_from(d), (1.1, 1.0, 1.1)), spk, pid=11)
    if v.get('gold'):
        for k in range(3):
            a = q['spin'] * 2 + k * TAU / 3
            for j in range(12):
                b = j * TAU / 12; M.add(ellipsoid(c + rot_y(a) @ V(math.cos(b) * (r + 5), math.sin(b) * (r + 5), 0), 0.5), CV_GLOW, pid=20)
    M.root = V(0, 0, q['fwd']); M.tips['core'] = c
    return M

# ======================================================================== 14. 거머리
LC_BODY = M_(['#0c100a', '#1c2616', '#2e3e24', '#4a5e38', '#6e8656'])
LC_STRIPE = M_(['#4a2206', '#8a4410', '#c87a28', '#f0b05a'])
LC_MOUTH = M_(['#2a0a0e', '#5a1620', '#8e2a36', '#c25060'])
LC_BLOOD = M_(['#6a0a10', '#c81a24', '#ff4a46', '#ffb8a8'], True, '#ff3a3a')
def leech(anim, t, v=None):
    v = v or {}; M = Model()
    q = dict(arch=0.0, len=1.0, lift=0.0, fwd=0.0, swell=0.0, flat=0.0, wig=t)
    if anim == 'idle': q.update(lift=0.3 + 0.25 * math.sin(TAU * t), swell=0.04 * math.sin(TAU * t))
    elif anim == 'move':
        ph = TAU * t; q.update(arch=max(0, math.sin(ph)) * 1.0, len=1 - 0.28 * max(0, math.sin(ph)), lift=0.2)
    elif anim == 'attack':
        q.update(keys(t, [(0, dict(lift=0.3, fwd=0, len=1)), (0.4, dict(lift=1.3, fwd=-2, len=0.85)), (0.58, dict(lift=0.1, fwd=8, len=1.2)),
                          (0.8, dict(lift=0.05, fwd=8, len=1.15)), (1, dict(lift=0.3, fwd=0, len=1))]))
    elif anim == 'special':   # 피를 빨아 몸이 부풀어 오름
        q.update(keys(t, [(0, dict(swell=0, lift=0.3)), (0.5, dict(swell=0.5, lift=0.8)), (0.75, dict(swell=0.45, lift=0.6)), (1, dict(swell=0, lift=0.3))]))
        q['wig'] = t * 3
    elif anim == 'hit':
        k = [1, 0.7, 0.4, 0.1][min(3, int(t * 3 + 0.5))]; q.update(len=1 - 0.2 * k, lift=0.6 * k, fwd=-1.5 * k)
    elif anim == 'death':
        a = ss(t / 0.7); q.update(flat=a, lift=0, len=1 + 0.1 * a)
    N = 14; L = 20 * q['len']; pts = []
    for k in range(N + 1):
        s = k / N
        z = -L / 2 + L * s + q['fwd'] * s
        y = 2.4 + q['arch'] * 7 * math.sin(math.pi * s) + q['lift'] * 8 * max(0, s - 0.6) ** 1.6 * 3
        x = 0.8 * math.sin(TAU * (s - q['wig'])) * (1 - q['arch'])
        pts.append(V(x, y * (1 - 0.5 * q['flat']), z))
    big = 1 + q['swell']
    for k in range(N + 1):
        s = k / N; d = nz(pts[min(N, k + 1)] - pts[max(0, k - 1)]); ax = frame_from(d, V(0, 1, 0))
        w = (1.6 + 2.6 * math.sin(math.pi * (0.1 + 0.8 * s)) ** 0.8) * big * (1 + 0.3 * q['flat'])
        M.add(oriented_ellipsoid(pts[k], ax, (w * 1.1, 1.05, w * 0.85)), LC_BODY, pid=1)
        if k % 2 == 0: M.add(oriented_ellipsoid(pts[k], ax, (w * 0.5, 0.5, w * 0.88)), LC_STRIPE, pid=2)
        if v.get('blood') and 3 <= k <= N - 3 and k % 2: M.add(ellipsoid(pts[k] + V(0, w * 0.7, 0), 0.9 * big), LC_BLOOD, pid=3)
    # 앞쪽 빨판 (이빨 고리)
    hd = pts[-1]; d = nz(pts[-1] - pts[-2]); side = nz(np.cross(V(0, 1, 0), d)) if abs(d[1]) < 0.95 else V(1, 0, 0); up_ = nz(np.cross(d, side))
    M.add(oriented_ellipsoid(hd + d * 1.2, np.stack([side, up_, d], 1), (2.4, 2.2, 1.0)), LC_MOUTH, pid=4)
    for k in range(8):
        a = k * TAU / 8; p = hd + d * 1.9 + (side * math.cos(a) + up_ * math.sin(a)) * 1.5
        limb(M, p, p + d * 0.9 - (side * math.cos(a) + up_ * math.sin(a)) * 0.6, 0.3, 0.1, M_(['#8a7a6a', '#c8b8a0', '#f0e4cc', '#ffffff']), pid=5)
    tl = pts[0]; M.add(ellipsoid(tl - nz(pts[1] - pts[0]) * 0.8, (2.2 * big, 1.0, 2.2 * big)), LC_MOUTH, pid=6)
    if v.get('blood'):
        for k in range(6): limb(M, pts[4 + k] + V(0, 2.6 * big, 0), pts[4 + k] + V(0.5 * (-1) ** k, 5.2 * big, -1), 0.6, 0.15, LC_STRIPE, pid=7)
    M.root = V(0, 0, q['fwd']); M.tips['mouth'] = hd
    return M

# ======================================================================== 15. 실패한 클론 병사 (원거리)
CL_SKIN = M_(['#2a3a2e', '#4e6a52', '#82a486', '#bcd8b8', '#eaf8e4'])
CL_STRAP = M_(['#0e1012', '#1e2226', '#33393e', '#4e565c'])
CL_ARMOR = M_(['#141a26', '#2a364e', '#465a7e', '#7a90b4', '#c0d0ea'])
CL_GUN = M_(['#2a1a2a', '#5a3a52', '#8a6080', '#c094b4'])
CL_SAC = M_(['#2a6a0e', '#5ad01e', '#b4ff6a', '#f2ffe0'], True, '#7aff3a')
CL_EYE = M_(['#2a6a0e', '#5ad01e', '#c8ff8a', '#ffffff'], True, '#7aff3a')
def clone(anim, t, v=None):
    v = v or {}; M = Model()
    q = dict(HBASE); arm = v.get('armor')
    q.update(lean=0.05, drop=0.3, rh=(-5.5, 9.5, 8.0), lh=(7.0, 2.0, 1.0), w=(0, 1, 0), twist=-0.15, flash=0.0, rec=0.0)
    if anim == 'idle':
        b = math.sin(TAU * t); q.update(drop=0.3 + 0.25 * b, rh=(-6.0, 6.5 + 0.3 * b, 5.0), lh=(7.0, 2.0 + 0.2 * b, 1.0), twist=-0.1)
    elif anim == 'move':
        ph = TAU * t
        q.update(lth=0.5 * math.sin(ph), rth=-0.5 * math.sin(ph), lkn=0.1 + 0.7 * max(0, math.cos(ph)), rkn=0.1 + 0.7 * max(0, -math.cos(ph)),
                 drop=0.4 + 0.6 * abs(math.sin(ph)), lean=0.12, rh=(-6.0, 6.5, 5.0 + 1.5 * math.sin(ph)), lh=(6.8, 2.5, 1.0 - 3 * math.sin(ph)))
    elif anim == 'attack':
        f = min(7, int(t * 7 + 0.5)); rec = [0, 0.2, 0.6, 1.0, 0.6, 0.3, 0.1, 0][f]
        q.update(rh=(-4.5, 10.0 + 0.8 * rec, 9.0 - 2.0 * rec), lh=(-1.0, 8.5, 7.0) if arm else (7.0, 2.0, 1.0), lean=0.05 - 0.15 * rec, twist=-0.2, drop=0.6, lth=0.25, rth=-0.25)
        q['flash'] = [0, 0, 0, 1, 0.5, 0, 0, 0][f]; q['charge'] = [0, 0.5, 1, 0.2, 0, 0, 0, 0][f]
    elif anim == 'special':   # 지휘관: 왼팔을 치켜들고 명령 (주변 강화)
        q.update(keys(t, [(0, dict(lh=(7, 2, 1), lean=0.05, hp=0)), (0.4, dict(lh=(4, 22, 3), lean=-0.15, hp=-0.3)), (0.75, dict(lh=(4, 22.5, 3), lean=-0.15, hp=-0.3)), (1, dict(lh=(7, 2, 1), lean=0.05, hp=0))]))
        q['glowl'] = ss(t / 0.4) * (1 - ss((t - 0.75) / 0.25))
    elif anim == 'hit':
        k = [1, 0.7, 0.4, 0.1][min(3, int(t * 3 + 0.5))]; q.update(lean=-0.4 * k, hp=-0.35 * k, fwd=-1.2 * k, drop=0.3 + 0.6 * k)
    elif anim == 'death':
        a = ss(t / 0.45); b = ss((t - 0.3) / 0.5)
        q.update(lkn=0.2 + 1.5 * a, rkn=0.2 + 1.4 * a, lth=0.8 * a * (1 - b), rth=0.6 * a * (1 - b), drop=6 * a, lean=0.3 * a, rh=(-7, 3, 4), lh=(7, 2, 3))
        q['fall'] = 1.35 * b
    J = hskel(q); R = J['R']; M.root = V(0, 0, 0)
    body = CL_ARMOR if arm else CL_SKIN
    for s in 'lr':
        limb(M, J[s + 'hip'], J[s + 'kn'], 2.6, 2.2, CL_STRAP if not arm else CL_ARMOR, pid=1)
        limb(M, J[s + 'kn'], J[s + 'an'] + V(0, 1.2, 0), 2.2, 1.9, CL_SKIN if not arm else CL_ARMOR, pid=2)
        A = J[s + 'an']; limb(M, A + V(0, 1.4, 0), A + V(0, -0.8, 0), 2.0, 2.0, CL_STRAP, pid=3); limb(M, A + V(0, -1.2, -0.5), A + V(0, -1.4, 3.4), 1.7, 1.5, CL_STRAP, pid=3)
    M.add(oriented_ellipsoid(J['pel'] + R @ V(0, 1, 0), R, (4.8, 3.0, 3.4)), CL_STRAP, pid=4)
    M.add(oriented_ellipsoid(J['abd'], R, (4.2, 3.9, 3.0)), CL_SKIN, pid=5)
    M.add(oriented_ellipsoid(J['chest'], R, (5.6, 4.9, 3.6)), body, pid=6)
    # 실험용 하네스 끈 + 등 튜브
    for sg in (1, -1):
        limb(M, J['chest'] + R @ V(sg * 3.5, 4.0, 3.2), J['pel'] + R @ V(-sg * 3.0, 3.5, 3.4), 0.45, 0.45, CL_STRAP, pid=7)
        limb(M, J['chest'] + R @ V(sg * 2.0, 3.0, -3.5), J['chest'] + R @ V(sg * 3.5, -4.0, -3.8), 0.7, 0.7, CL_SAC, pid=8)
    if arm:
        for s in 'lr': M.add(oriented_ellipsoid(J[s + 'sh'] + R @ V(0, 1.0, 0), R, (3.4, 2.4, 3.2)), CL_ARMOR, pid=9)
        M.add(box(J['chest'] + R @ V(0, 0.5, 3.4), R, (3.6, 3.4, 0.6)), CL_ARMOR, pid=10)
        M.decal(J['chest'] + R @ V(0, 1.5, 4.1), '#7aff3a', 2, 1.4); M.decal(J['chest'] + R @ V(0, 0.5, 4.1), '#7aff3a', 2, 1.4)
    else:
        M.decal(J['chest'] + R @ V(1.5, 1.5, 3.6), '#2a3a2e', 1, 1.4)
    # 왼팔
    sh, el, ha = J['lsh'], J['lel'], J['lha']
    limb(M, sh, el, 2.0, 1.8, body if arm else CL_SKIN, pid=11); limb(M, el, ha, 1.8, 1.5, CL_SKIN, pid=12); M.add(ellipsoid(ha, 1.4), CL_SKIN, pid=13)
    if q.get('glowl', 0) > 0: M.add(ellipsoid(ha + V(0, 1.6, 0), 0.8 + 1.6 * q['glowl']), CL_SAC, pid=14)
    # 오른팔: 생체 대포
    sh, el, ha = J['rsh'], J['rel'], J['rha']
    limb(M, sh, el, 2.0, 2.0, body if arm else CL_SKIN, pid=15)
    d = nz(ha - el); up_ = nz(R @ V(0, 1, 0) - d * np.dot(R @ V(0, 1, 0), d)); side = nz(np.cross(d, up_))
    fr = np.stack([side, d, up_], 1); gs = 1.35 if arm else 1.0
    M.add(oriented_ellipsoid(el + d * 4.0, fr, (2.6 * gs, 5.0 * gs, 2.6 * gs)), CL_GUN, pid=16)
    for k in range(3):
        M.add(ellipsoid(el + d * (2.5 + k * 2.2) + up_ * 2.2 * gs + side * (0.8 * (k - 1)), (1.1 + 0.4 * q.get('charge', 0)) * gs), CL_SAC, pid=17)
    muz = el + d * 9.5 * gs
    limb(M, el + d * 7.5 * gs, muz, 1.5 * gs, 1.1 * gs, CL_GUN, pid=18)
    M.add(oriented_ellipsoid(muz, fr, (1.3 * gs, 0.5, 1.3 * gs)), CL_SAC, pid=19)
    if q['flash'] > 0:
        M.add(ellipsoid(muz + d * 1.2, 1.0 + 2.0 * q['flash']), CL_SAC, pid=20)
        for k in range(4):
            a = k * TAU / 4 + 0.4; dd = nz(d * 1.2 + (side * math.cos(a) + up_ * math.sin(a)) * 0.9)
            limb(M, muz + d * 0.5, muz + dd * (2 + 3 * q['flash']), 0.5, 0.1, CL_SAC, pid=21)
    M.tips['muzzle'] = muz
    # 머리: 민머리 + 바코드 + 빛나는 눈
    H = J['head']; Rh = J['Rh']
    M.add(oriented_ellipsoid(H, Rh, (4.0, 4.6, 4.2)), CL_SKIN, pid=22)
    for k in range(6): M.decal(H + Rh @ V(-1.5 + k * 0.6, 2.6, -3.6), '#141c16', 1, 1.0)
    if arm:
        M.add(oriented_ellipsoid(H + Rh @ V(0, 1.2, -0.2), Rh, (4.5, 4.0, 4.6)), CL_ARMOR, pid=23)
        M.add(box(H + Rh @ V(0, 0.2, 4.1), Rh, (3.0, 0.7, 0.4)), CL_EYE, pid=24)
    else:
        for s in (1, -1): M.add(ellipsoid(H + Rh @ V(s * 1.5, 0.2, 3.8), 0.7), CL_EYE, pid=24)
        M.add(capsule(H + Rh @ V(0, -1.6, 3.9), H + Rh @ V(0, -1.6, 3.9), 0.6, 0.6), CL_STRAP, pid=25)
    soles = min(J['lan'][1], J['ran'][1]) - 2.4
    T = V(0, -soles, 0); fall = q.get('fall', 0); Rf = rot_x(fall); piv = V(0, 0, -3.0)
    def tf(p):
        p = p + T
        return (p - piv) @ Rf.T + piv if fall else p
    M.parts = [(tf(p), n @ Rf.T if fall else n, m, i) for p, n, m, i in M.parts]
    lo = min(p[:, 1].min() for p, n, m, i in M.parts) if fall else 0
    if fall: M.parts = [(p - V(0, lo, 0), n, m, i) for p, n, m, i in M.parts]
    M.decals = [(tf(d_[None])[0] - V(0, lo, 0), c, s, b) for d_, c, s, b in M.decals]
    M.tips = {k: tf(vv[None])[0] - V(0, lo, 0) for k, vv in M.tips.items()}
    return M

# ======================================================================== 16. 키메라 실험쥐
RT_FUR = M_(['#4a4452', '#868094', '#c4c0ce', '#eeecf2', '#ffffff'])
RT_PINK = M_(['#5a2232', '#a2505e', '#de8c96', '#ffc8ce'])
RT_TUMOR = M_(['#4a1430', '#86264e', '#c04c6c', '#ec8a90'])
RT_VEIN = M_(['#5a1690', '#9a3ae0', '#d08aff', '#f6e0ff'], True, '#b45aff')
RT_EYE = M_(['#5a0a0a', '#d0202a', '#ff6a5a', '#ffd0c0'], True, '#ff4040')
def rat(anim, t, v=None):
    M = Model()
    q = dict(gait=0.0, gamp=0.0, h=7.0, pitch=0.0, fwd=0.0, jaw=0.0, roll=0.0, tail=t, head=0.0)
    if anim == 'idle': q.update(h=7 + 0.2 * math.sin(TAU * t), head=0.15 * math.sin(TAU * t * 2), tail=t)
    elif anim == 'move': q.update(gait=t * 2, gamp=1.0, h=7.3 + 0.6 * abs(math.sin(TAU * t * 2)), pitch=0.05 * math.sin(TAU * t * 2), tail=t * 2)
    elif anim == 'attack':
        q.update(keys(t, [(0, dict(pitch=0, fwd=0, h=7, jaw=0)), (0.35, dict(pitch=-0.35, fwd=-2, h=6.0, jaw=0.4)), (0.55, dict(pitch=0.25, fwd=9, h=10, jaw=1.0)),
                          (0.75, dict(pitch=0.2, fwd=9, h=7, jaw=0.3)), (1, dict(pitch=0, fwd=0, h=7, jaw=0))]))
        q['gamp'] = 0.5 if 0.4 < t < 0.75 else 0
    elif anim == 'hit':
        k = [1, 0.7, 0.4, 0.1][min(3, int(t * 3 + 0.5))]; q.update(pitch=-0.3 * k, fwd=-2 * k)
    elif anim == 'death':
        a = ss(t / 0.6); q.update(roll=1.5 * a, h=7 - 2.0 * a)
    R = rot_x(q['pitch']) @ rot_z(q['roll'])
    c = V(0, q['h'], q['fwd'])
    def P(x): return c + R @ np.array(x, float)
    M.add(oriented_ellipsoid(P([0, 0, -1]), R, (4.8, 4.4, 8.5)), RT_FUR, pid=1)
    M.add(oriented_ellipsoid(P([0, 0.6, 5.5]), R, (3.6, 3.4, 3.8)), RT_FUR, pid=2)
    # 머리
    Rh = R @ rot_x(0.15 + q['head'] * 0.3) @ rot_y(q['head'])
    hc = P([0, 1.5, 9.5])
    M.add(oriented_ellipsoid(hc, Rh, (2.9, 2.7, 3.6)), RT_FUR, pid=3)
    M.add(oriented_ellipsoid(hc + Rh @ V(0, -0.6, 3.6), Rh, (1.6, 1.4, 2.2)), RT_FUR, pid=4)
    M.add(ellipsoid(hc + Rh @ V(0, -0.4, 5.8), 0.7), RT_PINK, pid=5)
    jaw = q['jaw']
    M.add(oriented_ellipsoid(hc + Rh @ V(0, -2.0 - 0.8 * jaw, 3.2), Rh @ rot_x(0.4 * jaw), (1.3, 0.6, 2.0)), RT_PINK, pid=6)
    for s in (1, -1):
        M.add(oriented_ellipsoid(hc + Rh @ V(s * 2.4, 2.4, -0.8), Rh @ rot_z(-s * 0.5), (1.9, 2.2, 0.5)), RT_PINK, pid=7)
        M.add(ellipsoid(hc + Rh @ V(s * 1.6, 0.8, 2.6), 0.65), RT_EYE, pid=8)
        for k in range(3): M.decal(hc + Rh @ V(s * (1.6 + k * 0.7), -0.6 + k * 0.2, 4.6), '#ffffff', 1, 0.8)
    limb(M, hc + Rh @ V(-0.4, -1.4, 5.2), hc + Rh @ V(-0.4, -2.4, 5.3), 0.35, 0.3, M_(['#c8c0a8', '#ece4cc', '#ffffff', '#ffffff']), pid=9)
    limb(M, hc + Rh @ V(0.4, -1.4, 5.2), hc + Rh @ V(0.4, -2.4, 5.3), 0.35, 0.3, M_(['#c8c0a8', '#ece4cc', '#ffffff', '#ffffff']), pid=9)
    # 등 종양 + 혈관
    for (x, y, z, r) in ((1.5, 4.0, -1, 2.4), (-2.2, 3.5, 1.8, 1.8), (0.4, 4.2, -4.5, 2.0), (2.8, 2.6, 3.0, 1.3)):
        M.add(ellipsoid(P([x, y, z]), r), RT_TUMOR, pid=10)
    for k in range(4): limb(M, P([-1.5 + k, 3.6, -6 + k * 3]), P([-0.5 + k, 4.3, -3.5 + k * 3]), 0.25, 0.25, RT_VEIN, pid=11)
    # 다리 4개
    for (sx, sz, nm) in ((1, 5.5, 0), (-1, 5.5, 1), (1, -5.5, 2), (-1, -5.5, 3)):
        hip = P([sx * 3.2, -1.5, sz])
        ph = TAU * q['gait'] + (math.pi if nm in (1, 2) else 0)
        sw = 2.2 * q['gamp'] * math.sin(ph); lift = 1.8 * q['gamp'] * max(0, math.cos(ph))
        foot = V(hip[0] + sx * 0.6, lift, hip[2] + sw)
        if q['roll'] > 0.7: foot = hip + V(sx * 2, 3.0, 0)
        knee = (hip + foot) / 2 + V(0, 0.5, -1.2 if sz < 0 else 1.0)
        chain(M, [hip, knee, foot], [1.4 if sz < 0 else 1.1, 0.8, 0.5], RT_FUR, pid=12)
        limb(M, foot, foot + V(0, 0, 1.4), 0.6, 0.4, RT_PINK, pid=13)
    # 꼬리
    pts = []
    for k in range(14):
        s = k / 13; sw = math.sin(TAU * (q['tail'] - s * 0.7)) * 3 * s
        pts.append(P([sw, -0.5 + 2.0 * math.sin(s * 2.5) - 3.5 * s, -8.5 - s * 13]))
    for p in pts: p[1] = max(0.5, p[1])
    chain(M, pts, [0.9 - 0.65 * k / 13 for k in range(14)], RT_PINK, pid=14)
    M.root = V(0, 0, q['fwd']); M.tips['mouth'] = hc
    return M
