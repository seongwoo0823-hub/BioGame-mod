# 보스 9종: 거대한 기계 병기 디자인 (건메탈 + 경고 줄무늬 + 붉은 감시등 + 스테이지별 오염 코어)
import math
import numpy as np
from lib import Foe, P, TAU, M

S = math.sin; C = math.cos
STEEL, DARK, RUST, HAZ, RED = '#646878', '#34363f', '#7a4a30', '#d8a820', '#ff3030'
CORE = {1: '#a8c040', 2: '#ff3a50', 3: '#ff8a20'}
B = {}


def boss(name, frames, size, oy):
    def w(fn): B[name] = dict(fn=fn, frames=frames, size=size, oy=oy); return fn
    return w


def plate(F, pts, col=STEEL, rivets=True, over='all', grp=None):
    pts = [np.array(p, float) for p in pts]; c = sum(pts) / len(pts)
    g = F.poly(pts, col, dome=(c, max(np.linalg.norm(p - c) for p in pts) * 1.3), over=over, grp=grp)
    if rivets:
        for p in pts:
            q = p + (c - p) * 0.18; F.px(q[0], q[1], M(col).ramp[3], on=g)
    return g


def hazard(F, a, b, w=2.0, n=6):
    a = np.array(a, float); b = np.array(b, float); d = b - a; L = np.linalg.norm(d); u = d / L; v = np.array([-u[1], u[0]])
    g = F.cap(a, b, w, w, HAZ)
    for i in range(n):
        t0 = (i + 0.2) / n
        F.cv.line_decal(a + d * t0 - v * w, a + d * (t0 + 0.35 / n) + v * w, '#1a1612', on=g)
    return g


def light(F, c, r=1.4, col=RED, on=True):
    F.el(c, r, r, col if on else '#4a1010', bias=0.35 if on else 0)
    if on: F.px(c[0] - 0.5, c[1] - 0.5, '#ffffff')


def piston(F, a, b, r=1.6):
    a = np.array(a, float); b = np.array(b, float); m = a + (b - a) * 0.55
    F.cap(a, m, r, r, DARK); F.cap(m - (b - a) * 0.1, b, r * 0.65, r * 0.65, '#a0a4b4')


def tread(F, x0, x1, y, h, ph):
    g = F.cap((x0, y), (x1, y), h / 2, h / 2, '#26272e')
    n = int((x1 - x0) / 5)
    for i in range(n + 1):
        x = x0 + ((i * 5 + ph * 5) % (x1 - x0 + 1)); F.px(x, y - h / 2 + 0.5, '#7a7c88', on=g); F.px(x, y + h / 2 - 0.5, '#7a7c88', on=g)
    for i in range(int((x1 - x0) / 7) + 1):
        F.el((x0 + i * 7 + 2, y), h * 0.32, h * 0.32, '#565a68', over=(g,))


def vent_smoke(F, c, t, col='#5a5a60'):
    for k in range(3):
        F.el((c[0] + S(t * TAU + k) * 1.2, c[1] - 3 - k * 3 - (t * 3) % 3), 1.6 + k * 0.5, 1.4 + k * 0.4, col, over=())


# ---------------- 중간 보스 ----------------
@boss('mid1', dict(mv=4, at=2), 96, 84)          # 거대 결핵균 전차 → 중장갑 결핵 전차
def _(F, an, t):
    sh = (1 if an == 'at' and t > 0.5 else -1 if an == 'at' else 0)
    tread(F, -26, 24, -5, 10, t if an == 'mv' else 0)
    plate(F, [(-27 + sh, -10), (22 + sh, -10), (30 + sh, -18), (26 + sh, -30), (-20 + sh, -32), (-28 + sh, -24)], '#5e6044')
    plate(F, [(-14 + sh, -30), (12 + sh, -30), (10 + sh, -38), (-10 + sh, -40)], STEEL)            # 포탑 받침
    hazard(F, (24 + sh, -12), (31 + sh, -28), 2.4, 4)
    F.cap((-20 + sh, -22), (14 + sh, -22), 1.0, 1.0, RUST)
    for x in (-16, -6, 4): F.el((x + sh, -16), 1.2, 1.2, DARK)
    light(F, (24 + sh, -24), 1.8, CORE[1]); light(F, (20 + sh, -16), 1.2)
    F.el((-22 + sh, -34), 2.4, 1.4, '#3c3e48'); vent_smoke(F, (-22 + sh, -36), t)


