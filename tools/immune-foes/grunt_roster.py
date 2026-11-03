# 적 60종 의인화 설정: 세력(f), 머리, 등 장식, 무기, 이동 방식, 공격 자세
import math
from grunts import *

A = 1.5
BASE = dict(tilt=0.1, head=0.0, fF=(2.4, -A), fB=(-2.2, -A), armB=(0.3, 0.9), armF=(0.9, 0.9))


def mv_walk(n=6, run=False):
    src = HA.run(10); out = []
    for i in range(n):
        p = dict(src[int(i * 10 / n)])
        s_ = 1.0 if run else 0.7
        p['fF'] = (p['fF'][0] * s_ * 0.8, -A + (p['fF'][1] + A) * s_ * 0.8); p['fB'] = (p['fB'][0] * s_ * 0.8, -A + (p['fB'][1] + A) * s_ * 0.8)
        p['tilt'] = p['tilt'] * (1.0 if run else 0.55); p['y'] = p['y'] * 0.7
        p['armF'] = (0.9 + 0.3 * math.sin(i / n * TAU), 0.9); p['ph'] = i / n
        out.append(p)
    return out


def mv_idle(n=6):
    out = []
    for i in range(n):
        b = (1 - math.cos(TAU * i / n)) / 2
        out.append(dict(BASE, y=0.6 * b, tilt=0.08 + 0.04 * b, armF=(0.9 + 0.1 * b, 0.9), armB=(0.3 + 0.1 * b, 0.9), ph=i / n))
    return out


def mv_hover(n=6):
    out = []
    for i in range(n):
        s_ = math.sin(TAU * i / n)
        out.append(dict(BASE, oy=-2 + s_ * 1.0, tilt=0.12, fF=(1.4, -A - 0.6 + s_ * 0.6), fB=(-1.0, -A - 1.6 - s_ * 0.4), aF=0.5, aB=0.6,
                        armB=(0.6 + 0.2 * s_, 1.0), ph=i / n))
    return out


