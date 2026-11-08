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
    H = J['head']; Rh = J['Rh']; M.head = H.copy()
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


# ---------------- 장비 외형 (등급 · 무기 계열 · 방패) ----------------
def MT(c, em=False):
    from monsters import ramp
    return Mat(ramp(c, em), em, glow=c if em else None)
BONE = Mat(['#6a5a40', '#a8946a', '#d8c8a0', '#f4ecd8'])
NANO = Mat(['#141a26', '#2a3448', '#46587a', '#7a90b8'])
def look(q): return q.get('look') or {}
def metal(t, glow):
    return [BONE, STEEL, NANO][t], (MT(glow, True) if t == 2 else None)
def draw_weapon(M, J, q, side, wd, group, t, glow, key):
    """손(side)에서 wd 방향으로 무기를 그린다 (그룹: blade·blunt·pole·wand)"""
    R = J['R']; ha = J[side + 'ha']; wd = R @ np.array(wd, float); wd /= np.linalg.norm(wd)
    met, em = metal(t, glow); grip = LEATHER if t < 2 else DARK
    fr = frame_from(wd, R @ np.array([0, 0, 1.0]))
    if group == 'blade':
        M.add(capsule(ha - wd * 1.5, ha + wd * 1.1, 0.75), grip)
        M.add(box(ha + wd * 1.6, fr, (2.4, 0.5, 0.6)), GOLD if t == 1 else met)
        M.add(box(ha + wd * 8.4, fr, (0.9, 6.6, 0.35)), met, pid=920 + (side == 'l'))
        if em is not None: M.add(box(ha + wd * 8.4 + fr[:, 0] * 0.9, fr, (0.25, 6.2, 0.4)), em)
        tip = ha + wd * 15
    elif group == 'blunt':
        M.add(capsule(ha - wd * 2.0, ha + wd * 7.5, 0.8), grip if t == 0 else met)
        hd = ha + wd * 9.5
        if t == 0: M.add(ellipsoid(hd, (2.6, 2.6, 2.6)), BONE)
        else: M.add(box(hd, fr, (3.2, 2.2, 2.2)), met, pid=922)
        for k in range(4 if t else 0):
            a = k * 1.57; d = fr[:, 0] * math.cos(a) + fr[:, 2] * math.sin(a); M.add(capsule(hd + d * 2.4, hd + d * 4.0, 0.7, 0.2), em if em is not None else met)
        if em is not None: M.add(ellipsoid(hd, 1.6), em)
        tip = hd + wd * 2.5
    elif group == 'pole':
        M.add(capsule(ha - wd * 9.5, ha + wd * 11.5, 0.8, 0.9), WOOD if t == 0 else met)
        top = ha + wd * 12.5
        M.add(box(top + fr[:, 0] * 1.8, fr @ rot_z(0.5), (0.5, 3.6, 0.4)), BONE if t == 0 else STEEL if t == 1 else NANO)
        M.add(ellipsoid(top, 1.7), em if em is not None else MT(glow, True), pid=990)
        tip = top + wd * 2.0
    else:  # wand
        M.add(capsule(ha - wd * 1.0, ha + wd * 6.0, 0.6, 0.45), WOOD if t == 0 else met)
        M.add(ellipsoid(ha + wd * 7.2, 1.5), MT(glow, True), pid=991)
        tip = ha + wd * 8
    M.tips[key] = tip
def draw_shield(M, J, q, t, emb='#3a8aff'):
    R = J['R']; la = J['lha']
    nrm = R @ np.array([0.55, 0.1, 1.0]); nrm /= np.linalg.norm(nrm)
    up_ = np.array([0, 1.0, 0]) - nrm * nrm[1]; up_ /= np.linalg.norm(up_); rt = np.cross(up_, nrm)
    sc = la + nrm * 1.6 + up_ * 0.5; ax = np.stack([rt, up_, nrm], 1)
    if t == 0:
        M.add(box(sc, ax, (4.0, 4.6, 0.7)), WOOD, pid=910); M.add(ellipsoid(sc + nrm * 0.8, 1.3), STEEL)
    else:
        M.add(box(sc, ax, (4.0, 6.2, 0.6)), WHITE if t == 1 else NANO, pid=910)
        M.add(box(sc + nrm * 0.7, ax, (4.4, 6.6, 0.25)), GOLD if t == 1 else MT('#3ae0ff', True), pid=911)
        for k in range(-4, 5):
            M.decal(sc + nrm * 1.1 + up_ * k * 1.2 + rt * math.sin(k * 0.9) * 1.8, emb, 1, 0.8)
            M.decal(sc + nrm * 1.1 + up_ * k * 1.2 - rt * math.sin(k * 0.9) * 1.8, '#ffd040' if t == 1 else '#e0ffff', 1, 0.8)

