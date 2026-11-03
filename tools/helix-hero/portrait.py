# 대화창·HUD용 주인공 초상화: 얼굴 전용 정밀 모델 (눈·눈꺼풀·눈썹·코·입·머리카락 가닥)
#   python3 portrait.py [출력폴더]
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rig
rig.SCALE = 4.4; rig.DENS = 12.0; rig.PITCH = math.radians(4)
rig.LIGHT[:] = rig.LIGHT / 1.0
import numpy as np
from PIL import Image
from rig import *
from hero import SKIN, HAIR, COAT, TRIM, SHIRT, METAL, LENS, M_

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '../../games/helix/assets/hero/')
def V(*a): return np.array(a, float)
def limb(M, a, b, r1, r2, mat, pid=None): M.add(capsule(V(*a) if isinstance(a, tuple) else a, V(*b) if isinstance(b, tuple) else b, r1, r2), mat, pid)
WHITE = M_(['#9aa0b0', '#d8dce6', '#f4f6fa', '#ffffff'])
IRIS = M_(['#0a6a5e', '#1ec8b0', '#7ef6e0', '#e8fffa'], True, '#2ae8c8')
LASH = M_(['#06040a', '#120c14', '#1e161e', '#2a2026'])
LIP = M_(['#3a1410', '#5a2620', '#7a3a2e', '#9a5040'])
BROW = M_(['#0a0608', '#1a1014', '#2a1e22', '#3a2c2e'])