def at_style(st, fly=False, n=4):
    b = dict(BASE, oy=-2 if fly else 0, fF=(1.4, -A - 0.6) if fly else BASE['fF'], fB=(-1.0, -A - 1.6) if fly else BASE['fB'], aF=0.5 if fly else 0, aB=0.6 if fly else 0)
    K_ = [i / (n - 1) for i in range(n)]
    if st == 'dash':
        return [dict(b, y=1.8, tilt=0.28, armF=(-0.4, 1.3), armB=(0.9, 1.0)), dict(b, y=2.4, tilt=0.34, armF=(-0.6, 1.4), armB=(1.0, 1.0)),
                dict(b, y=1.0, tilt=0.62, armF=(1.5, 0.0), armB=(-1.4, 0.6), fF=(4.0, -A), fB=(-4.4, -A - 1.4), aB=0.6, ph=0.2),
                dict(b, y=1.2, tilt=0.6, armF=(1.6, 0.0), armB=(-1.5, 0.5), fF=(3.4, -A - 1.2), fB=(-3.8, -A), aF=0.4, ph=0.7)]
    if st == 'shoot':
        return [dict(b, armF=(1.25, 0.35)), dict(b, armF=(1.5, 0.05), tilt=0.04), dict(b, armF=(1.6, 0.0), tilt=-0.1, x=-0.6), dict(b, armF=(1.5, 0.1), tilt=0.02)]
    if st == 'lob':
        return [dict(b, armF=(3.2, 0.6), tilt=-0.16, item='gren'), dict(b, armF=(3.5, 0.4), tilt=-0.22, item='gren'),
                dict(b, armF=(2.2, 0.1), tilt=0.1), dict(b, armF=(1.2, 0.2), tilt=0.22)]
    if st == 'slam':
        return [dict(b, armF=(2.9, 0.3), armB=(2.8, 0.3), tilt=-0.15, nowpn=1), dict(b, armF=(3.3, 0.2), armB=(3.2, 0.2), tilt=-0.24, y=-0.4, nowpn=1),
                dict(b, armF=(1.1, 0.2), armB=(1.0, 0.2), tilt=0.42, y=1.6, nowpn=1, fist=True), dict(b, armF=(0.9, 0.3), armB=(0.8, 0.3), tilt=0.38, y=1.8, nowpn=1, fist=True)]
    if st == 'cast':
        return [dict(b, armF=(2.2 + 0.25 * k, 0.6 - 0.2 * k), armB=(2.0 + 0.3 * k, 0.6 - 0.2 * k), tilt=-0.05 - 0.08 * k, head=-0.15 * k, item='gren' if k > 0.3 else None, nowpn=1) for k in K_]
    if st == 'squash':
        return [dict(b, y=0.8 + 1.6 * math.sin(k * math.pi), squash=1 - 0.14 * math.sin(k * math.pi), tilt=0.2, armF=(0.5, 1.4), armB=(0.6, 1.4)) for k in K_]
    if st == 'pounce':
        return [dict(b, y=1.4, tilt=0.3, armF=(0.4, 1.4), armB=(0.4, 1.4)), dict(b, y=2.6, tilt=0.42, armF=(-0.3, 1.2), armB=(-0.2, 1.2)),
                dict(b, y=3.2, tilt=0.5, armF=(-0.6, 1.0), armB=(-0.6, 1.0)),
                dict(b, oy=-3, y=-0.5, tilt=0.4, fF=(2.6, -A - 3.4), fB=(-0.8, -A - 2.6), aF=0.4, aB=0.6, armF=(1.6, 0.1), armB=(1.4, 0.2))]
    if st == 'dive':
        sup = dict(b, oy=-2, tilt=1.25, head=-0.9, fF=(-4.4, -A - 5.4), fB=(-5.0, -A - 4.4), aF=1.2, aB=1.2, armF=(1.55, 0.0), armB=(1.4, 0.1))
        return [dict(b, tilt=-0.2, head=0.1, armF=(-0.6, 1.0), fF=(1.6, -A - 2.6)), dict(b, tilt=-0.28, head=0.12, armF=(-0.8, 0.9), fF=(1.8, -A - 3.0)), sup, dict(sup, ph=0.5, armB=(1.3, 0.2))]
    if st == 'grab':
        return [dict(b, armF=(1.0 + 0.5 * k, 0.6 - 0.5 * k), armB=(0.9 + 0.5 * k, 0.6 - 0.5 * k), tilt=0.1 + 0.18 * k, nowpn=1, fist=k > 0.6) for k in K_]
    if st == 'shield':
        return [dict(b, armF=(1.2, 0.6), tilt=0.06), dict(b, armF=(1.4, 0.2), tilt=0.12, y=0.6), dict(b, armF=(1.6, 0.0), tilt=0.2, x=1.0, y=0.8), dict(b, armF=(1.4, 0.3), tilt=0.1)]
    if st == 'roll':
        return [dict(b, y=-1.0, tilt=0.3, fF=(2.0, -A - 4.0), fB=(0.4, -A - 3.4), aF=0.4, aB=0.5, armF=(1.0, 1.9), armB=(1.2, 1.8), nowpn=1, spin=-i / 4 * TAU) for i in range(4)]
    if st == 'whip':
        ks = [0.0, 0.1, 0.45, 0.85, 1.0, 0.55]
        arms = [(3.2, 0.5), (3.5, 0.3), (2.4, 0.1), (1.6, 0.0), (1.45, 0.0), (1.2, 0.3)]
        return [dict(b, armF=arms[i], whip=ks[i], tilt=-0.12 + 0.4 * ks[i], ph=i / 6) for i in range(6)]
    raise ValueError(st)


