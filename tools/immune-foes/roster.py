# 새 적 30종 + 관문 보스 3종 도트 정의 (오른쪽을 보는 기준, 원점 = 발밑)
# 각 함수 d(F, an, t): an = 'mv'(반복) | 'at'(공격 준비→발사) | 보스는 'a1','a2'
import math
import numpy as np
from lib import Foe, P, TAU

R = {}


def foe(name, frames, size=56, oy=None):
    def wrap(fn):
        R[name] = dict(fn=fn, frames=frames, size=size, oy=oy if oy is not None else size - 8); return fn
    return wrap


S = math.sin; C = math.cos
def bob(t, a=1.0): return S(t * TAU) * a


# ========================= STAGE 1 : 세균 =========================
@foe('listeria', dict(mv=6, at=4))       # 한 방: 액틴 로켓 꼬리로 돌진하는 막대균
def _(F, an, t):
    dash = an == 'at'; b = bob(t, 0.6)
    if dash:
        for i in range(5): F.el((-8 - i * 2.6, -5 + S(t * TAU + i) * 0.6), 2.4 - i * 0.35, 1.6 - i * 0.2, '#ff70a0' if i % 2 else '#ffb0d0', over=())
    else:
        F.flag((-6, -5), math.pi, 4, 1.5, 0.5, t, '#d07080', 0.6, 0.35)
    F.cap((-5, -5 + b), (5, -5 - b * 0.5), 3.6, 3.4, '#e6d468')
    F.px(-1, -7 + b, '#fffbc0'); F.px(0, -7 + b, '#fffbc0')
    F.eyes(3, -7, 'c' if dash else 'n')
    if dash: F.mouth(3, -3, 2, 1)


@foe('vibrio', dict(mv=6, at=4))         # 한 방: 쉼표 모양으로 헤엄치다 내리꽂는 콜레라균
def _(F, an, t):
    dive = an == 'at'
    F.flag((-6, -6), math.pi + 0.3, 6, 1.6, 0.7, t * (2 if dive else 1), '#4a7ab0', 0.55, 0.3)
    pts = [(-4.5, -7 + bob(t, .8)), (-1.5, -5.6), (1.5, -5.2), (4.2, -6.4)]
    for i, (x, y) in enumerate(pts): F.el((x, y), 2.9 - abs(i - 1.5) * 0.25, 2.5, '#70b8e0', grp='body', over=())
    F.eyes(4, -8, 'a' if dive else 'n')


@foe('neisseria', dict(mv=6, at=4))      # 한 방: 콩팥 두 개가 붙은 쌍구균, 통통 튐
def _(F, an, t):
    sq = 1 - (0.25 * (1 - t) if an == 'at' else 0.08 * abs(S(t * TAU)))
    h = 5.2 * sq
    F.el((-3.2, -h), 3.6, h, '#e88aa0', a=-0.1, grp='l')
    F.el((3.0, -h), 3.6, h, '#f0a0b4', a=0.1, grp='r', over=('l',))
    F.eyes(4, -h - 1, 'n' if an == 'mv' else 'a'); F.mouth(4, -h + 2, 1)


@foe('spiro', dict(mv=6, at=4))          # 한 방: 몸을 감았다가 튀어 오르는 나선균
def _(F, an, t):
    coil = 0.55 + 0.45 * t if an == 'at' else 1.0
    n = 9
    for i in range(n):
        x = (-8 + i * 2.0) * coil; y = -6 - S(i * 1.25 + t * TAU) * 3.2 * (2 - coil)
        F.el((x, y), 1.7, 1.7, '#c890f8' if i % 2 else '#a870e0', grp='s%d' % i, over=('s%d' % (i - 1),))
    F.eyes(int(8 * coil) - 1, -10 + int(-S((n - 1) * 1.25 + t * TAU) * 3.2 * (2 - coil)) + 2, 'a' if an == 'at' else 'n', gap=2)


