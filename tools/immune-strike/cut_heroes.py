# 면역 특공대 주인공 시트(tools/immune-strike/art/heroes-1.png, Glif 4×4) → 도트 스프라이트
#   줄 = 호중구·대식세포·킬러 T세포·NK세포, 칸 = 서기·달리기·점프·사격
#   자홍색 배경을 지우고, 한 칸을 SIZE×SIZE 도트로 줄인 뒤 색 수를 줄여 games/immune-strike/heroes.png 로 저장
#   python3 cut_heroes.py [SIZE]
import os, sys
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '../../games/immune-strike')
SIZE = int(sys.argv[1]) if len(sys.argv) > 1 else 64

def key(im):
    a = np.asarray(im.convert('RGB')).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    # 자홍색 배경 + 가장자리에 번진 자홍 기운까지
    bg = (r > 110) & (b > 110) & (g < 0.62 * np.minimum(r, b)) & (abs(r - b) < 110)
    rgba = np.dstack([a, np.where(bg, 0, 255)]).astype(np.uint8)
    return Image.fromarray(rgba, 'RGBA')

def row_palette(cells):
    """줄 네 칸의 불투명 픽셀로 팔레트(26색) 만들기"""
    px = []
    for c in cells:
        a = np.asarray(c); m = a[..., 3] > 128
        px.append(a[m][:, :3])
    px = np.concatenate(px)[::7]
    im = Image.fromarray(px.reshape(1, -1, 3).astype(np.uint8), 'RGB')
    return im.quantize(colors=26, method=Image.MEDIANCUT, dither=Image.NONE)

def mode_down(t, pal, n):
    a = np.asarray(t); al = a[..., 3] > 128
    idx = np.asarray(t.convert('RGB').quantize(palette=pal, dither=Image.NONE))
    P = np.array(pal.getpalette()[:26 * 3]).reshape(-1, 3)
    H, W = idx.shape; out = np.zeros((n, n, 4), np.uint8)
    ys = np.linspace(0, H, n + 1).astype(int); xs = np.linspace(0, W, n + 1).astype(int)
    for j in range(n):
        for i in range(n):
            blk = idx[ys[j]:ys[j + 1], xs[i]:xs[i + 1]]; m = al[ys[j]:ys[j + 1], xs[i]:xs[i + 1]]
            if m.mean() < 0.45: continue
            v = np.bincount(blk[m].ravel(), minlength=26)
            # 어두운 외곽선 색은 조금만 있어도 살림
            lum = P.sum(1)
            dark = np.where(lum < 150)[0]
            if dark.size and v[dark].sum() > 0.3 * m.sum(): k = dark[np.argmax(v[dark])]
            else: k = int(np.argmax(v))
            out[j, i, :3] = P[k]; out[j, i, 3] = 255
    # 바깥쪽 1도트 외곽선
    o = out[..., 3] > 0; e = np.zeros_like(o)
    e[1:] |= o[:-1]; e[:-1] |= o[1:]; e[:, 1:] |= o[:, :-1]; e[:, :-1] |= o[:, 1:]
    e &= ~o; out[e] = (22, 16, 34, 255)
    return Image.fromarray(out, 'RGBA')

def main():
    src = key(Image.open(os.path.join(HERE, 'art/heroes-1.png')))
    W, H = src.size; cw, ch = W // 4, H // 4
    cells = [[src.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch)) for c in range(4)] for r in range(4)]
    # 줄마다 같은 크기로 줄이려고 네 칸 내용 범위를 합침 (발끝은 아래에 맞춤)
    out = Image.new('RGBA', (SIZE * 4, SIZE * 4), (0, 0, 0, 0))
    for r in range(4):
        boxes = [c.getchannel('A').point(lambda v: 255 if v > 128 else 0).getbbox() for c in cells[r]]
        x0 = min(b[0] for b in boxes); y0 = min(b[1] for b in boxes); x1 = max(b[2] for b in boxes); y1 = max(b[3] for b in boxes)
        side = max(x1 - x0, y1 - y0) + 8
        pal = row_palette(cells[r])
        for c in range(4):
            t = cells[r][c]
            cx = (x0 + x1) // 2; by = y1 + 4
            box = (cx - side // 2, by - side, cx - side // 2 + side, by)
            t = t.crop(box)
            # 줄이기: 원본을 줄 팔레트로 먼저 줄인 뒤, 도트 한 칸마다 가장 많은 색을 고름 (흐려지지 않게)
            q = mode_down(t, pal, SIZE)
            out.paste(q, (c * SIZE, r * SIZE))
    os.makedirs(OUT, exist_ok=True)
    out.save(os.path.join(OUT, 'heroes.png'))
    prev = Image.new('RGBA', out.size, (24, 30, 52, 255)); prev.alpha_composite(out)
    prev.resize((out.width * 5, out.height * 5), Image.NEAREST).save(os.path.join(HERE, 'art/heroes-preview.png'))
    print('heroes.png', out.size)

if __name__ == '__main__':
    main()
