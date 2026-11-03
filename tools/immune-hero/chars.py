# 면역 특공대 주인공 4종: 호중구 / 대식세포 / 킬러 T세포 / NK세포
import math, numpy as np
from hero import Hero, mats, BASE_FPAL, rot
import anim
from anim import keys, mixp, sm, TAU, A as ANK

Neut = Hero


def _set(frames, **kw):
    return [dict(f, **kw) for f in frames]


def _tw(frames, f):
    return [f(dict(p)) for p in frames]


# ======================= 대식세포 MACROPHAGE =======================
# 덩치 큰 전장 청소부: 주황 작업 코트 + 앞치마, 위족(pseudopod)처럼 너풀대는 코트 자락,
# 어두운 고글 바이저(초록 렌즈), 리소좀 효소 캐니스터, 초록 리소좀 캐논
class Macro(Hero):
    id = 'macro'
    HIP, THIGH, SHIN, TORSO, UA, FA = 8.6, 4.0, 3.8, 6.6, 3.1, 3.0
    TR = (4.4, 4.8); PEL = (4.3, 2.8); LR = 1.3; AR = 1.3
    HEAD_OFF = (0.6, -5.5)
    ARM_HAND = np.array([3.9, 3.0]); ARM_EL = np.array([0.8, 3.1]); MUZ = np.array([11.6, 0.9])
    CH = dict(coat=(2, 2.8, -0.35, 0.2, 0.84, 0.05), coat2=(2, 2.6, -0.12, 0.22, 0.84, 0.05))
    TAILS = 0
    M = mats(dict(
        skin=['#5a2a18', '#b06a40', '#e0a070', '#ffd2a2'],
        hair=['#1e0a06', '#4a1c0c', '#7a3214', '#b0501e', '#e88040'],
        coat=(['#5a2a10', '#ae6026', '#e89a56', '#ffd096'], 0.03),
        trim=['#1a3a14', '#2e6a26', '#5aa83e', '#a8e888'],
        apron=['#4a3418', '#8a6c3c', '#c8a868', '#f2dca0'],
        pants=['#1e140e', '#3a281a', '#584030', '#7a5c44'],
        boot=['#140c08', '#2e1e14', '#4a3222', '#6e4c34'],
        glove=['#141410', '#2a2a22', '#45443a', '#6a6858'],
        belt=['#100c08', '#2a2018', '#46362a', '#6a5440'],
        gun=['#0a2010', '#16441e', '#26702e', '#46a050'],
        gunlt=['#1e5a20', '#48a048', '#8adc80', '#d8ffd0'],
        metal=['#1e1e26', '#44444e', '#80808e', '#d0d0dc'],
        glass=(['#0e3a14', '#2a7a30', '#6ad070', '#d0ffd0'], 0.08),
        visor=['#08080c', '#1a1a22', '#2e2e3a', '#50505e'],
        fx=(['#ffb060', '#ffd8a0', '#fff2d8', '#ffffff'], 0.3),
        gren=['#3a5a10', '#6aa020', '#a8e050', '#eaffb0'],
    ))
    FPAL = dict(BASE_FPAL, G='#b0ffa0', g='#3aa03a', R='#ff5a4a', r='#a01818', T='#ffffff', M='#3a1408', m='#a0402a',
                W='#ffffff', S='#a8e4ff')
    FX0, FY0 = -1, -3
    FACES = {
        'normal': ["         ", " GW  GGW ", " gg  ggg ", "         ", "         ", "    MMM  ", "         "],
        'blink': ["         ", "         ", " gg  ggg ", "         ", "         ", "    MMM  ", "         "],
        'look_u': ["         ", " WG  WGG ", " gg  ggg ", "         ", "         ", "    MMM  ", "         "],
        'look_d': ["         ", " gg  ggg ", " GW  GGW ", "         ", "         ", "    MMM  ", "         "],
        'fierce': ["         ", " RW  RRW ", " rr  rrr ", "         ", "         ", "   MTTM  ", "    MM   "],
        'hurt': ["         ", " R r R r ", " r R r R ", "         ", "         ", "   M M M ", "    M M  "],
        'joy': ["         ", "  G   G  ", " g g g g ", "         ", "         ", "   MmmM  ", "    MM   "],
        'tired': ["         ", "         ", " gg  ggg ", "        S", "        S", "    MM   ", "         "],
        'strain': ["         ", " RR  RRR ", " rr  rrr ", "         ", "         ", "   TTTT  ", "   MMMM  "],
        'ko': ["         ", " X X X X ", "  X   X  ", "         ", "         ", "    MM   ", "         "],
        'surprise': ["         ", " GG  GGG ", " GG  GGG ", "         ", "         ", "    MM   ", "    MM   "],
        'chomp': ["         ", " RW  RRW ", " rr  rrr ", "   TTTTT ", "  MmmmmMM", "  MmmmmmM", "   TTTTT "],
    }
    for k in ('fierce_u', 'fierce_d'): FACES[k] = FACES['fierce']

    def chain_anchor(s, sk, which):
        if which == 'coat': return sk['hip'] - sk['fw'] * 3.4 + sk['up'] * 0.8
        if which == 'coat2': return sk['hip'] - sk['fw'] * 1.4 + sk['up'] * 0.5

    def coat_tails(s, cv, sk, ch):
        up, fw = sk['up'], sk['fw']
        for nm in ('coat', 'coat2'):
            a0 = ch[nm + '_a']; c1, c2 = ch[nm]
            pts = [a0 + up * 1.2 + fw * 2.4, a0 - fw * 1.0, c1 - fw * 1.4, c2 - fw * 1.2, c2 + fw * 0.2, c2 + fw * 1.0, c2 + fw * 2.0, c1 + fw * 2.6, a0 + fw * 4.0]
            cv.poly(pts, mat=s.M['coat_b'] if nm == 'coat' else s.M['coat'], group=nm, over=('armB', 'gunb', 'coat'), dome=(c1, 5))
            # 위족처럼 둥글게 늘어진 끝
            for q, r in ((c2 - fw * 0.5, 1.3), (c2 + fw * 1.2, 1.1)):
                cv.ellipse(q + up * -0.4, r, r, mat=s.M['coat_b'] if nm == 'coat' else s.M['coat'], group=nm, over=('armB', 'gunb', 'coat'))

    def torso_deco(s, cv, sk):
        up, fw = sk['up'], sk['fw']; h = sk['hip']
        cv.poly([h + up * 6.0 + fw * 2.4, h + up * 6.2 + fw * 4.6, h + up * 0.2 + fw * 5.0, h - up * 1.4 + fw * 4.2, h - up * 1.4 + fw * 1.6, h + up * 2.0 + fw * 1.4],
                mat=s.M['apron'], group='apron', over=('torso',), dome=(h + up * 3 + fw * 2, 6))
        cv.line_decal(h + up * 3.0 + fw * 2.6, h + up * 3.0 + fw * 4.6, s.M['apron'].ramp[1], on='apron')
        w0 = h + up * 1.3
        cv.capsule(w0 - fw * 4.3, w0 + fw * 4.4, 0.9, 0.9, mat=s.M['belt'], group='belt', over=('torso', 'apron'))
        for u in (-3.4, -1.6, 0.2):   # 리소좀 효소 병
            cv.ellipse(w0 + fw * u - up * 0.2, 0.9, 1.4, a=sk['p']['tilt'], mat=s.M['glass'], group='vial', over=('belt', 'torso', 'pelvis'))
        x, y = w0 + fw * 3.4; cv.decal(x, y, '#d0a040', on='belt')
        for (u, v) in ((-2.4, 4.0), (-0.8, 5.4), (-3.0, 2.2)):
            q = h + up * v + fw * u; cv.decal(q[0], q[1], '#ffd8a0', on='torso')

    def collar(s, cv, sk):
        up, fw = sk['up'], sk['fw']
        for u, r in ((-2.0, 1.7), (0.0, 1.8), (2.0, 1.6)):   # 털 달린 깃(위족 같은 몽글한 깃)
            cv.ellipse(sk['neck'] - up * 0.4 + fw * u, r, r * 0.85, mat=s.M['trim'], group='collar', over=('torso', 'apron'))

    def head(s, cv, sk):
        H = lambda v: s.hl(sk, v); ha = sk['ha']; hov = s.HOV + ('apron',)
        dome = (H((-0.4, -2.0)), 7.5)
        cv.ellipse(H((-0.8, -1.2)), 6.0, 5.3, a=ha, mat=s.M['hair'], group='hair', over=hov)
        cv.ellipse(H((0.5, 0.4)), 5.5, 5.0, a=ha, mat=s.M['skin'], group='face', over=hov)
        cv.ellipse(H((1.8, 2.6)), 4.3, 2.7, a=ha, mat=s.M['skin'], group='face', over=hov)
        cv.ellipse(H((-2.3, 0.9)), 1.3, 1.6, a=ha, mat=s.M['skin'], group='ear', over=('hair',))
        spikes = ((-5.6, -0.6), (-6.6, -3.2), (-5.4, -4.6), (-6.0, -6.4), (-3.4, -6.2), (-2.6, -7.8), (-0.4, -6.6), (1.2, -8.0),
                  (2.6, -6.4), (4.8, -6.8), (4.6, -5.0), (6.0, -3.8), (4.2, -3.4), (2.8, -4.4), (1.0, -3.6), (-0.6, -4.2), (-2.0, -3.2), (-3.4, -3.6), (-3.9, -1.0))
        cv.poly([H(q) for q in spikes], mat=s.M['hair'], group='bangs', over=('face', 'ear'), dome=dome, lift=0.04)
        cv.capsule(H((-5.4, -2.0)), H((-0.2, -1.4)), 0.6, 0.6, mat=s.M['visor_b'], group='strap', over=('hair', 'bangs', 'face', 'ear'))
        cv.capsule(H((-0.2, -1.4)), H((5.6, -1.4)), 1.5, 1.5, mat=s.M['visor'], group='visor', over=('hair', 'bangs', 'face', 'ear', 'strap'))
        for q in ((2.2, 3.2), (3.4, 3.6), (1.0, 3.4), (4.4, 3.0), (2.8, 4.0)):
            x, y = H(q); cv.decal(x, y, s.M['skin'].ramp[1], on='face')
        for q in ((-2.6, -6.0), (0.6, -6.6), (-1.0, -5.6)):
            x, y = H(q); cv.decal(x, y, '#f0a060', on='bangs|hair')

    def gun(s, cv, T, group='gun', over=()):
        cap = lambda a, b, r1, r2, m: cv.capsule(T(a), T(b), r1, r2, mat=s.M[m], group=group, over=over)
        cap((2.4, 2.2), (-0.8, 3.4), 1.2, 1.1, 'gun')
        cap((1.4, 0.9), (9.6, 0.9), 2.35, 2.2, 'gun')
        cv.ellipse(T((5.0, -1.5)), 2.9, 1.9, mat=s.M['glass'], group=group + 'g', over=(group,))
        for q, c in (((4.0, -1.8), '#e0ffd0'), ((5.6, -1.2), '#a0ff90'), ((6.4, -2.2), '#ffffff'), ((4.8, -0.8), '#80e070')):
            x, y = T(q); cv.decal(x, y, c, on=group + 'g')
        cv.ellipse(T((10.4, 0.9)), 1.4, 2.9, a=0, mat=s.M['gunlt'], group=group + 'm', over=(group,))
        for yy in (0.0, 0.9, 1.8):
            x, y = T((10.9, yy)); cv.decal(x, y, '#061a08', on=group + 'm')
        for xx in (3.0, 7.6):
            cv.line_decal(T((xx, -1.0)), T((xx, 2.8)), '#0a2a10', on=group)

    def anims(s):
        d = anim.ANIMS()
        idl = []
        for i in range(8):
            ph = i / 8; b = (1 - math.cos(TAU * ph)) / 2
            idl.append(dict(anim.BASE, y=0.45 * b, squash=1 - 0.03 * b, tilt=0.04 + 0.02 * b, head=0.03 * math.sin(TAU * (ph - 0.2)),
                            fF=(3.1, -ANK), fB=(-2.9, -ANK), armB=(0.3 + 0.06 * b, 0.7)))
        d['idle'] = (idl, 7, True, (0, 0), None, 0)
        d['idle_u'] = (anim.aimv(idl, 'u'), 7, True, (0, 0), None, 0)
        rn = _tw(anim.run(), lambda p: dict(p, y=p['y'] * 0.6 + 0.3, tilt=p['tilt'] * 0.65, fF=(p['fF'][0] * 0.85, p['fF'][1] * 0.8 - 0.3),
                                                fB=(p['fB'][0] * 0.85, p['fB'][1] * 0.8 - 0.3)))
        d['run'] = (rn, 5, True, anim.RUNW, None, 0)
        d['run_u'] = (anim.aimv(rn, 'u'), 5, True, anim.RUNW, None, 0)
        i0 = dict(anim.BASE, sling=True, fF=(3.1, -ANK), fB=(-2.9, -ANK), armB=(-0.6, 1.9), armF=(0.6, 1.9))
        pat = dict(i0, armF=(0.85, 1.4), head=-0.05)
        laugh = dict(i0, armF=(0.7, 1.7), tilt=-0.15, head=-0.35, y=0.3)
        d['bored'] = (keys([(0, i0), (0.15, pat), (0.3, i0), (0.45, pat), (0.6, i0), (0.75, laugh), (0.9, laugh), (1.0, i0)], 16), 4, True, (0, 0), None, None)
        st = dict(anim.BASE, sling=True, fist=True, fF=(3.1, -ANK), fB=(-2.9, -ANK))
        d['melee'] = ([dict(st, armF=(0.2, 1.8), tilt=-0.14, x=-0.5, y=0.6),
                       dict(st, armF=(0.0, 2.0), tilt=-0.22, x=-1.0, y=0.9, head=-0.1),
                       dict(st, armF=(1.3, 0.4), tilt=0.36, x=1.6, y=1.0, fF=(4.8, -ANK), smear=('hand', -1.3, 1.3)),
                       dict(st, armF=(1.5, 0.2), tilt=0.46, x=2.4, y=1.2, fF=(5.2, -ANK), fB=(-3.4, -ANK), smear=('hand', -1.5, 1.5)),
                       dict(st, armF=(1.5, 0.3), tilt=0.42, x=2.4, y=1.2, fF=(5.2, -ANK), fB=(-3.4, -ANK)),
                       dict(st, armF=(1.1, 0.8), tilt=0.28, x=1.6, y=0.8, fF=(4.4, -ANK)),
                       dict(st, armF=(0.8, 1.4), tilt=0.14, x=0.8, y=0.4),
                       dict(st, armF=(0.6, 1.8), tilt=0.06)], 2, False, (0, 0), None, None)
        e = dict(anim.BASE, sling=True, fF=(3.1, -ANK), fB=(-2.9, -ANK))
        d['engulf'] = ([dict(e, armF=(2.4, 0.5), armB=(2.2, 0.6), tilt=-0.2, head=-0.28, y=0.4),
                        dict(e, armF=(2.8, 0.4), armB=(2.6, 0.5), tilt=-0.28, head=-0.36, y=0.6, x=-0.6),
                        dict(e, armF=(1.6, 0.2), armB=(1.3, 0.3), tilt=0.42, head=0.12, x=1.8, y=1.2, fF=(5.0, -ANK), squash=1.06),
                        dict(e, armF=(1.4, 0.4), armB=(1.2, 0.5), tilt=0.46, head=0.16, x=2.2, y=1.4, fF=(5.2, -ANK), fB=(-3.4, -ANK)),
                        dict(e, armF=(1.0, 1.0), armB=(0.8, 1.0), tilt=0.3, head=0.05, x=1.4, y=1.0, fF=(4.4, -ANK)),
                        dict(e, armF=(0.6, 1.6), armB=(0.4, 1.0), tilt=0.12, x=0.5, y=0.6)], 5, False, (0, 0), None, None)
        return d


