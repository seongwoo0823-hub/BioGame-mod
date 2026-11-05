# 원화 시트(자홍색 #FF00FF 배경)에서 그림을 잘라 내는 공통 코드 — 바이오 타워·세포 개척단이 함께 씀
import numpy as np
from collections import deque
from PIL import Image


def key_magenta(path):
    """자홍색(#FF00FF) 배경을 투명하게: 순수 자홍과의 색 거리로 판단 (분홍·보라 그림은 거리가 멀어 남음)
    가장자리에 섞인 자홍 기운은 빼 줌"""
    a = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    d = np.sqrt((a[..., 0] - 255) ** 2 + a[..., 1] ** 2 + (a[..., 2] - 255) ** 2)
    al = np.clip((d - 95) / 45, 0, 1)
    edge = (al > 0) & (al < 1)
    for ch in (0, 2):   # 반투명 가장자리: 자홍을 빼고 남은 색으로
        a[edge, ch] = np.clip((a[edge, ch] - 255 * (1 - al[edge])) / np.maximum(al[edge], 0.2), 0, 255)
    return np.clip(a, 0, 255), al


def components(al, th=0.5, dil=2):
    m = al > th; d = m.copy()
    for dy in range(-dil, dil + 1):
        for dx in range(-dil, dil + 1): d |= np.roll(np.roll(m, dy, 0), dx, 1)
    H, W = d.shape; lab = np.zeros((H, W), np.int32); n = 0; boxes = {}
    for y, x in zip(*np.nonzero(d)):
        if lab[y, x]: continue
        n += 1; q = deque([(y, x)]); lab[y, x] = n; ys = []; xs = []
        while q:
            a_, b_ = q.popleft(); ys.append(a_); xs.append(b_)
            for c, e in ((a_ + 1, b_), (a_ - 1, b_), (a_, b_ + 1), (a_, b_ - 1)):
                if 0 <= c < H and 0 <= e < W and d[c, e] and not lab[c, e]: lab[c, e] = n; q.append((c, e))
        boxes[n] = (min(xs), min(ys), max(xs), max(ys), len(ys))
    return lab, boxes


def grid_items(path, cols, rows, keep_all=False):
    """격자 칸마다 가장 큰 덩어리(keep_all이면 칸 안의 큰 덩어리 모두)를 RGBA로 잘라 냄"""
    rgb, al = key_magenta(path); lab, boxes = components(al)
    H, W = al.shape; out = []
    for r in range(rows):
        for c in range(cols):
            x0, x1, y0, y1 = W * c / cols, W * (c + 1) / cols, H * r / rows, H * (r + 1) / rows
            ins = [n for n, b in boxes.items() if x0 <= (b[0] + b[2]) / 2 < x1 and y0 <= (b[1] + b[3]) / 2 < y1 and b[4] > 300]
            big = max(ins, key=lambda n: boxes[n][4])
            sel = [n for n in ins if boxes[n][4] > boxes[big][4] * 0.02] if keep_all else [big]
            bx = (min(boxes[n][0] for n in sel), min(boxes[n][1] for n in sel), max(boxes[n][2] for n in sel), max(boxes[n][3] for n in sel))
            sl = (slice(bx[1], bx[3] + 1), slice(bx[0], bx[2] + 1))
            m = np.isin(lab[sl], sel)
            out.append(Image.fromarray(np.dstack([rgb[sl], al[sl] * m * 255]).astype(np.uint8), 'RGBA'))
    return out
