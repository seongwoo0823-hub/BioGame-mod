# 바이오 타워 에셋: art/ 폴더의 새 원화(Glif로 생성, 자홍색 배경)에서 조각·섬·배경을 잘라 만듭니다.
#   python3 from_art.py [출력 폴더]
#   art/animals.jpg  동물 30종 (6×5)        art/bio.jpg      세포·생물 18종 (6×3)
#   art/sky-island.jpg 떠 있는 큰 섬          art/islets.jpg   작은 섬 4개
#   art/clouds.jpg   흰 구름 5 · 노을 구름 5   art/landscape.jpg 배경 풍경
# 그림은 화면 1픽셀을 2픽셀로 담은 고해상도(RES=2)이고, 충돌 모양은 1배 크기로 계산합니다.
import sys, os, json
import numpy as np
from collections import deque
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from pieces import collision
from from_art_common import key_magenta, components, grid_items
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '../../games/bio-tower')
RES = 2
ART = lambda f: os.path.join(HERE, 'art', f)

# id, 이름, 긴 변(화면 픽셀), 밀도, 설명
ANIMALS = [
    [('turtle', '바다거북', 60, 1.4, '바다거북은 수십 년 뒤에도 자기가 태어난 해변으로 돌아와 알을 낳아요.'),
     ('whale', '대왕고래', 104, 1.6, '대왕고래는 지구에 살았던 동물 가운데 가장 커요. 심장만 해도 자동차만 해요.'),
     ('elephant', '코끼리', 80, 1.6, '코끼리 코는 윗입술과 코가 합쳐진 것으로, 근육이 4만 개나 돼요.'),
     ('giraffe', '기린', 84, 1.1, '기린도 사람처럼 목뼈가 7개예요. 하나하나가 아주 길 뿐이에요.'),
     ('rhino', '코뿔소', 74, 1.6, '코뿔소의 뿔은 뼈가 아니라 머리카락·손톱과 같은 케라틴으로 되어 있어요.'),
     ('hippo', '하마', 74, 1.6, '하마 피부에서는 붉은 땀이 나와 햇빛과 세균을 막아 줘요.')],
    [('bear', '불곰', 72, 1.5, '불곰은 겨울잠을 자는 동안 몇 달 동안 먹지도 싸지도 않아요.'),
     ('lion', '사자', 70, 1.3, '사자는 고양잇과 동물 가운데 유일하게 무리(프라이드)를 지어 살아요.'),
     ('tiger', '호랑이', 74, 1.3, '호랑이 줄무늬는 털뿐 아니라 피부에도 새겨져 있어요.'),
     ('zebra', '얼룩말', 66, 1.2, '얼룩말 줄무늬는 사람 지문처럼 한 마리 한 마리 모두 달라요.'),
     ('horse', '말', 66, 1.2, '말은 다리가 길어 서서도 잠깐씩 잘 수 있어요.'),
     ('cow', '젖소', 68, 1.4, '소의 위는 4개의 방으로 나뉘어 풀을 여러 번 되새김질해요.')],
    [('pig', '돼지', 58, 1.2, '돼지는 땀샘이 거의 없어서 진흙에 뒹굴며 몸을 식혀요.'),
     ('wolf', '늑대', 60, 1.0, '늑대는 무리끼리 울음소리로 위치를 알려요. 개의 조상이기도 해요.'),
     ('dog', '개', 54, 1.0, '개의 코에는 사람보다 수십 배 많은 냄새 세포가 있어요.'),
     ('cat', '고양이', 54, 0.9, '고양이는 수염으로 바람의 흐름과 좁은 틈의 폭을 느껴요.'),
     ('rabbit', '토끼', 40, 0.8, '토끼 이빨은 평생 자라서 계속 풀을 갉아 닳게 해야 해요.'),
     ('fox', '여우', 56, 0.9, '여우는 지구 자기장을 느껴 눈 밑의 먹이를 덮친다는 연구가 있어요.')],
    [('mouse', '생쥐', 40, 0.7, '생쥐는 사람과 유전자가 많이 닮아 실험 동물로 널리 쓰여요.'),
     ('owl', '부엉이', 40, 0.7, '부엉이는 눈알을 굴리지 못하는 대신 목을 270°까지 돌려요.'),
     ('eagle', '흰머리수리', 46, 0.8, '독수리는 사람보다 4~5배 멀리 있는 것을 또렷하게 봐요.'),
     ('penguin', '황제펭귄', 44, 1.1, '황제펭귄 아빠는 영하 40°C에서 두 달 동안 알을 발 위에 품어요.'),
     ('frog', '청개구리', 42, 0.9, '개구리는 폐뿐 아니라 촉촉한 피부로도 숨을 쉬어요.'),
     ('lizard', '도마뱀', 56, 0.8, '도마뱀은 위험하면 꼬리를 끊고 달아나요. 꼬리는 다시 자라요.')],
    [('snake', '뱀', 46, 1.0, '뱀은 턱뼈가 느슨하게 이어져 자기 머리보다 큰 먹이도 삼켜요.'),
     ('tarantula', '타란툴라', 50, 0.6, '타란툴라는 허물을 벗을 때 잃었던 다리도 다시 자라나요.'),
     ('ant', '개미', 44, 0.6, '개미는 몸무게의 수십 배나 되는 물건을 들어 옮겨요.'),
     ('bee', '꿀벌', 44, 0.6, '꿀벌은 8자 춤으로 꽃이 있는 방향과 거리를 동료에게 알려요.'),
     ('beetle', '장수풍뎅이', 50, 0.9, '장수풍뎅이는 몸무게의 수백 배를 끌 만큼 힘이 세요.'),
     ('clownfish', '흰동가리', 46, 0.8, '흰동가리는 말미잘의 독침 사이에 숨어 살며 서로 돕는 공생을 해요.')],
]
BIO = [
    [('rbc', '적혈구', 44, 0.8, '적혈구는 핵이 없는 오목한 원반 모양이라 산소를 많이 실어 날라요.'),
     ('wbc', '백혈구', 42, 0.8, '백혈구는 몸에 들어온 세균을 찾아가 삼켜 없애는 면역 세포예요.'),
     ('chloroplast', '엽록체', 48, 0.9, '엽록체는 빛 에너지로 물과 이산화탄소에서 포도당을 만들어요(광합성).'),
     ('mito', '미토콘드리아', 52, 1.0, '미토콘드리아는 세포의 발전소! 세포 호흡으로 ATP를 만들어요.'),
     ('dna', 'DNA', 58, 0.9, 'DNA는 두 가닥이 꼬인 이중 나선이고, A-T, G-C 염기가 짝을 지어요.'),
     ('phage', '박테리오파지', 50, 0.8, '박테리오파지는 세균만 감염시키는 바이러스예요. 다리로 세균에 달라붙어요.')],
    [('jelly', '해파리', 46, 0.6, '해파리 몸의 95% 이상은 물이에요. 뇌도 심장도 없어요.'),
     ('starfish', '불가사리', 46, 0.9, '불가사리는 팔이 잘려도 다시 자라는 재생 능력이 있어요.'),
     ('egg', '알', 34, 1.0, '알껍데기에는 작은 구멍이 수천 개 있어 안의 배아가 숨을 쉬어요.'),
     ('neuron', '뉴런', 56, 0.7, '뉴런은 전기 신호로 정보를 전달하는 신경 세포예요.'),
     ('amoeba', '아메바', 48, 0.8, '아메바는 몸 모양을 바꾸는 헛발(위족)로 움직이고 먹이를 감싸요.'),
     ('paramecium', '짚신벌레', 52, 0.8, '짚신벌레는 몸 표면의 섬모를 노처럼 저어 헤엄쳐요.')],
    [('tardigrade', '물곰', 46, 0.9, '물곰(완보동물)은 우주 공간의 진공과 방사선에서도 살아남아요.'),
     ('mushroom', '광대버섯', 46, 0.8, '버섯은 식물이 아니라 균류예요. 땅속 균사가 진짜 몸이에요.'),
     ('planaria', '플라나리아', 52, 0.7, '플라나리아는 몸을 잘라도 조각마다 완전한 개체로 다시 자라요.'),
     ('heart', '심장', 44, 1.2, '심장은 하루에 약 10만 번 뛰어 온몸에 피를 보내요.'),
     ('coral', '산호', 48, 1.1, '산호는 식물처럼 보이지만 작은 폴립이 모인 동물이에요.'),
     ('trilobite', '삼엽충', 46, 1.3, '삼엽충은 약 2억 7천만 년 동안 바다에 살았던 고생대 절지동물이에요.')],
]


