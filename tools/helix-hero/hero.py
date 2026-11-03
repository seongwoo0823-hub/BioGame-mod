# 주인공 "생명과학자" 3D 기본 도형 모델
# 캐릭터 공간: +x = 캐릭터의 왼쪽, +y = 위, +z = 앞
import numpy as np, math
from rig import *

def M_(ramp, em=False, glow=None): return Mat(ramp, em, glow)
SKIN   = M_(['#6a3828', '#a8644a', '#dc9c76', '#f6caa6'])
HAIR   = M_(['#0e0a0e', '#1f171c', '#352a2e', '#4e3e3e'])
COAT   = M_(['#454a5e', '#8a90a6', '#c6cad8', '#eceef4', '#ffffff'])
LINING = M_(['#0c3a3a', '#145a58', '#1e7c76', '#2a9a90'])
TRIM   = M_(['#0b4644', '#127e76', '#1fc0ac', '#78f2d8'])
SHIRT  = M_(['#0a1014', '#141f25', '#203038', '#30484f'])
PANTS  = M_(['#0b0d13', '#181c26', '#272d3c', '#3a4254'])
BOOTS  = M_(['#07070b', '#12141c', '#1f2232', '#333a50'])
GLOVE  = M_(['#08090d', '#151820', '#252a36', '#3a4150'])
BELT   = M_(['#100c0a', '#241c16', '#3a2e24', '#56463a'])
METAL  = M_(['#12141b', '#2a2e3a', '#4a5264', '#8a92a6', '#d4dae6'])
STEEL  = M_(['#262c38', '#56607a', '#9aa4bc', '#dfe6f4'])
LENS   = M_(['#08605e', '#16c4b2', '#86ffec', '#effffb'], True, '#36f2d0')
HELIXA = M_(['#08785a', '#1ce49c', '#98ffd0', '#f0fff8'], True, '#3cffae')
HELIXB = M_(['#0a5888', '#18b4e6', '#88e6ff', '#f0fbff'], True, '#36ccff')
RUNG   = M_(['#4a8a80', '#9ad8cc', '#e0fff8', '#ffffff'], True, '#bafff0')
BLADE  = M_(['#0a6a68', '#20d4bc', '#9cfff0', '#ffffff'], True, '#44ffe0')
EDGE   = M_(['#9afff0', '#e8fffa', '#ffffff', '#ffffff'], True, '#c8fff4')
VIAL   = M_(['#0c7a40', '#2ae07a', '#a8ffc8', '#f4fff8'], True, '#46ff98')
FLASK  = M_(['#0a6a8a', '#22c8f0', '#a0f0ff', '#ffffff'], True, '#40d8ff')
GUNB   = M_(['#151821', '#2c3140', '#4c5568', '#7e889e'])
FLASH  = M_(['#a8ffd8', '#e0fff0', '#ffffff', '#ffffff'], True, '#7affc0')
ORB    = M_(['#10a070', '#3cffb4', '#c0ffe6', '#ffffff'], True, '#3cffae')

def lerp(a, b, t): return a + (b - a) * t
def ss(t): t = min(1, max(0, t)); return t * t * (3 - 2 * t)
def nz(v): v = np.array(v, float); return v / (np.linalg.norm(v) + 1e-9)

BASE = dict(lean=0.0, twist=0.0, tilt=0.0, drop=0.0, fwd=0.0, side=0.0, air=0.0, spin=0.0,
            lth=0.06, lkn=0.14, rth=-0.06, rkn=0.14, lab=0.07, rab=0.07, lft=0.0, rft=0.0,
            hp=0.0, hy=0.0, ht=0.0, fall=0.0,
            rh=(-8.4, 4.4, 2.6), lh=(6.9, 1.8, 0.8),
            w=(-0.3, 1.0, 0.0), wb=(-0.55, 0.0, 0.85), two=0.0, g2=-6.0,
            stow=0.0, gun=0.0, flask=0.0, flaskp=None, glow=0.0, flash=0.0,
            cape=0.12, flare=0.0, coatsw=0.0)

