# 바이오 비트: 실제 음원(mp3)을 분석해 채보 후보음을 만듭니다.
#   python3 analyze_song.py <음원.mp3> <출력.json> [BPM 강제값]
# 결과 JSON = {bpm, t0, bar, st, nb, secs[], duration, chorusStart, cand:[[t, gs, src, m, len], ...]}
#   t0: 0번 마디 시작 시각(음수일 수 있음), gs: 0번 마디부터 센 16분음표 칸 번호
#   src: kick / snare / lead / bass / pad / arp — 게임의 genChart()가 난이도별 채보를 만듦
import sys, json, subprocess
import numpy as np

SR = 22050; HOP = 256; NFFT = 2048


def load(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).copy()


def stft_mag(x):
    win = np.hanning(NFFT).astype(np.float32); n = 1 + (len(x) - NFFT) // HOP
    idx = np.arange(NFFT)[None, :] + HOP * np.arange(n)[:, None]
    return np.abs(np.fft.rfft(x[idx] * win, axis=1)).astype(np.float32)   # [프레임, 주파수]


def band_flux(S, lo, hi):
    f = np.fft.rfftfreq(NFFT, 1 / SR); b = (f >= lo) & (f < hi)
    L = np.log1p(S[:, b] * 10)
    d = np.diff(L, axis=0, prepend=L[:1]); d[d < 0] = 0
    return d.sum(axis=1)


def norm(v):
    v = v - np.convolve(v, np.ones(43) / 43, mode='same')   # 0.5초 이동 평균을 빼서 상대적인 '튀는 정도'만
    v[v < 0] = 0
    return v / (np.percentile(v, 99) + 1e-9)


