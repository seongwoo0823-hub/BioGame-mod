# 마을 NPC 8명 + 용병 (캐릭터 렌더러 재사용)
import numpy as np, math
from rig import *
from chars import body, skeleton, ground, SKIN, GOLD, STEEL, WHITE, BLUE, RED, LEATHER, DARK, BRASS, VIAL, GEM, WOOD, MYC, HAIR
def mt(c, em=False):
    from monsters import ramp
    return Mat(ramp(c, em), em, glow=c if em else None)
def robe(M, J, q, col, wide=1.0):
    R = J['R']; lc = (J['lkn'] + J['rkn']) / 2; an = (J['lan'] + J['ran']) / 2
    for a in np.linspace(0, 2 * math.pi, 9)[:-1]:
        top = J['pel'] + R @ np.array([math.sin(a) * 3.8, 1.0, math.cos(a) * 2.8])
        bot = an + np.array([math.sin(a) * 4.8 * wide, 0.6, math.cos(a) * 3.8 * wide]) + (lc - J['pel']) * np.array([0.3, 0, 0.5])
        M.add(capsule(top, bot, 1.8, 2.2), col, pid=960)
def staff(M, J, q, wood, top, topc):
    ha = J['rha']; wd = J['R'] @ np.array(q['w1'], float); wd /= np.linalg.norm(wd)
    M.add(capsule(ha - wd * 10, ha + wd * 12, 0.8, 0.9), wood); M.add(ellipsoid(ha + wd * 13.5, top), topc, pid=990)
def beard(M, H, Rh, col):
    M.add(capsule(H + Rh @ np.array([0, -1.6, 3.4]), H + Rh @ np.array([0, -7.0, 3.0]), 2.6, 0.8), col, pid=905)
def npc_elder(q, f):  # 현자 에피게네: 녹색 로브, 흰 수염, 나선 지팡이
    M = Model(); J = skeleton(q); C = mt('#3a6a4a'); mats = dict(torso=C, pants=C, boots=mt('#4a3a2a'), gloves=SKIN, sleeve=C, belt=mt('#c8a050'))
    H, Rh = body(M, J, q, mats, dict()); robe(M, J, q, C, 1.1)
    M.add(ellipsoid(H + Rh @ np.array([0, 1.4, -0.6]), (4.5, 3.6, 4.4)), mt('#e8e8e0'), pid=901); beard(M, H, Rh, mt('#f0f0e8'))
    staff(M, J, q, WOOD, 2.0, mt('#8aff6a', True)); ground(M, J, q); return M
def npc_shop(q, f):  # 상인: 갈색 앞치마, 큰 배낭, 모자
    M = Model(); J = skeleton(q); C = mt('#8a5a3a'); mats = dict(torso=mt('#c8b088'), pants=mt('#4a3a2a'), boots=mt('#3a2a1a'), gloves=mt('#a07a50'), sleeve=mt('#c8b088'), belt=LEATHER)
    H, Rh = body(M, J, q, mats, dict(bulk=1.15)); R = J['R']
    M.add(box(J['chest'] + R @ np.array([0, -3, 3.6]), R, (4.4, 6, 0.5)), C)
    M.add(box(J['chest'] + R @ np.array([0, 2, -5.4]), R, (5, 6.5, 2.4)), mt('#6a4a2a'), pid=960)
    for k in range(3): M.add(ellipsoid(J['chest'] + R @ np.array([(k - 1) * 3, 9.5, -5.4]), (1.6, 1.6, 1.6)), mt(['#d8a838', '#7ad0ff', '#ff7a5a'][k], k == 1))
    M.add(ellipsoid(H + Rh @ np.array([0, 3.2, -0.2]), (5.8, 1.2, 5.8)), mt('#6a4a2a'), pid=901); M.add(ellipsoid(H + Rh @ np.array([0, 4.4, -0.3]), (3.6, 2.2, 3.6)), mt('#6a4a2a'))
    M.add(capsule(H + Rh @ np.array([-1.8, -1.0, 3.9]), H + Rh @ np.array([1.8, -1.0, 3.9]), 0.7), mt('#3a2a1a'), pid=905)
    ground(M, J, q); return M
