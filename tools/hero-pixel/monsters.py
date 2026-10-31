# 몬스터·보스 도트 생성: 몸 구조(설계도) × 동작. 단위 u = 키/40
import numpy as np, math, colorsys
from rig import Model, Mat, ellipsoid, capsule, box, frame_from, rot_x, rot_y, rot_z, hexc
TAU = 2 * math.pi
def ss(t): t = min(1, max(0, t)); return t * t * (3 - 2 * t)

def ramp(hexcol, emissive=False):
    c = hexc(hexcol) / 255.0; h, l, s = colorsys.rgb_to_hls(*c)
    out = []
    for dl, dh, ds in ((-0.30, 0.06, 0.05), (-0.14, 0.025, 0.05), (0.0, 0, 0), (0.17, -0.03, -0.05)):
        hh = (h + dh) % 1; ll = min(0.94, max(0.06, l + dl)); s2 = min(1, max(0, s + ds))
        r, g, b = colorsys.hls_to_rgb(hh, ll, s2); out.append('#%02x%02x%02x' % (int(r * 255), int(g * 255), int(b * 255)))
    if emissive:
        r, g, b = colorsys.hls_to_rgb(h, min(0.97, l + 0.35), s); out[3] = '#%02x%02x%02x' % (int(r * 255), int(g * 255), int(b * 255))
    return out
def mats(spec):
    c1, c2 = spec['c1'], spec['c2']
    M1 = Mat(ramp(c1)); M2 = Mat(ramp(c2)); G = Mat(ramp(c2, True), True, glow=c2)
    D = Mat(ramp('#2a1a28')); B = Mat(ramp('#e8dcc8')); MO = Mat(['#1a0608', '#3a0a14', '#6a1a24', '#a03040'])
    return dict(m=M1, a=M2, g=G, d=D, bone=B, mouth=MO)

def xform(M, A, piv=(0, 0, 0), off=(0, 0, 0)):
    piv = np.array(piv, float); off = np.array(off, float); A = np.array(A, float)
    An = A / np.linalg.norm(A, axis=0, keepdims=True)
    M.parts = [((p - piv) @ A.T + piv + off, n @ An.T, m, i) for p, n, m, i in M.parts]
    M.decals = [((p - piv) @ A.T + piv + off, c, s, b) for p, c, s, b in M.decals]
    M.tips = {k: (v - piv) @ A.T + piv + off for k, v in M.tips.items()}

def settle(M):
    allp = np.concatenate([p for p, n, m, i in M.parts]); dy = -allp[:, 1].min()
    xform(M, np.eye(3), off=(0, dy, 0))

def eyes(M, c, fwd, side, up, n, r, col='#ffffff', pupil='#140c14', u=1.0):
    """눈: 흰자(작은 구) + 동공 점"""
    for k in range(n):
        a = (k - (n - 1) / 2) * 0.7
        p = c + fwd * r + side * math.sin(a) * r * 0.9 + up * (0.15 * r)
        M.add(ellipsoid(p, 0.9 * u + 0.25), Mat(['#a8a0a0', '#d8d0d0', '#f4f0f0', '#ffffff']))
        M.decal(p + fwd * (0.9 * u + 0.3), pupil, 1, 1.5)

