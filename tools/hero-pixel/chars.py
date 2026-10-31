import numpy as np, math
from rig import *

SKIN = Mat(['#5a2e22', '#9a5638', '#d48c62', '#f2c09a'])
def lerp(a, b, t): return a + (b - a) * t
def ss(t): t = min(1, max(0, t)); return t * t * (3 - 2 * t)
def keys(t, ks):
    """ks: [(시각, dict)] → 부드럽게 보간된 dict"""
    if t <= ks[0][0]: return dict(ks[0][1])
    for (t0, a), (t1, b) in zip(ks, ks[1:]):
        if t <= t1:
            u = ss((t - t0) / max(1e-6, t1 - t0)); out = {}
            for k in set(a) | set(b):
                va = a.get(k, b.get(k)); vb = b.get(k, a.get(k)); out[k] = lerp(np.array(va, float), np.array(vb, float), u) if isinstance(va, (list, tuple, np.ndarray)) else lerp(va, vb, u)
            return out
    return dict(ks[-1][1])

# ---------------- 기본 자세값 ----------------
BASE = dict(lean=0.0, twist=0.0, tilt=0.0, drop=0.0, fwd=0.0, side=0.0,
            lth=0.05, lkn=0.12, rth=-0.05, rkn=0.12, lab=0.08, rab=0.08,
            la=0.1, lb=0.18, le=0.35, ra=0.1, rb=0.18, re=0.35,
            hp=0.0, hy=0.0, fall=0.0, roll=0.0, glow=0.0, w1=(0.0, 1.0, 0.25), w2=(0.0, 1.0, 0.25), throw=-1.0, cape=0.0)

def arm(S, side, a, b, e, L1=6.0, L2=5.6):
    d = np.array([side * math.sin(b), -math.cos(a) * math.cos(b), math.sin(a) * math.cos(b)]); d /= np.linalg.norm(d)
    E = S + L1 * d
    fw = np.array([0, 0, 1.0]); perp = fw - d * np.dot(fw, d)
    if np.linalg.norm(perp) < 0.2: perp = np.array([0, 1.0, 0]) - d * d[1]
    perp /= np.linalg.norm(perp)
    f = d * math.cos(e) + perp * math.sin(e)
    return E, E + L2 * f, f

def leg(Hp, side, th, kn, ab):
    d = np.array([side * math.sin(ab), -math.cos(th), math.sin(th)]); d /= np.linalg.norm(d)
    K = Hp + 9.6 * d
    s = np.array([side * math.sin(ab) * 0.5, -math.cos(th - kn), math.sin(th - kn)]); s /= np.linalg.norm(s)
    A = K + 9.0 * s
    return K, A

def skeleton(q):
    """관절 위치 계산 (캐릭터 공간: +x 왼쪽, +y 위, +z 앞)"""
    hipY = 21.5 - q['drop']
    pel = np.array([q['side'], hipY, q['fwd']])
    J = {'pel': pel}
    for side, th, kn, ab, nm in ((1, q['lth'], q['lkn'], q['lab'], 'l'), (-1, q['rth'], q['rkn'], q['rab'], 'r')):
        Hp = pel + np.array([side * 3.0, 0, 0]); K, A = leg(Hp, side, th, kn, ab)
        J[nm + 'hip'] = Hp; J[nm + 'kn'] = K; J[nm + 'an'] = A
    # 상체: 골반 기준 회전 (숙임·비틀기·기울임)
    R = rot_y(q['twist']) @ rot_x(q['lean']) @ rot_z(q['tilt'])
    def up(v): return pel + R @ np.array(v, float)
    J['R'] = R; J['abd'] = up([0, 4.0, 0]); J['chest'] = up([0, 9.0, 0.2]); J['neck'] = up([0, 13.4, 0.3])
    Rh = R @ rot_y(q['hy']) @ rot_x(q['hp']); J['Rh'] = Rh
    J['head'] = J['neck'] + Rh @ np.array([0, 4.6, 0.4])
    for side, a, b, e, nm in ((1, q['la'], q['lb'], q['le'], 'l'), (-1, q['ra'], q['rb'], q['re'], 'r')):
        S = up([side * 6.0, 11.6, 0]); E, Hd, f = arm(np.zeros(3), side, a, b, e)
        J[nm + 'sh'] = S; J[nm + 'el'] = S + R @ E; J[nm + 'ha'] = S + R @ Hd; J[nm + 'fa'] = R @ f
    return J