@foe('myco', dict(mv=6, at=4))           # 한 방: 세포벽이 없어 흐물흐물한 꼬마 마이코플라스마 떼
def _(F, an, t):
    w = [3.2 + S(t * TAU + k) * 0.7 for k in range(3)]
    F.el((0, -5 + bob(t, .6)), w[0], 3.6 + S(t * TAU + 1) * 0.5, '#8ee0c8', a=S(t * TAU) * 0.3)
    F.el((-2.6, -4), w[1] * 0.6, 2, '#8ee0c8', grp='p1', over=())
    F.eyes(2, -7 + bob(t, .6), 'a' if an == 'at' else 'n', gap=2)


@foe('mrsa', dict(mv=6, at=4))           # 여러 발: 금속 판갑을 두른 내성 포도알균 덩어리
def _(F, an, t):
    op = t if an == 'at' else 0
    for (x, y, r) in ((-6, -5, 4.2), (5, -5, 4.2), (-1, -6, 4.6), (-5, -12, 4.2), (4, -13, 4.2), (0, -17, 3.6)):
        F.el((x, y + bob(t + x * .05, .4)), r, r, '#e8b830', grp='g', over=())
    for (x, y, a) in ((-7, -9, -0.6), (7, -10, 0.6), (0, -12, 0)):
        o = np.array([math.sin(a), -math.cos(a)]) * op * 2.5
        F.poly([(x - 3.4 + o[0], y - 1.8 + o[1]), (x + 3.4 + o[0], y - 1.8 + o[1]), (x + 2.6 + o[0], y + 2.6 + o[1]), (x - 2.6 + o[0], y + 2.6 + o[1])],
               '#8a92a8', dome=((x, y), 4.5))
    F.px(-0.5, -12, '#ff3040'); F.px(0.5, -12, '#ff3040')
    if op > 0.4: F.el((0, -6), 2.4, 2.4, '#ff5050', bias=0.3)
    F.eyes(6, -5, 'c' if an == 'at' else 'a')


@foe('anthrax', dict(mv=6, at=4))        # 여러 발: 대나무 마디처럼 쌓인 포자 박격포 탑
def _(F, an, t):
    rec = -2.5 * S(t * math.pi) if an == 'at' else 0
    for i in range(4):
        y = -3 - i * 4.6 + (rec if i == 3 else 0)
        F.poly([(-5, y + 2.2), (5, y + 2.2), (5, y - 2.2), (-5, y - 2.2)], '#c8c0b0' if i % 2 else '#b0a898', dome=((0, y), 6))
    F.el((0, -20 + rec), 3.6, 1.6, '#4a3a30')
    if an == 'at' and t > 0.3: F.el((0, -22 + rec - t * 4), 2.2, 2.2, '#3a2a20')
    F.eyes(3, -9, 'a')
    for k in (-4, 4): F.cap((k, -1), (k * 1.6, 0), 1.1, 0.9, '#6a5a48')


@foe('klebs', dict(mv=6, at=4))          # 여러 발: 두꺼운 점액 캡슐에 싸여 굴러오는 클레브시엘라
def _(F, an, t):
    spin = t * TAU * (2 if an == 'at' else 1)
    F.el((0, -9), 9, 8.6, '#a0d8c8', bias=0.12, grp='cap', over=())
    a = spin; c = np.array([0, -9])
    F.cap(P(c, 4.6, a), P(c, 4.6, a + math.pi), 2.6, 2.6, '#5a9a50', over=('cap',))
    for k in range(5):
        q = P(c, 7.2, spin * 0.5 + k * 1.25); F.px(q[0], q[1], '#e8fff6', on='cap')
    F.eyes(5, -11, 'c' if an == 'at' else 'n')


