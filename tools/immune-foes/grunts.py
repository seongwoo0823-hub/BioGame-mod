# 적 60종 의인화: 작은 '병원균 병사' 리그 (주인공 리그를 축소해 재사용) + 병원균 모양 머리 + 무기 + 세력 색
# 세력 색은 주인공(밝고 깨끗한 파스텔)과 확실히 다르게: 어둡고 칙칙한 몸 + 빛나는 눈
import sys, os, math
import numpy as np
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'immune-hero'))
from raster import Canvas, Mat, rot
from hero import Hero, mats, ang_dir
import anim as HA
from lib import M as MC

TAU = 2 * math.pi
FACTION = {
    1: dict(coat='#6e6a3c', trim='#a85a2a', pants='#3e3a26', boot='#2a2418', glove='#4a4430', belt='#2e2418', glow='#f0e040', dark='#14120a'),   # 부패 (세균)
    2: dict(coat='#62607a', trim='#a83444', pants='#363444', boot='#22202a', glove='#44424e', belt='#26242e', glow='#ff3048', dark='#0e0c14'),   # 잿빛 (바이러스)
    3: dict(coat='#6a3a46', trim='#b08a4a', pants='#3a1e2a', boot='#200c16', glove='#4a2a34', belt='#2a121a', glow='#ff8a20', dark='#100408'),   # 썩은 살 (종양)
}