@boss('mid2', dict(mv=4, a1=3, a2=3, a3=2), 110, 96)   # 바이러스 생산 공장 → 보행 공장 기계
def _(F, an, t):
    sq = 4 if an == 'a3' else 0; mvp = an == 'mv'
    for k in range(4):
        x = -21 + k * 14; ph = S(t * TAU + k * 1.6) * 2.5 * mvp
        piston(F, (x * 0.8, -12 + sq), (x + ph, 0), 2.2)
        F.el((x + ph, -0.8), 3, 1.4, DARK)
    plate(F, [(-28, -14 + sq), (28, -14 + sq), (30, -52 + sq), (-30, -52 + sq)], '#5a5c6a')
    plate(F, [(-22, -20 + sq), (22, -20 + sq), (22, -46 + sq), (-22, -46 + sq)], DARK, rivets=False)
    F.el((0, -33 + sq), 13, 10, '#401018', bias=0.0)
    for k in range(6):
        q = P((0, -33 + sq), 6 + (k % 2) * 3, k * 1.05 + t * TAU * 0.5); F.el(q, 1.8, 1.8, CORE[2], bias=0.3)
    hazard(F, (-28, -16 + sq), (28, -16 + sq), 1.6, 9)
    op = an == 'a1'
    for k in range(3):
        x = -16 + k * 16
        plate(F, [(x - 3.5, -52 + sq), (x + 3.5, -52 + sq), (x + 3, -64 + sq), (x - 3, -64 + sq)], '#4a4c58', rivets=False)
        F.el((x, -64 + sq - (3 if op else 0)), 4.2, 1.6, '#2a2a30'); vent_smoke(F, (x, -66 + sq), t + k * 0.3)
    if an == 'a2':
        for k in range(8):
            a = k * TAU / 8 + 0.2; F.cap(P((0, -33), 26, a), P((0, -33), 31 + t * 4, a), 1.2, 0.6, '#a0a4b4')
    for x in (-24, 24): light(F, (x, -48 + sq), 1.6, RED, on=(int(t * 4) % 2 == 0) or not mvp)


@boss('mid3', dict(mv=4, a1=2), 100, 86)       # 거대 TAM 브루트 → 고릴라형 파쇄 기계 (팔은 코드가 그림)
def _(F, an, t):
    st_ = S(t * TAU) * 3 if an == 'mv' else 0
    for s_, x in ((-1, -6), (1, 6)):
        piston(F, (x * 0.8, -14), (x + st_ * s_, -1), 2.6); F.poly([(x + st_ * s_ - 5, 0), (x + st_ * s_ + 6, 0), (x + st_ * s_ + 4, -4), (x + st_ * s_ - 4, -4)], DARK)
    plate(F, [(-20, -16), (18, -16), (24, -36), (14, -52), (-10, -56), (-24, -40)], '#6a4a48')
    plate(F, [(-14, -40), (6, -44), (10, -54), (-8, -58)], STEEL)
    F.el((-2, -30), 7, 6, '#3a1408'); F.el((-2, -30), 4.6, 4, CORE[3], bias=0.25)
    for k in range(4): F.cv.line_decal((-7, -33 + k * 2), (3, -33 + k * 2), '#3a1408', on=None)
    jaw = 3 if an == 'a1' else 0
    plate(F, [(12, -38 + jaw), (24, -38 + jaw), (24, -32 + jaw), (12, -32 + jaw)], DARK, rivets=False)
    for x in range(13, 24, 2): F.px(x, -38 + jaw, '#d8d0c0')
    plate(F, [(10, -48), (24, -46), (26, -40), (12, -40)], STEEL)
    light(F, (20, -44), 1.6, RED); light(F, (15, -44), 1.2, RED)
    hazard(F, (-22, -18), (16, -18), 1.4, 7)


