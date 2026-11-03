# 의인화 적 프레임 렌더
import math
import numpy as np
from grunts import Grunt, Canvas
from grunt_roster import G, mv_walk, mv_idle, mv_hover, at_style

CS, OX, OY = 52, 26, 44


def poses_for(name):
    sp = G[name]
    mv = dict(walk=lambda: mv_walk(6), run=lambda: mv_walk(6, True), idle=mv_idle, hover=mv_hover)[sp['mv']]()
    out = dict(mv=mv, at=at_style(sp['at'], sp.get('fly')) if sp['at'] != 'whip' else at_style('whip'))
    if sp.get('roll'): out['roll'] = at_style('roll')
    if sp.get('mini'): out['mini'] = mv_walk(4)
    return out


def render_grunt(name):
    sp = G[name]; fr = {}
    for an, poses in poses_for(name).items():
        lst = []
        for i, p in enumerate(poses):
            spec = dict(sp)
            if an == 'mini': spec['K'] = sp.get('K', Grunt.K) * 0.62
            if 'heads' in sp: spec['head'] = sp['heads'][i % len(sp['heads'])]
            g = Grunt(name, spec)
            p = dict(p); p.setdefault('ph', i / len(poses))
            sk = g.skeleton(p)
            cv = Canvas(CS, CS, OX, OY, g.K)
            if sk['p'].get('spin'): cv.set_spin(sk['center'], sk['p']['spin'])
            g.draw_body(cv, sk, {})
            lst.append(cv.render())
        fr[an] = lst
    return fr, OX, OY
