# 헬릭스 지역별 소품 (주인공과 같은 3D 도트 렌더러, 정면 한 방향)
#   python3 props.py [출력폴더]
import sys, os, math, json
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../helix-hero'))
import numpy as np
from PIL import Image
from rig import *
TAU = 2 * math.pi
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '../../games/helix/assets/world/')
def M_(r, em=False, glow=None): return Mat(r, em, glow or (r[2] if em else None))
def V(*a): return np.array(a, float)
def cyl(M, a, b, r, mat, pid=None): M.add(capsule(V(*a), V(*b), r, r, caps=False), mat, pid); M.add(oriented_ellipsoid(V(*b), np.eye(3), (r, 0.25, r)), mat, pid)
def bx(M, c, h, mat, pid=None, R=np.eye(3)): M.add(box(V(*c), R, h), mat, pid)
def ell(M, c, r, mat, pid=None): M.add(ellipsoid(V(*c), r), mat, pid)
def cap(M, a, b, r1, r2, mat, pid=None): M.add(capsule(V(*a), V(*b), r1, r2), mat, pid)

# 공용 재질
METAL = M_(['#1a1e26', '#30363e', '#4a525c', '#6e7884', '#a4aeb8'])
STEEL = M_(['#3a4048', '#5a646e', '#838e98', '#b4bec8', '#e4eaf0'])
WHITE = M_(['#5a6068', '#868c94', '#b0b6bc', '#d6dade', '#f2f4f6'])
WOOD = M_(['#24160c', '#3a2414', '#54361e', '#704a2a', '#8e6038'])
DWOOD = M_(['#140c06', '#22160c', '#342214', '#48301c'])
STONE = M_(['#22261e', '#343a2e', '#48503e', '#5e6850', '#788266'])
GLASS = M_(['#2a4a54', '#4a7a86', '#7ab4c0', '#b8e4ec', '#ffffff'])
LEAF = M_(['#10220e', '#1a3616', '#26501e', '#346a28', '#4a8a36'])
CLOTH_R = M_(['#3a0e12', '#621a20', '#8e2a30', '#b84a4a'])
CLOTH_T = M_(['#0e3a3a', '#14585a', '#1e7a7a', '#3aa0a0'])
GOLD = M_(['#3a2408', '#6a4612', '#a87a20', '#e0b83a', '#fff0a0'])
RUST = M_(['#2a160a', '#4a2a12', '#6e401e', '#8e5a2c'])
def GLOW(c1, c2, c3, c4='#ffffff'): return M_([c1, c2, c3, c4], True, c2)
G_GREEN = GLOW('#0a7a4a', '#2ae08a', '#a0ffd0')
G_CYAN = GLOW('#0a5a7a', '#2ac0f0', '#a0f0ff')
G_PURP = GLOW('#5a1a8a', '#b04aff', '#e4aaff')
G_AMBER = GLOW('#7a4a00', '#ffb020', '#ffe8a0')
G_RED = GLOW('#7a0a1a', '#ff3a4a', '#ffb0b8')
G_PINK = GLOW('#7a1a5a', '#ff5ad0', '#ffc0f0')

PROPS = {}
def prop(name, area, rad, block=True, breakable=False, frames=1):
    def deco(f): PROPS[name] = dict(fn=f, area=area, rad=rad, block=block, brk=breakable, frames=frames); return f
    return deco

# ============================================================ 공용
@prop('gate', 'all', 0, block=False, frames=2)
def gate(M, f=0):
    """방 출구 문틀 (f=1 열림: 빛나는 막 사라짐)"""
    for s in (1, -1):
        cyl(M, (s * 16, 0, 0), (s * 16, 30, 0), 3.0, METAL); ell(M, (s * 16, 31, 0), 3.4, STEEL)
        for y in (6, 14, 22): M.add(capsule(V(s * 16, y, 0), V(s * 16, y + 1.2, 0), 3.3, 3.3, caps=False), STEEL)
    cap(M, (-16, 33, 0), (16, 33, 0), 2.4, 2.4, METAL)
    ell(M, (0, 35, 0.5), (3.2, 2.4, 2.0), STEEL)
    if f == 0:
        for k in range(9):
            x = -13 + k * 3.25; cap(M, (x, 1, 0), (x, 31, 0), 0.5, 0.5, G_CYAN)
    else:
        for s in (1, -1): ell(M, (s * 13, 2, 0), (1.5, 0.6, 1.5), G_GREEN)

@prop('pedestal', 'all', 12)
def pedestal(M, f=0):
    cyl(M, (0, 0, 0), (0, 3, 0), 9, STONE); cyl(M, (0, 3, 0), (0, 10, 0), 5, STEEL); cyl(M, (0, 10, 0), (0, 12, 0), 7, METAL)
    for k in range(6):
        a = k * TAU / 6; ell(M, (math.cos(a) * 7.5, 12.3, math.sin(a) * 7.5), 0.8, G_CYAN)