# ---------------------------------------------------------------- 뼈대
def leg(Hp, side, th, kn, ab):
    d = nz([side * math.sin(ab), -math.cos(th), math.sin(th)])
    K = Hp + 9.6 * d
    s = nz([side * math.sin(ab) * 0.5, -math.cos(th - kn), math.sin(th - kn)])
    return K, K + 9.2 * s

def ik(S, T, side, R, L1=6.2, L2=5.9, pole=None):
    d = T - S; D = np.linalg.norm(d)
    D2 = min(max(D, abs(L1 - L2) + 0.2), L1 + L2 - 0.05)
    dn = d / (D + 1e-9); T2 = S + dn * D2
    a = (L1 * L1 - L2 * L2 + D2 * D2) / (2 * D2); h = math.sqrt(max(0.0, L1 * L1 - a * a))
    pv = R @ np.array(pole if pole is not None else [side * 0.55, -0.35, -0.75])
    pv = pv - dn * np.dot(pv, dn)
    if np.linalg.norm(pv) < 1e-3: pv = R @ np.array([0, -1.0, 0]); pv = pv - dn * np.dot(pv, dn)
    pv = nz(pv)
    return S + dn * a + pv * h, T2

def skeleton(q):
    hipY = 21.0 - q['drop']
    pel = np.array([q['side'], hipY, q['fwd']])
    J = {'pel': pel}
    for side, nm in ((1, 'l'), (-1, 'r')):
        Hp = pel + np.array([side * 3.0, 0, 0])
        K, A = leg(Hp, side, q[nm + 'th'], q[nm + 'kn'], q[nm + 'ab'])
        J[nm + 'hip'] = Hp; J[nm + 'kn'] = K; J[nm + 'an'] = A
    R = rot_y(q['twist']) @ rot_x(q['lean']) @ rot_z(q['tilt'])
    def up(v): return pel + R @ np.array(v, float)
    J['R'] = R; J['up'] = up
    J['abd'] = up([0, 4.2, 0.1]); J['chest'] = up([0, 9.2, 0.3]); J['neck'] = up([0, 13.6, 0.2])
    Rh = R @ rot_y(q['hy']) @ rot_x(q['hp']) @ rot_z(q['ht']); J['Rh'] = Rh
    J['head'] = J['neck'] + Rh @ np.array([0, 5.2, 0.5])
    J['lsh'] = up([6.0, 11.8, 0]); J['rsh'] = up([-6.0, 11.8, 0])
    # 오른손 → 무기 방향 → 왼손(양손잡기)
    rT = up(q['rh'])
    J['rel'], J['rha'] = ik(J['rsh'], rT, -1, R)
    w = nz(R @ np.array(q['w'], float))
    wb = R @ np.array(q['wb'], float)
    if q.get('wauto', 0) > 0:
        ax = R @ np.array(q['wax'], float)
        lead = np.cross(ax, w) * q.get('wsg', 1)
        if np.linalg.norm(lead) > 1e-3: wb = lerp(nz(wb - w * np.dot(wb, w)), nz(lead), q['wauto'])
    wb = nz(wb - w * np.dot(wb, w))
    J['w'] = w; J['wb'] = wb
    lT = up(q['lh'])
    if q['two'] > 0 and q['stow'] < 0.5:
        lT = lerp(lT, J['rha'] + w * q['g2'], q['two'])
    J['lel'], J['lha'] = ik(J['lsh'], lT, 1, R)
    return J

# ---------------------------------------------------------------- 몸
def limb(M, a, b, r1, r2, mat, pid=None): M.add(capsule(a, b, r1, r2), mat, pid)