# ---------------- 설계도 ----------------
def plan_blob(sp, st, t, M, K):
    u = sp['u']; sq = 0; lean = 0; fw = 0; ext = 0
    if st == 'idle': sq = 0.06 * math.sin(TAU * t)
    elif st == 'walk': ph = TAU * t; sq = 0.14 * math.cos(2 * ph); fw = 0; lean = 0.08 * math.sin(2 * ph)
    elif st == 'attack':
        a = ss(t / 0.4); b = ss((t - 0.4) / 0.2); c = ss((t - 0.65) / 0.35)
        sq = 0.22 * a - 0.35 * b * (1 - c); fw = (5 * b) * (1 - c) * u; ext = b * (1 - c); lean = 0.25 * b * (1 - c)
    R = 9 * u * sp.get('bulk', 1)
    c = np.array([0, R * (1 - sq * 0.8), fw])
    M.add(ellipsoid(c, (R * (1 + sq * 0.6), R * (1 - sq), R * (1 + sq * 0.5))), K['m'])
    M.add(ellipsoid(c + np.array([0, R * 0.25, R * 0.15]), (R * 0.55, R * 0.45, R * 0.5)), K['g'])  # 비치는 핵
    for k in range(sp['n_spot']):
        a = k * 2.4 + 0.5; M.decal(c + np.array([math.cos(a) * R * 0.75, math.sin(a * 1.7) * R * 0.5, math.sin(a) * R * 0.75]), sp['c2'], 1, 0.6)
    eyes(M, c + np.array([0, R * 0.2, 0]), np.array([0, 0, 1.0]), np.array([1.0, 0, 0]), np.array([0, 1.0, 0]), sp['n_eye'], R * 0.92, u=u)
    # 위족 (공격 시 앞으로 뻗음)
    for s in (1, -1):
        base = c + np.array([s * R * 0.8, -R * 0.35, R * 0.3])
        tip = base + np.array([s * 2 * u, -2.5 * u, 2 * u + ext * 9 * u])
        M.add(capsule(base, tip, 2.2 * u, 1.2 * u), K['m']); M.tips['w%d' % s] = tip
    if sp.get('spikes'):
        for k in range(sp['spikes']):
            a = k / sp['spikes'] * TAU; d = np.array([math.cos(a) * 0.7, 0.7, math.sin(a) * 0.7])
            M.add(capsule(c + d * R * 0.85, c + d * R * 1.35, 1.0 * u, 0.3 * u), K['a'])

def plan_floater(sp, st, t, M, K):
    u = sp['u']; h = 13 * u + 2 * u * math.sin(TAU * t); lean = 0; whip = 0; fw = 0
    if st == 'walk': lean = 0.25; h = 13 * u + 1.5 * u * math.sin(2 * TAU * t)
    elif st == 'attack':
        a = ss(t / 0.4); b = ss((t - 0.4) / 0.25); c = ss((t - 0.7) / 0.3)
        h = 13 * u + 4 * u * a - 3 * u * b; whip = b * (1 - c); lean = -0.3 * a + 0.6 * b * (1 - c); fw = 3 * u * b * (1 - c)
    R = 8 * u * sp.get('bulk', 1); c = np.array([0, h + R * 0.4, fw])
    M.add(ellipsoid(c, (R, R * 0.8, R)), K['m'])
    M.add(ellipsoid(c + np.array([0, -R * 0.35, 0]), (R * 1.05, R * 0.3, R * 1.05)), K['a'])
    M.add(ellipsoid(c + np.array([0, R * 0.1, R * 0.35]), R * 0.45), K['g'])
    eyes(M, c, np.array([0, 0, 1.0]), np.array([1.0, 0, 0]), np.array([0, 1.0, 0]), sp['n_eye'], R * 0.95, u=u)
    nt = sp.get('tent', 6)
    for k in range(nt):
        a = k / nt * TAU; base = c + np.array([math.cos(a) * R * 0.7, -R * 0.4, math.sin(a) * R * 0.7]); p = base
        for j in range(4):
            sw = math.sin(TAU * t * (2 if st == 'walk' else 1) + j * 0.9 + k) * 1.6 * u
            q = p + np.array([sw * math.cos(a + 1.5), -3.0 * u, sw * math.sin(a + 1.5) + whip * (4 * u) * (j + 1) / 4 - (2 * u if st == 'walk' else 0)])
            M.add(capsule(p, q, (1.4 - j * 0.25) * u), K['a'] if j % 2 else K['m']); p = q
        M.tips['t%d' % k] = p
    if lean: xform(M, rot_x(lean), piv=c)