@prop('fountain', 'all', 22)
def fountain(M, f=0):
    """휴식방 재생 배양조"""
    cyl(M, (0, 0, 0), (0, 4, 0), 18, STONE); cyl(M, (0, 4, 0), (0, 5, 0), 15, G_GREEN)
    cyl(M, (0, 0, 0), (0, 14, 0), 4, METAL)
    for s in range(3):
        a = s * TAU / 3; cap(M, (math.cos(a) * 4, 12, math.sin(a) * 4), (math.cos(a) * 9, 24, math.sin(a) * 9), 1.0, 0.8, STEEL)
    ell(M, (0, 26, 0), (7, 7, 7), GLASS); ell(M, (0, 25, 0), (5.5, 5.5, 5.5), G_GREEN)
    for k in range(5): ell(M, (math.cos(k * 1.3) * 3, 22 + k * 1.5, math.sin(k * 1.3) * 3), 0.7, GLOW('#a0ffd0', '#e0fff0', '#ffffff'))

@prop('shopkeep_stand', 'all', 26)
def shop_stand(M, f=0):
    bx(M, (0, 7, 0), (20, 7, 7), WOOD); bx(M, (0, 14.5, 0), (21, 0.8, 8), DWOOD)
    for s in (1, -1): cyl(M, (s * 19, 0, -6), (s * 19, 34, -6), 1.2, DWOOD)
    for k in range(5): bx(M, (-16 + k * 8, 34 + (k % 2) * 1.5, -2), (4.5, 0.7, 10), CLOTH_T if k % 2 else CLOTH_R, R=rot_x(-0.35))
    for k in range(6):
        x = -14 + k * 5.5; cyl(M, (x, 15, 2), (x, 19, 2), 1.4, GLASS); ell(M, (x, 17, 2), 1.2, [G_GREEN, G_PINK, G_AMBER, G_CYAN, G_PURP, G_RED][k])

# ============================================================ 마을 '쉼터'
@prop('hub_house', 'hub', 46)
def hub_house(M, f=0):
    bx(M, (0, 16, 0), (30, 16, 18), M_(['#2a2a24', '#3c3c32', '#504e42', '#666452', '#7e7c66']))
    for x in (-30, 30):
        for z in (-18, 18): cyl(M, (x, 0, z), (x, 32, z), 1.6, DWOOD)
    # 지붕(초록 판)
    for s in (1, -1): bx(M, (s * 0.1, 40, s * 9), (34, 1.4, 12), M_(['#14261a', '#1e3a26', '#2a5032', '#386a40']), R=rot_x(s * 0.55))
    cap(M, (-34, 46, 0), (34, 46, 0), 1.4, 1.4, DWOOD)
    bx(M, (0, 10, 18.5), (6, 10, 0.6), DWOOD); ell(M, (4, 10, 19.2), 0.6, GOLD)
    for s in (1, -1):
        bx(M, (s * 18, 20, 18.4), (6, 5, 0.5), M_(['#1a3a3a', '#2a5a5a', '#5ab0a0', '#a0f0d8'], True, '#3ac8a0'))
        bx(M, (s * 18, 20, 18.8), (0.4, 5, 0.3), DWOOD); bx(M, (s * 18, 20, 18.8), (6, 0.4, 0.3), DWOOD)
    cyl(M, (22, 44, -6), (22, 54, -6), 2.4, METAL); ell(M, (22, 56, -6), (3, 1.5, 3), STEEL)

@prop('lab_tent', 'hub', 36)
def lab_tent(M, f=0):
    for s in (1, -1): bx(M, (s * 9, 18, 0), (12, 0.8, 18), M_(['#4a4a3a', '#6e6e56', '#949478', '#bcbc9c']), R=rot_z(-s * 0.75))
    cap(M, (0, 26, -18), (0, 26, 18), 1.0, 1.0, DWOOD)
    for s in (1, -1): cyl(M, (s * 17, 0, 16), (s * 17, 10, 16), 0.8, DWOOD)
    bx(M, (0, 6, 14), (10, 6, 6), WHITE); bx(M, (0, 12.5, 14), (11, 0.6, 7), METAL)
    for k in range(4): cyl(M, (-7 + k * 4.5, 13, 15), (-7 + k * 4.5, 17, 15), 1.1, GLASS); ell(M, (-7 + k * 4.5, 15, 15), 0.9, [G_GREEN, G_CYAN, G_PINK, G_AMBER][k])

