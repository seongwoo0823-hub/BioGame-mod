# 헬릭스 무기: 공생 드론 "베스파" — 8방향 × 6프레임 (회전 날개·눈 빛 깜빡임)
#   python3 drone.py [출력폴더]
import sys, os, math, json
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rig import *
from hero import M_, METAL, LENS, HELIXA, TRIM, GUNB

SHELL = M_(['#3a4256', '#8a92aa', '#d0d6e4', '#f2f4fa', '#ffffff'])
CORE = M_(['#08785a', '#1ce49c', '#98ffd0', '#f0fff8'], True, '#3cffae')
BLUR = M_(['#3a6a70', '#6ab0b4', '#a8e8e4', '#e0fffa'], True, '#9affe8')
C = 64; FOOT = 50; N = 6

def model(t):
    M = Model(); y0 = 10.0
    c = np.array([0, y0, 0])
    M.add(ellipsoid(c, (4.2, 2.6, 4.6)), SHELL, pid=1)                 # 몸통
    M.add(ellipsoid(c + [0, 1.6, -0.4], (2.6, 1.4, 2.8)), GUNB, pid=2)   # 등판
    M.add(ellipsoid(c + [0, 2.5, -0.4], (1.2, 0.7, 1.2)), CORE, pid=3)   # 등 코어 (나선 빛)
    M.add(ellipsoid(c + [0, 0.1, 4.1], (1.6, 1.4, 0.9)), LENS, pid=4)    # 앞 눈
    M.add(ellipsoid(c + [0, -2.2, 0.6], (1.4, 0.9, 1.6)), METAL, pid=5)  # 배 포신
    limb_ = lambda a, b, r, m, p: M.add(capsule(np.array(a, float), np.array(b, float), r, r), m, pid=p)
    limb_(c + [0, -2.4, 1.6], c + [0, -2.6, 4.4], 0.45, METAL, 6)
    for k in range(4):   # 날개 팔 4개와 회전 원판
        a = math.pi / 4 + k * math.pi / 2
        d = np.array([math.cos(a), 0, math.sin(a)])
        e = c + d * 7.2 + [0, 1.0, 0]
        limb_(c + d * 3.0, e, 0.6, TRIM, 10 + k)
        M.add(ellipsoid(e, (0.9, 0.8, 0.9)), GUNB, pid=20 + k)
        spin = t * math.pi * 2 + k
        P = [e + [math.cos(spin + j / 12 * math.tau) * 3.4, 0.6, math.sin(spin + j / 12 * math.tau) * 3.4] for j in range(13)]
        inner = [e + (np.array(p) - e) * 0.72 for p in P]
        M.add(sheet(np.array([inner, P]), nrm_hint=(0, 1, 0)), BLUR, pid=30 + k)
        M.add(capsule(e + [math.cos(spin) * 3.6, 0.7, math.sin(spin) * 3.6], e + [-math.cos(spin) * 3.6, 0.7, -math.sin(spin) * 3.6], 0.35, 0.35), SHELL, pid=40 + k)
    # 꼬리 안테나
    limb_(c + [0, 1.0, -4.0], c + [0, 4.2, -6.4], 0.3, METAL, 50)
    M.add(ellipsoid(c + [0, 4.4, -6.6], 0.7 + 0.3 * (t > 0.5)), HELIXA, pid=51)
    return M

if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '../../games/helix/assets/hero/')
    sh = Image.new('RGBA', (C * N, C * 8), (0, 0, 0, 0))
    for d in range(8):
        for f in range(N):
            im = render(model(f / N), d * math.pi / 4, C, C, FOOT, seed=f + d)
            sh.alpha_composite(Image.fromarray(im), (f * C, d * C))
    fn = os.path.join(out, 'drone.webp'); sh.save(fn, 'WEBP', lossless=True, method=6)
    print('drone', sh.size, os.path.getsize(fn) // 1024, 'KB')
