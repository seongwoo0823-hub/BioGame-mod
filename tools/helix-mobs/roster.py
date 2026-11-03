# 헬릭스 적 전체 목록: 일반 16 · 중간 보스 8 (챕터당 2, 무작위) · 챕터 보스 4
import math
import numpy as np
from mobs import MOBS, make, M_, V, SMEAR
import mobs2 as B2
import bosses as BS
from rig import view_xform

STD = [('idle', 8, True, '대기'), ('move', 8, True, '이동'), ('attack', 8, False, '공격'), ('hit', 4, False, '피격'), ('death', 8, False, '죽음')]
MID = [('idle', 8, True, '대기'), ('move', 8, True, '이동'), ('attack', 8, False, '공격'), ('special', 10, False, '특수기'), ('hit', 4, False, '피격'), ('death', 10, False, '죽음')]
BOSS = [('idle', 8, True, '대기'), ('move', 8, True, '이동'), ('attack', 10, False, '공격'), ('attack2', 10, False, '공격 2'), ('special', 12, False, '특수기'), ('hit', 4, False, '피격'), ('death', 14, False, '죽음')]

for k in MOBS: MOBS[k].update(tier='normal')
MOBS['mosquito']['anims'] = [('idle', 6, True, '대기'), ('move', 6, True, '비행')] + STD[2:]

def reg(id_, **kw): MOBS[id_] = kw

# ---------------- 일반 9~16
reg('prion', name='프리온 결정', role='원거리 · 결정탄', fn=B2.prion, scale=1.6, tint='#ff5a90', tier='normal',
    desc='잘못 접힌 단백질이 결정으로 굳은 덩어리. 주위를 도는 조각 하나를 떼어 쏜다.')
reg('planaria', name='플라나리아', role='근접 · 분열', fn=B2.planaria, scale=1.35, rootmul=2.5, tint='#c8a070', tier='normal',
    desc='바닥을 미끄러지는 납작한 편형동물. 몸을 세웠다가 덮쳐 배 쪽 인두관을 찔러 넣는다.')
reg('jelly', name='상자해파리', role='공중 · 촉수', fn=B2.jelly, scale=1.3, tint='#5ae0ff', tier='normal',
    desc='네모난 갓을 오므렸다 펴며 떠다니는 자포동물. 독침 촉수를 앞으로 휘두른다.')
reg('tick', name='진드기', role='근접 · 도약', fn=B2.tick, scale=1.75, rootmul=2.0, tint='#a0a8c0', tier='normal',
    desc='피로 부푼 배를 단 여덟 다리 진드기. 몸을 일으켰다가 앞으로 뛰어올라 문다.')
reg('corona', name='코로나 바이러스', role='돌진 · 굴러옴', fn=B2.corona, scale=1.15, rootmul=3.0, tint='#ff6a4a', tier='normal',
    desc='돌기 단백질에 덮인 공 모양 바이러스. 굴러오다가 부풀어 올라 들이받는다.')
reg('leech', name='거머리', role='근접 · 흡혈', fn=B2.leech, scale=1.3, rootmul=2.5, tint='#ff4a46', tier='normal',
    desc='몸을 둥글게 접었다 펴며 기어 오는 거머리. 고개를 들었다가 이빨 빨판으로 달라붙는다.')
reg('clone', name='실패한 클론 병사', role='원거리 · 산성탄', fn=B2.clone, scale=1.0, tint='#7aff3a', tier='normal',
    desc='배양에 실패한 복제 병사. 오른팔의 생체 대포에 산을 모았다가 쏜다.')
reg('rat', name='키메라 실험쥐', role='빠른 근접', fn=B2.rat, scale=1.25, rootmul=2.5, tint='#e08aa0', tier='normal',
    desc='등에 종양이 돋은 실험쥐. 재빠르게 달려와 덮쳐 문다.')
for k in ('prion', 'planaria', 'jelly', 'tick', 'corona', 'leech', 'clone', 'rat'): MOBS[k]['anims'] = list(STD)