@foe('tetanus', dict(mv=6, at=4))        # 여러 발: 북채처럼 생긴 파상풍균, 머리 포자로 내려찍음
def _(F, an, t):
    sl = (math.pi * 0.5 * (S(t * math.pi))) if an == 'at' else bob(t, 0.06)
    base = np.array([0, -1]); top = base + np.array([math.sin(sl), -math.cos(sl)]) * 14
    F.cap(base, top, 2.6, 2.2, '#b8907a')
    F.el(top, 4.4, 4.2, '#e8e0c8', grp='hd')
    F.px(top[0] - 1.5, top[1] - 2, '#ffffff', on='hd')
    F.eyes(int(top[0]) + 2, int(top[1]) - 1, 'c' if an == 'at' else 'a', gap=2)
    for k in (-2.5, 2.5): F.cap((k, -1), (k * 1.6, 0), 0.9, 0.8, '#7a5a48')


@foe('legion', dict(mv=6, at=4))         # 여러 발: 물방울 에어로졸 속에 숨은 레지오넬라 (공중)
def _(F, an, t):
    pul = 1 + (0.12 * S(t * math.pi) if an == 'at' else 0.04 * S(t * TAU))
    F.el((0, -9), 8.4 * pul, 8 * pul, '#70c0f0', bias=0.18, grp='bub', over=())
    F.cap((-3.4, -9 + bob(t, .8)), (3.4, -9 - bob(t, .8)), 2.2, 2.2, '#e07050', over=('bub',))
    F.flag((-4.5, -9), math.pi + 0.4, 4, 1.4, 0.8, t, '#a04030', 0.5, 0.3, over=('bub',))
    F.px(-3, -14, '#ffffff', on='bub'); F.px(-4, -13, '#ffffff', on='bub')
    F.eyes(3, -11, 'a' if an == 'at' else 'n', gap=2)


# ========================= STAGE 2 : 바이러스 =========================
@foe('noro', dict(mv=6, at=4))           # 한 방: 컵 모양 홈이 팬 꼬마 노로바이러스, 떼로 뜀
def _(F, an, t):
    sq = 1 - 0.2 * abs(S(t * TAU)) if an == 'mv' else 1 - 0.3 * (1 - t)
    F.el((0, -4.6 * sq), 4.6, 4.6 * sq, '#d8b0f0')
    for (x, y) in ((-2, -6), (1, -3), (-3, -3), (1, -7)): F.px(x, y * sq, '#9060b8')
    F.eyes(2, -6 * sq, 'n' if an == 'mv' else 'a', gap=2)


@foe('measles', dict(mv=6, at=4))        # 한 방: 붉은 반점 폭탄을 떨구는 홍역 바이러스 (공중)
def _(F, an, t):
    c = (0, -8 + bob(t, 1))
    F.spikes(c, 5.6, 12, 1.6, '#c03040', rot0=t * 0.6, knob='#ff8080', kr=0.8)
    F.el(c, 5.8, 5.6, '#ff7a78')
    for k in range(3):
        q = P(c, 3, k * 2.1 + 0.4); F.px(q[0], q[1], '#c02838')
    if an == 'at': F.el((0, -1 + t * 2), 1.8, 1.8, '#d02030')
    F.eyes(3, c[1] - 2, 'a' if an == 'at' else 'n', gap=3)


@foe('hpv', dict(mv=6, at=4))            # 한 방: 오각 돌기가 박힌 HPV, 바닥을 기다 덮침
def _(F, an, t):
    lean = 0.25 * t if an == 'at' else 0
    c = (lean * 4, -6 + abs(bob(t, 1)) * -0.6)
    F.el(c, 6, 5.6, '#f0b0a0')
    for k in range(7):
        q = P(c, 4.2, k * 0.9 + 0.3); F.el(q, 1.2, 1.2, '#d08070', over=())
    F.eyes(int(c[0]) + 3, -8, 'a' if an == 'at' else 'n')


@foe('zika', dict(mv=6, at=4))           # 한 방: 바이러스 주머니를 매단 모기 (공중 급강하)
def _(F, an, t):
    flap = S(t * TAU * 3)
    for s_ in (1, -1):
        F.poly([(-1, -10), (-6, -16 - flap * 3 * s_), (-9, -12 - flap * 2 * s_)], '#c0e8ff', bias=0.25, over=())
    F.cap((-7, -8), (2, -8), 1.6, 1.8, '#3a3a4a')
    F.cap((2, -8), (8, -7 + (2 if an == 'at' else 0)), 0.5, 0.4, '#202028')
    for k in (-3, 0): F.cap((k, -7), (k - 1, -2), 0.4, 0.3, '#202028')
    F.el((-6, -6), 2.6, 2.6, '#80d0a0', over=())
    F.eyes(2, -10, 'c' if an == 'at' else 'a', gap=2)