def build_body(M, J, q):
    R = J['R']
    # 다리
    for s in 'lr':
        limb(M, J[s + 'hip'], J[s + 'kn'], 2.55, 2.1, PANTS)
        limb(M, J[s + 'kn'], J[s + 'an'] + np.array([0, 1.2, 0]), 2.1, 1.85, PANTS)
        A = J[s + 'an']; ft = q[s + 'ft']
        fd = nz([0, -0.12 - 0.6 * ft, 1.0])
        # 장화: 발목 감싸개 + 발등 + 밑창(청록 줄)
        limb(M, A + np.array([0, 2.2, 0]), A + np.array([0, -0.4, -0.2]), 2.05, 1.95, BOOTS)
        limb(M, A + np.array([0, -0.8, -0.8]), A + fd * 3.8 + np.array([0, -1.1, 0]), 1.75, 1.45, BOOTS)
        M.add(box(A + fd * 1.6 + np.array([0, -2.25, 0]), frame_from(np.array([0, 1.0, 0]), fd), (1.7, 0.28, 3.4)), TRIM)
    # 골반·벨트
    M.add(oriented_ellipsoid(J['pel'] + R @ np.array([0, 0.8, 0]), R, (4.7, 2.7, 3.2)), PANTS)
    M.add(oriented_ellipsoid(J['pel'] + R @ np.array([0, 2.2, 0]), R, (4.75, 0.9, 3.3)), BELT, pid=40)
    M.add(box(J['pel'] + R @ np.array([0, 2.2, 3.4]), R, (1.0, 0.75, 0.3)), METAL, pid=41)
    # 허리 앞쪽 발광 약병 장치
    vp = J['pel'] + R @ np.array([3.3, 1.6, 2.6])
    M.add(box(vp, R, (1.1, 1.5, 0.8)), GUNB, pid=42)
    M.add(oriented_ellipsoid(vp + R @ np.array([0, 0, 0.75]), R, (0.75, 1.15, 0.4)), VIAL, pid=43)
    # 셔츠(몸통)
    M.add(oriented_ellipsoid(J['abd'], R, (4.3, 3.8, 3.0)), COAT, pid=44)
    M.add(oriented_ellipsoid(J['chest'], R, (5.5, 4.7, 3.4)), COAT, pid=45)
    # 가운 앞섶이 열려 셔츠가 보이는 V자
    for k in range(8):
        wv = 0.9 + min(k, 5) * 0.32
        M.add(oriented_ellipsoid(J['pel'] + R @ np.array([0, 11.6 - k * 1.3, 3.15 - 0.05 * min(k, 5)]), R, (wv * 1.15, 1.05, 0.55)), SHIRT, pid=46)
    # 가슴 발광 엠블럼(육각형)
    em = J['chest'] + R @ np.array([0, 0.3, 3.62])
    for a in range(6):
        ang = a * math.pi / 3
        M.decal(em + R @ np.array([math.cos(ang) * 0.9, math.sin(ang) * 0.9, 0]), '#46ffb0', 1, 1.6)
    M.decal(em, '#c8fff0', 1, 1.6)
    # 앞섶 테두리(청록)
    for sgn in (1, -1):
        pts = [R @ np.array([sgn * (1.0 + 0.9 * k / 5), 12.2 - k * 1.6, 3.4 - 0.12 * k]) + J['pel'] for k in range(6)]
        for a, b in zip(pts, pts[1:]): limb(M, a, b, 0.42, 0.42, TRIM, pid=47)
    # 목·옷깃(세운 깃)
    limb(M, J['chest'], J['neck'], 1.7, 1.6, SKIN)
    for k in range(9):
        a = -2.4 + k * 0.6
        base = J['neck'] + R @ np.array([math.sin(a) * 2.6, -1.4, math.cos(a) * 2.2 - 0.3])
        top = J['neck'] + R @ np.array([math.sin(a) * 3.3, 1.3, math.cos(a) * 2.8 - 0.6])
        limb(M, base, top, 0.75, 0.6, COAT if abs(a) > 0.3 else COAT, pid=48)
        M.add(ellipsoid(top + R @ np.array([0, 0.2, 0]), 0.5), TRIM, pid=49)
    # 팔(가운 소매) + 청록 소맷단 + 장갑
    for s in 'lr':
        sh = J[s + 'sh']; el = J[s + 'el']; ha = J[s + 'ha']
        M.add(oriented_ellipsoid(sh + R @ np.array([0, 0.3, 0]), R, (2.5, 2.2, 2.5)), COAT, pid=50)
        limb(M, sh, el, 2.25, 2.05, COAT, pid=51)
        fa = nz(ha - el)
        limb(M, el, ha - fa * 2.0, 2.05, 2.15, COAT, pid=52)
        M.add(capsule(ha - fa * 2.2, ha - fa * 1.4, 2.25, 2.25, caps=False), TRIM, pid=53)
        limb(M, ha - fa * 1.4, ha - fa * 0.2, 1.45, 1.4, GLOVE, pid=54)
        M.add(ellipsoid(ha + fa * 0.5, (1.55, 1.55, 1.55)), GLOVE, pid=55)

