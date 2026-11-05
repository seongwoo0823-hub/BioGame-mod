# 바이오 타워 조각 24종: 도트 그림 + 그림 모양에서 뽑은 충돌 형태
import math, sys, os
import numpy as np
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../cell-frontier'))
from pix import Pix, ramp
from pictures import PINK, PURP, ORNG, GRN, CYAN, BLUE, RED, YEL, BRN, WHT, TEAL, caps

OL = '#140c18'
GRY = ramp('#2a2e3a', '#5a6070', '#9aa0b0', '#d8dce6', '#ffffff')
BONE = ramp('#6a5a40', '#b0a080', '#e8dcc0', '#fffaf0', '#ffffff')
FLESH = ramp('#5a1a2a', '#a8405a', '#e07a8a', '#ffb8c0', '#ffe8ec')
DGRN = ramp('#0e2a10', '#1e5a1e', '#3a8a2a', '#7ac04a', '#c8f090')


def eye(p, x, y, r=2):
    p.ball(x, y, r, r, ramp('#000000', '#ffffff', '#ffffff'), spec=False, amb=1)
    p.put(x + 0.4, y + 0.2, '#101018'); p.put(x - 0.3, y - 0.6, '#ffffff')


# ---------------------------------------------------------------- 조각 그리기 (w, h 안에)
def turtle(p):
    p.ball(10, 24, 6, 4, DGRN); p.ball(62, 24, 6, 4, DGRN)      # 다리
    p.ball(66, 16, 7, 6, DGRN); eye(p, 68, 14, 1.5)               # 머리
    shell = p.ball(36, 20, 28, 16, ramp('#2a1a08', '#5a3a14', '#8a6a2a', '#c8a050', '#f0d890'), mask=p.Y <= 24)
    for k, (x, y) in enumerate([(36, 12), (24, 16), (48, 16), (30, 22), (42, 22)]):
        pts = [(x + 6 * math.cos(a), y + 5 * math.sin(a)) for a in np.linspace(0, 2 * math.pi, 7)]
        p.line(pts, '#3a2408', 1)
    p.rect(8, 23, 56, 4, '#c8b070'); p.line([(8, 24), (64, 24)], '#8a7040', 1)


def whale(p):
    body = p.pmask([(4, 16), (14, 6), (50, 4), (74, 10), (84, 18), (74, 26), (40, 30), (12, 28)])
    p.shade_mask(body, BLUE, 40, 10, 50, amb=0.3)
    belly = body & (p.Y > 22); p.dith(belly, np.clip((p.Y - 20) / 10.0, 0, 1), ramp('#5a7aa0', '#a8c8e8', '#e0f0ff'))
    tail = p.pmask([(80, 18), (95, 6), (90, 18), (95, 30)]); p.shade_mask(tail, BLUE, 88, 14, 12)
    eye(p, 16, 16, 1.5); p.line([(8, 22), (26, 24)], '#0a1a4a', 1)
    p.ball(48, 25, 6, 3, ramp('#0a1a4a', '#1a3a8a', '#3a6ad0'), rot=0.5, spec=False)
    for x in (30, 36, 42): p.put(x, 3, '#c8f0ff')


def starfish(p):
    pts = []
    for k in range(10):
        a = -math.pi / 2 + k * math.pi / 5; r = 20 if k % 2 == 0 else 8
        pts.append((21 + r * math.cos(a), 22 + r * math.sin(a)))
    m = p.pmask(pts); p.shade_mask(m, ramp('#5a1a08', '#c04a20', '#ff8a4a', '#ffc8a0', '#fff0e0'), 18, 18, 20, amb=0.35)
    for k in range(5):
        a = -math.pi / 2 + k * 2 * math.pi / 5
        for t in range(3, 17, 3): p.put(21 + t * math.cos(a), 22 + t * math.sin(a), '#ffe0c0')
    eye(p, 18, 20, 1.5); eye(p, 24, 20, 1.5)


