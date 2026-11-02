# 주인공 동작 정의: pose(이름, t∈[0,1]) → 자세값
import math, numpy as np
from hero import BASE, ss, lerp
TAU = 2 * math.pi

# (이름, 프레임 수, 반복, 한국어 이름)
ANIMS = [
    ('idle', 8, True, '대기'), ('run', 8, True, '달리기'), ('dash', 6, False, '돌진'), ('blink', 8, False, '세포분열 회피'),
    ('atk1', 6, False, '가로베기'), ('atk2', 6, False, '올려베기'), ('atk3', 8, False, '내려찍기'), ('spin', 8, False, '회전베기'),
    ('leap', 10, False, '도약 강타'), ('cast', 10, False, '유전자 의식'), ('throw', 7, False, '시약 투척'), ('shoot', 6, False, '유전자총 사격'),
    ('hit', 4, False, '피격'), ('death', 10, False, '쓰러짐'), ('spawn', 10, False, '재구성(부활)'),
]
NFR = {a[0]: a[1] for a in ANIMS}
LOOP = {a[0] for a in ANIMS if a[2]}
# 잔상 구간
SMEAR = {'atk1': (0.28, 0.82), 'atk2': (0.28, 0.85), 'atk3': (0.42, 0.78), 'spin': (0.05, 1.0), 'leap': (0.5, 0.78)}
# 색 덮기·분해 (프레임별)
FX = {
    'blink': dict(tint=[0, 0.45, 0.9, 1, 1, 0.9, 0.5, 0], dis=[0, 0.12, 0.5, 0.62, 0.62, 0.5, 0.15, 0]),
    'death': dict(tint=[0, 0, 0, 0, 0, 0, 0.15, 0.45, 0.8, 1], dis=[0, 0, 0, 0, 0, 0, 0.05, 0.3, 0.6, 0.85]),
    'spawn': dict(tint=[1, 1, 0.9, 0.75, 0.55, 0.35, 0.18, 0.06, 0, 0], dis=[0.88, 0.7, 0.5, 0.32, 0.18, 0.08, 0.02, 0, 0, 0]),
}
TINT = '#3cffae'

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

ST = dict(rh=BASE['rh'], lh=BASE['lh'], w=BASE['w'], wb=BASE['wb'], twist=0.0, lean=0.0, drop=0.2, fwd=0.0, two=0.0,
          lth=0.06, lkn=0.14, rth=-0.06, rkn=0.14, hp=0.0, cape=0.12, wauto=0.0, air=0.0)
def S(**kw): d = dict(ST); d.update(kw); return d