def plan_worm(sp, st, t, M, K):
    u = sp['u']; n = sp.get('seg', 7); rr = 4.2 * u * sp.get('bulk', 1); pts = []
    for i in range(n):
        s = i / (n - 1)
        if st == 'walk': y = rr; x = math.sin(TAU * t * 1 - s * 4) * 3 * u; z = (0.5 - s) * n * 3.2 * u
        else: y = rr; x = math.sin(TAU * t - s * 3) * 1.2 * u; z = (0.5 - s) * n * 3.2 * u
        if st == 'attack':
            a = ss(t / 0.4); b = ss((t - 0.4) / 0.2); c = ss((t - 0.65) / 0.35); head = max(0, 1 - s * 2.5)
            y += head * (10 * u * a * (1 - b) + 3 * u * b * (1 - c)); z += head * (-3 * u * a + 8 * u * b * (1 - c))
        pts.append(np.array([x, y, z]))
    for i in range(n - 1, -1, -1):
        r = rr * (1.05 - 0.45 * (i / (n - 1)) ** 1.5) if i > 0 else rr * 1.1
        M.add(ellipsoid(pts[i], (r, r * 0.9, r * 0.9)), K['m'] if i % 2 == 0 else K['a'])
        if i > 0 and sp.get('legs'):
            for s in (1, -1): M.add(capsule(pts[i] + np.array([s * r * 0.8, -r * 0.3, 0]), pts[i] + np.array([s * (r + 2.5 * u), -r, math.sin(TAU * t * 2 + i + s) * 1.5 * u]), 0.7 * u), K['d'])
    hd = pts[0]; fwd = pts[0] - pts[1]; fwd /= np.linalg.norm(fwd)
    side = np.cross(np.array([0, 1.0, 0]), fwd); side /= np.linalg.norm(side)
    eyes(M, hd + np.array([0, rr * 0.3, 0]), fwd, side, np.array([0, 1.0, 0]), sp['n_eye'], rr * 0.9, u=u)
    op = 1.0 if st == 'attack' and 0.35 < t < 0.75 else 0.3
    M.add(ellipsoid(hd + fwd * rr * 0.9 + np.array([0, -rr * 0.25, 0]), (rr * 0.55, rr * 0.25 * op + 0.5, rr * 0.3)), K['mouth'])
    for s in (1, -1): M.add(capsule(hd + fwd * rr * 0.8 + side * s * rr * 0.4, hd + fwd * (rr * 1.5 + op * 2 * u) + side * s * rr * 0.6 - np.array([0, rr * 0.4, 0]), 0.8 * u, 0.3 * u), K['bone'])
    M.tips['w1'] = hd + fwd * rr * 1.6

