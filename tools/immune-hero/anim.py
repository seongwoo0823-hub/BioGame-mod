# 호중구 애니메이션 정의: 상태마다 포즈 목록 + 프레임 길이 + 2차 움직임 바람 + 기본 표정
import math
import numpy as np
TAU = 2 * math.pi
A = 1.5   # 발목 높이


def sm(t): return t * t * (3 - 2 * t)


def mixp(a, b, t):
    out = dict(a)
    for k, v in b.items():
        if k in a and isinstance(v, (int, float)) and isinstance(a[k], (int, float)): out[k] = a[k] + (v - a[k]) * t
        elif k in a and isinstance(v, tuple) and isinstance(a[k], tuple): out[k] = tuple(x + (y - x) * t for x, y in zip(a[k], v))
        else: out[k] = v if t >= 0.5 or k not in a else a[k]
    return out


def keys(kf, n, loop=False):
    """kf: [(시각 0..1, 포즈)], 부드러운 보간으로 n장"""
    out = []
    for i in range(n):
        t = i / n if loop else (i / (n - 1) if n > 1 else 0)
        for j in range(len(kf) - 1):
            if kf[j][0] <= t <= kf[j + 1][0]:
                u = (t - kf[j][0]) / max(1e-6, kf[j + 1][0] - kf[j][0]); out.append(mixp(kf[j][1], kf[j + 1][1], sm(u))); break
        else: out.append(dict(kf[-1][1]))
    return out


BASE = dict(tilt=0.08, head=0.0, fF=(2.6, -A), fB=(-2.3, -A), armB=(0.35, 0.95))


def idle(n=8):
    fr = []
    for i in range(n):
        ph = i / n; b = (1 - math.cos(TAU * ph)) / 2
        fr.append(dict(BASE, y=1.0 * b, tilt=0.08 + 0.035 * b, head=0.035 * math.sin(TAU * (ph - 0.2)) - 0.02,
                       armB=(0.38 + 0.1 * b, 1.0 + 0.15 * b), aF=0.0, aB=0.0))
    return fr


def tired(n=8):
    fr = []
    for i in range(n):
        ph = i / n; b = (1 - math.cos(TAU * ph)) / 2
        fr.append(dict(BASE, y=1.8 + 0.7 * b, tilt=0.3 + 0.06 * b, head=0.12 + 0.08 * math.sin(TAU * (ph - 0.15)),
                       fF=(2.9, -A), fB=(-2.6, -A), armB=(0.05 + 0.04 * b, 0.15)))
    return fr


def bored():
    i0 = dict(BASE, armF=(0.3, 0.6), sling=True)
    up = dict(i0, armB=(3.05, 0.25), armF=(2.85, 0.3), tilt=-0.12, head=-0.32, y=-0.6, aF=-0.25, aB=-0.25, fist=True)
    up2 = dict(up, tilt=-0.2, head=-0.42, y=-0.9, armB=(3.2, 0.15), armF=(3.0, 0.15))
    dip = dict(i0, y=1.8, tilt=0.22, armB=(-0.6, 0.6), armF=(-0.5, 0.7))
    hop = dict(i0, oy=-6.0, y=-0.4, tilt=0.0, head=-0.1, armB=(2.4, 0.5), armF=(2.2, 0.6), fF=(2.2, -A - 0.6), fB=(-1.8, -A - 0.6), aF=0.45, aB=0.5, fist=True)
    land = dict(i0, y=1.4, tilt=0.16, armB=(0.6, 1.2), armF=(0.6, 1.0))
    kf = [(0, i0), (0.12, up), (0.38, up2), (0.5, i0), (0.6, dip), (0.72, hop), (0.86, land), (1.0, i0)]
    return keys(kf, 16)


