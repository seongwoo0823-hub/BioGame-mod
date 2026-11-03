# 마을 '쉼터' NPC 4명: 대기 동작 8프레임 × 8방향
#   python3 npcs.py [출력폴더]
import sys, os, math, json
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../helix-hero'))
import numpy as np
from PIL import Image
from multiprocessing import Pool
from rig import *
import hero as HERO
from hero import skeleton, BASE, limb, nz
TAU = 2 * math.pi
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '../../games/helix/assets/world/')
def M_(r, em=False, glow=None): return Mat(r, em, glow or (r[2] if em else None))
def V(*a): return np.array(a, float)
SKIN = HERO.SKIN; SKIN2 = M_(['#4a2a1e', '#7a4a32', '#a86e4e', '#d09a74'])
GREY = M_(['#4a4a52', '#7a7a84', '#a8a8b2', '#d4d4dc', '#f4f4f8'])
COAT = HERO.COAT; PURP = M_(['#2a1240', '#4a2070', '#6e34a0', '#9a5ad0'])
DARK = M_(['#0c0c10', '#18181e', '#26262e', '#363642'])
CLOAK = M_(['#14200e', '#22341a', '#324a26', '#446234', '#5a7c44'])
LEATH = M_(['#24160c', '#3a2414', '#54361e', '#704a2a'])
BOARD = M_(['#3a2a14', '#5a4220', '#7a5a2e', '#9a7640'])
PAPER = M_(['#8a8678', '#b4b0a2', '#d8d4c6', '#f4f0e4'])
G = lambda a, b, c: M_([a, b, c, '#ffffff'], True, b)
G_GREEN = G('#0a7a4a', '#2ae08a', '#a0ffd0'); G_CYAN = G('#0a5a7a', '#2ac0f0', '#a0f0ff'); G_PINK = G('#7a1a5a', '#ff5ad0', '#ffc0f0'); G_AMBER = G('#7a4a00', '#ffb020', '#ffe8a0')

def ground(M, J):
    soles = min(J['lan'][1], J['ran'][1]) - 2.4
    M.parts = [(p - V(0, soles, 0), n, m, i) for p, n, m, i in M.parts]
    M.decals = [(d - V(0, soles, 0), c, s, b) for d, c, s, b in M.decals]

def human_base(M, q, coat, trim, lining, pants, boots, shirt):
    J = skeleton(q); R = J['R']
    for s in 'lr':
        limb(M, J[s + 'hip'], J[s + 'kn'], 2.4, 2.0, pants); limb(M, J[s + 'kn'], J[s + 'an'] + V(0, 1.2, 0), 2.0, 1.8, pants)
        A = J[s + 'an']; limb(M, A + V(0, 1.6, 0), A + V(0, -0.5, 0), 2.0, 1.9, boots); limb(M, A + V(0, -0.9, -0.7), A + V(0, -1.2, 3.4), 1.7, 1.4, boots)
    saved = (HERO.COAT, HERO.TRIM, HERO.LINING)
    HERO.COAT, HERO.TRIM, HERO.LINING = coat, trim, lining
    try: HERO.coat_skirt(M, J, q)
    finally: HERO.COAT, HERO.TRIM, HERO.LINING = saved
    M.add(oriented_ellipsoid(J['abd'], R, (4.2, 3.7, 2.9)), coat); M.add(oriented_ellipsoid(J['chest'], R, (5.3, 4.6, 3.3)), coat)
    for k in range(6): M.add(oriented_ellipsoid(J['pel'] + R @ V(0, 11.6 - k * 1.3, 3.1), R, (0.9 + k * 0.3, 1.0, 0.5)), shirt)
    limb(M, J['chest'], J['neck'], 1.6, 1.5, SKIN)
    for s in 'lr':
        sh, el, ha = J[s + 'sh'], J[s + 'el'], J[s + 'ha']
        M.add(ellipsoid(sh, 2.4), coat); limb(M, sh, el, 2.1, 1.9, coat); fa = nz(ha - el)
        limb(M, el, ha - fa * 1.6, 1.9, 2.0, coat); M.add(capsule(ha - fa * 1.8, ha - fa * 1.1, 2.1, 2.1, caps=False), trim)
        limb(M, ha - fa * 1.1, ha, 1.3, 1.3, SKIN); M.add(ellipsoid(ha + fa * 0.4, 1.4), SKIN)
    return J

