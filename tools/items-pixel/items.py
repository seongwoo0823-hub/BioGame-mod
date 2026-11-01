# 아이템 아이콘 도트 (등급: 0 생체·뼈 / 1 티타늄 / 2 나노)
import sys, math, json, os, numpy as np
sys.path.insert(0, '/home/user/ilwork/hero')
import rig
from rig import Model, Mat, ellipsoid, capsule, box, rot_x, rot_y, rot_z, frame_from, render
from monsters import ramp
from PIL import Image
def M_(c, em=False): return Mat(ramp(c, em), em, glow=c if em else None)
TIERM = [dict(m='#d8c8a0', h='#6a4426', a='#a85a3a', g='#7aff5a'), dict(m='#b4bccc', h='#3a2a1e', a='#dcaa3a', g='#5ab8ff'), dict(m='#3a4a6a', h='#141a26', a='#7a90b8', g='#3ae0ff')]
def mats(t): T = TIERM[t]; return M_(T['m']), M_(T['h']), M_(T['a']), M_(T['g'], True)
D = np.array([0.62, 0.78, 0.0]); D /= np.linalg.norm(D)   # 무기는 대각선
def fr(d=D): return frame_from(d, (0, 0, 1))
def weapon(M, k, t):
    m, h, a, g = mats(t); F = fr(); o = np.zeros(3)
    if k in (0, 9):  # 장검 · 나선 검
        M.add(capsule(o - D * 6, o, 1.2), h); M.add(box(o + D * 0.8, F, (4.2, 0.8, 1.0)), a); M.add(ellipsoid(o - D * 6.8, 1.6), a)
        M.add(box(o + D * 13, F, (1.6, 11.5, 0.6)), m)
        if k == 9:
            for j in range(10): p = o + D * (3 + j * 2.1) + F[:, 0] * math.sin(j * 1.3) * 1.8; M.add(ellipsoid(p, 0.8), g)
        if t == 2: M.add(box(o + D * 13 + F[:, 0] * 1.4, F, (0.35, 11, 0.7)), g)
    elif k == 1:  # 단백질 낫(도끼)
        M.add(capsule(o - D * 9, o + D * 12, 1.1), h)
        c = o + D * 9; M.add(box(c + F[:, 0] * 3.5, F @ rot_z(0.2), (3.5, 4.5, 0.6)), m); M.add(ellipsoid(c + F[:, 0] * 6.5, (1.5, 4.8, 0.7)), m)
        if t: M.add(box(c, F, (1.4, 1.6, 1.2)), a)
        if t == 2: M.add(ellipsoid(c + F[:, 0] * 7.4, (0.6, 4.2, 0.8)), g)
    elif k in (2, 5):  # 망치 · 대형 망치
        L = 10 if k == 2 else 14; M.add(capsule(o - D * L * 0.6, o + D * L, 1.2), h)
        hd = o + D * (L + 2); s = 1.0 if k == 2 else 1.5
        if t == 0: M.add(ellipsoid(hd, (4 * s, 3.2 * s, 3.2 * s)), m)
        else: M.add(box(hd, F @ rot_z(math.pi / 2), (4.5 * s, 3 * s, 3 * s)), m)
        for j in range(4 if t else 0): aa = j * 1.57; dd = F[:, 2] * math.cos(aa) + F[:, 0] * math.sin(aa); M.add(capsule(hd + dd * 3 * s, hd + dd * 5 * s, 1.0, 0.3), a if t == 1 else g)
        if t == 2: M.add(ellipsoid(hd, 2 * s), g)
    elif k in (3, 6):  # 단검 · 분해 칼날
        M.add(capsule(o - D * 4.5, o, 1.1), h); M.add(box(o + D * 0.6, F, (3.0, 0.7, 1.0)), a)
        if k == 3: M.add(box(o + D * 7, F, (1.6, 6.4, 0.6)), m)
        else:
            for j in range(6): p = o + D * (1.5 + j * 2) + F[:, 0] * (j * j * 0.12); M.add(ellipsoid(p, (1.6, 1.4, 0.6)), m)
        if t == 2: M.add(box(o + D * 7 + F[:, 0] * 1.3, F, (0.3, 6, 0.7)), g)
    elif k == 4:  # 균사 큰낫
        M.add(capsule(o - D * 14, o + D * 14, 1.0), h)
        tp = o + D * 14
        for j in range(7): aa = j / 6; p = tp + F[:, 0] * (-1.5 - aa * 9) + D * (math.sin(aa * 2.6) * 4); M.add(ellipsoid(p, (1.6, 1.6 - aa * 0.9, 0.6)), m)
        if t == 2: M.add(ellipsoid(tp, 1.6), g)
    elif k == 7:  # 신경 지팡이
        M.add(capsule(o - D * 15, o + D * 13, 1.1, 1.3), h); tp = o + D * 15
        M.add(ellipsoid(tp, 2.8), g)
        for j in range(3): aa = j * 2.1; M.add(capsule(tp - D * 3, tp + F[:, 0] * math.cos(aa) * 3 + F[:, 2] * math.sin(aa) * 3, 0.6, 0.4), a)
    else:  # 항체 홀
        M.add(capsule(o - D * 7, o + D * 7, 1.0, 1.2), h); M.add(ellipsoid(o + D * 8.6, 2.2), g); M.add(ellipsoid(o + D * 6.5, (2.4, 0.8, 2.4)), a)