@prop('hub_tank', 'hub', 24)
def hub_tank(M, f=0):
    """마을 중앙의 거대 배양 탑 (발광)"""
    cyl(M, (0, 0, 0), (0, 6, 0), 18, STONE); cyl(M, (0, 6, 0), (0, 10, 0), 13, METAL)
    cyl(M, (0, 10, 0), (0, 52, 0), 10.5, GLASS)
    cyl(M, (0, 10, 0), (0, 50, 0), 9.0, G_GREEN)
    for y in (18, 30, 42): M.add(capsule(V(0, y, 0), V(0, y + 1.5, 0), 11.2, 11.2, caps=False), METAL)
    cyl(M, (0, 52, 0), (0, 58, 0), 12, METAL); ell(M, (0, 60, 0), (6, 3, 6), STEEL)
    for k in range(4):
        a = k * TAU / 4 + 0.4; cap(M, (math.cos(a) * 12, 56, math.sin(a) * 12), (math.cos(a) * 17, 2, math.sin(a) * 17), 1.4, 1.4, METAL)
    # 안쪽 나선
    for k in range(40):
        y = 12 + k * 0.95; a = k * 0.5
        ell(M, (math.cos(a) * 4.5, y, math.sin(a) * 4.5 + 5), 0.8, GLOW('#a0ffd0', '#e0fff0', '#ffffff'))
        ell(M, (-math.cos(a) * 4.5, y, -math.sin(a) * 4.5 + 5), 0.8, G_PINK)

@prop('lamp', 'hub', 5)
def lamp(M, f=0):
    cyl(M, (0, 0, 0), (0, 2, 0), 3.5, STONE); cyl(M, (0, 2, 0), (0, 30, 0), 0.9, METAL)
    cap(M, (0, 30, 0), (4, 32, 0), 0.7, 0.7, METAL); ell(M, (5, 30, 0), (2.4, 3.0, 2.4), G_AMBER)
    ell(M, (5, 33, 0), (2.8, 0.8, 2.8), METAL)

@prop('glowtree', 'hub', 14)
def glowtree(M, f=0):
    r = np.random.default_rng(3)
    cap(M, (0, 0, 0), (1, 22, 0), 3.4, 2.0, DWOOD)
    for k in range(3):
        a = k * 2.1; cap(M, (0, 0, 0), (math.cos(a) * 7, -0.5, math.sin(a) * 7), 2.0, 0.8, DWOOD)
    for k in range(9):
        p = V(r.uniform(-11, 11), 24 + r.uniform(-4, 10), r.uniform(-8, 8)); M.add(ellipsoid(p, r.uniform(4.5, 7.5)), LEAF)
    for k in range(14):
        p = V(r.uniform(-12, 12), 20 + r.uniform(-2, 14), r.uniform(-2, 9)); M.add(ellipsoid(p, 0.9), G_CYAN if k % 2 else G_GREEN)

@prop('bench', 'hub', 14)
def bench(M, f=0):
    bx(M, (0, 5, 0), (12, 0.8, 3.5), WOOD); bx(M, (0, 10, -3), (12, 2.5, 0.6), WOOD)
    for s in (1, -1): bx(M, (s * 10, 2.5, 0), (0.8, 2.5, 3), METAL)

@prop('crates', 'hub', 13)
def crates(M, f=0):
    bx(M, (-4, 5, 0), (6, 5, 6), WOOD); bx(M, (6, 4, 2), (4.5, 4, 4.5), WOOD, R=rot_y(0.3)); bx(M, (-2, 13, -1), (4, 3.5, 4), WOOD, R=rot_y(-0.2))
    for (x, y) in ((-4, 5), (6, 4)): bx(M, (x, y, 6.2 if x < 0 else 6.6), (0.5, 4, 0.2), DWOOD)

@prop('altar', 'hub', 20)
def altar(M, f=0):
    """유전체 강화대 (영구 강화)"""
    cyl(M, (0, 0, 0), (0, 4, 0), 16, STONE); cyl(M, (0, 4, 0), (0, 8, 0), 12, METAL)
    bx(M, (0, 15, 0), (8, 7, 5), METAL); bx(M, (0, 22.5, 0.5), (9, 0.8, 6), STEEL)
    bx(M, (0, 30, -2), (10, 7, 0.8), M_(['#0a1a1a', '#123232', '#1a4a4a', '#2a6a6a'], True, '#2ae0c0'), R=rot_x(-0.3))
    for k in range(30):
        y = 24 + k * 0.6; a = k * 0.6
        ell(M, (math.cos(a) * 3, y + 8, math.sin(a) * 3), 0.6, G_GREEN); ell(M, (-math.cos(a) * 3, y + 8, -math.sin(a) * 3), 0.6, G_PINK)