def coat_skirt(M, J, q):
    """허리에서 종아리까지 내려오는 가운 자락 (다리 움직임·바람·회전을 따라 흔들림)"""
    R = J['R']; pel = J['pel']; up0 = np.array([0, 1.0, 0])
    nrows, ncols = 6, 26
    gap = 0.36
    angs = np.linspace(gap, 2 * math.pi - gap, ncols)
    rest = {s: J[s + 'hip'] + np.array([0, -9.4, 0.8]) for s in 'lr'}
    cape = q['cape']; flare = q['flare']; sw = q['coatsw']
    P = np.zeros((nrows, ncols, 3))
    for j, a in enumerate(angs):
        sa, ca = math.sin(a), math.cos(a)
        top = pel + R @ np.array([sa * 4.95, 2.6, ca * 3.45])
        # 아랫단 기준점: 골반 아래, 조금 퍼짐
        hem = pel + np.array([0, -16.2 + q['drop'] * 0.35, 0]) + rot_y(q['twist'] * 0.6) @ np.array([sa * (6.4 + 3.6 * flare), 0, ca * (5.0 + 3.6 * flare)])
        wl = (1 + sa) / 2; wr = 1 - wl
        front = max(0.0, ca)
        kd = wl * (J['lkn'] - rest['l']) + wr * (J['rkn'] - rest['r'])
        hem = hem + kd * (0.5 + 0.9 * front) * 1.25
        # 앞으로 숙이면 뒷자락은 길게 떨어짐
        hem = hem + np.array([0, 0, 1]) * (q['lean'] * 3.0 * max(0, -ca) * 0)
        back = max(0.0, -ca) * 0.75 + 0.25
        wind = R @ np.array([sw * 2.0 * sa, 0, 0]) + rot_y(q['twist']) @ np.array([0, cape * 4.2, -cape * 9.0]) * back
        hem = hem + wind
        if flare > 0: hem = hem + np.array([0, flare * 5.5, 0])
        for i in range(nrows):
            t = i / (nrows - 1)
            p = lerp(top, hem, t)
            # 위쪽은 몸을 따라, 가운데는 엉덩이에 맞게 볼록
            bulge = math.sin(t * math.pi) * (0.9 + 0.3 * front)
            p = p + R @ np.array([sa * bulge, 0, ca * bulge * 0.8])
            # 천이 늘어지는 곡선 (아래로 갈수록 바람 영향 증가)
            p = p - wind * (t - t * t) * 0.6
            P[i, j] = p
    pts, nrm = sheet(P)
    c = pel.copy(); d = pts - c; d[:, 1] = 0
    flip = np.sum(nrm * d, 1) < 0; nrm[flip] *= -1
    M.add((pts, nrm), COAT, pid=60)
    # 아랫단 청록 띠 + DNA 무늬, 앞섶 가장자리
    hemrow = P[-1]
    for a, b in zip(hemrow, hemrow[1:]): limb(M, a, b, 0.55, 0.55, TRIM, pid=61)
    for j in range(0, ncols - 1):
        mid = (hemrow[j] + hemrow[j + 1]) / 2
        up_ = P[-2, j] - P[-1, j]; up_ = nz(up_)
        out = nz(np.array([mid[0] - pel[0], 0, mid[2] - pel[2]]))
        k = 1.0 + 0.55 * math.sin(j * 1.7)
        M.decal(mid + up_ * k * 1.2 + out * 0.9, '#3cffae' if j % 2 else '#36ccff', 1, 1.4)
    for col in (0, ncols - 1):
        edge = P[:, col]
        for a, b in zip(edge, edge[1:]): limb(M, a, b, 0.42, 0.42, TRIM, pid=62)
    # 안감(앞섶 사이로 살짝 보이는 청록 안쪽)
    for col, off in ((0, 1), (ncols - 1, -2)):
        for i in range(1, nrows):
            p = P[i, col]; ctr = np.array([pel[0], p[1], pel[2]])
            M.add(ellipsoid(p + (ctr - p) * 0.12, 0.55), LINING, pid=63)

