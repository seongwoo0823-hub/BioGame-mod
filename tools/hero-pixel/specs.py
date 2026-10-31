import re, random
SRC = '/home/user/test-mod/games/infection-lord.html'
PLAN = {1: 'blob', 2: 'biped', 3: 'floater', 4: 'worm', 5: 'blob', 6: 'floater', 7: 'spider', 8: 'spinner', 9: 'blob', 10: 'biped', 11: 'spider',
        12: 'spinner', 13: 'phage', 14: 'biped', 15: 'phage', 16: 'swim', 17: 'worm', 18: 'worm', 19: 'blob', 20: 'floater', 21: 'floater', 22: 'floater',
        23: 'biped', 24: 'biped', 25: 'blob', 26: 'floater', 27: 'biped', 28: 'floater', 29: 'spinner', 30: 'spider', 31: 'floater', 32: 'beast', 33: 'floater',
        34: 'beast', 35: 'biped', 36: 'floater', 37: 'floater', 38: 'biped', 39: 'spider', 40: 'worm', 41: 'worm', 42: 'biped', 43: 'beast', 44: 'floater',
        45: 'blob', 46: 'biped', 47: 'floater', 48: 'beast', 49: 'swim', 50: 'worm', 51: 'biped', 52: 'beast', 53: 'flyer', 54: 'spider', 55: 'spinner'}
BOSS = {'b_pus': ('blob', dict(spikes=10, n_eye=3, bulk=1.15)), 'b_gangrene': ('floater', dict(tent=10, n_eye=3)), 'b_thrombus': ('spider', dict(nlegs=8, n_eye=4, bulk=1.2)),
        'b_sepsis': ('phage', dict(spikes=12, n_eye=3, bulk=1.25)), 'b_pylori': ('spinner', dict(spikes=16, n_eye=1, bulk=1.1)), 'b_taenia': ('biped', dict(horns=1, spikes=5, n_eye=2, bulk=1.25, arm=1.15)),
        'b_granu': ('worm', dict(seg=10, legs=0, n_eye=2, bulk=1.2)), 'b_storm': ('beast', dict(horns=1, spikes=7, n_eye=2, bulk=1.15, len=1.3, wings=1)), 'b_kuru': ('floater', dict(tent=12, n_eye=5, bulk=1.15)),
        'b_zero': ('spinner', dict(spikes=20, n_eye=3, bulk=1.25))}
def load():
    s = open(SRC).read(); out = []
    for m in re.finditer(r"^M\('(m\d+)', (\d), '([^']+)', '(\w+)', '(#\w+)', '(#\w+)', ([\d.]+), '(\w+)'", s, re.M):
        mid, ch, nm, fam, c1, c2, size, ai = m.groups(); n = int(mid[1:]); rnd = random.Random(n * 7)
        sp = dict(id=mid, n=n, ch=int(ch), name=nm, c1=c1, c2=c2, size=float(size), ai=ai, plan=PLAN[n], boss=False,
                  n_eye=rnd.choice([1, 2, 2, 3]), n_spot=rnd.randint(2, 6), spikes=rnd.choice([0, 0, 3, 5, 8]) if PLAN[n] in ('blob', 'phage') else rnd.choice([3, 4, 5]) if PLAN[n] in ('beast', 'biped') else rnd.choice([8, 10, 12]),
                  horns=rnd.random() < 0.4, tent=rnd.choice([5, 6, 7]), seg=rnd.choice([6, 7, 8]), legs=PLAN[n] == 'worm' and rnd.random() < 0.5 or n in (50, 40), nlegs=rnd.choice([6, 8]),
                  bulk=1.0 + (0.18 if ai == 'brute' else 0) - (0.1 if ai == 'swarm' else 0), arm=1.15 if ai == 'brute' else 1.0)
        if n == 50: sp.update(seg=7, legs=True, bulk=1.3)
        out.append(sp)
    bosses = []
    for m in re.finditer(r"^B\('(b_\w+)',\s*(\d), '([^']+)',\s*(\d), '(#\w+)', '(#\w+)', ([\d.]+)", s, re.M):
        bid, ch, nm, bspr, c1, c2, size = m.groups(); pl, ex = BOSS[bid]
        sp = dict(id=bid, ch=int(ch), name=nm, bspr=int(bspr), c1=c1, c2=c2, size=float(size), plan=pl, boss=True, n_spot=6, horns=True, ai='boss')
        sp.update(ex); bosses.append(sp)
    return out, bosses

D = 21  # 월드 1단위당 픽셀
def prep(sp):
    """몸 구조마다 기준 키를 재서 목표 키(픽셀)에 맞도록 u 결정"""
    import numpy as np
    from monsters import build
    hpx = (0.78 + 1.08 * sp['size']) * D if not sp['boss'] else sp['size'] * 2.5 * 0.6 * D
    sp['u'] = 1.0; M = build(sp, 'idle', 0.0)
    P = np.concatenate([p for p, n, m, i in M.parts]); hh = P[:, 1].max() - P[:, 1].min()
    ww = max(P[:, 0].max() - P[:, 0].min(), P[:, 2].max() - P[:, 2].min())
    k = hpx / max(hh, ww * 0.62)   # 납작하고 긴 몸(벌레·짐승)은 길이 기준
    sp['u'] = k; sp['hpx'] = hpx
    return hpx
