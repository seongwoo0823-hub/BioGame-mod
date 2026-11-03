# 미리보기: 몸 + 얼굴 + 총 팔을 게임과 같은 규칙으로 합성해 확대 시트/GIF로 저장
import os, sys, json, math
import numpy as np
from PIL import Image
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
D = os.path.join(ROOT, 'games', 'is-assets')
sheet = np.array(Image.open(os.path.join(D, 'neut.png')).convert('RGBA'))
meta = json.loads(open(os.path.join(D, 'neut.js')).read().split('=', 1)[1].rstrip().rstrip(';'))
CW, CHh = meta['cell']; OX, OY = meta['o']; AR = meta['arm']


def blit(dst, src, x, y):
    h, w = src.shape[:2]
    for i in range(h):
        yy = y + i
        if not 0 <= yy < dst.shape[0]: continue
        for j in range(w):
            xx = x + j
            if 0 <= xx < dst.shape[1] and src[i, j, 3] > 0: dst[yy, xx] = src[i, j]


def crop(x, y, w, h): return sheet[y:y + h, x:x + w]


def compose(anim, i, face='normal', aim=0, recoil=0, W=64, H=64, ox=32, oy=56):
    A = meta['A'][anim]; f = A['f'][i % len(A['f'])]
    can = np.zeros((H, W, 4), np.uint8)
    blit(can, crop(f[0], f[1], CW, CHh), ox - OX, oy - OY)
    if f[6]:
        fx, fy = meta['F'][face]; g = crop(fx, fy, 9, 7)
        blit(can, g, ox + f[4] + meta['FO'][0], oy + f[5] + meta['FO'][1])
    if f[7]:
        a = aim + (A['at'] or 0) * 57.3
        a = int(round(a / 15) * 15); a = max(-105, min(105, a))
        m = meta['ARM']['g%d_%d' % (recoil, a)]
        blit(can, crop(m[0], m[1], AR, AR), ox + f[2] - AR // 2, oy + f[3] - AR // 2)
    return can


def bg(img, c=(58, 26, 52)):
    b = np.zeros_like(img); b[..., :3] = c; b[..., 3] = 255
    a = img[..., 3:4] / 255.0
    out = (img[..., :3] * a + b[..., :3] * (1 - a)).astype(np.uint8)
    # 바닥선
    return out


if __name__ == '__main__':
    out = sys.argv[1]; Z = 4
    rows = []
    for name, A in meta['A'].items():
        fr = [bg(compose(name, i, face={'tired': 'tired', 'hurt': 'hurt', 'win': 'joy', 'grab': 'strain', 'melee': 'fierce', 'bored': 'blink'}.get(name, 'normal'))) for i in range(len(A['f']))]
        row = np.concatenate(fr, 1)
        if row.shape[1] < 64 * 16: row = np.concatenate([row, np.full((64, 64 * 16 - row.shape[1], 3), 30, np.uint8)], 1)
        rows.append(row)
    big = np.concatenate(rows, 0)
    Image.fromarray(big).resize((big.shape[1] * 2, big.shape[0] * 2), Image.NEAREST).save(out)
    # GIF들
    for name in sys.argv[2:]:
        A = meta['A'][name]; n = len(A['f'])
        ims = [Image.fromarray(bg(compose(name, i))).resize((64 * 6, 64 * 6), Image.NEAREST) for i in range(n)]
        ims[0].save(out.replace('.png', '_%s.gif' % name), save_all=True, append_images=ims[1:], duration=int(A['t'] * 1000 / 60), loop=0)
