# 몬스터 스프라이트 시트 생성
#   python3 build.py [출력폴더] [몬스터 ...]
# 몬스터마다 동작별 시트 1장: 가로 = 프레임, 세로 = 8방향(S, SE, E, NE, N, NW, W, SW)
import sys, os, math, json, time
import numpy as np
from PIL import Image
from multiprocessing import Pool
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from roster import MOBS, SMEAR, make, CHAPTERS, autoframe
from rig import render

DIRS = ['S', 'SE', 'E', 'NE', 'N', 'NW', 'W', 'SW']
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '../../games/helix/assets/mobs/')
SMC = ['#fff4fa', '#e48aff', '#8a2ab0']

def ftime(n, loop, f): return f / n if loop else f / max(1, n - 1)

def job(args):
    mid, aid, n, loop, d, C, foot = args
    m = MOBS[mid]; m['cell'], m['foot'] = C, foot; yaw = d * math.pi / 4
    roots = []
    row = Image.new('RGBA', (C * n, C), (0, 0, 0, 0))
    for f in range(n):
        t = ftime(n, loop, f); M = make(mid, aid, t); roots.append(round(M.rootpx, 1))
        sm = SMEAR.get((mid, aid))
        if sm and sm[2] <= t <= sm[3] + 1e-6:
            ins, outs = [], []
            for u in np.linspace(max(sm[2] - 0.05, t - 1.1 / (n - 1)), t, 6):
                Mu = make(mid, aid, u); ins.append(Mu.tips[sm[0]]); outs.append(Mu.tips[sm[1]])
            if np.linalg.norm(outs[-1] - outs[0]) > 4: M.smear.append({'in': ins, 'out': outs, 'cols': SMC})
        tint = None; dis = 0.0
        if aid == 'hit' and f == 0: tint = ('#ffffff', 0.7)
        if aid == 'death':
            k = max(0.0, (t - 0.45) / 0.55)
            if k > 0: tint = (m['tint'], min(1, k * 1.3)); dis = 0.9 * k ** 1.3
        im = render(M, yaw, C, C, m['foot'], tint=tint, dissolve=dis, seed=f * 13 + d)
        row.alpha_composite(Image.fromarray(im), (f * C, 0))
    return mid, aid, d, row, roots

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    only = sys.argv[2:] or list(MOBS)
    t0 = time.time(); frame = {}
    with Pool(4) as p:
        for mid, cf in zip(only, p.map(autoframe, only)): frame[mid] = cf; MOBS[mid]['cell'], MOBS[mid]['foot'] = cf
    print('frames', frame, round(time.time() - t0, 1), 's')
    jobs = [(mid, a, n, lp, d) + frame[mid] for mid in only for (a, n, lp, _) in MOBS[mid]['anims'] for d in range(8)]
    sheets = {}; rootd = {}
    with Pool(4) as p:
        for mid, aid, d, row, roots in p.imap_unordered(job, jobs, chunksize=1):
            rootd[(mid, aid)] = roots
            C = MOBS[mid]['cell']; n = row.width // C
            sh = sheets.setdefault((mid, aid), Image.new('RGBA', (C * n, C * 8), (0, 0, 0, 0)))
            sh.paste(row, (0, d * C))
    for (mid, aid), sh in sheets.items():
        sh.save(os.path.join(OUT, f'{mid}_{aid}.webp'), 'WEBP', lossless=True, method=6)
    # 전체 목록(기존 목록에 덮어쓰기)
    mp = os.path.join(OUT, 'mobs.json')
    meta = json.load(open(mp)) if os.path.exists(mp) else {}
    for mid in only:
        m = MOBS[mid]
        an = []
        for a, n, lp, nm in m['anims']:
            e = dict(id=a, frames=n, loop=lp, name=nm, file=f'{mid}_{a}.webp')
            r = rootd.get((mid, a))
            if r and any(abs(x) > 0.5 for x in r): e['root'] = r
            an.append(e)
        meta[mid] = dict(name=m['name'], desc=m['desc'], role=m['role'], tier=m['tier'], chapter=m.get('chapter'), chapters=m.get('chapters', []),
                         tint=m['tint'], cell=m['cell'], foot=m['foot'], dirs=DIRS, anims=an)
    meta = {k: meta[k] for k in MOBS if k in meta}
    json.dump(meta, open(mp, 'w'), ensure_ascii=False, indent=1)
    json.dump(CHAPTERS, open(os.path.join(OUT, 'chapters.json'), 'w'), ensure_ascii=False, indent=1)
    print('done', len(sheets), 'sheets', round(time.time() - t0, 1), 's')