def shrink(im, w, h, hard=True):
    """미리 곱한 색으로 줄이고, 알파를 또렷하게 잘라 도트 그림처럼"""
    a = np.asarray(im).astype(np.float32); al = a[..., 3:] / 255
    pm = Image.fromarray(np.dstack([a[..., :3] * al, al * 255]).astype(np.uint8), 'RGBA').resize((w, h), Image.LANCZOS if not hard else Image.BOX)
    s = np.asarray(pm).astype(np.float32); al = s[..., 3] / 255
    rgb = np.clip(s[..., :3] / np.maximum(al[..., None], 1e-3), 0, 255)
    if hard: al = (al > 0.45).astype(np.float32)
    return Image.fromarray(np.dstack([rgb, al * 255]).astype(np.uint8), 'RGBA')


def outline(im, col=(26, 22, 34)):
    d = np.asarray(im).copy(); m = d[..., 3] > 0; o = np.zeros_like(m)
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)): o |= np.roll(np.roll(m, dy, 0), dx, 1)
    o &= ~m; d[o] = col + (255,)
    return Image.fromarray(d, 'RGBA')


def _shift(m, dy, dx):
    o = np.zeros_like(m); H, W = m.shape
    o[max(0, dy):H + min(0, dy), max(0, dx):W + min(0, dx)] = m[max(0, -dy):H + min(0, -dy), max(0, -dx):W + min(0, -dx)]
    return o