def ground(model, J, q):
    """발이 땅에 닿도록 전체 높이 보정 + 쓰러짐 회전"""
    allp = np.concatenate([p for p, n, m, i in model.parts]); miny = min(J['lan'][1], J['ran'][1]) - 1.6
    dy = -miny if q['fall'] == 0 else -min(miny, allp[:, 1].min())
    newparts = []
    Rf = rot_x(-q['fall']) @ rot_z(q['roll'])
    piv = np.array([0, 0, -2.0])
    for p, n, m, i in model.parts:
        p = p + np.array([0, dy, 0])
        if q['fall'] or q['roll']: p = (p - piv) @ Rf.T + piv; n = n @ Rf.T
        newparts.append((p, n, m, i))
    if q['fall'] or q['roll']:
        allp = np.concatenate([p for p, n, m, i in newparts]); lift = -allp[:, 1].min()
        newparts = [(p + np.array([0, lift, 0]), n, m, i) for p, n, m, i in newparts]
    else: lift = 0
    model.parts = newparts
    dec = []
    for pos, col, size, bias in model.decals:
        pos = pos + np.array([0, dy, 0])
        if q['fall'] or q['roll']: pos = (pos - piv) @ Rf.T + piv + np.array([0, lift, 0])
        dec.append((pos, col, size, bias))
    model.decals = dec
    off = np.array([0, dy, 0])
    def tf(v):
        v = v + off
        if q['fall'] or q['roll']: v = (v - piv) @ Rf.T + piv + np.array([0, lift, 0])
        return v
    model.tf = tf
    for k in list(model.tips): model.tips[k] = tf(model.tips[k])

def body(M, J, q, mats, opt):
    """공통 몸: 다리·몸통·팔·머리"""
    cloth, pants, boots, gloves = mats['torso'], mats['pants'], mats['boots'], mats['gloves']
    for s in 'lr':
        M.add(capsule(J[s + 'hip'], J[s + 'kn'], 2.6, 2.2), pants)
        M.add(capsule(J[s + 'kn'], J[s + 'an'], 2.2, 1.8), mats.get('shin', boots))
        fdir = np.array([0, -0.15, 1.0]); A = J[s + 'an']
        M.add(capsule(A + np.array([0, -0.6, -0.6]), A + fdir * 3.4 + np.array([0, -0.9, 0]), 1.8, 1.4), boots)
    M.add(ellipsoid(J['pel'] + J['R'] @ np.array([0, 0.6, 0]), (4.6, 2.8, 3.0)), mats.get('belt', pants))
    M.add(ellipsoid(J['abd'], (4.0, 3.6, 2.8)), mats.get('abd', cloth))
    M.add(ellipsoid(J['chest'], (5.6 * opt.get('bulk', 1), 4.8, 3.5)), cloth)
    M.add(capsule(J['chest'], J['neck'], 1.6), SKIN)
    for s in 'lr':
        M.add(capsule(J[s + 'sh'], J[s + 'el'], 2.1 * opt.get('arm', 1), 1.8 * opt.get('arm', 1)), mats.get('sleeve', cloth))
        M.add(capsule(J[s + 'el'], J[s + 'ha'] - J[s + 'fa'] * 0.8, 1.8, 1.5), mats.get('forearm', gloves))
        M.add(ellipsoid(J[s + 'ha'], 1.7), gloves)
    H = J['head']; Rh = J['Rh']
    M.add(ellipsoid(H, (4.3, 4.6, 4.2)), SKIN, pid=900)
    # 눈 (얼굴이 보일 때만 그려짐)
    for s in (1, -1):
        M.decal(H + Rh @ np.array([s * 1.6, 0.0, 4.15]), opt.get('eye', '#1a1020'), 1, 2.2)
    return H, Rh

