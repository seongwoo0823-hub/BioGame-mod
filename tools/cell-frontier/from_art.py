# 세포 개척단: art/ 폴더의 새 원화(Glif로 생성)에서 숨은 그림 16장과 스프라이트를 만듭니다.
#   python3 from_art.py [출력 폴더]
#   art/pictures.jpg  숨은 그림 16장 (4×4, 세포 → 식물 세포 → … → 눈 순서)
#   art/enemies.jpg   보스 8종 (4×2, 자홍색 배경)
#   art/small.jpg     탐침·작은 적 8 · 아이템 캡슐 5 · 반짝임·폭발·연기 (6×3, 자홍색 배경)
# 숨은 그림은 960×720(게임판 3배 해상도) JPEG, 스프라이트 시트도 3배 해상도(SC=3, sprites.json의 "s")입니다.
# 도화선·탄 같은 작은 효과와 덮개·세계 지도는 build.py(도트 직접 그리기)가 만든 것을 그대로 씁니다.
import sys, os, json, math
import numpy as np
from PIL import Image, ImageFilter
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, '../bio-tower'))
from from_art_common import grid_items   # 자홍색 배경 빼고 격자 칸마다 잘라 내기 (바이오 타워와 같은 코드)
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '../../games/cell-frontier')
SC = 3
TAU = 2 * math.pi
ART = lambda f: os.path.join(HERE, 'art', f)