@foe('polio', dict(mv=6, at=4))          # 한 방: 매끈한 정이십면체, 굴러서 빠르게 돌진
def _(F, an, t):
    a = -t * TAU * (2 if an == 'at' else 1)
    pts = [P((0, -5), 5, a + k * TAU / 6) for k in range(6)]
    F.poly(pts, '#ffd060', dome=((0, -5), 5.5))
    for k in range(3): F.cv.line_decal(P((0, -5), 0, 0), pts[k * 2], '#d0a030', on=None)
    F.eyes(2, -7, 'c' if an == 'at' else 'n', gap=2)


@foe('hbv', dict(mv=8, at=4))            # 여러 발: 표면 항원 위성이 주위를 도는 B형 간염 바이러스
def _(F, an, t):
    c = (0, -9 + bob(t, .5))
    sats = [P(c, 11, t * TAU + k * TAU / 3) for k in range(3)]
    for q in sats:
        if math.sin(math.atan2(q[1] - c[1], q[0] - c[0])) < 0: F.el(q, 2, 2, '#c08840', over=())
    F.el(c, 8, 8, '#e0a850')
    F.el((c[0] - 1, c[1] + 1), 4.2, 4.2, '#a06030', over=())
    F.spikes(c, 7.6, 10, 1.4, '#c08840', rot0=t, w=0.6)
    for q in sats:
        if math.sin(math.atan2(q[1] - c[1], q[0] - c[0])) >= 0: F.el(q, 2, 2, '#ffd080')
    F.eyes(4, c[1] - 3, 'c' if an == 'at' else 'a')


@foe('smallpox', dict(mv=6, at=4))       # 여러 발: 벽돌처럼 단단한 천연두, 고름 탄을 흩뿌림
def _(F, an, t):
    sw = 1 + (0.1 * S(t * math.pi) if an == 'at' else 0)
    F.poly([(-8 * sw, -1), (8 * sw, -1), (9 * sw, -18), (-9 * sw, -18)], '#c49874', dome=((0, -10), 11))
    for y in range(-16, -2, 3): F.cv.line_decal((-8, y), (8, y + 1), '#8a6044', on=None)
    for (x, y) in ((-5, -6), (4, -13), (-2, -14), (6, -5)): F.el((x, y), 1.5, 1.5, '#ffe080', bias=0.2)
    F.eyes(5, -12, 'c' if an == 'at' else 'a')
    F.mouth(4, -7, 3, 2 if an == 'at' else 0, teeth=True)


@foe('dengue', dict(mv=6, at=4))         # 여러 발: 쓰러지면 둘로 갈라지는 뎅기 바이러스
def _(F, an, t):
    c = (0, -9)
    F.el(c, 8.4, 8.4 + bob(t, .3), '#60c8b4')
    for k in range(8):
        q = P(c, 5.6, k * TAU / 8 + t * 0.4); q2 = P(c, 7.6, k * TAU / 8 + t * 0.4 + 0.35)
        F.cv.line_decal(q, q2, '#2a8070', on=None)
    F.cv.line_decal((0, -17), (0, -1), '#d0fff0', on=None)
    F.eyes(5, -12, 'c' if an == 'at' else 'n')


@foe('mers', dict(mv=8, at=4))           # 여러 발: 왕관 가시를 8방향으로 쏘는 MERS (공중)
def _(F, an, t):
    c = (0, -10 + bob(t, 1)); ext = 1.5 + (2.5 * S(t * math.pi) if an == 'at' else 0)
    F.spikes(c, 7.6, 8, ext, '#c06020', rot0=t * TAU / 8, knob='#ffb050', kr=1.4, w=0.7)
    F.el(c, 8, 7.8, '#e88a48')
    F.el((c[0] - 2, c[1] - 2), 3, 2.6, '#f8b070', over=())
    F.eyes(4, c[1] - 2, 'c' if an == 'at' else 'a')
    F.mouth(3, c[1] + 2, 2, 1 if an == 'at' else 0)