def jelly(p):
    for k in range(-3, 4):
        pts = [(18 + k * 3 + 1.5 * math.sin(y / 3 + k), 20 + y) for y in range(0, 20)]
        p.line(pts, '#ff80c0', 1)
    p.ball(18, 20, 16, 15, ramp('#6a1a4a', '#c03a8a', '#ff7ac0', '#ffc0e0', '#fff0f8'), mask=p.Y <= 21, amb=0.45)
    p.rect(3, 19, 31, 4, '#ff9ad0')
    for x in range(3, 34, 3): p.put(x, 22, '#ffd0ea')
    eye(p, 13, 13); eye(p, 23, 13)


def frog(p):
    p.ball(7, 26, 7, 4, DGRN); p.ball(31, 26, 7, 4, DGRN)
    p.ball(19, 18, 16, 11, ramp('#0e3a0a', '#2a7a1a', '#5ab030', '#a0e060', '#e8ffc0'))
    p.ball(19, 22, 10, 6, ramp('#8a9a50', '#d0e090', '#f8ffd8'), spec=False, amb=0.7)
    for d in (-1, 1):
        p.ball(19 + d * 8, 8, 5, 5, ramp('#0e3a0a', '#2a7a1a', '#5ab030', '#a0e060'))
        eye(p, 19 + d * 8, 8, 2.5)
    p.line([(13, 19), (19, 21), (25, 19)], '#0e3a0a', 1)
    p.rect(3, 28, 32, 2, '#2a7a1a')


def snail(p):
    foot = p.pmask([(2, 34), (6, 26), (44, 26), (50, 34)]); p.shade_mask(foot, ramp('#5a4a3a', '#9a8a70', '#d0c0a0', '#f0e8d0'), 26, 26, 30)
    p.line([(42, 26), (46, 14)], '#9a8a70', 2); p.line([(46, 26), (50, 16)], '#9a8a70', 2)
    p.ball(46, 13, 2, 2, ramp('#000000', '#202020'), spec=False); p.ball(50, 15, 2, 2, ramp('#000000', '#202020'), spec=False)
    p.ball(22, 16, 15, 14, ramp('#4a1a08', '#8a3a14', '#c86a2a', '#f0a050', '#ffd8a0'), amb=0.35)
    pts = [(22 + (13 - t * 1.6) * math.cos(t * 1.4), 16 + (13 - t * 1.6) * math.sin(t * 1.4)) for t in np.linspace(0, 7, 60)]
    p.line(pts, '#5a2208', 1)


def mushroom(p):
    caps(p, 18, 40, 18, 22, 6, ramp('#8a7a5a', '#d0c4a8', '#f4ecd8', '#ffffff'))
    cm = p.ball(18, 20, 18, 16, RED, mask=p.Y <= 21, amb=0.35)
    p.rect(1, 19, 35, 4, '#f0e0c8'); p.line([(2, 22), (35, 22)], '#a89070', 1)
    for dx, dy, r in [(-9, 12, 3), (2, 8, 4), (11, 14, 2.5), (-2, 16, 2)]:
        m, _, _ = p.emask(18 + dx, dy, r, r * 0.8); p.fill(m & cm, '#fff8f0')
    eye(p, 15, 30, 1.2); eye(p, 21, 30, 1.2)


def seahorse(p):
    for (x, y, r) in [(14, 8, 7), (11, 18, 6), (12, 28, 6), (14, 37, 5)]: p.ball(x, y, r, r, YEL, amb=0.4)
    p.line([(14, 40), (18, 44), (22, 42), (20, 38)], '#c8a010', 2)
    p.line([(19, 8), (26, 9)], '#c8a010', 3); eye(p, 15, 6, 1.5)
    for y in range(14, 38, 3): p.put(6 + (y % 2), y, '#ffe060')
    p.line([(3, 20), (6, 16), (6, 24)], '#ffe080', 1)