def run(n=10):
    fr = []
    for i in range(n):
        ph = i / n
        def foot(q):
            q %= 1
            if q < 0.42:
                s = q / 0.42; return (4.6 - 8.8 * s, -A), 0.0 - 0.15 * s
            s = (q - 0.42) / 0.58; e = sm(s)
            return (-4.2 + 8.8 * e, -A - 3.8 * math.sin(math.pi * s ** 0.75)), 0.55 * math.sin(math.pi * s) - 0.1
        fF, aF = foot(ph); fB, aB = foot(ph + 0.5)
        y = 0.6 * math.cos(2 * TAU * (ph - 0.08)) + 0.2
        sw = math.sin(TAU * (ph + 0.05))
        fr.append(dict(BASE, y=y, tilt=0.24 + 0.04 * math.cos(2 * TAU * ph), head=-0.1 + 0.03 * math.cos(2 * TAU * (ph - 0.15)),
                       fF=fF, fB=fB, aF=aF, aB=aB, armB=(0.25 - 1.05 * sw, 1.25 + 0.3 * sw)))
    return fr


def crouch(n=4):
    fr = []
    for i in range(n):
        b = (1 - math.cos(TAU * i / n)) / 2
        fr.append(dict(BASE, y=4.4 + 0.35 * b, tilt=0.32 + 0.03 * b, head=-0.26, fF=(3.3, -A), fB=(-3.4, -A + 0.1), aB=0.55,
                       armB=(0.6, 1.4)))
    return fr


def crawl(n=6):
    fr = []
    for i in range(n):
        ph = i / n
        def foot(q):
            q %= 1
            if q < 0.5: s = q / 0.5; return (2.6 - 4.6 * s, -A), 0.0
            s = (q - 0.5) / 0.5; return (-2.0 + 4.6 * sm(s), -A - 1.6 * math.sin(math.pi * s)), 0.3 * math.sin(math.pi * s)
        fF, aF = foot(ph); fB, aB = foot(ph + 0.5)
        fr.append(dict(BASE, y=4.2 + 0.3 * math.cos(2 * TAU * ph), tilt=0.34, head=-0.28, fF=fF, fB=fB, aF=aF, aB=aB,
                       armB=(0.7 - 0.3 * math.sin(TAU * ph), 1.3)))
    return fr


def rise():
    a = dict(BASE, y=-0.5, tilt=0.04, head=-0.06, fF=(2.6, -A - 3.6), fB=(-1.4, -A + 0.4), aF=0.2, aB=0.7, armB=(-0.7, 0.9))
    return [a, dict(a, fF=(2.8, -A - 3.9), armB=(-0.85, 0.8), head=-0.08)]


def apex():
    a = dict(BASE, y=-0.6, tilt=0.14, head=0.0, fF=(2.6, -A - 3.4), fB=(-0.6, -A - 2.8), aF=0.35, aB=0.6, armB=(0.6, 1.3))
    return [a, dict(a, fB=(-0.4, -A - 3.1), armB=(0.8, 1.3))]


def fall(n=4):
    fr = []
    for i in range(n):
        s = math.sin(TAU * i / n)
        fr.append(dict(BASE, y=-0.4, tilt=0.06 + 0.02 * s, head=0.06, fF=(2.2 + 0.4 * s, -A - 0.8), fB=(-1.8 - 0.3 * s, -A - 2.0 + 0.4 * s),
                       aF=0.3, aB=0.5, armB=(-2.0 + 0.25 * s, 0.5)))
    return fr


def land():
    return [dict(BASE, y=3.0, squash=0.88, tilt=0.26, head=-0.12, fF=(3.0, -A), fB=(-2.6, -A), armB=(0.9, 1.0)),
            dict(BASE, y=1.7, squash=0.95, tilt=0.18, head=-0.06, fF=(2.9, -A), fB=(-2.5, -A), armB=(0.6, 1.0)),
            dict(BASE, y=0.6, tilt=0.11, fF=(2.7, -A), fB=(-2.4, -A), armB=(0.42, 1.0))]