@prop('dummy', 'hub', 9)
def dummy(M, f=0):
    cyl(M, (0, 0, 0), (0, 3, 0), 6, STONE); cyl(M, (0, 3, 0), (0, 14, 0), 1.2, DWOOD)
    ell(M, (0, 20, 0), (5, 7, 4), M_(['#4a3a1a', '#6a5428', '#8e7238', '#b0904a'])); ell(M, (0, 30, 0), 3.6, M_(['#4a3a1a', '#6a5428', '#8e7238', '#b0904a']))
    cap(M, (-8, 22, 0), (8, 22, 0), 1.0, 1.0, DWOOD)
    for k in range(3): ell(M, (0, 16 + k * 4, 4), (2.5, 0.5, 0.3), CLOTH_R)

@prop('portal', 'hub', 0, block=False, frames=4)
def portal(M, f=0):
    """출정 관문: 이중나선 고리"""
    for s in (1, -1):
        cyl(M, (s * 22, 0, 0), (s * 22, 6, 0), 6, STONE)
    for k in range(48):
        a = k / 48 * math.pi; x = math.cos(a) * 22; y = 6 + math.sin(a) * 36
        ell(M, (x, y, 0), 2.6, METAL)
        ph = a * 6 + f * TAU / 4
        ell(M, (x + math.cos(ph) * 0.2, y, math.sin(ph) * 3), 1.0, G_GREEN); ell(M, (x, y, -math.sin(ph) * 3), 1.0, G_PINK)
    M.add(oriented_ellipsoid(V(0, 24, -1), np.eye(3), (18, 20, 0.6)), GLOW('#0a3a2a', '#1a7a5a', '#4ad8a0', '#c0ffe8'))
    for k in range(8):
        a = k * TAU / 8 + f * 0.4; ell(M, (math.cos(a) * 10, 24 + math.sin(a) * 12, 0), 1.0, GLOW('#a0ffd0', '#e0fff0', '#ffffff'))

@prop('signpost', 'hub', 5)
def signpost(M, f=0):
    cyl(M, (0, 0, 0), (0, 22, 0), 1.0, DWOOD); bx(M, (5, 18, 0), (7, 2.2, 0.6), WOOD, R=rot_z(0.08)); bx(M, (-4, 13, 0), (6, 2.0, 0.6), WOOD, R=rot_z(-0.1))

@prop('planter', 'hub', 9)
def planter(M, f=0):
    cyl(M, (0, 0, 0), (0, 6, 0), 7, STONE)
    r = np.random.default_rng(8)
    for k in range(6): M.add(ellipsoid(V(r.uniform(-4, 4), 8 + r.uniform(0, 4), r.uniform(-4, 4)), r.uniform(2.5, 4)), LEAF)
    for k in range(5): ell(M, (r.uniform(-5, 5), 10 + r.uniform(0, 5), r.uniform(0, 5)), 1.0, [G_PINK, G_AMBER, G_CYAN][k % 3])

# ============================================================ 1장 배양실
@prop('lab_bench', 'lab', 24)
def lab_bench(M, f=0):
    bx(M, (0, 7, 0), (18, 7, 7), WHITE); bx(M, (0, 14.6, 0), (19, 0.7, 8), M_(['#1a1e22', '#2a3036', '#3a424a', '#4e5862']))
    for k in range(3): bx(M, (-12 + k * 12, 7, 7.2), (5, 5, 0.3), STEEL); ell(M, (-12 + k * 12, 9, 7.6), 0.5, METAL)
    cyl(M, (-12, 15, 0), (-12, 22, 0), 1.6, GLASS); ell(M, (-12, 17, 0), 1.4, G_GREEN)
    ell(M, (-4, 18, 2), (3.0, 3.2, 3.0), GLASS); ell(M, (-4, 17, 2), 2.4, G_PINK); cyl(M, (-4, 20, 2), (-4, 24, 2), 0.9, GLASS)
    for k in range(3): cyl(M, (6 + k * 2.6, 15, -2), (6 + k * 2.6, 21, -2), 0.8, GLASS); ell(M, (6 + k * 2.6, 17, -2), 0.6, [G_CYAN, G_AMBER, G_GREEN][k])
    bx(M, (14, 17, 1), (3.5, 2.4, 3.5), METAL); ell(M, (14, 17, 4.6), 0.8, G_RED)

@prop('incubator', 'lab', 16)
def incubator(M, f=0):
    bx(M, (0, 14, 0), (11, 14, 9), WHITE); bx(M, (0, 15, 9.2), (8, 9, 0.4), GLASS)
    for y in (9, 15, 21): bx(M, (0, y, 6), (7, 0.4, 2.5), STEEL); ell(M, (-3, y + 1, 7), (2.2, 0.6, 1.5), G_PINK); ell(M, (3, y + 1, 7), (2.2, 0.6, 1.5), G_GREEN)
    bx(M, (0, 26, 9.3), (8, 1.6, 0.3), METAL); ell(M, (6, 26, 9.6), 0.6, G_GREEN); ell(M, (3, 26, 9.6), 0.6, G_AMBER)