def butterfly(p):
    for d in (-1, 1):
        p.ball(22 + d * 12, 10, 12, 9, ramp('#5a1a00', '#c84a08', '#ff8a1a', '#ffc070'), rot=d * 0.4, amb=0.45, spec=False)
        p.ball(22 + d * 9, 22, 8, 7, ramp('#5a1a00', '#c84a08', '#ff8a1a', '#ffc070'), rot=-d * 0.4, amb=0.45, spec=False)
        p.ball(22 + d * 14, 8, 2.5, 2.5, ramp('#000000', '#1a0800', '#ffe8a0'), spec=False)
    caps(p, 22, 6, 22, 26, 2.2, ramp('#0a0806', '#2a2018', '#5a4a3a'))
    p.line([(22, 5), (17, 0)], '#1a1008', 1); p.line([(22, 5), (27, 0)], '#1a1008', 1)


def cactus(p):
    p.rect(12, 6, 12, 44, '#2a7a2a')
    p.shade_mask(p.pmask([(12, 4), (24, 4), (24, 50), (12, 50)]), DGRN, 15, 20, 20, amb=0.4)
    for (x0, y0, x1, y1) in [(2, 12, 12, 24), (24, 18, 34, 30)]:
        m = p.pmask([(x0, y0), (x1, y0), (x1, y1), (x0, y1)]); p.shade_mask(m, DGRN, x0 + 3, y0 + 3, 10, amb=0.4)
    p.ball(18, 4, 4, 3, PINK, spec=False)
    for y in range(10, 48, 5): p.put(15, y, '#e8ffd0'); p.put(21, y + 2, '#e8ffd0')
    eye(p, 15, 16, 1.2); eye(p, 21, 16, 1.2)


def rbc(p):
    p.ball(19, 8, 18, 7, RED, amb=0.4)
    p.ball(19, 7, 9, 3, ramp('#6a0a14', '#a01a24', '#d03a40'), spec=False, amb=0.4)


def amoeba(p):
    pts = [(24 + (20 + 2 * math.sin(3 * u) + 1.5 * math.sin(5 * u)) * math.cos(u), 17 + (14 + 2 * math.sin(4 * u + 1)) * math.sin(u)) for u in np.linspace(0, 2 * math.pi, 70)]
    m = p.pmask(pts); p.shade_mask(m, ramp('#1a5a1a', '#3aa030', '#80e050', '#d0ff90', '#f4ffe0'), 18, 10, 22, amb=0.35)
    p.ball(26, 18, 6, 5, ramp('#2a4a10', '#4a7a20', '#7ab040'))
    for (x, y) in [(14, 12), (36, 22), (12, 22)]: p.ball(x, y, 2, 2, ramp('#5a8a20', '#a0d050'), spec=False)
    eye(p, 18, 13); eye(p, 26, 12)


def phage(p):
    for k in range(6):
        x0 = 15 + (k - 2.5) * 2.4
        p.line([(15, 34), (x0 + (k - 2.5) * 2.5, 40), (x0 + (k - 2.5) * 4, 46)], '#c0c8e0', 1)
    p.rect(9, 44, 13, 3, '#8a90a8')
    caps(p, 15, 20, 15, 34, 3, ramp('#4a5070', '#9aa0c0', '#e0e4f8'))
    for dy in (23, 27, 31): p.line([(12, dy), (18, dy)], '#4a5070', 1)
    hm = p.pmask([(15, 1), (26, 7), (26, 17), (15, 23), (4, 17), (4, 7)])
    p.shade_mask(hm, ramp('#4a1a70', '#8a3ac0', '#c070ff', '#f0c0ff'), 11, 6, 13, amb=0.3)
    p.line([(15, 1), (15, 23)], '#5a2a8a', 1); p.line([(4, 7), (26, 17)], '#5a2a8a', 1); p.line([(26, 7), (4, 17)], '#5a2a8a', 1)


def virus(p):
    for k in range(12):
        a = k * math.pi / 6
        x, y = 17 + 13 * math.cos(a), 17 + 13 * math.sin(a)
        p.line([(17 + 9 * math.cos(a), 17 + 9 * math.sin(a)), (x, y)], '#c84a3a', 2)
        p.ball(x, y, 2.5, 2.5, ramp('#8a1a10', '#ff6a4a', '#ffc0a0'), spec=False)
    p.ball(17, 17, 11, 11, ramp('#5a1a14', '#a8402a', '#e8705a', '#ffb8a0', '#fff0e8'))
    eye(p, 13, 15); eye(p, 21, 15)


