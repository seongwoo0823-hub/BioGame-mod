# 면역 특공대 4~5등신 인물 틀 (한 칸 32×48, 발끝 y=46, 오른쪽을 봄)
#   머리 약 9도트 / 전체 키 약 39도트 → 약 4.3등신
#   figure(sp, f, spec): f 0 서기 · 1 걷기 · 2 공격(앞팔을 뻗음)
#   spec: skin(피부=미생물 색), cloth(상의), pants, boots, head(머리 꾸밈 함수), weapon(무기 함수), mood, mouth …
import math
from pixel import Sprite, OUTLINE

W, H = 40, 48           # 오른쪽 8도트는 무기·총구 불꽃 자리
GY = 46
HX, HY = 16, 12           # 머리 중심
SH = (16, 20)             # 어깨
HIP = (16, 31)


def limb(sp, x0, y0, x1, y1, r, col, end=None, end_col=None, end_r=None):
    m = sp.m_capsule(x0, y0, x1, y1, r)
    sp.outline(m); sp.shade(m, col, outline=False)
    if end:
        e = sp.m_ellipse(end[0], end[1], end_r or r + .3, end_r or r + .3)
        sp.outline(e); sp.shade(e, end_col or col, outline=False)
    return m


def leg(sp, hip, ang, col, boot, kneebend=0):
    """엉덩이에서 발까지 (ang: 0이면 수직, +면 앞으로)"""
    L1, L2 = 7, 7.5
    kx = hip[0] + math.sin(ang) * L1; ky = hip[1] + math.cos(ang) * L1
    a2 = ang - kneebend
    fx = kx + math.sin(a2) * L2; fy = min(GY - 1, ky + math.cos(a2) * L2)
    limb(sp, hip[0], hip[1], kx, ky, 1.7, col)
    limb(sp, kx, ky, fx, fy - 1, 1.6, col)
    bt = sp.m_capsule(fx, fy - 3, fx, fy - 1, 1.7); sp.outline(bt); sp.shade(bt, boot, outline=False)
    foot = sp.m_capsule(fx - .5, fy, fx + 2.2, fy, 1.2)
    sp.outline(foot); sp.shade(foot, boot, outline=False)


def arm(sp, sh, hand, col, glove):
    ex = (sh[0] + hand[0]) / 2 - .5; ey = (sh[1] + hand[1]) / 2 + 1
    limb(sp, sh[0], sh[1], ex, ey, 1.4, col)
    limb(sp, ex, ey, hand[0], hand[1], 1.3, col, end=hand, end_col=glove, end_r=1.6)


def torso(sp, cloth, belt=None, wide=0, dy=0):
    x0, x1 = 12 - wide, 20 + wide
    pts = [(x0 + .5, 19 + dy), (x1 - .5, 19 + dy), (x1, 24 + dy), (x1 - .5, 31 + dy), (x0 + .5, 31 + dy), (x0, 24 + dy)]
    m = sp.m_poly(pts)
    sp.shade(m, cloth)
    if belt:
        b = sp.m_capsule(x0 + 1, 29.5 + dy, x1 - 1, 29.5 + dy, .9); sp.fill(b, belt)
        sp.dot(17, 29 + dy, '#e8d070')
    return m


def head(sp, skin, dy=0, rx=4.5, ry=4.8, cx=HX):
    m = sp.m_ellipse(cx, HY + dy, rx, ry)
    sp.shade(m, skin)
    return m