def guardian(q, f):
    L = look(q); t = L.get('t', 1); grp = L.get('g', 'blade'); sh = L.get('s', 1)
    M = Model(); J = skeleton(q)
    A = [LEATHER, GOLD, NANO][t]; P = [Mat(['#2a1e14', '#4a3624', '#6a5034', '#8a6a48']), Mat(['#1a1430', '#2e2654', '#463c7a', '#6a5ca8']), DARK][t]
    mats = dict(torso=A if t else Mat(['#3a2a1a', '#6a4a2a', '#9a7444', '#c49a62']), pants=P, boots=A, gloves=A, sleeve=A if t else MT('#8a6a48'), forearm=A, belt=LEATHER, shin=A, abd=P)
    H, Rh = body(M, J, q, mats, dict(bulk=1.12, arm=1.15))
    R = J['R']
    if t:
        for s in 'lr': M.add(ellipsoid(J[s + 'sh'] + R @ np.array([0, 0.6, 0]), (3.3, 2.6, 3.2)), A)
    em = '#4ab0ff' if t < 2 else '#3ae0ff'
    M.decal(J['chest'] + R @ np.array([0, 0.5, 3.6]), em, 1, 1.0); M.decal(J['chest'] + R @ np.array([0, -1.0, 3.5]), em, 1, 1.0)
    if t == 2:
        for k in (-2, 2): M.add(capsule(J['chest'] + R @ np.array([k, 2.5, 3.2]), J['chest'] + R @ np.array([k * 0.6, -3, 3.4]), 0.35), MT('#3ae0ff', True))
    lt = (q['lth'] + q['rth']) / 2
    tb = J['pel'] + R @ np.array([0, -0.5, 3.0]); te = tb + np.array([0, -8.5 * math.cos(lt), 8.5 * math.sin(lt) + 0.6])
    M.add(box((tb + te) / 2, frame_from(te - tb, (0, 0, 1)), (2.4, 4.4, 0.4)), [Mat(['#3a1a10', '#6a2a18', '#9a3a24', '#c45a3a']), BLUE, MT('#1a3a6a')][t])
    if t == 0:
        M.add(ellipsoid(H + Rh @ np.array([0, 1.2, -0.6]), (4.5, 3.8, 4.4)), Mat(['#2a1a10', '#4a3020', '#6a4630', '#8a6040']), pid=901)
    else:
        M.add(ellipsoid(H + Rh @ np.array([0, 0.9, -0.2]), (4.7, 4.3, 4.6)), A, pid=901)
        M.add(box(H + Rh @ np.array([0, -0.6, 4.2]), Rh, (2.9, 0.5, 0.4)), DARK if t == 1 else MT('#3ae0ff', True), pid=902)
        plume = RED if t == 1 else MT('#3ae0ff', True)
        M.add(capsule(H + Rh @ np.array([0, 4.5, 2.0]), H + Rh @ np.array([0, 5.4, -4.5]), 1.0, 1.6), plume, pid=904)
        M.add(capsule(H + Rh @ np.array([0, 5.4, -4.5]), H + Rh @ np.array([0, 2.0, -7.0]), 1.6, 0.8), plume, pid=904)
        for s in (1, -1): M.decal(H + Rh @ np.array([s * 1.4, -0.6, 4.7]), '#8adfff', 1, 1.2)
    if sh: draw_shield(M, J, q, t)
    draw_weapon(M, J, q, 'r', q['w1'], grp, t, '#ffd040', 'w1')
    ground(M, J, q); return M

