# 호중구(NEUTROPHIL) 의인화 주인공 — 2D 측면 리그
# 백혈구 = 하얀 전투 코트, 여러 갈래로 나뉜 핵 = 3마디 포니테일, 과립 = 분홍 과립탄 띠·과립 산탄총
import math, numpy as np
from raster import Canvas, Mat, rot, hexc

M = dict(
    skin=Mat(['#8a3a40', '#eaa08a', '#ffd3ba', '#fff1e4']),
    hair=Mat(['#2a0828', '#661656', '#a42c86', '#d652ac', '#ff96d0']),
    coat=Mat(['#55466c', '#9c8cb8', '#ddd4ee', '#fbf8ff'], bias=0.04),
    trim=Mat(['#6a1e58', '#b54894', '#e692cc', '#ffd0ee']),
    pants=Mat(['#180c22', '#2c1a3a', '#45305a', '#634a7c']),
    boot=Mat(['#24081a', '#4e1634', '#80284e', '#b44c72']),
    glove=Mat(['#1e0c22', '#3a1a40', '#5e3264', '#86528a']),
    band=Mat(['#4e0816', '#a8162c', '#e23446', '#ff8088']),
    belt=Mat(['#1a0e10', '#3a2224', '#5c3a34', '#86604c']),
    gun=Mat(['#240e22', '#4e2246', '#7c3a6e', '#b45a9a']),
    gunlt=Mat(['#5a1a4a', '#a8387e', '#e070b0', '#ffc0e4']),
    metal=Mat(['#22202e', '#4c4a62', '#8a88a4', '#d8d6ea']),
    glass=Mat(['#1e3a5a', '#3a76a0', '#76c0e6', '#d0f2ff'], bias=0.05),
    fx=Mat(['#ff70c0', '#ffb0e0', '#ffe8f6', '#ffffff'], bias=0.3),
    gren=Mat(['#3a5a10', '#6aa020', '#a8e050', '#eaffb0']),
)
for k in list(M): M[k + '_b'] = M[k].back()

K = 1.2   # 리그 단위 → 픽셀 배율
HIP = 9.0; THIGH = 4.3; SHIN = 4.0; ANK = 1.5; TORSO = 6.0
UA, FA = 3.0, 2.8


def ang_dir(a):  # 아래 방향 기준 각도 (+ = 앞으로)
    return np.array([math.sin(a), math.cos(a)])


