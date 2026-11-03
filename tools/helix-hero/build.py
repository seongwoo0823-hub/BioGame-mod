# 주인공 전체 스프라이트 시트 생성
#   python3 build.py [출력폴더] [동작 이름 ...]
# 시트: 동작마다 1장, 가로 = 프레임, 세로 = 8방향(S, SE, E, NE, N, NW, W, SW)
import sys, os, math, json, time
import numpy as np
from PIL import Image
from multiprocessing import Pool
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hero import build, weapon_tips
from rig import render
from anim import ANIMS, NFR, LOOP, SMEAR, FX, TINT, pose as pose_air
import rig as _rig

def pose(name, t):
    """공중 높이(air)는 그림에서 빼고 따로 기록 → 게임이 그림자는 바닥에, 몸은 위로 띄워 그림"""
    q = pose_air(name, t); q['air'] = 0.0; return q
def lift_px(name, t): return round(pose_air(name, t)['air'] * _rig.SCALE * math.cos(_rig.PITCH), 1)

C = 160; FOOT = 118
DIRS = ['S', 'SE', 'E', 'NE', 'N', 'NW', 'W', 'SW']
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '../../games/helix/assets/hero/')
SMC = ['#f2fffa', '#5cffcf', '#13a888']

def ftime(name, f):
    n = NFR[name]
    return f / n if name in LOOP else f / max(1, n - 1)

def job(args):
    name, d = args
    n = NFR[name]; yaw = d * math.pi / 4
    row = Image.new('RGBA', (C * n, C), (0, 0, 0, 0))
    for f in range(n):
        t = ftime(name, f); q = pose(name, t); M = build(q)
        if name in SMEAR:
            a0, a1 = SMEAR[name]
            if a0 <= t <= a1 + 1e-6:
                dt = 1.0 / max(1, n - 1)
                t0 = max(a0 - 0.04, t - dt * 1.15)
                ins, outs = [], []
                for u in np.linspace(t0, t, 9):
                    i_, o_ = weapon_tips(pose(name, u)); ins.append(i_); outs.append(o_)
                span = np.linalg.norm(outs[-1] - outs[0])
                if span > 4.0: M.smear.append({'in': ins, 'out': outs, 'cols': SMC})
        fx = FX.get(name)
        tint = (TINT, fx['tint'][f]) if fx and fx['tint'][f] > 0 else None
        dis = fx['dis'][f] if fx else 0.0
        im = render(M, yaw, C, C, FOOT, tint=tint, dissolve=dis, seed=f * 7 + d)
        row.alpha_composite(Image.fromarray(im), (f * C, 0))
    return name, d, row, [lift_px(name, ftime(name, f)) for f in range(n)]

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    only = sys.argv[2:] or [a[0] for a in ANIMS]
    jobs = [(a, d) for a in only for d in range(8)]
    t0 = time.time(); sheets = {}
    lifts = {}
    with Pool(4) as p:
        for name, d, row, lf in p.imap_unordered(job, jobs):
            lifts[name] = lf
            sh = sheets.setdefault(name, Image.new('RGBA', (C * NFR[name], C * 8), (0, 0, 0, 0)))
            sh.paste(row, (0, d * C))
    for name, sh in sheets.items():
        fn = os.path.join(OUT, f'hero_{name}.webp'); sh.save(fn, 'WEBP', lossless=True, method=6)
        print(name, sh.size, os.path.getsize(fn) // 1024, 'KB')
    mp = os.path.join(OUT, 'hero.json'); old = json.load(open(mp)) if os.path.exists(mp) else {}
    oldl = {a['id']: a.get('lift') for a in old.get('anims', [])}
    an = []
    for a, n, lp, nm in ANIMS:
        e = dict(id=a, frames=n, loop=lp, name=nm, file=f'hero_{a}.webp')
        lf = lifts.get(a, oldl.get(a))
        if lf and any(x > 0.5 for x in lf): e['lift'] = lf
        an.append(e)
    meta = dict(cell=C, foot=FOOT, dirs=DIRS, anims=an)
    json.dump(meta, open(os.path.join(OUT, 'hero.json'), 'w'), ensure_ascii=False, indent=1)
    print('done', round(time.time() - t0, 1), 's')
