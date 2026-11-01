# 장식·소품 도트 생성 (캐릭터와 같은 렌더러)
import sys, math, numpy as np
sys.path.insert(0, '/home/user/ilwork/hero')
import rig
from rig import Model, Mat, ellipsoid, capsule, box, rot_x, rot_y, rot_z, frame_from, render
from monsters import ramp, xform, settle
TAU = 2 * math.pi
def M_(c, em=False): return Mat(ramp(c, em), em, glow=c if em else None)
def rnd(seed): return np.random.default_rng(seed)
CHC = [  # 장별 색: 주색, 보조, 빛, 돌
    dict(m='#7a9a5a', a='#c8d890', g='#8aff6a', s='#6e6a58', d='#3a4a2a'),
    dict(m='#8a5a3a', a='#c8a060', g='#b8ff4a', s='#7a4a36', d='#3a2414'),
    dict(m='#c89a60', a='#f0d8a8', g='#ffb040', s='#9a7e52', d='#5a3a1a'),
    dict(m='#4a6a9a', a='#9ab8e0', g='#5ae8ff', s='#405a86', d='#1a2a48'),
    dict(m='#8a5a9a', a='#e0a8d0', g='#ff7ad8', s='#6a4a7e', d='#2e1a3a'),
]
# ---- 벽 가장자리 큰 장식 (장별 6종) ----
def rock(M, c, s, r):
    for k in range(3 + r.integers(0, 3)):
        p = np.array([r.uniform(-4, 4), r.uniform(1, 4), r.uniform(-3, 3)]) * s; M.add(ellipsoid(p, np.array([r.uniform(3, 6), r.uniform(2.5, 5), r.uniform(3, 5)]) * s), M_(c['s']))
def stalk_bulb(M, c, s, r):
    h = r.uniform(18, 26) * s; bend = r.uniform(-4, 4) * s
    M.add(capsule([0, 0, 0], [bend, h, 0], 2.2 * s, 1.4 * s), M_(c['m'])); M.add(ellipsoid([bend, h + 3 * s, 0], 4.2 * s), M_(c['a']))
    M.add(ellipsoid([bend, h + 3 * s, 2 * s], 2.2 * s), M_(c['g'], True))
def cluster(M, c, s, r):
    for k in range(7):
        p = np.array([r.uniform(-5, 5), r.uniform(2, 9), r.uniform(-4, 4)]) * s; M.add(ellipsoid(p, r.uniform(2.5, 4.5) * s), M_(c['m'] if k % 2 else c['a']))
def pod(M, c, s, r):
    M.add(ellipsoid([0, 8 * s, 0], (6 * s, 8 * s, 6 * s)), M_(c['a'])); M.add(ellipsoid([0, 8 * s, 1.5 * s], 3 * s), M_(c['g'], True))
    for k in range(4): a = k * 1.57 + 0.4; M.add(capsule([math.cos(a) * 5 * s, 1 * s, math.sin(a) * 5 * s], [math.cos(a) * 2 * s, 6 * s, math.sin(a) * 2 * s], 1.4 * s), M_(c['m']))
def spike(M, c, s, r):
    for k in range(3):
        a = r.uniform(0, TAU); b = np.array([math.cos(a) * 3, 0, math.sin(a) * 3]) * s; t = b + np.array([r.uniform(-3, 3), r.uniform(14, 24), r.uniform(-3, 3)]) * s
        M.add(capsule(b, t, 2.8 * s, 0.4 * s), M_(c['a'] if k else c['m']))
def mushroom(M, c, s, r):
    for k in range(r.integers(1, 4)):
        x = r.uniform(-5, 5) * s; z = r.uniform(-3, 3) * s; h = r.uniform(8, 20) * s; R = r.uniform(4, 7) * s
        M.add(capsule([x, 0, z], [x, h, z], 1.4 * s, 1.1 * s), M_('#e8dcc0')); M.add(ellipsoid([x, h + R * 0.2, z], (R, R * 0.45, R)), M_(c['m']))
        for q in range(4): a = q * 1.7 + k; M.decal([x + math.cos(a) * R * 0.6, h + R * 0.55, z + math.sin(a) * R * 0.6], '#fff4e0', 1, 1.0)
