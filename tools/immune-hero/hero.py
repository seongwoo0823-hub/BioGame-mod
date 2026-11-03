# 면역 특공대 주인공 공용 2D 측면 리그 + 호중구(NEUTROPHIL)
# 캐릭터마다 Hero를 상속해 재질·비율·머리·총·2차 움직임 체인·표정·애니메이션을 바꾼다
import math, numpy as np
from raster import Canvas, Mat, rot, hexc


def ang_dir(a):  # 아래 방향 기준 각도 (+ = 앞으로)
    return np.array([math.sin(a), math.cos(a)])


def ik(h, f, l1, l2, fwd=1):
    h = np.asarray(h, float); f = np.asarray(f, float); v = f - h; d0 = np.linalg.norm(v)
    d = min(max(d0, abs(l1 - l2) + 0.1), l1 + l2 - 0.05)
    v = v / d0 if d0 > 1e-6 else np.array([0, 1.0])
    a = math.atan2(v[1], v[0]); b = math.acos(np.clip((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1))
    k = h + l1 * np.array([math.cos(a - b * fwd), math.sin(a - b * fwd)])
    return k, h + v * d


def mats(d):
    m = {k: (v if isinstance(v, Mat) else Mat(*v) if isinstance(v, tuple) else Mat(v)) for k, v in d.items()}
    for k in list(m): m[k + '_b'] = m[k].back()
    return m


DEF = dict(x=0, y=0, tilt=0.05, head=0.0, fF=(2.2, -1.5), fB=(-2.0, -1.5), aF=0.0, aB=0.0,
           armB=(0.15, 0.55), armF=None, claw=False, item=None, squash=1.0, spin=0.0,
           sling=False, smear=None, fist=False, oy=0.0, ox=0.0, blade=False, kick=None, armtop=False)

BASE_FPAL = {'K': '#1e0820', 'I': '#8a1a5c', 'i': '#4a0c3e', 'W': '#ffffff', 'M': '#6e1e34', 'm': '#d0566a',
             'B': '#ff9aa6', 'S': '#a8e4ff', 'X': '#2a0c2c'}


class Hero:
    id = 'neut'
    K = 1.2
    HIP, THIGH, SHIN, ANK, TORSO, UA, FA = 9.0, 4.3, 4.0, 1.5, 6.0, 3.0, 2.8
    TR = (3.25, 3.55); PEL = (3.4, 2.3); LR = 1.0; AR = 1.0; SKIRT = True
    HEAD_OFF = (0.35, -5.3)
    FX0, FY0 = -1, -3
    ARM_HAND = np.array([3.9, 2.5]); ARM_EL = np.array([0.9, 2.7]); MUZ = np.array([13.0, 0.9])
    CH = dict(pony=(3, 2.6, -0.9, 0.16, 0.86, 0.05), tail=(5, 1.45, -1.25, 0.08, 0.9, 0.035),
              coat=(2, 2.4, -0.35, 0.22, 0.82, 0.05), coat2=(2, 2.2, -0.15, 0.25, 0.82, 0.05))
    TAILS = 2
    M = mats(dict(
        skin=['#8a3a40', '#eaa08a', '#ffd3ba', '#fff1e4'],
        hair=['#2a0828', '#661656', '#a42c86', '#d652ac', '#ff96d0'],
        coat=(['#55466c', '#9c8cb8', '#ddd4ee', '#fbf8ff'], 0.04),
        trim=['#6a1e58', '#b54894', '#e692cc', '#ffd0ee'],
        pants=['#180c22', '#2c1a3a', '#45305a', '#634a7c'],
        boot=['#24081a', '#4e1634', '#80284e', '#b44c72'],
        glove=['#1e0c22', '#3a1a40', '#5e3264', '#86528a'],
        band=['#4e0816', '#a8162c', '#e23446', '#ff8088'],
        belt=['#1a0e10', '#3a2224', '#5c3a34', '#86604c'],
        gun=['#240e22', '#4e2246', '#7c3a6e', '#b45a9a'],
        gunlt=['#5a1a4a', '#a8387e', '#e070b0', '#ffc0e4'],
        metal=['#22202e', '#4c4a62', '#8a88a4', '#d8d6ea'],
        glass=(['#1e3a5a', '#3a76a0', '#76c0e6', '#d0f2ff'], 0.05),
        fx=(['#ff70c0', '#ffb0e0', '#ffe8f6', '#ffffff'], 0.3),
        gren=['#3a5a10', '#6aa020', '#a8e050', '#eaffb0'],
    ))
    FPAL = BASE_FPAL
    FACES = {
        'normal': ["         ", "         ", "  K  KK  ", "  I  IW  ", "  i  iI  ", "       B ", "     M   "],
        'blink': ["         ", "         ", "         ", "  K  KK  ", "       B ", "       B ", "     M   "],
        'look_u': ["         ", "  K  KK  ", "  I  IW  ", "  i  iI  ", "         ", "       B ", "     M   "],
        'look_d': ["         ", "         ", "         ", "  K  KK  ", "  I  WI  ", "  i  iI B", "     M   "],
        'fierce': ["         ", "     K   ", "  K  KK  ", "  I  IW  ", "  i  iI  ", "    MM B ", "    mM   "],
        'fierce_u': ["     K   ", "  K  KK  ", "  I  IW  ", "  i  iI  ", "         ", "    MM B ", "    mM   "],
        'fierce_d': ["         ", "     K   ", "         ", "  K  KK  ", "  I  WI  ", "  i MiI B", "    mM   "],
        'hurt': ["         ", "         ", "   K K   ", "  K   K  ", "   K K   ", "    MM   ", "    mm   "],
        'joy': ["         ", "         ", "      K  ", "  K  K K ", "       B ", "    MMM  ", "    mm   "],
        'tired': ["         ", "         ", "         ", "  K  KK  ", "  i  iI S", "       BS", "    MM   "],
        'strain': ["         ", "         ", "  K  K   ", "   K  K  ", "  K  K   ", "    WWW  ", "    KKK  "],
        'ko': ["         ", "         ", "  X  X X ", "      X  ", "  X  X X ", "         ", "     MM  "],
        'surprise': ["         ", "  K  KK  ", "  W  WW  ", "  K  KW  ", "  i  KK  ", "     M   ", "     m   "],
    }

    def __init__(s):
        s.FACES = dict(s.FACES)
        if 'chomp' not in s.FACES: s.FACES['chomp'] = s.FACES['fierce']

    # ---------- 뼈대 ----------
    def skeleton(s, pose):
        p = dict(DEF); p.update(pose)
        O = np.array([p['ox'], p['oy']])
        fF = np.asarray(p['fF'], float) + O; fB = np.asarray(p['fB'], float) + O
        hip = np.array([p['x'], -s.HIP + p['y']]) + O
        t = p['tilt']; up = np.array([math.sin(t), -math.cos(t)]); fw = np.array([math.cos(t), math.sin(t)])
        sq = p['squash']; neck = hip + up * s.TORSO * sq; ha = t + p['head']
        head = neck + rot(np.array([s.HEAD_OFF[0], s.HEAD_OFF[1] * (0.5 + 0.5 * sq)]), ha)
        kF, anF = ik(hip + fw * 0.5, fF, s.THIGH, s.SHIN); kB, anB = ik(hip - fw * 0.4, fB, s.THIGH, s.SHIN)
        shB = neck - up * 1.7 - fw * 0.7 * s.AR; shF = neck - up * 1.8 + fw * 0.8 * s.AR
        a, e = p['armB']; elB = shB + ang_dir(a + t * 0.5) * s.UA; hB = elB + ang_dir(a + e + t * 0.5) * s.FA
        sk = dict(p=p, hip=hip, up=up, fw=fw, neck=neck, head=head, ha=ha, kF=kF, anF=anF, kB=kB, anB=anB,
                  shB=shB, elB=elB, hB=hB, shF=shF)
        if p['armF'] is not None:
            a, e = p['armF']; sk['elF'] = shF + ang_dir(a + t * 0.5) * s.UA; sk['hF'] = sk['elF'] + ang_dir(a + e + t * 0.5) * s.FA
        sk['center'] = hip + up * 3
        return sk

    def hl(s, sk, v): return sk['head'] + rot(np.asarray(v, float), sk['ha'])

    def chain_anchor(s, sk, which):
        if which == 'pony': return s.hl(sk, (-4.9, -2.2))
        if which == 'tail': return s.hl(sk, (-5.6, -3.6))
        if which == 'coat': return sk['hip'] - sk['fw'] * 2.6 + sk['up'] * 0.6
        if which == 'coat2': return sk['hip'] - sk['fw'] * 1.0 + sk['up'] * 0.4

    def simulate(s, frames_sk, ticks, which, loop=True, wind=(0, 0), warm=3, rest_rot=0.0):
        n, L, ra, k, damp, g = s.CH[which]
        anchors = [s.chain_anchor(sk, which) for sk in frames_sk]
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
                    _step(pos, prev, a0 + (a1 - a0) * (tt / T), L, ra + rots[fi] + rest_rot, k, damp, g, tw(fi))
        return out, anchors

    # ---------- 부품 ----------
    def arm(s, cv, sh, el, hand, mats=('coat', 'trim', 'glove'), group='armF', over='all', claw=False, fist=False, item=None, blade=False):
        c, t, gl = (s.M[m] for m in mats); r = s.AR
        cv.capsule(sh, el, 1.45 * r, 1.3 * r, mat=c, group=group, over=over)
        cv.capsule(el, hand + (el - hand) * 0.15, 1.3 * r, 1.2 * r, mat=c, group=group, over=over)
        cuff = hand + (el - hand) / (np.linalg.norm(el - hand) + 1e-9) * 1.2 * r
        cv.ellipse(cuff, 1.35 * r, 1.35 * r, mat=t, group=group, over=over)
        cv.ellipse(hand, (1.5 if fist else 1.4) * r, 1.4 * r, mat=gl, group=group, over=over)
        d = (hand - el) / (np.linalg.norm(hand - el) + 1e-9); n = np.array([-d[1], d[0]])
        if claw:
            for o in (-1.2, 0, 1.2):
                a = hand + d * 1.0 + n * o
                cv.capsule(a, a + d * 2.6 + n * o * 0.4, 0.55, 0.25, mat=s.M['metal'], group=group + 'c', over=over)
        if blade:
            cv.capsule(hand + d * 0.6, hand + d * 9.0, 0.75, 0.3, mat=s.M['fx'], group=group + 'c', over=over)
        if item == 'gren':
            cv.ellipse(hand + np.array([0.3, -1.4]), 1.5, 1.3, mat=s.M['gren'], group='item', over='all')
        if item == 'net':
            cv.ellipse(hand + np.array([0.3, -1.6]), 1.9, 1.6, mat=s.M['glass'], group='item', over='all')

    def gun(s, cv, T, group='gun', over=()):
        cap = lambda a, b, r1, r2, m: cv.capsule(T(a), T(b), r1, r2, mat=s.M[m], group=group, over=over)
        cap((2.4, 1.6), (-0.9, 2.9), 1.05, 0.95, 'gun')
        cap((3.0, 0.9), (10.0, 0.9), 1.55, 1.45, 'gun')
        cv.poly([T(q) for q in ((9.6, -0.6), (12.0, -1.4), (12.9, -1.2), (12.9, 3.0), (12.0, 3.2), (9.6, 2.4))],
                mat=s.M['gunlt'], group=group, over=over, dome=(T((11, 0.9)), 3.4))
        cap((6.6, 2.75), (8.9, 2.75), 0.85, 0.85, 'gunlt')
        cv.ellipse(T((6.0, -1.25)), 2.25, 1.25, mat=s.M['glass'], group=group, over=over)
        for q, c in (((5.2, -1.6), '#ff8ad0'), ((6.4, -1.0), '#ffd0ee'), ((6.9, -1.7), '#ff6ab8'), ((5.0, -0.6), '#ffffff')):
            x, y = T(q); cv.decal(x, y, c, on=group)
        for yy in (-0.5, 0.9, 2.3):
            x, y = T((12.8, yy)); cv.decal(x, y, '#3a0a2a', on=group)
        x, y = T((4.0, 0.2)); cv.decal(x, y, '#ffb0dc', on=group)

    def leg(s, cv, sk, k, an, aF, mb, grp, over):
        fw = sk['fw']; r = s.LR
        hipj = sk['hip'] + (fw * 0.5 if grp == 'legF' else -fw * 0.4)
        cv.capsule(hipj, k, 1.85 * r, 1.55 * r, mat=s.M['pants' + mb], group=grp, over=over)
        cv.capsule(k, an, 1.5 * r, 1.35 * r, mat=s.M['pants' + mb], group=grp, over=over)
        bt = k + (an - k) * 0.42
        cv.capsule(bt, an, 1.65 * r, 1.6 * r, mat=s.M['boot' + mb], group=grp, over=over)
        fd = rot(np.array([1.0, 0.0]), aF); fn = np.array([-fd[1], fd[0]])
        toe = an + fd * 1.35 * r + fn * 0.55
        cv.ellipse(toe, 2.35 * r, 1.3 * r, a=aF, mat=s.M['boot' + mb], group=grp, over=over)
        cv.line_decal(toe - fd * 1.8 * r + fn * 1.0 * r, toe + fd * 1.9 * r + fn * 0.9 * r, '#120610', on=grp)
        x, y = toe + fd * 1.3 * r - fn * 0.3; cv.decal(x, y, s.M['trim' + mb].ramp[2], on=grp)
        cv.line_decal(bt - fw * 1.4 * r, bt + fw * 1.4 * r, s.M['trim' + mb].ramp[1], on=grp)

    def back(s, cv, sk, ch):
        for ci, c in enumerate(ch.get('tail', [])):
            pts = [ch['tail_a'][ci]] + c
            for i in range(len(pts) - 1):
                r = 0.95 - i * 0.1
                cv.capsule(pts[i], pts[i + 1], r, r - 0.1, mat=s.M['band_b'] if ci else s.M['band'], group='tail')
        if 'pony' in ch:
            pts = [ch['pony_a']] + ch['pony']
            for i in range(3): cv.capsule(pts[i], pts[i + 1], 1.0, 0.8, mat=s.M['hair_b'], group='ponyc')
            for i, r in reversed(list(enumerate((2.75, 2.45, 2.05)))):
                q = pts[i + 1] if i else (pts[0] * 0.25 + pts[1] * 0.75)
                cv.ellipse(q, r, r * 0.92, mat=s.M['hair'], group='pony%d' % i, over=('pony%d' % (i + 1), 'ponyc', 'tail'))

    def coat_tails(s, cv, sk, ch):
        up, fw = sk['up'], sk['fw']
        for nm in ('coat', 'coat2'):
            if nm in ch:
                a0 = ch[nm + '_a']; c1, c2 = ch[nm]
                cv.poly([a0 + up * 1.2 + fw * 1.8, a0 - fw * 0.6, c1 - fw * 0.9, c2 - fw * 0.6, c2 + fw * 1.4, c1 + fw * 1.8, a0 + fw * 3.0],
                        mat=s.M['coat_b'] if nm == 'coat' else s.M['coat'], group=nm, over=('armB', 'tail', 'gunb', 'coat'), dome=(c1, 4))
                cv.line_decal(c2 - fw * 0.5, c2 + fw * 1.3, s.M['trim'].ramp[1], on=nm)

    def torso_deco(s, cv, sk):
        up, fw = sk['up'], sk['fw']
        w0 = sk['hip'] + up * 1.25
        cv.capsule(w0 - fw * 3.3, w0 + fw * 3.4, 0.75, 0.75, mat=s.M['belt'], group='belt', over=('torso',))
        x, y = w0 + fw * 2.5; cv.decal(x, y, '#ffd060', on='belt'); x, y = w0 + fw * 2.5 - up * 0.6; cv.decal(x, y, '#a07020', on='belt')
        cv.ellipse(w0 - fw * 2.2 - up * 1.0, 1.25, 1.05, mat=s.M['belt'], group='pouch', over=('torso', 'belt', 'pelvis', 'legF', 'legB'))
        a = sk['neck'] - up * 1.0 + fw * 1.6; b = sk['hip'] + up * 1.6 - fw * 2.6
        cv.line_decal(a, b, s.M['trim'].ramp[1], on='torso')
        for i in range(1, 4):
            q = a + (b - a) * (i / 4.0); cv.decal(q[0], q[1], '#ffd0ee', on='torso')
        cv.line_decal(sk['neck'] - up * 1.2 + fw * 3.2, sk['hip'] + up * 1.7 + fw * 3.0, s.M['coat'].ramp[1], on='torso')
        for (u, v) in ((-1.4, 3.6), (0.6, 2.2), (-0.6, 4.6), (1.6, 4.2)):
            q = sk['hip'] + up * v + fw * u; cv.decal(q[0], q[1], '#c892e8', on='torso')

    def collar(s, cv, sk):
        cv.ellipse(sk['neck'] - sk['up'] * 0.4 + sk['fw'] * 0.2, 3.0 * s.AR, 1.35, a=sk['p']['tilt'], mat=s.M['trim'], group='collar',
                   over=('torso', 'pony0', 'pony1', 'pony2', 'tail'))

    HOV = ('torso', 'collar', 'armB', 'pony0', 'pony1', 'pony2', 'ponyc', 'tail', 'neck', 'armF', 'gunb', 'scarf')

    def head(s, cv, sk):
        H = lambda v: s.hl(sk, v); ha = sk['ha']; hov = s.HOV
        dome = (H((-0.4, -1.4)), 7.5)
        cv.ellipse(H((-0.9, -0.9)), 6.2, 5.7, a=ha, mat=s.M['hair'], group='hair', over=hov)
        cv.ellipse(H((0.45, 0.35)), 5.25, 4.95, a=ha, mat=s.M['skin'], group='face', over=hov)
        cv.ellipse(H((-2.0, 1.0)), 1.15, 1.45, a=ha, mat=s.M['skin'], group='ear', over=('hair',))
        cv.poly([H(q) for q in ((-3.9, -2.6), (-2.2, -2.6), (-2.1, 0.6), (-2.9, 3.4), (-3.7, 1.0))],
                mat=s.M['hair'], group='lock', over=('face', 'ear'), dome=dome)
        bang = ((-4.2, -3.2), (-3.0, -5.4), (-0.6, -6.5), (2.2, -6.4), (4.6, -5.0), (6.0, -3.2), (6.9, -1.4),
                (5.4, -1.9), (4.9, -0.7), (3.9, -2.2), (2.6, -0.9), (1.7, -2.4), (0.6, -1.1), (-0.3, -2.6), (-1.6, -1.8), (-2.6, -3.0))
        cv.poly([H(q) for q in bang], mat=s.M['hair'], group='bangs', over=('face', 'ear', 'lock'), dome=dome, lift=0.05)
        cv.capsule(H((-5.6, -3.6)), H((4.0, -4.7)), 0.72, 0.72, mat=s.M['band'], group='band', over=('hair', 'bangs', 'face', 'lock'))
        cv.ellipse(H((-5.7, -3.2)), 1.25, 1.15, mat=s.M['band'], group='knot', over=('hair', 'band', 'tail', 'pony0'))
        x, y = H((1.9, -4.5)); cv.decal(x, y, '#ffffff', on='band')
        for q in ((-2.2, -4.9), (-1.4, -5.3), (-3.0, -4.3)):
            x, y = H(q); cv.decal(x, y, '#ffd8ee', on='hair|bangs')

    def kick_leg(s, sk):
        return sk['kF'], sk['anF']

    # ---------- 몸 전체 ----------
    def draw_body(s, cv, sk, ch, front_arm=True):
        p = sk['p']; up, fw = sk['up'], sk['fw']
        s.back(cv, sk, ch)
        s.arm(cv, sk['shB'], sk['elB'], sk['hB'], mats=('coat_b', 'trim_b', 'glove_b'), group='armB',
              over=('tail', 'pony0', 'pony1', 'pony2', 'scarf'), fist=p['fist'])
        if p['sling']:
            o = sk['neck'] - up * 2.5 - fw * 2.6; a = math.atan2(up[1], up[0]) + 0.75 + math.pi
            T = lambda v: o + rot(np.asarray(v, float) * 0.85 - np.array([6.5, 0]), a)
            s.gun(cv, T, group='gunb', over=('armB', 'tail', 'pony0', 'pony1', 'pony2', 'scarf'))
        s.coat_tails(cv, sk, ch)
        s.leg(cv, sk, sk['kB'], sk['anB'], p['aB'], '_b', 'legB', ('tail', 'coat', 'pony0', 'pony1', 'pony2', 'armB', 'gunb', 'scarf'))
        cv.ellipse(sk['hip'] + up * 0.4, s.PEL[0], s.PEL[1], a=p['tilt'], mat=s.M['pants'], group='pelvis', over=('legB', 'coat', 'armB', 'tail'))
        s.leg(cv, sk, sk['kF'], sk['anF'], p['aF'], '', 'legF', ('legB', 'coat', 'coat2', 'armB', 'tail', 'gunb', 'scarf'))
        tov = ('armB', 'legB', 'legF', 'pelvis', 'tail', 'pony0', 'pony1', 'pony2', 'gunb', 'coat', 'scarf')
        cv.capsule(sk['hip'] + up * 1.0 - fw * 0.2, sk['neck'] - up * 1.5, s.TR[0], s.TR[1], mat=s.M['coat'], group='torso', over=tov)
        if s.SKIRT:
            r = s.TR[0] / 3.25
            cv.poly([sk['hip'] + up * 1.4 - fw * 3.2 * r, sk['hip'] + up * 1.4 + fw * 3.4 * r, sk['hip'] - up * 0.9 + fw * 3.0 * r, sk['hip'] - up * 0.8 - fw * 3.4 * r],
                    mat=s.M['coat'], group='torso', over=tov, dome=(sk['hip'] + up * 2.5, 5 * r))
        s.torso_deco(cv, sk)
        s.collar(cv, sk)
        if p['kick'] is not None:   # 발차기: 잔상 → 앞다리를 몸 위로
            s._smear(cv, p); p = dict(p, smear=None); sk = dict(sk, p=p)
            s.leg(cv, sk, sk['kF'], sk['anF'], p['aF'], '', 'legK', 'all')
        fa = lambda: s.arm(cv, sk['shF'], sk['elF'], sk['hF'], claw=p['claw'], fist=p['fist'], item=p['item'], blade=p['blade'])
        if 'hF' in sk and front_arm and not p['armtop']: fa()
        cv.capsule(sk['neck'] - up * 0.2, sk['neck'] + up * 1.4, 1.2, 1.2, mat=s.M['skin_b'], group='neck', over=())
        s.head(cv, sk)
        if 'hF' in sk and front_arm and p['armtop']: fa()
        s._smear(cv, p)

    def _smear(s, cv, p):
        if p['smear'] is not None:
            c0, r0, a0, a1 = p['smear']
            pts_o = [c0 + np.array([math.cos(a), math.sin(a)]) * r0 for a in np.linspace(a0, a1, 12)]
            pts_i = [c0 + np.array([math.cos(a), math.sin(a)]) * (r0 - 2.4 - 1.6 * math.sin((a - a0) / (a1 - a0) * math.pi)) for a in np.linspace(a1, a0, 12)]
            cv.poly(pts_o + pts_i, mat=s.M['fx'], group='fx', over=(), flat=np.array([0, 0, 1.0]))

    # ---------- 얼굴 ----------
    def bake_face(s, cv, sk, name):
        for r, row in enumerate(s.FACES[name]):
            for c, chh in enumerate(row):
                if chh == ' ': continue
                x, y = sk['head'] + rot(np.array([s.FX0 + c + 0.5, s.FY0 + r + 0.5]) / s.K, sk['ha'])
                cv.decal(x, y, s.FPAL[chh], on=None)

    def face_stamp(s, name):
        g = s.FACES[name]; img = np.zeros((len(g), len(g[0]), 4), np.uint8)
        for r, row in enumerate(g):
            for c, chh in enumerate(row):
                if chh != ' ': img[r, c, :3] = hexc(s.FPAL[chh]); img[r, c, 3] = 255
        return img

    # ---------- 조준 팔 ----------
    def render_arm(s, angle, recoil=0, gun=True, size=40):
        cv = Canvas(size, size, size // 2, size // 2, s.K)
        T = lambda v: rot(np.asarray(v, float) - np.array([recoil, -0.15 * recoil]), angle)
        if gun: s.gun(cv, T, over=())
        el = rot(s.ARM_EL - np.array([recoil * 0.5, 0]), angle); hd = T(s.ARM_HAND)
        s.arm(cv, np.zeros(2), el, hd, over='all')
        return cv.render(), rot(s.MUZ - np.array([recoil, 0]), angle), hd

    def anims(s):
        import anim
        return anim.ANIMS()


def _step(pos, prev, an, L, ra, k, damp, g, wind):
    base = an
    for i in range(len(pos)):
        p = pos[i]; v = (p - prev[i]) * damp; prev[i] = p.copy()
        rest = base + ang_dir(ra - 0.12 * i) * L
        p = p + v + np.array([wind[0], g + wind[1]]) + (rest - p) * k
        d = p - base; dl = np.linalg.norm(d) + 1e-9; p = base + d / dl * L
        pos[i] = p; base = p