def npc_alch(q, f):  # 약제사: 보라 로브, 약병 띠, 둥근 안경
    M = Model(); J = skeleton(q); C = mt('#5a3a7a'); mats = dict(torso=C, pants=C, boots=mt('#2a1a3a'), gloves=mt('#c8b0e0'), sleeve=C, belt=BRASS)
    H, Rh = body(M, J, q, mats, dict()); robe(M, J, q, C); R = J['R']
    for k, a in enumerate((-1.0, -0.3, 0.4, 1.1)): M.add(ellipsoid(J['chest'] + R @ np.array([math.sin(a) * 5, -2 + k * 0.6, math.cos(a) * 3.6]), (0.9, 1.4, 0.9)), mt(['#7aff5a', '#ff7a5a', '#7ad0ff', '#ffd040'][k], True), pid=950 + k)
    M.add(ellipsoid(H + Rh @ np.array([0, 2.2, -0.4]), (4.6, 3.0, 4.5)), mt('#2a1a3a'), pid=901)
    for s in (1, -1): M.decal(H + Rh @ np.array([s * 1.6, 0.0, 4.2]), '#ffe080', 1, 2.0)
    M.add(ellipsoid(J['lha'] + np.array([0, 1.5, 0]), 1.8), mt('#ff7ad8', True), pid=970); ground(M, J, q); return M
def npc_heal(q, f):  # 치유사: 흰 로브, 초록 십자 문양, 두건
    M = Model(); J = skeleton(q); C = mt('#e8e4ee'); mats = dict(torso=C, pants=C, boots=mt('#8a8090'), gloves=SKIN, sleeve=C, belt=mt('#4ab05a'))
    H, Rh = body(M, J, q, mats, dict()); robe(M, J, q, C, 1.05); R = J['R']
    for d in ((0, 1.6), (0, 0), (0, -1.6), (-1.6, 0), (1.6, 0)): M.decal(J['chest'] + R @ np.array([d[0], d[1], 3.8]), '#3ac85a', 1, 1.5)
    M.add(ellipsoid(H + Rh @ np.array([0, 0.9, -0.8]), (4.8, 4.8, 4.6)), C, pid=901)
    M.add(ellipsoid(J['rha'] + np.array([0, 2.2, 0.6]), 1.6 + 0.6 * q['glow']), mt('#7affa0', True), pid=980); ground(M, J, q); return M
def npc_vault(q, f):  # 금고지기: 두꺼운 갑옷, 열쇠 꾸러미
    M = Model(); J = skeleton(q); A = mt('#7a7a8a'); mats = dict(torso=A, pants=mt('#3a3a4a'), boots=A, gloves=A, sleeve=A, belt=LEATHER, shin=A, forearm=A)
    H, Rh = body(M, J, q, mats, dict(bulk=1.25, arm=1.2)); R = J['R']
    for s in 'lr': M.add(ellipsoid(J[s + 'sh'] + R @ np.array([0, 0.6, 0]), (3.4, 2.6, 3.2)), A)
    M.add(ellipsoid(H + Rh @ np.array([0, 1.0, -0.2]), (4.6, 4.0, 4.6)), A, pid=901); beard(M, H, Rh, mt('#a85a2a'))
    for k in range(4): M.add(capsule(J['pel'] + R @ np.array([3.5, -1 - k * 0.3, 2 + k * 0.4]), J['pel'] + R @ np.array([4.0, -4 - k * 0.6, 2 + k * 0.4]), 0.45), mt('#e8c040'))
    ground(M, J, q); return M