def neuron_tree(M, c, s, r):
    def branch(p, d, L, w, depth):
        q = p + d * L; M.add(capsule(p, q, w, w * 0.7), M_(c['m'] if depth < 2 else c['a']))
        if depth >= 3: M.add(ellipsoid(q, 1.3 * s), M_(c['g'], True)); return
        for k in range(2):
            nd = d + np.array([r.uniform(-0.8, 0.8), r.uniform(0.0, 0.5), r.uniform(-0.8, 0.8)]); nd /= np.linalg.norm(nd)
            branch(q, nd, L * 0.7, w * 0.65, depth + 1)
    M.add(ellipsoid([0, 3 * s, 0], (5 * s, 3 * s, 5 * s)), M_(c['a']))
    branch(np.array([0, 3 * s, 0]), np.array([0, 1.0, 0]), 10 * s, 2.4 * s, 0)
def crystal(M, c, s, r):
    for k in range(4):
        a = r.uniform(0, TAU); tilt = r.uniform(-0.5, 0.5); h = r.uniform(7, 16) * s
        Rm = rot_y(a) @ rot_z(tilt); M.add(box([0, h / 2, 0] @ Rm.T + np.array([math.cos(a) * 2, 0, math.sin(a) * 2]) * s, Rm @ rot_y(0.78), (1.6 * s, h / 2, 1.6 * s)), M_(c['g'], k % 2 == 0))
def stromatolite(M, c, s, r):
    y = 0
    for k in range(5): R = (7 - k * 0.9) * s; M.add(ellipsoid([r.uniform(-1, 1) * s, y + 1.5 * s, 0], (R, 2.2 * s, R * 0.9)), M_(c['m'] if k % 2 else c['a'])); y += 3.2 * s
def shell(M, c, s, r):
    for k in range(14):
        a = k * 0.55; rr = (1.2 + k * 0.42) * s; M.add(ellipsoid([math.cos(a) * rr * 0.8, 6 * s + math.sin(a) * rr * 0.8, 0], (rr * 0.55, rr * 0.55, 2.4 * s)), M_(c['a'] if k % 2 else c['m']))
def vent(M, c, s, r):
    M.add(capsule([0, 0, 0], [0, 14 * s, 0], 6 * s, 2.5 * s), M_(c['s'])); M.add(ellipsoid([0, 15 * s, 0], (2.6 * s, 1.2 * s, 2.6 * s)), M_(c['g'], True))
def bones(M, c, s, r):
    for k in range(4):
        a = r.uniform(0, TAU); p = np.array([r.uniform(-4, 4), 1.2, r.uniform(-3, 3)]) * s; d = np.array([math.cos(a), r.uniform(-0.1, 0.3), math.sin(a)])
        M.add(capsule(p - d * 4 * s, p + d * 4 * s, 0.9 * s), M_('#e8dcc0')); M.add(ellipsoid(p + d * 4.5 * s, 1.4 * s), M_('#e8dcc0'))
    M.add(ellipsoid([0, 3 * s, 0], (3.2 * s, 2.8 * s, 3 * s)), M_('#e8dcc0')); M.decal([-1 * s, 3.4 * s, 3 * s], '#140c14', 1, 1.0); M.decal([1 * s, 3.4 * s, 3 * s], '#140c14', 1, 1.0)
def colony(M, c, s, r):
    for k in range(10):
        a = r.uniform(0, TAU); d = r.uniform(0, 5); M.add(ellipsoid([math.cos(a) * d * s, (r.uniform(1, 3) + (5 - d) * 0.8) * s, math.sin(a) * d * s], r.uniform(1.8, 3.2) * s), M_(c['m'] if k % 3 else c['g'], k % 3 == 0))