@foe('tmv', dict(mv=8, at=4))            # 여러 발: 지휘봉처럼 회전하는 담배모자이크 바이러스 막대 (공중)
def _(F, an, t):
    a = math.pi / 2 + (t * TAU if an == 'at' else S(t * TAU) * 0.25)
    c = np.array([0, -12.0]); d = np.array([math.cos(a), math.sin(a)])
    F.cap(c - d * 10, c + d * 10, 2.8, 2.8, '#90d060', grp='rod')
    for k in range(-9, 10, 2):
        q = c + d * k; F.px(q[0], q[1], '#507a30', on='rod')
    F.el(c, 3.6, 3.6, '#b8f088')
    F.eyes(int(c[0]) + 2, int(c[1]) - 1, 'c' if an == 'at' else 'a', gap=2)


# ========================= STAGE 3 : 종양 미세환경 =========================
@foe('ctc', dict(mv=6, at=4))            # 한 방: 혈류를 타고 일직선으로 날아드는 순환 종양 세포
def _(F, an, t):
    st = 2 if an == 'at' else 1
    for i in range(3): F.cap((-8 - i * 3 * st, -6 + i * 2 - 2), (-4 - i * 3, -6 + i * 2 - 2), 0.5, 0.5, '#ffb0c8', over=())
    F.el((0, -6), 5.6 + (0.6 if st == 2 else 0), 5 - (0.6 if st == 2 else 0), '#ff6a96')
    F.el((-1, -6), 2.4, 2.2, '#a0285a', over=())
    F.eyes(3, -8, 'c' if an == 'at' else 'n', gap=2)


@foe('platelet', dict(mv=6, at=4))       # 한 방: 끈적한 위족을 뻗는 납치된 혈소판
def _(F, an, t):
    ext = 2.5 + (2.5 * t if an == 'at' else 0)
    for k in range(5):
        a = math.pi + k * math.pi / 4
        F.cap(P((0, -3), 4, a), P((0, -3), 4 + ext + S(t * TAU + k) * 0.8, a), 0.6, 0.4, '#d8b860', over=())
    F.el((0, -3), 6.6, 2.8, '#e8d090')
    for (x, y) in ((-2, -3), (1, -4), (3, -3)): F.px(x, y, '#a07830')
    F.eyes(4, -5, 'a' if an == 'at' else 'n', gap=2)


@foe('lactate', dict(mv=6, at=4))        # 한 방: 둥둥 떠다니다 터지는 젖산 방울
def _(F, an, t):
    r = 5.6 + (1.6 * t if an == 'at' else bob(t, .3))
    F.el((0, -7), r, r, '#d4f060', bias=0.15, grp='b')
    F.px(-2, -10, '#ffffff', on='b'); F.px(-3, -9, '#ffffff', on='b')
    for k in range(3): F.px(-1 + k * 2, -5 + (k % 2), '#90b030', on='b')
    F.eyes(3, -8, 's' if an == 'at' else 'n', gap=3)


@foe('mirna', dict(mv=6, at=4))          # 한 방: 머리핀 RNA 가닥이 꿈틀대는 miRNA 벌레
def _(F, an, t):
    for i in range(7):
        x = -9 + i * 2.6; y = -3 - abs(S(i * 0.8 - t * TAU)) * (3 if an == 'mv' else 5)
        F.el((x, y), 1.7, 1.7, '#ff8af8' if i % 2 else '#d060e0', grp='w%d' % i, over=('w%d' % (i - 1),))
        if i % 2: F.px(x, y - 2, '#ffffff')
    F.eyes(9, -5 - int(abs(S(6 * 0.8 - t * TAU)) * 3), 'a' if an == 'at' else 'n', gap=2)