def face(sp, dy=0, mood='mad', mouth='line', cx=HX):
    D = (20, 14, 30)
    ex1, ex2, ey = cx + 0, cx + 3, HY - 1 + dy
    for x in (ex1, ex2):
        sp.dot(x, ey, D); sp.dot(x, ey + 1, D)
    if mood == 'mad':
        sp.dot(ex1 - 1, ey - 2, OUTLINE); sp.dot(ex1, ey - 1, OUTLINE); sp.dot(ex2 + 1, ey - 2, OUTLINE); sp.dot(ex2, ey - 1, OUTLINE)
    elif mood == 'smug':
        sp.dot(ex1, ey - 2, OUTLINE); sp.dot(ex1 + 1, ey - 2, OUTLINE); sp.dot(ex2, ey - 2, OUTLINE); sp.dot(ex2 + 1, ey - 2, OUTLINE)
    elif mood == 'calm':
        pass
    my = ey + 3
    if mouth == 'open':
        sp.dot(ex1 + 1, my, '#4a1830'); sp.dot(ex1 + 2, my, '#4a1830'); sp.dot(ex1 + 1, my + 1, '#4a1830'); sp.dot(ex1 + 2, my + 1, '#ff8aa0')
    elif mouth == 'grin':
        sp.dot(ex1 + 1, my, '#4a1830'); sp.dot(ex1 + 2, my, '#ffffff'); sp.dot(ex1 + 3, my, '#4a1830')
    else:
        sp.dot(ex1 + 1, my, '#4a1830'); sp.dot(ex1 + 2, my, '#4a1830')


POSE = {
    # (뒷다리 각, 앞다리 각, 무릎 굽힘 뒤/앞, 뒷팔 손 위치, 앞팔 손 위치, 몸 들썩)
    0: dict(lb=-.12, lf=.12, kb=0, kf=0, hb=(13, 29), hf=(20, 28), dy=0),
    1: dict(lb=-.32, lf=.32, kb=.35, kf=-.05, hb=(12, 27), hf=(21, 27), dy=-1),
    2: dict(lb=-.38, lf=.34, kb=.15, kf=0, hb=(12, 26), hf=(25, 22), dy=0),
    3: dict(lb=.25, lf=.85, kb=1.1, kf=1.5, hb=(11, 22), hf=(22, 22), dy=-3),     # 점프 (다리 접기)
}


def figure(sp, f, spec):
    p = dict(POSE[f]); p.update(spec.get('pose', {}).get(f, {}))
    dy = p['dy']
    skin = spec['skin']; cloth = spec['cloth']; pants = spec.get('pants', '#3a3a58'); boots = spec.get('boots', '#2e2440')
    glove = spec.get('glove', skin)
    sh = (SH[0] - 1, SH[1] + 1 + dy); shf = (SH[0] + 1, SH[1] + 1 + dy)
    hip = (HIP[0], HIP[1] + dy)
    if spec.get('back'): spec['back'](sp, f, dy)
    # 뒤쪽 (조금 어둡게 보이도록 같은 색, 외곽선이 구분)
    if not spec.get('fly'):
        leg(sp, (hip[0] - 1, hip[1]), p['lb'], pants, boots, p['kb'])
    else:
        leg(sp, (hip[0] - 1, hip[1]), -.9, pants, boots, -1.2)
    arm(sp, sh, (p['hb'][0], p['hb'][1] + dy), spec.get('sleeve', cloth), glove)
    if spec.get('weapon_back'): spec['weapon_back'](sp, f, (p['hb'][0], p['hb'][1] + dy), dy)
    if not spec.get('fly'):
        leg(sp, (hip[0] + 1, hip[1]), p['lf'], pants, boots, p['kf'])
    else:
        leg(sp, (hip[0] + 1, hip[1]), -.5, pants, boots, -1.4)
    torso(sp, cloth, spec.get('belt'), spec.get('wide', 0), dy)
    if spec.get('chest'): spec['chest'](sp, f, dy)
    # 목
    nk = sp.m_capsule(16, 17 + dy, 16, 19 + dy, 1.4); sp.outline(nk); sp.shade(nk, skin, outline=False)
    if spec.get('head_back'): spec['head_back'](sp, f, dy)
    head(sp, skin, dy, spec.get('hrx', 4.5), spec.get('hry', 4.8))
    if not spec.get('noface'): face(sp, dy, spec.get('mood', 'mad'), spec.get('mouth_atk', 'open') if f == 2 else spec.get('mouth', 'line'))
    if spec.get('head'): spec['head'](sp, f, dy)
    hand = (p['hf'][0], p['hf'][1] + dy)
    if spec.get('weapon'): spec['weapon'](sp, f, hand, dy)
    arm(sp, shf, hand, spec.get('sleeve', cloth), glove)
    if spec.get('weapon_front'): spec['weapon_front'](sp, f, hand, dy)