# ---------------- 관문 보스 ----------------
@boss('gb1', dict(mv=8, a1=6, a2=6), 120, 96)     # 탄저 포자 모함 → 중무장 포격 비행선
def _(F, an, t):
    tilt = (S(t * math.pi) * -0.25 if an == 'a2' else S(t * TAU) * 0.03)
    c = np.array([0, -32 + S(t * TAU) * 1.5])
    R_ = lambda v: c + np.array([v[0] * C(tilt) - v[1] * S(tilt), v[0] * S(tilt) + v[1] * C(tilt)])
    for x in (-18, 14):
        F.cap(R_((x, -12)), R_((x, -18)), 1.0, 1.0, DARK)
        sp = t * TAU * 4
        F.cap(R_((x - 9 * C(sp), -19)), R_((x + 9 * C(sp), -19)), 0.9, 0.9, '#8a8c98')
    plate(F, [R_((-32, -6)), R_((24, -12)), R_((34, -2)), R_((24, 10)), R_((-30, 8))], '#5a5e50')
    plate(F, [R_((-20, -12)), R_((10, -14)), R_((14, -6)), R_((-22, -4))], STEEL)
    hazard(F, R_((-28, 6)), R_((22, 6)), 1.8, 9)
    op = S(t * math.pi) if an == 'a1' else 0
    for x in (-16, -2, 12):
        F.el(R_((x, 9 + op * 2)), 4, 1.6 + op * 1.6, '#1a1a1e')
        if op > 0.3: F.el(R_((x, 12 + op * 4)), 2.2, 2.2, '#8a8460')
    F.el(R_((28, -1)), 6, 5, DARK); F.el(R_((30, -1)), 3.6, 3.2, RED if an != 'mv' else CORE[1], bias=0.3)
    for x in (-28, -24): F.el(R_((x - 4, 0)), 2.4, 3.2, '#ff8030', bias=0.4)
    for x in (-10, 4): light(F, R_((x, -15)), 1.2)


@boss('gb2', dict(mv=8, a1=6, a2=6), 120, 104)    # 거대 T4 파지 랜더 → 강철 착륙선
def _(F, an, t):
    crouch = (S(t * math.pi) * 10 if an == 'a1' and t < 0.6 else 0)
    hop = (-14 * S((t - 0.5) * 2 * math.pi) if an == 'a1' and t >= 0.5 else 0)
    sheath = 1 - (0.45 * S(t * math.pi) if an == 'a2' else 0)
    base = np.array([0, -14 + crouch + hop])
    for k, sx in enumerate((-1, 1, -0.6, 0.6)):
        knee = base + np.array([sx * 14, -7 + crouch * 0.4 + S(t * TAU + k) * (1.5 if an == 'mv' else 0)])
        foot = np.array([sx * 22 + (S(t * TAU + k) * 2 if an == 'mv' else 0), min(0, hop)])
        col = STEEL if abs(sx) > 0.8 else DARK
        F.cap(base, knee, 1.7, 1.4, col, grp='lg%d' % k, over=()); F.cap(knee, foot, 1.4, 1.0, col, grp='lg%d' % k, over=())
        F.el(knee, 1.6, 1.6, HAZ, over=('lg%d' % k,)); F.el(foot, 2.4, 1.2, DARK, over=())
    plate(F, [base + (-10, 0), base + (10, 0), base + (7, 5), base + (-7, 5)], DARK)
    top = base + np.array([0, -22 * sheath])
    F.cap(base, top, 4.8, 4.8, '#8a8e9c', grp='sh')
    for k in range(6): y = base[1] - (k + 0.5) * 22 * sheath / 6; F.cv.line_decal((-4.5, y), (4.5, y), DARK, on='sh')
    hc = top + np.array([0, -17])
    pts = [P(hc, 16, -math.pi / 2 + k * TAU / 6) for k in range(6)]
    plate(F, pts, STEEL)
    for k in range(6): F.cv.line_decal(hc, pts[k], DARK, on=None)
    F.el(hc + (5, 0), 5, 4, '#1a1a20'); F.el(hc + (6, 0), 3.4, 2.8, RED if an != 'mv' else CORE[2], bias=0.3)
    hazard(F, hc + (-12, 9), hc + (12, 9), 1.4, 6)
    if an == 'a2' and t > 0.3: F.cap(base, base + (0, 10), 1.4, 0.6, '#ffe060', bias=0.3)