def solid_parts(m, cx, cy):
    """충돌 모양: 다리 사이 같은 좁은 틈은 메우고(닫힘 연산) 굵은 띠로 잘라 조각 수를 줄임.
    조각이 수십 개면 바닥에 닿을 때 덜덜 떨며 미끄러지므로, 12개 안쪽이 되도록 띠를 키움"""
    r = 3; p = np.pad(m, r + 1)
    d = p.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if dy * dy + dx * dx <= r * r: d |= _shift(p, dy, dx)
    e = d.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if dy * dy + dx * dx <= r * r: e &= _shift(d, dy, dx)
    c = e[r + 1:-(r + 1), r + 1:-(r + 1)] | m
    for band in (6, 8, 10, 12, 16, 20):
        parts = [q for q in collision(c, cx, cy, band=band) if abs((q[1][0] - q[0][0]) + (q[2][0] - q[3][0])) * (q[2][1] - q[0][1]) / 2 >= 6]
        if len(parts) <= 12: break
    return parts


def despill(im, band=5):
    """자홍 배경에서 오려 낸 가장자리의 분홍 기운 없애기:
    가장자리 띠(band 픽셀) 안에서 자홍 기운(R·B가 G보다 높음)이 강하면 지우고, 약하면 색만 빼 줌. 마지막에 1픽셀 깎음"""
    a = np.asarray(im).astype(np.float32).copy(); al = a[..., 3] > 127
    near = ~al
    for _ in range(band):
        n = near.copy(); n[1:] |= near[:-1]; n[:-1] |= near[1:]; n[:, 1:] |= near[:, :-1]; n[:, :-1] |= near[:, 1:]; near = n
    edge = al & near
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    t = np.minimum(r, b) - g
    kill = edge & (t > 38)
    soft = edge & (t > 8) & ~kill
    a[kill, 3] = 0
    for ch in (0, 2): a[soft, ch] = np.maximum(g[soft], a[soft, ch] - t[soft] * .9)
    m = a[..., 3] > 127                       # 1픽셀 깎기
    e = m.copy(); e[1:] &= m[:-1]; e[:-1] &= m[1:]; e[:, 1:] &= m[:, :-1]; e[:, :-1] &= m[:, 1:]
    a[..., 3] = np.where(e, a[..., 3], 0)
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA')


