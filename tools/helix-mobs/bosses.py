# 헬릭스 챕터 보스 4종 (동작: idle, move, attack, attack2, special, hit, death)
from mobs2 import *
import hero as HERO

# ======================================================================== 보스 1. 원형질 여왕 (1장 배양실)
QN_BODY = M_(['#22300a', '#425a14', '#6e8e26', '#a8c858', '#e8f8b8'])
QN_NUC = M_(['#26082e', '#4a1458', '#7a2a8e', '#b464c8', '#e8b8f4'])
QN_MITO = M_(['#5a2006', '#a04812', '#e07a2a', '#ffb86a'])
QN_CIL = M_(['#3a4a14', '#6a8028', '#9cb84a', '#d8f08a'])
QN_EYE = M_(['#6a0a10', '#e0202e', '#ff8a7a', '#ffffff'], True, '#ff3a3a')
QN_MAW = M_(['#1a0408', '#3a0a12', '#5e1420', '#842230'])
QN_GLOW = M_(['#4a6a00', '#a8e010', '#e8ff7a', '#ffffff'], True, '#c8ff20')
def queen(anim, t, v=None):
    M = Model()
    q = dict(sy=1.0, sx=1.0, armL=0.0, armR=0.0, mouth=0.2, bud=0.0, melt=0.0, wob=t, lean=0.0, shift=0.0)
    ph = TAU * t
    if anim == 'idle': q.update(sy=1 + 0.05 * math.sin(ph), sx=1 - 0.03 * math.sin(ph), mouth=0.2 + 0.1 * math.sin(ph))
    elif anim == 'move': q.update(sy=1 - 0.07 * math.sin(ph * 2), sx=1 + 0.05 * math.sin(ph * 2), shift=1.5 * math.sin(ph), lean=0.08)
    elif anim == 'attack':   # 오른쪽 위족을 높이 들어 내려침
        q.update(keys(t, [(0, dict(armR=0, lean=0, sy=1)), (0.4, dict(armR=1.0, lean=-0.12, sy=1.08)), (0.56, dict(armR=-0.6, lean=0.18, sy=0.92)),
                          (0.8, dict(armR=-0.55, lean=0.15, sy=0.94)), (1, dict(armR=0, lean=0, sy=1))]))
    elif anim == 'attack2':   # 몸을 부풀렸다 입을 크게 벌려 산성액을 쏟아냄
        q.update(keys(t, [(0, dict(sy=1, sx=1, mouth=0.2, lean=0)), (0.4, dict(sy=1.18, sx=0.92, mouth=0.1, lean=-0.15)), (0.6, dict(sy=0.9, sx=1.1, mouth=1.0, lean=0.2)),
                          (0.85, dict(sy=0.95, sx=1.05, mouth=0.8, lean=0.15)), (1, dict(sy=1, sx=1, mouth=0.2, lean=0))]))
    elif anim == 'special':   # 양옆에서 작은 아메바를 출아
        q.update(keys(t, [(0, dict(bud=0, sy=1, armL=0, armR=0)), (0.5, dict(bud=0.8, sy=0.94, armL=0.3, armR=0.3)), (0.75, dict(bud=1.2, sy=1.0, armL=0.1, armR=0.1)), (1, dict(bud=0, sy=1, armL=0, armR=0))]))
    elif anim == 'hit':
        k = [1, 0.7, 0.4, 0.1][min(3, int(t * 3 + 0.5))]; q.update(sy=1 - 0.15 * k, sx=1 + 0.1 * k, lean=-0.2 * k)
    elif anim == 'death':
        a = ss(t / 0.8); q.update(melt=a, sy=1 - 0.75 * a, sx=1 + 0.5 * a, mouth=0.6 * (1 - a))
    sx, sy = q['sx'], q['sy']; R = rot_x(q['lean'])
    c = V(0, 13 * sy, q['shift'])
    def P(x): return c + R @ np.array(x, float)
    M.add(oriented_ellipsoid(c, R, (16 * sx, 13 * sy, 15 * sx)), QN_BODY, pid=1)
    for k in range(9):
        a = k * TAU / 9 + 0.2; r = 14 * sx + 1.5 * math.sin(TAU * q['wob'] + k * 1.7)
        M.add(ellipsoid(P([math.sin(a) * r * 0.82, -8 * sy + 1.0 * math.sin(k * 2.1), math.cos(a) * r * 0.82]), (6 * sx, 5.0 * sy, 6 * sx)), QN_BODY, pid=1)
    # 소기관이 비치는 표면: 핵(정수리), 미토콘드리아, 빛나는 소포
    M.add(oriented_ellipsoid(P([-2.5, 11 * sy, -3]), R, (6.2, 3.6 * sy + 0.6, 5.8)), QN_NUC, pid=2)
    M.add(ellipsoid(P([-1.0, 13.8 * sy, -2.2]), 1.6), M_(['#5a1a6a', '#a04ac0', '#e0a0ff', '#ffffff'], True, '#c070ff'), pid=3)
    for (x, y, z, a) in ((9, 6, 6, 0.4), (-10, 5, 5, -0.3), (8, 8, -7, 1.2), (-7, 9, -8, 0.9), (12, 0, -2, 0.1)):
        d = nz(V(x, y, z)); p0 = P(list(d * V(15.2 * sx, 12.2 * sy, 14.2 * sx)))
        ax = frame_from(np.cross(d, V(0, 1, 0)) + d * 0.1, d)
        M.add(oriented_ellipsoid(p0, ax, (1.4, 3.6, 1.3)), QN_MITO, pid=4)
    for k in range(10):
        a = k * 2.4; e = 0.2 + (k % 4) * 0.25
        d = V(math.cos(a) * math.cos(e), math.sin(e), math.sin(a) * math.cos(e))
        M.add(ellipsoid(P(list(d * V(15.6 * sx, 12.6 * sy, 14.6 * sx))), 0.9), QN_GLOW, pid=5)
    # 정수리 섬모 왕관
    for k in range(14):
        a = k * TAU / 14; b0 = P([math.cos(a) * 7, 11.5 * sy, math.sin(a) * 6.5 - 1])
        pts = [b0 + V(math.cos(a) * j * 1.2, j * 2.2 * (1 - q['melt']), math.sin(a) * j * 1.2) + V(math.sin(TAU * q['wob'] + k + j) * 0.8 * j / 4, 0, 0) for j in range(5)]
        chain(M, pts, [0.9, 0.7, 0.5, 0.35, 0.2], QN_CIL, pid=6)
    # 눈 6개 + 입
    for (x, y) in ((-6, 4), (6, 4), (-3, 7), (3, 7), (-9, 1), (9, 1)):
        e = P([x * sx, y * sy, 14.4 * sx - abs(x) * 0.25])
        M.add(ellipsoid(e, 1.3), QN_EYE, pid=7); M.decal(e + R @ V(0, 0, 1.3), '#200000', 1, 1.0)
    mo = q['mouth']
    M.add(oriented_ellipsoid(P([0, -1.5 * sy, 14.6 * sx]), R, (5 + 3 * mo, 1.0 + 4.5 * mo, 1.0)), QN_MAW, pid=8)
    for k in range(7):
        x = -4.5 + k * 1.5
        limb(M, P([x * (1 + 0.4 * mo), -1.5 * sy + (1.0 + 4.5 * mo) * 0.9, 15.0 * sx]), P([x * (1 + 0.4 * mo), -1.5 * sy + (1.0 + 4.5 * mo) * 0.3, 15.4 * sx]), 0.45, 0.12, M_(['#8a8a60', '#c8c898', '#f4f4d0', '#ffffff']), pid=9)
    if mo > 0.6:
        for k in range(6): M.add(ellipsoid(P([(k - 2.5) * 1.6, -2.5 - k % 2 * 1.5, 17 + k % 3 * 2.2]), 1.2), QN_GLOW, pid=10)
    # 위족 팔 2개
    for side, key in ((1, 'armL'), (-1, 'armR')):
        a = q[key]; sh = P([side * 13 * sx, 2, 6])
        mid = sh + V(side * 6, 5 + 9 * a, 5 - 2 * a); tip = mid + V(side * 2, 3 + 10 * a - 14 * max(0, -a), 8 - 3 * a + 6 * max(0, -a))
        tip[1] = max(2.0, tip[1])
        chain(M, [sh, mid, tip], [4.5, 3.6, 3.0], QN_BODY, pid=11)
        M.add(ellipsoid(tip, 3.8), QN_BODY, pid=12)
        for k in range(4): limb(M, tip, tip + nz(tip - mid) * 3 + V(math.cos(k * 1.6) * 2, math.sin(k * 1.6) * 2, 0), 1.0, 0.3, QN_CIL, pid=13)
        M.tips['arm' + ('L' if side > 0 else 'R')] = tip; M.tips['elb' + ('L' if side > 0 else 'R')] = mid
    # 출아(옆구리 새끼)
    if q['bud'] > 0:
        for side in (1, -1):
            b = q['bud']; p = P([side * (15 + 6 * b), -6, 2])
            M.add(ellipsoid(p, 2.0 + 2.6 * min(1, b)), QN_BODY, pid=14); M.add(ellipsoid(p + V(0, 2 * min(1, b), 1.5), 0.9 * min(1, b) + 0.1), QN_NUC, pid=15)
    if q['melt'] > 0:
        M.parts = [(np.c_[p[:, 0], np.maximum(0.3, p[:, 1]), p[:, 2]], n, m, i) for p, n, m, i in M.parts]
    M.root = V(0, 0, 0)
    return M

