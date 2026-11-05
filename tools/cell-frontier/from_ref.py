# 세포 개척단: 첨부 그림(ref/)에서 숨은 그림 16장과 스프라이트를 잘라 만듭니다.
#   python3 from_ref.py [출력 폴더]
#   ref/pictures.webp  액자 16개 (세포 → 식물 세포 → … → 눈 순서)
#   ref/sprites.webp   보스 8 · 작은 적 9(탐침 포함) · 아이템 5 · 폭발 4
# 스프라이트 시트는 화면 1픽셀을 3픽셀로 그린 고해상도(SC=3)이고, sprites.json의 "s"에 배율이 들어갑니다.
# 도화선·탄 같은 작은 효과와 덮개·세계 지도는 build.py(도트 직접 그리기)가 만든 것을 그대로 씁니다.
import sys, os, json, math
import numpy as np
from PIL import Image, ImageFilter
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '../../games/cell-frontier')
SC = 3
TAU = 2 * math.pi

# ---------------------------------------------------------------- 숨은 그림 16장 (320×240)
src = Image.open(os.path.join(HERE, 'ref/pictures.webp')).convert('RGB')
ROWS = [(8, 182), (197, 374), (387, 566)]
COLS = [[(13, 192), (213, 393), (419, 604), (630, 811), (831, 1012)],
        [(13, 193), (210, 391), (415, 608), (633, 814), (831, 1012)],
        [(12, 190), (206, 380), (386, 505), (508, 650), (657, 816), (835, 1012)]]
FRAME = 14   # 액자 두께