def coral(M, c, s, r):
    def br(p, d, L, w, dep):
        q = p + d * L; M.add(capsule(p, q, w, w * 0.8), M_(c['a'])); 
        if dep >= 2: M.add(ellipsoid(q, w * 1.2), M_(c['g'], True)); return
        for k in range(2): nd = d + np.array([r.uniform(-0.7, 0.7), 0.3, r.uniform(-0.7, 0.7)]); br(q, nd / np.linalg.norm(nd), L * 0.75, w * 0.7, dep + 1)
    br(np.array([0, 0, 0.0]), np.array([0, 1.0, 0]), 8 * s, 2.0 * s, 0)
EDGE = [[stalk_bulb, cluster, pod, rock, spike, colony], [mushroom, colony, rock, spike, stalk_bulb, bones],
        [spike, bones, rock, cluster, vent, pod], [neuron_tree, crystal, rock, neuron_tree, cluster, crystal],
        [stromatolite, shell, coral, vent, cluster, rock]]
# ---- 빛나는 장식 (4프레임 맥동) ----
def glow_prop(M, c, s, r, t):
    k = 0.85 + 0.15 * math.sin(TAU * t)
    M.add(capsule([0, 0, 0], [0, 6 * s, 0], 1.6 * s, 1.0 * s), M_(c['s']))
    M.add(ellipsoid([0, 9 * s, 0], 3.4 * s * k), M_(c['g'], True))
    for q in range(3): a = q * 2.1 + t * TAU; M.add(ellipsoid([math.cos(a) * 5 * s, 9 * s + math.sin(a * 2) * 2 * s, math.sin(a) * 5 * s], 0.9 * s), M_(c['g'], True))
def brazier(M, c, s, r, t):
    M.add(capsule([0, 0, 0], [0, 10 * s, 0], 2.0 * s, 1.4 * s), M_('#3a3028')); M.add(ellipsoid([0, 11 * s, 0], (5.5 * s, 2.2 * s, 5.5 * s)), M_('#4a3a2c'))
    for q in range(5):
        a = q * 1.256 + t * 3; h = (5 + 3 * math.sin(TAU * t + q * 1.7)) * s
        M.add(capsule([math.cos(a) * 2 * s, 12 * s, math.sin(a) * 2 * s], [math.cos(a) * 0.8 * s + math.sin(TAU * t + q) * s, 12 * s + h, math.sin(a) * 0.8 * s], 1.6 * s, 0.4 * s), M_(c['g'] if q % 2 else '#ffd070', True))
def pillar(M, c, s, r):
    M.add(box([0, 1.5 * s, 0], np.eye(3), (8 * s, 1.5 * s, 8 * s)), M_(c['d'])); M.add(capsule([0, 2 * s, 0], [0, 40 * s, 0], 6 * s, 5.4 * s), M_(c['s']))
    M.add(box([0, 41 * s, 0], np.eye(3), (7.5 * s, 1.6 * s, 7.5 * s)), M_(c['d']))
    for k in range(6): y = (6 + k * 6) * s; M.add(ellipsoid([5.6 * s, y, 1.0 * s], (1.0 * s, 1.6 * s, 1.0 * s)), M_(c['g'], True)) if k % 2 == 0 else None
