# 분석한 템포가 곡 전체에서 박자에 맞는지 검사: 16초 구간마다 박 위치 온셋 세기(on)와 엇박(off), 위상 어긋남(ms)
import sys, json, numpy as np, analyze_song as A
mp3, js = sys.argv[1], sys.argv[2]
x = A.load(mp3); S = A.stft_mag(x); fps = A.SR / A.HOP
allf = A.norm(A.band_flux(S, 30, 11000)); kick = A.norm(A.band_flux(S, 30, 150))
d = json.load(open(js)); spb = d['spb']; t0 = d['t0']; dur = d['duration']
at = lambda sig, ts: sig[np.clip(np.round(np.asarray(ts) * fps).astype(int), 0, len(sig) - 1)]
drifts = []; ratios = []
for w0 in range(0, int(dur) - 16, 16):
    ts = np.array([t for t in np.arange(t0, dur, spb) if w0 <= t < w0 + 16])
    best = max(np.linspace(-spb / 2, spb / 2, 41), key=lambda o: at(allf, ts + o).sum())
    drifts.append(round(best * 1000)); ratios.append(round(at(allf, ts).mean() / (at(allf, ts + spb / 2).mean() + 1e-6), 1))
b = np.arange(t0, dur, spb); b = b[b > 0]
half = at(allf, b[::2]).mean() / (at(allf, b[1::2]).mean() + 1e-6)
print(d['bpm'], 'drift', drifts, 'on/off', ratios, 'even/odd beats', round(half, 2))