@prop('agar_tank', 'lab', 12)
def agar_tank(M, f=0):
    cyl(M, (0, 0, 0), (0, 4, 0), 9, METAL); cyl(M, (0, 4, 0), (0, 34, 0), 7, GLASS); cyl(M, (0, 4, 0), (0, 28, 0), 6, G_GREEN)
    cyl(M, (0, 34, 0), (0, 37, 0), 8, METAL)
    for k in range(6): ell(M, (math.cos(k) * 3, 8 + k * 3.5, math.sin(k) * 3 + 3), 0.8, GLOW('#d0ffe0', '#ffffff', '#ffffff'))
    ell(M, (0, 16, 2), (3, 4, 3), M_(['#2a3a1a', '#4a6a2a', '#6a9a3a', '#9ac85a']))   # 안에 든 표본

@prop('centrifuge', 'lab', 11)
def centrifuge(M, f=0):
    bx(M, (0, 6, 0), (9, 6, 9), WHITE); cyl(M, (0, 12, 0), (0, 14, 0), 8, STEEL); ell(M, (0, 14.5, 0), (6, 1.2, 6), GLASS)
    bx(M, (0, 7, 9.2), (6, 2, 0.3), METAL); ell(M, (-3, 7, 9.6), 0.6, G_RED); ell(M, (3, 7, 9.6), 0.6, G_GREEN)

@prop('jar', 'lab', 6, breakable=True)
def jar_lab(M, f=0):
    cyl(M, (0, 0, 0), (0, 9, 0), 4.2, GLASS); cyl(M, (0, 0.5, 0), (0, 6, 0), 3.6, G_GREEN); cyl(M, (0, 9, 0), (0, 11, 0), 4.6, METAL)

@prop('biobin', 'lab', 8)
def biobin(M, f=0):
    cyl(M, (0, 0, 0), (0, 13, 0), 6, M_(['#5a1a1a', '#8a2a24', '#b8402e', '#e06a4a']))
    cyl(M, (0, 13, 0), (0, 14.5, 0), 6.5, M_(['#4a1010', '#6a1a1a', '#8a2a24', '#b8402e']))
    ell(M, (0, 8, 5.8), (3, 3, 0.4), GOLD)

@prop('shelf', 'lab', 18)
def shelf(M, f=0):
    for s in (1, -1): bx(M, (s * 14, 18, 0), (0.8, 18, 5), METAL)
    for y in (2, 12, 22, 32): bx(M, (0, y, 0), (14, 0.6, 5), STEEL)
    r = np.random.default_rng(11)
    for y in (3, 13, 23):
        for k in range(5):
            x = -11 + k * 5.5 + r.uniform(-1, 1); h = r.uniform(3, 7)
            cyl(M, (x, y, 1), (x, y + h, 1), r.uniform(1.0, 1.8), GLASS); ell(M, (x, y + h * 0.4, 1), 0.9, [G_GREEN, G_PINK, G_AMBER, G_CYAN][k % 4])

# ============================================================ 2장 하수 저장고
@prop('pipe', 'sewer', 10)
def pipe(M, f=0):
    cyl(M, (0, 0, 0), (0, 40, 0), 5, RUST)
    for y in (8, 24): M.add(capsule(V(0, y, 0), V(0, y + 2, 0), 6, 6, caps=False), METAL)
    cap(M, (0, 30, 0), (0, 30, 9), 3, 3, RUST); ell(M, (0, 30, 9.5), (3.4, 3.4, 0.8), METAL)
    ell(M, (0, 26, 9.4), (1.2, 2.5, 1.2), M_(['#2a4a1a', '#4a7a2a', '#7aaa3a', '#b0e05a']))   # 흘러내리는 오수

@prop('valve', 'sewer', 12)
def valve(M, f=0):
    cyl(M, (0, 0, 0), (0, 12, 0), 4, METAL); cap(M, (-10, 6, 0), (10, 6, 0), 3, 3, RUST)
    M.add(capsule(V(0, 15, 0), V(0, 15.5, 0), 6, 6, caps=False), M_(['#5a0a0a', '#8a1a1a', '#c02a2a', '#e05a4a']))
    for k in range(4): a = k * TAU / 4; cap(M, (0, 15.2, 0), (math.cos(a) * 6, 15.2, math.sin(a) * 6), 0.6, 0.6, M_(['#5a0a0a', '#8a1a1a', '#c02a2a', '#e05a4a']))

@prop('barrel', 'sewer', 7, breakable=True)
def barrel(M, f=0):
    cyl(M, (0, 0, 0), (0, 12, 0), 5, M_(['#1a2a12', '#2a4018', '#3a5a22', '#4e762c']))
    for y in (2, 10): M.add(capsule(V(0, y, 0), V(0, y + 1, 0), 5.3, 5.3, caps=False), RUST)
    ell(M, (0, 12.4, 0), (4.6, 0.4, 4.6), G_GREEN); ell(M, (0, 6, 5.2), (1.6, 1.6, 0.3), GOLD)