# ---------------- 직업별 장비 ----------------
GOLD = Mat(['#5a3810', '#9c6a1c', '#dcaa3a', '#fff0a0'])
STEEL = Mat(['#2e3444', '#6a7488', '#b4bccc', '#f4f8ff'])
WHITE = Mat(['#6a6478', '#a8a2b4', '#dcd8e4', '#ffffff'])
BLUE = Mat(['#121e48', '#22388a', '#3a62c8', '#6aa0ff'])
RED = Mat(['#4a0a10', '#8a1a20', '#c8322e', '#ff6a50'])
LEATHER = Mat(['#24140a', '#4a2c16', '#7a4c26', '#a87a44'])
DARK = Mat(['#0e0c12', '#1e1a26', '#302a3c', '#4a4258'])

def guardian(q, f):
    M = Model(); J = skeleton(q)
    mats = dict(torso=GOLD, pants=Mat(['#1a1430', '#2e2654', '#463c7a', '#6a5ca8']), boots=GOLD, gloves=GOLD, sleeve=GOLD, forearm=GOLD, belt=LEATHER, shin=GOLD, abd=Mat(['#1a1430', '#2e2654', '#463c7a', '#6a5ca8']))
    H, Rh = body(M, J, q, mats, dict(bulk=1.12, arm=1.15))
    R = J['R']
    # 어깨 갑옷 · 가슴 문양
    for s in 'lr': M.add(ellipsoid(J[s + 'sh'] + R @ np.array([0, 0.6, 0]), (3.3, 2.6, 3.2)), GOLD)
    M.decal(J['chest'] + R @ np.array([0, 0.5, 3.6]), '#4ab0ff', 1, 1.0)
    M.decal(J['chest'] + R @ np.array([0, -1.0, 3.5]), '#4ab0ff', 1, 1.0)
    # 앞 휘장 (다리 사이)
    lt = (q['lth'] + q['rth']) / 2
    tb = J['pel'] + R @ np.array([0, -0.5, 3.0]); te = tb + np.array([0, -8.5 * math.cos(lt), 8.5 * math.sin(lt) + 0.6])
    M.add(box((tb + te) / 2, frame_from(te - tb, (0, 0, 1)), (2.4, 4.4, 0.4)), BLUE)
    # 투구 + 깃털
    M.add(ellipsoid(H + Rh @ np.array([0, 0.9, -0.2]), (4.7, 4.3, 4.6)), GOLD, pid=901)
    M.add(box(H + Rh @ np.array([0, -0.6, 4.2]), Rh, (2.9, 0.5, 0.4)), DARK, pid=902)
    M.add(capsule(H + Rh @ np.array([0, 4.5, 2.0]), H + Rh @ np.array([0, 5.4, -4.5]), 1.0, 1.6), RED)
    M.add(capsule(H + Rh @ np.array([0, 5.4, -4.5]), H + Rh @ np.array([0, 2.0, -7.0]), 1.6, 0.8), RED)
    for s in (1, -1): M.decal(H + Rh @ np.array([s * 1.4, -0.6, 4.7]), '#8adfff', 1, 1.2)
    # 방패 (왼팔)
    la = J['lha']; fa = J['lfa']
    nrm = R @ np.array([0.55, 0.1, 1.0]); nrm /= np.linalg.norm(nrm)
    up_ = np.array([0, 1.0, 0]) - nrm * nrm[1]; up_ /= np.linalg.norm(up_); rt = np.cross(up_, nrm)
    sc = la + nrm * 1.6 + up_ * 0.5
    M.add(box(sc, np.stack([rt, up_, nrm], 1), (4.0, 6.2, 0.6)), WHITE, pid=910)
    M.add(box(sc + nrm * 0.7, np.stack([rt, up_, nrm], 1), (4.4, 6.6, 0.25)), GOLD, pid=911)
    for k in range(-4, 5):
        M.decal(sc + nrm * 1.1 + up_ * k * 1.2 + rt * math.sin(k * 0.9) * 1.8, '#3a8aff', 1, 0.8)
        M.decal(sc + nrm * 1.1 + up_ * k * 1.2 - rt * math.sin(k * 0.9) * 1.8, '#ffd040', 1, 0.8)
    # 검 (오른손)
    ha = J['rha']; wd = np.array(q['w1'], float); wd = R @ wd; wd /= np.linalg.norm(wd)
    tip = ha + wd * 15.0
    M.add(capsule(ha - wd * 1.6, ha + wd * 1.2, 0.8), LEATHER)
    M.add(box(ha + wd * 1.6, frame_from(wd, R @ np.array([0, 0, 1.0])), (2.6, 0.5, 0.6)), GOLD)
    M.add(box(ha + wd * 8.6, frame_from(wd, R @ np.array([0, 0, 1.0])), (0.9, 6.8, 0.35)), STEEL, pid=920)
    M.tips['w1'] = tip
    ground(M, J, q); return M