# ======================================================================== 보스 2. 기생충 왕 (2장 하수 저장고)
WK_BODY = M_(['#4a3424', '#86664a', '#c09c76', '#e8cca2', '#fff2d8'])
WK_PLATE = M_(['#140c0a', '#2e1e18', '#4e3428', '#76523e', '#a8806a'])
WK_LEG = M_(['#2a1a12', '#4e3424', '#76523a', '#a07a58'])
WK_MAW = M_(['#5a0a2a', '#c0205a', '#ff6a9a', '#ffd0e0'], True, '#ff4a8a')
WK_HOOK = M_(['#3a3430', '#7a6e60', '#bcae98', '#f0e6d4'])
WK_EYE = M_(['#6a5a00', '#e8c810', '#fff27a', '#ffffff'], True, '#ffe020')
def wormking(anim, t, v=None):
    M = Model()
    q = dict(rise=1.0, wave=t, amp=0.6, lunge=0.0, coil=0.0, open=0.3, sway=0.0, sink=0.0, flat=0.0)
    if anim == 'idle': q.update(wave=t, amp=0.7, open=0.3 + 0.15 * math.sin(TAU * t), sway=0.15 * math.sin(TAU * t))
    elif anim == 'move': q.update(wave=t * 2, amp=1.8, rise=0.7, open=0.2)
    elif anim == 'attack':
        q.update(keys(t, [(0, dict(lunge=0, coil=0, open=0.3, rise=1)), (0.38, dict(lunge=-4, coil=1, open=0.8, rise=1.15)), (0.56, dict(lunge=16, coil=-0.3, open=1.0, rise=0.7)),
                          (0.78, dict(lunge=15, coil=-0.2, open=0.15, rise=0.7)), (1, dict(lunge=0, coil=0, open=0.3, rise=1))]))
    elif anim == 'attack2':   # 몸을 크게 휘둘러 옆을 쓸어냄
        q.update(keys(t, [(0, dict(sway=0, rise=1)), (0.35, dict(sway=-1.2, rise=0.9)), (0.6, dict(sway=1.4, rise=0.8)), (0.8, dict(sway=1.2, rise=0.85)), (1, dict(sway=0, rise=1))]))
    elif anim == 'special':   # 땅속으로 파고들었다 솟아오름
        q.update(keys(t, [(0, dict(sink=0, open=0.3)), (0.35, dict(sink=1.0, open=0.1)), (0.6, dict(sink=1.0, open=0.1)), (0.8, dict(sink=-0.25, open=1.0)), (1, dict(sink=0, open=0.3))]))
    elif anim == 'hit':
        k = [1, 0.7, 0.4, 0.1][min(3, int(t * 3 + 0.5))]; q.update(lunge=-3 * k, coil=0.6 * k, rise=1 - 0.15 * k)
    elif anim == 'death':
        a = ss(t / 0.75); q.update(rise=1 - a, flat=a, amp=0.6 + 1.0 * a, open=0.3 + 0.7 * a)
    N = 22; pts = []
    for k in range(N + 1):
        s = k / N
        z = -30 + 28 * min(s, 0.55) / 0.55; y = 3.4
        if s > 0.5:
            u = (s - 0.5) / 0.5
            hgt = 34 * q['rise'] * math.sin(u * math.pi / 2) * (1 - 0.15 * q['coil'])
            y = 3.4 + hgt; z = -2 + u * (9 - 10 * q['coil']) + q['lunge'] * u ** 2
            y -= q['lunge'] * 0.6 * u ** 3 * (q['lunge'] > 0)
        x = q['amp'] * 4.0 * math.sin(TAU * (s * 1.2 - q['wave'])) * (1 - s * 0.7) + q['sway'] * 14 * max(0, s - 0.45) ** 1.5
        y = y - q['sink'] * 40 * max(0, s - 0.3)
        if q['flat'] > 0: y = lerp(y, 3.0 + math.sin(s * 9), q['flat'])
        pts.append(V(x, y, z))
    rads = [2.4 + 3.6 * math.sin(min(1, k / N * 1.5) * math.pi / 2) for k in range(N + 1)]
    for k in range(N + 1):
        p = pts[k]
        if p[1] < -rads[k] * 1.2: continue   # 땅속 부분은 생략
        d = nz(pts[min(N, k + 1)] - pts[max(0, k - 1)]); ax = frame_from(d, V(0, 1, 0) if abs(d[1]) < 0.9 else V(0, 0, 1))
        M.add(oriented_ellipsoid(p, ax, (rads[k] * 1.1, 1.6, rads[k] * 1.0)), WK_BODY, pid=1)
        if k % 2 == 0:
            up_ = ax[:, 2] if ax[1, 2] > 0 else -ax[:, 2]
            M.add(oriented_ellipsoid(p + up_ * rads[k] * 0.45, ax, (rads[k] * 1.0, 1.4, rads[k] * 0.65)), WK_PLATE, pid=2)
            side = ax[:, 0]
            for sg in (1, -1):
                f = p + side * sg * rads[k] * 1.05; limb(M, f, f + side * sg * 2.6 + V(0, -2.2, 0.6), 0.5, 0.2, WK_LEG, pid=3)
    # 땅을 뚫은 자리
    for k in range(10):
        a = k * TAU / 10; M.add(ellipsoid(V(math.cos(a) * 8 + pts[N // 2][0], 0.6, math.sin(a) * 6 + pts[N // 2][2]), (2.4, 1.2, 2.0)), WK_PLATE, pid=4)
    if pts[-1][1] > -2:
        hd = pts[-1]; d = nz(pts[-1] - pts[-3])
        side = nz(np.cross(d, V(0, 1, 0))) if abs(d[1]) < 0.95 else V(1, 0, 0); up_ = nz(np.cross(side, d))
        hc = hd + d * 2.5
        M.add(ellipsoid(hc, 6.2), WK_PLATE, pid=10)
        for s_ in (1, -1):
            for j in range(2):
                M.add(ellipsoid(hc + side * s_ * (2.4 + j * 1.6) + up_ * (3.0 - j * 1.2) + d * 3.6, 0.8), WK_EYE, pid=11)
        # 큰 턱 4개
        o = q['open']
        for k in range(4):
            a = k * TAU / 4 + 0.785; rd = side * math.cos(a) + up_ * math.sin(a)
            b0 = hc + d * 4.5 + rd * 3.0
            m1 = b0 + d * 4.0 + rd * (2.0 + 4.0 * o); m2 = m1 + d * 3.0 - rd * (2.5 + 1.5 * (1 - o))
            chain(M, [b0, m1, m2], [1.4, 0.9, 0.3], WK_HOOK, pid=12)
        for k in range(12):
            a = k * TAU / 12; rd = side * math.cos(a) + up_ * math.sin(a)
            limb(M, hc + d * 5 + rd * 2.0, hc + d * 6.4 + rd * (2.4 + 1.2 * o), 0.4, 0.12, WK_HOOK, pid=13)
        M.add(oriented_ellipsoid(hc + d * 5.4, np.stack([side, up_, d], 1), (1.0 + 2.2 * o, 1.0 + 2.2 * o, 0.6)), WK_MAW, pid=14)
        M.tips['head'] = hc
    M.root = V(0, 0, 0)
    return M

# ======================================================================== 보스 3. 감염 박사 (3장 격리 병동)
DR_COAT = M_(['#3a3a2e', '#6e6c58', '#a4a088', '#d4d0b8', '#f4f0dc'])
DR_STAIN = M_(['#2a1a10', '#4a3020', '#6e4a30', '#946a48'])
DR_SKIN = M_(['#3a2a3a', '#6a5068', '#9e7e98', '#d0b0c8'])
DR_FUNG = M_(['#1e0830', '#40145e', '#6e2a96', '#a660d0', '#e0b0ff'])
DR_GLOW = M_(['#5a1a8a', '#b04aff', '#e4aaff', '#ffffff'], True, '#c060ff')
DR_GLASS = M_(['#1a4a3a', '#3a8a6e', '#80d0b0', '#e0fff4'])
DR_SERUM = M_(['#1e7a10', '#4ae024', '#b0ff7a', '#f4ffe8'], True, '#5aff2a')
DR_METAL = M_(['#1a1c24', '#3a3e4c', '#6a7084', '#b0b8c8'])
def doctor(anim, t, v=None):
    M = Model()
    q = dict(HBASE)
    q.update(lean=0.25, hp=0.2, ht=0.1, drop=0.6, rh=(-8.5, 7.0, 6.0), lh=(9.0, 4.0, 3.0), w=(0, 1, 0), cape=0.15, tent=0.0, glow=0.0)
    ph = TAU * t
    if anim == 'idle':
        b = math.sin(ph); q.update(drop=0.6 + 0.4 * b, rh=(-8.5, 7 + 0.5 * b, 6), lh=(9, 4 + 0.4 * b, 3), tent=0.15 * b, cape=0.15 + 0.05 * b)
    elif anim == 'move':
        q.update(lth=0.6 * math.sin(ph), rth=-0.6 * math.sin(ph), lkn=0.15 + 1.0 * max(0, math.cos(ph)), rkn=0.15 + 1.0 * max(0, -math.cos(ph)),
                 drop=0.9 + 1.0 * abs(math.sin(ph)), lean=0.3, twist=0.12 * math.sin(ph), cape=0.6 + 0.15 * math.sin(2 * ph), tent=0.3 * math.sin(ph),
                 rh=(-8.5, 7, 6 + 2 * math.sin(ph)), lh=(9, 4, 3 - 2 * math.sin(ph)))
    elif anim == 'attack':   # 거대한 주사기로 찌르기
        q.update(keys(t, [(0, dict(rh=(-8.5, 7, 6), twist=0, lean=0.25, drop=0.6, fwd=0)), (0.38, dict(rh=(-9, 11, -6), twist=-0.6, lean=0.0, drop=1.0, fwd=-1)),
                          (0.55, dict(rh=(-3, 9, 13), twist=0.35, lean=0.5, drop=2.2, fwd=4, lth=0.7, lkn=0.6, rth=-0.5, rkn=0.4)),
                          (0.78, dict(rh=(-3, 9, 12.5), twist=0.35, lean=0.5, drop=2.2, fwd=4, lth=0.7, lkn=0.6, rth=-0.5, rkn=0.4)), (1, dict(rh=(-8.5, 7, 6), twist=0, lean=0.25, drop=0.6, fwd=0))]))
    elif anim == 'attack2':   # 왼팔 촉수로 크게 휩쓸기
        q.update(keys(t, [(0, dict(tent=0, twist=0, lh=(9, 4, 3))), (0.38, dict(tent=-1.0, twist=0.7, lh=(11, 9, -5))), (0.6, dict(tent=1.2, twist=-0.6, lh=(-2, 6, 12), lean=0.4)),
                          (0.8, dict(tent=1.0, twist=-0.6, lh=(-4, 5, 10), lean=0.35)), (1, dict(tent=0, twist=0, lh=(9, 4, 3)))]))
    elif anim == 'special':   # 목에 혈청을 찔러 넣고 포효 (강화)
        q.update(keys(t, [(0, dict(rh=(-8.5, 7, 6), hp=0.2, glow=0, lean=0.25)), (0.3, dict(rh=(-3, 15, 2), hp=0.35, glow=0.2, lean=0.2)),
                          (0.6, dict(rh=(-10, 14, 0), lh=(12, 15, 0), hp=-0.5, glow=1.0, lean=-0.25, cape=-0.2)), (0.85, dict(rh=(-10.5, 14.5, 0), lh=(12.5, 15.5, 0), hp=-0.45, glow=1.0, lean=-0.25)),
                          (1, dict(rh=(-8.5, 7, 6), lh=(9, 4, 3), hp=0.2, glow=0, lean=0.25))]))
    elif anim == 'hit':
        k = [1, 0.7, 0.4, 0.1][min(3, int(t * 3 + 0.5))]; q.update(lean=0.25 - 0.45 * k, hp=0.2 - 0.4 * k, fwd=-1.5 * k, drop=0.6 + 0.8 * k, cape=0.15 + 0.4 * k)
    elif anim == 'death':
        a = ss(t / 0.45); b = ss((t - 0.3) / 0.5)
        q.update(lkn=0.2 + 1.5 * a, rkn=0.2 + 1.4 * a, lth=0.8 * a * (1 - b), rth=0.6 * a * (1 - b), drop=6 * a, lean=0.3 + 0.4 * a, hp=0.3, cape=0.3 + 0.5 * b, rh=(-8, 3, 7), lh=(8, 3, 7))
        q['fall'] = 1.4 * b
    J = hskel(q); R = J['R']
    for s in 'lr':
        limb(M, J[s + 'hip'], J[s + 'kn'], 2.6, 2.2, DR_METAL, pid=1)
        limb(M, J[s + 'kn'], J[s + 'an'] + V(0, 1.2, 0), 2.2, 1.9, DR_METAL, pid=2)
        A = J[s + 'an']; limb(M, A + V(0, -1.0, -0.6), A + V(0, -1.3, 3.6), 1.9, 1.6, DR_STAIN, pid=3); limb(M, A + V(0, 1.6, 0), A + V(0, -0.6, 0), 2.1, 2.0, DR_STAIN, pid=3)
    # 찢어진 가운: 주인공 가운 자락 함수를 재질만 바꿔 재사용
    saved = (HERO.COAT, HERO.TRIM, HERO.LINING)
    HERO.COAT, HERO.TRIM, HERO.LINING = DR_COAT, DR_STAIN, DR_FUNG
    try: HERO.coat_skirt(M, J, q)
    finally: HERO.COAT, HERO.TRIM, HERO.LINING = saved
    M.add(oriented_ellipsoid(J['abd'], R, (4.4, 3.9, 3.1)), DR_COAT, pid=4)
    M.add(oriented_ellipsoid(J['chest'], R, (6.0, 5.0, 3.7)), DR_COAT, pid=5)
    for k in range(6):
        M.add(oriented_ellipsoid(J['pel'] + R @ V(0, 11.6 - k * 1.3, 3.2), R, (1.0 + k * 0.3, 1.05, 0.55)), DR_SKIN, pid=6)
    for (x, y, z) in ((2, 7, 3.6), (-3, 3, 3.4), (3.5, 10, 3.0)): M.decal(J['pel'] + R @ V(x, y, z), '#5a3a20', 2, 1.4)
    # 등의 곰팡이 날개 (부채꼴 혹)
    g = q['glow']
    for k in range(9):
        a = -1.2 + k * 0.3
        b0 = J['chest'] + R @ V(math.sin(a) * 3, 2.0, -3.4)
        tip = J['chest'] + R @ V(math.sin(a) * (11 + 2 * g), 8 + 6 * math.cos(a) + 2 * g, -8 - 2 * math.cos(a))
        chain(M, [b0, (b0 + tip) / 2 + R @ V(0, 1.5, -1), tip], [1.4, 1.1, 0.6], DR_FUNG, pid=7)
        M.add(ellipsoid(tip, 1.3 + 0.4 * (k % 2) + 0.4 * g), DR_GLOW if k % 2 else DR_FUNG, pid=8)
    for (x, y, z, r) in ((3, 4, -4.6, 2.4), (-3.5, 5, -4.4, 2.0), (0, 1, -4.8, 2.2), (5.5, 12, -1, 2.0)):
        M.add(ellipsoid(J['pel'] + R @ V(x, y + 9, z), r), DR_FUNG, pid=9); M.add(ellipsoid(J['pel'] + R @ V(x, y + 9 + r * 0.8, z - 0.5), r * 0.35), DR_GLOW, pid=10)
    # 오른팔: 거대 주사기
    sh, el, ha = J['rsh'], J['rel'], J['rha']
    M.add(ellipsoid(sh, 2.8), DR_COAT, pid=11); limb(M, sh, el, 2.3, 2.1, DR_COAT, pid=12)
    fa = nz(ha - el); limb(M, el, ha, 2.0, 1.8, DR_SKIN, pid=13)
    upv = nz(np.cross(fa, np.cross(R @ V(0, 1, 0), fa)) + 1e-6)
    sb = ha + fa * 0.5
    limb(M, sb - fa * 3.5, sb, 0.8, 0.8, DR_METAL, pid=14)
    M.add(oriented_ellipsoid(sb - fa * 3.5, frame_from(fa), (2.2, 0.4, 2.2)), DR_METAL, pid=15)
    limb(M, sb + fa * 0.5, sb + fa * 9.5, 2.0, 2.0, DR_GLASS, pid=16)
    limb(M, sb + fa * 1.5, sb + fa * 8.8, 1.45, 1.45, DR_SERUM, pid=17)
    for k in range(4): M.add(capsule(sb + fa * (2.5 + k * 2), sb + fa * (2.7 + k * 2), 2.15, 2.15, caps=False), DR_METAL, pid=18)
    limb(M, sb + fa * 9.5, sb + fa * 10.8, 1.6, 0.9, DR_METAL, pid=19)
    limb(M, sb + fa * 10.8, sb + fa * 17.5, 0.35, 0.12, DR_METAL, pid=20)
    M.tips['needle'] = sb + fa * 17.5; M.tips['syr'] = sb + fa * 6
    # 왼팔: 촉수 덩어리
    sh, el, ha = J['lsh'], J['lel'], J['lha']
    M.add(ellipsoid(sh, 2.8), DR_COAT, pid=21); limb(M, sh, el, 2.3, 2.2, DR_COAT, pid=22)
    fa = nz(ha - el); limb(M, el, ha, 2.4, 2.6, DR_FUNG, pid=23)
    side = nz(np.cross(fa, R @ V(0, 1, 0)))
    for k in range(4):
        base = ha + side * (k - 1.5) * 1.0
        pts = [base]
        for j in range(1, 9):
            s = j / 8
            bend = q['tent'] * 1.4 * s * s
            d = nz(fa * math.cos(bend) + side * math.sin(bend) * (1 if k % 2 else 0.7) + V(0, -0.3 * s, 0))
            pts.append(pts[-1] + d * 2.0 + side * 0.4 * math.sin(TAU * t + k + j * 0.7))
        chain(M, pts, [1.0 - 0.8 * j / 8 for j in range(9)], DR_FUNG, pid=24 + k)
        M.add(ellipsoid(pts[-1], 0.5), DR_GLOW, pid=28)
    M.tips['tent'] = pts[-1]; M.tips['tentb'] = ha
    # 머리: 반쯤 곰팡이에 먹힌 얼굴 + 깨진 고글
    H = J['head']; Rh = J['Rh']
    M.add(oriented_ellipsoid(H, Rh, (4.2, 4.7, 4.3)), DR_SKIN, pid=30)
    for (x, y, z, r) in ((-2.5, 2.0, 1.5, 2.2), (-3.5, 0, -1, 1.8), (-1, 3.5, -2, 2.0), (2.5, 3.6, -1.5, 1.4)):
        M.add(ellipsoid(H + Rh @ V(x, y, z), r), DR_FUNG, pid=31)
    M.add(ellipsoid(H + Rh @ V(-2.4, 3.2, 2.6), 0.8 + 0.6 * g), DR_GLOW, pid=32)
    for k in range(14):
        a = k / 14 * TAU; M.add(ellipsoid(H + Rh @ V(math.sin(a) * 4.6, 2.6, math.cos(a) * 4.5), 0.6), DR_METAL, pid=33)
    M.add(oriented_ellipsoid(H + Rh @ V(1.8, 0.4, 3.9), Rh, (1.4, 1.2, 0.7)), DR_METAL, pid=34)
    M.add(oriented_ellipsoid(H + Rh @ V(1.8, 0.4, 4.4), Rh, (1.0, 0.9, 0.4)), DR_SERUM, pid=35)
    M.add(oriented_ellipsoid(H + Rh @ V(-1.8, 0.4, 3.9), Rh, (1.0, 0.8, 0.5)), DR_GLOW, pid=36)
    M.add(oriented_ellipsoid(H + Rh @ V(0, -2.4, 3.6), Rh, (1.6, 0.4 + 0.6 * g, 0.5)), M_(['#1a0408', '#3a0a12', '#5e1420', '#842230']), pid=37)
    # 바닥 맞추기 + 쓰러짐
    soles = min(J['lan'][1], J['ran'][1]) - 2.4
    T = V(0, -soles, 0); fall = q.get('fall', 0); Rf = rot_x(-fall); piv = V(0, 0, 3.0)
    def tf(p):
        p = p + T
        return (p - piv) @ Rf.T + piv if fall else p
    M.parts = [(tf(p), n @ Rf.T if fall else n, m, i) for p, n, m, i in M.parts]
    lo = min(p[:, 1].min() for p, n, m, i in M.parts) if fall else 0
    if fall: M.parts = [(p - V(0, lo, 0), n, m, i) for p, n, m, i in M.parts]
    M.decals = [(tf(d_[None])[0] - V(0, lo, 0), c, s, b) for d_, c, s, b in M.decals]
    M.tips = {k: tf(vv[None])[0] - V(0, lo, 0) for k, vv in M.tips.items()}
    M.root = V(0, 0, 0)
    return M

# ======================================================================== 보스 4. 나선의 지배자 (4장 유전체 금고)
HX_A = M_(['#0a6a4a', '#1ad890', '#90ffcc', '#f0fff8'], True, '#3cffae')
HX_B = M_(['#5a0a6a', '#c02ad8', '#f08aff', '#fff0ff'], True, '#d050ff')
HX_RUNG = M_(['#4a4a6a', '#8a8ab0', '#d0d0f0', '#ffffff'], True, '#c0c8ff')
HX_SPINE = M_(['#0c0a16', '#1c1830', '#302a50', '#4c4478', '#8478c0'])
HX_CRY = M_(['#1a0c3a', '#3a2070', '#6a48b0', '#a888e8', '#f0e8ff'])
HX_EYE = M_(['#7a6a00', '#ffe020', '#fff6a0', '#ffffff'], True, '#ffe040')
def helix(anim, t, v=None):
    M = Model()
    q = dict(h=18.0, wave=t, amp=1.0, rear=0.0, lunge=0.0, open=0.0, unzip=0.0, glow=0.3, fall=0.0, spin=t * TAU)
    ph = TAU * t
    if anim == 'idle': q.update(h=18 + 1.5 * math.sin(ph), wave=t, glow=0.3 + 0.2 * math.sin(ph))
    elif anim == 'move': q.update(h=18 + 1.0 * math.sin(ph * 2), wave=t * 2, amp=1.8)
    elif anim == 'attack':   # 머리를 젖혔다가 빛줄기 발사
        q.update(keys(t, [(0, dict(rear=0, open=0, glow=0.3)), (0.4, dict(rear=1.0, open=0.3, glow=1.2)), (0.55, dict(rear=-0.2, open=1.0, glow=2.0)),
                          (0.85, dict(rear=-0.2, open=1.0, glow=1.6)), (1, dict(rear=0, open=0, glow=0.3))]))
    elif anim == 'attack2':   # 몸을 감았다가 앞으로 내리꽂기
        q.update(keys(t, [(0, dict(lunge=0, rear=0, h=18)), (0.38, dict(lunge=-5, rear=0.7, h=22)), (0.56, dict(lunge=18, rear=-0.6, h=9, open=0.8)),
                          (0.78, dict(lunge=16, rear=-0.5, h=10, open=0.4)), (1, dict(lunge=0, rear=0, h=18, open=0))]))
    elif anim == 'special':   # 두 가닥이 풀려 넓게 벌어졌다가 다시 감김 (분열 소환)
        q.update(keys(t, [(0, dict(unzip=0, glow=0.3)), (0.45, dict(unzip=1.0, glow=1.5)), (0.7, dict(unzip=1.1, glow=1.8)), (1, dict(unzip=0, glow=0.3))]))
        q['spin'] = TAU * (t + ss(t) * 1.5)
    elif anim == 'hit':
        k = [1, 0.7, 0.4, 0.1][min(3, int(t * 3 + 0.5))]; q.update(rear=0.4 * k, h=18 - 2 * k)
    elif anim == 'death':
        a = ss(t / 0.8); q.update(fall=a, unzip=1.6 * a, h=18 - 12 * a, glow=0.3 + 1.2 * a)
    # 척추 곡선: 꼬리(뒤·아래) → 머리(앞·위)
    N = 26; pts = []
    for k in range(N + 1):
        s = k / N
        z = -38 + 46 * s + q['lunge'] * s ** 3 - 6 * max(0, s - 0.75) * q['rear']
        y = q['h'] * (0.25 + 1.05 * s ** 1.3) + 5 * math.sin(TAU * (s * 0.8 - q['wave'])) * (1 - s * 0.6) + q['rear'] * 14 * max(0, s - 0.6) ** 1.2
        x = q['amp'] * 7 * math.sin(TAU * (s * 0.7 - q['wave'] * 0.5)) * (1 - s * 0.7)
        if q['fall'] > 0: y = lerp(y, 2.5 + 1.5 * math.sin(s * 7), q['fall'])
        pts.append(V(x, max(2.0, y), z))
    for k in range(N):
        s = k / N; r = 0.8 + 1.0 * math.sin(min(1, s * 1.4) * math.pi / 2)
        if q['fall'] < 0.7: limb(M, pts[k], pts[k + 1], r * 0.7, r * 0.7, HX_SPINE, pid=1)
    # 이중나선 두 가닥 + 염기쌍 가로대
    prevA = prevB = None
    for k in range(N * 4 + 1):
        s = k / (N * 4); i = min(N - 1, int(s * N)); u = s * N - i
        p = pts[i] + (pts[i + 1] - pts[i]) * u
        d = nz(pts[i + 1] - pts[i]); _, e1, e2 = rig._basis(d)
        ang = q['spin'] + s * 11 * math.pi
        rr = (1.4 + 1.6 * math.sin(min(1, s * 1.3) * math.pi / 2)) * (1 + 2.2 * q['unzip'])
        A = p + (e1 * math.cos(ang) + e2 * math.sin(ang)) * rr
        B = p - (e1 * math.cos(ang) + e2 * math.sin(ang)) * rr
        if q['fall'] > 0: A[1] = max(0.8, A[1]); B[1] = max(0.8, B[1])
        rad = 0.55 + 0.45 * math.sin(min(1, s * 1.3) * math.pi / 2)
        if prevA is not None:
            limb(M, prevA, A, rad, rad, HX_A, pid=2); limb(M, prevB, B, rad, rad, HX_B, pid=3)
        if k % 4 == 0 and q['unzip'] < 0.6: limb(M, A, B, 0.28, 0.28, HX_RUNG, pid=4)
        prevA, prevB = A, B
    # 머리: 결정 왕관을 쓴 각진 머리
    hd = pts[-1]; d = nz(pts[-1] - pts[-2])
    if q['fall'] < 0.8:
        hc = hd + d * 3
        Rh = frame_from(d, V(0, 1, 0)) @ rot_y(0)
        (ps, ns), faces = icosa(hc, 5.5, frame_from(V(0, 1, 0), d))
        M.add((ps, ns), HX_SPINE, pid=10)
        side = nz(np.cross(V(0, 1, 0), d)) if abs(d[1]) < 0.95 else V(1, 0, 0); up_ = nz(np.cross(d, side))
        for s_ in (1, -1):
            M.add(ellipsoid(hc + d * 4.2 + side * s_ * 2.2 + up_ * 1.4, 1.0), HX_EYE, pid=11)
        for k in range(7):
            a = -1.3 + k * 0.43
            crystal(M, hc + up_ * 4.0 + side * math.sin(a) * 4 - d * 1.0, up_ * math.cos(a) * 1.2 + side * math.sin(a) - d * 0.4, 6.5 - abs(a) * 2, 1.0, HX_CRY, pid=12 + k, rot=k)
        o = q['open']
        limb(M, hc + d * 3 - up_ * 2.0, hc + d * (7 + 2 * o) - up_ * (2.5 + 3 * o), 1.5, 0.6, HX_CRY, pid=20)
        if o > 0.2:
            M.add(ellipsoid(hc + d * (6 + 2 * o), 1.0 + 2.5 * o * q['glow'] / 2), HX_A, pid=21)
        M.tips['head'] = hc; M.tips['mouth'] = hc + d * 7
    # 주위를 도는 뉴클레오타이드 고리
    g = q['glow']
    for k in range(18):
        a = q['spin'] * 0.7 + k * TAU / 18
        c = pts[N // 2]
        M.add(ellipsoid(c + V(math.cos(a) * (13 + 5 * q['unzip']), 4 * math.sin(a * 2) - 2 * q['fall'] * 0, math.sin(a) * (13 + 5 * q['unzip'])), 0.6 + 0.3 * g * (k % 2)), [HX_A, HX_B, HX_RUNG][k % 3], pid=30)
    M.root = V(0, 0, 0)
    return M