@boss('gb3', dict(mv=8, a1=6, a2=6), 120, 104)    # 키메라 융합 종양 → 세 포탑 키메라 기계
def _(F, an, t):
    c = np.array([0, -28 + S(t * TAU) * 1.0])
    for k in range(6):
        a = math.pi * 0.2 + k * 0.5; L_ = 10 + S(t * TAU + k) * 2 + (6 * S(t * math.pi) if an == 'a2' else 0)
        F.flag(c + (k * 7 - 18, 18), math.pi / 2 + S(t * TAU + k) * 0.3, 4, L_ / 4, 0.3, t + k * 0.15, '#4a4c58', 1.2, 0.7)
    plate(F, [c + (-30, 18), c + (30, 18), c + (34, -4), c + (20, -22), c + (-22, -22), c + (-34, -2)], '#6a4050')
    plate(F, [c + (-18, -4), c + (14, -4), c + (12, 12), c + (-16, 12)], DARK, rivets=False)
    F.el(c + (-2, 4), 7, 6, CORE[3], bias=0.25)
    hazard(F, c + (-30, 16), c + (30, 16), 1.6, 10)
    heads = (((24, -12), '#7a5a68'), ((12, -30), STEEL), ((-10, -30), '#6a6450'))
    for i, (o, col) in enumerate(heads):
        op = S(t * math.pi) if an == 'a1' else 0
        hc = c + o + np.array(o) / 30 * op * 4
        F.cap(c + np.array(o) * 0.5, hc, 2.4, 2.4, DARK)
        plate(F, [hc + (-7, -5), hc + (6, -6), hc + (9, 0), hc + (6, 6), hc + (-7, 5)], col)
        F.cap(hc + (5, 1), hc + (11 + op * 2, 1), 1.6, 1.4, DARK)
        light(F, hc + (2, -2), 1.6, RED if an != 'mv' else CORE[3])


# ---------------- 최종 보스 ----------------
@boss('biofilm', dict(mv=4, ph2=4), 140, 116)    # 바이오필름 타이탄 → 오물 정화 요새 기계 (눈·입·팔은 코드)
def _(F, an, t):
    dmg = an == 'ph2'
    for k in range(5):
        x = -36 + k * 18; piston(F, (x * 0.85, -14), (x + S(t * TAU + k) * 1.5, 0), 3)
        F.el((x, -1), 5, 1.8, DARK)
    plate(F, [(-46, -14), (44, -14), (48, -40), (36, -62), (10, -78), (-22, -76), (-44, -56), (-50, -32)], '#585c4c')
    plate(F, [(-34, -46), (28, -50), (30, -66), (-24, -70)], STEEL)
    for k in range(4):
        x = -30 + k * 18; F.cap((x, -20), (x, -40), 3.6, 3.6, '#3a4a20'); F.el((x, -30 + S(t * TAU + k) * 4), 2.6, 3.2, CORE[1], bias=0.25)
    hazard(F, (-46, -16), (44, -16), 2.2, 12)
    for x in (-36, 10, 30): F.cap((x, -74 + (x > 0) * 8), (x, -84 + (x > 0) * 8), 2.4, 2.0, DARK); vent_smoke(F, (x, -86 + (x > 0) * 8), t, '#6a7a40' if not dmg else '#3a3a3a')
    F.el((-30, -30), 11, 9, '#1e1e22')
    if dmg:
        for (a, b) in (((-10, -60), (2, -48)), ((20, -40), (34, -30)), ((-40, -46), (-30, -36))): F.cv.line_decal(a, b, '#ff6030', on=None)
    for (x, y) in ((-44, -40), (40, -30), (-8, -74)): light(F, (x, y), 1.6, RED, on=(int(t * 4) % 2 == 0))