class Grunt(Hero):
    K = 0.78
    HIP, THIGH, SHIN, TORSO, UA, FA = 7.6, 3.7, 3.4, 5.0, 2.6, 2.4
    TR = (3.0, 3.3); PEL = (3.0, 2.0); LR = 0.95; AR = 0.95; SKIRT = False
    HEAD_OFF = (0.4, -5.6)
    CH = {}; TAILS = 0

    def __init__(s, name, spec):
        super().__init__()
        s.name = name; s.sp = spec; fc = dict(FACTION[spec['f']]); fc.update(spec.get('fc', {}))
        s.fc = fc; s.K = spec.get('K', Grunt.K)
        for k in ('HIP', 'TORSO', 'TR', 'PEL', 'LR', 'AR', 'UA', 'FA'):
            if k in spec: setattr(s, k, spec[k])
        s.M = mats(dict(coat=MC(fc['coat']), trim=MC(fc['trim']), pants=MC(fc['pants']), boot=MC(fc['boot']), glove=MC(fc['glove']), belt=MC(fc['belt']),
                        skin=MC(fc['coat']), metal=['#1e1c22', '#3c3a44', '#6a6876', '#a8a6b6'], fx=(['#ffffff', '#ffffff', '#ffffff', '#ffffff'], 0.4),
                        glass=['#2a2a10', '#6a6a20', fc['glow'], '#ffffe0'], gren=['#2a2a10', '#6a6a20', fc['glow'], '#ffffe0']))
        s.HOV = s.HOV + ('wpn',)

    # ---------- 머리 ----------
    def H(s, sk, v): return s.hl(sk, v)

    def glow_eyes(s, cv, sk, pts, mood='a', col=None):
        col = col or s.fc['glow']
        for (x, y) in pts:
            for dx in (0, 1):
                q = sk['head'] + rot(np.array([x + dx + 0.5, y + 0.5]) / s.K, sk['ha']); cv.decal(q[0], q[1], col)
            if mood == 'a':
                q = sk['head'] + rot(np.array([x - 0.5, y - 0.5]) / s.K, sk['ha']); cv.decal(q[0], q[1], s.fc['dark'])
                q = sk['head'] + rot(np.array([x + 0.5, y - 0.5]) / s.K, sk['ha']); cv.decal(q[0], q[1], s.fc['dark'])

    def teeth(s, cv, sk, x, y, w=3):
        for i in range(w):
            q = sk['head'] + rot(np.array([x + i + 0.5, y + 0.5]) / s.K, sk['ha']); cv.decal(q[0], q[1], '#d8d0b0' if i % 2 == 0 else s.fc['dark'])

    def head(s, cv, sk):
        s.sp['head'](s, cv, sk)

    def back(s, cv, sk, ch):
        b = s.sp.get('back')
        if b: b(s, cv, sk)

    def collar(s, cv, sk):
        cv.ellipse(sk['neck'] - sk['up'] * 0.3, 2.4, 1.0, a=sk['p']['tilt'], mat=s.M['trim'], group='collar', over=('torso',))

    def torso_deco(s, cv, sk):
        up, fw = sk['up'], sk['fw']; h = sk['hip']
        cv.poly([h + up * 4.4 + fw * 0.4, h + up * 4.6 + fw * 3.0, h + up * 1.6 + fw * 3.2, h + up * 1.2 + fw * 0.6], mat=s.M['trim'], group='plate', over=('torso',), dome=(h + up * 3 + fw * 2, 4))
        w0 = h + up * 1.0
        cv.capsule(w0 - fw * 2.9, w0 + fw * 3.0, 0.6, 0.6, mat=s.M['belt'], group='belt', over=('torso', 'plate'))
        x, y = h + up * 3.4 + fw * 2.0; cv.decal(x, y, s.fc['glow'], on='plate')

    def arm(s, cv, sh, el, hand, mats=('coat', 'trim', 'glove'), group='armF', over='all', claw=False, fist=False, item=None, blade=False):
        super().arm(cv, sh, el, hand, mats=mats, group=group, over=over, claw=claw, fist=fist, item=item, blade=blade)
        w = s.sp.get('wpn') if group == 'armF' else None
        p = s._p
        if w and not p.get('nowpn'):
            d = (hand - el) / (np.linalg.norm(hand - el) + 1e-9); n = np.array([-d[1], d[0]])
            g = M = s.M
            if w == 'gun':
                cv.capsule(hand + n * 0.2, hand + d * 5.4 + n * 0.2, 1.0, 0.9, mat=M['metal'], group='wpn', over='all')
                cv.capsule(hand + d * 4.6, hand + d * 6.2, 0.7, 0.7, mat=M['glass'], group='wpnc', over=('wpn',))
            elif w == 'blade':
                cv.capsule(hand, hand + d * 6.5 + n * 0.6, 0.75, 0.3, mat=M['metal'], group='wpn', over='all')
            elif w == 'claw':
                for o in (-0.9, 0.9): cv.capsule(hand + n * o, hand + d * 3.2 + n * o * 1.4, 0.45, 0.2, mat=M['metal'], group='wpn', over='all')
            elif w == 'syringe':
                cv.capsule(hand - d * 1.0, hand + d * 4.2, 1.0, 1.0, mat=M['glass'], group='wpn', over='all')
                cv.capsule(hand + d * 4.2, hand + d * 7.4, 0.3, 0.2, mat=M['metal'], group='wpnn', over=('wpn',))
            elif w == 'whip':
                k = p.get('whip', 0.0)
                pts = [hand]
                for i in range(1, 9):
                    t = i / 8; base = d * (2 + 22 * k) * t + np.array([0, -math.sin(t * math.pi) * (6 - 4 * k)])
                    pts.append(hand + base + n * math.sin(t * 6 + p.get('ph', 0) * TAU) * 0.8 * (1 - k))
                for i in range(8): cv.capsule(pts[i], pts[i + 1], 0.7, 0.6, mat=MC(s.sp['col']), group='wpn', over='all')
                cv.ellipse(pts[-1], 1.4, 1.4, mat=MC(s.sp['col']), group='wpnt', over=('wpn',))
            elif w == 'shield':
                c = hand + d * 1.0
                pts = [c + rot(np.array([0, -6.5]), 0), c + np.array([3.0, -3.5]), c + np.array([3.0, 3.5]), c + np.array([0, 6.5]), c + np.array([-1.5, 3]), c + np.array([-1.5, -3])]
                cv.poly(pts, mat=MC('#6a5a7a'), group='wpn', over='all', dome=(c + np.array([2, 0]), 7))
                cv.line_decal(c + np.array([1.5, -3]), c + np.array([1.5, 3]), s.fc['glow'], on='wpn')

    def draw_body(s, cv, sk, ch, front_arm=True):
        s._p = sk['p']
        super().draw_body(cv, sk, ch, front_arm)