GREEN = Mat(['#14301a', '#24582a', '#3c8a3a', '#6abe58'])
BRASS = Mat(['#4a3010', '#8a6020', '#c8962e', '#ffe08a'])
VIAL = Mat(['#1e7a1a', '#4ae03a', '#a8ff7a', '#f0ffe0'], True, glow='#7aff5a')
def alchemist(q, f):
    M = Model(); J = skeleton(q)
    mats = dict(torso=GREEN, pants=LEATHER, boots=Mat(['#1a100a', '#3a2414', '#5a3a20', '#7a5430']), gloves=Mat(['#2a1a0e', '#4a3018', '#704a26', '#9a6c3a']), sleeve=GREEN, belt=LEATHER)
    H, Rh = body(M, J, q, mats, dict())
    R = J['R']
    # 긴 외투 자락 (다리를 따라 흔들림)
    for s, sg in (('l', 1), ('r', -1)):
        top = J['pel'] + R @ np.array([sg * 3.6, 1.0, -0.5]); kn = J[s + 'kn'] + np.array([sg * 1.4, -2.5, -1.4])
        M.add(capsule(top, kn, 2.6, 3.0), GREEN)
    bk = J['pel'] + R @ np.array([0, 0.5, -2.6]); M.add(capsule(bk, (J['lkn'] + J['rkn']) / 2 + np.array([0, -3, -2.8]), 3.2, 3.8), GREEN)
    # 허리띠 약병
    for k, a in enumerate((-1.2, -0.4, 0.4, 1.2)):
        M.add(ellipsoid(J['pel'] + R @ np.array([math.sin(a) * 4.8, 0.6, math.cos(a) * 3.4]), (0.9, 1.4, 0.9)), VIAL, pid=950 + k)
    # 배낭 + 관
    bp = J['chest'] + R @ np.array([0, 0.5, -4.6]); M.add(box(bp, R, (3.8, 4.4, 1.8)), LEATHER, pid=960)
    M.add(capsule(bp + R @ np.array([2.6, 3.5, 0]), bp + R @ np.array([3.6, 7.5, 0.6]), 0.9), BRASS)
    M.add(ellipsoid(bp + R @ np.array([-2.0, 4.6, 0]), (1.4, 2.0, 1.4)), VIAL, pid=961)
    # 두건 + 고글
    M.add(ellipsoid(H + Rh @ np.array([0, 0.8, -0.9]), (4.9, 4.9, 4.7)), GREEN, pid=901)
    M.add(capsule(H + Rh @ np.array([0, 3.0, -3.5]), H + Rh @ np.array([0, -1.0, -6.6]), 2.2, 1.0), GREEN)
    for s in (1, -1):
        M.decal(H + Rh @ np.array([s * 1.7, 1.6, 4.0]), '#ffd860', 1, 1.0)
        M.decal(H + Rh @ np.array([s * 2.4, 1.6, 3.6]), '#8a6020', 1, 1.0)
    M.decal(H + Rh @ np.array([0, -1.8, 4.0]), '#3a5030', 2, 0.9)  # 마스크
    # 오른손 플라스크 (던지기: throw ≥0이면 손을 떠남)
    ha = J['rha']
    if q['throw'] < 0:
        fl = ha + np.array([0, 1.6, 0]); M.add(ellipsoid(fl, 1.9), VIAL, pid=970); M.add(capsule(fl, fl + np.array([0, 2.6, 0]), 0.6), Mat(['#3a3a3a', '#7a7a7a', '#c0c0c0', '#ffffff']))
        M.tips['w1'] = fl
    else:
        fwdv = R @ np.array([0, 0, 1.0]); fl = ha + fwdv * (4 + 18 * q['throw']) + np.array([0, 3 * math.sin(q['throw'] * 3.14) + 2, 0])
        if q['throw'] < 0.95: M.add(ellipsoid(fl, 1.9), VIAL, pid=970)
        M.tips['w1'] = fl
    # 왼손 작은 약병
    M.add(ellipsoid(J['lha'] + np.array([0, 1.2, 0]), (1.1, 1.5, 1.1)), Mat(['#5a1a7a', '#9a3ad0', '#d07aff', '#ffe0ff'], True, glow='#c060ff'), pid=971)
    if q['glow'] > 0:
        for s in 'lr': M.add(ellipsoid(J[s + 'ha'] + np.array([0, 2.5, 0.6]), 1.0 + 2.2 * q['glow']), VIAL, pid=980)
    ground(M, J, q); return M