# ---------------- 중간 보스 (강화형)
GOLD = M_(['#3a1808', '#7a3a10', '#c87a1e', '#f4c04a', '#fff4c0'])
CRIM = M_(['#7a0a1a', '#e0203a', '#ff7a8a', '#ffe0e6'], True, '#ff3a50')
reg('phage_q', name='파지 여왕', role='1장 중간 보스', fn=MOBS['phage']['fn'], scale=2.1, rootmul=2.0, tint='#ffb040', tier='mid', chapter=1,
    v=dict(head=GOLD, core=CRIM, crown=True, crownmat=GOLD), desc='황금 껍질에 왕관 가시를 두른 거대 파지. 머리를 빛내며 새끼 파지를 퍼뜨린다.')
reg('shroom_k', name='균사 거목', role='1장 중간 보스', fn=MOBS['shroom']['fn'], scale=2.3, tint='#7ae0ff', tier='mid', chapter=1,
    v=dict(cap=M_(['#140a3a', '#2e1a70', '#5034b0', '#8a6ae8', '#d8c8ff']), sac=M_(['#0a5a6a', '#1ac0e0', '#8af0ff', '#f0ffff'], True, '#3ae0ff'), horns=True),
    desc='균사 뿌리를 사방으로 뻗은 거대한 보라 버섯. 납작 웅크렸다가 사방으로 포자를 터뜨린다.')
reg('leech_l', name='흡혈 군주', role='2장 중간 보스', fn=B2.leech, scale=2.0, rootmul=2.0, tint='#ff3a3a', tier='mid', chapter=2,
    v=dict(blood=True), desc='등에 피주머니와 가시가 솟은 거대 거머리. 피를 빨아 몸을 부풀린다.')
reg('tick_m', name='진드기 어미', role='2장 중간 보스', fn=B2.tick, scale=3.2, rootmul=1.4, tint='#ffd820', tier='mid', chapter=2,
    v=dict(eggs=True), desc='등에 빛나는 알과 새끼를 업은 거대 진드기. 알주머니를 부풀려 새끼를 퍼뜨린다.')
reg('brute_x', name='거대 암종', role='3장 중간 보스', fn=MOBS['brute']['fn'], scale=1.3, tint='#8a3aff', tier='mid', chapter=3, alias={'special': 'roar'},
    v=dict(twin=True, crown=True, flesh=M_(['#1a0a24', '#3a1648', '#622a72', '#9a50a0', '#d898d4']), lump=M_(['#2a0e30', '#52205a', '#86407e', '#c078b0', '#f2c0e4'])),
    desc='양팔이 모두 종양 몽둥이가 된 암세포 거수의 변종. 뼈 왕관을 쓰고 포효하며 주변을 흔든다.')
reg('clone_c', name='클론 지휘관', role='3장 중간 보스', fn=B2.clone, scale=1.45, tint='#7aff3a', tier='mid', chapter=3,
    v=dict(armor=True), desc='진압 갑옷을 입은 클론 지휘관. 큰 생체 대포를 쏘고, 손을 들어 부하를 강화한다.')
reg('prion_g', name='프리온 거상', role='4장 중간 보스', fn=B2.prion, scale=2.0, tint='#ff3a6a', tier='mid', chapter=4,
    v=dict(giant=True), desc='바닥에 결정 기둥을 세운 거대한 프리온. 조각을 활짝 펼쳐 회전하며 사방으로 쏜다.')
reg('corona_n', name='코로나 핵', role='4장 중간 보스', fn=B2.corona, scale=1.9, rootmul=2.5, tint='#ffc040', tier='mid', chapter=4,
    v=dict(gold=True, spike=GOLD), desc='금빛 돌기와 빛 고리를 두른 거대 바이러스. 돌기를 길게 뻗고 회전하며 퍼뜨린다.')
for k, m in MOBS.items():
    if m['tier'] == 'mid': m['anims'] = list(MID)

# ---------------- 챕터 보스
reg('queen', name='원형질 여왕', role='1장 보스 · 배양실', fn=BS.queen, scale=1.7, tint='#c8ff20', tier='boss', chapter=1,
    desc='배양실을 집어삼킨 거대한 원형질 덩어리. 위족으로 내려치고, 산성액을 토하고, 옆구리에서 새끼를 출아한다.',
    names={'attack': '위족 내려치기', 'attack2': '산성 토하기', 'special': '출아'})