@foe('zombie', dict(mv=8, at=4))         # 한 방: 세포 자살을 거부한 좀비 세포, 비틀비틀 다가옴
def _(F, an, t):
    sw = S(t * TAU) * 0.15
    for s_, c in ((-1, '#7a6a8a'), (1, '#9a8aaa')):
        F.cap((s_ * 1.6, -4), (s_ * 1.6 + S(t * TAU + s_) * 1.5, 0), 1.2, 1.1, c)
    c = np.array([sw * 6, -10])
    F.el(c, 6, 6.6, '#a898b8', a=sw)
    for k in range(4):
        q = P(c, 6, k * 1.4 + 0.6); F.el(q, 1.5, 1.5, '#c0b0d0', over=())
    reach = 3 if an == 'at' else 0
    F.cap(c + (2, 1), c + (8 + reach, 1 + S(t * TAU) * 1), 1.2, 1.1, '#9a8aaa')
    F.eyes(int(c[0]) + 2, -13, 'z' if an == 'mv' else 'c', gap=3)
    F.mouth(int(c[0]) + 2, -9, 2, 1)


@foe('caf', dict(mv=6, at=4))            # 여러 발: 콜라겐 섬유를 쏘는 암 관련 섬유아세포
def _(F, an, t):
    for k, a in enumerate((-2.6, -0.5, 2.4, 3.6)):
        L_ = 8 + S(t * TAU + k) * 1.5 + (3 if an == 'at' and k == 1 else 0)
        F.cap(P((0, -11), 3, a), P((0, -11), L_, a), 1.2, 0.5, '#a05840', over=())
    F.el((0, -11), 8, 5, '#c87458', a=-0.3)
    F.el((-1, -11), 3, 2.2, '#6a2a20', over=())
    F.cap((-3, -6), (-4, 0), 1.6, 1.4, '#a05840'); F.cap((3, -6), (4, 0), 1.6, 1.4, '#a05840')
    F.eyes(5, -14, 'c' if an == 'at' else 'a')


@foe('p53', dict(mv=6, at=4))            # 여러 발: 색과 모양이 계속 변하는 돌연변이 p53 세포
def _(F, an, t):
    cols = ('#e04a80', '#a04ae0', '#e0a040', '#40c0a0', '#e04a80', '#a04ae0')
    col = cols[int(t * 6) % 6]
    c = (S(t * TAU * 2) * 0.8, -10)
    F.el(c, 8 + S(t * TAU) * 0.8, 8 - S(t * TAU) * 0.8, col)
    for k in range(3):
        q = P(c, 2.6, k * 2.1 + t * 3); F.el(q, 1.8, 1.4, '#3a1030', over=())
    for k in range(6):
        y = -16 + k * 2.4; F.cv.line_decal((c[0] - 7 + (k % 2) * 2, y), (c[0] - 3 + (k % 2) * 2, y), '#ffffff', on=None) if k == int(t * 6) else None
    F.eyes(int(c[0]) + 4, -13, 'c' if an == 'at' else 'a')
    F.mouth(int(c[0]) + 3, -8, 3, 1, teeth=True)


@foe('mdr', dict(mv=6, at=4))            # 여러 발: 막 펌프로 총알을 빨아들였다 되쏘는 다제내성 세포
def _(F, an, t):
    c = (0, -10)
    F.el(c, 9, 8.6, '#5a82c4')
    op = t if an == 'at' else 0
    for k in range(5):
        a = -math.pi * 0.9 + k * math.pi * 0.45
        F.cap(P(c, 7, a), P(c, 10 + op * 2, a), 1.6, 1.6, '#8aa0b8')
        q = P(c, 10.4 + op * 2, a); F.px(q[0], q[1], '#ffe060' if op > .3 else '#2a3a5a')
    F.el(c, 3.4, 3.4, '#2a3a7a', over=())
    F.eyes(5, -13, 'c' if an == 'at' else 'n')