def ik(h, f, l1=THIGH, l2=SHIN, fwd=1):
    h = np.asarray(h, float); f = np.asarray(f, float); v = f - h; d = np.linalg.norm(v)
    d = min(d, l1 + l2 - 0.05); d = max(d, abs(l1 - l2) + 0.1)
    if np.linalg.norm(v) > 1e-6: v = v / np.linalg.norm(v)
    a = math.atan2(v[1], v[0]); b = math.acos(np.clip((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1))
    k = h + l1 * np.array([math.cos(a - b * fwd), math.sin(a - b * fwd)])
    an = h + v * d
    return k, an


DEF = dict(x=0, y=0, tilt=0.05, head=0.0, fF=(2.2, -ANK), fB=(-2.0, -ANK), aF=0.0, aB=0.0,
           armB=(0.15, 0.55), armF=None, gunF=None, claw=False, item=None, squash=1.0, spin=0.0,
           sling=False, smear=None, hipH=HIP, fist=False, oy=0.0, ox=0.0)


def skeleton(pose):
    p = dict(DEF); p.update(pose)
    O = np.array([p['ox'], p['oy']])
    p['fF'] = tuple(np.asarray(p['fF'], float) + O); p['fB'] = tuple(np.asarray(p['fB'], float) + O)
    hip = np.array([p['x'], -p['hipH'] + p['y']]) + O
    t = p['tilt']; up = np.array([math.sin(t), -math.cos(t)]); fw = np.array([math.cos(t), math.sin(t)])
    sq = p['squash']
    neck = hip + up * TORSO * sq
    ha = t + p['head']
    head = neck + rot(np.array([0.35, -5.3 * (0.5 + 0.5 * sq)]), ha)
    kF, anF = ik(hip + fw * 0.5, p['fF']); kB, anB = ik(hip - fw * 0.4, p['fB'])
    shB = neck - up * 1.7 - fw * 0.7; shF = neck - up * 1.8 + fw * 0.8
    a, e = p['armB']; elB = shB + ang_dir(a + t * 0.5) * UA; hB = elB + ang_dir(a + e + t * 0.5) * FA
    sk = dict(p=p, hip=hip, up=up, fw=fw, neck=neck, head=head, ha=ha, kF=kF, anF=anF, kB=kB, anB=anB,
              shB=shB, elB=elB, hB=hB, shF=shF)
    if p['armF'] is not None:
        a, e = p['armF']; sk['elF'] = shF + ang_dir(a + t * 0.5) * UA; sk['hF'] = sk['elF'] + ang_dir(a + e + t * 0.5) * FA
    sk['center'] = hip + up * 3
    return sk


def hl(sk, v):  # 머리 로컬 → 세계
    return sk['head'] + rot(np.asarray(v, float), sk['ha'])


# ---- 2차 움직임(머리카락·띠·코트 자락) 체인 ----
def chain_anchor(sk, which):
    if which == 'pony': return hl(sk, (-4.9, -2.2))
    if which == 'tail': return hl(sk, (-5.6, -3.3))
    if which == 'coat': return sk['hip'] - sk['fw'] * 2.6 + sk['up'] * 0.6
    if which == 'coat2': return sk['hip'] - sk['fw'] * 1.0 + sk['up'] * 0.4


CH = dict(  # 마디 수, 마디 길이, 쉬는 방향(아래 기준 각, -는 뒤), 강성, 감쇠, 중력
    pony=(3, 2.6, -0.9, 0.16, 0.86, 0.05),
    tail=(5, 1.45, -1.25, 0.08, 0.9, 0.035),
    coat=(2, 2.4, -0.35, 0.22, 0.82, 0.05),
    coat2=(2, 2.2, -0.15, 0.25, 0.82, 0.05),
)


def simulate(frames_sk, ticks, which, loop=True, wind=(0, 0), warm=3, rest_rot=0.0):
    n, L, ra, k, damp, g = CH[which]
    anchors = [chain_anchor(sk, which) for sk in frames_sk]
    rots = [sk['p']['tilt'] * 0.6 for sk in frames_sk]
    F = len(anchors)
    pos = [anchors[0] + ang_dir(ra) * L * (i + 1) for i in range(n)]; prev = [q.copy() for q in pos]
    out = [None] * F
    tw = wind if callable(wind) else (lambda fi: wind)
    for rep in range(warm + 1 if loop else 1):
        if not loop:
            for _ in range(40): _step(pos, prev, anchors[0], L, ra + rots[0] + rest_rot, k, damp, g, tw(0))
        for fi in range(F):
            a0 = anchors[fi]; a1 = anchors[(fi + 1) % F] if loop or fi + 1 < F else anchors[fi]
            T = ticks[fi] if isinstance(ticks, (list, tuple)) else ticks
            if rep == warm or not loop: out[fi] = [q.copy() for q in pos]
            for tt in range(T):
                an = a0 + (a1 - a0) * (tt / T)
                _step(pos, prev, an, L, ra + rots[fi] + rest_rot, k, damp, g, tw(fi))
    return out, anchors


def _step(pos, prev, an, L, ra, k, damp, g, wind):
    base = an
    for i in range(len(pos)):
        p = pos[i]; v = (p - prev[i]) * damp; prev[i] = p.copy()
        rest = base + ang_dir(ra - 0.12 * i) * L
        p = p + v + np.array([wind[0], g + wind[1]]) + (rest - p) * k
        d = p - base; dl = np.linalg.norm(d) + 1e-9; p = base + d / dl * L
        pos[i] = p; base = p


# ---------------- 그리기 ----------------
GRAN = '#c892e8'


def draw_gun_parts(cv, T, flat=False, group='gun', over=('armB', 'torso', 'coat', 'hair', 'pony0', 'pony1', 'pony2'), recoil=0):
    """T: 로컬→세계 변환 함수. 총구 방향 +x"""
    cap = lambda a, b, r1, r2, m, **kw: cv.capsule(T(a), T(b), r1, r2, mat=M[m], group=group, over=over, **kw)
    cap((2.4, 1.6), (-0.9, 2.9), 1.05, 0.95, 'gun')                     # 개머리
    cap((3.0, 0.9), (10.0, 0.9), 1.55, 1.45, 'gun')                     # 몸통
    cv.poly([T(q) for q in ((9.6, -0.6), (12.0, -1.4), (12.9, -1.2), (12.9, 3.0), (12.0, 3.2), (9.6, 2.4))],
            mat=M['gunlt'], group=group, over=over, dome=(T((11, 0.9)), 3.4))  # 나팔 총구
    cap((6.6, 2.75), (8.9, 2.75), 0.85, 0.85, 'gunlt')                  # 펌프
    cv.ellipse(T((6.0, -1.25)), 2.25, 1.25, mat=M['glass'], group=group, over=over)  # 과립 통
    for q, c in (((5.2, -1.6), '#ff8ad0'), ((6.4, -1.0), '#ffd0ee'), ((6.9, -1.7), '#ff6ab8'), ((5.0, -0.6), '#ffffff')):
        x, y = T(q); cv.decal(x, y, c, on=group)
    for yy in (-0.5, 0.9, 2.3):
        x, y = T((12.8, yy)); cv.decal(x, y, '#3a0a2a', on=group)
    x, y = T((4.0, 0.2)); cv.decal(x, y, '#ffb0dc', on=group)


def draw_arm(cv, sh, el, hand, mats=('coat', 'trim', 'glove'), group='armF', over='all', claw=False, fist=False, item=None):
    c, t, gl = (M[m] for m in mats)
    cv.capsule(sh, el, 1.45, 1.3, mat=c, group=group, over=over)
    cv.capsule(el, hand + (el - hand) * 0.15, 1.3, 1.2, mat=c, group=group, over=over)
    cuff = hand + (el - hand) / (np.linalg.norm(el - hand) + 1e-9) * 1.2
    cv.ellipse(cuff, 1.35, 1.35, mat=t, group=group, over=over)
    cv.ellipse(hand, 1.5 if fist else 1.4, 1.4, mat=gl, group=group, over=over)
    if claw:
        d = (hand - el) / (np.linalg.norm(hand - el) + 1e-9); n = np.array([-d[1], d[0]])
        for o in (-1.2, 0, 1.2):
            a = hand + d * 1.0 + n * o
            cv.capsule(a, a + d * 2.6 + n * o * 0.4, 0.55, 0.25, mat=M['metal'], group=group + 'c', over=over)
    if item == 'gren':
        cv.ellipse(hand + np.array([0.3, -1.4]), 1.5, 1.3, mat=M['gren'], group='item', over='all')
    if item == 'net':
        cv.ellipse(hand + np.array([0.3, -1.6]), 1.9, 1.6, mat=M['glass'], group='item', over='all')


def draw_body(cv, sk, chains, front_arm=True):
    p = sk['p']; up, fw = sk['up'], sk['fw']; ha = sk['ha']
    H = lambda v: hl(sk, v)
    # 머리띠 꼬리 (가장 뒤)
    for ci, ch in enumerate(chains.get('tail', [])):
        pts = [chains['tail_a'][ci]] + ch
        for i in range(len(pts) - 1):
            r = 0.95 - i * 0.1
            cv.capsule(pts[i], pts[i + 1], r, r - 0.1, mat=M['band_b'] if ci else M['band'], group='tail')
    # 포니테일: 3마디 핵
    if 'pony' in chains:
        pts = [chains['pony_a']] + chains['pony']
        for i in range(3):
            cv.capsule(pts[i], pts[i + 1], 1.0, 0.8, mat=M['hair_b'], group='ponyc')
        for i, r in reversed(list(enumerate((2.75, 2.45, 2.05)))):
            q = pts[i + 1] if i else (pts[0] * 0.25 + pts[1] * 0.75)
            cv.ellipse(q, r, r * 0.92, mat=M['hair'], group='pony%d' % i, over=('pony%d' % (i + 1), 'ponyc', 'tail'))
    # 뒷팔
    draw_arm(cv, sk['shB'], sk['elB'], sk['hB'], mats=('coat_b', 'trim_b', 'glove_b'), group='armB', over=('tail', 'pony0', 'pony1', 'pony2'),
             fist=p['fist'])
    # 등에 멘 총
    if p['sling']:
        o = sk['neck'] - up * 2.5 - fw * 2.6; a = math.atan2(up[1], up[0]) + 0.75 + math.pi
        T = lambda v: o + rot(np.asarray(v, float) * 0.85 - np.array([6.5, 0]), a)
        draw_gun_parts(cv, T, group='gunb', over=('armB', 'tail', 'pony0', 'pony1', 'pony2'))
    # 코트 자락 (뒤)
    for nm in ('coat', 'coat2'):
        if nm in chains:
            a0 = chains[nm + '_a']; c1, c2 = chains[nm]
            side = fw * (0.0 if nm == 'coat' else 0.0)
            cv.poly([a0 + up * 1.2 + fw * 1.8, a0 - fw * 0.6, c1 - fw * 0.9, c2 - fw * 0.6, c2 + fw * 1.4, c1 + fw * 1.8, a0 + fw * 3.0],
                    mat=M['coat_b'] if nm == 'coat' else M['coat'], group=nm, over=('armB', 'tail', 'gunb', 'coat'), dome=(c1, 4))
            cv.line_decal(c2 - fw * 0.5, c2 + fw * 1.3, M['trim'].ramp[1], on=nm)
    # 뒷다리
    def leg(k, an, aF, mb, grp, over):
        hipj = sk['hip'] + (fw * 0.5 if grp == 'legF' else -fw * 0.4)
        cv.capsule(hipj, k, 1.85, 1.55, mat=M['pants' + mb], group=grp, over=over)
        cv.capsule(k, an, 1.5, 1.35, mat=M['pants' + mb], group=grp, over=over)
        bt = k + (an - k) * 0.42
        cv.capsule(bt, an, 1.65, 1.6, mat=M['boot' + mb], group=grp, over=over)
        fd = rot(np.array([1.0, 0.0]), aF); fn = np.array([-fd[1], fd[0]])
        toe = an + fd * 1.35 + fn * 0.55
        cv.ellipse(toe, 2.35, 1.3, a=aF, mat=M['boot' + mb], group=grp, over=over)
        cv.line_decal(toe - fd * 1.8 + fn * 1.0, toe + fd * 1.9 + fn * 0.9, '#120610', on=grp)
        x, y = toe + fd * 1.3 - fn * 0.3; cv.decal(x, y, M['trim' + mb].ramp[2], on=grp)
        x, y = bt + (an - bt) * 0.1 - fw * 0.0; cv.line_decal(bt - fw * 1.4, bt + fw * 1.4, M['trim' + mb].ramp[1], on=grp)
    leg(sk['kB'], sk['anB'], p['aB'], '_b', 'legB', ('tail', 'coat', 'pony0', 'pony1', 'pony2', 'armB', 'gunb'))
    # 골반·반바지
    cv.ellipse(sk['hip'] + up * 0.4, 3.4, 2.3, a=p['tilt'], mat=M['pants'], group='pelvis', over=('legB', 'coat', 'armB', 'tail'))
    leg(sk['kF'], sk['anF'], p['aF'], '', 'legF', ('legB', 'coat', 'coat2', 'armB', 'tail', 'gunb'))
    # 몸통(코트)
    tov = ('armB', 'legB', 'legF', 'pelvis', 'tail', 'pony0', 'pony1', 'pony2', 'gunb', 'coat')
    cv.capsule(sk['hip'] + up * 1.0 - fw * 0.2, sk['neck'] - up * 1.5, 3.25, 3.55, mat=M['coat'], group='torso', over=tov)
    cv.poly([sk['hip'] + up * 1.4 - fw * 3.2, sk['hip'] + up * 1.4 + fw * 3.4, sk['hip'] - up * 0.9 + fw * 3.0, sk['hip'] - up * 0.8 - fw * 3.4],
            mat=M['coat'], group='torso', over=tov, dome=(sk['hip'] + up * 2.5, 5))
    # 벨트
    w0 = sk['hip'] + up * 1.25
    cv.capsule(w0 - fw * 3.3, w0 + fw * 3.4, 0.75, 0.75, mat=M['belt'], group='belt', over=('torso',))
    x, y = w0 + fw * 2.5; cv.decal(x, y, '#ffd060', on='belt'); x, y = w0 + fw * 2.5 - up * 0.6; cv.decal(x, y, '#a07020', on='belt')
    # 주머니(수류탄 파우치)
    cv.ellipse(w0 - fw * 2.2 - up * 1.0, 1.25, 1.05, mat=M['belt'], group='pouch', over=('torso', 'belt', 'pelvis', 'legF', 'legB'))
    # 과립탄 띠(어깨→허리)
    a = sk['neck'] - up * 1.0 + fw * 1.6; b = sk['hip'] + up * 1.6 - fw * 2.6
    cv.line_decal(a, b, M['trim'].ramp[1], on='torso')
    for i in range(1, 4):
        q = a + (b - a) * (i / 4.0); x, y = q + fw * 0.0
        cv.decal(x, y, '#ffd0ee', on='torso')
    # 지퍼·과립 무늬
    cv.line_decal(sk['neck'] - up * 1.2 + fw * 3.2, sk['hip'] + up * 1.7 + fw * 3.0, M['coat'].ramp[1], on='torso')
    for (u, v) in ((-1.4, 3.6), (0.6, 2.2), (-0.6, 4.6), (1.6, 4.2)):
        q = sk['hip'] + up * v + fw * u; cv.decal(q[0], q[1], GRAN, on='torso')
    # 깃
    cv.ellipse(sk['neck'] - up * 0.4 + fw * 0.2, 3.0, 1.35, a=p['tilt'], mat=M['trim'], group='collar', over=('torso', 'pony0', 'pony1', 'pony2', 'tail'))
    # 앞팔(포즈일 때)
    if 'hF' in sk and front_arm:
        draw_arm(cv, sk['shF'], sk['elF'], sk['hF'], claw=p['claw'], fist=p['fist'], item=p['item'])
    # 목
    cv.capsule(sk['neck'] - up * 0.2, sk['neck'] + up * 1.4, 1.2, 1.2, mat=M['skin_b'], group='neck', over=())
    # 머리
    hov = ('torso', 'collar', 'armB', 'pony0', 'pony1', 'pony2', 'ponyc', 'tail', 'neck', 'armF', 'gunb')
    hair_dome = (H((-0.4, -1.4)), 7.5)
    cv.ellipse(H((-0.9, -0.9)), 6.2, 5.7, a=ha, mat=M['hair'], group='hair', over=hov)
    cv.ellipse(H((0.45, 0.35)), 5.25, 4.95, a=ha, mat=M['skin'], group='face', over=hov)
    cv.ellipse(H((-2.0, 1.0)), 1.15, 1.45, a=ha, mat=M['skin'], group='ear', over=('hair',))
    # 옆머리(귀 앞으로 내려오는 가닥)
    cv.poly([H(q) for q in ((-3.9, -2.6), (-2.2, -2.6), (-2.1, 0.6), (-2.9, 3.4), (-3.7, 1.0))],
            mat=M['hair'], group='lock', over=('face', 'ear'), dome=hair_dome)
    # 앞머리
    bang = ((-4.2, -3.2), (-3.0, -5.4), (-0.6, -6.5), (2.2, -6.4), (4.6, -5.0), (6.0, -3.2), (6.9, -1.4),
            (5.4, -1.9), (4.9, -0.7), (3.9, -2.2), (2.6, -0.9), (1.7, -2.4), (0.6, -1.1), (-0.3, -2.6), (-1.6, -1.8), (-2.6, -3.0))
    cv.poly([H(q) for q in bang], mat=M['hair'], group='bangs', over=('face', 'ear', 'lock'), dome=hair_dome, lift=0.05)
    # 머리띠
    cv.capsule(H((-5.6, -3.6)), H((4.0, -4.7)), 0.72, 0.72, mat=M['band'], group='band', over=('hair', 'bangs', 'face', 'lock'))
    cv.ellipse(H((-5.7, -3.2)), 1.25, 1.15, mat=M['band'], group='knot', over=('hair', 'band', 'tail', 'pony0'))
    x, y = H((1.9, -4.5)); cv.decal(x, y, '#ffffff', on='band')
    # 머리 하이라이트(앤젤링)
    for q in ((-2.2, -4.9), (-1.4, -5.3), (-3.0, -4.3)):
        x, y = H(q); cv.decal(x, y, '#ffd8ee', on='hair|bangs')
    # 근접 잔상
    if p['smear'] is not None:
        c0, r0, a0, a1 = p['smear']
        pts_o = [c0 + np.array([math.cos(a), math.sin(a)]) * r0 for a in np.linspace(a0, a1, 12)]
        pts_i = [c0 + np.array([math.cos(a), math.sin(a)]) * (r0 - 2.4 - 1.6 * math.sin((a - a0) / (a1 - a0) * math.pi)) for a in np.linspace(a1, a0, 12)]
        cv.poly(pts_o + pts_i, mat=M['fx'], group='fx', over=(), flat=np.array([0, 0, 1.0]))


# ---------------- 얼굴 도장 ----------------
FPAL = {'K': '#1e0820', 'I': '#8a1a5c', 'i': '#4a0c3e', 'W': '#ffffff', 'M': '#6e1e34', 'm': '#d0566a',
        'B': '#ff9aa6', 'S': '#a8e4ff', 'T': '#ffffff', 'X': '#2a0c2c', 'H': '#ffc8da'}
FX0, FY0 = -1, -3   # 도장 왼쪽 위 = 머리 중심 기준 로컬 좌표
FACES = {
    # 열: x=-2..6  /  행: y=-3..3
    'normal': ["         ",
               "         ",
               "  K  KK  ",
               "  I  IW  ",
               "  i  iI  ",
               "       B ",
               "     M   "],
    'blink': ["         ",
              "         ",
              "         ",
              "  K  KK  ",
              "       B ",
              "       B ",
              "     M   "],
    'look_u': ["         ",
               "  K  KK  ",
               "  I  IW  ",
               "  i  iI  ",
               "         ",
               "       B ",
               "     M   "],
    'look_d': ["         ",
               "         ",
               "         ",
               "  K  KK  ",
               "  I  WI  ",
               "  i  iI B",
               "     M   "],
    'fierce': ["         ",
               "     K   ",
               "  K  KK  ",
               "  I  IW  ",
               "  i  iI  ",
               "    MM B ",
               "    mM   "],
    'fierce_u': ["     K   ",
                 "  K  KK  ",
                 "  I  IW  ",
                 "  i  iI  ",
                 "         ",
                 "    MM B ",
                 "    mM   "],
    'fierce_d': ["         ",
                 "     K   ",
                 "         ",
                 "  K  KK  ",
                 "  I  WI  ",
                 "  i MiI B",
                 "    mM   "],
    'hurt': ["         ",
             "         ",
             "   K K   ",
             "  K   K  ",
             "   K K   ",
             "    MM   ",
             "    mm   "],
    'joy': ["         ",
            "         ",
            "      K  ",
            "  K  K K ",
            "       B ",
            "    MMM  ",
            "    mm   "],
    'tired': ["         ",
              "         ",
              "         ",
              "  K  KK  ",
              "  i  iI S",
              "       BS",
              "    MM   "],
    'strain': ["         ",
               "         ",
               "  K  K   ",
               "   K  K  ",
               "  K  K   ",
               "    WWW  ",
               "    KKK  "],
    'ko': ["         ",
           "         ",
           "  X  X X ",
           "      X  ",
           "  X  X X ",
           "         ",
           "     MM  "],
    'surprise': ["         ",
                 "  K  KK  ",
                 "  W  WW  ",
                 "  K  KW  ",
                 "  i  KK  ",
                 "     M   ",
                 "     m   "],
}


def bake_face(cv, sk, name):
    g = FACES[name]
    for r, row in enumerate(g):
        for c, ch in enumerate(row):
            if ch == ' ': continue
            x, y = sk['head'] + rot(np.array([FX0 + c + 0.5, FY0 + r + 0.5]) / K, sk['ha'])
            cv.decal(x, y, FPAL[ch], on='face|bangs|lock|hair|ear')


def face_stamp(name):
    g = FACES[name]; h = len(g); w = len(g[0])
    img = np.zeros((h, w, 4), np.uint8)
    for r, row in enumerate(g):
        for c, ch in enumerate(row):
            if ch != ' ': img[r, c, :3] = hexc(FPAL[ch]); img[r, c, 3] = 255
    return img


# ---------------- 총 든 앞팔(조준 레이어) ----------------
ARM_HAND = np.array([3.9, 2.5]); ARM_EL = np.array([0.9, 2.7]); MUZ = np.array([13.0, 0.9])


def render_arm(angle, recoil=0, gun=True, size=40):
    cv = Canvas(size, size, size // 2, size // 2, K)
    rr = recoil
    T = lambda v: rot(np.asarray(v, float) - np.array([rr, -0.15 * rr]), angle)
    if gun:
        draw_gun_parts(cv, T, over=())
        # 총구 섬광 연기용 아님 – 몸통 하이라이트만
    el = rot(ARM_EL - np.array([rr * 0.5, 0]), angle); hd = T(ARM_HAND)
    draw_arm(cv, np.zeros(2), el, hd, over='all')
    return cv.render(), rot(MUZ - np.array([rr, 0]), angle), hd