def head_model(expr='calm'):
    M = Model()
    # 어깨·가슴(가운) + 셔츠 + 옷깃
    M.add(oriented_ellipsoid(V(0, -13.5, -0.5), np.eye(3), (11.5, 6.0, 5.2)), COAT, pid=1)
    for s in (1, -1): M.add(ellipsoid(V(s * 8.6, -11.8, -0.5), (3.8, 3.4, 3.6)), COAT, pid=2)
    for k in range(5):
        M.add(oriented_ellipsoid(V(0, -9.0 - k * 1.5, 4.3 - k * 0.15), np.eye(3), (1.1 + k * 0.45, 1.0, 0.6)), SHIRT, pid=3)
    for s in (1, -1):
        for k in range(5): limb(M, V(s * (1.1 + k * 0.45), -8.6 - k * 1.5, 4.5), V(s * (1.4 + k * 0.45), -10.1 - k * 1.5, 4.4), 0.38, 0.38, TRIM, pid=4)
    for a in range(6):
        ang = a * math.pi / 3; M.decal(V(math.cos(ang) * 0.9 - 2.8, -14.0 + math.sin(ang) * 0.9, 5.0), '#46ffb0', 1, 1.5)
    limb(M, V(0, -8.5, 0.3), V(0, -4.5, 0.6), 1.9, 1.8, SKIN, pid=5)
    for k in range(11):
        a = -2.5 + k * 0.5
        b0 = V(math.sin(a) * 3.1, -8.4, math.cos(a) * 2.7 - 0.2); t0 = V(math.sin(a) * 4.0, -5.4, math.cos(a) * 3.4 - 0.6)
        limb(M, b0, t0, 0.8, 0.65, COAT, pid=6); M.add(ellipsoid(t0, 0.55), TRIM, pid=7)
    # 얼굴: 머리 + 턱선(V자) + 광대
    M.add(ellipsoid(V(0, 0.4, 0), (4.0, 4.5, 4.0)), SKIN, pid=10)
    M.add(oriented_ellipsoid(V(0, -2.4, 0.9), rot_x(0.25), (2.9, 2.4, 2.9)), SKIN, pid=10)
    M.add(ellipsoid(V(0, -4.0, 1.9), (1.5, 1.0, 1.5)), SKIN, pid=10)
    for s in (1, -1): M.add(ellipsoid(V(s * 3.9, -0.3, -0.2), (0.6, 1.2, 0.9)), SKIN, pid=11)
    # 코 · 입
    M.add(oriented_ellipsoid(V(0, -1.0, 3.9), rot_x(-0.3), (0.45, 1.0, 0.55)), SKIN, pid=12)
    limb(M, V(-0.75, -2.75, 3.35), V(0.75, -2.8, 3.35), 0.16, 0.16, LIP, pid=13)
    M.decal(V(0.9, -2.6, 3.35), '#8a4a3a', 1, 1.2)
    # 눈: 흰자 + 청록 홍채 + 동공 + 빛점 + 윗눈꺼풀 선
    for s in (1, -1):
        c = V(s * 1.6, -0.15, 3.35)
        M.add(oriented_ellipsoid(c, rot_y(s * 0.25), (1.05, 0.78, 0.35)), WHITE, pid=20)
        M.add(oriented_ellipsoid(c + V(-s * 0.05, -0.05, 0.25), rot_y(s * 0.25), (0.6, 0.72, 0.18)), IRIS, pid=21)
        M.decal(c + V(-s * 0.05, -0.05, 0.5), '#06201c', 1, 1.0)
        M.decal(c + V(-s * 0.05 + 0.25, 0.25, 0.5), '#ffffff', 1, 1.0)
        limb(M, c + V(-s * 1.0, 0.55, 0.15), c + V(s * 1.1, 0.75, -0.05), 0.2, 0.17, LASH, pid=22)
        limb(M, c + V(s * 1.05, 0.75, -0.05), c + V(s * 1.4, 0.35, -0.25), 0.17, 0.1, LASH, pid=22)
        # 눈썹: 바깥쪽이 올라간 결연한 눈썹
        limb(M, c + V(-s * 0.9, 1.45, 0.25), c + V(s * 1.1, 1.85, 0.05), 0.24, 0.16, BROW, pid=23)
    # 고글 (이마 위로 올림)
    for k in range(18):
        a = k / 18 * 2 * math.pi
        M.add(ellipsoid(V(math.sin(a) * 4.45, 2.9 - 0.15 * math.cos(a), math.cos(a) * 4.3), 0.36), METAL, pid=30)
    for s in (1, -1):
        c = V(s * 1.75, 3.5, 3.35); ax = rot_x(-0.9)
        for k in range(14):
            a = k / 14 * 2 * math.pi; M.add(ellipsoid(c + ax @ V(math.cos(a) * 1.45, math.sin(a) * 1.15, 0.3), 0.26), METAL, pid=31)
        M.add(oriented_ellipsoid(c + ax @ V(0, 0, 0.35), ax, (1.25, 0.95, 0.4)), LENS, pid=32)
        M.decal(c + ax @ V(-0.5, 0.4, 0.75), '#ffffff', 1, 1.0)
    limb(M, V(-0.4, 3.6, 3.7), V(0.4, 3.6, 3.7), 0.35, 0.35, METAL, pid=33)
    # 머리카락: 두피 + 앞머리 가닥 + 옆·뒤 삐침
    M.add(ellipsoid(V(0, 1.6, -0.6), (4.35, 4.0, 4.3)), HAIR, pid=40)
    bangs = [(-2.6, 4.0, 2.4, -3.4, 0.6, 3.6), (-1.4, 4.4, 2.8, -1.8, 0.4, 4.0), (-0.2, 4.6, 2.9, 0.4, 0.9, 4.1), (1.0, 4.4, 2.8, 1.6, 0.3, 3.9),
             (2.2, 4.0, 2.4, 3.2, 0.5, 3.4), (-3.4, 3.4, 1.0, -4.4, -1.6, 1.6), (3.4, 3.4, 1.0, 4.5, -1.4, 1.4), (-3.6, 2.6, -1.0, -4.6, -3.0, -0.2), (3.6, 2.6, -1.0, 4.6, -2.8, -0.4)]
    for x0, y0, z0, x1, y1, z1 in bangs: limb(M, V(x0, y0, z0), V(x1, y1, z1), 1.0, 0.18, HAIR, pid=41)
    spikes = [(0, 5.0, -0.5, 0.6, 7.6, -2.6), (-2.0, 4.8, -0.6, -3.6, 7.0, -2.2), (2.0, 4.8, -0.6, 3.6, 7.2, -2.4), (-1.0, 4.6, -2.6, -1.8, 6.6, -5.4),
              (1.2, 4.6, -2.6, 2.2, 6.4, -5.6), (0, 3.6, -3.6, 0.3, 3.4, -6.4), (-3.0, 3.6, -2.4, -5.0, 4.6, -4.4), (3.0, 3.6, -2.4, 5.0, 4.8, -4.2)]
    for x0, y0, z0, x1, y1, z1 in spikes: limb(M, V(x0, y0, z0), V(x1, y1, z1), 1.4, 0.25, HAIR, pid=42)
    return M

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for name, yaw, W in (('portrait', -0.38, 112), ('portrait_front', 0.0, 112)):
        M = head_model()
        im = render(M, yaw, W, W, foot_y=66, ox=4 if yaw else 0)
        Image.fromarray(im).save(os.path.join(OUT, name + '.webp'), 'WEBP', lossless=True, method=6)
        print(name, 'ok')
