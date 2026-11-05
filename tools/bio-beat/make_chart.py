# 바이오 비트: 실제 음원(mp3)을 분석해 하·중·상 채보를 만듭니다. (analyze_song.py의 다음 버전)
#   python3 make_chart.py <음원.mp3> <출력.json> [BPM]        한 곡
#   python3 make_chart.py --all                               games/bio-beat/*.mp3 전부 (BPM은 아래 BPM_FIX 참고)
#   python3 make_chart.py --selftest                          박자 검출 지연 보정값 확인 (합성 드럼으로)
#
# 하는 일
#  1) 소리를 '음(멜로디·보컬)'과 '타격(드럼)'으로 나눔 (HPSS: 시간/주파수 방향 중앙값 필터)
#  2) 템포·박자 위치: 타격 온셋이 박에 가장 잘 맞는 BPM과 위상을 찾고, 센 온셋들의 평균 어긋남으로 0번 박을 미세 보정
#  3) 멜로디: 음 부분에서 배음 합으로 기본 주파수(음높이)를 따라가고, 음높이가 바뀌거나 새 음절이 시작될 때마다 음표로 끊음
#  4) 마디마다 노래(보컬) 유무·소리 크기로 인트로/벌스/빌드/후렴/간주/아웃트로를 정함
#  5) 하: 8분음표 멜로디(한 손), 중: 멜로디 전부+간주 드럼, 상: 멜로디+킥·스네어·하이햇 동시치기
#     레인은 음이 올라가면 오른쪽, 내려가면 왼쪽. 긴 음은 롱노트.
#  6) 레벨(1~20): 초당 노트 수·가장 바쁜 4초·동시치기·롱노트 비율로 계산
import sys, os, json, glob, subprocess
import numpy as np

SR = 22050
HERE = os.path.dirname(os.path.abspath(__file__))
GDIR = os.path.join(HERE, '../../games/bio-beat')
# 자동 템포 검출이 박을 반/두 배로 잡는 곡은 여기서 고정 (check_tempo.py로 확인한 값)
BPM_FIX = {'cell-powerplant': 86.98}
ONSET_BIAS = -0.0249   # --selftest로 잰 검출 오차(초): 분석 창 가운데 기준이라 실제보다 약 25ms 일찍 잡힘 → 보정


# ---------------------------------------------------------------- 기본 신호 처리
def load(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).copy()