# ---- 바닥 데칼 (위에서 내려다본 평면) ----
def decal(M, c, s, r, kind):
    if kind == 0:  # 웅덩이
        for k in range(4): M.add(ellipsoid([r.uniform(-5, 5) * s, 0, r.uniform(-4, 4) * s], (r.uniform(4, 7) * s, 0.3, r.uniform(3, 6) * s)), M_(c['d'] if k else c['m']))
    elif kind == 1:  # 자갈
        for k in range(9): M.add(ellipsoid([r.uniform(-8, 8) * s, 0, r.uniform(-8, 8) * s], (r.uniform(0.8, 2) * s, 0.8 * s, r.uniform(0.8, 1.8) * s)), M_(c['s']))
    elif kind == 2:  # 뼛조각
        for k in range(3): a = r.uniform(0, TAU); p = np.array([r.uniform(-5, 5), 0, r.uniform(-5, 5)]) * s; d = np.array([math.cos(a), 0, math.sin(a)]); M.add(capsule(p - d * 4 * s, p + d * 4 * s, 0.8 * s), M_('#e0d4b8'))
    elif kind == 3:  # 이끼·균사 덩이
        for k in range(14): M.add(ellipsoid([r.uniform(-8, 8) * s, 0, r.uniform(-6, 6) * s], r.uniform(0.8, 2.2) * s), M_(c['m'] if k % 2 else c['a']))
    elif kind == 4:  # 핏자국/얼룩
        for k in range(6): M.add(ellipsoid([r.uniform(-6, 6) * s, 0, r.uniform(-5, 5) * s], (r.uniform(1.5, 4) * s, 0.2, r.uniform(1.5, 3.5) * s)), M_(c['d']))
    else:  # 빛나는 균사 무늬
        p = np.array([0, 0, 0.0])
        for k in range(8): q = p + np.array([r.uniform(-4, 4), 0, r.uniform(-4, 4)]) * s; M.add(capsule(p, q, 0.6 * s), M_(c['g'], True)); p = q

# ---- 상호작용 소품 (frames: 8) ----
GOLDM = '#d8a838'; STONE = '#6a6470'; WOODC = '#6a4426'
def p_chest(M, t, s, opened=False):
    M.add(box([0, 4 * s, 0], np.eye(3), (7 * s, 4 * s, 4.5 * s)), M_(WOODC))
    for x in (-6.2, 0, 6.2): M.add(box([x * s, 4 * s, 0], np.eye(3), (0.9 * s, 4.2 * s, 4.7 * s)), M_(GOLDM))
    lid = rot_x(-1.2 if opened else 0)
    M.add(box(np.array([0, 9 * s, -4.5 * s]) + lid @ np.array([0, 0.5 * s, 4.5 * s]), lid, (7.2 * s, 1.4 * s, 4.6 * s)), M_(WOODC))
    M.add(box([0, 6.2 * s, 4.6 * s], np.eye(3), (1.4 * s, 1.8 * s, 0.4 * s)), M_(GOLDM))
    for k in range(-3, 4): M.decal([k * 1.6 * s, 4.5 * s + math.sin(k) * 1.5 * s, 4.6 * s], '#5ab8ff', 1, 1.0)
    if opened: M.add(ellipsoid([0, 8 * s, 0], (5 * s, 1.5 * s, 3 * s)), M_('#ffd860', True))
def p_vat(M, t, s):
    M.add(capsule([0, 2 * s, 0], [0, 16 * s, 0], 5 * s), M_('#6ab0a0')); M.add(ellipsoid([0, 9 * s, 2 * s], (2.5 * s, 4 * s, 2 * s)), M_('#8aff6a', True))
    for y in (1.5, 18): M.add(box([0, y * s, 0], np.eye(3), (5.6 * s, 1.4 * s, 5.6 * s)), M_('#4a4a52'))
    for k in range(3): M.add(ellipsoid([math.sin(t * TAU + k * 2) * 2 * s, (5 + ((t + k / 3) % 1) * 10) * s, 4.4 * s], 0.7 * s), M_('#e0fff0', True))
def p_cocoon(M, t, s):
    for k in range(6): a = k * 1.05; M.add(ellipsoid([0, (8 + 0.3 * math.sin(TAU * t)) * s, 0], (5 * s, 9 * s, 5 * s)) if k == 0 else capsule([math.cos(a) * 4 * s, 1 * s, math.sin(a) * 4 * s], [math.cos(a) * 2 * s, 15 * s, math.sin(a) * 2 * s], 1.0 * s), M_('#8a6a4a' if k == 0 else '#c8a87a'))
    M.add(ellipsoid([0, 9 * s, 3 * s], (1.6 * s, 2.5 * s, 1.4 * s)), M_('#ff9a4a', True))
