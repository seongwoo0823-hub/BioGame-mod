# 적 미리보기: 종류별 모든 프레임을 확대해 한 장으로
import os, sys, json
import numpy as np
from PIL import Image
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
D = os.path.join(ROOT, 'games', 'is-assets')
sheet = np.array(Image.open(os.path.join(D, 'foes.png')).convert('RGBA'))
meta = json.loads(open(os.path.join(D, 'foes.js')).read().split('=', 1)[1].strip().rstrip(';'))


def bgc(img, c=(58, 26, 52)):
    b = np.zeros(img.shape[:2] + (3,), np.uint8); b[:] = c; a = img[..., 3:4] / 255.0
    return (img[..., :3] * a + b * (1 - a)).astype(np.uint8)


def row(name, cw):
    m = meta[name]; cells = []
    for an, fr in m['A'].items():
        for (x, y) in fr:
            c = np.zeros((m['h'] + 4, cw, 4), np.uint8)
            f = sheet[y:y + m['h'], x:x + m['w']]; ox = (cw - m['w']) // 2
            c[2:2 + m['h'], ox:ox + m['w']] = f; cells.append(bgc(c))
    return np.concatenate(cells, 1)


if __name__ == '__main__':
    names = sys.argv[2].split(',') if len(sys.argv) > 2 else list(meta)
    cw = max(meta[n]['w'] for n in names) + 4
    rows = [row(n, cw) for n in names]; W = max(r.shape[1] for r in rows)
    rows = [np.concatenate([r, np.full((r.shape[0], W - r.shape[1], 3), 30, np.uint8)], 1) for r in rows]
    big = np.concatenate(rows, 0); z = int(sys.argv[3]) if len(sys.argv) > 3 else 4
    Image.fromarray(big).resize((big.shape[1] * z, big.shape[0] * z), Image.NEAREST).save(sys.argv[1])