def legs_gait(t, k, nlegs, walking, amp=1.0):
    ph = TAU * t * (1 if walking else 0) + (k % 2) * math.pi + (k // 2) * 0.6
    return math.sin(ph) * amp * (1 if walking else 0.1), max(0, math.cos(ph)) * (1 if walking else 0)

def plan_spider(sp, st, t, M, K):
    u = sp['u']; walk = st == 'walk'; R = 6.5 * u * sp.get('bulk', 1); h = 7 * u + (0.6 * u * math.sin(4 * TAU * t) if walk else 0.3 * u * math.sin(TAU * t))
    rear = 0; slam = 0
    if st == 'attack': a = ss(t / 0.45); b = ss((t - 0.45) / 0.2); c = ss((t - 0.7) / 0.3); rear = a * (1 - b); slam = b * (1 - c)
    body = np.array([0, h + rear * 3 * u, -2 * u]); head = body + np.array([0, rear * 3 * u - slam * 2 * u, R * 1.2 + slam * 2 * u])
    M.add(ellipsoid(body, (R, R * 0.75, R * 1.15)), K['m'])
    for k in range(sp['n_spot']): a = k * 2.1; M.decal(body + np.array([math.cos(a) * R * 0.5, R * 0.72, math.sin(a) * R * 0.6]), sp['c2'], 1, 0.8)
    M.add(ellipsoid(head, R * 0.55), K['a'])
    eyes(M, head, np.array([0, 0.15, 1.0]) / 1.01, np.array([1.0, 0, 0]), np.array([0, 1.0, 0]), sp['n_eye'], R * 0.55, u=u * 0.8)
    nl = sp.get('nlegs', 8)
    for k in range(nl):
        s = 1 if k % 2 == 0 else -1; idx = k // 2; zoff = (idx - (nl // 2 - 1) / 2) * 3.2 * u
        sw, lift = legs_gait(t, k, nl, walk, 0.6)
        hip = body + np.array([s * R * 0.75, 0, zoff])
        front = idx == nl // 2 - 1
        up = rear * (8 * u if front else 0)
        knee = hip + np.array([s * 6 * u, 5 * u + lift * 2 * u + up, sw * 3 * u + (rear * 3 * u if front else 0)])
        foot = hip + np.array([s * 10 * u, -h + lift * 2.5 * u + up * 1.3 - (slam * 0 if not front else 0), zoff * 0.4 + sw * 4.5 * u + (rear * 6 * u + slam * 4 * u if front else 0)])
        M.add(capsule(hip, knee, 1.3 * u, 1.0 * u), K['d']); M.add(capsule(knee, foot, 1.0 * u, 0.5 * u), K['a'] if front else K['d'])
        if front: M.tips['w%d' % s] = foot
    for s in (1, -1): M.add(capsule(head + np.array([s * 1.5 * u, -1.5 * u, R * 0.4]), head + np.array([s * 1.0 * u, -3.5 * u, R * 0.7 + slam * 2 * u]), 0.8 * u, 0.3 * u), K['bone'])

def plan_beast(sp, st, t, M, K):
    u = sp['u']; walk = st == 'walk'; L = 9 * u * sp.get('len', 1); R = 5.2 * u * sp.get('bulk', 1)
    h = 9.5 * u; crouch = 0; pounce = 0; jaw = 0.2
    if walk: h += 0.8 * u * math.sin(2 * TAU * t)
    if st == 'idle': h += 0.3 * u * math.sin(TAU * t)
    if st == 'attack': a = ss(t / 0.4); b = ss((t - 0.4) / 0.2); c = ss((t - 0.65) / 0.35); crouch = a * (1 - b); pounce = b * (1 - c); jaw = 0.2 + 0.9 * pounce
    h += -3 * u * crouch + 2 * u * pounce
    torso_f = np.array([0, h + R * 0.2, L * 0.5 + pounce * 6 * u]); torso_b = np.array([0, h, -L * 0.5 + pounce * 3 * u])
    M.add(capsule(torso_b, torso_f, R * 0.9, R), K['m'])
    for k in range(sp.get('spikes', 4)):
        p = torso_b + (torso_f - torso_b) * (k + 0.5) / sp.get('spikes', 4) + np.array([0, R * 0.85, 0]); M.add(capsule(p, p + np.array([0, 3 * u, -1.5 * u]), 1.1 * u, 0.3 * u), K['a'])
    head = torso_f + np.array([0, R * 0.4 - crouch * 2 * u, R * 1.3 + pounce * 2 * u])
    M.add(ellipsoid(head, (R * 0.75, R * 0.7, R * 0.95)), K['m'])
    M.add(ellipsoid(head + np.array([0, -R * 0.45 - jaw * 2 * u, R * 0.5]), (R * 0.55, R * 0.25, R * 0.55)), K['a'])
    M.add(ellipsoid(head + np.array([0, -R * 0.25 - jaw * u, R * 0.7]), (R * 0.45, 0.4 + jaw * 1.2 * u, R * 0.3)), K['mouth'])
    for s in (1, -1): M.add(capsule(head + np.array([s * R * 0.35, -R * 0.2, R * 0.85]), head + np.array([s * R * 0.3, -R * 0.65 - jaw * u, R * 0.95]), 0.6 * u, 0.2 * u), K['bone'])
    eyes(M, head + np.array([0, R * 0.25, 0]), np.array([0, 0, 1.0]), np.array([1.0, 0, 0]), np.array([0, 1.0, 0]), sp['n_eye'], R * 0.85, u=u * 0.8)
    if sp.get('horns'):
        for s in (1, -1): M.add(capsule(head + np.array([s * R * 0.5, R * 0.5, 0]), head + np.array([s * R * 1.0, R * 1.5, -R * 0.6]), 1.0 * u, 0.3 * u), K['bone'])
    for k, (zz, s) in enumerate(((L * 0.45, 1), (L * 0.45, -1), (-L * 0.45, 1), (-L * 0.45, -1))):
        ph = TAU * t + (0 if k in (0, 3) else math.pi); sw = math.sin(ph) * (0.55 if walk else 0.05); lift = max(0, math.cos(ph)) * (1 if walk else 0)
        if st == 'attack': sw = (0.6 * pounce - 0.3 * crouch) * (1 if zz > 0 else -0.6)
        hip = np.array([s * R * 0.7, h, zz + (pounce * 6 * u if zz > 0 else pounce * 3 * u)])
        knee = hip + np.array([s * 0.6 * u, -h * 0.5, math.sin(sw) * h * 0.5 + (1.5 * u if zz > 0 else -1.5 * u)])
        foot = np.array([hip[0] + s * 0.5 * u, lift * 2.5 * u, hip[2] + math.sin(sw) * h * 0.85])
        M.add(capsule(hip, knee, 1.9 * u, 1.5 * u), K['m']); M.add(capsule(knee, foot, 1.5 * u, 1.1 * u), K['d'])
        if zz > 0: M.tips['w%d' % s] = foot
    tl = torso_b; 
    for j in range(4):
        q = tl + np.array([math.sin(TAU * t + j) * 1.5 * u, 1.2 * u - j * 0.6 * u, -3 * u]); M.add(capsule(tl, q, (1.6 - j * 0.3) * u), K['a'] if j % 2 else K['m']); tl = q
    M.tips['bite'] = head + np.array([0, -R * 0.3, R * 1.0])

def plan_biped(sp, st, t, M, K):
    u = sp['u']; walk = st == 'walk'; B = sp.get('bulk', 1)
    hipH = 12 * u; lean = 0.1; arm_up = 0; smash = 0; lt = rt = 0; lk = rk = 0.1; twist = 0
    if walk:
        lt = 0.45 * math.sin(TAU * t); rt = -lt; lk = 0.1 + 0.6 * max(0, math.cos(TAU * t)); rk = 0.1 + 0.6 * max(0, -math.cos(TAU * t)); twist = 0.12 * math.sin(TAU * t)
    if st == 'idle': hipH -= 0.4 * u * (1 + math.sin(TAU * t))
    if st == 'attack':
        a = ss(t / 0.45); b = ss((t - 0.45) / 0.18); c = ss((t - 0.7) / 0.3); arm_up = a * (1 - b); smash = b * (1 - c); lean = 0.1 - 0.25 * a + 0.55 * smash; hipH -= 2 * u * smash; lt = 0.4 * smash; lk = 0.5 * smash
    pel = np.array([0, hipH, 0])
    feet = []
    for s, th, kn in ((1, lt, lk), (-1, rt, rk)):
        hip = pel + np.array([s * 3.2 * u * B, 0, 0])
        knee = hip + 6.5 * u * np.array([0, -math.cos(th), math.sin(th)])
        ank = knee + 6.0 * u * np.array([0, -math.cos(th - kn), math.sin(th - kn)])
        M.add(capsule(hip, knee, 2.4 * u * B, 2.0 * u * B), K['m']); M.add(capsule(knee, ank, 2.0 * u * B, 1.7 * u * B), K['d'])
        M.add(capsule(ank, ank + np.array([0, -0.8 * u, 2.8 * u]), 1.8 * u * B, 1.4 * u), K['d']); feet.append(ank)
    Rt = rot_y(twist) @ rot_x(lean)
    def up(v): return pel + Rt @ np.array(v, float)
    chest = up([0, 9 * u, 0.5 * u])
    M.add(ellipsoid(up([0, 3.5 * u, 0]), (4.2 * u * B, 3.8 * u, 3.2 * u)), K['m'])
    M.add(ellipsoid(chest, (6.2 * u * B, 5.2 * u, 4.2 * u)), K['m'])
    M.add(ellipsoid(chest + Rt @ np.array([0, -0.5 * u, 3.2 * u]), (3.0 * u, 2.8 * u, 1.4 * u)), K['g'])  # 가슴 핵
    for k in range(sp.get('spikes', 3)):
        a = (k - (sp.get('spikes', 3) - 1) / 2) * 0.6; p = chest + Rt @ np.array([math.sin(a) * 4 * u, 4.5 * u, -2 * u]); M.add(capsule(p, p + Rt @ np.array([math.sin(a) * 2 * u, 3.5 * u, -2 * u]), 1.2 * u, 0.3 * u), K['a'])
    head = up([0, 15 * u, 2.2 * u]); hs = sp.get('head', 1)
    M.add(ellipsoid(head, (3.6 * u * hs, 3.4 * u * hs, 3.4 * u * hs)), K['a'])
    M.add(ellipsoid(head + Rt @ np.array([0, -1.6 * u, 2.4 * u]), (2.4 * u, 0.8 * u + smash * u, 1.2 * u)), K['mouth'])
    eyes(M, head + Rt @ np.array([0, 0.6 * u, 0]), Rt @ np.array([0, 0, 1.0]), Rt @ np.array([1.0, 0, 0]), np.array([0, 1.0, 0]), sp['n_eye'], 3.3 * u * hs, u=u * 0.8)
    if sp.get('horns'):
        for s in (1, -1): M.add(capsule(head + Rt @ np.array([s * 2.5 * u, 2 * u, 0]), head + Rt @ np.array([s * 5 * u, 5 * u, -1.5 * u]), 1.1 * u, 0.3 * u), K['bone'])
    for s in (1, -1):
        sh = up([s * 7 * u * B, 11.5 * u, 0])
        if st == 'attack': ad = np.array([s * 0.25, 0.2 + 1.6 * arm_up - 1.0 * smash, 0.6 + 0.6 * smash - 0.5 * arm_up])
        elif walk: ad = np.array([s * 0.35, -1.0, 0.4 * math.sin(TAU * t + (0 if s > 0 else math.pi))])
        else: ad = np.array([s * 0.35, -1.0, 0.25 + 0.06 * math.sin(TAU * t)])
        ad = Rt @ (ad / np.linalg.norm(ad)); el = sh + ad * 6.5 * u * sp.get('arm', 1)
        fd = Rt @ np.array([0, -0.4 if st != 'attack' else -0.2 - smash, 1.0]); fd /= np.linalg.norm(fd); ha = el + fd * 6 * u * sp.get('arm', 1)
        M.add(ellipsoid(sh, 3.0 * u * B), K['a'])
        M.add(capsule(sh, el, 2.4 * u * B * sp.get('arm', 1), 2.0 * u * B), K['m']); M.add(capsule(el, ha, 2.1 * u * B * sp.get('arm', 1), 2.6 * u * B), K['m'])
        for k in range(3): M.add(capsule(ha, ha + fd * 2.8 * u + Rt @ np.array([(k - 1) * 1.1 * u, -1.0 * u, 0]), 0.7 * u, 0.25 * u), K['bone'])
        M.tips['w%d' % s] = ha + fd * 3 * u

def plan_swim(sp, st, t, M, K):
    u = sp['u']; R = 5.5 * u * sp.get('bulk', 1); h = 8 * u + 1.2 * u * math.sin(TAU * t); lunge = 0
    if st == 'attack': a = ss(t / 0.4); b = ss((t - 0.4) / 0.2); c = ss((t - 0.65) / 0.35); lunge = b * (1 - c) - 0.4 * a * (1 - b)
    c = np.array([0, h, lunge * 6 * u]); wv = 2.0 if st == 'walk' else 1.0
    M.add(ellipsoid(c, (R * 0.85, R * 0.75, R * 1.5)), K['m'])
    M.add(ellipsoid(c + np.array([0, -R * 0.3, R * 0.2]), (R * 0.7, R * 0.4, R * 1.2)), K['a'])
    for k in range(sp['n_spot']): M.decal(c + np.array([(k % 2 - 0.5) * R, R * 0.55, (k - 2) * R * 0.4]), sp['c2'], 1, 0.8)
    eyes(M, c + np.array([0, R * 0.2, R * 0.6]), np.array([0, 0, 1.0]), np.array([1.0, 0, 0]), np.array([0, 1.0, 0]), sp['n_eye'], R * 0.95, u=u * 0.8)
    p = c + np.array([0, 0, -R * 1.4])
    for j in range(6):
        q = p + np.array([math.sin(TAU * t * wv - j * 0.9) * 2.0 * u, 0, -2.6 * u]); M.add(capsule(p, q, (1.7 - j * 0.25) * u), K['g'] if j == 5 else K['a']); p = q
    for s in (1, -1):  # 앞다리(집게)
        b0 = c + np.array([s * R * 0.6, -R * 0.2, R * 1.1]); tip = b0 + np.array([s * 1.5 * u, -2 * u, 3.5 * u + lunge * 4 * u]); M.add(capsule(b0, tip, 1.2 * u, 0.4 * u), K['bone']); M.tips['w%d' % s] = tip
    for k in range(3):
        for s in (1, -1): M.add(capsule(c + np.array([s * R * 0.6, -R * 0.4, (k - 1) * R * 0.6]), c + np.array([s * R * 1.2, -R * 0.9, (k - 1) * R * 0.6 + math.sin(TAU * t * wv * 2 + k) * u]), 0.6 * u, 0.3 * u), K['d'])

def plan_flyer(sp, st, t, M, K):
    u = sp['u']; R = 4.8 * u; h = 16 * u + 1.5 * u * math.sin(TAU * t * 2); dive = 0
    if st == 'attack': a = ss(t / 0.4); b = ss((t - 0.4) / 0.25); c = ss((t - 0.7) / 0.3); h += 4 * u * a - 8 * u * b * (1 - c); dive = b * (1 - c)
    c = np.array([0, h, dive * 5 * u]); flap = math.sin(TAU * t * (3 if st != 'idle' else 2))
    M.add(ellipsoid(c, (R * 0.8, R * 0.8, R * 1.3)), K['m']); M.add(ellipsoid(c + np.array([0, R * 0.2, R * 1.1]), R * 0.6), K['a'])
    eyes(M, c + np.array([0, R * 0.3, R * 1.1]), np.array([0, 0, 1.0]), np.array([1.0, 0, 0]), np.array([0, 1.0, 0]), sp['n_eye'], R * 0.6, u=u * 0.7)
    for s in (1, -1):
        root = c + np.array([s * R * 0.6, R * 0.4, 0])
        for k in range(3):
            tip = root + np.array([s * (9 - k * 1.5) * u * math.cos(flap * 0.7), (6 * flap - k * 1.0) * u, (-k * 2.5 + 1) * u])
            M.add(capsule(root, tip, 1.1 * u, 0.4 * u), K['a'] if k else K['m'])
            M.add(capsule(tip, root + (tip - root) * 0.3 + np.array([0, -2 * u, -2 * u]), 0.5 * u), K['g'] if k == 1 else K['a'])
    tail = c + np.array([0, -R * 0.2, -R * 1.2]); M.add(capsule(tail, tail + np.array([0, -2 * u, -5 * u]), 1.5 * u, 0.4 * u), K['m'])
    M.add(ellipsoid(tail + np.array([0, -2.5 * u, -5.5 * u]), 1.6 * u), K['g'])
    M.tips['w1'] = c + np.array([0, 0, R * 1.6])

def plan_phage(sp, st, t, M, K):
    u = sp['u']; walk = st == 'walk'; h = 9 * u; bob = 0.6 * u * math.sin(4 * TAU * t) if walk else 0.3 * u * math.sin(TAU * t); stab = 0
    if st == 'attack': a = ss(t / 0.4); b = ss((t - 0.4) / 0.2); c = ss((t - 0.65) / 0.35); h += 4 * u * a * (1 - b) - 3 * u * b * (1 - c); stab = b * (1 - c)
    collar = np.array([0, h + bob, 0]); head = collar + np.array([0, 9 * u, stab * 3 * u])
    M.add(capsule(collar, head + np.array([0, -4 * u, 0]), 1.6 * u), K['a'])
    for k in range(4): M.add(ellipsoid(collar + np.array([0, 1.2 * u + k * 1.3 * u, 0]), (2.2 * u, 0.5 * u, 2.2 * u)), K['d'])
    R = 5.5 * u * sp.get('bulk', 1)
    # 정이십면체 머리 (각진 상자 두 개로 표현)
    M.add(box(head, rot_y(0.785) @ rot_x(0.6), (R * 0.72, R * 0.72, R * 0.72)), K['m'])
    M.add(ellipsoid(head, R * 0.62), K['g'])
    eyes(M, head, np.array([0, 0, 1.0]), np.array([1.0, 0, 0]), np.array([0, 1.0, 0]), sp['n_eye'], R * 0.9, u=u * 0.9)
    if sp.get('spikes'):
        for k in range(sp['spikes']):
            a = k / sp['spikes'] * TAU; d = np.array([math.cos(a), 0.4 * math.sin(a * 2), math.sin(a)]); d /= np.linalg.norm(d)
            M.add(capsule(head + d * R * 0.8, head + d * R * 1.5, 0.8 * u, 0.3 * u), K['a'])
    for k in range(6):
        a = k / 6 * TAU + 0.5; sw, lift = legs_gait(t, k, 6, walk, 0.5)
        knee = collar + np.array([math.cos(a) * 6 * u, 2 * u + lift * 2 * u, math.sin(a) * 6 * u + sw * 2 * u])
        foot = np.array([math.cos(a) * 8.5 * u, lift * 2 * u, math.sin(a) * 8.5 * u + sw * 3 * u + stab * 2 * u])
        M.add(capsule(collar, knee, 0.9 * u, 0.7 * u), K['d']); M.add(capsule(knee, foot, 0.7 * u, 0.4 * u), K['a'])
    M.tips['w1'] = head + np.array([0, 0, R])

def plan_spinner(sp, st, t, M, K):
    u = sp['u']; R = 7.5 * u * sp.get('bulk', 1); spin = TAU * t * (2 if st != 'idle' else 0.5); h = R + 1.5 * u + 0.8 * u * math.sin(TAU * t)
    pulse = 0
    if st == 'attack': a = ss(t / 0.45); b = ss((t - 0.45) / 0.25); c = ss((t - 0.75) / 0.25); pulse = a * (1 - c); spin *= 1 + 3 * b
    c = np.array([0, h, 0])
    M.add(ellipsoid(c, R * (1 + 0.08 * pulse)), K['m'])
    M.add(ellipsoid(c + np.array([0, 0, R * 0.25]), R * (0.55 + 0.25 * pulse)), K['g'])
    n = sp.get('spikes', 10)
    for k in range(n):
        phi = math.acos(1 - 2 * (k + 0.5) / n); th = k * 2.4 + spin
        d = np.array([math.sin(phi) * math.cos(th), math.cos(phi), math.sin(phi) * math.sin(th)])
        M.add(capsule(c + d * R * 0.9, c + d * R * (1.45 + 0.25 * pulse), 1.1 * u, 0.4 * u), K['a'])
        M.add(ellipsoid(c + d * R * (1.5 + 0.25 * pulse), 1.0 * u), K['g'])
    eyes(M, c, np.array([0, 0, 1.0]), np.array([1.0, 0, 0]), np.array([0, 1.0, 0]), sp['n_eye'], R * 0.98, u=u)
    M.tips['w1'] = c + np.array([0, 0, R * 1.5])

PLANS = dict(blob=plan_blob, floater=plan_floater, worm=plan_worm, spider=plan_spider, beast=plan_beast, biped=plan_biped, swim=plan_swim, flyer=plan_flyer, phage=plan_phage, spinner=plan_spinner)

def build(sp, st, t):
    """st: idle/walk/attack/hit/death, t: 0~1"""
    M = Model(); K = mats(sp); P = PLANS[sp['plan']]
    base = 'idle' if st in ('hit', 'death') else st
    P(sp, base, 0.0 if st in ('hit', 'death') else t, M, K)
    for extra in sp.get('boss_extra', []): extra(sp, st, t, M, K)
    settle(M)
    if sp['plan'] == 'flyer': xform(M, np.eye(3), off=(0, 9 * sp['u'], 0))   # 공중에 떠 있음
    if st == 'hit':
        k = [0.7, 1.0][min(1, int(t * 2))]
        xform(M, rot_x(-0.32 * k) @ np.diag([1 + 0.05 * k, 1 - 0.08 * k, 1]), off=(0, 0, -1.8 * k * sp['u']))
    if st == 'death':
        e = ss(t / 0.7)
        xform(M, rot_z(0.35 * e) @ rot_x(-0.4 * e) @ np.diag([1 + 0.35 * e, 1 - 0.62 * e, 1 + 0.35 * e]))
    if st != 'death' or sp['plan'] != 'flyer': settle(M) if sp['plan'] != 'flyer' or st == 'death' else None
    if st == 'death': settle(M)
    return M