def p_sac(M, t, s):
    k = 1 + 0.06 * math.sin(TAU * t)
    M.add(ellipsoid([0, 7 * s, 0], (6 * s * k, 7 * s / k, 6 * s * k)), M_('#9ac83a'))
    for q in range(7): a = q * 0.9; M.decal([math.cos(a) * 5 * s, (5 + q) * s, math.sin(a) * 5 * s + 1], '#e0ff8a', 1, 1.0)
    M.add(ellipsoid([0, 8 * s, 2 * s], 2.6 * s * k), M_('#c8ff5a', True))
    for q in range(3): a = q * 2.1; M.add(capsule([math.cos(a) * 5 * s, 1 * s, math.sin(a) * 5 * s], [math.cos(a) * 8 * s, 0, math.sin(a) * 8 * s], 1.0 * s), M_('#6a8a2a'))
def p_door(M, t, s):
    for x in (-9, 9): M.add(box([x * s, 15 * s, 0], np.eye(3), (2.6 * s, 15 * s, 2.6 * s)), M_(STONE))
    for k in range(9):
        a = math.pi * k / 8; M.add(box([math.cos(a) * 9 * s, (30 + math.sin(a) * 7) * s, 0], rot_z(a), (1.8 * s, 2.4 * s, 2.6 * s)), M_('#7a7480' if k % 2 else STONE))
    M.add(box([0, 13 * s, -0.5 * s], np.eye(3), (6.4 * s, 13 * s, 0.6 * s)), M_('#1a1018'))
    M.add(ellipsoid([0, 36 * s, 2.5 * s], 2 * s), M_('#ff5a4a', True))
def p_portal(M, t, s, col='#ff4a5a'):
    M.add(ellipsoid([0, 1 * s, 0], (12 * s, 1.5 * s, 7 * s)), M_(STONE))
    for k in range(14):
        a = k / 14 * TAU; p = np.array([math.cos(a) * 8.5 * s, (17 + math.sin(a) * 14) * s, 0]); M.add(box(p, rot_z(a), (2 * s, 1.6 * s, 2.2 * s)), M_('#5a4a5a' if k % 2 else '#7a6a7a'))
    for r_ in range(5):
        for k in range(10):
            a = k / 10 * TAU + t * TAU * (1 if r_ % 2 else -1) * 0.5 + r_; rr = (6.8 - r_ * 1.3) * s
            M.add(ellipsoid([math.cos(a) * rr, 17 * s + math.sin(a) * rr * 1.75, 0.5 * s], (1.6 - r_ * 0.15) * s), M_(col if r_ % 2 else '#ffffff' if r_ == 4 else col, True))
def p_waypoint(M, t, s):
    M.add(ellipsoid([0, 0.8 * s, 0], (15 * s, 1.6 * s, 15 * s)), M_('#4a5a7a')); M.add(ellipsoid([0, 1.6 * s, 0], (11 * s, 1.2 * s, 11 * s)), M_('#2a3a5a'))
    for k in range(12):
        a = k / 12 * TAU + t * TAU / 12; M.add(ellipsoid([math.cos(a) * 8 * s, 2.4 * s, math.sin(a) * 8 * s], 1.2 * s), M_('#6ab8ff', True))
    M.add(ellipsoid([0, (4 + math.sin(TAU * t)) * s, 0], (2.5 * s, 3 * s, 2.5 * s)), M_('#aee0ff', True))
def p_well(M, t, s):
    M.add(capsule([0, 2 * s, 0], [0, 6 * s, 0], 8 * s, 8 * s), M_('#c8c0d0')); M.add(ellipsoid([0, 8 * s, 0], (6.5 * s, 1 * s, 6.5 * s)), M_('#7ad8ff', True))
    for x in (-7, 7): M.add(capsule([x * s, 6 * s, 0], [x * s, 20 * s, 0], 1.2 * s), M_('#e8e0f0'))
    M.add(capsule([-7 * s, 20 * s, 0], [7 * s, 20 * s, 0], 1.3 * s), M_('#e8e0f0'))
    for k in range(4): M.add(ellipsoid([math.sin(TAU * t + k) * 3 * s, (9 + ((t + k / 4) % 1) * 9) * s, 0], 0.8 * s), M_('#c8f4ff', True))
    for sd in (-1, 1): M.add(capsule([sd * 3 * s, 22 * s, 0], [sd * 9 * s, 26 * s + math.sin(TAU * t) * s, -1 * s], 1.0 * s, 0.4 * s), M_('#ffffff'))