def skid():
    a = dict(BASE, y=1.6, tilt=-0.22, head=0.06, fF=(5.0, -A), fB=(-1.2, -A), aF=-0.35, aB=0.2, armB=(-0.9, 0.6))
    return [a, dict(a, y=1.3, tilt=-0.16, armB=(-0.7, 0.7))]


def hurt():
    a = dict(BASE, y=0.4, x=-0.6, tilt=-0.38, head=-0.35, fF=(3.8, -A - 2.0), fB=(-2.2, -A), aF=0.5, armB=(-1.6, 0.4))
    b = dict(a, tilt=-0.28, head=-0.22, x=-0.4, fF=(3.4, -A - 1.0))
    c = dict(BASE, y=0.8, tilt=-0.08, head=-0.06, fF=(3.0, -A), armB=(-0.3, 0.8))
    return [a, b, c]


def die():
    s = dict(BASE, sling=True, tilt=-0.45, head=-0.5, x=-0.6, fF=(3.6, -A - 2.6), fB=(-2.4, -A - 0.6), aF=0.6, aB=0.4,
             armB=(-2.2, 0.3), armF=(-1.4, 0.3))
    fr = [s, dict(s, tilt=-0.55, head=-0.6, armB=(-2.5, 0.2), armF=(-1.9, 0.2))]
    for i in range(8):
        k = (i + 1) / 8
        fr.append(dict(s, tilt=-0.3, head=-0.3, armB=(-2.6 + 0.4 * math.sin(i), 0.3), armF=(-2.0 + 0.5 * math.cos(i), 0.4),
                       fF=(3.4, -A - 2.8), fB=(-2.6, -A - 1.0), spin=-k * TAU * 1.0))
    return fr


def win(n=12):
    hip = dict(BASE, sling=True, armB=(-0.75, -1.9), fist=True)
    fr = []
    for i in range(n):
        t = i / n
        if t < 0.34:
            u = sm(t / 0.34); fr.append(mixp(dict(hip, armF=(0.4, 1.2), y=0.6, tilt=0.12, head=0.0), dict(hip, armF=(2.95, 0.35), y=-0.8, tilt=-0.12, head=-0.25, aF=-0.2, aB=-0.2), u))
        else:
            u = (t - 0.34) / 0.66; w = math.sin(u * TAU * 2)
            fr.append(dict(hip, armF=(2.75 + 0.3 * w, 0.55 - 0.35 * w), y=-0.4 + 0.6 * (1 - w) / 2, tilt=-0.08 - 0.05 * w, head=-0.2 - 0.06 * w))
    return fr


def grab(n=4):
    fr = []
    for i in range(n):
        s = math.sin(TAU * i / n); c = math.cos(TAU * i / n)
        fr.append(dict(BASE, sling=True, x=0.5 * s, y=0.8, tilt=-0.22 + 0.08 * s, head=-0.15 + 0.1 * c,
                       fF=(3.4, -A), fB=(-3.0, -A), armB=(1.4 + 0.4 * c, 0.3), armF=(1.5 - 0.4 * c, 0.2), fist=True))
    return fr


def melee():
    st = dict(BASE, sling=True, claw=True, fist=False)
    P = [dict(st, armF=(3.5, 0.5), tilt=-0.12, head=-0.12, y=0.4, fF=(3.0, -A)),
         dict(st, armF=(3.75, 0.3), tilt=-0.18, head=-0.16, y=0.6, fF=(3.4, -A)),
         dict(st, armF=(2.5, 0.05), tilt=0.12, head=0.0, x=0.8, y=0.8, fF=(4.6, -A), smear=(-1.35, -0.3)),
         dict(st, armF=(1.5, 0.0), tilt=0.26, head=0.05, x=1.4, y=1.2, fF=(5.0, -A), fB=(-2.8, -A), smear=(-1.1, 0.6)),
         dict(st, armF=(0.75, 0.15), tilt=0.3, head=0.06, x=1.4, y=1.4, fF=(5.0, -A), fB=(-2.9, -A), smear=(-0.3, 1.15)),
         dict(st, armF=(0.6, 0.55), tilt=0.24, x=1.0, y=1.0, fF=(4.4, -A)),
         dict(st, armF=(0.5, 0.85), tilt=0.16, x=0.5, y=0.6, fF=(3.4, -A)),
         dict(st, armF=(0.45, 1.0), tilt=0.1, y=0.2)]
    return P