def mentor(t):
    """하나 박사: 회색 머리를 틀어 올린 노련한 연구 책임자, 안경, 서류판"""
    b = math.sin(TAU * t)
    q = dict(BASE); q.update(drop=0.3 + 0.25 * b, rh=(-3.0, 8.5 + 0.3 * b, 6.0), lh=(3.5, 8.0, 6.5), cape=0.08 + 0.04 * b, hp=0.06 * math.sin(TAU * t + 1), hy=0.15 * math.sin(TAU * t * 0.5))
    M = Model(); J = human_base(M, q, COAT, PURP, PURP, DARK, DARK, M_(['#2a1a3a', '#3a2850', '#4c3866', '#604a80']))
    R = J['R']; H = J['head']; Rh = J['Rh']
    M.add(oriented_ellipsoid(H, Rh, (4.0, 4.4, 4.0)), SKIN2)
    M.add(oriented_ellipsoid(H + Rh @ V(0, 1.4, -0.7), Rh, (4.3, 3.8, 4.3)), GREY)
    M.add(ellipsoid(H + Rh @ V(0, 3.6, -3.4), 2.4), GREY); limb(M, H + Rh @ V(-1.5, 4.6, -3.0), H + Rh @ V(1.8, 3.0, -4.6), 0.3, 0.3, BOARD)   # 쪽진 머리 + 비녀
    for s in (1, -1):
        c = H + Rh @ V(s * 1.6, 0.1, 3.9)
        for k in range(10): a = k / 10 * TAU; M.add(ellipsoid(c + Rh @ V(math.cos(a) * 1.1, math.sin(a) * 0.9, 0), 0.22), DARK)
        M.decal(c + Rh @ V(0, 0, 0.3), '#1a1020', 1, 1.6)
    limb(M, H + Rh @ V(-0.6, 0.2, 4.0), H + Rh @ V(0.6, 0.2, 4.0), 0.2, 0.2, DARK)
    M.decal(H + Rh @ V(0, -2.4, 3.8), '#7a3a3a', 2, 1.4)
    # 서류판
    c = (J['lha'] + J['rha']) / 2 + R @ V(0, 2.0, 1.5)
    M.add(box(c, R @ rot_x(-0.5), (3.4, 4.4, 0.35)), BOARD); M.add(box(c + R @ rot_x(-0.5) @ V(0, -0.3, 0.4), R @ rot_x(-0.5), (2.8, 3.6, 0.1)), PAPER)
    M.add(oriented_ellipsoid(J['chest'] + R @ V(-3, 2, 3.4), R, (0.9, 1.2, 0.3)), G_CYAN)   # 사원증
    ground(M, J); return M

def merchant(t):
    """상인 바이알: 두건과 망토, 약병이 주렁주렁 달린 배낭"""
    b = math.sin(TAU * t)
    q = dict(BASE); q.update(drop=0.6 + 0.3 * b, lean=0.12, rh=(-7.0, 6.0, 4.0), lh=(6.5, 3.0 + 0.4 * b, 2.0), cape=0.15 + 0.05 * b, hp=0.1)
    M = Model(); J = human_base(M, q, CLOAK, LEATH, LEATH, LEATH, DARK, LEATH)
    R = J['R']; H = J['head']; Rh = J['Rh']
    M.add(oriented_ellipsoid(H, Rh, (3.9, 4.3, 3.9)), SKIN2)
    M.add(oriented_ellipsoid(H + Rh @ V(0, 0.9, -0.8), Rh, (5.0, 5.2, 5.0)), CLOAK)     # 두건
    limb(M, H + Rh @ V(0, 3.0, -3.5), H + Rh @ V(0, 0.5, -7.0), 2.0, 0.8, CLOAK)
    M.add(oriented_ellipsoid(H + Rh @ V(0, -1.4, 3.6), Rh, (3.0, 1.8, 1.0)), LEATH)   # 마스크
    for s in (1, -1): M.add(oriented_ellipsoid(H + Rh @ V(s * 1.5, 0.6, 3.9), Rh, (1.0, 0.9, 0.5)), G_AMBER)
    bp = J['chest'] + R @ V(0, 0, -5.2)
    M.add(box(bp, R, (4.6, 5.6, 2.4)), LEATH)
    for k, (x, y) in enumerate(((-3, 4), (0, 6), (3, 4.5), (-2, -3), (2.5, -2))):
        p = bp + R @ V(x, y, -2.6); M.add(ellipsoid(p, 1.2), [G_GREEN, G_PINK, G_AMBER, G_CYAN, G_GREEN][k]); limb(M, p + R @ V(0, 1, 0), p + R @ V(0, 2, 0), 0.4, 0.4, PAPER)
    # 오른손 저울
    ha = J['rha']; limb(M, ha, ha + V(0, -3, 0), 0.2, 0.2, M_(['#3a2408', '#6a4612', '#a87a20', '#e0b83a']))
    for s in (1, -1): M.add(oriented_ellipsoid(ha + V(s * 2, -3.5 + 0.4 * b * s, 0), np.eye(3), (1.4, 0.3, 1.4)), M_(['#3a2408', '#6a4612', '#a87a20', '#e0b83a']))
    ground(M, J); return M