GREEN = Mat(['#14301a', '#24582a', '#3c8a3a', '#6abe58'])
BRASS = Mat(['#4a3010', '#8a6020', '#c8962e', '#ffe08a'])
VIAL = Mat(['#1e7a1a', '#4ae03a', '#a8ff7a', '#f0ffe0'], True, glow='#7aff5a')
def alchemist(q, f):
    L = look(q); t = L.get('t', 1); grp = L.get('g', 'blade'); sh = L.get('s', 0)
    M = Model(); J = skeleton(q)
    C = [MT('#7a5a3a'), GREEN, Mat(['#6a6a50', '#b0b088', '#e0e0b8', '#ffffe8'])][t]
    mats = dict(torso=C, pants=LEATHER, boots=Mat(['#1a100a', '#3a2414', '#5a3a20', '#7a5430']), gloves=Mat(['#2a1a0e', '#4a3018', '#704a26', '#9a6c3a']) if t < 2 else MT('#e0c040'), sleeve=C, belt=LEATHER)
    H, Rh = body(M, J, q, mats, dict())
    R = J['R']
    if t >= 1:
        for s, sg in (('l', 1), ('r', -1)):
            top = J['pel'] + R @ np.array([sg * 3.6, 1.0, -0.5]); kn = J[s + 'kn'] + np.array([sg * 1.4, -2.5, -1.4])
            M.add(capsule(top, kn, 2.6, 3.0), C)
        bk = J['pel'] + R @ np.array([0, 0.5, -2.6]); M.add(capsule(bk, (J['lkn'] + J['rkn']) / 2 + np.array([0, -3, -2.8]), 3.2, 3.8), C)
    for k, a in enumerate((-1.2, -0.4, 0.4, 1.2)):
        M.add(ellipsoid(J['pel'] + R @ np.array([math.sin(a) * 4.8, 0.6, math.cos(a) * 3.4]), (0.9, 1.4, 0.9)), VIAL, pid=950 + k)
    bp = J['chest'] + R @ np.array([0, 0.5, -4.6]); M.add(box(bp, R, (3.8, 4.4, 1.8)), LEATHER if t < 2 else MT('#5a5a40'), pid=960)
    if t >= 1:
        M.add(capsule(bp + R @ np.array([2.6, 3.5, 0]), bp + R @ np.array([3.6, 7.5, 0.6]), 0.9), BRASS)
        M.add(ellipsoid(bp + R @ np.array([-2.0, 4.6, 0]), (1.4, 2.0, 1.4)), VIAL, pid=961)
    hood = C if t < 2 else Mat(['#6a6a50', '#b0b088', '#e0e0b8', '#ffffe8'])
    M.add(ellipsoid(H + Rh @ np.array([0, 0.8, -0.9]), (4.9, 4.9, 4.7)), hood, pid=901)
    if t >= 1: M.add(capsule(H + Rh @ np.array([0, 3.0, -3.5]), H + Rh @ np.array([0, -1.0, -6.6]), 2.2, 1.0), hood, pid=904)
    if t == 2: M.add(ellipsoid(H + Rh @ np.array([0, 0.6, 3.4]), (3.0, 2.0, 1.2)), MT('#7aff5a', True), pid=903)
    else:
        for s in (1, -1): M.decal(H + Rh @ np.array([s * 1.7, 1.6, 4.0]), '#ffd860', 1, 1.0); M.decal(H + Rh @ np.array([s * 2.4, 1.6, 3.6]), '#8a6020', 1, 1.0)
        M.decal(H + Rh @ np.array([0, -1.8, 4.0]), '#3a5030', 2, 0.9)
    ha = J['rha']
    if q['throw'] < 0:
        fl = ha + np.array([0, 1.6, 0]); M.add(ellipsoid(fl, 1.9), VIAL, pid=970); M.add(capsule(fl, fl + np.array([0, 2.6, 0]), 0.6), Mat(['#3a3a3a', '#7a7a7a', '#c0c0c0', '#ffffff']))
        M.tips['w1'] = fl
    else:
        fwdv = R @ np.array([0, 0, 1.0]); fl = ha + fwdv * (4 + 18 * q['throw']) + np.array([0, 3 * math.sin(q['throw'] * 3.14) + 2, 0])
        if q['throw'] < 0.95: M.add(ellipsoid(fl, 1.9), VIAL, pid=970)
        M.tips['w1'] = fl
    if sh: draw_shield(M, J, q, t, '#7aff5a')
    else: draw_weapon(M, J, q, 'l', (0.2, -0.6, 0.6) if grp != 'pole' else (0.05, 1.0, 0.1), grp, t, '#7aff5a', 'w2')
    if q['glow'] > 0:
        for s in 'lr': M.add(ellipsoid(J[s + 'ha'] + np.array([0, 2.5, 0.6]), 1.0 + 2.2 * q['glow']), VIAL, pid=980)
    ground(M, J, q); return M