S = dict
G = {
    # ----- STAGE 1 세균 (부패 세력) -----
    'ecoli': S(f=1, col='#7a8a48', head=h_rod('#7a8a48', flag=3), wpn='blade', mv='run', at='dash'),
    'staph': S(f=1, col='#a89040', head=h_ball('#a89040', cluster=True), wpn='claw', mv='walk', at='squash', mini=1),
    'strep': S(f=1, col='#6a5a7a', head=h_ball('#6a5a7a', R=4.2), wpn=None, mv='walk', at='squash', K=0.5),
    'salmo': S(f=1, col='#9a5a40', head=h_rod('#9a5a40', flag=4), wpn='syringe', mv='walk', at='lob'),
    'clos': S(f=1, col='#8a7050', head=h_ball('#8a7050', cracks='#4a3a20'), back=b_shell('#5a4a30'), wpn='gun', mv='idle', at='lob'),
    'tb': S(f=1, col='#8a8458', head=h_rod('#8a8458', armor='#55554a'), wpn='shield', mv='walk', at='dash', K=0.78),
    'helico': S(f=1, col='#9a9a48', head=h_rod('#9a9a48'), back=b_flag('#7a7a38', 4), wpn='blade', mv='hover', at='dive', fly=1),
    'botul': S(f=1, col='#7a6040', head=h_ball('#7a6040', lumps=True), back=b_tank('#6a7a30'), wpn='gun', mv='walk', at='cast'),
    'bacil': S(f=1, col='#8a5a6a', head=h_rod('#8a5a6a'), wpn='blade', mv='walk', at='dash', roll=1),
    'pseudo': S(f=1, col='#4a7a68', head=h_rod('#4a7a68', flag=1), wpn='gun', mv='walk', at='shoot'),
    'listeria': S(f=1, col='#9a9050', head=h_rod('#9a9050'), back=b_jet('#ff6030'), wpn='blade', mv='run', at='dash'),
    'vibrio': S(f=1, col='#5a7a8a', head=h_rod('#5a7a8a'), back=b_flag('#3a5a6a', 1), wpn='syringe', mv='hover', at='dive', fly=1),
    'neisseria': S(f=1, col='#9a6a6a', head=h_ball('#9a6a6a', cluster=True), wpn='claw', mv='walk', at='squash'),
    'spiro': S(f=1, col='#7a5a8a', head=h_rod('#7a5a8a', flag=2), wpn='claw', mv='walk', at='pounce'),
    'myco': S(f=1, col='#5a8a7a', head=h_ball('#5a8a7a', lumps=True), back=b_wings('#8a9a70'), wpn=None, mv='hover', at='cast', fly=1, K=0.55),
    'mrsa': S(f=1, col='#a08a30', head=h_ball('#a08a30', cluster=True), back=b_shell('#6a6a70'), wpn='gun', mv='walk', at='cast', K=0.8),
    'anthrax': S(f=1, col='#8a8478', head=h_rod('#8a8478', armor='#5a5650'), back=b_tank('#6a6458'), wpn='gun', mv='idle', at='lob', K=0.75),
    'klebs': S(f=1, col='#5a7a60', head=h_ball('#5a7a60', R=5.2), wpn='shield', mv='walk', at='roll', K=0.78),
    'tetanus': S(f=1, col='#8a6a58', head=h_ball('#c0b090', R=4.4), wpn='blade', mv='walk', at='slam', K=0.75),
    'legion': S(f=1, col='#4a6a7a', head=h_rod('#4a6a7a'), back=b_jet('#80c0ff'), wpn='gun', mv='hover', at='shoot', fly=1),
    # ----- STAGE 2 바이러스 (잿빛 세력) -----
    'flu': S(f=2, col='#8a5060', head=h_ball('#8a5060', spikes=10, knob='#a07080'), back=b_wings('#7a6a7a'), wpn='claw', mv='hover', at='dive', fly=1),
    'phage': S(f=2, col='#7a8090', head=h_phage('#7a8090'), wpn='claw', mv='walk', at='pounce', K=0.75),
    'hiv': S(f=2, col='#8a3a3a', head=h_ball('#8a3a3a', spikes=9, knob='#a05050'), back=b_jet('#ff3048'), wpn='gun', mv='hover', at='shoot', fly=1),
    'corona': S(f=2, col='#8a7040', head=h_ball('#8a7040', spikes=12, knob='#b09050'), back=b_wings('#6a6070'), wpn=None, mv='hover', at='cast', fly=1),
    'rhino': S(f=2, col='#5a7a8a', head=h_ball('#5a7a8a', hexa=True), back=b_wings('#6a6a7a'), wpn=None, mv='hover', at='cast', fly=1, K=0.42),
    'ebola': S(f=2, col='#6a4a6a', head=h_rod('#6a4a6a', flag=2), wpn='whip', mv='walk', at='whip'),
    'infcell': S(f=2, col='#8a7a6a', head=h_ball('#8a7a6a', lumps=True, R=5.4, cracks='#5a2030'), wpn=None, mv='walk', at='cast', K=0.82, TR=(3.8, 4.2)),
    'herpes': S(f=2, col='#7a5a7a', head=h_ball('#7a5a7a', hexa=True), wpn='gun', mv='idle', at='shoot'),
    'adeno': S(f=2, col='#5a7a5a', head=h_ball('#5a7a5a', hexa=True, spikes=6, knob='#7a9a7a'), wpn='claw', mv='walk', at='squash', roll=1),
    'rabies': S(f=2, col='#6a6a72', head=h_bullet('#6a6a72'), wpn='blade', mv='run', at='dash'),
    'noro': S(f=2, col='#6a5a7a', head=h_ball('#6a5a7a', cluster=True), wpn='claw', mv='walk', at='squash', K=0.5),
    'measles': S(f=2, col='#8a4a4a', head=h_ball('#8a4a4a', spikes=12, knob='#b06060'), back=b_wings('#6a5a5a'), wpn=None, mv='hover', at='lob', fly=1),
    'hpv': S(f=2, col='#8a6a60', head=h_ball('#8a6a60', hexa=True), wpn='claw', mv='walk', at='pounce'),
    'zika': S(f=2, col='#4a5a5a', head=h_ball('#4a5a5a', R=4.0), back=b_wings('#9aa0a8'), wpn='syringe', mv='hover', at='dive', fly=1),
    'polio': S(f=2, col='#8a7a40', head=h_ball('#8a7a40', hexa=True), wpn='blade', mv='run', at='dash', K=0.55),
    'hbv': S(f=2, col='#8a6a40', head=h_ball('#8a6a40', spikes=8, knob='#a08050'), back=b_tank('#6a5a40'), wpn=None, mv='walk', at='cast', K=0.75),
    'smallpox': S(f=2, col='#7a6050', head=h_ball('#7a6050', lumps=True, R=5.2), wpn=None, mv='walk', at='lob', K=0.82, TR=(3.8, 4.2)),
    'dengue': S(f=2, col='#4a7a70', head=h_ball('#4a7a70', cracks='#2a4a40'), wpn='blade', mv='run', at='dash', K=0.75),
    'mers': S(f=2, col='#8a5a38', head=h_ball('#8a5a38', spikes=8, knob='#b07a48'), back=b_wings('#6a5a50'), wpn=None, mv='hover', at='cast', fly=1, K=0.75),
    'tmv': S(f=2, col='#6a7a48', head=h_rod('#6a7a48'), back=b_jet('#ff3048'), wpn='gun', mv='hover', at='shoot', fly=1, K=0.75),
    # ----- STAGE 3 종양 (썩은 살 세력) -----
    'tumor': S(f=3, col='#9a5a70', head=h_ball('#9a5a70', lumps=True), wpn='claw', mv='walk', at='squash', mini=1),
    'treg': S(f=3, col='#6a5a8a', head=h_ball('#6a5a8a', spikes=2, spc='#8a2030'), wpn='gun', mv='walk', at='shoot'),
    'mdsc': S(f=3, col='#7a8048', head=h_ball('#7a8048', lumps=True), back=b_jet('#ff8a20'), wpn='gun', mv='hover', at='cast', fly=1),
    'tam': S(f=3, col='#8a5a48', head=h_ball('#8a5a48', lumps=True, R=5.6), wpn='claw', mv='walk', at='grab', K=0.88, TR=(3.8, 4.2)),
    'vessel': S(f=3, col='#9a3048', head=h_vine('#9a3048'), wpn='claw', mv='idle', at='grab', K=1.15, fc=dict(coat='#5a1a28', pants='#3a1018')),
    'meta': S(f=3, col='#a85a78', head=h_ball('#a85a78', spikes=7, spc='#8a4a62'), wpn='claw', mv='run', at='pounce'),
    'pdl1': S(f=3, col='#7a5a9a', head=h_ball('#7a5a9a'), wpn='shield', mv='walk', at='shield'),
    'hypox': S(f=3, col='#5a6a9a', head=h_ball('#5a6a9a', R=5.2), back=b_jet('#ff8a20'), wpn=None, mv='hover', at='cast', fly=1),
    'stem': S(f=3, col='#9a4a80', head=h_ball('#9a4a80', lumps=True, R=5.6), back=b_tank('#5a2a4a'), wpn=None, mv='idle', at='cast', K=0.88, TR=(3.8, 4.2)),
    'exo': S(f=3, col='#6a5a7a', head=h_ball('#8a7a9a', R=4.0), back=b_wings('#8a7a8a'), wpn=None, mv='hover', at='lob', fly=1),
    'ctc': S(f=3, col='#a85a68', head=h_ball('#a85a68'), back=b_jet('#ff8a20'), wpn='blade', mv='hover', at='dive', fly=1),
    'platelet': S(f=3, col='#a89870', head=h_ball('#a89870', R=4.0), wpn='claw', mv='walk', at='grab', K=0.55),
    'lactate': S(f=3, col='#98a858', head=h_ball('#98a858', R=5.2), back=b_jet('#ff8a20'), wpn=None, mv='hover', at='cast', fly=1),
    'mirna': S(f=3, col='#9a5a9a', head=h_rod('#9a5a9a', flag=2), wpn='blade', mv='run', at='dash', K=0.55),
    'zombie': S(f=3, col='#7a7080', head=h_ball('#7a7080', lumps=True, cracks='#2a1a2a'), wpn='claw', mv='walk', at='grab'),
    'caf': S(f=3, col='#9a6048', head=h_rod('#9a6048', flag=3), wpn='gun', mv='walk', at='shoot', K=0.78),
    'p53': S(f=3, col='#7a2a40', head=h_ball('#7a2a40', cracks='#ff8a20'), wpn='gun', mv='walk', at='shoot', K=0.78,
             cycle=['#7a2a40', '#4a2a7a', '#7a5a2a', '#2a6a5a', '#7a2a40', '#4a2a7a']),
    'mdr': S(f=3, col='#5a6a8a', head=h_ball('#5a6a8a', spikes=5, spc='#5a6a8a'), back=b_tank('#4a5a7a'), wpn=None, mv='walk', at='cast', K=0.8),
    'mimic': S(f=3, col='#4a3a5a', head=h_ball('#d8ccb8', R=4.6), wpn='gun', mv='walk', at='shoot', K=0.78),
    'giant': S(f=3, col='#8a4a62', head=h_ball('#8a4a62', lumps=True, R=6.0), wpn=None, mv='walk', at='slam', K=0.95, TR=(4.2, 4.6), PEL=(3.8, 2.4)),
}
for k, v in G.items():
    if 'K' in v: v['K'] = v['K'] * 1.18
    if 'cycle' in v:
        v['heads'] = [h_ball(c, cracks='#ff8a20') for c in v['cycle']]
