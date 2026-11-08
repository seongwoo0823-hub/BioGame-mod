# 면역 특공대 1스테이지 세균 10종 — 의인화한 4~5등신 도트 (직접 그림)
#   오른쪽을 봄, 한 칸 32×48, 발끝 y=46 · 칸: 0 서기 / 1 걷기 / 2 공격
#   python3 enemies_s1.py  →  games/immune-strike/enemies-s1.png, art/enemies-s1-preview.png
import math, os
from pixel import Sprite, sheet, preview, OUTLINE
from figure import figure, W, H, HX, HY

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '../../games/immune-strike')


# ---------------- 무기 ----------------
def club(sp, hand, ang, col='#a0703a', L=11):
    x, y = hand; x1, y1 = x + math.cos(ang) * L, y + math.sin(ang) * L
    m = sp.m_capsule(x - math.cos(ang) * 2, y - math.sin(ang) * 2, x1, y1, 1); sp.outline(m); sp.fill(m, '#6a4628')
    h = sp.m_capsule(x + math.cos(ang) * L * .5, y + math.sin(ang) * L * .5, x1, y1, 2.3); sp.shade(h, col)


def spear(sp, hand, ang, col='#c8d0e0', L=16):
    x, y = hand; x1, y1 = x + math.cos(ang) * L, y + math.sin(ang) * L
    m = sp.m_capsule(x - math.cos(ang) * 6, y - math.sin(ang) * 6, x1, y1, .8); sp.outline(m); sp.fill(m, '#7a5030')
    tip = [(x1 + math.cos(ang) * 5, y1 + math.sin(ang) * 5), (x1 + math.cos(ang + 1.8) * 2.2, y1 + math.sin(ang + 1.8) * 2.2),
           (x1 + math.cos(ang - 1.8) * 2.2, y1 + math.sin(ang - 1.8) * 2.2)]
    sp.shade(sp.m_poly(tip), col)


def gun(sp, hand, body='#5a6a80', glow='#7af0d8', L=8, ang=0):
    x, y = hand
    m = sp.m_capsule(x - 1, y - 1, x + L, y - 1, 1.6); sp.shade(m, body)
    g = sp.m_capsule(x, y, x, y + 2, .9); sp.outline(g); sp.fill(g, '#3a4458')
    sp.dot(x + L + 1, y - 1, glow); sp.dot(x + 2, y - 2, '#c0d0e0')


def flask(sp, x, y, liquid='#90e050'):
    sp.shade(sp.m_ellipse(x, y + 1, 2.6, 2.6), liquid)
    nk = sp.m_capsule(x, y - 3, x, y - 1, .8); sp.outline(nk); sp.fill(nk, '#d8e8f0')
    sp.dot(x - 1, y, '#f0ffe0')


def bomb(sp, x, y, lit=False):
    sp.shade(sp.m_ellipse(x, y, 3, 3), '#3a3448')
    sp.dot(x - 1, y - 1, '#8a84a0')
    sp.line([(x + 1, y - 3), (x + 2, y - 5)], '#c8a060')
    if lit: sp.dot(x + 3, y - 6, '#ffe060'); sp.dot(x + 2, y - 6, '#ff8030')


def fork(sp, hand, ang):
    x, y = hand; x1, y1 = x + math.cos(ang) * 11, y + math.sin(ang) * 11
    m = sp.m_capsule(x - math.cos(ang) * 2, y - math.sin(ang) * 2, x1, y1, .7); sp.outline(m); sp.fill(m, '#c8d0e0')
    px, py = -math.sin(ang), math.cos(ang)
    for k in (-1.6, 0, 1.6):
        sx, sy = x1 + px * k, y1 + py * k
        t = sp.m_capsule(sx, sy, sx + math.cos(ang) * 3, sy + math.sin(ang) * 3, .45); sp.outline(t); sp.fill(t, '#e8eef8')


def shield(sp, x, y, col='#a06040'):
    m = sp.m_ellipse(x, y, 3.6, 5.5); sp.shade(m, col)
    sp.fill(sp.m_ellipse(x + .3, y, 1.3, 2.4), '#e0b060')


# ================= 10종 =================
def ecoli():
    """대장균: 막대 모양 머리 + 뒤로 날리는 편모 머리카락, 몽둥이 든 건달"""
    def hb(sp, f, dy):
        for k in range(3):
            sp.line([(12 - t * 1.6, 9 + k * 2.5 + math.sin(f * 1.5 + k + t) * 1.1 + dy) for t in range(5)], '#3d7a28')
    def wp(sp, f, hand, dy):
        club(sp, hand, -.25 if f == 2 else -1.25)
    return dict(skin='#8fd060', cloth='#2f5a2a', pants='#4a5a7a', belt='#5a3a20', hrx=5.5, hry=4.4,
                head_back=hb, weapon=wp, mouth='grin', mouth_atk='open')