def p_obelisk(M, t, s):
    M.add(box([0, 2 * s, 0], np.eye(3), (6 * s, 2 * s, 6 * s)), M_('#5a4a3a'))
    M.add(box([0, 16 * s, 0], np.eye(3), (3.2 * s, 12 * s, 3.2 * s)), M_(GOLDM)); M.add(box([0, 30 * s, 0], rot_y(0.78) @ rot_x(0.0), (2.2 * s, 2.5 * s, 2.2 * s)), M_('#fff0a0', True))
    for k in range(6): M.decal([0, (6 + k * 4) * s, 3.3 * s], '#ffe060' if (k + int(t * 8)) % 3 == 0 else '#6a4a10', 1, 1.0)
def p_campfire(M, t, s):
    for k in range(10): a = k / 10 * TAU; M.add(ellipsoid([math.cos(a) * 7 * s, 1.6 * s, math.sin(a) * 7 * s], (2.6 * s, 2 * s, 2.4 * s)), M_('#8a7a6a'))
    for k in range(5):
        a = k * 1.256 + t * 4; h = (8 + 4 * math.sin(TAU * t * 2 + k * 1.3)) * s
        M.add(capsule([math.cos(a) * 3 * s, 2 * s, math.sin(a) * 3 * s], [math.cos(a) * s + math.sin(TAU * t + k) * 1.5 * s, 2 * s + h, math.sin(a) * s], 2.4 * s, 0.4 * s), M_('#ff8a2a' if k % 2 else '#ffd060', True))
    for k in range(16):  # 위로 꼬이는 DNA 나선
        y = (6 + k * 1.6) * s; a = k * 0.6 + t * TAU
        for sd in (0, math.pi): M.add(ellipsoid([math.cos(a + sd) * 3.5 * s, y, math.sin(a + sd) * 3.5 * s], 1.0 * s), M_('#c8e8ff' if sd else '#ff9a4a', True))
def p_gasvent(M, t, s):
    M.add(capsule([0, 0, 0], [0, 5 * s, 0], 6 * s, 4 * s), M_('#5a5a4a')); M.add(ellipsoid([0, 5.5 * s, 0], (3.6 * s, 0.8 * s, 3.6 * s)), M_('#2a3a10'))
    for k in range(6):
        u = (t + k / 6) % 1; M.add(ellipsoid([math.sin(k * 2 + u * 3) * 3 * s * u, (7 + u * 18) * s, math.cos(k * 2) * 2 * s * u], (1.5 + 3 * u) * s), M_('#9ad83a', True))
def p_tesla(M, t, s):
    M.add(box([0, 2 * s, 0], np.eye(3), (6 * s, 2 * s, 6 * s)), M_('#3a3a4a')); M.add(capsule([0, 4 * s, 0], [0, 22 * s, 0], 2.2 * s, 1.6 * s), M_('#6a7a9a'))
    for k in range(5): M.add(ellipsoid([0, (7 + k * 3.4) * s, 0], (3.6 * s, 0.9 * s, 3.6 * s)), M_('#b88a3a'))
    M.add(ellipsoid([0, 24 * s, 0], 3.2 * s), M_('#8ae8ff', True))
    rng_ = np.random.default_rng(int(t * 8) + 3); p = np.array([0, 24 * s, 0])
    for k in range(5): q = p + np.array([rng_.uniform(-3, 3), rng_.uniform(-2, 2), rng_.uniform(-3, 3)]) * s; M.add(capsule(p, q, 0.4 * s), M_('#e0ffff', True)); p = q