SCALE = 1.5   # 조각(동물·생물) 크기 배율 (섬·땅은 그대로)


def build_pieces():
    defs = [d for row in ANIMALS for d in row] + [d for row in BIO for d in row]
    items = list(zip(defs, grid_items(ART('animals.jpg'), 6, 5) + grid_items(ART('bio.jpg'), 6, 3)))
    ims = []; meta = {}
    for (pid, name, L, dens, fact), im in items:
        im = despill(im)
        bb = im.getbbox(); im = im.crop(bb); w, h = im.size; s = L * SCALE / max(w, h)
        W1, H1 = max(6, round(w * s)), max(6, round(h * s))
        can = Image.new('RGBA', ((W1 + 2) * RES, (H1 + 2) * RES), (0, 0, 0, 0))
        can.paste(shrink(im, W1 * RES, H1 * RES), (RES, RES)); hi = outline(can)   # 고해상도 그림 + 1px 테두리
        lo = np.asarray(shrink(im, W1, H1))[..., 3] > 0   # 충돌용 1배 모양
        pad = np.zeros((H1 + 2, W1 + 2), bool); pad[1:-1, 1:-1] = lo
        ys, xs = np.where(pad); cx, cy = (xs.min() + xs.max() + 1) / 2, (ys.min() + ys.max() + 1) / 2
        parts = solid_parts(pad, cx, cy)
        meta[pid] = dict(name=name, w=W1 + 2, h=H1 + 2, ox=round(cx, 1), oy=round(cy, 1), dens=dens, fact=fact, parts=parts)
        ims.append((pid, hi))
    x = y = rowh = 0; SW = 1024
    for pid, p in ims:
        if x + p.size[0] > SW: x = 0; y += rowh + 1; rowh = 0
        meta[pid].update(sx=x, sy=y, sw=p.size[0], sh=p.size[1]); x += p.size[0] + 1; rowh = max(rowh, p.size[1])
    sheet = Image.new('RGBA', (SW, y + rowh + 1), (0, 0, 0, 0))
    for pid, p in ims: sheet.paste(p, (meta[pid]['sx'], meta[pid]['sy']))
    sheet.save(os.path.join(OUT, 'pieces.png'), optimize=True)
    json.dump({'res': RES, 'pieces': meta}, open(os.path.join(OUT, 'pieces.json'), 'w'), ensure_ascii=False)
    # 플레이어 얼굴 4개 (적혈구 · 엽록체 · 뉴런 · 짚신벌레) 64×64
    sel = {d[0]: im for d, im in items}
    fs = Image.new('RGBA', (64 * 4, 64), (0, 0, 0, 0))
    for i, k in enumerate(['rbc', 'chloroplast', 'neuron', 'paramecium']):
        im = sel[k].crop(sel[k].getbbox()); w, h = im.size; s = 58 / max(w, h)
        f = outline(shrink(im, max(1, round(w * s)), max(1, round(h * s))))
        fs.paste(f, (i * 64 + (64 - f.size[0]) // 2, (64 - f.size[1]) // 2), f)
    fs.save(os.path.join(OUT, 'faces.png'), optimize=True)
    return len(meta), sheet.size


def build_world():
    # 큰 섬: 잔디 윗면이 가장 넓은 줄(원본 y≈420)이 땅 높이, 잔디 폭(≈1665px)이 화면 200px
    rgb, al = key_magenta(ART('sky-island.jpg')); lab, boxes = components(al, dil=3)
    big = sorted(boxes, key=lambda n: -boxes[n][4])
    sel = [n for n in big if boxes[n][4] > boxes[big[0]][4] * 0.003]   # 물보라 점들도 포함
    m = np.isin(lab, sel) & (al > 0)
    ys, xs = np.nonzero(m); x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    isl = Image.fromarray(np.dstack([rgb, al * m * 255]).astype(np.uint8)[y0:y1 + 1, x0:x1 + 1], 'RGBA')
    s = 200 / 1665; W1, H1 = round(isl.size[0] * s), round(isl.size[1] * s)
    shrink(isl, W1 * RES, H1 * RES, hard=False).save(os.path.join(OUT, 'island.png'), optimize=True)
    ground = round((420 - y0) * s, 1); gx = round(((190 + 1855) / 2 - x0) * s, 1)   # 땅 높이, 잔디 가운데 x
    # 작은 섬 4개
    row = []
    for im in grid_items(ART('islets.jpg'), 4, 1, keep_all=True):
        row.append(shrink(im, max(1, round(im.size[0] * 96 / im.size[1])), 96, hard=False))
    sheet = Image.new('RGBA', (sum(r.size[0] + 1 for r in row), 96), (0, 0, 0, 0)); x = 0; islets = []
    for r in row: sheet.paste(r, (x, 0)); islets.append([x, r.size[0]]); x += r.size[0] + 1
    sheet.save(os.path.join(OUT, 'islets.png'), optimize=True)
    # 구름 10개 (흰 5 · 노을 5)
    cl = []
    for im in grid_items(ART('clouds.jpg'), 5, 2):
        k = min(1, 180 / im.size[0]); cl.append(shrink(im, round(im.size[0] * k), round(im.size[1] * k), hard=False))
    sheet = Image.new('RGBA', (sum(c.size[0] + 1 for c in cl), max(c.size[1] for c in cl)), (0, 0, 0, 0)); x = 0; clouds = []
    for c in cl: sheet.paste(c, (x, 0)); clouds.append([x, c.size[0], c.size[1]]); x += c.size[0] + 1
    sheet.save(os.path.join(OUT, 'clouds.png'), optimize=True)
    # 배경 풍경 (2배 해상도 960×540)
    land = Image.open(ART('landscape.jpg')).convert('RGB').resize((960, 540), Image.LANCZOS)
    land.save(os.path.join(OUT, 'landscape.jpg'), quality=88)
    top = np.asarray(land)[:4].reshape(-1, 3).mean(axis=0); day = '#%02x%02x%02x' % tuple(int(v) for v in top)
    # 하늘: 높이 오를수록 낮 → 노을 → 저녁 → 밤 (위에서 아래로 6색)
    skies = [['#1660d8', '#1e6ee0', '#2a7ae6', day, day, day],
             ['#4a5cc8', '#8a6ad0', '#d07ab8', '#f49a90', '#ffc080', '#ffd890'],
             ['#141e5a', '#253a8a', '#4a5aa8', '#8a6aa8', '#d08a98', '#f0a890'],
             ['#05061a', '#0a0e2e', '#121a48', '#1a2a64', '#24387a', '#34488a']]
    return dict(ground=ground, gx=gx, islandW=W1, islandH=H1, islets=islets, isletH=96, clouds=clouds, skies=skies)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    n, size = build_pieces()
    world = build_world()
    json.dump(world, open(os.path.join(OUT, 'world.json'), 'w'))
    print('pieces', n, size, 'world', {k: v for k, v in world.items() if k in ('ground', 'gx', 'islandW', 'islandH')})