reg('wormking', name='기생충 왕', role='2장 보스 · 하수 저장고', fn=BS.wormking, scale=1.6, tint='#ff7aa0', tier='boss', chapter=2,
    desc='갑각을 두른 거대 촌충. 큰 턱으로 덮쳐 물고, 몸을 휘둘러 쓸고, 땅속으로 파고들었다 솟아오른다.',
    names={'attack': '덮쳐 물기', 'attack2': '몸통 휩쓸기', 'special': '잠행'})
reg('doctor', name='감염 박사', role='3장 보스 · 격리 병동', fn=BS.doctor, scale=2.0, rootmul=1.5, tint='#c060ff', tier='boss', chapter=3,
    desc='곰팡이에 잠식된 연구 책임자. 거대한 주사기로 찌르고, 촉수 팔로 휩쓸고, 스스로 혈청을 주사해 광폭해진다.',
    names={'attack': '주사기 찌르기', 'attack2': '촉수 휩쓸기', 'special': '혈청 주입'})
reg('helix', name='나선의 지배자', role='4장 최종 보스 · 유전체 금고', fn=BS.helix, scale=1.5, tint='#3cffae', tier='boss', chapter=4,
    desc='유전체 금고의 핵심이 깨어난 이중나선 뱀. 빛줄기를 쏘고, 몸을 감았다 내리꽂고, 두 가닥으로 풀려 분열체를 부른다.',
    names={'attack': '나선 광선', 'attack2': '내리꽂기', 'special': '이중나선 분열'})
for k, m in MOBS.items():
    if m['tier'] == 'boss': m['anims'] = [(a, n, lp, m['names'].get(a, nm)) for a, n, lp, nm in BOSS]

SMEAR.update({('doctor', 'attack'): ('syr', 'needle', 0.4, 0.6), ('doctor', 'attack2'): ('tentb', 'tent', 0.4, 0.66),
              ('queen', 'attack'): ('elbR', 'armR', 0.42, 0.6), ('brute_x', 'attack'): ('elbow', 'fist', 0.42, 0.62)})

CHAPTERS = [
    dict(id=1, name='배양실', desc='오염된 배양 접시와 배양기가 늘어선 첫 구역.', mobs=['amoeba', 'bacillus', 'phage', 'shroom', 'rat'], mid=['phage_q', 'shroom_k'], boss='queen'),
    dict(id=2, name='하수 저장고', desc='표본 폐수가 고인 지하 저장고. 기생 생물의 소굴.', mobs=['worm', 'leech', 'mosquito', 'tick', 'planaria'], mid=['leech_l', 'tick_m'], boss='wormking'),
    dict(id=3, name='격리 병동', desc='감염된 직원과 실패한 실험체가 갇힌 병동.', mobs=['researcher', 'clone', 'brute', 'jelly', 'rat'], mid=['brute_x', 'clone_c'], boss='doctor'),
    dict(id=4, name='유전체 금고', desc='모든 유전 정보가 잠든 가장 깊은 금고.', mobs=['prion', 'corona', 'planaria', 'jelly', 'bacillus'], mid=['prion_g', 'corona_n'], boss='helix'),
]
for ch in CHAPTERS:
    for k in ch['mobs']: MOBS[k].setdefault('chapters', []).append(ch['id'])

def autoframe(mid):
    """모든 동작·방향을 훑어 잘리지 않는 칸 크기와 발 위치 계산"""
    m = MOBS[mid]; xs = 0; ys_up = 0; ys_dn = 0
    for a, n, lp, _ in m['anims']:
        for t in np.linspace(0, 1, 5):
            M = make(mid, a, t)
            P = np.concatenate([p for p, nn, mm, i in M.parts])[::3]
            for d in range(8):
                sx, sy, _ = view_xform(P, d * math.pi / 4)
                xs = max(xs, np.abs(sx).max()); ys_up = max(ys_up, sy.max()); ys_dn = max(ys_dn, -sy.min())
    pad = 6
    cell = int(math.ceil((max(2 * xs, ys_up + ys_dn) + 2 * pad) / 16) * 16)
    foot = int(math.ceil(ys_up + pad))
    if foot + ys_dn + pad > cell: cell = int(math.ceil((foot + ys_dn + pad) / 16) * 16)
    return cell, foot
