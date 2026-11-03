# 적 도트 생성 공용 도구: 색 단계 자동 생성 + 몸통·편모·가시·눈 같은 부품
import sys, os, math
import numpy as np
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'immune-hero'))
from raster import Canvas, Mat, hexc, rot  # noqa

TAU = 2 * math.pi
_cache = {}


def _mix(a, b, t):
    a = hexc(a).astype(float); b = hexc(b).astype(float); c = a + (b - a) * t
    return '#%02x%02x%02x' % tuple(int(round(v)) for v in c)


def M(base, bias=0.0):
    k = (base, bias)
    if k not in _cache:
        _cache[k] = Mat([_mix(base, '#140820', 0.68), _mix(base, '#2a1038', 0.34), base, _mix(base, '#fff6e6', 0.5)], bias=bias)
    return _cache[k]


def P(a, r, ang):
    return np.array([a[0] + math.cos(ang) * r, a[1] + math.sin(ang) * r])


class Foe:
    def __init__(s, cv): s.cv = cv; s.n = 0

    def g(s):
        s.n += 1; return 'p%d' % s.n

    def el(s, c, rx, ry, col, a=0.0, over='all', grp=None, bias=0.0, lift=0.0):
        g = grp or s.g(); s.cv.ellipse(c, rx, ry, a=a, mat=M(col, bias), group=g, over=over, lift=lift); return g

    def cap(s, a, b, r1, r2, col, over='all', grp=None, bias=0.0):
        g = grp or s.g(); s.cv.capsule(a, b, r1, r2, mat=M(col, bias), group=g, over=over); return g

    def poly(s, pts, col, dome=None, over='all', grp=None, bias=0.0):
        g = grp or s.g(); s.cv.poly(pts, mat=M(col, bias), group=g, over=over, dome=dome); return g

    def flag(s, p0, ang, n, seg, amp, ph, col, r0=0.75, r1=0.4, grp=None, over=()):
        g = grp or s.g(); pts = [np.array(p0, float)]
        for i in range(1, n + 1):
            a = ang + math.sin(ph * TAU + i * 0.9) * amp * (i / n)
            pts.append(pts[-1] + np.array([math.cos(a), math.sin(a)]) * seg)
        for i in range(n):
            r = r0 + (r1 - r0) * i / n
            s.cv.capsule(pts[i], pts[i + 1], r, r, mat=M(col), group=g, over=over)
        return pts

    def spikes(s, c, R, n, L, col, rot0=0.0, knob=None, kr=1.0, w=0.5, over=(), arc=(0, TAU), grp=None):
        g = grp or s.g()
        for i in range(n):
            a = arc[0] + (arc[1] - arc[0]) * (i + 0.5) / n + rot0
            p0 = P(c, R * 0.85, a); p1 = P(c, R + L, a)
            s.cv.capsule(p0, p1, w, w * 0.8, mat=M(col), group=g, over=over)
            if knob: s.cv.ellipse(p1, kr, kr, mat=M(knob), group=g + 'k', over=(g,))
        return g

    def px(s, x, y, col, on=None):
        s.cv.decal(x, y, col, on=on)

    def eyes(s, x, y, mood='n', gap=3, big=False, pupil='#1a0610', white='#ffffff', n=2):
        """x,y: 앞쪽 눈 왼쪽 위. mood: n 보통, a 화남, c 돌진(빨강), h 기쁨, s 놀람, z 졸림"""
        xs = [x - gap * i for i in range(n)]
        for i, ex in enumerate(xs):
            w = 2 if (big or i == 0) else 1
            if mood == 'z':
                for j in range(w): s.px(ex + j, y + 1, pupil)
                continue
            if mood == 'h':
                s.px(ex, y + 1, pupil); s.px(ex + w - 1, y + 1, pupil); s.px(ex + (w - 1) / 2, y, pupil); continue
            wc = '#ffd040' if mood == 'c' else white
            for j in range(w):
                s.px(ex + j, y, wc); s.px(ex + j, y + 1, wc)
                if big: s.px(ex + j, y + 2, wc)
            pc = '#ff2020' if mood == 'c' else pupil
            s.px(ex + w - 1, y + 1, pc)
            if big: s.px(ex + w - 1, y + 2, pc)
            if mood in ('a', 'c'):
                s.px(ex - 1, y - 1, pupil); s.px(ex, y - 1, pupil)
            if mood == 's':
                s.px(ex + w - 1, y, pupil)

    def mouth(s, x, y, w=2, open_=0, col='#2a0612', inner='#c03050', teeth=False):
        for j in range(w): s.px(x + j, y, col)
        for k in range(1, open_ + 1):
            for j in range(w): s.px(x + j, y + k, inner if k < open_ or open_ == 1 else col)
            s.px(x - 1, y + k, col); s.px(x + w, y + k, col)
        if teeth and open_:
            for j in range(0, w, 2): s.px(x + j, y + 1, '#ffffff')
