import math, numpy as np
from chars import BASE, keys, ss
TAU = 2 * math.pi
STATES = [('idle', 8), ('walk', 8), ('run', 8), ('attack', 8), ('skill', 8), ('hit', 4), ('death', 8), ('dodge', 6)]
LOOP = {'idle', 'walk', 'run'}

# 직업별 대기 자세 (무기 잡는 법)
STANCE = {
    'guardian': dict(la=0.9, lb=0.25, le=0.9, ra=0.35, rb=0.3, re=0.6, w1=(0.15, 0.85, 0.5)),
    'alchemist': dict(la=0.5, lb=0.2, le=0.9, ra=0.45, rb=0.25, re=1.0),
    'swordsman': dict(la=0.3, lb=0.35, le=0.4, ra=0.3, rb=0.35, re=0.4, w1=(-0.25, -0.55, 0.8), w2=(0.25, -0.55, 0.8), lean=0.08),
    'mancer': dict(la=0.35, lb=0.25, le=0.9, ra=0.5, rb=0.15, re=0.9, w1=(0.05, 1.0, 0.12)),
}
def q0(cls):
    q = dict(BASE); q.update(STANCE[cls]); return q

def gait(q, p, amp, kn, lean, arm, armE, bounce=0.0):
    for s, off in (('l', 0), ('r', math.pi)):
        ph = TAU * p + off
        q[s + 'th'] = amp * math.sin(ph); q[s + 'kn'] = 0.12 + kn * max(0, math.cos(ph))
    q['lean'] = lean; q['twist'] = 0.1 * amp * math.sin(TAU * p)
    q['drop'] = -bounce * max(0, math.sin(2 * TAU * p))
    q['cape'] = min(1, amp * 0.9) + 0.1 * math.sin(2 * TAU * p)
    return q