@foe('mimic', dict(mv=6, at=4))          # 여러 발: 가짜 MHC 가면을 쓴 위장 세포 (반투명하게 접근)
def _(F, an, t):
    c = (0, -11 + bob(t, .5))
    F.cap((-2, -3), (-2.5, 0), 1.4, 1.3, '#5a4a7a'); F.cap((2, -3), (2.5, 0), 1.4, 1.3, '#5a4a7a')
    F.el(c, 6.6, 8.6, '#8070a8')
    F.poly([(1, -18), (8, -17), (8.4, -8), (3, -6), (0.5, -10)], '#f0e8d8', dome=((4, -12), 6))
    for (x, y) in ((4, -14), (6.5, -14)): F.px(x, y, '#1a0a20'); F.px(x + 1, y, '#1a0a20')
    F.cv.line_decal((4, -10), (7, -10), '#c04060', on=None)
    if an == 'at':
        F.eyes(-1, -14, 'c', gap=3, n=1)


@foe('giant', dict(mv=8, at=4))          # 여러 발: 핵이 여러 개인 거대 세포, 쿵쿵 짓밟아 충격파
def _(F, an, t):
    up = (S(t * math.pi) * 4) if an == 'at' else 0
    st_ = S(t * TAU)
    F.cap((-5, -6), (-5 - st_ * 1.5, 0), 2.6, 2.4, '#7a2a5a'); F.cap((5, -6), (5 + st_ * 1.5, 0), 2.6, 2.4, '#8a3a6a')
    c = (0, -15 - up)
    F.el(c, 12, 10, '#a84e80')
    for (x, y) in ((-5, -2), (0, -5), (4, 0), (-1, 3)):
        F.el((c[0] + x, c[1] + y), 2.2, 1.8, '#4a1438', over=())
    F.eyes(8, int(c[1]) - 4, 'c' if an == 'at' else 'a', big=True, gap=4)
    F.mouth(6, int(c[1]) + 3, 4, 2 if an == 'at' else 1, teeth=True)


# ========================= 관문 보스 =========================
@foe('gb1', dict(mv=8, a1=6, a2=6), size=110, oy=90)     # 탄저 포자 모함 (공중)
def _(F, an, t):
    tilt = (S(t * math.pi) * -0.25 if an == 'a2' else bob(t, 0.04))
    c = np.array([0, -30 + bob(t, 1.5)])
    rotp = lambda v: c + np.array([v[0] * math.cos(tilt) - v[1] * math.sin(tilt), v[0] * math.sin(tilt) + v[1] * math.cos(tilt)])
    for k in range(4):
        F.flag(rotp((-26, -4 + k * 3)), math.pi + 0.2, 5, 2.4, 0.6, t + k * 0.2, '#5a4a38', 0.8, 0.4)
    for i in range(6):
        x = -22 + i * 8.6
        F.poly([rotp((x - 4.4, -9)), rotp((x + 4.4, -9)), rotp((x + 4.4, 7)), rotp((x - 4.4, 7))], '#c8bca4' if i % 2 else '#b0a48c', dome=(rotp((x, -1)), 10))
    op = S(t * math.pi) if an == 'a1' else 0
    for x in (-14, 0, 14):
        F.el(rotp((x, 8 + op * 2)), 4, 2 + op * 2, '#3a2a20')
        if op > 0.3: F.el(rotp((x, 11 + op * 5)), 2.4, 2.4, '#6a5030')
    F.el(rotp((24, -2)), 9, 8, '#d8ccb0')
    F.el(rotp((26, -2)), 5, 4.4, '#ff5040' if an != 'mv' else '#ffa040', bias=0.2)
    F.el(rotp((27, -3)), 2, 2, '#fff0c0', bias=0.3)
    for x in (-18, -4, 10):
        q = rotp((x, -8)); F.cv.line_decal(q, q + (0, -4), '#8a7a60', on=None); F.el(q + (0, -5), 1.4, 1.4, '#ff4030', bias=0.3)