def pose(name, t):
    q = dict(BASE)
    if name == 'idle':
        b = math.sin(TAU * t); c = math.cos(TAU * t)
        q.update(drop=0.35 + 0.3 * b, lkn=0.18 + 0.06 * b, rkn=0.18 + 0.06 * b, cape=0.1 + 0.05 * c, hp=0.03 * c)
        q['rh'] = (-8.4, 4.4 + 0.35 * b, 2.6); q['lh'] = (6.9, 1.9 + 0.3 * b, 0.9 + 0.2 * c)
        q['w'] = (-0.3 + 0.03 * c, 1.0, 0.0 + 0.02 * b)
    elif name == 'run':
        ph = TAU * t
        for s, off in (('l', 0), ('r', math.pi)):
            q[s + 'th'] = 0.85 * math.sin(ph + off); q[s + 'kn'] = 0.15 + 1.35 * max(0, math.cos(ph + off))
            q[s + 'ft'] = 0.35 * max(0, -math.sin(ph + off))
        q.update(lean=0.3, twist=0.12 * math.sin(ph), drop=0.6 - 1.4 * max(0, math.sin(2 * ph)), cape=0.95 + 0.15 * math.sin(2 * ph))
        q['lh'] = (6.6, 4.2 + 1.2 * max(0, math.sin(-ph)), -3.8 * math.sin(ph))
        q['rh'] = (-7.6, 4.8, -0.8 + 2.2 * math.sin(ph))
        q['w'] = (-0.25, 0.42, -1.0); q['wb'] = (0.1, 1.0, 0.15)
    elif name in ('dash', 'blink'):
        K = [(0, S(drop=2.0, lean=0.3, lth=0.35, lkn=0.9, rth=-0.1, rkn=0.7, rh=(-7.5, 6, -3), lh=(7, 5, -3), w=(-0.2, 0.3, -1), wb=(0, 1, 0), cape=0.3)),
             (0.3, S(drop=2.6, lean=0.55, fwd=3.0, lth=0.95, lkn=0.35, rth=-0.95, rkn=0.95, rh=(-7.5, 7, -6), lh=(7.5, 7, -6), w=(-0.15, 0.2, -1), wb=(0, 1, 0), cape=1.45)),
             (0.65, S(drop=2.2, lean=0.5, fwd=4.0, lth=0.9, lkn=0.45, rth=-0.85, rkn=1.0, rh=(-7.5, 7, -6), lh=(7.5, 7, -5), w=(-0.15, 0.2, -1), wb=(0, 1, 0), cape=1.5)),
             (1.0, S(drop=1.0, lean=0.2, fwd=1.0, lth=0.3, lkn=0.6, rth=-0.2, rkn=0.4, cape=0.6))]
        q.update(keys(t, K))
    elif name == 'atk1':   # 오른쪽 뒤에서 앞을 지나 왼쪽으로 가로베기
        K = [(0, S()),
             (0.24, S(twist=-0.8, drop=1.2, lean=0.05, rh=(-8.0, 7.0, -3.0), w=(-0.8, 0.1, -0.6), two=1.0, g2=-7.0, lth=0.15, rth=-0.3, wauto=1.0, cape=0.3)),
             (0.44, S(twist=-0.1, drop=2.0, lean=0.25, fwd=2.0, rh=(-4.0, 6.5, 8.0), w=(-0.5, -0.05, 0.86), two=1.0, g2=-7.0, lth=0.55, lkn=0.5, rth=-0.45, rkn=0.4, wauto=1.0, cape=0.6)),
             (0.62, S(twist=0.6, drop=2.0, lean=0.25, fwd=2.5, rh=(3.0, 6.5, 8.0), w=(0.75, -0.05, 0.65), two=1.0, g2=-7.0, lth=0.55, lkn=0.5, rth=-0.45, rkn=0.4, wauto=1.0, cape=0.7)),
             (0.8, S(twist=0.75, drop=1.6, lean=0.2, fwd=2.5, rh=(6.0, 6.0, 5.0), w=(0.95, 0.0, 0.1), two=0.6, g2=-7.0, lth=0.5, lkn=0.45, rth=-0.4, rkn=0.4, wauto=1.0, cape=0.5)),
             (1.0, S())]
        q.update(keys(t, K)); q['wax'] = (0, 1, 0); q['wsg'] = 1
    elif name == 'atk2':   # 왼쪽 아래에서 오른쪽 위로 올려베기
        K = [(0, S()),
             (0.24, S(twist=0.8, drop=1.4, rh=(4.0, 4.0, 4.0), w=(0.85, -0.35, 0.3), two=1.0, g2=-6.0, lth=0.2, rth=-0.2, wauto=1.0, cape=0.3)),
             (0.44, S(twist=0.2, drop=1.8, lean=0.2, fwd=1.8, rh=(-1.0, 7.0, 8.5), w=(-0.1, 0.25, 1.0), two=1.0, g2=-6.0, lth=0.5, lkn=0.45, rth=-0.4, rkn=0.35, wauto=1.0, cape=0.6)),
             (0.62, S(twist=-0.5, drop=1.2, lean=0.05, fwd=2.0, rh=(-7.0, 10.0, 5.0), w=(-0.8, 0.5, 0.3), two=0.7, g2=-6.0, lth=0.5, lkn=0.4, rth=-0.4, rkn=0.35, wauto=1.0, cape=0.6)),
             (0.8, S(twist=-0.6, drop=0.8, lean=-0.05, fwd=1.8, rh=(-8.0, 12.0, 1.0), w=(-0.7, 0.7, -0.2), two=0.2, lth=0.4, lkn=0.35, rth=-0.3, wauto=1.0, cape=0.4)),
             (1.0, S())]
        q.update(keys(t, K)); q['wax'] = (0.0, 0.9, -0.4); q['wsg'] = -1
    elif name == 'atk3':   # 머리 위로 들어 내려찍기
        K = [(0, S()),
             (0.28, S(lean=-0.2, drop=0.5, hp=-0.15, rh=(-2.0, 15.5, 0.0), w=(0.0, 0.45, -1.0), wb=(0, 1, 0.3), two=1.0, g2=-6.0, lth=0.1, rth=-0.25, cape=0.2)),
             (0.42, S(lean=-0.22, drop=0.4, hp=-0.15, rh=(-2.0, 16.0, -1.0), w=(0.0, 0.3, -1.0), wb=(0, 1, 0.3), two=1.0, g2=-6.0, lth=0.1, rth=-0.25, wauto=1.0, cape=0.2)),
             (0.58, S(lean=0.45, drop=3.5, fwd=3.0, rh=(-1.0, 5.0, 9.0), w=(0.0, -0.55, 1.0), two=1.0, g2=-6.0, lth=0.7, lkn=0.9, rth=-0.5, rkn=0.6, wauto=1.0, cape=0.8)),
             (0.78, S(lean=0.45, drop=3.6, fwd=3.0, rh=(-1.0, 4.8, 9.0), w=(0.0, -0.58, 1.0), two=1.0, g2=-6.0, lth=0.7, lkn=0.9, rth=-0.5, rkn=0.6, wauto=1.0, cape=0.5)),
             (1.0, S())]
        q.update(keys(t, K)); q['wax'] = (1, 0, 0); q['wsg'] = 1
    elif name == 'spin':
        K = [(0, S(drop=1.0, twist=-0.4, rh=(-8.5, 7, 2), w=(-0.95, -0.05, 0.25), lh=(8.5, 7, 0), wauto=1.0, cape=0.2, flare=0.0)),
             (0.15, S(drop=1.6, rh=(-8.5, 7, 3), w=(-0.97, -0.05, 0.2), lh=(8.5, 7.5, 0), wauto=1.0, cape=0.1, flare=0.5)),
             (0.85, S(drop=1.6, rh=(-8.5, 7, 3), w=(-0.97, -0.05, 0.2), lh=(8.5, 7.5, 0), wauto=1.0, cape=0.1, flare=0.6)),
             (1.0, S(drop=0.6, cape=0.15, flare=0.0))]
        q.update(keys(t, K)); q['wax'] = (0, 1, 0); q['wsg'] = 1
        q['spin'] = TAU * (0.1 * t + 0.95 * ss((t - 0.05) / 0.9))
    elif name == 'leap':
        K = [(0, S()),
             (0.12, S(drop=3.0, lean=0.3, lth=0.5, lkn=1.2, rth=0.4, rkn=1.2, rh=(-6, 5, 2), cape=0.2)),
             (0.3, S(air=17, lean=-0.15, lth=0.6, lkn=1.4, rth=0.1, rkn=1.2, rh=(-2, 16, 0), w=(0, 0.5, -1), wb=(0, 1, 0.3), two=1.0, g2=-6.0, hp=-0.12, cape=-0.4)),
             (0.45, S(air=22, lean=-0.18, lth=0.55, lkn=1.5, rth=0.15, rkn=1.3, rh=(-2, 16.5, -1), w=(0, 0.3, -1), wb=(0, 1, 0.3), two=1.0, g2=-6.0, hp=-0.12, cape=-0.5, wauto=1.0)),
             (0.6, S(air=6, lean=0.5, drop=2.5, fwd=2.0, rh=(-1, 5, 9), w=(0, -0.6, 1), two=1.0, g2=-6.0, lth=0.7, lkn=1.1, rth=-0.1, rkn=0.9, wauto=1.0, cape=-0.2)),
             (0.72, S(air=0, lean=0.55, drop=4.5, fwd=3.0, rh=(-1, 4.5, 9.5), w=(0, -0.62, 1), two=1.0, g2=-6.0, lth=0.9, lkn=1.4, rth=-0.25, rkn=1.0, wauto=1.0, cape=0.9)),
             (0.86, S(air=0, lean=0.5, drop=4.3, fwd=3.0, rh=(-1, 4.5, 9.5), w=(0, -0.62, 1), two=1.0, g2=-6.0, lth=0.9, lkn=1.4, rth=-0.25, rkn=1.0, wauto=1.0, cape=0.4)),
             (1.0, S())]
        q.update(keys(t, K)); q['wax'] = (1, 0, 0); q['wsg'] = 1
    elif name == 'cast':
        rest = dict(rh=(-6.9, 1.8, 0.8), lh=(6.9, 1.8, 0.8))
        K = [(0, S(**rest, glow=0.0)),
             (0.18, S(rh=(-2.5, 9.0, 6.0), lh=(2.5, 9.0, 6.0), drop=0.6, glow=0.3, cape=0.15)),
             (0.4, S(rh=(-5.0, -1.0, 7.5), lh=(5.0, -1.0, 7.5), drop=4.2, lean=0.4, lth=0.6, lkn=1.4, rth=-0.2, rkn=1.3, glow=0.55, cape=0.1)),
             (0.68, S(rh=(-7.0, 23.5, 2.5), lh=(7.0, 23.5, 2.5), drop=0.0, lean=-0.15, hp=-0.3, air=1.2, glow=1.0, cape=-0.45)),
             (0.85, S(rh=(-7.5, 23.5, 2.0), lh=(7.5, 23.5, 2.0), drop=0.0, lean=-0.15, hp=-0.3, air=1.0, glow=1.0, cape=-0.4)),
             (1.0, S(**rest, glow=0.0))]
        q.update(keys(t, K)); q['stow'] = 1.0
    elif name == 'throw':
        K = [(0, S(lh=(5, 6, 4))),
             (0.3, S(twist=0.55, lean=-0.1, drop=0.8, lh=(8.5, 11, -5), lth=-0.1, rth=0.25)),
             (0.5, S(twist=-0.5, lean=0.3, drop=1.5, lh=(3, 10, 9), lth=0.45, lkn=0.4, rth=-0.35)),
             (0.75, S(twist=-0.4, lean=0.25, drop=1.2, lh=(0, 4, 8), lth=0.4, lkn=0.35, rth=-0.3)),
             (1.0, S(lh=(5, 6, 4)))]
        q.update(keys(t, K)); q['flask'] = 1.0 if t < 0.45 or t > 0.98 else 0.0
    elif name == 'shoot':
        f = int(round(t * 5))
        rec = [0, 1, 0.6, 0.25, 0.08, 0][f]
        q.update(S(rh=(-2.5, 10.2 + 0.9 * rec, 9.2 - 1.6 * rec), lh=(-0.5, 9.6 + 0.8 * rec, 8.0 - 1.4 * rec), two=0.0, lean=0.05 - 0.1 * rec, drop=0.8, twist=-0.15,
                   lth=0.25, rth=-0.25, hp=-0.04 * rec))
        q['stow'] = 1.0; q['gun'] = 1.0; q['flash'] = [0, 1, 0.45, 0, 0, 0][f]
    elif name == 'hit':
        k = [0.6, 1.0, 0.7, 0.3][min(3, int(round(t * 3)))]
        q.update(S(lean=-0.35 * k, hp=-0.3 * k, drop=0.8 * k + 0.2, fwd=-1.5 * k, cape=0.12 + 0.5 * k, twist=0.2 * k,
                   rh=(-8.4, 4.4 + 2 * k, 2.6 - 2 * k), lh=(7.5, 3 + 3 * k, -1.5 * k), lth=0.25 * k, rth=-0.3 * k, lkn=0.3 + 0.3 * k, rkn=0.3 + 0.3 * k))
    elif name == 'death':
        a = ss(t / 0.45); b = ss((t - 0.35) / 0.45)
        q.update(S(lkn=0.2 + 1.5 * a, rkn=0.2 + 1.4 * a, lth=0.7 * a * (1 - b) + 0.1 * b, rth=0.6 * a * (1 - b) + 0.05 * b, drop=6 * a,
                   lean=0.4 * a - 0.3 * b, hp=0.3 * a - 0.2 * b, cape=0.1 + 0.4 * b,
                   rh=(-8.0 - 2 * b, 3.0 + 6 * b, 2.6 + 2 * a), lh=(7.0 + 2 * b, 2.0 + 6 * b, 1.0 + 2 * a), w=(-0.12 - 0.8 * b, 1.0 - 0.6 * b, 0.05 + 0.4 * a)))
        if b > 0: q['lkn'] = (0.2 + 1.5 * a) * (1 - 0.7 * b); q['rkn'] = q['lkn'] * 0.8
        q['fall'] = 1.42 * b
    elif name == 'spawn':
        a = ss(t / 0.8)
        q.update(S(drop=5.0 * (1 - a) + 0.2, lean=0.45 * (1 - a), lth=0.6 * (1 - a), lkn=1.4 * (1 - a) + 0.14, rth=-0.2 * (1 - a), rkn=1.3 * (1 - a) + 0.14,
                   hp=0.35 * (1 - a), cape=0.12 + 0.5 * (1 - a) * math.sin(t * 6),
                   lh=(7 + 1.5 * (1 - a), 1.8 + 4 * (1 - a), 0.8 + 3 * (1 - a)), rh=(-8.4, 4.4, 2.6)))
    return q