def armor(M, k, t):
    m, h, a, g = mats(t); C = M_(['#f0ece0', '#e0d070', '#5a5a52', '#8a6a3a', '#c86a7a', '#d8c8a0', '#9aa0aa', '#3a3a44', '#d89a3a'][k % 9]) if t == 0 else m
    M.add(ellipsoid([0, 10, 0], (8.5, 8, 4.5)), C); M.add(ellipsoid([0, 2, 0], (7, 5, 4)), C)
    for s in (1, -1): M.add(ellipsoid([s * 8.5, 14, 0], (4.2, 3.4, 4.2)), a if t else C)
    if k in (0, 2):  # 가운 · 앞치마: 긴 자락
        M.add(box([0, -6, 1], np.eye(3), (7.5, 6, 0.8)), C)
    if k in (3, 5, 8) or t: 
        for j in range(3): M.add(box([0, 12 - j * 4, 4.2], np.eye(3), (6.5 - j * 0.8, 1.4, 0.5)), a)
    if k == 6:
        for x in range(-5, 6, 2):
            for y in range(0, 16, 2): M.decal([x, y, 4.6], '#3a3a44', 1, 1.0)
    M.add(ellipsoid([0, 17, 0], (4, 1.6, 3)), h)
    if t == 2: M.add(ellipsoid([0, 10, 4.2], 1.8), g); M.add(capsule([-4, 6, 4.3], [4, 6, 4.3], 0.4), g)
def helm(M, k, t):
    m, h, a, g = mats(t)
    if k == 0: M.add(ellipsoid([0, 4, 0], (7, 4, 7)), M_('#7ab8d0'))
    elif k == 1:
        M.add(capsule([-7, 2, 0], [7, 2, 0], 1.0), h)
        for s in (1, -1): M.add(ellipsoid([s * 3.5, 2, 2], (3, 2.6, 2)), a); M.add(ellipsoid([s * 3.5, 2, 3], 2), g)
    elif k == 2:
        M.add(ellipsoid([0, 4, 0], (6, 6, 5.5)), M_('#3a4a3a')); M.add(capsule([0, 0, 4], [0, -4, 7], 2.4, 1.6), m)
        for s in (1, -1): M.add(ellipsoid([s * 3.5, 4.5, 4.5], 1.6), g)
    else:
        M.add(ellipsoid([0, 5, 0], (7, 7, 7)), m)
        M.add(box([0, 3, 6.4], np.eye(3), (5, 0.8, 0.5)), M_('#140c14') if t < 2 else g)
        if k in (3, 4): 
            for j in range(4): M.add(box([0, 6 + j * 0.2, -1 + j * 2 - 3], rot_x(0.3 * j), (0.8, 4, 1)), a)
        if k == 4: M.decal([-2, 6, 6.6], '#140c14', 2, 1); M.decal([1, 6, 6.6], '#140c14', 2, 1)
        if k in (6, 7):
            for j in range(5): aa = (j - 2) * 0.45; M.add(capsule([math.sin(aa) * 6, 10, math.cos(aa) * 6 - 1], [math.sin(aa) * 7, 15 - abs(j - 2), math.cos(aa) * 7 - 1], 1.0, 0.3), M_('#ffd040') if t < 2 else g)
            M.add(ellipsoid([0, 10, 6], 1.5), g)
        if k == 8:
            for s in (1, -1): M.add(capsule([s * 6, 8, 0], [s * 11, 14, -2], 1.6, 0.4), M_('#e8dcc0'))
        if k in (5, 9): M.add(ellipsoid([0, 4, 5.5], (5, 2.4, 2)), g if k == 5 else M_('#c83a4a'))