@boss('virking', dict(core=6), 72, 48)           # 변이 바이러스 킹 → 육각 코어 비행 요새 (가시 고리·다리는 코드)
def _(F, an, t):
    rot_ = t * math.pi / 3
    c = (0, -24)
    pts = [P(c, 24, rot_ * 0.5 + k * TAU / 6) for k in range(6)]
    plate(F, pts, '#565a6a')
    for k in range(0, 6, 2):
        F.poly([c, pts[k], pts[(k + 1) % 6]], '#7a2a3a', over='all')
    pts2 = [P(c, 13, -rot_ + k * TAU / 6) for k in range(6)]
    plate(F, pts2, DARK, rivets=False)
    for k in range(6): light(F, P(c, 19, rot_ * 0.5 + (k + 0.5) * TAU / 6), 1.4, RED)


@boss('oncos', dict(mv=4, rage=4), 150, 134)     # 암세포 온코스 → 거대 생체기계 탑 (눈·입·싹·방패는 코드)
def _(F, an, t):
    rg = an == 'rage'
    flesh = '#8a2a48' if rg else '#6a3a5a'
    for k in range(5):
        x0 = -40 + k * 20; F.cap((x0, 0), (x0 * 0.6, -40), 2.6, 1.8, DARK)
    for (x, y, r) in ((-28, -30, 24), (26, -28, 26), (0, -52, 42)):
        F.el((x, y + S(t * TAU + x) * 1.2), r, r * 0.9, flesh)
    plate(F, [(-44, -40), (44, -40), (40, -90), (18, -110), (-18, -112), (-42, -88)], '#5a5866')
    plate(F, [(-30, -76), (24, -78), (22, -100), (-24, -102)], STEEL)
    for (x, y) in ((-34, -60), (34, -60), (-16, -90), (18, -94)):
        F.el((x, y), 5, 5, '#2a1018'); F.el((x, y), 3.2, 3.2, CORE[3] if not rg else RED, bias=0.3)
    hazard(F, (-44, -42), (44, -42), 2.4, 12)
    for x in (-36, -12, 12, 36): piston(F, (x, -40), (x * 1.1, -6), 2.4)
    for x in (-22, 0, 20): F.cap((x, -110), (x, -122), 2.4, 2.0, DARK); vent_smoke(F, (x, -124), t + x * 0.01, '#5a3a3a')
    F.el((-14, -62), 15, 15, '#1a1a20')
    F.el((-32, -24), 13, 7, '#1a1a20')
    for (x, y) in ((-40, -76), (36, -84), (0, -116)): light(F, (x, y), 1.8, RED, on=(int(t * 4 + x) % 2 == 0))


@boss('node', dict(mv=4), 30, 22)                # PD-L1 노드 → 방어막 발생 드론
def _(F, an, t):
    c = (0, -7)
    pts = [P(c, 8, t * TAU / 6 + k * TAU / 6) for k in range(6)]
    plate(F, pts, '#5a5070', rivets=False)
    for k in range(3): F.cap(P(c, 8, k * TAU / 3 + t * TAU / 3), P(c, 11, k * TAU / 3 + t * TAU / 3), 1.0, 0.6, '#a0a4b4')
    F.el(c, 3.6, 3.6, '#d0a0ff', bias=0.3); F.px(-1, -8, '#ffffff')