def smooth_rows(v, k):
    p = np.pad(v, ((k // 2, k // 2), (0, 0)), mode='edge')
    cs = np.cumsum(np.vstack([np.zeros((1, v.shape[1])), p]), axis=0)
    return (cs[k:] - cs[:-k]) / k


def fit_board(c):
    """정사각형·세로 그림을 4:3 판에 맞춤: 위아래는 20%까지 잘라내고, 남는 양옆은 가장자리 색으로 이어 칠함"""
    w, h = c.size
    s = max(240 / h, min(320 / w, 240 / h * 1.2))
    c = c.resize((round(w * s), round(h * s)), Image.LANCZOS); w, h = c.size
    if h > 240: c = c.crop((0, (h - 240) // 2, w, (h - 240) // 2 + 240))
    w = c.size[0]
    if w >= 320: return c.crop(((w - 320) // 2, 0, (w - 320) // 2 + 320, 240))
    a = np.asarray(c); pl = (320 - w) // 2; pr = 320 - w - pl
    full = np.pad(a, ((0, 0), (pl, pr), (0, 0)), mode='edge').astype(np.float32)
    L = smooth_rows(a[:, :6].mean(axis=1).astype(np.float32), 81)
    R = smooth_rows(a[:, -6:].mean(axis=1).astype(np.float32), 81)
    bg = full.copy()
    for x in range(pl): bg[:, x] = L * (0.75 + 0.25 * x / max(1, pl))
    for x in range(pr): bg[:, pl + w + x] = R * (1 - 0.25 * x / max(1, pr))
    rng = np.random.default_rng(w)
    for _ in range((pl + pr) // 3):   # 반짝이는 먼지
        x = int(rng.integers(0, pl + pr)); x = x if x < pl else x + w; y = int(rng.integers(2, 238))
        bg[y, x] = np.minimum(255, bg[y, x] + 90)
    m = np.zeros((240, 320), np.float32); m[:, pl:pl + w] = 1
    for k in range(10):
        m[:, pl + k] = np.minimum(m[:, pl + k], k / 10); m[:, pl + w - 1 - k] = np.minimum(m[:, pl + w - 1 - k], k / 10)
    out = bg * (1 - m[..., None]) + full * m[..., None]
    return Image.fromarray(out.astype(np.uint8))


def build_pictures():
    i = 0
    for (y0, y1), row in zip(ROWS, COLS):
        for x0, x1 in row:
            c = src.crop((x0 + FRAME, y0 + FRAME, x1 - FRAME, y1 - FRAME))
            im = fit_board(c).filter(ImageFilter.UnsharpMask(1.2, 60, 2))
            # 256색 팔레트로 줄이기: 도트 느낌이 살고 파일도 1/3 크기
            im.quantize(256, method=Image.MEDIANCUT, dither=Image.FLOYDSTEINBERG).save(os.path.join(OUT, f'p{i:02d}.png'), optimize=True)
            i += 1


# ---------------------------------------------------------------- 스프라이트 잘라내기
ssrc = np.asarray(Image.open(os.path.join(HERE, 'ref/sprites.webp')).convert('RGB')).astype(np.float32)
BG = np.array([16, 4, 14], np.float32)
BOX = {   # (x0, y0, x1, y1) 포함 범위
    'phage': (29, 7, 217, 198), 'amoeba': (248, 21, 419, 183), 'jelly': (461, 10, 707, 242), 'paramecium': (727, 22, 1001, 177),
    'hornet': (14, 197, 233, 371), 'spider': (263, 215, 509, 372), 'cancer': (549, 197, 743, 365), 'plasmodium': (783, 203, 985, 366),
    'probe': (12, 390, 147, 446), 'bacillus': (173, 376, 256, 460), 'krill': (284, 382, 369, 455), 'mosquito': (402, 389, 461, 445),
    'coccus': (490, 378, 569, 458), 'ribosome': (597, 380, 674, 457), 'starfish': (701, 380, 781, 455), 'ant': (811, 389, 892, 448),
    'wbc': (919, 380, 992, 454),
    'speed': (37, 469, 105, 561), 'shield': (134, 469, 202, 562), 'freeze': (231, 469, 300, 561), 'clock': (331, 470, 395, 560),
    'life': (426, 470, 493, 561),
    'x0': (578, 483, 642, 546), 'x1': (671, 470, 764, 561), 'x2': (782, 463, 882, 565), 'x3': (894, 458, 1006, 567),
}


def _labels():
    """배경이 아닌 곳을 덩어리별로 번호 매김 (상자가 겹쳐도 이웃 그림이 섞이지 않게)"""
    from collections import deque
    m = np.abs(ssrc - BG).max(axis=2) > 44
    d = m.copy()
    for dy in range(-6, 7, 2):
        for dx in range(-6, 7, 2): d |= np.roll(np.roll(m, dy, 0), dx, 1)
    H, W = d.shape; lab = np.zeros((H, W), np.int32); n = 0
    for y, x in zip(*np.nonzero(d)):
        if lab[y, x]: continue
        n += 1; q = deque([(y, x)]); lab[y, x] = n
        while q:
            a, b = q.popleft()
            for c, e in ((a + 1, b), (a - 1, b), (a, b + 1), (a, b - 1)):
                if 0 <= c < H and 0 <= e < W and d[c, e] and not lab[c, e]: lab[c, e] = n; q.append((c, e))
    return lab


LAB = _labels()


def cut(k, pad=4, soft=False):
    x0, y0, x1, y1 = BOX[k]
    sl = (slice(max(0, y0 - pad), y1 + pad + 1), slice(max(0, x0 - pad), x1 + pad + 1))
    a = ssrc[sl]; lb = LAB[sl]
    ids, cnt = np.unique(lb[lb > 0], return_counts=True)
    keep = lb == ids[cnt.argmax()]
    d = np.abs(a - BG).max(axis=2)
    al = np.clip((d - 22) / (40 if soft else 26), 0, 1) * keep
    # 배경 빛번짐 제거: 알파로 나눠 원래 색을 되살림
    rgb = np.clip((a - BG * (1 - al[..., None])) / np.maximum(al[..., None], 1e-3), 0, 255)
    return Image.fromarray(np.dstack([rgb, al * 255]).astype(np.uint8), 'RGBA')


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
