// 헬릭스 소리: 효과음은 시작할 때 버퍼로 합성, 배경음은 장소별 곡을 실시간 시퀀서로 연주
'use strict';
const AUDIO = (() => {
  let ctx = null, master, sfxBus, musBus, comp, delay, delayFb, delayBus, SR = 44100;
  const buf = {};
  const vol = {sfx: 0.8, music: 0.6};
  const rnd = (a, b) => a + Math.random() * (b - a);

  // ---------------- 합성 도우미 (Float32Array에 직접 그림)
  function mk(sec) { return new Float32Array(Math.max(1, Math.floor(sec * SR))); }
  function env(t, a, d, len) { if (t < a) return t / a; return Math.max(0, 1 - (t - a) / Math.max(1e-4, d)) * (t < len ? 1 : 0); }
  function noiseFill(n) { const o = new Float32Array(n); for (let i = 0; i < n; i++) o[i] = Math.random() * 2 - 1; return o; }
  // 단순 1극 필터
  function lp(x, fc) { const o = new Float32Array(x.length); let y = 0; const k = 1 - Math.exp(-2 * Math.PI * fc / SR); for (let i = 0; i < x.length; i++) { y += k * (x[i] - y); o[i] = y; } return o; }
  function hp(x, fc) { const l = lp(x, fc); const o = new Float32Array(x.length); for (let i = 0; i < x.length; i++) o[i] = x[i] - l[i]; return o; }
  // 시간에 따라 차단 주파수가 변하는 저역 필터
  function lpSweep(x, f0, f1) { const o = new Float32Array(x.length); let y = 0; for (let i = 0; i < x.length; i++) { const f = f0 + (f1 - f0) * i / x.length; const k = 1 - Math.exp(-2 * Math.PI * f / SR); y += k * (x[i] - y); o[i] = y; } return o; }
  function bp(x, f, q = 1) { return hp(lp(x, f * (1 + 0.5 / q)), f / (1 + 0.5 / q)); }
  function tone(sec, f0, f1, type = 'sine', a = 0.002, d = null) {
    const o = mk(sec); let ph = 0; d = d ?? sec;
    for (let i = 0; i < o.length; i++) {
      const t = i / SR, u = i / o.length, f = f0 * Math.pow(f1 / f0, u); ph += 2 * Math.PI * f / SR;
      let s = type === 'sine' ? Math.sin(ph) : type === 'tri' ? 2 / Math.PI * Math.asin(Math.sin(ph)) : type === 'sq' ? (Math.sin(ph) > 0 ? 0.6 : -0.6) : ((ph / Math.PI) % 2) - 1;
      o[i] = s * env(t, a, d, sec);
    }
    return o;
  }
  function mix(...parts) { const n = Math.max(...parts.map(p => p[0].length + Math.floor((p[2] || 0) * SR))); const o = new Float32Array(n); for (const [x, g, off] of parts) { const s = Math.floor((off || 0) * SR); for (let i = 0; i < x.length; i++) o[i + s] += x[i] * g; } return o; }
  function shape(x, fn) { for (let i = 0; i < x.length; i++) x[i] *= fn(i / SR, i / x.length); return x; }
  function norm(x, peak = 0.9) { let m = 0; for (const v of x) m = Math.max(m, Math.abs(v)); if (m > 0) for (let i = 0; i < x.length; i++) x[i] *= peak / m; // 끝을 부드럽게
    const f = Math.min(x.length, Math.floor(0.004 * SR)); for (let i = 0; i < f; i++) x[x.length - 1 - i] *= i / f; return x; }
  function toBuf(x) { const b = ctx.createBuffer(1, x.length, SR); b.copyToChannel(x, 0); return b; }

  // ---------------- 효과음 정의
  const DEF = {
    swing1: () => norm(mix([shape(bp(noiseFill(mk(0.22).length), 1800, 0.8), (t, u) => Math.sin(Math.PI * Math.min(1, u * 1.4)) ** 2), 0.9], [tone(0.18, 900, 500, 'tri', 0.01, 0.17), 0.12])),
    swing2: () => norm(mix([shape(bp(noiseFill(mk(0.22).length), 2200, 0.8), (t, u) => Math.sin(Math.PI * Math.min(1, u * 1.3)) ** 2), 0.9], [tone(0.18, 1100, 600, 'tri', 0.01, 0.17), 0.12])),
    swing3: () => norm(mix([shape(lpSweep(noiseFill(mk(0.34).length), 600, 3000), (t, u) => Math.sin(Math.PI * Math.min(1, u * 1.2)) ** 2), 1], [tone(0.3, 300, 120, 'saw', 0.02, 0.28), 0.12])),
    spin: () => norm(mix([shape(bp(noiseFill(mk(0.4).length), 1400, 0.7), (t, u) => Math.abs(Math.sin(Math.PI * u * 2.2)) * (1 - u * 0.5)), 1], [tone(0.38, 500, 900, 'tri', 0.02, 0.35), 0.1])),
    hit: () => norm(mix([tone(0.12, 160, 55, 'sine', 0.001, 0.11), 1], [shape(lp(noiseFill(mk(0.05).length), 3500), (t, u) => 1 - u), 0.7], [tone(0.06, 1800, 900, 'tri', 0.001, 0.05), 0.15])),
    hitHeavy: () => norm(mix([tone(0.2, 120, 40, 'sine', 0.001, 0.19), 1], [shape(lp(noiseFill(mk(0.1).length), 2500), (t, u) => (1 - u) ** 2), 0.9], [tone(0.12, 900, 300, 'sq', 0.001, 0.1), 0.12])),
    crit: () => norm(mix([tone(0.14, 150, 50, 'sine', 0.001, 0.13), 1], [tone(0.3, 2400, 2400, 'sine', 0.001, 0.28), 0.35], [tone(0.3, 3600, 3600, 'sine', 0.001, 0.2), 0.2], [shape(hp(noiseFill(mk(0.04).length), 3000), (t, u) => 1 - u), 0.6])),
    squish: () => norm(mix([tone(0.14, 420, 140, 'sine', 0.002, 0.13), 0.8], [shape(lp(noiseFill(mk(0.12).length), 1200), (t, u) => (1 - u) * (0.6 + 0.4 * Math.sin(u * 60))), 0.8])),
    die: () => norm(mix([tone(0.3, 300, 60, 'sine', 0.002, 0.28), 0.8], [shape(lp(noiseFill(mk(0.3).length), 900), (t, u) => (1 - u) ** 1.5), 0.9], [tone(0.08, 900, 1400, 'sine', 0.001, 0.07), 0.3, 0.05])),
    dash: () => norm(shape(lpSweep(noiseFill(mk(0.22).length), 4000, 800), (t, u) => Math.sin(Math.PI * u) ** 1.5)),
    leap: () => norm(mix([shape(lpSweep(noiseFill(mk(0.3).length), 500, 3000), (t, u) => Math.sin(Math.PI * u)), 1], [tone(0.3, 200, 500, 'tri', 0.05, 0.25), 0.2])),
    slam: () => norm(mix([tone(0.5, 90, 30, 'sine', 0.001, 0.48), 1], [shape(lp(noiseFill(mk(0.4).length), 1500), (t, u) => (1 - u) ** 2), 0.9], [shape(hp(noiseFill(mk(0.08).length), 2000), (t, u) => 1 - u), 0.4])),
    throw: () => norm(shape(bp(noiseFill(mk(0.18).length), 1200, 1), (t, u) => Math.sin(Math.PI * u))),
    splash: () => { const p = []; for (let k = 0; k < 9; k++) p.push([tone(0.06, rnd(500, 1400), rnd(1500, 2600), 'sine', 0.001, 0.05), 0.35, k * 0.025 + rnd(0, 0.02)]); p.push([shape(lp(noiseFill(mk(0.3).length), 1800), (t, u) => (1 - u) ** 2), 0.8]); return norm(mix(...p)); },
    sizzle: () => norm(shape(hp(noiseFill(mk(0.25).length), 4000), (t, u) => (1 - u) * (0.5 + 0.5 * Math.random())), 0.5),
    zap: () => { const x = noiseFill(mk(0.18).length); for (let i = 0; i < x.length; i++) x[i] *= (Math.random() < 0.3 ? 1 : 0.1) * (1 - i / x.length); return norm(mix([hp(x, 1500), 1], [tone(0.15, 1600, 400, 'sq', 0.001, 0.14), 0.25])); },
    ultCharge: () => norm(mix([tone(0.9, 200, 800, 'saw', 0.3, 0.6), 0.3], [tone(0.9, 300, 1200, 'tri', 0.3, 0.6), 0.4], [shape(lpSweep(noiseFill(mk(0.9).length), 300, 4000), (t, u) => u), 0.5])),
    ultBoom: () => norm(mix([tone(0.9, 70, 25, 'sine', 0.001, 0.85), 1], [shape(lp(noiseFill(mk(0.7).length), 1200), (t, u) => (1 - u) ** 1.5), 0.9], [tone(0.6, 523, 523, 'tri', 0.01, 0.55), 0.2], [tone(0.6, 784, 784, 'tri', 0.01, 0.55), 0.18], [tone(0.6, 1046, 1046, 'tri', 0.01, 0.55), 0.14])),
    coin: () => norm(mix([tone(0.09, 1568, 1568, 'sq', 0.001, 0.08), 0.5], [tone(0.18, 2093, 2093, 'sq', 0.001, 0.16), 0.5, 0.07])),
    dna: () => norm(mix([tone(0.12, 880, 880, 'tri', 0.001, 0.1), 0.5], [tone(0.12, 1320, 1320, 'tri', 0.001, 0.1), 0.5, 0.06], [tone(0.25, 1760, 1760, 'tri', 0.001, 0.22), 0.5, 0.12])),
    heal: () => norm(mix([tone(0.4, 523, 523, 'sine', 0.05, 0.3), 0.4], [tone(0.4, 659, 659, 'sine', 0.05, 0.3), 0.4, 0.08], [tone(0.5, 784, 784, 'sine', 0.05, 0.4), 0.4, 0.16])),
    trait: () => { const p = []; [523, 659, 784, 1046, 1318].forEach((f, k) => p.push([tone(0.5, f, f, 'tri', 0.005, 0.45), 0.35, k * 0.06])); p.push([shape(hp(noiseFill(mk(0.6).length), 5000), (t, u) => (1 - u) * 0.5), 0.2]); return norm(mix(...p)); },
    door: () => norm(mix([shape(bp(noiseFill(mk(0.5).length), 600, 0.6), (t, u) => Math.sin(Math.PI * u)), 0.7], [tone(0.4, 440, 440, 'tri', 0.01, 0.35), 0.3, 0.2], [tone(0.5, 660, 660, 'tri', 0.01, 0.45), 0.3, 0.3])),
    clear: () => { const p = []; [392, 523, 659, 784].forEach((f, k) => p.push([tone(0.35, f, f, 'tri', 0.005, 0.3), 0.4, k * 0.09])); p.push([tone(0.8, 1046, 1046, 'sine', 0.01, 0.75), 0.35, 0.36]); return norm(mix(...p)); },
    click: () => norm(mix([tone(0.03, 1200, 900, 'sq', 0.001, 0.025), 0.5], [shape(hp(noiseFill(mk(0.015).length), 3000), (t, u) => 1 - u), 0.3])),
    hover: () => norm(tone(0.025, 2000, 2000, 'sine', 0.001, 0.02), 0.4),
    confirm: () => norm(mix([tone(0.1, 660, 660, 'tri', 0.002, 0.09), 0.5], [tone(0.18, 990, 990, 'tri', 0.002, 0.16), 0.5, 0.07])),
    deny: () => norm(mix([tone(0.12, 220, 200, 'sq', 0.002, 0.11), 0.4], [tone(0.15, 165, 150, 'sq', 0.002, 0.14), 0.4, 0.09])),
    hurt: () => norm(mix([tone(0.22, 220, 80, 'saw', 0.001, 0.2), 0.5], [tone(0.16, 120, 50, 'sine', 0.001, 0.15), 0.9], [shape(lp(noiseFill(mk(0.12).length), 2000), (t, u) => 1 - u), 0.5])),
    heart: () => norm(mix([tone(0.1, 70, 50, 'sine', 0.005, 0.09), 1], [tone(0.1, 60, 45, 'sine', 0.005, 0.09), 0.8, 0.16])),
    // 무기 · 적 고유 공격
    gun: () => norm(mix([shape(hp(noiseFill(mk(0.03).length), 4000), (t, u) => (1 - u) ** 2), 0.7], [shape(lp(noiseFill(mk(0.12).length), 2200), (t, u) => (1 - u) ** 3), 0.9], [tone(0.09, 420, 120, 'sq', 0.001, 0.08), 0.25], [tone(0.07, 160, 60, 'sine', 0.001, 0.07), 0.6])),
    blast: () => norm(mix([shape(lp(noiseFill(mk(0.45).length), 1600), (t, u) => (1 - u) ** 2.5), 1], [tone(0.25, 110, 35, 'sine', 0.001, 0.24), 0.9], [shape(hp(noiseFill(mk(0.04).length), 5000), (t, u) => 1 - u), 0.6], [shape(bp(noiseFill(mk(0.08).length), 2400, 3), (t, u) => 1 - u), 0.25, 0.32], [shape(bp(noiseFill(mk(0.06).length), 1600, 3), (t, u) => 1 - u), 0.25, 0.4])),
    laser: () => norm(mix([tone(0.1, 2400, 900, 'sq', 0.001, 0.09), 0.35], [tone(0.1, 1200, 600, 'sine', 0.001, 0.09), 0.6], [shape(hp(noiseFill(mk(0.05).length), 3000), (t, u) => 1 - u), 0.25])),
    jump: () => norm(mix([tone(0.15, 220, 520, 'sine', 0.002, 0.14), 0.6], [shape(bp(noiseFill(mk(0.1).length), 900, 1), (t, u) => 1 - u), 0.4])),
    land: () => norm(mix([tone(0.14, 140, 50, 'sine', 0.001, 0.13), 0.9], [shape(lp(noiseFill(mk(0.12).length), 900), (t, u) => (1 - u) ** 2), 0.7])),
    crystal: () => norm(mix([tone(0.4, 2600, 2500, 'sine', 0.001, 0.38), 0.5], [tone(0.3, 3900, 3700, 'sine', 0.001, 0.28), 0.3], [tone(0.2, 1700, 1500, 'tri', 0.001, 0.18), 0.4], [shape(hp(noiseFill(mk(0.05).length), 5000), (t, u) => 1 - u), 0.3])),
    buzz: () => { const o = mk(0.4); let ph = 0; for (let i = 0; i < o.length; i++) { const t = i / SR; ph += 2 * Math.PI * (440 + 60 * Math.sin(t * 50)) / SR; o[i] = ((ph / Math.PI) % 2 - 1) * Math.sin(Math.PI * i / o.length); } return norm(lp(o, 2400)); },
    whip: () => norm(mix([shape(lpSweep(noiseFill(mk(0.18).length), 600, 5000), (t, u) => Math.sin(Math.PI * u) ** 3), 1], [shape(bp(noiseFill(mk(0.05).length), 3000, 2), (t, u) => 1 - u), 0.5, 0.14])),
    dig: () => norm(mix([shape(lp(noiseFill(mk(0.45).length), 500), (t, u) => Math.sin(Math.PI * u) * (0.6 + 0.4 * Math.sin(t * 60))), 1], [tone(0.4, 90, 50, 'sine', 0.05, 0.35), 0.4])),
    boom: () => norm(mix([tone(0.7, 80, 25, 'sine', 0.001, 0.68), 1], [shape(lp(noiseFill(mk(0.7).length), 1200), (t, u) => (1 - u) ** 2), 1], [shape(hp(noiseFill(mk(0.05).length), 4000), (t, u) => 1 - u), 0.5])),
    bite: () => norm(mix([shape(bp(noiseFill(mk(0.08).length), 1400, 2), (t, u) => (1 - u) ** 2), 0.8], [tone(0.08, 300, 140, 'sq', 0.001, 0.07), 0.3], [shape(bp(noiseFill(mk(0.05).length), 900, 2), (t, u) => 1 - u), 0.6, 0.06])),
    spit: () => norm(mix([shape(bp(noiseFill(mk(0.22).length), 1300, 4), (t, u) => Math.sin(Math.PI * u) ** 2), 0.9], [tone(0.18, 500, 180, 'sine', 0.01, 0.17), 0.4])),
    shoot: () => norm(mix([tone(0.14, 700, 250, 'sine', 0.001, 0.13), 0.7], [shape(lp(noiseFill(mk(0.08).length), 2500), (t, u) => 1 - u), 0.4])),
    beamCharge: () => norm(mix([tone(0.8, 150, 600, 'saw', 0.1, 0.7), 0.4], [tone(0.8, 300, 1200, 'sine', 0.1, 0.7), 0.4])),
    beam: () => { const x = mix([tone(0.6, 110, 100, 'saw', 0.01, 0.58), 0.6], [tone(0.6, 220, 200, 'sq', 0.01, 0.58), 0.3], [hp(noiseFill(mk(0.6).length), 2000), 0.25]); return norm(shape(x, (t, u) => 0.7 + 0.3 * Math.sin(t * 90))); },
    warn: () => norm(mix([tone(0.08, 600, 900, 'sq', 0.002, 0.07), 0.3], [tone(0.08, 900, 1200, 'sq', 0.002, 0.07), 0.3, 0.09])),
    spawn: () => norm(mix([shape(lpSweep(noiseFill(mk(0.5).length), 200, 2500), (t, u) => u * (1 - u) * 4), 0.6], [tone(0.5, 300, 900, 'tri', 0.2, 0.3), 0.25])),
    roar: () => { const x = mix([tone(1.1, 90, 60, 'saw', 0.08, 1.0), 0.6], [tone(1.1, 135, 85, 'saw', 0.08, 1.0), 0.4], [lp(noiseFill(mk(1.1).length), 700), 0.6]); return norm(lp(shape(x, (t, u) => (0.7 + 0.3 * Math.sin(t * 38)) * Math.min(1, t * 6) * (1 - u) ** 0.6), 1600)); },
    step: () => norm(shape(lp(noiseFill(mk(0.05).length), 900), (t, u) => (1 - u) ** 3), 0.25),
    blip: () => norm(tone(0.035, 880 + Math.random() * 60, 860, 'sq', 0.001, 0.03), 0.18),
    block: () => norm(mix([tone(0.3, 1800, 1700, 'sine', 0.001, 0.28), 0.5], [tone(0.3, 2700, 2650, 'sine', 0.001, 0.25), 0.3], [shape(hp(noiseFill(mk(0.03).length), 4000), (t, u) => 1 - u), 0.5])),
    burst: () => norm(mix([tone(0.25, 200, 50, 'sine', 0.001, 0.24), 0.8], [shape(lp(noiseFill(mk(0.25).length), 2500), (t, u) => (1 - u) ** 2), 1])),
    meow: () => norm(lp(mix([tone(0.4, 700, 500, 'saw', 0.04, 0.35), 0.4], [tone(0.4, 1050, 760, 'sine', 0.04, 0.35), 0.5]), 2500), 0.6),
    boot: () => norm(mix([tone(0.15, 400, 800, 'sine', 0.005, 0.14), 0.3], [tone(0.15, 800, 1600, 'sine', 0.005, 0.14), 0.25, 0.08])),
    portal: () => norm(mix([shape(lpSweep(noiseFill(mk(1.2).length), 200, 3000), (t, u) => Math.sin(Math.PI * u)), 0.6], [tone(1.2, 220, 880, 'tri', 0.3, 0.8), 0.3], [tone(1.2, 330, 1320, 'sine', 0.3, 0.8), 0.25])),
  };
  const GAIN = {gun: 0.5, blast: 0.85, laser: 0.35, buzz: 0.4, dig: 0.5, boom: 0.85, step: 0.35, blip: 0.5, hover: 0.4, sizzle: 0.35, swing1: 0.55, swing2: 0.55, swing3: 0.65, spin: 0.6, hit: 0.75, squish: 0.6, die: 0.7, dash: 0.55, heart: 0.8, warn: 0.45, roar: 0.9, beam: 0.6};

  // ---------------- 배경음: 장소별 곡
  const NOTE = n => 440 * Math.pow(2, (n - 69) / 12);
  // 화음은 근음 기준 반음 간격, 진행은 [근음 미디 번호, 화음 종류]
  const CH = {m: [0, 3, 7, 10], M: [0, 4, 7, 11], s: [0, 5, 7, 10], d: [0, 3, 6, 9]};
  const SONGS = {
    hub:   {bpm: 82, prog: [[62, 'm'], [67, 'M'], [62, 'm'], [60, 'M']], bass: 'slow', arp: 'bell', drums: 'soft', pad: 0.32, cut: 1300},
    lab:   {bpm: 118, prog: [[57, 'm'], [53, 'M'], [60, 'M'], [55, 'M']], bass: 'pulse', arp: 'up16', drums: 'four', pad: 0.22, cut: 1800},
    sewer: {bpm: 100, prog: [[52, 'm'], [53, 'M'], [52, 'm'], [50, 'M']], bass: 'dub', arp: 'sparse', drums: 'dub', pad: 0.26, cut: 900},
    ward:  {bpm: 124, prog: [[61, 'm'], [57, 'M'], [61, 'm'], [56, 'M']], bass: 'ostinato', arp: 'tense', drums: 'four', pad: 0.24, cut: 1500},
    vault: {bpm: 132, prog: [[53, 'm'], [49, 'M'], [56, 'M'], [51, 'M']], bass: 'pulse', arp: 'up16', drums: 'break', pad: 0.3, cut: 2200},
    boss:  {bpm: 142, prog: [[50, 'm'], [50, 'm'], [46, 'M'], [48, 'M']], bass: 'drive', arp: 'tense', drums: 'break', pad: 0.26, cut: 2400},
    title: {bpm: 76, prog: [[57, 'm'], [53, 'M'], [55, 'M'], [52, 'm']], bass: 'slow', arp: 'bell', drums: 'none', pad: 0.34, cut: 1200},
  };
  let song = null, songName = '', step = 0, nextT = 0, intensity = 0, targetInt = 0, timer = null, songGain = null;
  const drumBuf = {};
  function makeDrums() {
    drumBuf.kick = toBuf(norm(mix([tone(0.4, 150, 42, 'sine', 0.001, 0.38), 1], [shape(lp(noiseFill(mk(0.02).length), 3000), (t, u) => 1 - u), 0.3])));
    drumBuf.snare = toBuf(norm(mix([shape(bp(noiseFill(mk(0.22).length), 2400, 0.6), (t, u) => (1 - u) ** 2.5), 0.9], [tone(0.12, 220, 180, 'tri', 0.001, 0.11), 0.4])));
    drumBuf.hat = toBuf(norm(shape(hp(noiseFill(mk(0.06).length), 7000), (t, u) => (1 - u) ** 3), 0.6));
    drumBuf.shaker = toBuf(norm(shape(hp(noiseFill(mk(0.09).length), 5000), (t, u) => Math.sin(Math.PI * u) ** 2), 0.4));
  }
  function playDrum(name, t, g) { const s = ctx.createBufferSource(); s.buffer = drumBuf[name]; const v = ctx.createGain(); v.gain.value = g; s.connect(v).connect(songGain); s.start(t); }
  function voice(t, freq, dur, kind, g, cut) {
    const o = ctx.createOscillator(), v = ctx.createGain(), f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = cut || 2000; f.Q.value = 0.7;
    o.frequency.value = freq;
    let a = 0.005, r = dur;
    if (kind === 'pad') { o.type = 'sawtooth'; a = Math.min(0.5, dur * 0.3); }
    else if (kind === 'bass') { o.type = 'square'; a = 0.005; f.frequency.setValueAtTime(cut * 1.6, t); f.frequency.exponentialRampToValueAtTime(Math.max(120, cut * 0.4), t + dur); }
    else if (kind === 'bell') { o.type = 'sine'; r = dur * 2.5; }
    else if (kind === 'pluck') { o.type = 'triangle'; r = dur * 1.4; }
    else if (kind === 'lead') { o.type = 'sawtooth'; a = 0.01; }
    v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(g, t + a); v.gain.exponentialRampToValueAtTime(0.0008, t + a + r);
    o.connect(f).connect(v).connect(songGain);
    if (kind === 'bell' || kind === 'pluck' || kind === 'lead') { const s = ctx.createGain(); s.gain.value = 0.35; v.connect(s).connect(delay); }
    o.start(t); o.stop(t + a + r + 0.05);
    if (kind === 'pad') { const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = freq * 1.006; o2.connect(f); o2.start(t); o2.stop(t + a + r + 0.05); }
    if (kind === 'bass') { const o2 = ctx.createOscillator(), v2 = ctx.createGain(); o2.type = 'sine'; o2.frequency.value = freq / 2; v2.gain.setValueAtTime(g * 0.9, t); v2.gain.exponentialRampToValueAtTime(0.0008, t + dur); o2.connect(v2).connect(songGain); o2.start(t); o2.stop(t + dur + 0.05); }
  }
  function schedule() {
    if (!song) return;
    const spb = 60 / song.bpm / 4;   // 16분음표 길이
    while (nextT < ctx.currentTime + 0.15) {
      intensity += (targetInt - intensity) * 0.02;
      const bar = Math.floor(step / 16), s = step % 16, [root, q] = song.prog[bar % song.prog.length], chord = CH[q];
      const I = intensity, t = nextT;
      // 패드: 마디 시작
      if (s === 0) chord.slice(0, 3).forEach((iv, k) => voice(t, NOTE(root + iv + 12), spb * 16 * 0.95, 'pad', song.pad * 0.05 * (1 - I * 0.25), song.cut));
      // 베이스
      const b = song.bass, bn = NOTE(root - 12);
      if (b === 'slow' && (s === 0 || s === 10)) voice(t, bn, spb * 6, 'bass', 0.07, 600);
      if (b === 'pulse' && s % 2 === 0 && (I > 0.3 || s % 4 === 0)) voice(t, s === 6 || s === 14 ? NOTE(root - 12 + 7) : bn, spb * 1.6, 'bass', 0.06, 900);
      if (b === 'dub' && [0, 3, 8, 11].includes(s)) voice(t, s === 11 ? NOTE(root - 12 + 7) : bn, spb * 2.5, 'bass', 0.08, 500);
      if (b === 'ostinato' && s % 2 === 0) voice(t, NOTE(root - 12 + [0, 0, 12, 0, 7, 0, 12, 10][s / 2]), spb * 1.5, 'bass', 0.055, 1000);
      if (b === 'drive' && s % 1 === 0 && (s % 2 === 0 || I > 0.6)) voice(t, NOTE(root - 12 + (s % 8 === 6 ? 3 : 0)), spb * 0.9, 'bass', 0.055, 1300);
      // 아르페지오/선율
      const a = song.arp, notes = chord.map(iv => root + iv + 24);
      if (a === 'bell' && s % 4 === 2) voice(t, NOTE(notes[(s / 4 + bar) % 4] + (bar % 2 ? 0 : 12)), spb * 3, 'bell', 0.05, 4000);
      if (a === 'up16' && (I > 0.25 || s % 4 === 0)) voice(t, NOTE(notes[s % 4] + (s >= 8 ? 12 : 0)), spb * 0.9, 'pluck', 0.035, 3000);
      if (a === 'sparse' && [2, 7, 13].includes(s)) voice(t, NOTE(notes[(s + bar) % 4]), spb * 2, 'pluck', 0.04, 2200);
      if (a === 'tense' && s % 2 === 1) voice(t, NOTE(notes[[0, 1, 0, 2, 0, 1, 3, 2][(s - 1) / 2]] + 12), spb * 0.8, 'pluck', 0.03, 3500);
      if (I > 0.7 && (song.drums === 'break' || song.drums === 'four') && bar % 4 === 3 && s % 4 === 0) voice(t, NOTE(notes[(s / 4) % 4] + 12), spb * 3.5, 'lead', 0.025, 2600);
      // 북
      const d = song.drums;
      if (d === 'soft') { if (s === 0 && I > 0.4) playDrum('kick', t, 0.4); if (s % 4 === 2) playDrum('shaker', t, 0.25); }
      if (d === 'four') { if (s % 4 === 0 && I > 0.25) playDrum('kick', t, 0.6); if ((s === 4 || s === 12) && I > 0.45) playDrum('snare', t, 0.4); if (s % 2 === 0) playDrum('hat', t, 0.12 + 0.12 * I); }
      if (d === 'dub') { if ((s === 0 || s === 10) && I > 0.25) playDrum('kick', t, 0.6); if (s === 8 && I > 0.45) playDrum('snare', t, 0.45); if (s % 4 === 2) playDrum('hat', t, 0.18); }
      if (d === 'break') { if ([0, 6, 10].includes(s) && I > 0.2) playDrum('kick', t, 0.65); if ((s === 4 || s === 12 || (s === 15 && bar % 2)) && I > 0.4) playDrum('snare', t, 0.45); if (I > 0.3) playDrum('hat', t, s % 2 ? 0.08 : 0.16); }
      nextT += spb; step++;
    }
  }
  return {
    get ready() { return !!ctx; },
    init() {
      if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      ctx = new AC(); SR = ctx.sampleRate;
      comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
      master = ctx.createGain(); master.gain.value = 0.9; comp.connect(master).connect(ctx.destination);
      sfxBus = ctx.createGain(); sfxBus.gain.value = vol.sfx; sfxBus.connect(comp);
      musBus = ctx.createGain(); musBus.gain.value = vol.music; musBus.connect(comp);
      delay = ctx.createDelay(1.0); delay.delayTime.value = 0.32; delayFb = ctx.createGain(); delayFb.gain.value = 0.32; delayBus = ctx.createGain(); delayBus.gain.value = 0.5;
      const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 2500;
      delay.connect(dlp).connect(delayFb).connect(delay); dlp.connect(delayBus).connect(musBus);
      for (const k in DEF) { try { buf[k] = toBuf(DEF[k]()); } catch (e) { console.warn('sfx', k, e); } }
      makeDrums();
      timer = setInterval(() => { try { schedule(); } catch (e) {} }, 40);
    },
    play(name, g = 1, rate = 1, pan = 0) {
      if (!ctx || !buf[name]) return;
      const s = ctx.createBufferSource(); s.buffer = buf[name]; s.playbackRate.value = rate * (1 + (Math.random() - 0.5) * 0.06);
      const v = ctx.createGain(); v.gain.value = g * (GAIN[name] ?? 0.7);
      let node = s.connect(v);
      if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); node = node.connect(p); }
      node.connect(sfxBus); s.start();
    },
    music(name, int = 0) {
      if (!ctx) { songName = name; return; }
      targetInt = int;
      if (name === songName && song) return;
      songName = name;
      const old = songGain;
      if (old) { old.gain.setTargetAtTime(0, ctx.currentTime, 0.4); setTimeout(() => old.disconnect(), 2500); }
      songGain = ctx.createGain(); songGain.gain.value = 0; songGain.connect(musBus); songGain.gain.setTargetAtTime(1, ctx.currentTime + 0.2, 0.6);
      song = SONGS[name] || null; step = 0; nextT = ctx.currentTime + 0.1; intensity = int;
    },
    intensity(v) { targetInt = v; },
    setVol(kind, v) { vol[kind] = v; if (!ctx) return; (kind === 'sfx' ? sfxBus : musBus).gain.setTargetAtTime(v, ctx.currentTime, 0.05); },
    get vol() { return vol; },
    get name() { return songName; },
  };
})();