def stft(x, nfft, hop):
    win = np.hanning(nfft).astype(np.float32); n = 1 + (len(x) - nfft) // hop
    out = np.empty((n, nfft // 2 + 1), np.float32)
    for a in range(0, n, 2000):   # 메모리 아끼려고 나눠서
        b = min(n, a + 2000); idx = np.arange(nfft)[None, :] + hop * np.arange(a, b)[:, None]
        out[a:b] = np.abs(np.fft.rfft(x[idx] * win, axis=1))
    return out


def median_filter(S, k, axis):
    """S를 axis 방향으로 길이 k 중앙값 필터 (조각내어 계산)"""
    from numpy.lib.stride_tricks import sliding_window_view
    pad = [(0, 0), (0, 0)]; pad[axis] = (k // 2, k // 2)
    P = np.pad(S, pad, mode='edge'); out = np.empty_like(S)
    if axis == 0:
        for a in range(0, S.shape[0], 400):
            b = min(S.shape[0], a + 400)
            out[a:b] = np.median(sliding_window_view(P[a:b + k - 1], k, axis=0), axis=-1)
    else:
        for a in range(0, S.shape[0], 400):
            b = min(S.shape[0], a + 400)
            out[a:b] = np.median(sliding_window_view(P[a:b], k, axis=1), axis=-1)
    return out


def hpss(S):
    H = median_filter(S, 17, 0); Pm = median_filter(S, 17, 1)
    mh = H ** 2 / (H ** 2 + Pm ** 2 + 1e-9)
    return S * mh, S * (1 - mh)


def flux(S, freqs, lo, hi):
    b = (freqs >= lo) & (freqs < hi); L = np.log1p(S[:, b] * 20)
    d = np.diff(L, axis=0, prepend=L[:1]); d[d < 0] = 0
    return d.sum(axis=1)


def norm(v, win):
    v = v - np.convolve(v, np.ones(win) / win, mode='same'); v[v < 0] = 0
    return v / (np.percentile(v, 99.5) + 1e-9)


def peaks(env, th, mind):
    """국소 최대 + 문턱 + 최소 간격(프레임). 포물선 보간으로 프레임 사이 위치까지"""
    out = []; last = -10 ** 9
    for i in range(1, len(env) - 1):
        if env[i] >= th and env[i] >= env[i - 1] and env[i] > env[i + 1] and i - last >= mind:
            a, b, c = env[i - 1], env[i], env[i + 1]; den = a - 2 * b + c
            off = 0.5 * (a - c) / den if den != 0 else 0.0
            out.append((i + max(-0.5, min(0.5, off)), float(b))); last = i
    return out


# ---------------------------------------------------------------- 분석
def analyze(x, force_bpm=None):
    dur = len(x) / SR
    HOP = 256; NFFT = 2048; fps = SR / HOP; tf = lambda i: (i * HOP + NFFT / 2) / SR
    S = stft(x, NFFT, HOP); freqs = np.fft.rfftfreq(NFFT, 1 / SR)
    Hs, Ps = hpss(S)
    kick = norm(flux(Ps, freqs, 35, 160), 87); snare = norm(flux(Ps, freqs, 1200, 5000), 87)
    hat = norm(flux(Ps, freqs, 6000, 10500), 87); perc = norm(flux(Ps, freqs, 35, 10500), 87)
    allf = norm(flux(S, freqs, 35, 10500), 87); harm = norm(flux(Hs, freqs, 150, 3000), 87)
    rms = np.sqrt((S ** 2).sum(axis=1)); hen = np.sqrt((Hs[:, (freqs > 150) & (freqs < 3000)] ** 2).sum(axis=1))

    # ---- 템포: 모든 BPM·위상을 훑어 박 위치 온셋 평균이 가장 큰 값 (반/두 배는 80~160 안으로)
    sm = np.convolve(allf + perc, [.25, .5, 1, .5, .25], mode='same')
    def fit(b, nph=32, sig=sm):
        spb = 60 / b; ph = np.linspace(0, spb, nph, endpoint=False); k = np.arange(int((dur - spb) / spb))
        idx = np.clip(np.round((ph[:, None] + k[None, :] * spb - NFFT / 2 / SR) * fps).astype(int), 0, len(sig) - 1)
        v = sig[idx].mean(axis=1); return v.max(), ph[v.argmax()]
    if force_bpm: bpm = force_bpm
    else:
        bs = np.arange(70, 190, 0.05); f = np.array([fit(b)[0] for b in bs]); bpm = bs[f.argmax()]
        bs = np.arange(bpm - 0.25, bpm + 0.25, 0.005); bpm = bs[np.argmax([fit(b, 96, allf)[0] for b in bs])]
        while bpm > 162: bpm /= 2
        while bpm < 78: bpm *= 2
    spb = 60 / bpm; st = spb / 4; bar = spb * 4
    _, ph = fit(bpm, 192, perc + 0.5 * allf)

    # ---- 온셋 (타격) 목록: 시간·세기
    def onsets(env, th):
        return [(tf(i) - ONSET_BIAS, s) for i, s in peaks(env, th, int(0.06 * fps))]
    K = onsets(kick, 0.28); Sn = onsets(snare, 0.3); Hh = onsets(hat, 0.35); Pall = onsets(perc, 0.25)
    # ---- 0번 박 미세 보정: 센 타격 온셋들이 16분 격자에서 평균적으로 얼마나 어긋났는지 (원형 평균)
    strong = [t for t, s in Pall if s > 0.5]
    for _ in range(2):
        r = (np.array(strong) - ph) / st; ang = 2 * np.pi * (r - np.round(r))
        ph += np.angle(np.mean(np.exp(1j * ang))) / (2 * np.pi) * st
    # ---- 박 추적 (동적 계획법): 템포가 아주 조금씩 흔들리는 곡도 박을 따라가도록
    env = np.convolve(perc + 0.5 * allf, [.25, .5, 1, .5, .25], mode='same')
    p = spb * fps; n = len(env); score = env.copy(); back = np.full(n, -1)
    lo, hi = int(p * 0.7), int(p * 1.4)
    for t in range(hi, n):
        tau = np.arange(t - hi, t - lo + 1); pen = -400 * np.log((t - tau) / p) ** 2
        c = score[tau] + pen; k = int(np.argmax(c)); score[t] = env[t] + c[k]; back[t] = tau[k]
    t = int(np.argmax(score[-int(p * 2):])) + n - int(p * 2); bt = []
    while t >= 0: bt.append(t); t = back[t]
    bt = np.array(bt[::-1], float)
    btime = (bt * HOP + NFFT / 2) / SR - ONSET_BIAS
    # 들쭉날쭉한 박 간격은 앞뒤 4박 직선 맞춤으로 다듬기 (천천히 변하는 템포만 남김)
    k = np.arange(len(btime)); sm_t = btime.copy()
    for i in range(len(btime)):
        a_, b_ = max(0, i - 4), min(len(btime), i + 5); cf = np.polyfit(k[a_:b_], btime[a_:b_], 1); sm_t[i] = cf[0] * i + cf[1]
    # 앞뒤로 박을 늘려 곡 전체(0초~끝)를 덮음
    while sm_t[0] > 0: sm_t = np.insert(sm_t, 0, sm_t[0] - (sm_t[1] - sm_t[0]))
    while sm_t[-1] < dur + spb: sm_t = np.append(sm_t, sm_t[-1] + (sm_t[-1] - sm_t[-2]))
    # 센 타격 온셋 기준 미세 위상 보정 (전체 평균)
    strong = np.array([t for t, s_ in Pall if s_ > 0.5])
    for _ in range(2):
        gq = np.interp(strong, sm_t, np.arange(len(sm_t))) * 4
        res = (gq - np.round(gq)); shift = np.angle(np.mean(np.exp(2j * np.pi * res))) / (2 * np.pi)
        sm_t = sm_t + shift * np.gradient(sm_t) / 4
    beats = sm_t
    def env_at(env_, ts):
        fi = np.clip(np.round((np.asarray(ts) + ONSET_BIAS - NFFT / 2 / SR) * fps).astype(int), 0, len(env_) - 1)
        return np.maximum.reduce([env_[np.clip(fi + d, 0, len(env_) - 1)] for d in (-2, -1, 0, 1, 2)])
    kb = env_at(kick, beats); sb = env_at(snare, beats)
    # 마디 첫 박: 킥이 세고 스네어가 약한 박 (1·3박 킥, 2·4박 스네어인 보통 박자)
    down = max(range(4), key=lambda k: kb[k::4].mean() + kb[(k + 2) % 4::4].mean() - sb[k::4].mean() - sb[(k + 2) % 4::4].mean() + 0.5 * kb[k::4].mean())
    beats = beats[down:] if down else beats
    if beats[0] > 0: beats = np.concatenate([beats[0] - (beats[1] - beats[0]) * np.arange(4, 0, -1), beats])   # 0번 마디가 음원 시작 전에
    grid16 = np.interp(np.arange((len(beats) - 1) * 4 + 1) / 4, np.arange(len(beats)), beats)   # 16분음표 칸 시각
    t0 = float(beats[0]); nb = (len(beats) - 1) // 4
    bpm = 60 / float(np.median(np.diff(beats)))
    # ---- 멜로디(음높이) 추적: 음 성분에서 배음 합 (MIDI 45~81, 1/4 반음 간격)
    L = np.log1p(Hs * 30); bin_hz = freqs[1]
    cands = np.arange(45, 81.01, 0.25); f0s = 440 * 2 ** ((cands - 69) / 12)
    sal = np.zeros((len(L), len(cands)), np.float32)
    for h, w in zip(range(1, 7), [1, .8, .64, .51, .41, .33]):
        fb = f0s * h / bin_hz; i0 = np.floor(fb).astype(int); fr = (fb - i0).astype(np.float32); ok = i0 + 1 < L.shape[1]
        sal[:, ok] += w * (L[:, i0[ok]] * (1 - fr[ok]) + L[:, i0[ok] + 1] * fr[ok])
    best = sal.argmax(axis=1); pitch = cands[best]
    ratio = sal.max(axis=1) / (np.median(sal, axis=1) + 1e-6)
    voiced = (ratio > np.percentile(ratio, 45)) & (hen > np.percentile(hen, 30))
    # 짧은 끊김 메우기·짧은 소리 지우기 (3프레임)
    v = voiced.copy()
    for i in range(1, len(v) - 3):
        if not v[i] and v[i - 1] and v[i + 1:i + 3].any(): v[i] = True
    pm = pitch.copy()
    for i in range(2, len(pm) - 2): pm[i] = np.median(pitch[i - 2:i + 3])
    hpk = peaks(harm, 0.12, int(0.05 * fps)); hon = set(int(round(i)) for i, s in hpk if s >= 0.3)
    hpos = np.array([i for i, s in hpk])
    def start_of(f):   # 음 시작: 목소리로 판정된 프레임보다 조금 앞선 '음 성분 온셋'이 있으면 그 시각 (판정이 늦게 켜지므로)
        if len(hpos):
            c = hpos[(hpos >= f - 0.12 * fps) & (hpos <= f + 0.02 * fps)]
            if len(c): return tf(c[-1]) - ONSET_BIAS - 0.012   # 음 성분은 어택이 느려 약 12ms 늦게 잡힘 (합성 멜로디로 잰 값)
        return tf(f) - ONSET_BIAS - 0.035
    notes = []; i = 0; N = len(v)
    while i < N:
        if not v[i]: i += 1; continue
        s0 = i; ref = pm[i]; dev = 0
        j = i + 1
        while j < N and v[j]:
            if abs(pm[j] - ref) > 1.2: dev += 1   # 비브라토(±1반음 안쪽 떨림)는 같은 음으로
            else: dev = 0; ref = 0.85 * ref + 0.15 * pm[j]
            if dev >= 5 or (j in hon and j - s0 >= int(0.09 * fps)):
                if dev >= 5: j -= 4
                break
            j += 1
        if j - s0 >= int(0.07 * fps):
            notes.append((start_of(s0), tf(j) - ONSET_BIAS, float(np.median(pm[s0:j])), float(hen[s0:j].mean())))
        i = max(j, s0 + 1)
        while i < N and v[i] and i not in hon and abs(pm[i] - pm[max(0, i - 1)]) < 1.2: i += 1

    # ---- 마디별 구간
    tb = lambda b: float(grid16[min(len(grid16) - 1, b * 16)])
    def frames(a, b): return slice(max(0, int((a - NFFT / 2 / SR) * fps)), max(0, int((b - NFFT / 2 / SR) * fps)))
    en = np.array([rms[frames(tb(b), tb(b + 1))].mean() if tb(b + 1) > 0 else 0 for b in range(nb)])
    voc = np.zeros(nb)
    for a, b_, p, e in notes:
        k = int(np.searchsorted(grid16, a) - 1) // 16
        if 0 <= k < nb: voc[k] += (b_ - a)
    voc /= bar
    enN = en / (np.percentile(en[en > 0], 90) + 1e-9) if (en > 0).any() else en
    sm4 = lambda a: np.convolve(a, np.ones(4) / 4, mode='same')
    vs, es = sm4(voc), sm4(enN)
    sung = vs > 0.22
    first = int(np.argmax(sung)) if sung.any() else 0; last = nb - 1 - int(np.argmax(sung[::-1])) if sung.any() else nb - 1
    hi = np.percentile(es[first:last + 1], 60) if last > first else 1
    secs = []
    for b in range(nb):
        if b < first: s = 'intro'
        elif b > last: s = 'outro'
        elif not sung[b]: s = 'break'
        elif es[b] >= hi: s = 'chorus'
        else: s = 'verse'
        secs.append(s)
    # 4마디 단위로 다듬기 + 후렴 바로 앞 2마디는 빌드
    for a in range(0, nb, 4):
        blk = secs[a:a + 4]; m = max(set(blk), key=blk.count)
        if m in ('chorus', 'verse'):
            for b in range(a, min(nb, a + 4)):
                if secs[b] in ('chorus', 'verse'): secs[b] = m
    for b in range(1, nb):
        if secs[b] == 'chorus' and secs[b - 1] == 'verse':
            for k in range(max(0, b - 2), b):
                if secs[k] == 'verse': secs[k] = 'build'
    chorus = next((tb(b) for b in range(nb) if secs[b] == 'chorus'), 0.0)
    return dict(dur=dur, bpm=float(bpm), spb=60 / bpm, st=15 / bpm, bar=240 / bpm, t0=float(t0), nb=nb, grid=grid16, secs=secs, chorusStart=max(0.0, chorus),
                melody=notes, kick=K, snare=Sn, hat=Hh, perc=Pall, env=(allf, fps, NFFT / 2 / SR))


# ---------------------------------------------------------------- 채보
DIFF = [   # grid: 멜로디 격자(16분음표 칸), gap: 최소 간격(초), jack: 같은 레인 최소 간격, hold: 롱노트 최소 길이(16분음표)
    dict(name='easy', grid=2, gap=0.42, jack=0.55, hold=4, drums=False, chords=1, inst='kick2', hats=False, lv=(1, 7)),
    dict(name='normal', grid=1, gap=0.17, jack=0.3, hold=3, drums='inst', chords=2, inst='ks', hats=False, lv=(5, 13)),
    dict(name='hard', grid=1, gap=0.1, jack=0.16, hold=3, drums='all', chords=3, inst='ksh', hats=True, lv=(10, 20)),
]


def make_chart(A, cfg):
    st, t0, bar = A['st'], A['t0'], A['bar']
    G = A['grid']; gi = np.arange(len(G))
    g_of = lambda t: int(round(float(np.interp(t, G, gi))))
    t_of = lambda g: float(G[min(len(G) - 1, max(0, g))])
    sec_of = lambda g: A['secs'][min(len(A['secs']) - 1, max(0, g // 16))]
    dur_end = A['dur'] - 0.3
    notes = []; free = [-9.0] * 4; lastT = -9.0; lane = 1; lastP = None; alt = 1
    # ---- 멜로디
    mel = []
    for a, b, p, e in A['melody']:
        g = g_of(a - 0.02)   # 노래는 자음이 먼저 나와 음높이가 박보다 조금 늦게 잡힘 → 반올림 전에 당김
        if cfg['grid'] > 1: g = int(round(g / cfg['grid'])) * cfg['grid']
        L = max(1, g_of(b) - g)
        if mel and mel[-1][0] == g:
            if e > mel[-1][3]: mel[-1] = (g, L, p, e)
            continue
        mel.append((g, L, p, e))
    # 노래가 없는 간주 마디: 2마디마다 첫 박에 2박짜리 롱노트 (화음이 길게 깔리는 곳)
    sung_g = {m[0] // 16 for m in mel}
    lastp = mel[0][2] if mel else 60
    for b in range(len(A['secs'])):
        if A['secs'][b] in ('intro', 'break', 'outro') and b % 2 == 0 and b not in sung_g and (b + 1) not in sung_g:
            mel.append((b * 16, 8, lastp + (b % 4 - 1.5), 0.0))
    mel.sort()
    for k, (g, L, p, e) in enumerate(mel):
        t = t_of(g)
        if t < 0.4 or t > dur_end or t - lastT < cfg['gap']: continue
        nxt = mel[k + 1][0] if k + 1 < len(mel) else g + 64
        L = min(L, nxt - g)   # 다음 음 전에 끝나게
        if lastP is None: want = 1
        else:
            d = p - lastP
            if abs(d) < 0.5: want = lane + alt; alt = -alt   # 같은 음: 옆 레인과 번갈아
            elif d > 0: want = lane + (2 if d >= 5 else 1)
            else: want = lane - (2 if d <= -5 else 1)
            if want > 3: want = 2 if lane == 3 else 3
            if want < 0: want = 1 if lane == 0 else 0
        l = pick(want, t, free, cfg['jack'])
        if l < 0: continue
        du = 0.0
        if L >= cfg['hold']: du = t_of(g + min(L, 32)) - t - min(0.06, st / 2)   # 다음 음과 붙지 않게 살짝 짧게
        if du < 0.25: du = 0.0
        notes.append([round(t, 4), l, round(du, 4), 'm']); free[l] = t + du; lastT = t; lane = l; lastP = p
    # ---- 드럼 (간주·후렴 등)
    if cfg['drums'] or cfg['inst']:
        mt = {round(n[0], 3) for n in notes}
        drum = [(t, 'k', s) for t, s in A['kick']] + [(t, 's', s) for t, s in A['snare']] + ([(t, 'h', s) for t, s in A['hat']] if cfg['hats'] else [])
        drum.sort()
        byg = {}
        for t, kind, s in drum:
            g = g_of(t)
            if g < 0: continue
            sec = sec_of(g); sung = sec in ('verse', 'chorus', 'build')
            if cfg['name'] == 'easy':
                if sung or kind != 'k' or g % 8: continue   # 하: 간주에서 1·3박 킥만
            elif cfg['name'] == 'normal':
                if sung:   # 중: 노래 중엔 후렴의 1박 킥(동시치기)과 2·4박 스네어만
                    if sec != 'chorus' or not ((kind == 'k' and g % 16 == 0) or (kind == 's' and g % 8 == 4)) or s < 0.4: continue
                elif kind == 'h' or g % 2: continue
            else:   # 상: 노래 중엔 4분음표 킥·2·4박 스네어(후렴은 8분까지), 간주는 8분 킥·스네어·하이햇
                if sung:
                    if kind == 'h': continue
                    step = 2 if sec == 'chorus' else 4
                    if g % step or s < 0.35: continue
                else:
                    if g % 2 or (kind == 'h' and s < 0.5): continue
            if g not in byg or byg[g][1] < s: byg[g] = (kind, s)
        dn = []
        for g, (kind, s) in sorted(byg.items()):
            t = t_of(g)
            if t < 0.4 or t > dur_end: continue
            same = [n for n in notes if abs(n[0] - t) < 0.01]
            if len(same) >= cfg['chords']: continue
            if not same and any(abs(n[0] - t) < cfg['gap'] for n in notes): continue
            if not same and dn and t - dn[-1] < cfg['gap']: continue
            used = {n[1] for n in same}
            want = {'k': 0 if (g // 4) % 2 == 0 else 3, 's': 2 if (g // 8) % 2 else 1, 'h': 3 if (g // 2) % 2 else 0}[kind]
            if same: want = 3 if same[0][1] < 2 else 0   # 멜로디 반대쪽 손
            busy = [-9.0] * 4
            for n in notes:
                if n[2] > 0 and n[0] - 0.01 <= t <= n[0] + n[2] + 0.05: busy[n[1]] = 9e9   # 롱노트 누르는 중인 레인
                elif n[0] < t and t - n[0] < cfg['jack']: busy[n[1]] = max(busy[n[1]], n[0])
            l = pick(want, t, busy, cfg['jack'], used)
            if l < 0: continue
            notes.append([round(t, 4), l, 0.0, kind]); dn.append(t)
    notes.sort(key=lambda n: (n[0], n[1]))
    # 같은 레인 겹침(롱노트 중에 같은 레인 노트) 제거
    out = []; endL = [-9.0] * 4
    for n in notes:
        if n[0] < endL[n[1]] + 0.05: continue
        out.append(n); endL[n[1]] = n[0] + n[2]
    return out


def pick(want, t, free, jack, used=()):
    for l in (want, want + 1, want - 1, want + 2, want - 2, want + 3, want - 3):
        if 0 <= l <= 3 and l not in used and t - free[l] >= jack: return l
    return -1


def level_of(notes, cfg):
    if len(notes) < 2: return cfg['lv'][0], {}
    ts = np.array([n[0] for n in notes]); span = ts[-1] - ts[0]
    avg = len(notes) / span
    j = 0; peak = 0
    for i in range(len(ts)):
        while ts[i] - ts[j] > 4: j += 1
        peak = max(peak, i - j + 1)
    peak /= 4
    _, cnt = np.unique(np.round(ts, 3), return_counts=True); chord = (cnt > 1).sum() / len(cnt)
    holdf = sum(1 for n in notes if n[2] > 0) / len(notes)
    raw = 1.45 * avg + 0.95 * peak + 6 * chord + 2 * holdf - 0.8
    lv = 1 + (raw - 1) * 1.15   # 1~20 눈금: 가장 빽빽한 상 채보가 20 근처
    return int(np.clip(round(lv), *cfg['lv'])), dict(avg=round(avg, 2), peak=round(peak, 2), chord=round(chord, 2), hold=round(holdf, 2), raw=round(raw, 1))


def verify(A, notes):
    """채보 노트가 실제 소리(온셋)와 맞는지: ±45ms 안에 온셋이 있는 비율, 멜로디 노트의 위치 오차"""
    env, fps, c = A['env']; th = np.percentile(env, 80)
    ok = 0
    for n in notes:
        i = int(round((n[0] + ONSET_BIAS - c) * fps)); w = int(0.045 * fps)
        if env[max(0, i - w):i + w + 1].max() >= th: ok += 1
    errs = []
    for n in notes:
        if n[3] != 'm': continue
        d = min(A['melody'], key=lambda m: abs(m[0] - n[0]))
        errs.append(abs(d[0] - n[0]))
    return round(ok / max(1, len(notes)), 3), round(float(np.median(errs)) * 1000 if errs else 0, 1)


def build(path, out, force_bpm=None):
    x = load(path); A = analyze(x, force_bpm)
    charts = []
    for cfg in DIFF:
        notes = make_chart(A, cfg); lv, m = level_of(notes, cfg); hit, merr = verify(A, notes)
        charts.append(dict(level=lv, notes=[n[:3] for n in notes], stats=dict(m, count=len(notes), onsetHit=hit, melodyErrMs=merr)))
    res = dict(bpm=round(A['bpm'], 3), t0=round(A['t0'], 4), bar=A['bar'], spb=A['spb'], st=A['st'], nb=A['nb'], duration=round(A['dur'], 3),
               chorusStart=round(A['chorusStart'], 3), secs=A['secs'], charts=charts)
    json.dump(res, open(out, 'w'), ensure_ascii=False, separators=(',', ':'))
    name = os.path.basename(path)
    print(f"{name}: bpm {res['bpm']} t0 {res['t0']} 멜로디 {len(A['melody'])}음 구간 {''.join(s[0] for s in A['secs'])}")
    for d, c in zip(DIFF, charts): print(f"   {d['name']:6s} Lv{c['level']:2d} {c['stats']}")
    return res


def selftest():
    """합성 드럼(킥·스네어·하이햇)을 정해진 시각에 놓고, 검출한 박자 위치가 실제와 얼마나 다른지 잰다"""
    rng = np.random.default_rng(1); bpm = 120; spb = 0.5; dur = 40; x = np.zeros(int(SR * dur), np.float32) + rng.normal(0, 0.003, int(SR * dur)).astype(np.float32)
    t_true = 0.37
    for k in range(int((dur - 1) / spb * 2)):
        t = t_true + k * spb / 2; i = int(t * SR); n = np.arange(int(0.25 * SR))
        if k % 4 == 0: x[i:i + len(n)] += 0.8 * np.sin(2 * np.pi * (55 + 60 * np.exp(-n / 400)) * n / SR) * np.exp(-n / 2500)
        if k % 4 == 2: x[i:i + len(n)] += 0.4 * rng.normal(0, 1, len(n)) * np.exp(-n / 1500)
        x[i:i + 600] += 0.15 * rng.normal(0, 1, 600) * np.exp(-np.arange(600) / 150)
    A = analyze(x, 120)
    r = ((A['t0'] - t_true) / (spb / 4)); err = (r - round(r)) * spb / 4
    print('합성 드럼: 박자 위치 오차', round(err * 1000, 1), 'ms (ONSET_BIAS에 더하면 0이 됨)')


if __name__ == '__main__':
    if sys.argv[1] == '--selftest': selftest()
    elif sys.argv[1] == '--all':
        for p in sorted(glob.glob(os.path.join(GDIR, '*.mp3'))):
            n = os.path.basename(p)[:-4]; build(p, os.path.join(GDIR, n + '.json'), BPM_FIX.get(n))
    else: build(sys.argv[1], sys.argv[2], float(sys.argv[3]) if len(sys.argv) > 3 else None)
