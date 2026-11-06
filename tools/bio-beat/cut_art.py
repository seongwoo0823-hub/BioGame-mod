# 바이오 비트 곡 그림: Glif로 만든 4×4 시트(tools/bio-beat/art/)를 곡마다 잘라 games/bio-beat/art/에 저장
#   art/covers-1~3.jpg → cover/<곡id>.jpg (480×480 앨범 커버)
#   art/mv-1~3.jpg     → mv/<곡id>.jpg    (1024×576 뮤직비디오 장면)
# 시트 칸 순서 = bio-beat.html의 SONGS 순서 (한 장에 16곡)
#   python3 cut_art.py
import os, re, sys
import numpy as np
from PIL import Image, ImageFilter
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '../..')
src = open(os.path.join(ROOT, 'games/bio-beat.html'), encoding='utf-8').read()
a = src.index('const SONGS=['); b = src.index('\n];', a)
IDS = re.findall(r"\{id:'([a-z0-9]+)'", src[a:b])
OUT = os.path.join(ROOT, 'games/bio-beat/art')


def cells(im):
    """검은 칸 사이 줄을 찾아 4×4 칸 경계를 정함 (못 찾으면 똑같이 4등분)"""
    g = np.asarray(im.convert('L')).astype(float)
    def bounds(prof, n):
        L = len(prof); step = L / 4; cuts = [0]
        for k in range(1, 4):
            lo, hi = int(step * k - step * 0.12), int(step * k + step * 0.12)
            seg = prof[lo:hi]; cuts.append(lo + int(np.argmin(seg)))
        cuts.append(L); return cuts
    xs = bounds(g.mean(axis=0), 4); ys = bounds(g.mean(axis=1), 4)
    out = []
    for r in range(4):
        for c in range(4):
            x0, x1, y0, y1 = xs[c], xs[c + 1], ys[r], ys[r + 1]
            ins = max(4, int((x1 - x0) * 0.025))   # 칸 사이 검은 줄 빼기
            out.append(im.crop((x0 + ins, y0 + ins, x1 - ins, y1 - ins)))
    return out


def run(kind, size, ratio):
    os.makedirs(os.path.join(OUT, kind), exist_ok=True)
    tiles = []
    for k in (1, 2, 3):
        p = os.path.join(HERE, 'art', f'{"covers" if kind == "cover" else "mv"}-{k}.jpg')
        tiles += cells(Image.open(p).convert('RGB'))
    for i, sid in enumerate(IDS):
        t = tiles[i]; w, h = t.size
        # 비율 맞추기 (가운데 기준)
        if w / h > ratio: nw = int(h * ratio); t = t.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
        else: nh = int(w / ratio); t = t.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh))
        t = t.resize(size, Image.LANCZOS).filter(ImageFilter.UnsharpMask(1.2, 50, 2))
        t.save(os.path.join(OUT, kind, sid + '.jpg'), quality=86)
    print(kind, len(IDS), 'songs from', len(tiles), 'tiles')


if __name__ == '__main__':
    run('cover', (480, 480), 1.0)
    run('mv', (1024, 576), 16 / 9)