def p_tent(M, t, s, col):
    for k in range(8):
        a = k / 8 * TAU; M.add(capsule([math.cos(a) * 12 * s, 0.5 * s, math.sin(a) * 12 * s], [0, 26 * s, 0], 3.8 * s, 0.6 * s), M_(col if k % 2 else '#5a4a3a'))
    M.add(capsule([0, 0, 0], [0, 30 * s, 0], 0.8 * s), M_('#3a2a1a')); M.add(box([0, 6 * s, 10.5 * s], np.eye(3), (3 * s, 6 * s, 0.6 * s)), M_('#1a1018'))
def p_torch(M, t, s):
    M.add(capsule([0, 0, 0], [0, 22 * s, 0], 1.0 * s, 0.8 * s), M_('#4a3420')); M.add(ellipsoid([0, 23 * s, 0], (2.2 * s, 1.2 * s, 2.2 * s)), M_('#5a4a3a'))
    for k in range(3): h = (4 + 2 * math.sin(TAU * t * 2 + k * 2)) * s; M.add(capsule([math.cos(k * 2.1) * s, 24 * s, math.sin(k * 2.1) * s], [math.sin(TAU * t + k) * 0.8 * s, 24 * s + h, 0], 1.5 * s, 0.3 * s), M_('#ff9a3a' if k else '#ffe070', True))
def p_stash(M, t, s):
    M.add(box([0, 6 * s, 0], np.eye(3), (10 * s, 6 * s, 6 * s)), M_('#5a3a6a'))
    for x in (-9, 0, 9): M.add(box([x * s, 6 * s, 0], np.eye(3), (1 * s, 6.2 * s, 6.2 * s)), M_(GOLDM))
    M.add(box([0, 13 * s, 0], np.eye(3), (10.4 * s, 1.8 * s, 6.4 * s)), M_('#6a4a7a')); M.add(ellipsoid([0, 9 * s, 6.3 * s], 1.8 * s), M_('#c890ff', True))
def p_mosaic(M, t, s, col):
    for k in range(37):
        a = k * 2.4; r_ = math.sqrt(k) * 2.4 * s; M.add(box([math.cos(a) * r_, 0.3 * s, math.sin(a) * r_], rot_y(a), (1.1 * s, 0.3 * s, 1.1 * s)), M_(col if k % 3 else '#e8e0c8'))
PROPS = {  # 이름: (함수, 월드 크기, 프레임 수, 추가 인자)
    'chest03_ancient_dna_reliquary': (p_chest, 2.1, 2, None), 'destructible01_specimen_vat': (p_vat, 2.0, 8, None), 'destructible02_chitin_cocoon': (p_cocoon, 2.0, 8, None),
    'destructible04_explosive_spore_sac': (p_sac, 2.0, 8, None), 'dungeon02_gothic_archway_door': (p_door, 3.6, 1, None), 'dungeon04_crimson_boss_portal': (p_portal, 3.4, 8, None),
    'town03_blue_waypoint_pad': (p_waypoint, 3.6, 8, None), 'shrine01_angelic_healing_well': (p_well, 2.8, 8, None), 'shrine02_golden_atp_obelisk': (p_obelisk, 2.8, 8, None),
    'town01_dna_helix_campfire': (p_campfire, 3.2, 8, None), 'trap03_poison_gas_vent': (p_gasvent, 2.2, 8, None), 'trap04_neural_tesla_coil': (p_tesla, 2.6, 8, None),
    'tent0': (p_tent, 5.0, 1, '#6a4a3a'), 'tent1': (p_tent, 5.0, 1, '#4a3a6a'), 'tent2': (p_tent, 5.0, 1, '#6a2a2a'), 'torch': (p_torch, 3.0, 8, None), 'stash': (p_stash, 2.6, 4, None),
    'tile03_golden_immune_mosaic': (p_mosaic, 3.6, 1, '#d8a838'), 'tile04_blue_dna_crystal_floor': (p_mosaic, 3.6, 1, '#4a8ad8'),
}