def mito(p):
    p.ball(23, 10, 22, 9, ORNG, amb=0.35)
    p.ring(23, 10, 22, 9, '#6a2a08', 1.2)
    for k in range(-16, 18, 5):
        p.line([(23 + k, 3), (23 + k + 2, 8)], '#8a3a0a', 1); p.line([(23 + k + 2, 12), (23 + k, 17)], '#8a3a0a', 1)


def dna(p):
    for k in range(0, 28):
        y = 2 + k * 2.1; ph = k * 0.45
        x1, x2 = 10 + 7 * math.sin(ph), 10 - 7 * math.sin(ph)
        if k % 2 == 0: p.line([(x1, y), (x2, y)], ['#ff5a6a', '#5ad0ff', '#ffd040', '#7aff7a'][k % 4], 1)
        p.ball(x1, y, 2.2, 2.2, BLUE if math.cos(ph) > 0 else ramp('#0a1a4a', '#1a3a8a', '#3a6ad0'), spec=False)
        p.ball(x2, y, 2.2, 2.2, PINK if math.cos(ph) < 0 else ramp('#5a1a3a', '#a83a6a', '#e070a0'), spec=False)


def neuron(p):
    for a, L in [(-2.6, 16), (-1.9, 14), (-0.4, 18), (2.6, 14), (2.0, 12)]:
        x2, y2 = 16 + L * math.cos(a), 18 + L * math.sin(a)
        p.line([(16, 18), (x2, y2)], '#7a4ab0', 3); p.line([(16, 18), (x2, y2)], '#c890ff', 1)
        p.line([(x2, y2), (x2 + 4 * math.cos(a + 0.6), y2 + 4 * math.sin(a + 0.6))], '#c890ff', 1)
    pts = [(16, 18), (28, 24), (40, 26), (48, 30)]
    p.line(pts, '#5a3a20', 3); p.line(pts, '#ffd080', 1)
    caps(p, 28, 24, 34, 25.5, 2.4, ramp('#5a4a2a', '#c0a060', '#fff0c0'))
    caps(p, 38, 26.5, 44, 28.5, 2.4, ramp('#5a4a2a', '#c0a060', '#fff0c0'))
    p.ball(16, 18, 8, 7, PURP); eye(p, 13, 16, 1.4); eye(p, 19, 16, 1.4)


def heart(p):
    pts = [(19 + 16 * math.sin(t) ** 3, 17 - (13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)) * 1.1) for t in np.linspace(0, 2 * math.pi, 80)]
    m = p.pmask(pts); p.shade_mask(m, ramp('#4a0610', '#8a1020', '#d02a34', '#ff7a6a', '#ffd0c0'), 13, 9, 18, amb=0.3)
    p.line([(22, 4), (24, 0)], '#d02a30', 3); p.line([(15, 5), (13, 1)], '#4a6ad0', 3)
    p.line([(24, 10), (20, 22), (18, 30)], '#ffd040', 1)
    eye(p, 14, 15); eye(p, 24, 15)


def brain(p):
    m = p.ball(26, 22, 24, 18, ramp('#5a2a3a', '#a8506a', '#e88aa0', '#ffc8d4', '#fff0f4'), mask=p.Y <= 32, amb=0.35)
    p.rect(3, 30, 46, 3, '#c86a80')
    for k in range(7):
        pts = [(6 + t, 10 + k * 3.4 + 2 * math.sin(t / 3 + k * 1.7)) for t in range(0, 41, 2)]
        p.fill(p.lmask(pts, 1) & m, '#b0506a')
    p.fill(p.lmask([(26, 5), (26, 31)], 1) & m, '#8a3050')
    p.ball(40, 33, 7, 4, ramp('#5a2a3a', '#a8506a', '#d0809a'), spec=False)


def bone(p):
    for (x, y) in [(6, 5), (6, 13), (58, 5), (58, 13)]: p.ball(x, y, 5.5, 5.5, BONE, amb=0.4)
    caps(p, 8, 9, 56, 9, 4.5, BONE)
    p.line([(14, 7), (50, 7)], '#ffffff', 1)