def main():
    path, out = sys.argv[1], sys.argv[2]
    x = load(path); dur = len(x) / SR
    S = stft_mag(x); fps = SR / HOP; ft = (np.arange(len(S)) * HOP + NFFT / 2) / SR
    kick, snare, mid, hat, allf = norm(band_flux(S, 30, 150)), norm(band_flux(S, 1500, 5000)), norm(band_flux(S, 200, 1400)), norm(band_flux(S, 6000, 11000)), norm(band_flux(S, 30, 11000))
    rms = np.sqrt(np.convolve((x[:len(S) * HOP] ** 2).reshape(-1, HOP).mean(axis=1), np.ones(8) / 8, mode='same'))[:len(S)]

    # ---------------- 템포: 전체 온셋의 자기상관에서 70~180 BPM 사이 최대값 (빠르면 반으로)
    env = allf - allf.mean(); ac = np.correlate(env, env, mode='full')[len(env) - 1:]
    if len(sys.argv) > 3: bpm = float(sys.argv[3])
    else:
        best = None
        for b in np.arange(70, 180, 0.05):
            lag = fps * 60 / b; i = int(lag); fr = lag - i
            v = ac[i] * (1 - fr) + ac[i + 1] * fr
            v2 = ac[int(lag * 2)] if int(lag * 2) < len(ac) else 0
            sc = v + 0.5 * v2
            if best is None or sc > best[0]: best = (sc, b)
        bpm = best[1]
        # 미세 조정: 박 위치 온셋 합이 가장 큰 BPM (±0.6)
        def fitness(b):
            spb = 60 / b; bestp = 0
            for ph in np.linspace(0, spb, 48, endpoint=False):
                ts = np.arange(ph, dur, spb); fi = np.clip((ts * fps).astype(int), 0, len(allf) - 1)
                bestp = max(bestp, allf[fi].sum())
            return bestp
        bpm = max(np.arange(bpm - 0.6, bpm + 0.6, 0.02), key=fitness)
    spb = 60 / bpm; st = spb / 4; bar = spb * 4

    # ---------------- 박자 위상 + 마디 첫 박: 킥은 1·3박, 스네어는 2·4박에 많다고 보고 고름
    def at(sig, ts):
        fi = np.clip(np.round(ts * fps).astype(int), 0, len(sig) - 1)
        return np.maximum(sig[fi], np.maximum(sig[np.maximum(fi - 1, 0)], sig[np.minimum(fi + 1, len(sig) - 1)]))
    best = None
    for ph in np.linspace(0, spb, 96, endpoint=False):
        ts = np.arange(ph, dur, spb); v = at(allf, ts).sum()
        if best is None or v > best[0]: best = (v, ph)
    ph = best[1]
    beats = np.arange(ph, dur, spb); kb = at(kick, beats); sb = at(snare, beats)
    down = max(range(4), key=lambda k: kb[k::4].mean())   # 킥이 가장 센 박을 마디 첫 박으로
    t0 = ph + down * spb
    while t0 > 0: t0 -= bar   # 0번 마디가 음원 시작 전에 오도록
    nb = int(np.ceil((dur - t0) / bar)) + 1

    # ---------------- 구간: 8마디씩 소리 크기와 고음(보컬·심벌) 양으로 나눔
    nsec = int(np.ceil(nb / 8)); en = []
    for k in range(nsec):
        a, b = t0 + k * 8 * bar, t0 + (k + 1) * 8 * bar
        m = (ft >= a) & (ft < b)
        en.append(float(rms[m].mean()) if m.any() else 0.0)
    en = np.array(en); q = np.quantile(en[en > 0], [0.3, 0.68]) if (en > 0).any() else [0, 0]
    secs = []
    for k, e in enumerate(en):
        if k == 0 and e < q[1]: s = 'intro'
        elif k == nsec - 1: s = 'outro'
        elif e >= q[1]: s = 'chorus'
        elif e >= q[0]: s = 'verse'
        else: s = 'break'
        secs.append(s)
    # 후렴 바로 앞의 verse는 build로
    for k in range(1, nsec):
        if secs[k] == 'chorus' and secs[k - 1] == 'verse': secs[k - 1] = 'build'
    chorusStart = next((t0 + k * 8 * bar for k, s in enumerate(secs) if s == 'chorus'), 0.0)
    chorusStart = max(0.0, chorusStart)

    # ---------------- 후보음: 16분음표 칸마다 각 대역의 '튀는 정도'
    gs_all = np.arange(nb * 16); tg = t0 + gs_all * st
    ok = (tg > 0.3) & (tg < dur - 0.4)
    K, Sn, M, Hh = at(kick, tg), at(snare, tg), at(mid, tg), at(hat, tg)
    # 음 높이(대략): 200~1000Hz에서 가장 센 주파수 → MIDI
    f = np.fft.rfftfreq(NFFT, 1 / SR); pb = (f >= 200) & (f < 1000)
    fi = np.clip(np.round(tg * fps).astype(int), 0, len(S) - 1)
    pitch = 69 + 12 * np.log2(f[pb][S[fi][:, pb].argmax(axis=1)] / 440)
    cand = []
    lead_on = [g for g in gs_all if ok[g] and M[g] > 0.35 and M[g] >= M[max(0, g - 1)] and M[g] >= M[min(len(M) - 1, g + 1)]]
    lead_set = set(lead_on)
    for j, g in enumerate(lead_on):
        nxt = lead_on[j + 1] if j + 1 < len(lead_on) else g + 16
        cand.append([round(float(tg[g]), 4), int(g), 'lead', int(round(pitch[g])), int(min(16, nxt - g))])
    for g in gs_all:
        if not ok[g]: continue
        t = round(float(tg[g]), 4)
        if K[g] > 0.45 and K[g] >= K[max(0, g - 1)]: cand.append([t, int(g), 'kick', 0, 1])
        if Sn[g] > 0.45 and Sn[g] >= Sn[max(0, g - 1)] and g % 2 == 0: cand.append([t, int(g), 'snare', 0, 1])
        if Hh[g] > 0.5 and g % 2 == 0 and g not in lead_set: cand.append([t, int(g), 'arp', int(round(pitch[g])), 1])
        if K[g] > 0.3 and g % 4 == 2 and M[g] > 0.25: cand.append([t, int(g), 'bass', int(round(pitch[g])) - 24, 2])
    # 조용한 구간(break·intro)의 마디 첫 박은 긴 노트 후보
    for k, s in enumerate(secs):
        if s in ('break', 'intro'):
            for b in range(k * 8, k * 8 + 8, 2):
                g = b * 16
                if g < len(tg) and ok[g]: cand.append([round(float(tg[g]), 4), int(g), 'pad', 0, 16])
    cand.sort(key=lambda c: (c[0], c[2]))
    res = dict(bpm=round(float(bpm), 2), t0=round(float(t0), 4), bar=bar, st=st, spb=spb, nb=int(nb), secs=secs, duration=round(dur, 3),
               chorusStart=round(float(chorusStart), 3), cand=cand)
    json.dump(res, open(out, 'w'), ensure_ascii=False, separators=(',', ':'))
    from collections import Counter
    print('bpm', res['bpm'], 't0', res['t0'], 'bars', nb, 'secs', ''.join(s[0] for s in secs), 'cand', Counter(c[2] for c in cand), 'chorus@', res['chorusStart'])


if __name__ == '__main__':
    main()