# ======================= 킬러 T세포 KILLER T CELL =======================
# 정밀 저격수: 하늘색 롱 트렌치코트, 남색 전술 조끼, 노란 HUD 바이저,
# 헬멧 위의 T세포 수용체(TCR) 안테나 3개, CD8 견장, 남색 저격 라이플
class TC(Hero):
    id = 'tc'
    HIP, THIGH, SHIN, TORSO = 9.4, 4.5, 4.2, 6.2
    TR = (3.1, 3.4); PEL = (3.2, 2.2); LR = 0.95
    ARM_HAND = np.array([3.9, 2.4]); ARM_EL = np.array([0.9, 2.7]); MUZ = np.array([16.6, 0.5])
    CH = dict(coat=(2, 3.1, -0.3, 0.2, 0.84, 0.05), coat2=(2, 2.9, -0.1, 0.22, 0.84, 0.05))
    TAILS = 0
    M = mats(dict(
        skin=['#6a3a40', '#d09888', '#f6d2c2', '#fff4ec'],
        hair=['#060c22', '#142454', '#243e80', '#406ab0', '#78a4e4'],
        coat=(['#22406a', '#4c80b4', '#86c0ec', '#d4eeff'], 0.03),
        vest=['#080e20', '#141e3a', '#22305a', '#38487c'],
        trim=['#6a4a00', '#c09010', '#ffcc33', '#fff2a0'],
        pants=['#0a1024', '#16203c', '#24345a', '#384c7c'],
        boot=['#08080e', '#18182a', '#2c2c44', '#464664'],
        glove=['#0a0e1a', '#18203a', '#28345a', '#3e4e80'],
        belt=['#0a0a10', '#1e1e2a', '#34344a', '#50506a'],
        gun=['#080e22', '#18264a', '#2c3e6a', '#4a64a0'],
        gunlt=['#2a3a5a', '#5a72a0', '#9ab0d8', '#e0ecff'],
        metal=['#1a1a26', '#40404e', '#7e7e92', '#d0d0e2'],
        glass=(['#6a4a00', '#c8a010', '#ffe060', '#fffbe0'], 0.1),
        helm=['#08122a', '#16285a', '#284690', '#4e70c4'],
        visor=(['#7a5a00', '#d0a010', '#ffcc33', '#fff6c0'], 0.06),
        fx=(['#60b0ff', '#a8d8ff', '#e8f6ff', '#ffffff'], 0.3),
        gren=['#3a5a10', '#6aa020', '#a8e050', '#eaffb0'],
    ))
    FPAL = dict(BASE_FPAL, Y='#fffbe0', k='#5a3a00', E='#14204a', M='#6a2a30', W='#ffffff', K='#0e0e1e')
    FACES = {
        'normal': ["         ", "         ", "  k  kY  ", "         ", "         ", "         ", "    MM   "],
        'blink': ["         ", "         ", "  Y   Y  ", "         ", "         ", "         ", "    MM   "],
        'look_u': ["         ", "  E  EE  ", "  k  kY  ", "         ", "         ", "         ", "    MM   "],
        'look_d': ["         ", "         ", "  Y  Yk  ", "  k   k  ", "         ", "         ", "    MM   "],
        'fierce': ["         ", "   E EEE ", "  k  kY  ", "         ", "         ", "         ", "   MMM   "],
        'hurt': ["         ", "  E   E  ", "  K  KK  ", "   Y     ", "         ", "    MM   ", "   M  M  "],
        'joy': ["         ", "         ", "  Y  YY  ", "         ", "         ", "   M  M  ", "    MM   "],
        'tired': ["         ", "         ", "  k  k   ", "        S", "        S", "         ", "    MM   "],
        'strain': ["         ", "  E  EE  ", "  K  KK  ", "         ", "         ", "   WWWW  ", "   MMMM  "],
        'ko': ["         ", "  X  X X ", "      X  ", "  X  X X ", "         ", "         ", "    MM   "],
        'surprise': ["         ", "  E  EE  ", "  W  WW  ", "         ", "         ", "    MM   ", "    MM   "],
    }
    FACES['fierce_u'] = FACES['fierce']; FACES['fierce_d'] = FACES['fierce']

    def torso_deco(s, cv, sk):
        up, fw = sk['up'], sk['fw']; h = sk['hip']
        cv.poly([h + up * 5.4 + fw * 0.8, h + up * 5.6 + fw * 3.3, h + up * 1.0 + fw * 3.4, h + up * 0.6 + fw * 0.6],
                mat=s.M['vest'], group='vest', over=('torso',), dome=(h + up * 3 + fw * 2, 5))
        for v in (2.0, 3.4):
            q = h + up * v + fw * 2.4; cv.ellipse(q, 0.8, 0.6, mat=s.M['vest_b'], group='pocket', over=('vest',))
        x, y = h + up * 4.6 + fw * 2.4; cv.decal(x, y, '#ffcc33', on='vest')
        w0 = h + up * 1.2
        cv.capsule(w0 - fw * 3.2, w0 + fw * 3.3, 0.7, 0.7, mat=s.M['belt'], group='belt', over=('torso', 'vest'))
        x, y = w0 + fw * 2.6; cv.decal(x, y, '#d0d0e2', on='belt')
        cv.line_decal(sk['neck'] - up * 1.0 + fw * 0.4, h + up * 1.6 + fw * 0.4, s.M['coat'].ramp[1], on='torso')

    def collar(s, cv, sk):
        up, fw = sk['up'], sk['fw']
        cv.poly([sk['neck'] - up * 0.2 - fw * 2.4, sk['neck'] + up * 1.2 - fw * 1.6, sk['neck'] + up * 0.6 + fw * 1.0, sk['neck'] - up * 1.4 + fw * 2.2,
                 sk['neck'] - up * 1.6 - fw * 1.0], mat=s.M['coat'], group='collar', over=('torso', 'vest'), dome=(sk['neck'], 3))
        cv.ellipse(sk['shB'] * 0.3 + sk['neck'] * 0.7 - up * 0.6 - fw * 1.6, 1.6, 0.7, a=sk['p']['tilt'], mat=s.M['trim'], group='epaulet', over=('collar', 'torso'))

    def head(s, cv, sk):
        H = lambda v: s.hl(sk, v); ha = sk['ha']; hov = s.HOV + ('vest', 'epaulet')
        cv.ellipse(H((-1.0, -0.4)), 5.8, 5.4, a=ha, mat=s.M['hair'], group='hair', over=hov)
        cv.ellipse(H((0.45, 0.4)), 5.2, 4.9, a=ha, mat=s.M['skin'], group='face', over=hov)
        cv.ellipse(H((-2.0, 0.8)), 1.15, 1.45, a=ha, mat=s.M['skin'], group='ear', over=('hair',))
        cv.poly([H(q) for q in ((-5.4, -1.0), (-3.4, -2.0), (-1.6, -1.2), (-2.6, 1.8), (-4.4, 2.6), (-6.2, 1.2))],
                mat=s.M['hair'], group='lock', over=('face', 'ear'), dome=(H((-3, 0)), 5))
        # 헬멧 + 수용체 안테나
        for (b0, t0, tp) in (((-2.6, -5.4), (-3.4, -8.4), (-3.6, -8.9)), ((0.2, -5.9), (0.4, -9.2), (0.4, -9.8)), ((2.8, -5.2), (3.8, -8.2), (4.1, -8.7))):
            cv.capsule(H(b0), H(t0), 0.5, 0.45, mat=s.M['metal'], group='ant', over=())
            for o in (-0.7, 0.7):
                cv.capsule(H(t0), H((tp[0] + o, tp[1])), 0.35, 0.3, mat=s.M['metal'], group='ant', over=())
                cv.ellipse(H((tp[0] + o, tp[1] - 0.2)), 0.65, 0.65, mat=s.M['trim'], group='tip', over=('ant',))
        cv.ellipse(H((-0.7, -3.3)), 5.9, 3.5, a=ha, mat=s.M['helm'], group='helm', over=('face', 'ear', 'lock', 'hair', 'ant'))
        cv.capsule(H((-6.0, -2.4)), H((5.7, -3.0)), 0.7, 0.7, mat=s.M['helm_b'], group='brim', over=('face', 'helm', 'hair'))
        x, y = H((-1.5, -4.8)); cv.decal(x, y, '#8aa8f0', on='helm'); x, y = H((-2.4, -4.2)); cv.decal(x, y, '#8aa8f0', on='helm')
        cv.capsule(H((0.4, -0.7)), H((5.5, -0.9)), 0.95, 0.9, mat=s.M['visor'], group='visor', over=('face', 'ear', 'brim'))
        cv.capsule(H((-4.6, -1.2)), H((0.2, -0.6)), 0.5, 0.5, mat=s.M['belt'], group='strap', over=('hair', 'lock', 'face', 'ear'))

    def gun(s, cv, T, group='gun', over=()):
        cap = lambda a, b, r1, r2, m, g=group: cv.capsule(T(a), T(b), r1, r2, mat=s.M[m], group=g, over=over if g == group else (group,))
        cap((2.6, 1.4), (-1.2, 2.4), 1.05, 1.15, 'gun')
        cap((2.2, 0.8), (9.4, 0.7), 1.25, 1.1, 'gun')
        cap((9.4, 0.5), (16.2, 0.5), 0.6, 0.5, 'metal', group + 'b')
        cap((15.6, 0.5), (16.4, 0.5), 0.85, 0.85, 'gun', group + 'm')
        cv.ellipse(T((6.4, 3.0)), 0.9, 1.5, mat=s.M['gun'], group=group + 'mag', over=(group,))
        cap((4.4, -1.3), (8.6, -1.3), 0.85, 0.85, 'gunlt', group + 's')
        cv.ellipse(T((8.8, -1.3)), 0.55, 0.9, mat=s.M['glass'], group=group + 'l', over=(group + 's',))
        x, y = T((12.0, 0.5)); cv.decal(x, y, '#ffcc33', on=group + 'b')
        x, y = T((5.0, 0.4)); cv.decal(x, y, '#ffcc33', on=group)

    def anims(s):
        d = anim.ANIMS()
        idl = []
        for i in range(8):
            ph = i / 8; b = (1 - math.cos(TAU * ph)) / 2
            idl.append(dict(anim.BASE, y=0.4 * b, tilt=0.03 + 0.015 * b, head=0.02 * math.sin(TAU * (ph - 0.25)),
                            fF=(2.6, -ANK), fB=(-2.4, -ANK), armB=(0.12 + 0.04 * b, 0.35)))
        d['idle'] = (idl, 7, True, (0, 0), None, 0)
        d['idle_u'] = (anim.aimv(idl, 'u'), 7, True, (0, 0), None, 0)
        i0 = dict(idl[0], sling=True, armF=(0.15, 0.4))
        sal = dict(i0, armF=(2.6, 2.25), tilt=-0.02, head=-0.04, fist=False, armtop=True)
        d['bored'] = (keys([(0, i0), (0.18, sal), (0.7, sal), (0.85, i0), (1.0, i0)], 16), 4, True, (0, 0), None, None)
        st = dict(anim.BASE, sling=True, fist=True)
        d['melee'] = ([dict(st, armF=(0.8, 2.0), tilt=0.02, y=0.4),
                       dict(st, armF=(0.3, 2.4), tilt=-0.08, x=-0.6, y=0.6, head=-0.05),
                       dict(st, armF=(1.55, 0.1), tilt=0.22, x=1.2, y=0.8, fF=(4.4, -ANK), smear=('hand', -1.2, 1.2)),
                       dict(st, armF=(1.6, 0.0), tilt=0.26, x=1.5, y=0.9, fF=(4.6, -ANK), fB=(-3.0, -ANK), smear=('hand', -1.6, 1.6)),
                       dict(st, armF=(1.5, 0.3), tilt=0.22, x=1.3, y=0.8, fF=(4.4, -ANK)),
                       dict(st, armF=(1.1, 1.0), tilt=0.14, x=0.8, y=0.5),
                       dict(st, armF=(0.6, 1.6), tilt=0.06, x=0.3, y=0.3),
                       dict(st, armF=(0.3, 0.8), tilt=0.03)], 2, False, (0, 0), None, None)
        return d