def tooth(p):
    for x in (9, 23):
        roots = p.pmask([(x - 5, 16), (x + 5, 16), (x + 2, 33), (x - 2, 33)]); p.shade_mask(roots, BONE, x - 2, 20, 12, amb=0.4)
    crown = p.pmask([(2, 6), (8, 2), (16, 5), (24, 2), (30, 6), (30, 18), (2, 18)])
    p.shade_mask(crown, ramp('#8a8aa0', '#d0d4e8', '#f4f6ff', '#ffffff'), 10, 4, 18, amb=0.5)
    eye(p, 11, 11, 1.4); eye(p, 21, 11, 1.4); p.line([(13, 15), (16, 16), (19, 15)], '#5a5a70', 1)


def lungs(p):
    p.rect(21, 0, 6, 10, '#c8a8a0')
    for y in range(1, 10, 3): p.line([(20, y), (27, y)], '#f0e0d8', 1)
    for d in (-1, 1):
        lm = p.emask(24 + d * 12, 26, 11, 16)[0] | p.emask(24 + d * 10, 18, 8, 10)[0]
        p.shade_mask(lm, FLESH, 24 + d * 10, 18, 18, amb=0.35)
        p.line([(24, 10), (24 + d * 6, 16), (24 + d * 12, 26)], '#8a5a50', 2)


def bacillus(p):
    caps(p, 8, 8, 34, 8, 6.5, ramp('#2a5a10', '#5aa020', '#a0e050', '#e0ffb0'))
    for x in (10, 17, 24, 31): p.put(x, 6, '#2a5a10')
    p.line([(1, 8), (-1, 4)], '#a0e050', 1); eye(p, 30, 7, 1.4)


def paramecium(p):
    m = p.ball(24, 11, 22, 9, ramp('#5a3a08', '#a8801a', '#f0d050', '#fff4a8', '#ffffe8'), amb=0.35)
    for u in np.linspace(0, 2 * math.pi, 34, endpoint=False):
        p.put(24 + 23.5 * math.cos(u), 11 + 10.5 * math.sin(u), '#fff8c0')
    p.ball(28, 10, 5, 3.5, ramp('#5a2a08', '#a85a1a', '#e09040'), spec=False)
    p.ring(14, 13, 3, 3, '#c0a040', 1); eye(p, 40, 9, 1.4)


def egg(p):
    p.ball(13, 17, 12, 15, ramp('#8a7a5a', '#d8c8a0', '#f8f0d8', '#ffffff'), amb=0.45)
    for (x, y) in [(9, 12), (16, 20), (12, 24), (18, 10)]: p.put(x, y, '#b8a070')


def chloroplast(p):
    p.ball(21, 11, 20, 10, GRN, amb=0.35)
    for x in (9, 16, 23, 30):
        for k in range(3): p.rect(x - 3, 6 + k * 3, 6, 2, '#1e7a2a')
    p.line([(4, 11), (38, 11)], '#90e060', 1)