def throw(item='gren'):
    st = dict(BASE, sling=True)
    return [dict(st, armF=(3.3, 0.7), tilt=-0.14, head=-0.12, item=item, y=0.4),
            dict(st, armF=(3.65, 0.45), tilt=-0.22, head=-0.18, item=item, y=0.6, fF=(3.2, -A)),
            dict(st, armF=(2.6, 0.15), tilt=0.02, head=-0.06, item=item, y=0.6, fF=(3.8, -A), x=0.5),
            dict(st, armF=(1.75, 0.0), tilt=0.2, head=0.0, y=0.9, fF=(4.2, -A), x=0.9),
            dict(st, armF=(1.1, 0.15), tilt=0.24, y=1.0, fF=(4.2, -A), x=0.9),
            dict(st, armF=(0.7, 0.5), tilt=0.18, y=0.7, fF=(3.6, -A), x=0.5),
            dict(st, armF=(0.5, 0.8), tilt=0.12, y=0.3)]


def aimv(frames, d):
    out = []
    for f in frames:
        g = dict(f)
        if d == 'u': g['tilt'] = g.get('tilt', 0.08) - 0.12; g['head'] = g.get('head', 0) - 0.3
        else: g['head'] = g.get('head', 0) + 0.32; g['tilt'] = g.get('tilt', 0.08) + 0.08
        out.append(g)
    return out


RUNW = lambda fi: (-0.1, -0.015)
# 이름: (포즈들, 프레임당 틱, 반복?, 바람, 얼굴(None=게임에서 겹침 / 문자열=굽기), 팔 오버레이 기울기)
def ANIMS():
    d = {}
    d['idle'] = (idle(), 5, True, (0, 0), None, 0)
    d['idle_u'] = (aimv(idle(), 'u'), 5, True, (0, 0), None, 0)
    d['tired'] = (tired(), 8, True, (0, 0), None, 0.25)
    d['bored'] = (bored(), 4, True, (0, 0), None, None)
    d['run'] = (run(), 4, True, RUNW, None, 0)
    d['run_u'] = (aimv(run(), 'u'), 4, True, RUNW, None, 0)
    d['crouch'] = (crouch(), 10, True, (0, 0), None, 0)
    d['crawl'] = (crawl(), 6, True, (-0.03, 0), None, 0)
    for nm, fn in (('rise', rise), ('apex', apex), ('fall', fall)):
        wind = {'rise': (0, 0.07), 'apex': (0, 0.0), 'fall': (0, -0.12)}[nm]
        d[nm] = (fn(), 5, True, wind, None, 0)
        d[nm + '_u'] = (aimv(fn(), 'u'), 5, True, wind, None, 0)
        d[nm + '_d'] = (aimv(fn(), 'd'), 5, True, wind, None, 0)
    d['land'] = (land(), 2, False, (0, 0), None, 0.15)
    d['skid'] = (skid(), 4, True, (0.12, 0), None, -0.15)
    d['hurt'] = (hurt(), 6, False, (0.15, -0.05), None, -0.5)
    d['die'] = (die(), 6, False, (0.1, -0.1), 'ko', None)
    d['win'] = (win(), 6, True, (0, 0), None, None)
    d['grab'] = (grab(), 5, True, (0, 0), None, None)
    d['melee'] = (melee(), 2, False, (0, 0), None, None)
    d['throw'] = (throw('gren'), 2, False, (0, 0), None, None)
    d['throwN'] = (throw('net'), 2, False, (0, 0), None, None)
    return d
