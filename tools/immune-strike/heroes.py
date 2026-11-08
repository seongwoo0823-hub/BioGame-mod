# 면역 특공대 주인공 4명 — 4~5등신 도트 (직접 그림, Glif 시험 원화의 색·소품을 따름)
#   한 칸 32×48, 오른쪽을 봄 · 칸: 0 서기 / 1 달리기 / 2 사격 / 3 점프
#   python3 heroes.py → games/immune-strike/heroes.png, art/heroes-preview.png
import math, os
from pixel import Sprite, sheet, preview, OUTLINE
from figure import figure, W, H, HX, HY

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '../../games/immune-strike')

# 두 손으로 총을 앞으로 겨눔
AIM = {0: dict(hb=(19, 26), hf=(22, 25)), 1: dict(hb=(19, 25), hf=(22, 24)), 2: dict(hb=(20, 24), hf=(23, 23)), 3: dict(hb=(19, 23), hf=(22, 22))}


def rifle(sp, hand, f, body='#4a4a5a', L=11, glow=None, thick=1.5):
    x, y = hand
    m = sp.m_capsule(x - 4, y - 1, x + L, y - 1, thick); sp.shade(m, body)
    g = sp.m_capsule(x - 1, y, x - 1, y + 2.5, .9); sp.outline(g); sp.fill(g, '#2e2a38')   # 손잡이
    st = sp.m_capsule(x - 6, y, x - 4, y, 1.4); sp.outline(st); sp.fill(st, '#6a4a30')     # 개머리
    sp.dot(x + 1, y - 2, '#a0a0b8')
    if glow: sp.dot(x + L - 2, y - 1, glow)
    if f == 2:                                                                             # 총구 불꽃
        fx = x + L + 2
        fl = sp.m_poly([(fx - 1, y - 3), (fx + 4, y - 1), (fx - 1, y + 1)])
        sp.fill(fl, glow or '#ffd040'); sp.dot(fx, y - 1, '#ffffff'); sp.dot(fx + 1, y - 1, '#fff0b0')


def neutro():
    """호중구: 연보라 피부, 여러 갈래 핵 무늬 배지, 군용 헬멧, 소총"""
    def hd(sp, f, dy):
        m = sp.m_ellipse(HX - .5, HY - 3.5 + dy, 5.6, 3.8); m[int(HY - 2 + dy):, :] = False
        sp.shade(m, '#5a5e48'); sp.line([(HX - 6, HY - 2 + dy), (HX + 5, HY - 2 + dy)], '#46483a')
        sp.dot(HX + 1, HY - 6 + dy, '#d8d090')
    def ch(sp, f, dy):
        for x, y in ((14.5, 24), (16.5, 25.5), (14.5, 27)):
            sp.fill(sp.m_ellipse(x, y + dy, 1.1, 1), '#8a5ac8')
    def wp(sp, f, hand, dy): rifle(sp, hand, f, '#4a4a5a')
    return dict(skin='#e2c4f0', cloth='#6a7050', pants='#5a5e48', boots='#3a3a30', belt='#3a3424', head=hd, chest=ch,
                weapon=wp, mood='mad', mouth='line', mouth_atk='open', pose=AIM)


def macro():
    """대식세포: 연두색 덩치, 위족 같은 울퉁불퉁한 어깨, 헤비머신건"""
    def hd(sp, f, dy):
        for x, y in ((11, 9), (13.5, 7), (17, 6.5), (20, 8.5)):
            sp.shade(sp.m_ellipse(x, y + dy, 1.8, 1.8), '#9ad850')
    def ch(sp, f, dy):
        for x, y in ((11, 21), (21, 21)):
            sp.shade(sp.m_ellipse(x, y + dy, 2.4, 2.2), '#9ad850')
    def wp(sp, f, hand, dy):
        x, y = hand
        rifle(sp, hand, f, '#3a3a44', L=12, thick=2.2)
        am = sp.m_capsule(x + 2, y + 2, x + 2, y + 5, 1.4); sp.outline(am); sp.fill(am, '#d0a020')        # 탄띠
        for k in range(3): sp.dot(x + 2, y + 2 + k, '#f0d060')
    return dict(skin='#9ad850', cloth='#4a6a2a', pants='#3a4a2a', boots='#2e2a24', belt='#2a2418', wide=2, hrx=5, hry=5,
                head=hd, chest=ch, weapon=wp, mood='calm', mouth='grin', mouth_atk='open', pose=AIM)