def drone(t):
    """기록 드론 아키: 떠다니는 구체 로봇, 화면 얼굴, 작은 팔"""
    M = Model(); y = 22 + 1.6 * math.sin(TAU * t)
    c = V(0, y, 0); R = rot_z(0.08 * math.sin(TAU * t)) @ rot_x(0.06 * math.cos(TAU * t))
    SH = M_(['#2a3038', '#4a5460', '#7a8694', '#b4c0cc', '#eef4fa'])
    M.add(oriented_ellipsoid(c, R, (6.5, 6.0, 6.5)), SH)
    M.add(oriented_ellipsoid(c + R @ V(0, 0.3, 5.2), R, (4.2, 3.2, 1.6)), M_(['#06141a', '#0a2028', '#10303a', '#18404c']))
    blink = (t % 0.5) > 0.45
    for s in (1, -1): M.add(oriented_ellipsoid(c + R @ V(s * 1.5, 0.8, 6.6), R, (0.7, 0.2 if blink else 0.9, 0.3)), G_CYAN)
    M.add(oriented_ellipsoid(c + R @ V(0, -1.0, 6.6), R, (1.2, 0.25, 0.3)), G_CYAN)
    M.add(oriented_ellipsoid(c + R @ V(0, 5.6, 0), R, (2.0, 1.4, 2.0)), SH); limb(M, c + R @ V(0, 6.6, 0), c + R @ V(0, 9.5, 0), 0.3, 0.3, SH); M.add(ellipsoid(c + R @ V(0, 10, 0), 0.8), G_GREEN)
    a = TAU * t * 4
    M.add(oriented_ellipsoid(c + R @ V(0, -6.2, 0), R, (4.0, 0.6, 4.0)), SH)
    for k in range(3):
        b = a + k * TAU / 3; M.add(oriented_ellipsoid(c + R @ V(math.cos(b) * 4.5, -6.6, math.sin(b) * 4.5), R, (2.4, 0.2, 1.0)), M_(['#4a5460', '#7a8694', '#b4c0cc', '#eef4fa']))
    for s in (1, -1):
        sh = c + R @ V(s * 6.2, -1, 1); el = sh + V(s * 2, -2.5, 1.5 + 0.8 * math.sin(TAU * t + s)); limb(M, sh, el, 0.6, 0.5, SH); M.add(ellipsoid(el, 0.9), G_CYAN if s > 0 else SH)
    # 기록 홀로그램 판
    M.add(oriented_ellipsoid(c + R @ V(-8.5, 1, 4), rot_y(0.6), (2.6, 3.2, 0.15)), M_(['#0a3a4a', '#1a7a9a', '#4ac8e8', '#c0f4ff'], True, '#3ac8f0'))
    return M