NAVY = Mat(['#0a0e1a', '#18223a', '#2a3c62', '#44628e'])
BLADE = Mat(['#1a8ab8', '#4ae0ff', '#b0f6ff', '#ffffff'], True, glow='#3ac8ff')
HAIR = Mat(['#0a0a12', '#1c1a2a', '#34304a', '#504a6a'])
def swordsman(q, f):
    M = Model(); J = skeleton(q)
    mats = dict(torso=NAVY, pants=DARK, boots=Mat(['#0a0a10', '#1a1a24', '#2c2c3a', '#46465a']), gloves=DARK, sleeve=NAVY, belt=Mat(['#0a3a4a', '#126a80', '#20a0c0', '#5ae0ff']))
    H, Rh = body(M, J, q, mats, dict(eye='#4ae0ff'))
    R = J['R']
    # 롱코트 뒷자락: 움직임 반대로 휘날림
    cp = q['cape']
    for k, sg in enumerate((1, -1, 0)):
        top = J['pel'] + R @ np.array([sg * 3.0, 1.4, -1.2 if sg == 0 else -0.2])
        end = top + np.array([sg * 1.2, -12.0 + 4 * cp, -2.0 - 7.0 * cp + (0 if sg == 0 else 1.6)])
        M.add(capsule(top, end, 2.6, 3.4 if sg == 0 else 2.6), NAVY)
    # 목도리 (시안)
    nk = J['neck'] + R @ np.array([0, -0.4, 0])
    M.add(ellipsoid(nk, (3.0, 1.6, 2.8)), mats['belt'], pid=930)
    M.add(capsule(nk + R @ np.array([1.2, 0, -2.0]), nk + R @ np.array([2.0, -3.0 + 3 * cp, -7.0 - 3 * cp]), 1.1, 0.6), mats['belt'])
    # 머리카락
    M.add(ellipsoid(H + Rh @ np.array([0, 1.4, -0.8]), (4.5, 3.8, 4.4)), HAIR, pid=901)
    for a, b in ((0.0, 0.0), (1.6, 0.4), (-1.6, 0.4), (0.8, -1.0), (-0.8, -1.0)):
        M.add(capsule(H + Rh @ np.array([a, 3.5, -1 + b]), H + Rh @ np.array([a * 1.5, 6.4, -3.6 + b]), 1.2, 0.3), HAIR)
    # 쌍검
    for s, w in (('r', 'w1'), ('l', 'w2')):
        ha = J[s + 'ha']; wd = R @ np.array(q[w], float); wd /= np.linalg.norm(wd)
        M.add(capsule(ha - wd * 1.4, ha + wd * 1.0, 0.7), DARK)
        M.add(box(ha + wd * 1.4, frame_from(wd, R @ np.array([0, 0, 1.0])), (1.8, 0.4, 0.5)), STEEL)
        M.add(box(ha + wd * 8.0, frame_from(wd, R @ np.array([1.0, 0, 0])), (0.35, 6.2, 0.75)), BLADE, pid=940 + (s == 'l'))
        M.tips[w] = ha + wd * 14.0
    if q['glow'] > 0:
        for s in 'lr': M.add(ellipsoid(J[s + 'ha'] + np.array([0, 1.0, 1.0]), 0.8 + 2.4 * q['glow']), BLADE, pid=980)
    ground(M, J, q); return M