@foe('gb2', dict(mv=8, a1=6, a2=6), size=110, oy=96)     # 거대 T4 파지 랜더
def _(F, an, t):
    crouch = (S(t * math.pi) * 10 if an == 'a1' and t < 0.6 else 0)
    hop = (-14 * S((t - 0.5) * 2 * math.pi) if an == 'a1' and t >= 0.5 else 0)
    sheath = 1 - (0.45 * S(t * math.pi) if an == 'a2' else 0)
    base = np.array([0, -14 + crouch + hop])
    for k, sx in enumerate((-1, 1, -0.6, 0.6)):
        knee = base + np.array([sx * 14, -6 + (crouch * 0.4) + S(t * TAU + k) * (1.5 if an == 'mv' else 0)])
        foot = np.array([sx * 22 + (S(t * TAU + k) * 2 if an == 'mv' else 0), 0 + min(0, hop)])
        col = '#6a7a9a' if abs(sx) > 0.8 else '#4a5a7a'
        F.cap(base, knee, 1.4, 1.2, col, grp='leg%d' % k, over=())
        F.cap(knee, foot, 1.2, 0.8, col, grp='leg%d' % k, over=())
    F.poly([base + (-9, 0), base + (9, 0), base + (6, 4), base + (-6, 4)], '#8a9ab8', dome=(base, 8))
    top = base + np.array([0, -22 * sheath])
    F.cap(base, top, 4.6, 4.6, '#a8b8d0', grp='sh')
    for k in range(6):
        y = base[1] - (k + 0.5) * 22 * sheath / 6; F.cv.line_decal((-4, y), (4, y), '#5a6a88', on='sh')
    hc = top + np.array([0, -16])
    pts = [P(hc, 15, -math.pi / 2 + k * TAU / 6) for k in range(6)]
    F.poly(pts, '#c8d4f0', dome=(hc, 16))
    for k in range(6): F.cv.line_decal(hc, pts[k], '#8a98c0', on=None)
    F.el(hc + (5, 0), 4.4, 3.4, '#ff4060' if an != 'mv' else '#40e0ff', bias=0.2)
    F.el(hc + (6, -1), 1.6, 1.4, '#ffffff', bias=0.3)
    if an == 'a2' and t > 0.3:
        F.cap(base, base + (0, 10), 1.4, 0.6, '#ffe060', bias=0.3)


@foe('gb3', dict(mv=8, a1=6, a2=6), size=110, oy=96)     # 키메라 융합 종양
def _(F, an, t):
    c = np.array([0, -28 + bob(t, 1.2)])
    for k in range(7):
        a = math.pi + k * math.pi / 6; L_ = 12 + S(t * TAU + k) * 2 + (6 if an == 'a2' else 0) * S(t * math.pi)
        F.flag(P(c + (0, 14), 10, a * 0.5 + math.pi * 0.25), a * 0.3 + math.pi * 0.35, 5, L_ / 5, 0.4, t + k * .15, '#7a2a5a', 1.6, 0.6)
    F.el(c, 26, 22, '#b04a8a')
    for (x, y, r) in ((-12, -10, 7), (8, -14, 8), (-16, 8, 6), (14, 8, 7), (0, 10, 8)):
        F.el(c + (x, y), r, r * 0.9, '#c86aa0', over=())
    for (x, y) in ((-6, 2), (6, 4), (-2, -6)): F.el(c + (x, y), 3, 2.4, '#4a1438', over=())
    heads = (((22, -10), '#e05a8a'), ((14, -26), '#8a50c0'), ((-6, -28), '#d0a040'))
    for i, (o, col) in enumerate(heads):
        op = (S(t * math.pi) if an == 'a1' else 0)
        hc = c + o + (np.array(o) / 30 * op * 4)
        F.el(hc, 8, 7, col)
        F.eyes(int(hc[0]) + 2, int(hc[1]) - 3, 'c' if an != 'mv' else 'a', big=True, gap=4)
        F.mouth(int(hc[0]) + 1, int(hc[1]) + 2, 4, 2 if op > 0.3 else 0, teeth=True)