# ===================== 머리 모양 =====================
def h_rod(col, flag=0, horiz=True, armor=None, R=4.2):
    def f(s, cv, sk):
        H = lambda v: s.hl(sk, v); ph = sk['p'].get('ph', 0)
        if flag:
            for k in range(flag):
                a0 = H((-5.5, -1 + k * 1.6)); pts = [a0]
                for i in range(4): pts.append(pts[-1] + rot(np.array([-1.6, math.sin(ph * TAU + i + k) * 0.9]), sk['ha']))
                for i in range(4): cv.capsule(pts[i], pts[i + 1], 0.5, 0.4, mat=MC(col).back(), group='flag', over=())
        cv.capsule(H((-4.6, 0)), H((3.6, -0.4)), R, R * 0.95, mat=MC(col), group='face', over=s.HOV)
        if armor:
            cv.poly([H(q) for q in ((-2, -R - 0.6), (4.6, -R + 0.4), (6.4, -0.6), (5.8, 1.6), (-2.6, 0.2))], mat=MC(armor), group='helm', over=('face',), dome=(H((1, -2)), 6))
        x, y = H((-2.4, -2.6)); cv.decal(x, y, MC(col).ramp[3], on='face')
        s.glow_eyes(cv, sk, [(1, -1), (3, -1)]); s.teeth(cv, sk, 1, 1)
    return f


def h_ball(col, spikes=0, spc=None, knob=None, cluster=False, hexa=False, R=4.6, lumps=False, cracks=None):
    def f(s, cv, sk):
        H = lambda v: s.hl(sk, v); ph = sk['p'].get('ph', 0); c = H((0, -0.4))
        if spikes:
            for i in range(spikes):
                a = i / spikes * TAU + ph * 0.6
                cv.capsule(c + np.array([math.cos(a), math.sin(a)]) * R * 0.8, c + np.array([math.cos(a), math.sin(a)]) * (R + 1.8), 0.45, 0.35, mat=MC(spc or col).back(), group='spk', over=())
                if knob: cv.ellipse(c + np.array([math.cos(a), math.sin(a)]) * (R + 2.0), 0.8, 0.8, mat=MC(knob), group='spk', over=())
        if cluster:
            for (x, y, r) in ((-3.4, -2.8, 2.6), (-4.0, 1.4, 2.4), (0.6, -4.4, 2.3)):
                cv.ellipse(H((x, y)), r, r, mat=MC(col).back(), group='cl', over=())
        if hexa:
            pts = [c + np.array([math.cos(a), math.sin(a)]) * R * 1.08 for a in np.arange(6) / 6 * TAU + sk['ha'] + math.pi / 6]
            cv.poly(pts, mat=MC(col), group='face', over=s.HOV + ('spk', 'cl'), dome=(c, R * 1.2))
        else:
            cv.ellipse(c, R, R * 0.95, mat=MC(col), group='face', over=s.HOV + ('spk', 'cl'))
        if lumps:
            for (x, y, r) in ((-2.6, -3.2, 1.8), (2.4, -3.6, 1.5), (-3.6, 0.8, 1.6)):
                cv.ellipse(H((x, y)), r, r, mat=MC(col), group='lump', over=('face',))
        if cracks:
            cv.line_decal(H((-3, -2)), H((-0.5, 0.5)), cracks, on='face'); cv.line_decal(H((-0.5, 0.5)), H((-2, 2.6)), cracks, on='face')
        x, y = H((-1.6, -2.6)); cv.decal(x, y, MC(col).ramp[3], on='face')
        s.glow_eyes(cv, sk, [(0, -1), (2, -1)]); s.teeth(cv, sk, 0, 1)
    return f


def h_bullet(col):
    def f(s, cv, sk):
        H = lambda v: s.hl(sk, v)
        cv.poly([H(q) for q in ((-5, -3.6), (2.4, -3.6), (5.6, -1.6), (6.4, 0.2), (5.6, 2.2), (2.4, 3.8), (-5, 3.8))], mat=MC(col), group='face', over=s.HOV, dome=(H((0, -1)), 6))
        for x in (-3.5, -1.5, 0.5): cv.line_decal(H((x, -3.4)), H((x, 3.4)), MC(col).ramp[1], on='face')
        s.glow_eyes(cv, sk, [(2, -1), (4, -1)]); s.teeth(cv, sk, 2, 1)
    return f