# ======================= NK세포 NATURAL KILLER =======================
# 선천면역의 암살자: 짙은 녹색 닌자 슈트, 바람에 휘날리는 긴 보라 목도리, 연두색 삐죽 머리,
# 보라 이마 보호대, 입을 가린 복면, 쌍열 니들건
class NK(Hero):
    id = 'nk'
    HIP, THIGH, SHIN, TORSO = 8.8, 4.3, 4.0, 5.8
    TR = (3.0, 3.25); PEL = (3.1, 2.1); LR = 0.9; AR = 0.95; SKIRT = False
    ARM_HAND = np.array([3.7, 2.2]); ARM_EL = np.array([0.9, 2.6]); MUZ = np.array([11.6, 1.0])
    CH = dict(tail=(7, 1.65, -1.75, 0.07, 0.92, 0.02))
    TAILS = 2
    M = mats(dict(
        skin=['#6a3430', '#d0927a', '#f6caae', '#fff0e0'],
        hair=['#0a2a10', '#1a5a22', '#34963a', '#72d462', '#c4ffb0'],
        coat=(['#081a12', '#143426', '#225440', '#367a60'], 0.02),
        trim=['#36085a', '#7226a8', '#ae56e0', '#e6b0ff'],
        pants=['#060e0a', '#102418', '#1c3a28', '#2e5640'],
        boot=['#08080e', '#161624', '#28283c', '#40405a'],
        glove=['#4a4a54', '#8a8a9a', '#c4c4d2', '#f0f0f8'],
        band=['#300a48', '#6c1e9a', '#a442d8', '#dca0ff'],
        belt=['#300a48', '#6c1e9a', '#a442d8', '#dca0ff'],
        mask=['#06140c', '#10281a', '#1c402a', '#2e5e40'],
        gun=['#06180c', '#123620', '#205434', '#38804e'],
        gunlt=['#36085a', '#7226a8', '#ae56e0', '#e6b0ff'],
        metal=['#1a1a26', '#44445a', '#8888a2', '#d6d6ea'],
        glass=(['#300a48', '#7226a8', '#c070ff', '#f0d0ff'], 0.08),
        fx=(['#b050ff', '#d8a0ff', '#f4e4ff', '#ffffff'], 0.3),
        gren=['#3a5a10', '#6aa020', '#a8e050', '#eaffb0'],
    ))
    FPAL = dict(BASE_FPAL, I='#b844f4', i='#5a1890', K='#0a0614')
    FACES = {
        'normal': ["         ", "         ", "  K  KKK ", "  I  IW  ", "         ", "         ", "         "],
        'blink': ["         ", "         ", "         ", "  K  KKK ", "         ", "         ", "         "],
        'look_u': ["         ", "  K  KKK ", "  I  IW  ", "         ", "         ", "         ", "         "],
        'look_d': ["         ", "         ", "         ", "  K  KKK ", "  I  WI  ", "         ", "         "],
        'fierce': ["         ", "  K   K  ", "   K KKK ", "  I  IW  ", "         ", "         ", "         "],
        'hurt': ["         ", "         ", "  K  K K ", "   K  K  ", "  K  K K ", "         ", "         "],
        'joy': ["         ", "         ", "  K   K  ", " K K K K ", "         ", "         ", "         "],
        'tired': ["         ", "         ", "         ", "  K  KKK ", "  i  iI S", "        S", "         "],
        'strain': ["         ", "  K   K  ", "   K  K  ", "  K   K  ", "         ", "         ", "         "],
        'ko': ["         ", "  X  X X ", "      X  ", "  X  X X ", "         ", "         ", "         "],
        'surprise': ["         ", "  K  KK  ", "  W  WW  ", "  K  KI  ", "         ", "         ", "         "],
    }
    FACES['fierce_u'] = FACES['fierce']; FACES['fierce_d'] = FACES['fierce']

    def chain_anchor(s, sk, which):
        return sk['neck'] - sk['fw'] * 1.8 - sk['up'] * 0.6

    def back(s, cv, sk, ch):
        for ci, c in enumerate(ch.get('tail', [])):
            pts = [ch['tail_a'][ci]] + c
            for i in range(len(pts) - 1):
                r = 0.95 - i * 0.06
                cv.capsule(pts[i], pts[i + 1], r, r - 0.06, mat=s.M['band_b'] if ci == 0 else s.M['band'], group='tail')
            x, y = pts[-1]; cv.decal(x, y, '#e6b0ff', on='tail')

    def torso_deco(s, cv, sk):
        up, fw = sk['up'], sk['fw']; h = sk['hip']
        w0 = h + up * 1.3
        cv.capsule(w0 - fw * 3.0, w0 + fw * 3.1, 0.85, 0.8, mat=s.M['belt'], group='belt', over=('torso',))
        cv.capsule(w0 - fw * 2.6, w0 - fw * 3.6 - up * 2.2, 0.55, 0.4, mat=s.M['belt_b'], group='sash', over=('torso', 'belt', 'pelvis'))
        # 슈트의 대각 무늬와 수리검
        cv.line_decal(sk['neck'] - up * 1.2 + fw * 2.0, h + up * 2.0 - fw * 1.8, s.M['coat'].ramp[2], on='torso')
        q = h + up * 3.6 + fw * 1.4
        for o in ((0, 0), (0.6, 0), (-0.6, 0), (0, 0.6), (0, -0.6)):
            cv.decal(q[0] + o[0], q[1] + o[1], '#c8c8dc' if o != (0, 0) else '#5a5a70', on='torso')

    def collar(s, cv, sk):
        up, fw = sk['up'], sk['fw']
        cv.ellipse(sk['neck'] - up * 0.6, 3.4, 1.8, a=sk['p']['tilt'], mat=s.M['band'], group='scarf', over=('torso', 'belt', 'tail'))
        cv.line_decal(sk['neck'] - up * 0.4 - fw * 2.6, sk['neck'] - up * 0.8 + fw * 2.6, s.M['band'].ramp[1], on='scarf')

    def head(s, cv, sk):
        H = lambda v: s.hl(sk, v); ha = sk['ha']; hov = s.HOV
        dome = (H((-0.8, -2.0)), 7.5)
        cv.ellipse(H((-1.0, -1.0)), 5.8, 5.2, a=ha, mat=s.M['hair'], group='hair', over=hov)
        cv.ellipse(H((0.45, 0.4)), 5.1, 4.8, a=ha, mat=s.M['skin'], group='face', over=hov)
        cv.ellipse(H((-2.0, 0.8)), 1.1, 1.4, a=ha, mat=s.M['skin'], group='ear', over=('hair',))
        spikes = ((-3.0, -0.4), (-5.0, 0.2), (-7.6, -1.0), (-5.8, -2.6), (-7.8, -4.2), (-5.0, -4.6), (-5.6, -6.8), (-2.8, -5.8), (-1.6, -7.9),
                  (0.4, -6.4), (2.8, -7.2), (3.2, -5.4), (5.6, -5.0), (5.4, -3.6), (6.8, -2.0), (4.6, -2.3), (3.6, -1.1), (2.8, -2.7),
                  (1.4, -1.3), (0.6, -2.9), (-0.8, -2.1), (-2.0, -3.0), (-2.6, -1.4))
        cv.poly([H(q) for q in spikes], mat=s.M['hair'], group='bangs', over=('face', 'ear', 'scarf'), dome=dome, lift=0.04)
        cv.capsule(H((-5.3, -3.6)), H((4.4, -4.4)), 0.72, 0.72, mat=s.M['band'], group='band', over=('hair', 'bangs', 'face'))
        cv.ellipse(H((2.6, -4.3)), 1.5, 0.95, a=ha, mat=s.M['metal'], group='plate', over=('band', 'bangs'))
        x, y = H((2.6, -4.3)); cv.decal(x, y, '#ae56e0', on='plate')
        cv.poly([H(q) for q in ((-0.6, 0.9), (2.0, 0.6), (6.2, 0.4), (6.0, 2.6), (4.6, 4.3), (1.0, 4.8), (-1.2, 3.5))],
                mat=s.M['mask'], group='mask', over=('face', 'ear'), dome=(H((2, 2)), 5))
        cv.line_decal(H((1.0, 2.4)), H((5.4, 1.8)), s.M['mask'].ramp[2], on='mask')
        for q in ((-1.6, -6.2), (-2.6, -5.2), (0.2, -5.6)):
            x, y = H(q); cv.decal(x, y, '#d8ffc8', on='bangs|hair')

    def gun(s, cv, T, group='gun', over=()):
        for yy, g in ((-0.1, group), (2.1, group + '2')):
            ov = over if g == group else (group,)
            cv.capsule(T((2.2, yy + 0.3)), T((10.2, yy)), 0.85, 0.75, mat=s.M['gun'], group=g, over=ov)
            cv.ellipse(T((10.7, yy)), 0.85, 0.75, mat=s.M['gunlt'], group=g + 't', over=(g,))
        cv.capsule(T((2.6, 1.0)), T((1.4, 3.6)), 0.8, 0.7, mat=s.M['gun'], group=group + 'h', over=(group, group + '2'))
        x, y = T((6.0, -0.4)); cv.decal(x, y, '#72d462', on=group)
        x, y = T((6.0, 1.8)); cv.decal(x, y, '#72d462', on=group + '2')

    def anims(s):
        d = anim.ANIMS()
        idl = []
        for i in range(8):
            ph = i / 8; b = (1 - math.cos(TAU * ph)) / 2; w = math.sin(TAU * ph)
            idl.append(dict(anim.BASE, y=1.5 + 0.5 * b, tilt=0.2 + 0.03 * b, head=-0.16 + 0.02 * w, x=0.2 * w,
                            fF=(3.4, -ANK), fB=(-3.2, -ANK), aB=0.3, armB=(0.7 + 0.08 * b, 1.3)))
        d['idle'] = (idl, 6, True, (-0.015, 0), None, 0)
        d['idle_u'] = (anim.aimv(idl, 'u'), 6, True, (-0.015, 0), None, 0)
        rn = _tw(anim.run(), lambda p: dict(p, tilt=p['tilt'] + 0.14, head=p['head'] - 0.12, armB=(-1.6, 0.4)))
        d['run'] = (rn, 3, True, lambda fi: (-0.16, -0.02), None, 0)
        d['run_u'] = (anim.aimv(rn, 'u'), 3, True, lambda fi: (-0.16, -0.02), None, 0)
        # 몸풀기: 뛰어올라 공중제비
        c0 = dict(idl[0], sling=True, armF=(0.5, 1.2))
        tuck = dict(c0, fF=(2.4, -ANK - 4.6), fB=(0.6, -ANK - 4.0), aF=0.4, aB=0.5, armF=(1.0, 1.9), armB=(1.2, 1.8), tilt=0.3, y=-1.0)
        fl = [c0, dict(c0, y=3.0, tilt=0.32)]
        for i in range(8):
            fl.append(dict(tuck, oy=-7.0 * math.sin(math.pi * (i + 1) / 9), spin=-(i + 1) / 8 * TAU))
        fl += [dict(c0, y=3.2, tilt=0.34, sling=True), dict(c0, y=2.0), c0, c0]
        d['bored'] = (fl, 4, True, (0, 0), None, None)
        # 2단 점프 공중제비
        fp = []
        for i in range(8):
            fp.append(dict(tuck, spin=-(i + 1) / 8 * TAU, y=-1.0))
        d['flip'] = (fp, 2, False, (0, 0.06), None, None)
        # 회전 발차기
        st = dict(anim.BASE, sling=True, armF=(-0.5, 0.9), armB=(-1.0, 0.7), kick=1)
        d['melee'] = ([dict(st, tilt=-0.08, fF=(2.8, -ANK - 4.4), aF=0.3, y=0.6),
                       dict(st, tilt=-0.28, head=0.1, fF=(5.8, -ANK - 6.0), aF=-0.2, y=0.8, smear=('hip', -1.4, -0.4)),
                       dict(st, tilt=-0.4, head=0.2, fF=(7.0, -ANK - 7.2), aF=-0.4, y=1.0, armF=(-0.9, 0.6), smear=('hip', -1.5, 0.3)),
                       dict(st, tilt=-0.34, head=0.16, fF=(6.6, -ANK - 5.4), aF=-0.2, y=1.0, armF=(-0.9, 0.6), smear=('hip', -0.6, 0.6)),
                       dict(st, tilt=-0.18, fF=(4.6, -ANK - 3.4), aF=0.2, y=0.8),
                       dict(st, tilt=0.0, fF=(3.6, -ANK - 1.2), y=0.8, kick=None),
                       dict(idl[0], sling=True, armF=(0.5, 1.2)),
                       dict(idl[0], sling=True, armF=(0.4, 1.1))], 2, False, (0, 0), None, None)
        # 섬광 대시
        ds = []
        for i in range(4):
            w = math.sin(TAU * i / 4)
            ds.append(dict(anim.BASE, sling=True, tilt=0.75, head=-0.6, y=3.0 + 0.3 * w, fF=(5.2, -ANK - 0.4), fB=(-5.4, -ANK - 2.2 + 0.4 * w),
                           aF=-0.1, aB=0.8, armF=(1.75, -0.05), armB=(-1.6, 0.2), blade=True))
        d['dash'] = (ds, 2, True, lambda fi: (-0.35, 0), None, None)
        return d


ALL = dict(neut=Neut, macro=Macro, tc=TC, nk=NK)