# ---------------------------------------------------------------- 목록: id, 이름, 그림, (가로, 세로), 밀도, 둥근 몸, 설명
PIECES = [
    ('turtle', '거북', turtle, (74, 30), 1.4, None, '거북은 등딱지가 갈비뼈와 붙어 자란 파충류예요.'),
    ('whale', '대왕고래', whale, (97, 32), 1.6, None, '대왕고래는 지구에서 가장 큰 동물이에요.'),
    ('starfish', '불가사리', starfish, (43, 42), 0.9, None, '불가사리는 팔이 잘려도 다시 자라는 재생 능력이 있어요.'),
    ('jelly', '해파리', jelly, (36, 40), 0.6, None, '해파리 몸의 95% 이상은 물이에요.'),
    ('frog', '개구리', frog, (38, 30), 1.0, None, '개구리는 폐와 피부로 숨을 쉬어요.'),
    ('snail', '달팽이', snail, (52, 35), 1.0, None, '달팽이는 점액을 내어 미끄러지듯 기어가요.'),
    ('mushroom', '버섯', mushroom, (37, 46), 0.8, None, '버섯은 균류가 포자를 퍼뜨리는 기관이에요.'),
    ('seahorse', '해마', seahorse, (28, 46), 0.8, None, '해마는 수컷이 배 주머니에서 새끼를 길러요.'),
    ('butterfly', '나비', butterfly, (45, 32), 0.5, None, '나비는 알-애벌레-번데기-어른벌레로 자라요.'),
    ('cactus', '선인장', cactus, (36, 51), 1.0, None, '선인장의 가시는 잎이 변한 것이에요.'),
    ('rbc', '적혈구', rbc, (39, 16), 0.8, None, '적혈구는 헤모글로빈으로 산소를 운반해요.'),
    ('amoeba', '아메바', amoeba, (48, 34), 0.8, None, '아메바는 위족을 뻗어 움직이고 먹이를 잡아요.'),
    ('phage', '박테리오파지', phage, (31, 48), 0.9, None, '박테리오파지는 세균에 DNA를 주입하는 바이러스예요.'),
    ('virus', '코로나바이러스', virus, (35, 35), 0.7, 'circle', '돌기 단백질로 세포에 달라붙어요. 잘 굴러요!'),
    ('mito', '미토콘드리아', mito, (47, 21), 1.0, None, '미토콘드리아는 세포 호흡으로 ATP를 만들어요.'),
    ('dna', 'DNA', dna, (21, 62), 0.9, None, 'DNA는 A-T, G-C가 짝을 이룬 이중나선이에요.'),
    ('neuron', '뉴런', neuron, (50, 34), 0.8, None, '뉴런은 전기 신호로 정보를 전달해요.'),
    ('heart', '심장', heart, (38, 36), 1.2, None, '심장은 2심방 2심실의 근육 펌프예요.'),
    ('brain', '뇌', brain, (52, 38), 1.3, None, '대뇌의 주름은 표면적을 넓혀 줘요.'),
    ('bone', '대퇴골', bone, (65, 19), 1.5, None, '대퇴골은 몸에서 가장 긴 뼈예요.'),
    ('tooth', '어금니', tooth, (32, 34), 1.4, None, '법랑질은 몸에서 가장 단단한 조직이에요.'),
    ('lungs', '폐', lungs, (48, 43), 0.7, None, '폐포에서 산소와 이산화 탄소가 교환돼요.'),
    ('bacillus', '막대균', bacillus, (42, 16), 0.8, None, '막대 모양 세균은 둘로 나뉘어 번식해요.'),
    ('paramecium', '짚신벌레', paramecium, (48, 23), 0.8, None, '짚신벌레는 섬모로 헤엄쳐요.'),
    ('egg', '알', egg, (27, 33), 1.0, 'circle', '알껍데기의 작은 구멍으로 숨을 쉬어요. 잘 굴러요!'),
    ('chloroplast', '엽록체', chloroplast, (42, 22), 0.9, None, '엽록체는 빛에너지로 광합성을 해요.'),
]


def collision(alpha, ox, oy, band=5):
    """불투명 픽셀 모양을 가로 띠로 잘라 볼록 사다리꼴 여러 개로 근사 (오목한 모양도 표현)"""
    h, w = alpha.shape; parts = []
    for y0 in range(0, h, band):
        y1 = min(h, y0 + band)
        rows = alpha[y0:y1]
        if not rows.any(): continue
        u = rows.any(axis=0); x = 0
        while x < w:
            if not u[x]: x += 1; continue
            s = x
            while x < w and u[x]: x += 1
            e = x   # 구간 [s, e)
            def ext(r):
                xs = np.where(r[s:e])[0]
                return (s + xs[0], s + xs[-1] + 1) if len(xs) else None
            top = None; bot = None
            for r in rows:
                q = ext(r)
                if q: top = q; break
            for r in rows[::-1]:
                q = ext(r)
                if q: bot = q; break
            if e - s < 2 and y1 - y0 < 2: continue
            pts = [(top[0], y0), (top[1], y0), (bot[1], y1), (bot[0], y1)]
            parts.append([[round(px - ox, 1), round(py - oy, 1)] for px, py in pts])
    return parts