# ---------------------------------------------------------------- 숨은 그림 16장 (960×720)
def build_pictures():
    src = Image.open(ART('pictures.jpg')).convert('RGB'); W, H = src.size; cw, ch = W / 4, H / 4
    for i in range(16):
        x, y = (i % 4) * cw, (i // 4) * ch
        c = src.crop((round(x + 5), round(y + 5), round(x + cw - 5), round(y + ch - 5)))   # 칸 사이 검은 줄 빼기
        c.resize((960, 720), Image.LANCZOS).save(os.path.join(OUT, f'p{i:02d}.jpg'), quality=88)


# ---------------------------------------------------------------- 스프라이트 원본
_SRC = {}


def cut(k, soft=False):
    if not _SRC:
        for name, im in zip(['phage', 'amoeba', 'jelly', 'paramecium', 'hornet', 'spider', 'cancer', 'plasmodium'], grid_items(ART('enemies.jpg'), 4, 2)):
            _SRC[name] = im
        names = ['probe', 'bacillus', 'krill', 'mosquito', 'coccus', 'ribosome', 'starfish', 'ant', 'wbc', 'speed', 'shield', 'freeze',
                 'clock', 'life', 'x0', 'x1', 'x2', 'x3']
        for name, im in zip(names, grid_items(ART('small.jpg'), 6, 3, keep_all=True)): _SRC[name] = im
    return _SRC[k]


def fit(im, W, H, scale=1.0, rot=0.0, sx=1.0, sy=1.0, dx=0.0, dy=0.0, hard=True, outline=True):
    """잘라낸 그림을 W×H(시트 픽셀) 칸에 맞추고, 프레임마다 늘이기·회전·흔들기"""
    w, h = im.size; s = min((W - 4) / w, (H - 4) / h) * scale
    big = im.resize((max(1, round(w * s * sx * 2)), max(1, round(h * s * sy * 2))), Image.LANCZOS)
    if rot: big = big.rotate(rot, Image.BICUBIC, expand=True)
    can = Image.new('RGBA', (W * 2, H * 2), (0, 0, 0, 0))
    can.alpha_composite(big, (round(W - big.size[0] / 2 + dx * 2), round(H - big.size[1] / 2 + dy * 2)))
    # 미리 곱한 색으로 줄여야 가장자리가 검게 번지지 않음
    a = np.asarray(can).astype(np.float32); al = a[..., 3:] / 255
    pm = np.dstack([a[..., :3] * al, al * 255]).astype(np.uint8)
    sm = np.asarray(Image.fromarray(pm, 'RGBA').resize((W, H), Image.BOX)).astype(np.float32)
    al = sm[..., 3] / 255; rgb = sm[..., :3] / np.maximum(al[..., None], 1e-3)
    if hard:
        al = (al > 0.42).astype(np.float32)
        if outline:   # 밝은 그림 위에서도 보이도록 1픽셀 어두운 테두리
            m = al > 0; o = np.zeros_like(m)
            for ddy, ddx in ((1, 0), (-1, 0), (0, 1), (0, -1)): o |= np.roll(np.roll(m, ddy, 0), ddx, 1)
            o &= ~m; rgb[o] = (18, 10, 24); al = np.where(o, 0.85, al)
    return Image.fromarray(np.dstack([np.clip(rgb, 0, 255), al * 255]).astype(np.uint8), 'RGBA')


def frames(k, W, H, n, kind, **kw):
    im = cut(k, soft=kw.pop('soft', False)); out = []
    for f in range(n):
        t = f / n; u = math.sin(t * TAU)
        if kind == 'breathe': o = dict(sx=1 + 0.05 * u, sy=1 - 0.05 * u)
        elif kind == 'bob': o = dict(dy=1.5 * u * SC / 3, sy=1 + 0.03 * math.cos(t * TAU))
        elif kind == 'wiggle': o = dict(rot=6 * u, sx=1 + 0.03 * math.cos(t * TAU * 2))
        elif kind == 'flap': o = dict(dy=2 * u, sy=1 - 0.06 * abs(u))
        elif kind == 'spin': o = dict(rot=-t * 72)   # 별(5갈래)이 한 바퀴 돌면 처음 모양과 겹침
        elif kind == 'swim': o = dict(sy=1 + 0.08 * u, dy=-2 * u)
        else: o = {}
        o.update(kw); out.append(fit(im, W, H, **o))
    return out


def item_frames(k):
    im = cut(k, soft=True); out = []
    for f in range(8):
        u = math.sin(f / 8 * TAU)
        fr = fit(im, 14 * SC, 14 * SC, dy=u * 1.5, outline=False)
        if f < 2:   # 반짝
            d = np.asarray(fr).copy(); cx, cy = 11, 10 + int(u * 1.5)
            for r in range(-3, 4): d[cy, cx + r] = (255, 255, 255, 255); d[cy + r, cx] = (255, 255, 255, 255)
            fr = Image.fromarray(d, 'RGBA')
        out.append(fr)
    return out


def boom_frames():
    ims = [cut(f'x{k}', soft=True) for k in range(4)]; out = []
    plan = [(0, .45), (0, .75), (1, .7), (1, .95), (2, .9), (2, 1.0), (3, .95), (3, 1.0)]
    for f, (k, s) in enumerate(plan):
        fr = fit(ims[k], 32 * SC, 32 * SC, scale=s, outline=False)
        if f == 7: d = np.asarray(fr).copy(); d[..., 3] = d[..., 3] // 2; fr = Image.fromarray(d, 'RGBA')
        out.append(fr)
    return out


def pop_frames():
    im0, im1 = cut('x0', soft=True), cut('x1', soft=True); out = []
    for f, (im, s) in enumerate([(im0, .4), (im0, .8), (im0, 1.0), (im1, .8), (im1, 1.0), (im1, .9)]):
        fr = fit(im, 16 * SC, 16 * SC, scale=s, outline=False)
        if f == 5: d = np.asarray(fr).copy(); d[..., 3] = d[..., 3] // 2; fr = Image.fromarray(d, 'RGBA')
        out.append(fr)
    return out


def sparkle_frames():
    im = cut('x0', soft=True)
    return [fit(im, 9 * SC, 9 * SC, scale=s, rot=f * 15, outline=False) for f, s in enumerate([.35, .6, 1, .85, .6, .35])]


def probe_frames(drawing):
    im = cut('probe'); out = []
    if drawing:   # 선을 긋는 중: 분사 불꽃을 주황으로
        d = np.asarray(im).copy(); a = d[..., :3].astype(int)
        flame = (a[..., 0] > 150) & (a[..., 2] > 150) & (a[..., 1] < 150)
        d[flame, 0] = 255; d[flame, 1] = np.clip(a[flame, 1] + 90, 0, 255); d[flame, 2] = 60
        im = Image.fromarray(d, 'RGBA')
    for f in range(8):
        out.append(fit(im, 16 * SC, 16 * SC, dy=(f % 2) * 0.6, sx=1 + 0.04 * (f % 2)))
    return out


def scale_up(frs):
    return [Image.fromarray(np.asarray(p.img())).resize((p.w * SC, p.h * SC), Image.NEAREST) for p in frs]


def build_sprites():
    import sprites as S
    rows = []
    rows.append(('probe', probe_frames(False)))
    rows.append(('probe_draw', probe_frames(True)))
    BK = {'phage': 'bob', 'amoeba': 'breathe', 'jelly': 'swim', 'paramecium': 'wiggle',
          'hornet': 'flap', 'spider': 'breathe', 'cancer': 'breathe', 'plasmodium': 'breathe'}
    for k, kind in BK.items(): rows.append(('b_' + k, frames(k, 32 * SC, 32 * SC, 6, kind, soft=k == 'jelly')))
    RK = {'bacillus': 'wiggle', 'krill': 'wiggle', 'mosquito': 'flap', 'coccus': 'spin'}
    for k, kind in RK.items(): rows.append(('r_' + k, frames(k, 14 * SC, 14 * SC, 4, kind)))
    PK = {'ribosome': 'breathe', 'starfish': 'spin', 'ant': 'wiggle', 'wbc': 'breathe'}
    for k, kind in PK.items(): rows.append(('s_' + k, frames(k, 12 * SC, 12 * SC, 4, kind)))
    for k in S.ITEMS: rows.append(('i_' + k, item_frames(k)))
    rows.append(('sting', scale_up(S.spr(7, 7, S.bullet_sting, 1))))
    rows.append(('spore', scale_up(S.spr(7, 7, S.bullet_spore, 1))))
    rows.append(('boom', boom_frames()))
    rows.append(('pop', pop_frames()))
    rows.append(('sparkle', sparkle_frames()))
    rows.append(('fuse', scale_up(S.spr(7, 7, S.fx_fuse, 4, outline=False))))
    Wd = max(sum(p.size[0] for p in fr) for _, fr in rows)
    Ht = sum(fr[0].size[1] + 1 for _, fr in rows)
    sheet = Image.new('RGBA', (Wd, Ht), (0, 0, 0, 0)); meta = {'s': SC}; y = 0
    for name, fr in rows:
        x = 0
        for p in fr: sheet.paste(p, (x, y)); x += p.size[0]
        meta[name] = dict(x=0, y=y, w=fr[0].size[0], h=fr[0].size[1], n=len(fr))
        y += fr[0].size[1] + 1
    sheet.save(os.path.join(OUT, 'sprites.png'), optimize=True)
    json.dump(meta, open(os.path.join(OUT, 'sprites.json'), 'w'))
    return sheet.size


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    build_pictures()
    print('pictures 16, sprites', build_sprites(), '->', OUT)