NAVY = Mat(['#162444', '#24407a', '#3a64b4', '#6a9ae8'])
BLADE = Mat(['#1a8ab8', '#4ae0ff', '#b0f6ff', '#ffffff'], True, glow='#3ac8ff')
HAIR = Mat(['#0a0a12', '#1c1a2a', '#34304a', '#504a6a'])
def swordsman(q, f):
    L = look(q); t = L.get('t', 1); grp = L.get('g', 'blade'); sh = L.get('s', 0)
    M = Model(); J = skeleton(q)
    C = [MT('#5a5a62'), NAVY, Mat(['#06060c', '#10101c', '#1c1c30', '#2c2c48'])][t]
    scarf = Mat(['#0a3a4a', '#126a80', '#20a0c0', '#5ae0ff']) if t < 2 else MT('#4ae0ff', True)
    mats = dict(torso=C, pants=Mat(['#1a1a2a', '#2c2c44', '#44446a', '#62628e']), boots=Mat(['#140e0a', '#2e2016', '#4a3424', '#6a4c34']), gloves=Mat(['#140e0a', '#2e2016', '#4a3424', '#6a4c34']), sleeve=C, belt=scarf)
    H, Rh = body(M, J, q, mats, dict(eye='#4ae0ff'))
    R = J['R']; cp = q['cape']
    if t >= 1:
        for k, sg in enumerate((1, -1, 0)):
            top = J['pel'] + R @ np.array([sg * 3.0, 1.4, -1.2 if sg == 0 else -0.2])
            end = top + np.array([sg * 1.2, -12.0 + 4 * cp, -2.0 - 7.0 * cp + (0 if sg == 0 else 1.6)])
            M.add(capsule(top, end, 2.6, 3.4 if sg == 0 else 2.6), C)
    if t == 2:
        for s in 'lr': M.add(ellipsoid(J[s + 'sh'] + R @ np.array([0, 0.8, 0]), (3.0, 2.0, 3.0)), NANO)
        for k in range(-2, 3): M.decal(J['chest'] + R @ np.array([k * 1.2, -1 + abs(k) * 0.6, 3.6]), '#4ae0ff', 1, 1.2)
    nk = J['neck'] + R @ np.array([0, -0.4, 0])
    M.add(ellipsoid(nk, (3.0, 1.6, 2.8)), scarf, pid=930)
    M.add(capsule(nk + R @ np.array([1.2, 0, -2.0]), nk + R @ np.array([2.0, -3.0 + 3 * cp, -7.0 - 3 * cp]), 1.1, 0.6), scarf)
    M.add(ellipsoid(H + Rh @ np.array([0, 1.4, -0.8]), (4.5, 3.8, 4.4)), HAIR, pid=901)
    for a, b in ((0.0, 0.0), (1.6, 0.4), (-1.6, 0.4), (0.8, -1.0), (-0.8, -1.0)):
        M.add(capsule(H + Rh @ np.array([a, 3.5, -1 + b]), H + Rh @ np.array([a * 1.5, 6.4, -3.6 + b]), 1.2, 0.3), HAIR, pid=904)
    if grp == 'blade' and t >= 1:   # 신경검: 빛나는 칼날
        for s, w in (('r', 'w1'), ('l', 'w2')):
            if s == 'l' and sh: continue
            ha = J[s + 'ha']; wd = R @ np.array(q[w], float); wd /= np.linalg.norm(wd)
            M.add(capsule(ha - wd * 1.4, ha + wd * 1.0, 0.7), DARK)
            M.add(box(ha + wd * 1.4, frame_from(wd, R @ np.array([0, 0, 1.0])), (1.8, 0.4, 0.5)), STEEL if t == 1 else NANO)
            M.add(box(ha + wd * 8.0, frame_from(wd, R @ np.array([1.0, 0, 0])), (0.35, 6.2, 0.75)), BLADE if t == 1 else MT('#c05aff', True), pid=940 + (s == 'l'))
            M.tips[w] = ha + wd * 14.0
    else:
        draw_weapon(M, J, q, 'r', q['w1'], grp, t, '#4ae0ff', 'w1')
        if not sh: draw_weapon(M, J, q, 'l', q['w2'], grp if grp in ('blade', 'wand') else 'blade', t, '#4ae0ff', 'w2')
    if sh: draw_shield(M, J, q, t, '#4ae0ff')
    if q['glow'] > 0:
        for s in 'lr': M.add(ellipsoid(J[s + 'ha'] + np.array([0, 1.0, 1.0]), 0.8 + 2.4 * q['glow']), BLADE, pid=980)
    ground(M, J, q); return M