ROBE = Mat(['#26120a', '#4e2812', '#86481c', '#c27a34'])
CAP = Mat(['#4a1006', '#8e2410', '#d04a22', '#ff8a52'])
WOOD = Mat(['#22140a', '#42281a', '#6a4426', '#946638'])
GEM = Mat(['#b05a0a', '#ffa02a', '#ffd88a', '#fffbe0'], True, glow='#ff9a2a')
MYC = Mat(['#5a5048', '#9a9084', '#d4ccbe', '#fff8ea'])
def mancer(q, f):
    M = Model(); J = skeleton(q)
    mats = dict(torso=ROBE, pants=ROBE, boots=WOOD, gloves=Mat(['#2a1a0a', '#4e3218', '#7a5228', '#a67a40']), sleeve=ROBE, belt=MYC)
    H, Rh = body(M, J, q, mats, dict(eye='#ffb040'))
    R = J['R']
    # 발목까지 내려오는 로브 (다리를 감싸는 원뿔)
    lc = (J['lkn'] + J['rkn']) / 2; an = (J['lan'] + J['ran']) / 2
    for a in np.linspace(0, 2 * math.pi, 9)[:-1]:
        top = J['pel'] + R @ np.array([math.sin(a) * 3.8, 1.0, math.cos(a) * 2.8])
        bot = an + np.array([math.sin(a) * 5.4, 0.5, math.cos(a) * 4.2]) + (lc - J['pel']) * np.array([0.3, 0, 0.5])
        M.add(capsule(top, bot, 1.8, 2.4), ROBE, pid=960)
    # 균사 띠
    for k in range(5):
        a = -1.0 + k * 0.5; p0 = an + np.array([math.sin(a) * 5.8, 0.5, math.cos(a) * 4.6])
        M.add(capsule(p0, p0 + np.array([math.sin(a + 0.5) * 2, -1.5, math.cos(a) * 2]), 0.5, 0.3), MYC)
    # 버섯 갓 모자 + 점
    cap_c = H + Rh @ np.array([0, 3.2, -0.3])
    M.add(ellipsoid(cap_c, (7.4, 3.0, 7.0)), CAP, pid=901)
    M.add(ellipsoid(H + Rh @ np.array([0, 2.0, -0.3]), (6.6, 1.2, 6.2)), MYC, pid=902)
    for a, r in ((0.3, 4.5), (1.8, 5.2), (3.4, 3.8), (4.6, 5.5), (5.6, 2.5), (2.5, 2.0)):
        M.decal(cap_c + Rh @ np.array([math.cos(a) * r, 2.2 - r * 0.25, math.sin(a) * r * 0.95]), '#fff4e0', 1, 1.0)
    # 지팡이 (오른손) + 보석 + 작은 버섯
    ha = J['rha']; wd = R @ np.array(q['w1'], float); wd /= np.linalg.norm(wd)
    b0 = ha - wd * 9.5; t0 = ha + wd * 11.5
    M.add(capsule(b0, t0, 0.8, 1.0), WOOD)
    M.add(ellipsoid(t0 + wd * 1.8, 2.0), GEM, pid=990)
    M.add(capsule(t0 - wd * 1.0 + R @ np.array([1.5, 0, 0]), t0 + wd * 2.0 + R @ np.array([2.6, 0, 0]), 0.5, 0.4), MYC)
    M.add(ellipsoid(t0 + wd * 2.4 + R @ np.array([2.8, 0, 0]), (1.6, 0.8, 1.6)), CAP)
    M.tips['w1'] = t0 + wd * 2.5
    if q['glow'] > 0:
        M.add(ellipsoid(J['lha'] + np.array([0, 2.0, 0.8]), 0.8 + 2.6 * q['glow']), GEM, pid=980)
        for k in range(5):
            a = k * 1.256 + q['glow'] * 4; M.add(ellipsoid(J['lha'] + np.array([math.cos(a) * 4, 2 + math.sin(a * 2) * 1.5, math.sin(a) * 4]), 0.6), Mat(['#3a8a2a', '#7ad84a', '#c8ff8a', '#ffffff'], True, glow='#7ad84a'), pid=981 + k)
    ground(M, J, q); return M

CHARS = dict(guardian=guardian, alchemist=alchemist, swordsman=swordsman, mancer=mancer)