def build_head(M, J, q):
    H = J['head']; Rh = J['Rh'] * 1.14
    M.add(oriented_ellipsoid(H, Rh, (4.2, 4.6, 4.2)), SKIN, pid=70)
    # 귀
    for s in (1, -1): M.add(oriented_ellipsoid(H + Rh @ np.array([s * 4.0, -0.2, -0.2]), Rh, (0.7, 1.2, 0.9)), SKIN, pid=71)
    # 머리카락: 두피 + 삐친 머리 다발
    M.add(oriented_ellipsoid(H + Rh @ np.array([0, 1.25, -0.7]), Rh, (4.55, 4.0, 4.5)), HAIR, pid=72)
    tufts = [(0, 4.2, -1.0, 0.4, 5.6, -5.4), (2.2, 3.8, -0.6, 4.2, 6.0, -3.6), (-2.2, 3.8, -0.6, -4.0, 6.4, -3.2),
             (1.2, 3.4, 2.2, 2.4, 2.0, 4.8), (-1.0, 3.6, 2.4, -1.6, 2.4, 5.0), (0.2, 3.9, 2.2, 0.6, 1.4, 5.0),
             (3.4, 2.6, 1.2, 5.0, 0.0, 2.4), (-3.4, 2.6, 1.2, -5.0, 0.2, 2.2), (3.6, 1.6, -2.4, 5.0, -1.2, -3.6),
             (-3.6, 1.6, -2.4, -5.0, -1.0, -3.6), (0, 2.6, -3.8, 0.2, -1.4, -5.2), (1.8, 4.0, -2.6, 2.6, 3.6, -6.4)]
    for x0, y0, z0, x1, y1, z1 in tufts:
        limb(M, H + Rh @ np.array([x0, y0, z0]), H + Rh @ np.array([x1, y1, z1]), 1.45, 0.3, HAIR, pid=73)
    # 고글 (이마 위): 띠 + 두 렌즈
    for k in range(14):
        a = k / 14 * 2 * math.pi
        p = H + Rh @ np.array([math.sin(a) * 4.7, 3.2 - 0.1 * math.cos(a), math.cos(a) * 4.55])
        M.add(ellipsoid(p, 0.62), METAL, pid=74)
    for s in (1, -1):
        c = H + Rh @ np.array([s * 1.85, 3.75, 3.55])
        ax = J['Rh'] @ rot_x(-0.95)
        M.add(oriented_ellipsoid(c, ax, (1.75, 1.35, 0.9)), METAL, pid=75)
        M.add(oriented_ellipsoid(c + ax @ np.array([0, 0, 0.55]), ax, (1.3, 0.98, 0.55)), LENS, pid=76)
    # 눈·눈썹·입
    for s in (1, -1):
        M.decal(H + Rh @ np.array([s * 1.55, 0.0, 4.15]), '#0e1a1c', 1, 2.0)
        M.decal(H + Rh @ np.array([s * 1.55 - 0.35, 0.0, 4.15]), '#2ae8c8', 1, 2.0)
        M.decal(H + Rh @ np.array([s * 1.75, 1.2, 4.05]), '#1a1214', 2 if s < 0 else 1, 2.0)
    M.decal(H + Rh @ np.array([0, -2.4, 3.95]), '#8a4a3a', 1, 1.8)