@prop('shroom_patch', 'sewer', 10)
def shroom_patch(M, f=0):
    r = np.random.default_rng(5)
    for k in range(5):
        x, z = r.uniform(-7, 7), r.uniform(-4, 4); h = r.uniform(5, 14); R = r.uniform(3, 5.5)
        cyl(M, (x, 0, z), (x, h, z), 1.1, M_(['#8a8270', '#b4ac94', '#d8d0b8', '#f0e8d0']))
        ell(M, (x, h + 0.5, z), (R, R * 0.45, R), M_(['#1a3a3a', '#2a5a58', '#3a8a80', '#6ac8b8'], True, '#3ac8b0'))

@prop('bones', 'sewer', 9, block=False)
def bonepile(M, f=0):
    r = np.random.default_rng(2); BONE = M_(['#6a6250', '#9a907a', '#c8bea4', '#ece4cc'])
    for k in range(8):
        x, z = r.uniform(-7, 7), r.uniform(-4, 4); a = r.uniform(0, TAU)
        cap(M, (x, 1, z), (x + math.cos(a) * 5, 1, z + math.sin(a) * 3), 0.7, 0.7, BONE)
    ell(M, (2, 2.5, 0), (2.6, 2.2, 2.4), BONE); ell(M, (1.2, 2.6, 2.1), 0.5, M_(['#0a0806', '#140e0a', '#1e160e', '#2a1e14']))

@prop('sewer_grate', 'sewer', 0, block=False)
def sewer_grate(M, f=0):
    bx(M, (0, 0.4, 0), (12, 0.4, 8), METAL)
    for k in range(7): bx(M, (-9 + k * 3, 0.9, 0), (0.6, 0.3, 7), STEEL)

@prop('crate_rot', 'sewer', 9, breakable=True)
def crate_rot(M, f=0):
    bx(M, (0, 5, 0), (6, 5, 6), M_(['#1a140c', '#2a2014', '#3a2e1c', '#4e3e26']))
    for y in (2, 8): bx(M, (0, y, 6.2), (6, 0.6, 0.2), DWOOD)
    ell(M, (3, 10.4, 2), (2.5, 0.8, 2.5), M_(['#1a3a1a', '#2a5a22', '#3a7a2a', '#5aa03a']))

# ============================================================ 3장 격리 병동
@prop('bed', 'ward', 22)
def bed(M, f=0):
    bx(M, (0, 7, 0), (8, 1.5, 16), STEEL); bx(M, (0, 9.5, 0), (7.5, 1.6, 15), WHITE); ell(M, (0, 11.5, -11), (5, 1.6, 3), WHITE)
    for x in (-7, 7):
        for z in (-14, 14): cyl(M, (x, 0, z), (x, 7, z), 0.7, METAL)
    bx(M, (0, 12, -15.5), (8, 6, 0.6), STEEL)
    bx(M, (0, 11.6, 4), (7.6, 0.8, 9), CLOTH_T)
    ell(M, (3, 11.8, 8), (2.2, 0.5, 2.0), M_(['#5a1018', '#7a1a22', '#9a2a30', '#b84048']))   # 얼룩

@prop('iv_stand', 'ward', 5)
def iv_stand(M, f=0):
    cyl(M, (0, 0, 0), (0, 1, 0), 4, METAL); cyl(M, (0, 1, 0), (0, 32, 0), 0.6, STEEL); cap(M, (-4, 32, 0), (4, 32, 0), 0.5, 0.5, STEEL)
    ell(M, (3.5, 27, 0), (2.0, 3.4, 1.2), GLASS); ell(M, (3.5, 26, 0.3), (1.6, 2.4, 1.0), G_PURP)
    cap(M, (3.5, 23, 0), (1, 6, 2), 0.25, 0.25, GLASS)

@prop('curtain', 'ward', 18)
def curtain(M, f=0):
    cap(M, (-18, 34, 0), (18, 34, 0), 0.6, 0.6, STEEL)
    for s in (-18, 18): cyl(M, (s, 0, 0), (s, 34, 0), 0.6, STEEL)
    for k in range(12):
        x = -16 + k * 2.9; z = 1.2 * math.sin(k * 1.6)
        bx(M, (x, 18, z), (1.6, 15, 0.4), M_(['#3a5a58', '#4e7472', '#668e8a', '#80aaa4']))
    for k in range(4): ell(M, (-10 + k * 6, 6 + (k % 2) * 8, 1.5), (1.6, 2.2, 0.5), M_(['#2a0a3a', '#4a1a5a', '#7a3a8a', '#b06ac0']))