def staph():
    """포도상구균: 포도송이 아프로 머리, 권투 선수"""
    def hd(sp, f, dy):
        for x, y in ((12, 8), (15, 6.5), (18.5, 7.5), (11, 11.5), (13.5, 9.5)):
            sp.shade(sp.m_ellipse(x, y + dy, 2.4, 2.4), '#e8b830')
    def gl(sp, f, hand, dy):
        pass
    return dict(skin='#f0cc48', cloth='#f0cc48', sleeve='#f0cc48', pants='#c83a3a', boots='#f0f0f0', belt='#f0f0f0',
                glove='#e04848', head=hd, wide=1, mouth='grin',
                pose={0: dict(hb=(14, 23), hf=(21, 22)), 1: dict(hb=(13, 24), hf=(21, 23)), 2: dict(hb=(14, 23), hf=(27, 20))})


def strep():
    """연쇄상구균: 공 사슬 포니테일, 사슬 채찍"""
    def hb(sp, f, dy):
        for i in range(4):
            x = 11 - i * 2.2; y = 10 + i * 2.6 + math.sin(f + i) * .8
            sp.shade(sp.m_ellipse(x, y + dy, 1.9, 1.9), '#b080f0')
    def wp(sp, f, hand, dy):
        x, y = hand
        pts = [(x + 2 + k * 2.6, y - 1 - k * .3) for k in range(4)] if f == 2 else [(x + .5, y + 2 + k * 2.4) for k in range(4)]
        for px, py in pts: sp.shade(sp.m_ellipse(px, py, 1.4, 1.4), '#c8b8e8')
    return dict(skin='#a070e0', cloth='#3a2a5a', pants='#4a3a6a', head_back=hb, weapon_front=wp, mood='smug', mouth='grin')


def salmo():
    """살모넬라: 편모 모히칸, 앞치마 두른 식중독 요리사, 포크"""
    def hd(sp, f, dy):
        for k in range(5):
            x = 12 + k * 1.8
            sp.line([(x, 8 + dy), (x - .6 + math.sin(f + k) * .8, 5 + dy), (x + .4, 3 + dy)], '#b04a30')
    def ch(sp, f, dy):
        m = sp.m_poly([(14, 22 + dy), (19, 22 + dy), (19.5, 32 + dy), (13.5, 32 + dy)]); sp.shade(m, '#f0ece0')
    def wp(sp, f, hand, dy):
        fork(sp, hand, -.15 if f == 2 else -1.1)
    return dict(skin='#e86a4a', cloth='#e86a4a', pants='#7a4a3a', head=hd, chest=ch, weapon=wp, mood='smug', mouth='grin')


def clos():
    """클로스트리디움 포자: 둥근 포자 헬멧, 작업복, 포자 폭탄"""
    def hd(sp, f, dy):
        m = sp.m_ellipse(HX, HY - 2 + dy, 6, 5); m &= ~sp.m_ellipse(HX + 2, HY + 2 + dy, 4, 3)
        sp.shade(m, '#d8b878'); sp.dot(13, 8 + dy, '#f2e0b0')
    def wp(sp, f, hand, dy):
        if f == 2: bomb(sp, hand[0] + 2, hand[1] - 3, True)
        else: bomb(sp, hand[0] + 1, hand[1] + 3)
    return dict(skin='#c8a060', cloth='#7a5a30', pants='#6a4a28', belt='#3a2a18', head=hd, weapon_front=wp,
                pose={2: dict(hf=(23, 20))})


def tb():
    """결핵균: 밀랍 갑옷 기사, 투구 + 방패 + 몽둥이 (덩치 큼)"""
    def hd(sp, f, dy):
        m = sp.m_poly([(10.5, 11 + dy), (16, 4 + dy), (21.5, 11 + dy), (21.5, 13 + dy), (10.5, 13 + dy)]); sp.shade(m, '#8a8aa0')
        sp.dot(16, 5 + dy, '#d0d0e0')
    def ch(sp, f, dy):
        for x in (14, 17):
            sp.line([(x, 21 + dy), (x, 30 + dy)], '#a8985a')
    def wb(sp, f, hand, dy):
        shield(sp, hand[0] + 1, hand[1] - 2)
    def wp(sp, f, hand, dy):
        club(sp, hand, -.3 if f == 2 else -1.2, '#8a8aa0')
    return dict(skin='#c8b878', cloth='#c8b878', pants='#8a7a48', boots='#5a5a70', glove='#5a5a70', wide=2, head=hd, chest=ch,
                weapon=wp, weapon_back=wb, mouth='line',
                pose={0: dict(hb=(19, 26)), 1: dict(hb=(19, 25)), 2: dict(hb=(20, 24))})