def npc_merc(q, f):  # 백혈구 용병: 흰 판금, 창, 둥근 방패
    M = Model(); J = skeleton(q); A = mt('#e8ecf4'); mats = dict(torso=A, pants=mt('#8a96b0'), boots=A, gloves=A, sleeve=A, belt=mt('#c83a4a'), shin=A, forearm=A)
    H, Rh = body(M, J, q, mats, dict(bulk=1.1, arm=1.1)); R = J['R']
    for s in 'lr': M.add(ellipsoid(J[s + 'sh'] + R @ np.array([0, 0.6, 0]), (3.0, 2.4, 3.0)), A)
    M.add(ellipsoid(H + Rh @ np.array([0, 0.9, -0.2]), (4.6, 4.3, 4.6)), A, pid=901); M.add(box(H + Rh @ np.array([0, -0.4, 4.2]), Rh, (2.6, 0.5, 0.4)), DARK, pid=902)
    for k in range(5): M.add(ellipsoid(H + Rh @ np.array([0, 4.6 - k * 0.3, -1.5 - k * 1.3]), 1.2), mt('#c83a4a'), pid=904)
    la = J['lha']; nrm = R @ np.array([0.5, 0.1, 1.0]); nrm /= np.linalg.norm(nrm); up_ = np.array([0, 1.0, 0]) - nrm * nrm[1]; up_ /= np.linalg.norm(up_); rt = np.cross(up_, nrm)
    M.add(ellipsoid(la + nrm * 1.5, (5.0, 5.0, 1.0)) if False else box(la + nrm * 1.5, np.stack([rt, up_, nrm], 1), (4.2, 4.2, 0.6)), mt('#c83a4a'), pid=910)
    M.decal(la + nrm * 2.3, '#ffffff', 1, 1.0)
    ha = J['rha']; wd = R @ np.array(q['w1'], float); wd /= np.linalg.norm(wd)
    M.add(capsule(ha - wd * 7, ha + wd * 13, 0.7), WOOD); M.add(capsule(ha + wd * 13, ha + wd * 18, 1.4, 0.2), STEEL, pid=920); M.tips['w1'] = ha + wd * 18
    ground(M, J, q); return M
def npc_seer(q, f):  # 예언자: 깊은 두건, 떠 있는 수정구
    M = Model(); J = skeleton(q); C = mt('#3a2a6a'); mats = dict(torso=C, pants=C, boots=C, gloves=mt('#8a7ac8'), sleeve=C, belt=mt('#c8a0ff'))
    H, Rh = body(M, J, q, mats, dict(eye='#c8a0ff')); robe(M, J, q, C, 1.15)
    M.add(ellipsoid(H + Rh @ np.array([0, 0.8, -1.0]), (5.0, 5.2, 4.8)), C, pid=901); M.add(capsule(H + Rh @ np.array([0, 4, -2]), H + Rh @ np.array([0, 8.5, -5]), 2.2, 0.4), C)
    orb = (J['lha'] + J['rha']) / 2 + np.array([0, 3.5 + 0.8 * math.sin(f * 0.8), 2.0])
    M.add(ellipsoid(orb, 2.6), mt('#a8c8ff', True), pid=990); ground(M, J, q); return M
def npc_archon(q, f):  # 대사제: 금빛 예복, 뒤의 광륜
    M = Model(); J = skeleton(q); C = mt('#f0e0b0'); mats = dict(torso=C, pants=C, boots=GOLD, gloves=GOLD, sleeve=C, belt=GOLD)
    H, Rh = body(M, J, q, mats, dict(eye='#ffe080')); robe(M, J, q, C, 1.2); R = J['R']
    for s in 'lr': M.add(ellipsoid(J[s + 'sh'] + R @ np.array([0, 0.8, 0]), (3.0, 2.0, 3.0)), GOLD)
    M.add(ellipsoid(H + Rh @ np.array([0, 4.5, -0.3]), (2.8, 3.4, 2.8)), GOLD, pid=901)
    for k in range(16): a = k / 16 * 2 * math.pi; M.add(ellipsoid(H + R @ np.array([math.cos(a) * 7.5, math.sin(a) * 7.5 + 1, -5.0]), 0.9), mt('#ffe680', True), pid=995)
    staff(M, J, q, GOLD, 1.8, mt('#fff4c0', True)); ground(M, J, q); return M
NPCS = dict(elder=npc_elder, shop=npc_shop, alch=npc_alch, heal=npc_heal, vault=npc_vault, merc=npc_merc, seer=npc_seer, archon=npc_archon)