def pose(cls, st, f, n):
    t = f / n if st in LOOP else f / max(1, n - 1)
    q = q0(cls)
    if st == 'idle':
        b = math.sin(TAU * t); q['drop'] = 0.35 + 0.35 * b
        for s in 'lr': q[s + 'kn'] = 0.18 + 0.08 * b; q[s + 'a'] = q[s + 'a'] + 0.05 * math.sin(TAU * t + (s == 'r'))
        q['hp'] = 0.04 * math.sin(TAU * t + 1); q['cape'] = 0.12 + 0.08 * math.sin(TAU * t)
        if cls == 'mancer': q['glow'] = 0.15 + 0.1 * (1 + b)
    elif st in ('walk', 'run'):
        run = st == 'run'
        gait(q, t, 0.78 if run else 0.48, 1.25 if run else 0.7, 0.22 if run else 0.06, 0, 0, bounce=1.4 if run else 0)
        sw = (0.75 if run else 0.4) * math.sin(TAU * t)
        if cls in ('alchemist', 'mancer') or (cls == 'swordsman'):
            q['la'] = (0.2 if cls != 'swordsman' else 0.2) - sw; q['ra'] = 0.2 + sw
            if run: q['le'] = q['re'] = 1.3
            if cls == 'mancer': q['ra'] = 0.5 + 0.3 * sw; q['re'] = 0.9
            if cls == 'swordsman' and run: q['w1'] = (-0.2, -0.3, -1.0); q['w2'] = (0.2, -0.3, -1.0); q['la'] = -0.5 - 0.3 * sw; q['ra'] = -0.5 + 0.3 * sw; q['le'] = q['re'] = 0.5
        else:
            q['ra'] = 0.3 + sw; q['la'] = 0.9 - 0.2 * sw
        if cls == 'guardian' and run: q['lean'] = 0.26
    elif st == 'attack':
        if cls == 'guardian':  # 큰 내려베기
            K = [(0, dict(ra=0.4, rb=0.3, re=0.6, w1=(0.15, 0.85, 0.5), twist=0, lean=0.05)),
                 (0.3, dict(ra=2.7, rb=0.5, re=0.4, w1=(0.2, 0.7, -0.7), twist=0.5, lean=-0.12, drop=0.3)),
                 (0.5, dict(ra=0.9, rb=0.1, re=0.2, w1=(-0.4, -0.3, 1.0), twist=-0.55, lean=0.32, drop=1.6, lth=0.5, lkn=0.6, rth=-0.4)),
                 (0.75, dict(ra=0.5, rb=0.2, re=0.3, w1=(-0.5, -0.7, 0.6), twist=-0.4, lean=0.25, drop=1.2, lth=0.45, lkn=0.5, rth=-0.35)),
                 (1, dict(ra=0.4, rb=0.3, re=0.6, w1=(0.15, 0.85, 0.5), twist=0, lean=0.05))]
        elif cls == 'swordsman':  # X자 쌍검 베기
            K = [(0, dict(ra=0.3, la=0.3, w1=(-0.25, -0.55, 0.8), w2=(0.25, -0.55, 0.8), twist=0, lean=0.08)),
                 (0.28, dict(ra=2.4, rb=0.9, re=0.5, la=2.4, lb=0.9, le=0.5, w1=(-0.8, 0.6, -0.3), w2=(0.8, 0.6, -0.3), lean=-0.1, drop=0.5, twist=0)),
                 (0.48, dict(ra=1.2, rb=-0.2, re=0.1, la=1.2, lb=-0.2, le=0.1, w1=(0.9, -0.3, 0.8), w2=(-0.9, -0.3, 0.8), lean=0.35, drop=2.0, fwd=2.5, lth=0.6, lkn=0.7, rth=-0.5)),
                 (0.7, dict(ra=0.6, rb=0.5, re=0.2, la=0.6, lb=0.5, le=0.2, w1=(0.6, -0.8, 0.4), w2=(-0.6, -0.8, 0.4), lean=0.3, drop=1.6, fwd=2.5, lth=0.5, lkn=0.6, rth=-0.45)),
                 (1, dict(ra=0.3, la=0.3, w1=(-0.25, -0.55, 0.8), w2=(0.25, -0.55, 0.8), twist=0, lean=0.08))]
        elif cls == 'alchemist':  # 약병 던지기
            K = [(0, dict(ra=0.45, rb=0.25, re=1.0, twist=0, throw=-1)),
                 (0.35, dict(ra=-0.6, rb=0.5, re=2.0, twist=0.7, lean=-0.15, drop=0.6, lth=0.35, rth=-0.3, throw=-1)),
                 (0.5, dict(ra=2.2, rb=0.2, re=0.3, twist=-0.5, lean=0.25, drop=1.0, lth=0.4, lkn=0.4, rth=-0.4, throw=0.0)),
                 (0.75, dict(ra=1.4, rb=0.1, re=0.2, twist=-0.35, lean=0.2, drop=0.6, throw=0.7)),
                 (1, dict(ra=0.45, rb=0.25, re=1.0, twist=0, throw=1.0))]
        else:  # 균사술사: 지팡이 내려찍기
            K = [(0, dict(ra=0.5, re=0.9, w1=(0.05, 1.0, 0.12), lean=0)),
                 (0.35, dict(ra=2.5, rb=0.2, re=0.3, la=1.5, le=0.4, w1=(0.0, 0.7, -0.7), lean=-0.15, drop=0.2, glow=0.4)),
                 (0.55, dict(ra=1.1, rb=0.1, re=0.1, la=1.0, le=0.3, w1=(0.0, -0.6, 1.0), lean=0.35, drop=1.8, lth=0.5, lkn=0.6, rth=-0.4, glow=0.8)),
                 (0.8, dict(ra=0.9, re=0.3, la=0.7, w1=(0.0, -0.4, 1.0), lean=0.25, drop=1.2, glow=0.3)),
                 (1, dict(ra=0.5, re=0.9, w1=(0.05, 1.0, 0.12), lean=0))]
        u = keys(t, K)
        if cls == 'alchemist' and t >= 0.5: u['throw'] = min(1.0, (t - 0.5) / 0.5 * 1.2)
        elif cls == 'alchemist': u['throw'] = -1
        q.update(u)
    elif st == 'skill':  # 두 팔을 모아 힘을 끌어올린 뒤 내뻗기
        K = [(0, dict(la=q['la'], ra=q['ra'], glow=0.0)),
             (0.4, dict(la=2.2, lb=0.6, le=0.6, ra=2.2, rb=0.6, re=0.6, lean=-0.15, drop=0.2, glow=0.6, hp=-0.15)),
             (0.65, dict(la=1.5, lb=0.05, le=0.05, ra=1.5, rb=0.05, re=0.05, lean=0.22, drop=1.2, fwd=1.0, glow=1.0, lth=0.4, lkn=0.4, rth=-0.35)),
             (1, dict(la=q['la'], ra=q['ra'], glow=0.0))]
        q.update(keys(t, K))
        if cls == 'guardian': q['w1'] = (0.0, 1.0, 0.2)
        if cls == 'mancer': q['w1'] = (0.0, 1.0, 0.25 + 0.3 * q['glow'])
    elif st == 'hit':
        k = [0.6, 1.0, 0.7, 0.3][f]
        q['lean'] = -0.35 * k; q['hp'] = -0.35 * k; q['drop'] = 0.8 * k; q['fwd'] = -1.4 * k
        q['la'] += -0.4 * k; q['ra'] += -0.4 * k; q['lb'] += 0.4 * k; q['rb'] += 0.4 * k
        q['lth'] = 0.25 * k; q['rth'] = -0.3 * k; q['lkn'] = q['rkn'] = 0.3 + 0.3 * k; q['twist'] = 0.2 * k
    elif st == 'death':
        a = ss(t / 0.45); b = ss((t - 0.35) / 0.65)
        q['lkn'] = q['rkn'] = 0.2 + 1.5 * a; q['lth'] = q['rth'] = 0.7 * a; q['drop'] = 6 * a
        q['lean'] = 0.4 * a - 0.2 * b; q['hp'] = 0.3 * a
        q['la'] = 0.2 + 0.5 * a - 0.7 * b; q['ra'] = 0.2 + 0.4 * a - 0.8 * b; q['lb'] = 0.3 + 0.8 * b; q['rb'] = 0.3 + 0.9 * b; q['le'] = q['re'] = 0.3
        q['fall'] = 1.42 * b; q['roll'] = 0.0
        if b > 0: q['lth'] = q['rth'] = 0.7 * a * (1 - b) + 0.1; q['lkn'] = (0.2 + 1.5 * a) * (1 - 0.7 * b); q['rkn'] = q['lkn'] * 0.8
    elif st == 'dodge':  # 낮게 몸을 숙여 앞으로 미끄러지듯 회피
        K = [(0, dict(lean=0.1, drop=0.5)),
             (0.25, dict(lean=0.55, drop=4.0, lth=0.9, lkn=1.4, rth=-0.6, rkn=0.4, la=-0.6, ra=-0.6, le=0.3, re=0.3, fwd=1.5, cape=1.0)),
             (0.6, dict(lean=0.7, drop=5.0, lth=1.1, lkn=1.6, rth=-0.9, rkn=0.2, la=-0.9, ra=-0.9, le=0.2, re=0.2, fwd=3.5, cape=1.0)),
             (1, dict(lean=0.08, drop=0.5, fwd=0.0, cape=0.2))]
        q.update(keys(t, K))
    return q