ROBE = Mat(['#26120a', '#4e2812', '#86481c', '#c27a34'])
CAP = Mat(['#4a1006', '#8e2410', '#d04a22', '#ff8a52'])
WOOD = Mat(['#22140a', '#42281a', '#6a4426', '#946638'])
GEM = Mat(['#b05a0a', '#ffa02a', '#ffd88a', '#fffbe0'], True, glow='#ff9a2a')
MYC = Mat(['#5a5048', '#9a9084', '#d4ccbe', '#fff8ea'])
def mancer(q, f):
    L = look(q); t = L.get('t', 1); grp = L.get('g', 'pole'); sh = L.get('s', 0)
    M = Model(); J = skeleton(q)
    RB = [MT('#6a5a46'), ROBE, Mat(['#140a1e', '#2a1640', '#46286a', '#6a44a0'])][t]
    CP = [MT('#a07a4a'), CAP, Mat(['#3a0a4a', '#6a1a8a', '#a03ad0', '#e08aff'])][t]
    mats = dict(torso=RB, pants=RB, boots=WOOD, gloves=Mat(['#2a1a0a', '#4e3218', '#7a5228', '#a67a40']), sleeve=RB, belt=MYC)
    H, Rh = body(M, J, q, mats, dict(eye='#ffb040' if t < 2 else '#e08aff'))
    R = J['R']
    lc = (J['lkn'] + J['rkn']) / 2; an = (J['lan'] + J['ran']) / 2
    for a in np.linspace(0, 2 * math.pi, 9)[:-1]:
        top = J['pel'] + R @ np.array([math.sin(a) * 3.8, 1.0, math.cos(a) * 2.8])
        bot = an + np.array([math.sin(a) * 5.4, 0.5, math.cos(a) * 4.2]) + (lc - J['pel']) * np.array([0.3, 0, 0.5])
        M.add(capsule(top, bot, 1.8, 2.4), RB, pid=960)
    for k in range(5 if t else 2):
        a = -1.0 + k * 0.5; p0 = an + np.array([math.sin(a) * 5.8, 0.5, math.cos(a) * 4.6])
        M.add(capsule(p0, p0 + np.array([math.sin(a + 0.5) * 2, -1.5, math.cos(a) * 2]), 0.5, 0.3), MYC if t < 2 else MT('#e08aff', True))
    cap_c = H + Rh @ np.array([0, 3.2, -0.3]); cs = [0.62, 0.8, 0.9][t]
    M.add(ellipsoid(cap_c, (7.4 * cs, 3.0 * cs, 7.0 * cs)), CP, pid=901)
    M.add(ellipsoid(H + Rh @ np.array([0, 2.0, -0.3]), (6.6 * cs, 1.2, 6.2 * cs)), MYC, pid=902)
    for a, r in ((0.3, 4.5), (1.8, 5.2), (3.4, 3.8), (4.6, 5.5), (5.6, 2.5), (2.5, 2.0)):
        M.decal(cap_c + Rh @ np.array([math.cos(a) * r * cs, 2.2 * cs - r * 0.25, math.sin(a) * r * 0.95 * cs]), '#fff4e0' if t < 2 else '#ffb0ff', 1, 1.0)
    draw_weapon(M, J, q, 'r', q['w1'], grp, t, '#ffa02a', 'w1')
    if sh: draw_shield(M, J, q, t, '#ffa02a')
    if q['glow'] > 0:
        M.add(ellipsoid(J['lha'] + np.array([0, 2.0, 0.8]), 0.8 + 2.6 * q['glow']), GEM, pid=980)
        for k in range(5):
            a = k * 1.256 + q['glow'] * 4; M.add(ellipsoid(J['lha'] + np.array([math.cos(a) * 4, 2 + math.sin(a * 2) * 1.5, math.sin(a) * 4]), 0.6), Mat(['#3a8a2a', '#7ad84a', '#c8ff8a', '#ffffff'], True, glow='#7ad84a'), pid=981 + k)
    ground(M, J, q); return M

CHARS = dict(guardian=guardian, alchemist=alchemist, swordsman=swordsman, mancer=mancer)