def tcell():
    """킬러 T세포: 하늘색 피부, 수용체 더듬이, 빨간 두건, 레이저 소총"""
    def hb(sp, f, dy):
        sp.line([(HX - 4, HY - 3 + dy), (HX - 7, HY - 1 + dy + (f % 2)), (HX - 9, HY - 2 + dy)], '#e03a3a')
        sp.line([(HX - 4, HY - 2 + dy), (HX - 8, HY + 1 + dy), (HX - 9, HY + dy + (f % 2))], '#c02a2a')
    def hd(sp, f, dy):
        for x0, s in ((HX - 1.5, -1), (HX + 2, 1)):
            sp.line([(x0, HY - 4 + dy), (x0, HY - 7 + dy)], '#6ab0f0')
            sp.dot(x0 - 1, HY - 8 + dy, '#6ab0f0'); sp.dot(x0 + 1, HY - 8 + dy, '#6ab0f0')
        b = sp.m_capsule(HX - 4.5, HY - 3 + dy, HX + 4.5, HY - 3 + dy, 1); sp.fill(b, '#e03a3a')
    def wp(sp, f, hand, dy): rifle(sp, hand, f, '#4a5a70', glow='#7ae8ff')
    return dict(skin='#8ac4f8', cloth='#2a4a7a', pants='#2a3a5a', boots='#202838', belt='#1a2030', head_back=hb, head=hd,
                weapon=wp, mood='mad', mouth='line', mouth_atk='open', pose=AIM)


def nk():
    """NK세포: 주황 피부, 검은 바이저 고글, 과립 탄약 배낭, 블래스터"""
    def bk(sp, f, dy):
        m = sp.m_capsule(10.5, 21 + dy, 10.5, 28 + dy, 2.6); sp.shade(m, '#5a5a66')
        for k in range(3): sp.fill(sp.m_ellipse(10.5, 22.5 + k * 2.3 + dy, 1.4, .8), '#e8b030')
    def hd(sp, f, dy):
        v = sp.m_capsule(HX - 2, HY - 1 + dy, HX + 4.2, HY - 1 + dy, 1.6); sp.fill(v, '#202838'); sp.outline(v)
        sp.fill(v, '#202838'); sp.line([(HX + 1, HY - 2 + dy), (HX + 3, HY - 2 + dy)], '#6aa0e0')
    def wp(sp, f, hand, dy): rifle(sp, hand, f, '#4a4a5a', L=8, glow='#ffe060')
    return dict(skin='#f0a040', cloth='#3a3a48', pants='#3a3a48', boots='#222230', belt='#e8b030', back=bk, head=hd,
                weapon=wp, noface=False, mood='calm', mouth='line', mouth_atk='open', pose=AIM)


HEROES = [('neutro', neutro), ('macro', macro), ('tcell', tcell), ('nk', nk)]


def build():
    rows = []
    for name, fn in HEROES:
        spec = fn(); row = []
        for f in (0, 1, 2, 3):
            sp = Sprite(W, H); figure(sp, f, spec); row.append(sp.image())
        rows.append(row)
    img = sheet(rows, (W, H))
    os.makedirs(OUT, exist_ok=True)
    img.save(os.path.join(OUT, 'heroes.png'))
    preview(img, os.path.join(HERE, 'art/heroes-preview.png'), 4)
    return img


if __name__ == '__main__':
    build(); print('heroes.png', len(HEROES), 'x 4')