@prop('barrier', 'ward', 18)
def barrier(M, f=0):
    for s in (1, -1): cyl(M, (s * 15, 0, 0), (s * 15, 16, 0), 1.2, METAL); ell(M, (s * 15, 17, 0), 1.6, G_RED)
    for k in range(6):
        bx(M, (-12.5 + k * 5, 11, 0), (2.5, 3, 0.6), M_(['#6a5000', '#a07a10', '#e0b020', '#ffd84a']) if k % 2 else M_(['#0e0e0e', '#1a1a1a', '#2a2a2a', '#3a3a3a']))
    bx(M, (0, 4, 0), (15, 0.6, 0.6), METAL)

@prop('cabinet', 'ward', 12)
def cabinet(M, f=0):
    bx(M, (0, 14, 0), (9, 14, 6), WHITE)
    for y in (6, 16, 24): bx(M, (0, y, 6.2), (8, 3.6, 0.3), STEEL); ell(M, (0, y, 6.6), 0.6, METAL)
    bx(M, (3, 29, 0), (3, 1.2, 3), CLOTH_R); ell(M, (3, 30.5, 0), (1.5, 0.5, 1.5), WHITE)

@prop('fungus', 'ward', 11)
def fungus(M, f=0):
    r = np.random.default_rng(7); F = M_(['#1e0a2a', '#3a1450', '#5e2a7a', '#8a50a8', '#c890e0'])
    for k in range(7):
        p = V(r.uniform(-7, 7), r.uniform(2, 10), r.uniform(-5, 5)); M.add(ellipsoid(p, r.uniform(2.5, 5)), F)
    for k in range(9):
        p = V(r.uniform(-8, 8), r.uniform(4, 14), r.uniform(-2, 6)); M.add(ellipsoid(p, r.uniform(0.6, 1.2)), G_PURP)

@prop('pod_ward', 'ward', 7, breakable=True)
def pod_ward(M, f=0):
    ell(M, (0, 6, 0), (5, 6.5, 5), M_(['#2a0a3a', '#4a1a5a', '#6e2e80', '#9a50a8'])); ell(M, (0, 7, 3.2), (2.2, 3, 1.8), G_PURP)
    for k in range(4): a = k * TAU / 4; cap(M, (math.cos(a) * 4, 0.5, math.sin(a) * 4), (math.cos(a) * 2, 5, math.sin(a) * 2), 1.0, 0.8, M_(['#1e0a2a', '#3a1450', '#5e2a7a', '#8a50a8']))

# ============================================================ 4장 유전체 금고
CRY = M_(['#1a0c3a', '#3a2070', '#6a48b0', '#a888e8', '#f0e8ff'])
DMET = M_(['#06040c', '#0e0a18', '#181428', '#241e3c', '#342c54'])
@prop('crystal', 'vault', 12)
def crystal(M, f=0):
    import rig as R_
    for k, (x, z, h, r, a) in enumerate(((0, 0, 30, 4.5, 0), (-6, 2, 18, 3, -0.35), (6, -1, 22, 3.4, 0.3), (2, 5, 12, 2.4, 0.15))):
        d = np.array([math.sin(a), 1, 0.1]); d /= np.linalg.norm(d); _, u, w = R_._basis(d)
        c = V(x, 0, z); top = c + d * h; ring = [c + (u * math.cos(t) + w * math.sin(t)) * r for t in np.linspace(0, TAU, 7)[:-1]]
        tris = [(top, ring[i], ring[(i + 1) % 6]) for i in range(6)]
        ps, ns = [], []
        for A, B, D in tris:
            n = np.cross(B - A, D - A); n /= np.linalg.norm(n)
            if np.dot(n, (A + B + D) / 3 - c) < 0: n = -n
            kk = int(max(np.linalg.norm(B - A), np.linalg.norm(D - A)) * DENS * 1.3) + 2
            for i in range(kk + 1):
                for j in range(kk + 1 - i): ps.append(A + (B - A) * i / kk + (D - A) * j / kk); ns.append(n)
        M.add((np.array(ps), np.array(ns)), CRY if k % 2 == 0 else M_(['#2a0c3a', '#4a2070', '#7a48b0', '#c088e8', '#ffe8ff']))
    ell(M, (0, 8, 3), 1.4, G_PURP)