# ---------------------------------------------------------------- 무기: 이중나선 낫
def scythe(M, q, J, base=None, w=None, wb=None):
    if base is None: base = J['rha']; w = J['w']; wb = J['wb']
    v = np.cross(w, wb)
    butt = base - w * 8.5; head = base + w * 22.0
    limb(M, butt, head, 0.42, 0.42, METAL, pid=80)
    # 손잡이 감개
    limb(M, base - w * 2.4, base + w * 2.4, 0.7, 0.7, GLOVE, pid=81)
    # 이중나선 자루
    n = 52; prevA = prevB = None
    for k in range(n + 1):
        s = -7.5 + 28.5 * k / n
        ph = s * 1.05
        c = base + w * s
        A = c + (wb * math.cos(ph) + v * math.sin(ph)) * 0.95
        B = c - (wb * math.cos(ph) + v * math.sin(ph)) * 0.95
        if prevA is not None:
            limb(M, prevA, A, 0.32, 0.32, HELIXA, pid=82); limb(M, prevB, B, 0.32, 0.32, HELIXB, pid=83)
        if k % 3 == 0 and abs(s) > 2.6: limb(M, A, B, 0.18, 0.18, RUNG, pid=84)
        prevA, prevB = A, B
    # 물미(아래 끝)
    limb(M, butt, butt - w * 1.8, 0.75, 0.25, STEEL, pid=85)
    M.add(ellipsoid(butt, 0.8), METAL, pid=85)
    # 낫 머리: 금속 고리 + 결정 칼날(초승달)
    M.add(oriented_ellipsoid(head, frame_from(w, wb), (1.3, 1.6, 1.3)), METAL, pid=86)
    M.add(ellipsoid(head + w * 0.6, 0.75), HELIXA, pid=87)
    N = 16; pts = blade_curve(head, w, wb, N)
    for k in range(N):
        s = (k + 0.5) / N
        a, b = pts[k], pts[k + 1]; t = nz(b - a)
        inn = nz(np.cross(v, t))   # 날 안쪽(오목한 쪽)
        if np.dot(inn, -w) < 0: inn = -inn
        wd = 2.3 * (1 - s) ** 0.8 + 0.25
        cc = (a + b) / 2 + inn * wd * 0.35
        ax = np.stack([t, inn, v], 1)
        M.add(oriented_ellipsoid(cc, ax, (np.linalg.norm(b - a) * 0.75, wd, 0.42)), BLADE, pid=88)
        M.add(oriented_ellipsoid(cc + inn * wd * 0.85, ax, (np.linalg.norm(b - a) * 0.7, 0.32, 0.3)), EDGE, pid=89)
        M.add(oriented_ellipsoid(cc - inn * wd * 0.75, ax, (np.linalg.norm(b - a) * 0.7, 0.4, 0.5)), METAL, pid=90)
    # 반대편 짧은 가시
    limb(M, head, head - wb * 3.4 + w * 1.6, 0.7, 0.2, METAL, pid=91)
    tip = pts[-1]; mid = pts[N // 3]
    M.tips['tip'] = tip; M.tips['mid'] = mid; M.tips['head'] = head
    return tip

def gene_gun(M, J, q):
    ha = J['rha']; R = J['R']
    d = nz(R @ np.array([0, 0.02, 1.0]) * 0.6 + nz(J['rha'] - J['rel']) * 0.4)
    ax = frame_from(d, R @ np.array([0, 1.0, 0]))
    up_ = ax[:, 2] if abs(ax[:, 2][1]) > abs(ax[:, 0][1]) else ax[:, 0]
    if up_[1] < 0: up_ = -up_
    side = nz(np.cross(d, up_))
    fr = np.stack([side, d, up_], 1)
    body = ha + d * 2.6 + up_ * 1.3
    M.add(box(body, fr, (0.9, 3.6, 1.3)), GUNB, pid=100)
    M.add(oriented_ellipsoid(body + up_ * 0.6 + d * -0.6, fr, (1.0, 1.6, 1.0)), VIAL, pid=101)
    limb(M, body + d * 3.0, body + d * 6.4, 0.6, 0.5, METAL, pid=102)
    for k in range(3): M.add(capsule(body + d * (3.4 + k * 1.0), body + d * (3.75 + k * 1.0), 0.85, 0.85, caps=False), TRIM, pid=103)
    limb(M, ha, ha + d * 0.8 + up_ * 1.0, 0.7, 0.7, GUNB, pid=104)
    muz = body + d * 7.2
    M.tips['muzzle'] = muz
    if q['flash'] > 0:
        M.add(ellipsoid(muz + d * 0.9, (0.9 + 1.6 * q['flash'])), FLASH, pid=105)
        for k in range(4):
            a = k * math.pi / 2 + 0.6
            dd = nz(d * 1.2 + (side * math.cos(a) + up_ * math.sin(a)) * 0.9)
            limb(M, muz + d * 0.5, muz + dd * (2.2 + 2.4 * q['flash']), 0.45, 0.1, FLASH, pid=106)

def flask(M, pos, R):
    M.add(ellipsoid(pos, (1.55, 1.7, 1.55)), FLASK, pid=110)
    limb(M, pos + np.array([0, 1.2, 0]), pos + np.array([0, 2.9, 0]), 0.55, 0.55, FLASK, pid=111)
    limb(M, pos + np.array([0, 2.9, 0]), pos + np.array([0, 3.6, 0]), 0.7, 0.7, BELT, pid=112)

# ---------------------------------------------------------------- 배치(바닥·공중·회전·쓰러짐)
def placer(q, J):
    soles = min(J['lan'][1], J['ran'][1]) - 2.6
    T = np.array([0, -soles + q['air'], 0])
    Rs = rot_y(q['spin']); Rf = rot_x(-q['fall']); piv = np.array([0, 0, -3.0])
    lift = np.zeros(3)
    if q['fall']:
        # 쓰러질 때 바닥 아래로 꺼지지 않도록: 뼈대 관절로 최저점 추정
        pts = np.array([J[k] for k in ('head', 'chest', 'pel', 'lkn', 'rkn', 'lan', 'ran', 'lha', 'rha')]) + T
        pts = (pts - piv) @ Rf.T + piv
        lo = pts[:, 1].min() - 3.2
        if lo < 0: lift = np.array([0, -lo, 0])
    def tf(p):
        p = p + T
        if q['spin']: p = p @ Rs.T
        if q['fall']: p = (p - piv) @ Rf.T + piv + lift
        return p
    def tn(n):
        if q['spin']: n = n @ Rs.T
        if q['fall']: n = n @ Rf.T
        return n
    return tf, tn

def blade_curve(head, w, wb, N=16):
    return [head + wb * (16.0 * (k / N)) - w * (7.0 * (k / N) ** 2) + w * (1.2 * (1 - k / N)) for k in range(N + 1)]

def weapon_tips(q):
    """잔상용: 모델을 다 만들지 않고 낫 날의 (안쪽, 끝) 위치만 계산"""
    J = skeleton(q); tf, _ = placer(q, J)
    head = J['rha'] + J['w'] * 22.0
    pts = blade_curve(head, J['w'], J['wb'])
    return tf(np.array([pts[3]]))[0], tf(np.array([pts[-1]]))[0]

# ---------------------------------------------------------------- 조립
def build(q):
    M = Model(); J = skeleton(q)
    build_body(M, J, q); coat_skirt(M, J, q); build_head(M, J, q)
    R = J['R']
    if q['stow'] >= 0.5:
        base = J['up']([1.0, 7.0, -4.7]); w = nz(R @ np.array([0.62, 0.78, -0.12])); wb = nz(R @ np.array([-0.75, 0.55, 0.2]))
        wb = nz(wb - w * np.dot(wb, w))
        scythe(M, q, J, base - w * 7.0, w, wb)
    else:
        scythe(M, q, J)
    if q['gun'] > 0: gene_gun(M, J, q)
    if q['flask'] > 0: flask(M, J['lha'] + np.array([0, 1.2, 0]), R)
    if q['flaskp'] is not None: flask(M, J['up'](q['flaskp']), R)
    if q['glow'] > 0:
        g = q['glow']
        for s in 'lr':
            c = J[s + 'ha'] + np.array([0, 1.8, 0])
            M.add(ellipsoid(c, 0.8 + 2.0 * g), ORB, pid=120)
            for k in range(3):
                a = k * 2.09 + g * 5 + (s == 'l') * 1.0
                M.add(ellipsoid(c + np.array([math.cos(a) * (2 + 2 * g), math.sin(a * 1.3) * 1.5, math.sin(a) * (2 + 2 * g)]), 0.45), HELIXA if k % 2 else HELIXB, pid=121 + k)
    tf, tn = placer(q, J)
    M.parts = [(tf(p), tn(n), m, i) for p, n, m, i in M.parts]
    M.decals = [(tf(np.array(p)[None])[0], c, s, b) for p, c, s, b in M.decals]
    M.tips = {k: tf(np.array(v)[None])[0] for k, v in M.tips.items()}
    return M