def cat(t):
    """실험실 고양이 세포: 주황 줄무늬, 연구소 목걸이, 꼬리 살랑"""
    M = Model(); b = math.sin(TAU * t)
    FUR = M_(['#4a2a10', '#8a4e1e', '#c87a32', '#eaa858', '#ffd8a0']); STR = M_(['#3a1e0a', '#6a3a14', '#9a5a22', '#c27a3a'])
    c = V(0, 6.5 + 0.2 * b, 0)
    M.add(oriented_ellipsoid(c, np.eye(3), (3.6, 3.4, 6.5)), FUR)
    for k in range(3): M.add(oriented_ellipsoid(c + V(0, 3.0, -3 + k * 2.8), np.eye(3), (2.8, 0.8, 0.8)), STR)
    hc = c + V(0, 4.0, 6.5); hy = 0.3 * math.sin(TAU * t * 0.5)
    Rh = rot_y(hy) @ rot_x(-0.1)
    M.add(oriented_ellipsoid(hc, Rh, (3.2, 2.9, 2.9)), FUR)
    for s in (1, -1):
        limb(M, hc + Rh @ V(s * 1.8, 2.0, -0.3), hc + Rh @ V(s * 2.4, 4.6, -0.5), 1.2, 0.2, FUR)
        M.add(oriented_ellipsoid(hc + Rh @ V(s * 1.2, 0.4, 2.6), Rh, (0.7, 0.8 if (t % 0.5) < 0.45 else 0.15, 0.3)), M_(['#3a6a10', '#7ac81e', '#c8ff6a', '#f4ffd0'], True, '#9aff3a'))
        for k in range(2): M.decal(hc + Rh @ V(s * (1.8 + k * 0.6), -0.6 + k * 0.4, 2.4), '#ffffff', 1, 1.0)
    M.add(oriented_ellipsoid(hc + Rh @ V(0, -0.6, 2.8), Rh, (0.6, 0.4, 0.3)), M_(['#5a2232', '#a2505e', '#de8c96', '#ffc8ce']))
    M.add(oriented_ellipsoid(c + V(0, 3.2, 5.4), np.eye(3), (2.6, 0.6, 1.4)), M_(['#0e3a3a', '#14585a', '#1e7a7a', '#3aa0a0'])); M.add(ellipsoid(c + V(0, 2.4, 6.6), 0.6), G_AMBER)
    for (x, z) in ((2, 4.5), (-2, 4.5), (2, -4.5), (-2, -4.5)): limb(M, c + V(x, -1, z), V(x, 0.8, z + 0.6), 1.1, 0.9, FUR)
    pts = [c + V(0, 1.0, -6)]
    for k in range(1, 9):
        s = k / 8; pts.append(c + V(2.5 * math.sin(TAU * t + s * 2) * s, 1.0 + 9 * s - 3 * s * s, -6 - 5 * s))
    for a_, b_ in zip(pts, pts[1:]): limb(M, a_, b_, 1.0, 0.9, FUR)
    return M

NPCS = dict(mentor=(mentor, '하나 박사'), merchant=(merchant, '상인 바이알'), drone=(drone, '기록 드론 아키'), cat=(cat, '실험실 고양이 세포'))
NF = 8

def job(args):
    name, d = args; fn = NPCS[name][0]
    return name, d, [fn(f / NF) for f in range(NF)]

def framebox(name):
    xs = yu = yd = 0
    for f in range(NF):
        M = NPCS[name][0](f / NF); P = np.concatenate([p for p, n, m, i in M.parts])[::2]
        for d in range(8):
            sx, sy, _ = view_xform(P, d * math.pi / 4); xs = max(xs, np.abs(sx).max()); yu = max(yu, sy.max()); yd = max(yd, -sy.min())
    C = int(math.ceil((max(2 * xs, yu + yd) + 12) / 16) * 16); foot = int(math.ceil(yu + 6))
    if foot + yd + 6 > C: C = int(math.ceil((foot + yd + 6) / 16) * 16)
    return C, foot

def render_npc(name):
    C, foot = framebox(name)
    sh = Image.new('RGBA', (C * NF, C * 8))
    for d in range(8):
        for f in range(NF):
            M = NPCS[name][0](f / NF); sh.paste(Image.fromarray(render(M, d * math.pi / 4, C, C, foot)), (f * C, d * C))
    sh.save(os.path.join(OUT, f'npc_{name}.webp'), 'WEBP', lossless=True, method=6)
    return name, C, foot

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    with Pool(4) as p: res = p.map(render_npc, list(NPCS))
    meta = {n: dict(name=NPCS[n][1], cell=C, foot=foot, frames=NF, file=f'npc_{n}.webp') for n, C, foot in res}
    json.dump(meta, open(os.path.join(OUT, 'npcs.json'), 'w'), ensure_ascii=False, indent=1); print(meta)