def gloves(M, k, t):
    m, h, a, g = mats(t); C = m if t else M_(['#e8e0c8', '#4a8a5a', '#8a5a3a', '#6a4a2a', '#c8a050', '#e0c8b0', '#7a7a8a', '#4a6ab0', '#a84a4a', '#5a5a5a'][k])
    M.add(box([0, 0, 0], np.eye(3), (5, 5.5, 2)), C); M.add(capsule([0, -8, 0], [0, -4, 0], 4.4, 4.6), a if t else C)
    for j in range(4): x = -3.6 + j * 2.4; M.add(capsule([x, 4, 0], [x, 10 - abs(j - 1.5) * 1.2, 0], 1.1), C)
    M.add(capsule([5, 0, 0], [8, 4, 0], 1.2), C)
    if t == 2: M.add(ellipsoid([0, 0, 2], 1.4), g)
def boots(M, k, t):
    m, h, a, g = mats(t); C = m if t else M_(['#3a6a3a', '#d0d0e0', '#6a4a2a', '#8a6a3a', '#a03a3a', '#e0d8c8', '#7a7a8a', '#4a6ab0', '#a84a4a', '#5a5a5a'][k])
    M.add(capsule([0, 2, 0], [0, 14, 0], 3.6, 3.4), C); M.add(capsule([0, 1.5, 0], [7, 1.2, 0], 3.2, 2.4), C)
    M.add(box([1.5, 0, 0], np.eye(3), (6.5, 0.8, 3.4)), h)
    if t: M.add(capsule([0, 12, 0], [0, 15, 0], 3.9), a)
    if t == 2: M.add(capsule([-3.4, 3, 0], [-3.4, 12, 0], 0.5), g)
def belt(M, k, t):
    m, h, a, g = mats(t); C = M_(['#e8e0d0', '#6a4a2a', '#a03a3a', '#d8a050', '#c8c070', '#5a5a62', '#8a4ab0', '#6a4a2a', '#4a6ab0', '#e8e8e8'][k]) if t < 2 else h
    for j in range(12): aa = j / 12 * 2 * math.pi; M.add(capsule([math.cos(aa) * 8, math.sin(aa) * 5, 0], [math.cos(aa + 0.55) * 8, math.sin(aa + 0.55) * 5, 0], 2.0), C)
    M.add(box([0, -5, 1.5], np.eye(3), (3.0, 2.6, 0.8)), a)
    for s in (1, -1): M.add(ellipsoid([s * 5.5, -4.5, 1.6], (1.3, 2, 1.2)), M_(['#e03030', '#3050e0'][s > 0], True))
    if t == 2: M.add(ellipsoid([0, -5, 2.5], 1.2), g)
def offhand(M, k, t):
    m, h, a, g = mats(t)
    if k <= 7:
        tall = 1 + (k >= 4) * 0.35
        face = M_(['#c8a878', '#e0d8c8', '#c8e0e8', '#8a6a3a', '#e8c8b0', '#c83a4a', '#e8dcc0', '#a8c890'][k]) if t == 0 else m
        M.add(box([0, 0, 0], np.eye(3), (7, 9 * tall, 1)), face); M.add(box([0, 0, -0.5], np.eye(3), (7.8, 9.8 * tall, 0.6)), a)
        M.add(ellipsoid([0, 1, 1.2], (3, 3, 1)), g if t == 2 else a)
        for j in range(-4, 5): M.decal([math.sin(j * 0.9) * 3, j * 1.6 * tall, 1.3], '#3a8aff' if t < 2 else '#e0ffff', 1, 1.0)
    elif k == 8: M.add(ellipsoid([0, 2, 0], 6.5), M_('#a8c8ff', True)); M.add(capsule([0, -8, 0], [0, -3, 0], 2.5, 3.5), a)
    else: M.add(capsule([0, -6, 0], [0, 6, 0], 5), M_('#c8e0d8')); M.add(ellipsoid([0, 0, 0], (3.5, 4.5, 3.5)), M_('#ff8a5a', True)); M.add(box([0, 7, 0], np.eye(3), (5.5, 1.2, 5.5)), a)