def h_phage(col):
    def f(s, cv, sk):
        H = lambda v: s.hl(sk, v); c = H((0, -1.5))
        cv.capsule(H((0, 1.5)), H((0, 4.0)), 1.4, 1.4, mat=MC('#4a4a58'), group='neckp', over=())
        pts = [c + np.array([math.cos(a), math.sin(a)]) * 5.0 for a in np.arange(6) / 6 * TAU + math.pi / 6]
        cv.poly(pts, mat=MC(col), group='face', over=s.HOV + ('neckp',), dome=(c, 6))
        for q in pts[::2]: cv.line_decal(c, q, MC(col).ramp[1], on='face')
        s.glow_eyes(cv, sk, [(1, -2), (3, -2)])
    return f


def h_vine(col):
    def f(s, cv, sk):
        H = lambda v: s.hl(sk, v)
        cv.ellipse(H((0, 0)), 4.2, 3.8, mat=MC(col), group='face', over=s.HOV)
        for a in (-2.4, -1.6, -0.6, 0.2):
            q = H((math.cos(a) * 4.0, math.sin(a) * 4.0)); cv.capsule(q, q + rot(np.array([math.cos(a), math.sin(a)]) * 2.2, sk['ha']), 0.6, 0.2, mat=MC('#c8b8a0'), group='thorn', over=())
        cv.ellipse(H((2.4, 0.6)), 2.2, 2.0, mat=MC('#2a0610'), group='maw', over=('face',))
        s.teeth(cv, sk, 1, 0, 4); s.glow_eyes(cv, sk, [(0, -3), (3, -3)])
    return f


# ===================== 등 장식 =====================
def b_wings(col, membrane=True):
    def f(s, cv, sk):
        ph = sk['p'].get('ph', 0); flap = math.sin(ph * TAU * 2)
        base = sk['neck'] - sk['fw'] * 1.6 + sk['up'] * -0.6
        for k, sh in ((0, 0.0), (1, 0.6)):
            tip = base + np.array([-7 + sh * 2, -6 - flap * 4 + sh * 3]); mid = base + np.array([-8.5, -1 - flap * 2 + sh * 2])
            cv.poly([base, tip, mid], mat=MC(col, 0.1).back() if k else MC(col, 0.1), group='wing', over=())
    return f


def b_jet(col):
    def f(s, cv, sk):
        ph = sk['p'].get('ph', 0); b = sk['neck'] - sk['up'] * 2.4 - sk['fw'] * 2.6
        cv.capsule(b, b - sk['up'] * 3.2, 1.3, 1.1, mat=MC('#3c3a44'), group='jet', over=())
        fl = b - sk['up'] * (4.6 + math.sin(ph * TAU * 3) * 0.8)
        cv.ellipse(fl, 0.9, 1.6, mat=MC(col, 0.3), group='jetf', over=())
    return f


def b_flag(col, n=3):
    def f(s, cv, sk):
        ph = sk['p'].get('ph', 0); b = sk['hip'] - sk['fw'] * 2.6 + sk['up'] * 1.0
        for k in range(n):
            pts = [b + sk['up'] * (k - 1) * 0.8]
            for i in range(5): pts.append(pts[-1] + np.array([-1.5, math.sin(ph * TAU + i * 0.9 + k) * 0.9]))
            for i in range(5): cv.capsule(pts[i], pts[i + 1], 0.45, 0.35, mat=MC(col).back(), group='flg', over=())
    return f


def b_shell(col):
    def f(s, cv, sk):
        c = sk['neck'] - sk['up'] * 2.6 - sk['fw'] * 2.4
        cv.ellipse(c, 4.6, 5.2, a=sk['p']['tilt'], mat=MC(col), group='shell', over=())
        for i in range(3): cv.line_decal(c + np.array([-3, -3 + i * 3]), c + np.array([2, -3 + i * 3]), MC(col).ramp[1], on='shell')
    return f


def b_tank(col):
    def f(s, cv, sk):
        c = sk['neck'] - sk['up'] * 2.4 - sk['fw'] * 2.6
        cv.capsule(c + sk['up'] * 2, c - sk['up'] * 2.4, 1.8, 1.8, mat=MC(col, 0.1), group='tank', over=())
        cv.capsule(c + sk['up'] * 2.6, c + sk['up'] * 1.6, 1.0, 1.0, mat=MC('#3c3a44'), group='tankc', over=('tank',))
    return f