def helico():
    """헬리코박터: 고글 쓴 비행사, 나선 꼬리 스카프로 날아다님, 광선총"""
    def bk(sp, f, dy):
        for i in range(6):
            x = 12 - i * 1.6; y = 22 + math.sin(f * 1.4 + i * 1.2) * 2 + dy
            sp.shade(sp.m_ellipse(x, y, 1.8, 1.8), '#c8c850')
    def hd(sp, f, dy):
        g = sp.m_capsule(11.5, 9 + dy, 20.5, 9 + dy, 1.8); sp.shade(g, '#6a5a3a')
        sp.fill(sp.m_ellipse(16.5, 9.2 + dy, 1.3, 1.3), '#80d0ff'); sp.fill(sp.m_ellipse(19.5, 9.2 + dy, 1.2, 1.2), '#80d0ff')
    def wp(sp, f, hand, dy):
        if f == 2: gun(sp, hand, '#6a6a40', '#ffe060')
    return dict(skin='#e0e070', cloth='#8a6a3a', pants='#5a4a30', fly=True, back=bk, head=hd, weapon=wp, mood='smug', mouth='grin',
                pose={0: dict(dy=-2), 1: dict(dy=-3), 2: dict(dy=-2)})


def botul():
    """보툴리누스균: 방독면 + 실험복을 입은 독약 박사"""
    def hd(sp, f, dy):
        m = sp.m_ellipse(HX + 1.5, HY + 1 + dy, 3.6, 3.2); sp.shade(m, '#5a4a5a')
        sp.fill(sp.m_ellipse(HX + 1, HY - .5 + dy, 1, 1), '#a0ff70'); sp.fill(sp.m_ellipse(HX + 3.5, HY - .5 + dy, 1, 1), '#a0ff70')
        f2 = sp.m_ellipse(HX + 3, HY + 3 + dy, 1.4, 1.2); sp.shade(f2, '#3a3040')
    def ch(sp, f, dy):
        sp.line([(16, 20 + dy), (16, 31 + dy)], '#c8c8d0')
    def wp(sp, f, hand, dy):
        flask(sp, hand[0] + 1, hand[1] - 3)
    return dict(skin='#a07a50', cloth='#e8e8f0', pants='#5a6070', head=hd, chest=ch, weapon_front=wp, noface=True,
                pose={2: dict(hf=(23, 19))})


def bacil():
    """바실러스: 두 마디 막대 머리, 머리띠 무술가, 창"""
    def hd(sp, f, dy):
        m = sp.m_capsule(HX, HY - 6 + dy, HX, HY - 4 + dy, 3.2); sp.shade(m, '#c06aa0')
        b = sp.m_capsule(11.5, HY - 2 + dy, 20.5, HY - 2 + dy, .9); sp.fill(b, '#3a70e0')
        sp.line([(11, HY - 2 + dy), (8, HY + dy), (7, HY - 1 + dy)], '#3a70e0')
    def wp(sp, f, hand, dy):
        spear(sp, hand, -.05 if f == 2 else -1.45)
    return dict(skin='#d07ab0', cloth='#f0f0f0', pants='#3a3a5a', belt='#202020', head=hd, weapon=wp)


def pseudo():
    """녹농균: 후드 쓴 청록 점액 악당, 점액 물총"""
    def hb(sp, f, dy):
        sp.line([(12, 10 + dy), (9, 9 + dy), (7, 11 + dy), (5, 9 + dy + f % 2)], '#2a9a80')
    def hd(sp, f, dy):
        m = sp.m_ellipse(HX - 1, HY - 1 + dy, 5.2, 5.4); m &= ~sp.m_ellipse(HX + 2, HY + 1 + dy, 3.6, 3.8)
        sp.shade(m, '#2a5a60')
    def ch(sp, f, dy):
        for x, y in ((14, 32), (18, 33)):
            sp.fill(sp.m_ellipse(x, y + dy + (f == 1), .8, 1.4), '#8af8e0')
    def wp(sp, f, hand, dy):
        gun(sp, hand, '#3a8a80', '#8af8e0')
        if f == 2:
            for k in range(3): sp.fill(sp.m_ellipse(hand[0] + 11 + k * 1.3, hand[1] - 1 + (k % 2), .9, .9), '#8af8e0')
    return dict(skin='#40d0b0', cloth='#2a5a60', pants='#2e5060', head_back=hb, head=hd, chest=ch, weapon=wp, mood='smug', mouth='grin',
                pose={0: dict(hf=(21, 25)), 1: dict(hf=(21, 25))})


ENEMIES = [('ecoli', ecoli), ('staph', staph), ('strep', strep), ('salmo', salmo), ('clos', clos),
           ('tb', tb), ('helico', helico), ('botul', botul), ('bacil', bacil), ('pseudo', pseudo)]


def build():
    rows = []
    for name, fn in ENEMIES:
        spec = fn(); row = []
        for f in range(3):
            sp = Sprite(W, H); figure(sp, f, spec); row.append(sp.image())
        rows.append(row)
    img = sheet(rows, (W, H))
    os.makedirs(OUT, exist_ok=True)
    img.save(os.path.join(OUT, 'enemies-s1.png'))
    half = (len(rows) + 1) // 2
    blank = Sprite(W, H).image()
    two = sheet([rows[i] + [blank] + (rows[i + half] if i + half < len(rows) else []) for i in range(half)], (W, H))
    preview(two, os.path.join(HERE, 'art/enemies-s1-preview.png'), 4)
    return img


if __name__ == '__main__':
    build(); print('enemies-s1.png', len(ENEMIES), 'x 3')