def ring(M, k, t):
    for j in range(16): aa = j / 16 * 2 * math.pi; M.add(ellipsoid([math.cos(aa) * 6, math.sin(aa) * 6, 0], 1.6), M_(['#b87333', '#c0c0c8', '#ffd040'][min(2, k // 3)] if k < 9 else '#e0e0ff'))
    gc = ['#ff4a4a', '#4aff8a', '#4a8aff', '#ffd04a', '#c84aff', '#4affe8', '#ff8a4a', '#e0e0ff', '#ff4ad0', '#ffffff'][k]
    M.add(ellipsoid([0, 7, 1], 2.8), M_(gc, True))
def amulet(M, k, t):
    for j in range(14): aa = math.pi * (0.1 + 0.8 * j / 13); M.add(ellipsoid([math.cos(aa) * 7, 6 + math.sin(aa) * 6, 0], 0.9), M_('#c8b070'))
    gc = ['#ff8a4a', '#c0c0ff', '#ffd040', '#4ae0ff', '#7aff5a', '#ff5a8a', '#c84aff', '#ffb04a', '#4aff8a', '#e0e0ff'][k]
    M.add(ellipsoid([0, -2, 0], (4, 5, 1.6)), M_('#c8a050')); M.add(ellipsoid([0, -2, 1.2], 2.8), M_(gc, True))
    if k == 3:
        for j in range(8): M.add(ellipsoid([math.sin(j * 0.9) * 2, -6 + j * 1.2, 1.8], 0.6), M_('#ffffff', True))
def potion(M, col, kind):
    big = 1 + (kind % 4) * 0.12
    M.add(ellipsoid([0, 4, 0], 5 * big), M_(col)); M.add(ellipsoid([-1.6, 6, 3.4], 1.0), M_('#ffffff', True)); M.add(ellipsoid([0, 7.4 * big, 0], (3.6 * big, 1.0, 3.6 * big)), M_('#e0f0ff'))
    M.add(capsule([0, 8 * big, 0], [0, 12 * big, 0], 1.6), M_('#e0f0ff')); M.add(ellipsoid([0, 12.6 * big, 0], (2.2, 1.2, 2.2)), M_('#8a5a3a'))
SLOTFN = dict(weapon=weapon, armor=armor, helm=helm, gloves=gloves, boots=boots, belt=belt, off=offhand, ring=ring, amulet=amulet)

def draw(fn, w, h, *a):
    M = Model(); fn(M, *a)
    P = np.concatenate([p for p, n, m, i in M.parts])
    old = rig.PITCH; rig.PITCH = math.radians(12)
    try:
        sx, sy, _, _ = rig.view_xform(P, 0.35, ) if False else (None, None, None, None)
        # 크기 맞춤: 투영 범위를 셀의 86%로
        R = rig.rot_y(0.35); Q = P @ R.T; cp, sp = math.cos(rig.PITCH), math.sin(rig.PITCH)
        X = Q[:, 0]; Y = Q[:, 1] * cp - Q[:, 2] * sp
        k = min((w - 6) / (X.max() - X.min() + 1e-3), (h - 6) / (Y.max() - Y.min() + 1e-3))
        cx = (X.max() + X.min()) / 2 * k; cy = (Y.max() + Y.min()) / 2 * k
        M.parts = [(p - 0, n, m_, i) for p, n, m_, i in M.parts]
        im = render(M, 0.35, w, h, int(h / 2 + cy), scale=k, fit=False)
        # 가로 중앙 정렬
        img = Image.fromarray(im); shift = int(round(-cx))
        out = Image.new('RGBA', (w, h), (0, 0, 0, 0)); out.alpha_composite(img, (shift, 0)) if shift >= 0 else out.alpha_composite(img.crop((-shift, 0, w, h)), (0, 0))
        return out
    finally: rig.PITCH = old