@prop('data_core', 'vault', 14)
def data_core(M, f=0):
    bx(M, (0, 20, 0), (9, 20, 9), DMET)
    for y in range(4, 38, 4):
        for s in (-5, 0, 5): ell(M, (s, y, 9.3), (1.4, 0.5, 0.3), [G_GREEN, G_CYAN, G_PURP][(y // 4 + s) % 3])
    bx(M, (0, 41, 0), (10, 1, 10), STEEL); ell(M, (0, 43, 0), (4, 1.5, 4), G_CYAN)

@prop('helix_statue', 'vault', 14)
def helix_statue(M, f=0):
    cyl(M, (0, 0, 0), (0, 5, 0), 11, DMET); cyl(M, (0, 5, 0), (0, 8, 0), 8, STEEL)
    for k in range(56):
        y = 9 + k * 0.62; a = k * 0.42
        ell(M, (math.cos(a) * 4.5, y, math.sin(a) * 4.5), 1.1, G_GREEN); ell(M, (-math.cos(a) * 4.5, y, -math.sin(a) * 4.5), 1.1, G_PINK)
        if k % 5 == 0: cap(M, (math.cos(a) * 4.5, y, math.sin(a) * 4.5), (-math.cos(a) * 4.5, y, -math.sin(a) * 4.5), 0.4, 0.4, STEEL)

@prop('conduit', 'vault', 9)
def conduit(M, f=0):
    cyl(M, (0, 0, 0), (0, 4, 0), 7, DMET)
    for k in range(4): M.add(capsule(V(0, 4 + k * 7, 0), V(0, 9 + k * 7, 0), 3, 3, caps=False), DMET); M.add(capsule(V(0, 9 + k * 7, 0), V(0, 11 + k * 7, 0), 3.6, 3.6, caps=False), G_CYAN)
    ell(M, (0, 34, 0), 3.2, G_CYAN)

@prop('cell_cache', 'vault', 7, breakable=True)
def cell_cache(M, f=0):
    bx(M, (0, 4, 0), (5, 4, 5), DMET); bx(M, (0, 8.5, 0), (5.4, 0.6, 5.4), STEEL)
    ell(M, (0, 4, 5.2), (2.4, 2.4, 0.4), G_PURP); for_ = None

@prop('vault_pillar', 'vault', 11)
def vault_pillar(M, f=0):
    bx(M, (0, 3, 0), (9, 3, 9), DMET); cyl(M, (0, 6, 0), (0, 44, 0), 6, DMET); bx(M, (0, 46, 0), (9, 2, 9), DMET)
    for y in (14, 26, 38): M.add(capsule(V(0, y, 0), V(0, y + 1, 0), 6.4, 6.4, caps=False), G_PURP)

# ------------------------------------------------------------------ 렌더 + 아틀라스
def model_of(name, f):
    M = Model(); PROPS[name]['fn'](M, f); return M

def bounds(M):
    P = np.concatenate([p for p, n, m, i in M.parts]); sx, sy, _ = view_xform(P, 0.0)
    return np.abs(sx).max(), sy.max(), max(0, -sy.min())

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    imgs = []; meta = {}
    for name, p in PROPS.items():
        fr = []
        xs = yu = yd = 0
        for f in range(p['frames']):
            M = model_of(name, f); a, b, c = bounds(M); xs = max(xs, a); yu = max(yu, b); yd = max(yd, c)
        W = int(math.ceil(2 * xs + 8)); W += W % 2; foot = int(math.ceil(yu + 4)); H = int(math.ceil(foot + yd + 4))
        for f in range(p['frames']):
            fr.append(Image.fromarray(render(model_of(name, f), 0.0, W, H, foot)))
        if p['brk']:   # 부서진 모습: 아래 1/3만 남기고 조각
            im = fr[0].copy(); a = np.array(im); cut = int(foot - (foot) * 0.45)
            a[:cut] = 0; r = np.random.default_rng(1)
            m = a[..., 3] > 0; yy, xx = np.nonzero(m)
            for k in range(len(yy) // 6): i = r.integers(0, len(yy)); a[yy[i], xx[i], 3] = 0
            fr.append(Image.fromarray(a))
        imgs.append((name, fr, W, H, foot))
        print(name, W, H)
    # 줄 단위 아틀라스 (폭 1024)
    AW = 1024; x = y = rowh = 0; place = []
    for name, fr, W, H, foot in imgs:
        tw = W * len(fr)
        if x + tw > AW: x = 0; y += rowh; rowh = 0
        place.append((name, x, y)); x += tw; rowh = max(rowh, H)
    AH = y + rowh
    atlas = Image.new('RGBA', (AW, AH))
    for (name, fr, W, H, foot), (_, px, py) in zip(imgs, place):
        for k, im in enumerate(fr): atlas.paste(im, (px + k * W, py))
        p = PROPS[name]
        meta[name] = dict(x=px, y=py, w=W, h=H, foot=foot, n=len(fr), area=p['area'], rad=p['rad'] * 2, block=p['block'], brk=p['brk'])
    atlas.save(os.path.join(OUT, 'props.webp'), 'WEBP', lossless=True, method=6)
    json.dump(meta, open(os.path.join(OUT, 'props.json'), 'w'), ensure_ascii=False, indent=1)
    print('atlas', atlas.size)
