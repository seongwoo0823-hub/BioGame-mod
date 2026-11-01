/* 감염의 군주 — 사운드 엔진
   모든 소리는 실행 중에 합성한 샘플(소리마다 변형 3개)로 재생한다.
   재생 시: 변형 무작위 선택 · 음높이 흔들기 · 거리 감쇠와 먹먹해짐 · 좌우 위치 · 공간 잔향 · 같은 소리 동시 재생 제한 */
(function(){
const SR = 22050, TAU = Math.PI * 2;
function rng(seed){ let s = (seed * 2654435761) >>> 0 || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
// ---------------- DSP 부품 ----------------
function BQ(type){ // RBJ 바이쿼드 (매 샘플 주파수 변경 가능)
  let b0, b1, b2, a1, a2, x1 = 0, x2 = 0, y1 = 0, y2 = 0, lf = -1, lq = -1;
  const set = (f, q) => { if (f === lf && q === lq) return; lf = f; lq = q; f = Math.min(Math.max(f, 20), SR * 0.45); const w = TAU * f / SR, c = Math.cos(w), s = Math.sin(w), al = s / (2 * q), a0 = 1 + al;
    if (type === 'lp'){ b0 = (1 - c) / 2 / a0; b1 = (1 - c) / a0; b2 = b0; } else if (type === 'hp'){ b0 = (1 + c) / 2 / a0; b1 = -(1 + c) / a0; b2 = b0; } else { b0 = al / a0; b1 = 0; b2 = -al / a0; }
    a1 = -2 * c / a0; a2 = (1 - al) / a0; };
  return (x, f, q) => { set(f, q || 0.707); const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; };
}
function noiseGen(kind, r){ let b0 = 0, b1 = 0, b2 = 0, last = 0;
  if (kind === 'pink') return () => { const w = r() * 2 - 1; b0 = 0.997 * b0 + w * 0.029; b1 = 0.985 * b1 + w * 0.032; b2 = 0.95 * b2 + w * 0.048; return (b0 + b1 + b2 + w * 0.05) * 2.2; };
  if (kind === 'brown') return () => { last = (last + (r() * 2 - 1) * 0.06) * 0.996; return last * 3.2; };
  return () => r() * 2 - 1; }
const env = (t, a, d) => t < a ? t / a : Math.exp(-(t - a) / d);           // 빠른 상승 + 지수 감쇠
const swell = (t, dur, peak) => { const p = peak * dur; return t < p ? Math.sin(t / p * Math.PI / 2) : Math.cos((t - p) / (dur - p) * Math.PI / 2); };
const sat = x => Math.tanh(x);
function mk(dur){ return new Float32Array(Math.ceil(dur * SR)); }
function fin(d, gain){ // 정규화 + 끝 페이드
  let m = 0; for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i]));
  const k = m > 0 ? (gain || 0.9) / m : 1, fo = Math.min(d.length, 220);
  for (let i = 0; i < d.length; i++) d[i] *= k; for (let i = 0; i < fo; i++) d[d.length - 1 - i] *= i / fo; return d; }
// ---------------- 소리 부품 ----------------
function whoosh(r, dur, f0, f1, q, ring){ const d = mk(dur), n = noiseGen('white', r), bp = BQ('bp'), bp2 = BQ('bp'); const rf = ring ? 1800 + r() * 1400 : 0; let ph = 0;
  for (let i = 0; i < d.length; i++){ const t = i / SR, u = t / dur, f = f0 * Math.pow(f1 / f0, u); let x = bp(n(), f, q) + 0.5 * bp2(n(), f * 1.9, q * 1.4);
    if (ring){ ph += TAU * (rf + 300 * u) / SR; x += Math.sin(ph) * 0.18 * env(t, 0.02, 0.09); }
    d[i] = x * swell(t, dur, 0.38); } return fin(d, 0.8); }
function impact(r, o){ // 몸통(사인 하강) + 금속 배음 + 부서지는 잡음
  const dur = o.dur || 0.35, d = mk(dur), n = noiseGen('white', r), lp = BQ('lp'), bp = BQ('bp'); let ph = 0; const parts = (o.metal ? [1, 2.76, 5.4, 8.93] : []).map(k => [k * (o.metal * (0.9 + r() * 0.2)), r() * TAU]);
  for (let i = 0; i < d.length; i++){ const t = i / SR; const f = o.body * (1 + (o.drop || 2) * Math.exp(-t / 0.018));
    ph += TAU * f / SR; let x = Math.sin(ph) * env(t, 0.002, o.bodyD || 0.08) * (o.bodyA || 1);
    x += lp(n(), o.crackF || 3000, 0.7) * env(t, 0.001, o.crackD || 0.025) * (o.crack || 0.8);
    if (o.crunch) x += bp(n(), 900 + r() * 2200, 3) * (r() < 0.3 ? 1 : 0.2) * env(t, 0.001, o.crunchD || 0.06) * o.crunch;
    for (const p of parts){ p[1] += TAU * p[0] / SR; x += Math.sin(p[1]) * 0.22 * env(t, 0.001, (o.ringD || 0.25) / (1 + p[0] / 4000)); }
    d[i] = sat(x * 1.4); } return fin(d, o.gain || 0.95); }
function goo(r, dur, f0, wet){ const d = mk(dur), n = noiseGen('white', r), bp = BQ('bp'), lp = BQ('lp'); let wob = 0, bub = [];
  for (let k = 0; k < (wet || 3); k++) bub.push([r() * dur * 0.8, 180 + r() * 500, 0]);
  for (let i = 0; i < d.length; i++){ const t = i / SR; wob += (r() - 0.5) * 0.3; wob *= 0.995;
    let x = bp(n(), f0 * (1 + 0.6 * Math.sin(t * 60 + wob) * Math.exp(-t * 4)), 4) * env(t, 0.004, dur * 0.35);
    for (const b of bub){ const tt = t - b[0]; if (tt > 0 && tt < 0.08){ b[2] += TAU * b[1] * (1 + tt * 18) / SR; x += Math.sin(b[2]) * Math.exp(-tt / 0.025) * 0.6; } }
    d[i] = lp(x, 2600, 0.8); } return fin(d, 0.85); }
function crackle(r, dur, density, tone){ const d = mk(dur), n = noiseGen('white', r), lp = BQ('lp'), bp = BQ('bp'), br = noiseGen('brown', r);
  for (let i = 0; i < d.length; i++){ const t = i / SR; let x = lp(br(), 300, 0.7) * 0.5 * (tone == null ? 1 : tone);
    if (r() < density / SR) for (let k = 0; k < 30 && i + k < d.length; k++) d[i + k] += (r() * 2 - 1) * Math.exp(-k / 6) * (0.4 + r());
    d[i] += bp(x + n() * 0.15, 1200, 0.6); }
  return fin(d, 0.8); }
function boom(r, dur, low){ const d = mk(dur), br = noiseGen('brown', r), n = noiseGen('white', r), lp = BQ('lp'), lp2 = BQ('lp'); let ph = 0;
  for (let i = 0; i < d.length; i++){ const t = i / SR; ph += TAU * (low || 55) * (1 + 1.5 * Math.exp(-t / 0.05)) / SR;
    let x = Math.sin(ph) * env(t, 0.003, 0.18) * 1.2 + lp(br(), 400 * Math.exp(-t * 2) + 80, 0.7) * env(t, 0.004, dur * 0.4) * 1.6 + lp2(n(), 5000 * Math.exp(-t * 9) + 200, 0.7) * env(t, 0.001, 0.07);
    if (t > 0.05 && r() < 60 / SR) for (let k = 0; k < 25 && i + k < d.length; k++) d[i + k] += (r() * 2 - 1) * Math.exp(-k / 5) * 0.5 * Math.exp(-t * 2);
    d[i] += sat(x); } return fin(d, 0.95); }
function chimes(r, dur, freqs, decay, shimmer){ const d = mk(dur); const ps = freqs.map((f, k) => ({ f, ph: 0, t0: k * (shimmer || 0) }));
  for (let i = 0; i < d.length; i++){ const t = i / SR; let x = 0;
    for (const p of ps){ const tt = t - p.t0; if (tt < 0) continue; p.ph += TAU * p.f * (1 + 0.003 * Math.sin(tt * 30)) / SR; x += (Math.sin(p.ph) + 0.25 * Math.sin(p.ph * 2.01)) * env(tt, 0.004, decay); }
    d[i] = x / Math.sqrt(ps.length); } return fin(d, 0.75); }
function zap(r, dur, f0, crack){ const d = mk(dur), n = noiseGen('white', r), hp = BQ('hp'); let ph = 0, mph = 0;
  for (let i = 0; i < d.length; i++){ const t = i / SR; mph += TAU * (70 + r() * 30) / SR; ph += TAU * (f0 * (1 + 0.8 * Math.sin(mph)) * (r() < 0.02 ? 2 : 1)) / SR;
    let x = (((ph / TAU) % 1) * 2 - 1) * 0.6 * env(t, 0.002, dur * 0.4) + hp(n(), 2500, 0.7) * (crack || 0.5) * env(t, 0.001, 0.05) * (r() < 0.4 ? 1 : 0.3);
    d[i] = sat(x * 1.5); } return fin(d, 0.8); }
// 성대 + 모음 공명 (영웅 신음 · 괴물 울음)
const VOW = { a: [800, 1150, 2900], o: [450, 800, 2830], u: [325, 700, 2530], e: [400, 1600, 2700], i: [270, 2140, 2950] };
function voice(r, dur, f0, f1, vow, rough, breath){ const d = mk(dur), n = noiseGen('white', r), F = VOW[vow] || VOW.a, b = [BQ('bp'), BQ('bp'), BQ('bp')]; let ph = 0;
  for (let i = 0; i < d.length; i++){ const t = i / SR, u = t / dur; const f = f0 * Math.pow(f1 / f0, u) * (1 + 0.02 * Math.sin(t * 34) + (rough || 0) * (r() - 0.5) * 0.3);
    ph += f / SR; const g = (ph % 1) * 2 - 1, src = g * (1 - (breath || 0.15)) + n() * (breath || 0.15);
    let x = b[0](src, F[0], 6) * 1 + b[1](src, F[1], 8) * 0.6 + b[2](src, F[2], 10) * 0.3;
    if (rough) x *= 1 - rough * 0.5 * (Math.sin(t * TAU * (25 + rough * 20)) * 0.5 + 0.5);
    d[i] = sat(x * 2) * swell(t, dur, 0.18); } return fin(d, 0.85); }
function chitter(r, dur, rate, f){ const d = mk(dur), n = noiseGen('white', r), bp = BQ('bp'); let next = 0;
  for (let i = 0; i < d.length; i++){ const t = i / SR; if (t >= next){ next = t + 1 / rate * (0.6 + r() * 0.8); for (let k = 0; k < 160 && i + k < d.length; k++) d[i + k] += bp(n(), f * (0.8 + r() * 0.4), 6) * Math.exp(-k / 25); } d[i] *= swell(t, dur, 0.3); }
  return fin(d, 0.8); }
function hiss(r, dur, f, q){ const d = mk(dur), n = noiseGen('white', r), bp = BQ('bp'); for (let i = 0; i < d.length; i++){ const t = i / SR; d[i] = bp(n(), f * (1 + 0.1 * Math.sin(t * 9)), q || 1.2) * swell(t, dur, 0.25); } return fin(d, 0.7); }
function buzz(r, dur, f, am){ const d = mk(dur), lp = BQ('lp'); let ph = 0; for (let i = 0; i < d.length; i++){ const t = i / SR; ph += f * (1 + 0.04 * Math.sin(t * 7)) / SR; const s = ((ph % 1) * 2 - 1); d[i] = lp(s, 1800, 1) * (0.6 + 0.4 * Math.sin(t * TAU * (am || 38))) * swell(t, dur, 0.2); } return fin(d, 0.6); }
function pad(r, dur, freqs, vow, att){ const d = mk(dur), F = VOW[vow || 'a'], fl = [BQ('bp'), BQ('bp')]; const ph = freqs.map(() => r());
  for (let i = 0; i < d.length; i++){ const t = i / SR; let s = 0; freqs.forEach((f, k) => { ph[k] += f * (1 + 0.004 * Math.sin(t * 5 + k)) / SR; s += (ph[k] % 1) * 2 - 1; });
    s /= freqs.length; d[i] = (fl[0](s, F[0], 3) + fl[1](s, F[1], 4) * 0.6) * Math.min(1, t / (att || 0.15)) * Math.min(1, (dur - t) / 0.4); } return fin(d, 0.75); }
function brass(r, dur, notes, step){ const d = mk(dur), lp = BQ('lp'); const st = notes.map((f, k) => ({ f, t0: k * step, ph: 0 }));
  for (let i = 0; i < d.length; i++){ const t = i / SR; let x = 0; for (const s of st){ const tt = t - s.t0; if (tt < 0) continue; s.ph += s.f / SR; const e = Math.min(1, tt / 0.03) * Math.exp(-tt / 0.9); x += ((s.ph % 1) * 2 - 1) * e * (0.6 + 0.4 * Math.exp(-tt * 6)); }
    d[i] = lp(x, 900 + 2600 * Math.exp(-((t % (step || 1)) * 3)), 1); } return fin(d, 0.8); }
function drips(r, dur, n){ const d = mk(dur), bp = BQ('bp'); for (let k = 0; k < n; k++){ const t0 = r() * (dur - 0.2), f = 900 + r() * 1600; let ph = 0; const i0 = Math.floor(t0 * SR); for (let j = 0; j < SR * 0.12 && i0 + j < d.length; j++){ const t = j / SR; ph += TAU * f * (1 + t * 8) / SR; d[i0 + j] += Math.sin(ph) * Math.exp(-t / 0.03) * (0.4 + r() * 0.6); } } return fin(d, 0.6); }
function loopify(d){ const x = Math.min(Math.floor(d.length * 0.15), SR); const n = d.length - x, o = new Float32Array(n); for (let i = 0; i < n; i++) o[i] = d[i]; for (let i = 0; i < x; i++){ const k = i / x; o[i] = d[n + i] * (1 - k) + d[i] * k; } return o; }
function amb(r, dur, f, layers){ const d = mk(dur), br = noiseGen('brown', r), pk = noiseGen('pink', r), lp = BQ('lp'), bp = BQ('bp');
  for (let i = 0; i < d.length; i++){ const t = i / SR; d[i] = lp(br(), f, 0.8) * 0.8 + bp(pk(), f * 4 * (1 + 0.3 * Math.sin(t * 0.7)), 1.5) * 0.25 * (0.6 + 0.4 * Math.sin(t * 0.37)); }
  if (layers) layers(d); return fin(d, 0.7); }
function mixInto(a, b, gain, off){ off = Math.floor((off || 0) * SR); for (let i = 0; i < b.length && i + off < a.length; i++) a[i + off] += b[i] * gain; return a; }
// ---------------- 소리 목록 ----------------
const S = {
  // 휘두르기 (무기 계열)
  swing: r => whoosh(r, 0.2, 700, 2600, 1.4), swingBlade: r => whoosh(r, 0.22, 900, 3400, 1.8, true), swingHeavy: r => whoosh(r, 0.34, 380, 1500, 1.1),
  swingBlunt: r => whoosh(r, 0.3, 300, 1100, 1), swingDagger: r => whoosh(r, 0.13, 1400, 4200, 2), swingPole: r => whoosh(r, 0.38, 260, 1300, 0.9),
  dodge: r => whoosh(r, 0.3, 500, 2200, 0.8), dash: r => mixInto(whoosh(r, 0.35, 600, 4000, 1), zap(r, 0.2, 180, 0.3), 0.3),
  // 맞는 소리 (재질)
  hit: r => impact(r, { body: 120, crack: 0.6, crunch: 0.4 }), hitSlash: r => impact(r, { body: 160, crack: 0.9, crackF: 4500, crunch: 0.5, dur: 0.22 }),
  hitBlunt: r => impact(r, { body: 85, bodyD: 0.12, crack: 0.5, crackF: 1800, crunch: 0.9, dur: 0.35 }), hitFlesh: r => mixInto(impact(r, { body: 110, crack: 0.5, crunch: 0.3 }), goo(r, 0.18, 500, 1), 0.5),
  hitGoo: r => mixInto(goo(r, 0.3, 380, 4), impact(r, { body: 90, crack: 0.2, dur: 0.15 }), 0.4), hitChitin: r => impact(r, { body: 260, crack: 1, crackF: 5000, crunch: 1.2, crunchD: 0.09, dur: 0.25 }),
  hitMetal: r => impact(r, { body: 200, crack: 0.6, metal: 1150, ringD: 0.4, dur: 0.6 }), hitCrack: r => mixInto(impact(r, { body: 300, crack: 1, crackF: 6000, crunch: 1.4, dur: 0.22 }), zap(r, 0.12, 400, 0.6), 0.3),
  crit: r => mixInto(impact(r, { body: 70, bodyD: 0.18, crack: 1.2, crunch: 1.2, dur: 0.5 }), whoosh(r, 0.25, 3000, 600, 2), 0.4),
  block: r => impact(r, { body: 240, crack: 0.5, metal: 980, ringD: 0.5, dur: 0.7 }), shatter: r => mixInto(chimes(r, 0.6, [3100, 3900, 4700, 5600, 6400, 7300].map(f => f * (0.9 + r() * 0.2)), 0.12, 0.02), impact(r, { body: 400, crack: 1.4, crackF: 7000, dur: 0.2 }), 0.6),
  bone: r => impact(r, { body: 320, crack: 1.2, crunch: 1.6, crunchD: 0.12, dur: 0.3 }),
  // 원소 · 기술
  fire: r => mixInto(whoosh(r, 0.45, 200, 900, 0.6), crackle(r, 0.5, 90), 0.6), fireBoom: r => boom(r, 1.1, 50), explode: r => boom(r, 0.8, 70),
  cold: r => mixInto(chimes(r, 0.5, [2200, 2900, 3700, 4600].map(f => f * (0.9 + r() * 0.2)), 0.18, 0.03), hiss(r, 0.4, 6000, 1), 0.3), freeze: r => mixInto(chimes(r, 0.8, [1800, 2400, 3200, 4800], 0.4, 0.06), hiss(r, 0.7, 5000, 2), 0.4),
  ltng: r => mixInto(zap(r, 0.3, 90, 0.8), boom(r, 0.4, 90), 0.25), thunder: r => mixInto(boom(r, 1.6, 40), zap(r, 0.25, 70, 1), 0.6), spark: r => zap(r, 0.14, 160, 0.9),
  pois: r => mixInto(goo(r, 0.5, 700, 6), hiss(r, 0.5, 1800, 3), 0.4), acid: r => mixInto(hiss(r, 0.6, 3500, 1.5), goo(r, 0.4, 900, 8), 0.6),
  magic: r => mixInto(chimes(r, 0.55, [523, 784, 1047, 1568].map(f => f * (0.97 + r() * 0.06)), 0.25, 0.035), whoosh(r, 0.3, 1200, 3000, 2), 0.25),
  holy: r => mixInto(pad(r, 1.2, [262, 330, 392, 523], 'o', 0.2), chimes(r, 1.2, [1047, 1319, 1568], 0.5, 0.08), 0.5),
  summon: r => mixInto(goo(r, 0.7, 260, 8), boom(r, 0.6, 45), 0.5), curse: r => mixInto(pad(r, 0.9, [233, 247, 349], 'u', 0.1), hiss(r, 0.8, 600, 4), 0.4),
  shout: r => voice(r, 0.6, 150, 115, 'a', 0.6, 0.2), buff: r => mixInto(chimes(r, 0.7, [392, 494, 587, 784, 988], 0.3, 0.05), whoosh(r, 0.5, 400, 2400, 1.5), 0.3),
  teleport: r => mixInto(whoosh(r, 0.35, 3500, 300, 2), chimes(r, 0.4, [880, 1320, 1760], 0.15, 0.02), 0.5), leap: r => whoosh(r, 0.45, 260, 1600, 0.8),
  slam: r => mixInto(boom(r, 0.9, 45), impact(r, { body: 70, crunch: 1.6, crunchD: 0.2, dur: 0.6 }), 0.8), whirl: r => loopify(whoosh(r, 1.1, 500, 800, 0.7)),
  bow: r => mixInto(impact(r, { body: 300, crack: 0.3, dur: 0.12 }), whoosh(r, 0.18, 2500, 1200, 3), 0.7), launch: r => whoosh(r, 0.22, 1600, 500, 1.6),
  spit: r => mixInto(goo(r, 0.2, 900, 2), whoosh(r, 0.18, 1800, 600, 2), 0.5), throwF: r => mixInto(whoosh(r, 0.25, 600, 1800, 1.2), chimes(r, 0.2, [2800, 3600], 0.06, 0), 0.25),
  trap: r => chimes(r, 0.25, [900, 1350], 0.05, 0.07), gas: r => hiss(r, 1.2, 2200, 1), tesla: r => mixInto(zap(r, 0.4, 120, 1), buzz(r, 0.4, 120, 60), 0.4),
  // 영웅 목소리
  heroHurt: r => voice(r, 0.22, 170 + r() * 30, 120, pickR(r, ['u', 'a', 'o']), 0.4, 0.3), heroAtk: r => voice(r, 0.15, 190, 150, 'a', 0.2, 0.35), heroDie: r => voice(r, 1.1, 160, 70, 'o', 0.5, 0.25),
  // 아이템 · UI
  ui: r => impact(r, { body: 1400, crack: 0.2, drop: 0.2, bodyD: 0.015, dur: 0.05, gain: 0.5 }), uiOpen: r => mixInto(hiss(r, 0.18, 2400, 0.8), impact(r, { body: 500, crack: 0.1, dur: 0.06 }), 0.4),
  uiClose: r => mixInto(hiss(r, 0.12, 1600, 0.8), impact(r, { body: 380, crack: 0.1, dur: 0.05 }), 0.5), nomana: r => buzz(r, 0.18, 110, 30),
  pickup: r => impact(r, { body: 700, crack: 0.3, drop: 0.3, bodyD: 0.03, dur: 0.08, gain: 0.6 }), drop: r => impact(r, { body: 140, crack: 0.5, crunch: 0.4, dur: 0.15 }),
  dropWeapon: r => mixInto(impact(r, { body: 210, crack: 0.6, metal: 1400, ringD: 0.18, dur: 0.35 }), impact(r, { body: 260, metal: 1700, ringD: 0.1, dur: 0.2 }), 0.5, 0.11),
  dropArmor: r => mixInto(impact(r, { body: 110, crack: 0.4, crunch: 0.5, dur: 0.25 }), chitter(r, 0.25, 40, 4200), 0.3), dropRing: r => mixInto(chimes(r, 0.4, [3200, 4800], 0.08, 0), chimes(r, 0.3, [3300, 4900], 0.05, 0), 0.6, 0.12),
  dropPotion: r => mixInto(chimes(r, 0.3, [2100, 2900], 0.06, 0), goo(r, 0.2, 700, 2), 0.3), gold: r => { const d = mk(0.5); for (let k = 0; k < 6; k++) mixInto(d, chimes(r, 0.2, [2400 + r() * 2200, 5300 + r() * 1300], 0.04, 0), 0.7, k * 0.045 + r() * 0.02); return fin(d, 0.7); },
  dropRare: r => chimes(r, 0.9, [1319, 1760, 2093, 2637], 0.35, 0.05), dropUnique: r => mixInto(pad(r, 1.6, [262, 392, 523, 659], 'a', 0.05), chimes(r, 1.6, [1047, 1319, 1568, 2093, 2637], 0.6, 0.07), 0.6),
  dropRing0: r => chimes(r, 0.3, [3000, 4500], 0.08, 0),
  equipWeapon: r => mixInto(whoosh(r, 0.2, 3000, 6000, 3, true), impact(r, { body: 320, metal: 1600, ringD: 0.3, dur: 0.4 }), 0.4, 0.1), equipArmor: r => mixInto(chitter(r, 0.3, 35, 3800), impact(r, { body: 130, crack: 0.3, dur: 0.2 }), 0.5),
  equipRing: r => chimes(r, 0.35, [2600, 3900, 5200], 0.09, 0.015), globe: r => mixInto(goo(r, 0.25, 600, 3), chimes(r, 0.5, [784, 1175, 1568], 0.18, 0.04), 0.6), potion: r => { const d = mk(0.7); for (let k = 0; k < 3; k++) mixInto(d, goo(r, 0.16, 260 + r() * 80, 1), 0.8, 0.08 + k * 0.17); mixInto(d, chimes(r, 0.2, [2400, 3100], 0.05, 0), 0.25, 0); return fin(d, 0.8); },
  // 세계 · 사건
  chest: r => { const d = mk(1.2); const cr = mk(0.6), n = noiseGen('white', r), bp = BQ('bp'); let ph = 0; for (let i = 0; i < cr.length; i++){ const t = i / SR; ph += (90 + 60 * Math.sin(t * 7)) / SR; cr[i] = bp(((ph % 1) * 2 - 1) * 0.6 + n() * 0.4, 700 + 400 * Math.sin(t * 5), 6) * swell(t, 0.6, 0.5); }
    mixInto(d, fin(cr, 0.6), 0.8, 0); mixInto(d, impact(r, { body: 100, crack: 0.4, dur: 0.25 }), 0.6, 0.55); mixInto(d, chimes(r, 0.6, [1568, 2093, 2637], 0.25, 0.06), 0.4, 0.6); return fin(d, 0.85); },
  pod: r => mixInto(goo(r, 0.6, 300, 10), boom(r, 0.3, 80), 0.4), squish: r => goo(r, 0.32, 420, 4),
  shrine: r => mixInto(pad(r, 1.8, [220, 277, 330, 440, 554], 'o', 0.4), chimes(r, 1.8, [880, 1109, 1319], 0.7, 0.15), 0.4),
  wpOn: r => mixInto(pad(r, 1.6, [110, 165, 220], 'u', 0.6), chimes(r, 1.6, [660, 990, 1320, 1980], 0.6, 0.18), 0.5),
  portal: r => mixInto(whoosh(r, 1.0, 200, 1400, 1.2), pad(r, 1.0, [180, 270, 360], 'u', 0.3), 0.6), portalEnter: r => mixInto(whoosh(r, 0.7, 1800, 150, 1.6), chimes(r, 0.6, [440, 660, 880], 0.25, 0.04), 0.4),
  stairs: r => { const d = mk(0.9); for (let k = 0; k < 4; k++) mixInto(d, impact(r, { body: 150 + r() * 60, crack: 0.5, crunch: 0.4, dur: 0.12 }), 0.6, k * 0.19); mixInto(d, hiss(r, 0.8, 400, 1), 0.15, 0); return fin(d, 0.8); },
  levelup: r => mixInto(brass(r, 1.8, [392, 523, 659, 784, 1047], 0.11), chimes(r, 1.8, [1568, 2093, 2637], 0.6, 0.12), 0.5),
  quest: r => brass(r, 2.0, [262, 330, 392, 523, 392, 523], 0.16), unlock: r => mixInto(chimes(r, 1.0, [784, 988, 1175, 1568], 0.35, 0.07), whoosh(r, 0.6, 600, 3000, 2), 0.3),
  death: r => mixInto(pad(r, 2.6, [110, 131, 156], 'u', 0.1), brass(r, 2.6, [392, 330, 262, 196, 131], 0.32), 0.7), victory: r => brass(r, 2.4, [392, 523, 659, 784, 659, 784, 1047], 0.14),
  roar: r => mixInto(voice(r, 1.5, 85, 55, 'a', 0.9, 0.35), boom(r, 1.2, 40), 0.35), bossDie: r => mixInto(voice(r, 2.2, 90, 35, 'o', 0.8, 0.4), boom(r, 2.0, 35), 0.6),
  step: r => impact(r, { body: 90, crack: 0.3, crackF: 1600, crunch: 0.2, dur: 0.07, gain: 0.5 }), stepStone: r => impact(r, { body: 160, crack: 0.5, crackF: 3500, crunch: 0.2, dur: 0.07, gain: 0.5 }),
  stepGoo: r => goo(r, 0.12, 300, 1), stepDirt: r => impact(r, { body: 80, crack: 0.25, crackF: 1200, crunch: 0.8, crunchD: 0.05, dur: 0.1, gain: 0.5 }),
  stepCrystal: r => mixInto(impact(r, { body: 200, crack: 0.4, dur: 0.06 }), chimes(r, 0.15, [3000 + r() * 1500], 0.04, 0), 0.25), jingle: r => chitter(r, 0.14, 50, 4600),
  // 위치 반복음 · 환경음
  L_fire: r => loopify(crackle(r, 4.2, 22, 1.4)), L_torch: r => loopify(crackle(r, 3.2, 10, 0.6)), L_portal: r => loopify(mixInto(pad(r, 4.2, [110, 165, 222, 331], 'u', 0.3), whoosh(r, 4.2, 300, 700, 0.6), 0.4)),
  L_wp: r => loopify(pad(r, 4.2, [98, 147, 196, 294], 'o', 0.3)), L_gas: r => loopify(hiss(r, 3.6, 1600, 0.8)), L_coil: r => loopify(mixInto(buzz(r, 3.2, 100, 50), zap(r, 3.2, 60, 0.15), 0.2)),
  A_town: r => loopify(amb(r, 8.2, 160, d => { mixInto(d, crackle(r, 8.0, 3, 0.2), 0.2, 0); })),
  A_1: r => loopify(amb(r, 8.2, 120, d => { mixInto(d, drips(r, 8, 9), 0.5, 0); for (let k = 0; k < 8; k++) mixInto(d, impact(r, { body: 45, crack: 0, dur: 0.25, bodyD: 0.1 }), 0.35, k * 1.0 + (k % 2) * 0.28); })),  // 세포: 물방울 + 먼 심장 박동
  A_2: r => loopify(amb(r, 8.2, 260, d => { mixInto(d, hiss(r, 8, 500, 0.6), 0.5, 0); mixInto(d, buzz(r, 2, 210, 30), 0.12, 3); })),             // 협곡: 바람 + 벌레
  A_3: r => loopify(amb(r, 8.2, 140, d => { mixInto(d, crackle(r, 8.0, 14, 1.2), 0.45, 0); })),                                                  // 발열: 타닥거림
  A_4: r => loopify(amb(r, 8.2, 100, d => { mixInto(d, buzz(r, 8, 60, 0.4), 0.25, 0); for (let k = 0; k < 6; k++) mixInto(d, zap(r, 0.12, 300, 0.6), 0.25, 0.5 + k * 1.3); })), // 신경: 전기 웅웅 + 딱딱
  A_5: r => loopify(amb(r, 8.2, 90, d => { for (let k = 0; k < 12; k++) mixInto(d, goo(r, 0.25, 200 + r() * 200, 2), 0.35, r() * 7.6); }))  // 기원: 원시 수프 보글
};
function pickR(r, a){ return a[Math.floor(r() * a.length)]; }
// 몸 구조별 괴물 목소리: aggro(발견) · atk(공격 준비) · hurt · die
const PLAN_V = {
  blob:    { aggro: r => goo(r, 0.5, 260, 5), atk: r => goo(r, 0.3, 340, 3), hurt: r => goo(r, 0.22, 520, 2), die: r => mixInto(goo(r, 0.9, 180, 10), hiss(r, 0.8, 900, 2), 0.3) },
  floater: { aggro: r => voice(r, 0.8, 330, 260, 'u', 0.1, 0.5), atk: r => voice(r, 0.4, 420, 520, 'o', 0, 0.5), hurt: r => voice(r, 0.25, 520, 380, 'u', 0.2, 0.4), die: r => voice(r, 1.2, 440, 120, 'u', 0.2, 0.6) },
  worm:    { aggro: r => hiss(r, 0.7, 3200, 1.2), atk: r => mixInto(hiss(r, 0.35, 4000, 1.5), chitter(r, 0.3, 30, 1800), 0.5), hurt: r => hiss(r, 0.2, 2600, 2), die: r => mixInto(hiss(r, 1.0, 1800, 1.2), goo(r, 0.6, 300, 4), 0.5) },
  spider:  { aggro: r => chitter(r, 0.6, 28, 2600), atk: r => chitter(r, 0.35, 45, 3200), hurt: r => mixInto(chitter(r, 0.2, 60, 3600), impact(r, { body: 300, crunch: 0.8, dur: 0.1 }), 0.5), die: r => mixInto(chitter(r, 0.8, 18, 2000), impact(r, { body: 200, crunch: 1.4, dur: 0.3 }), 0.6) },
  beast:   { aggro: r => voice(r, 0.6, 120, 95, 'a', 0.9, 0.4), atk: r => voice(r, 0.35, 150, 110, 'a', 1, 0.45), hurt: r => voice(r, 0.25, 260, 190, 'e', 0.6, 0.35), die: r => voice(r, 0.9, 200, 70, 'o', 0.8, 0.4) },
  biped:   { aggro: r => voice(r, 0.7, 95, 80, 'o', 0.7, 0.3), atk: r => voice(r, 0.35, 110, 90, 'a', 0.5, 0.3), hurt: r => voice(r, 0.25, 140, 100, 'u', 0.5, 0.3), die: r => voice(r, 1.1, 110, 50, 'o', 0.6, 0.35) },
  swim:    { aggro: r => mixInto(goo(r, 0.5, 900, 8), voice(r, 0.4, 600, 800, 'i', 0, 0.6), 0.3), atk: r => goo(r, 0.25, 1200, 4), hurt: r => voice(r, 0.2, 800, 600, 'e', 0.2, 0.5), die: r => goo(r, 0.8, 500, 12) },
  flyer:   { aggro: r => mixInto(buzz(r, 0.7, 180, 42), voice(r, 0.4, 900, 1300, 'i', 0.3, 0.6), 0.4), atk: r => voice(r, 0.3, 1200, 1600, 'i', 0.4, 0.6), hurt: r => voice(r, 0.18, 1400, 900, 'e', 0.3, 0.5), die: r => mixInto(buzz(r, 0.8, 140, 30), voice(r, 0.6, 1000, 300, 'i', 0.4, 0.5), 0.5) },
  phage:   { aggro: r => mixInto(chitter(r, 0.5, 22, 1400), buzz(r, 0.5, 90, 20), 0.4), atk: r => mixInto(impact(r, { body: 500, metal: 2400, ringD: 0.1, dur: 0.2 }), chitter(r, 0.25, 40, 2000), 0.6), hurt: r => impact(r, { body: 420, crack: 1, crunch: 1, dur: 0.15 }), die: r => mixInto(chitter(r, 0.7, 15, 1200), zap(r, 0.4, 200, 0.8), 0.4) },
  spinner: { aggro: r => mixInto(buzz(r, 0.7, 240, 12), zap(r, 0.3, 300, 0.3), 0.3), atk: r => whoosh(r, 0.4, 800, 4000, 2, true), hurt: r => zap(r, 0.18, 400, 0.8), die: r => mixInto(zap(r, 0.6, 160, 1), boom(r, 0.5, 90), 0.5) }
};
for (const p in PLAN_V) for (const k in PLAN_V[p]) S['mv_' + p + '_' + k] = PLAN_V[p][k];
const LIMIT = { ui: 3, step: 2, stepStone: 2, stepGoo: 2, stepDirt: 2, stepCrystal: 2, gold: 2, hit: 5, hitSlash: 5, hitBlunt: 4, hitFlesh: 4, hitGoo: 4, hitChitin: 4, hitMetal: 3, hitCrack: 4, fireBoom: 3, explode: 3 };

function makeSND(OPT, clamp, pick){
  let ctx = null, master, sfxG, musG, ambG, rev, revG, listener = null, wet = 0.2;
  const cache = new Map(), active = new Map();
  function getBufs(name){
    let b = cache.get(name); if (b) return b;
    const gen = S[name]; if (!gen) return null;
    b = [];
    const nv = name.startsWith('A_') || name.startsWith('L_') ? 1 : 3;
    for (let v = 0; v < nv; v++){ const d = gen(rng(v * 977 + name.length * 131 + name.charCodeAt(0))); const ab = ctx.createBuffer(1, d.length, SR); ab.getChannelData(0).set(d); b.push(ab); }
    cache.set(name, b); return b;
  }
  function init(){
    if (ctx){ if (ctx.state === 'suspended') ctx.resume(); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){ return; }
    const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -8; lim.ratio.value = 10; lim.attack.value = 0.003; lim.release.value = 0.2;
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(lim); lim.connect(ctx.destination);
    sfxG = ctx.createGain(); sfxG.gain.value = OPT.vol; sfxG.connect(master);
    ambG = ctx.createGain(); ambG.gain.value = OPT.vol * 0.55; ambG.connect(master);
    musG = ctx.createGain(); musG.gain.value = OPT.mus * 0.6; musG.connect(master);
    const il = Math.floor(ctx.sampleRate * 2.2), ir = ctx.createBuffer(2, il, ctx.sampleRate);
    for (let c = 0; c < 2; c++){ const x = ir.getChannelData(c); for (let i = 0; i < il; i++) x[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / il, 3) * (i < 300 ? i / 300 : 1); }
    rev = ctx.createConvolver(); rev.buffer = ir; revG = ctx.createGain(); revG.gain.value = 0.35; rev.connect(revG); revG.connect(master);
    // 자주 쓰는 소리 미리 합성 (첫 재생 끊김 방지)
    const first = ['ui', 'uiOpen', 'uiClose', 'A_town', 'L_fire', 'stepStone', 'swing', 'swingBlade', 'hitSlash', 'hitFlesh', 'hitGoo', 'hit', 'pickup', 'gold', 'fire', 'magic', 'heroHurt'];
    const warm = first.concat(Object.keys(S).filter(n => !first.includes(n)));
    let k = 0; const idle = window.requestIdleCallback || (f => setTimeout(f, 40));
    const tick = () => { if (k < warm.length){ if (!cache.has(warm[k])) getBufs(warm[k]); k++; setTimeout(() => idle(tick), 25); } }; setTimeout(tick, 80);
  }
  function setVol(){ if (sfxG){ sfxG.gain.value = OPT.vol; ambG.gain.value = OPT.vol * 0.55; musG.gain.value = OPT.mus * 0.6; } }
  function play(name, vol, pos, opt){
    if (!ctx) return; opt = opt || {};
    if (!S[name]) name = ALIAS[name] || name; if (!S[name]) return;
    const n = active.get(name) || 0; if (n >= (LIMIT[name] || 6)) return;
    let v = vol == null ? 1 : vol, pan = 0, cut = 20000;
    if (pos && listener){ const dx = pos.x - listener.x, dz = pos.z - listener.z, d = Math.hypot(dx, dz); v *= clamp(1.25 - d / 32, 0, 1); if (v < 0.025) return; pan = clamp((dx - dz) / 26, -0.85, 0.85); cut = clamp(16000 - d * 520, 1200, 16000); }
    const bufs = getBufs(name); if (!bufs) return;
    const t = ctx.currentTime + (opt.delay || 0) + 0.002;
    const src = ctx.createBufferSource(); src.buffer = bufs[(Math.random() * bufs.length) | 0];
    src.playbackRate.value = (opt.rate || 1) * (name.startsWith('ui') ? 1 : 0.94 + Math.random() * 0.12);
    const g = ctx.createGain(); g.gain.value = v; let node = src;
    if (cut < 15000){ const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cut; node.connect(f); node = f; }
    node.connect(g); node = g;
    if (pan && ctx.createStereoPanner){ const p = ctx.createStereoPanner(); p.pan.value = pan; node.connect(p); node = p; }
    node.connect(sfxG);
    const w = opt.wet != null ? opt.wet : wet; if (w > 0){ const wg = ctx.createGain(); wg.gain.value = w; node.connect(wg); wg.connect(rev); }
    active.set(name, n + 1); src.onended = () => active.set(name, Math.max(0, (active.get(name) || 1) - 1));
    src.start(t);
    return src;
  }
  // ---- 환경음 (장별 반복) ----
  let amb = { key: null, src: null, g: null };
  function setAmb(key){
    if (!ctx || amb.key === key) return;
    if (amb.src){ const g = amb.g, s = amb.src; g.gain.setTargetAtTime(0, ctx.currentTime, 0.6); setTimeout(() => { try { s.stop(); } catch(e){} }, 3000); }
    amb = { key, src: null, g: null }; const bufs = getBufs('A_' + key); if (!bufs) return;
    const s = ctx.createBufferSource(); s.buffer = bufs[0]; s.loop = true; const g = ctx.createGain(); g.gain.value = 0; s.connect(g); g.connect(ambG); s.start(); g.gain.setTargetAtTime(0.9, ctx.currentTime, 1.2);
    amb.src = s; amb.g = g;
    wet = key === 'town' ? 0.1 : key === 3 || key === '3' ? 0.18 : 0.3;     // 동굴일수록 울림 크게
  }
  // ---- 위치 반복음 (모닥불 · 횃불 · 포털 · 웨이포인트 · 함정) ----
  const loops = new Map();
  function updLoops(list){
    if (!ctx || !listener) return; const seen = new Set();
    for (const L of list){
      const d = Math.hypot(L.x - listener.x, L.z - listener.z), R = L.r || 16; if (d > R + 4) continue; seen.add(L.id);
      let o = loops.get(L.id);
      if (!o){ const bufs = getBufs(L.snd); if (!bufs) continue; const s = ctx.createBufferSource(); s.buffer = bufs[0]; s.loop = true; s.playbackRate.value = 0.95 + Math.random() * 0.1;
        const g = ctx.createGain(); g.gain.value = 0; const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null; s.connect(g); if (p){ g.connect(p); p.connect(sfxG); } else g.connect(sfxG); s.start(0, Math.random() * 2); o = { s, g, p }; loops.set(L.id, o); }
      const v = clamp(1 - d / R, 0, 1) ** 1.6 * (L.vol || 0.5); o.g.gain.setTargetAtTime(v, ctx.currentTime, 0.15);
      if (o.p) o.p.pan.setTargetAtTime(clamp(((L.x - listener.x) - (L.z - listener.z)) / 26, -0.85, 0.85), ctx.currentTime, 0.15);
    }
    for (const [id, o] of loops) if (!seen.has(id)){ o.g.gain.setTargetAtTime(0, ctx.currentTime, 0.2); const s = o.s; setTimeout(() => { try { s.stop(); } catch(e){} }, 800); loops.delete(id); }
  }
  // ---- 음악 ----
  let mus = { kind: null, timer: null, step: 0, next: 0, nodes: [], g: null };
  const NOTE = n => 440 * Math.pow(2, (n - 69) / 12);
  const ks = new Map();
  function ksBuf(freq, dur){ const key = freq.toFixed(1); if (ks.has(key)) return ks.get(key); const sr = ctx.sampleRate, N = Math.floor(sr * dur), P = Math.max(2, Math.round(sr / freq)); const b = ctx.createBuffer(1, N, sr), d = b.getChannelData(0), ring = new Float32Array(P); for (let i = 0; i < P; i++) ring[i] = Math.random() * 2 - 1; let idx = 0, prev = 0; for (let i = 0; i < N; i++){ const cur = ring[idx]; const nx = 0.996 * 0.5 * (cur + prev); prev = cur; ring[idx] = nx; d[i] = cur * 0.5; idx = (idx + 1) % P; } ks.set(key, b); return b; }
  function pluck(freq, when, vol, out){ const s = ctx.createBufferSource(); s.buffer = ksBuf(freq, 2.4); const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2600; const g = ctx.createGain(); g.gain.value = vol; s.connect(f); f.connect(g); g.connect(out || mus.g); s.start(when); }
  function note(freq, when, dur, type, vol, cut, out){ const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cut || 1200; const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(vol, when + Math.min(0.08, dur * 0.2)); g.gain.exponentialRampToValueAtTime(0.0001, when + dur); o.connect(f); f.connect(g); g.connect(out || mus.g); o.start(when); o.stop(when + dur + 0.05); }
  function drum(when, kind, vol){ const bufs = getBufs(kind === 'kick' ? 'D_kick' : kind === 'tom' ? 'D_tom' : 'D_hat'); if (!bufs) return; const s = ctx.createBufferSource(); s.buffer = bufs[(Math.random() * bufs.length) | 0]; const g = ctx.createGain(); g.gain.value = vol; s.connect(g); g.connect(mus.g); s.start(when); }
  S.D_kick = r => impact(r, { body: 55, drop: 3, bodyD: 0.16, crack: 0.25, crackF: 900, dur: 0.4 }); S.D_tom = r => impact(r, { body: 110, drop: 1, bodyD: 0.14, crack: 0.3, dur: 0.35 }); S.D_hat = r => hiss(r, 0.06, 8000, 1);
  const TOWN = [[57, 60, 64, 69], [53, 57, 60, 65], [48, 52, 55, 60], [55, 59, 62, 67], [57, 60, 64, 69], [50, 53, 57, 62], [52, 56, 59, 64], [52, 56, 59, 64]];
  // 장별 조 · 선율 (단조 계열)
  const FIELD = { 1: [45, [0, 3, 7, 10, 12, 7]], 2: [43, [0, 1, 5, 7, 8, 5]], 3: [47, [0, 3, 5, 7, 10, 12]], 4: [41, [0, 2, 3, 7, 9, 14]], 5: [40, [0, 3, 7, 8, 12, 15]] };
  function stopMusic(){
    if (!ctx) return; if (mus.timer) clearInterval(mus.timer); mus.timer = null;
    if (mus.g){ const g = mus.g, nodes = mus.nodes; g.gain.cancelScheduledValues(ctx.currentTime); g.gain.setTargetAtTime(0, ctx.currentTime, 0.7); setTimeout(() => { nodes.forEach(n => { try { n.stop(); } catch(e){} }); g.disconnect(); }, 4000); }
    mus = { kind: null, timer: null, step: 0, next: 0, nodes: [], g: null };
  }
  function music(kind, tint){
    if (!ctx || mus.kind === kind + (tint || '')) return;
    stopMusic(); mus.kind = kind + (tint || ''); mus.next = ctx.currentTime + 0.4;
    const g = ctx.createGain(); g.gain.value = 0; g.connect(musG); g.gain.setTargetAtTime(kind === 'boss' ? 0.75 : 0.55, ctx.currentTime, kind === 'boss' ? 0.4 : 1.5); mus.g = g;
    if (kind === 'town' || kind === 'select'){
      const pat = [0, 1, 2, 3, 2, 1, 2, 3];
      mus.timer = setInterval(() => { while (mus.next < ctx.currentTime + 0.5){ const bar = Math.floor(mus.step / 8) % TOWN.length, ch = TOWN[bar], k = mus.step % 8, beat = kind === 'select' ? 0.42 : 0.34;
        pluck(NOTE(ch[pat[k]] - (kind === 'select' ? 12 : 0) + (k === 0 ? -12 : 0)), mus.next, k === 0 ? 0.55 : 0.32);
        if (k === 0) note(NOTE(ch[0] - 12), mus.next, beat * 8, 'triangle', 0.08, 600);          // 은은한 패드
        if (kind === 'town' && k % 4 === 2 && Math.random() < 0.6) drum(mus.next, 'hat', 0.12);
        mus.next += beat; mus.step++; } }, 120);
    } else if (kind === 'boss'){
      const base = (FIELD[tint] || FIELD[1])[0], sc = (FIELD[tint] || FIELD[1])[1];
      mus.timer = setInterval(() => { while (mus.next < ctx.currentTime + 0.5){ const k = mus.step % 16, bar = Math.floor(mus.step / 16) % 4, bt = 0.16;
        if (k % 4 === 0) drum(mus.next, 'kick', 0.9); if (k % 8 === 4) drum(mus.next, 'tom', 0.6); if (k % 2 === 1) drum(mus.next, 'hat', 0.2); if (k === 14 || k === 15) drum(mus.next, 'tom', 0.45);
        const root = base + [0, 0, 1, -2][bar]; note(NOTE(root - 12 + (k % 2 ? 12 : 0)), mus.next, bt * 0.95, 'sawtooth', 0.12, 500);
        if (k % 4 === 0) note(NOTE(root + 12 + sc[(k / 4 + bar) % sc.length]), mus.next, bt * 3.6, 'square', 0.05, 1400);
        if (k === 0) [0, 3, 6].forEach(o => note(NOTE(root + 24 + o), mus.next, bt * 15, 'sawtooth', 0.025, 1800));
        mus.next += bt; mus.step++; } }, 100);
    } else {
      const base = (FIELD[tint] || FIELD[1])[0], sc = (FIELD[tint] || FIELD[1])[1];
      for (const [n, det, ty, v] of [[base, 0, 'sawtooth', 0.07], [base + 7, 5, 'sawtooth', 0.05], [base - 12, -3, 'sine', 0.22]]){
        const o = ctx.createOscillator(); o.type = ty; o.frequency.value = NOTE(n); o.detune.value = det; const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 240; f.Q.value = 2;
        const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05 + Math.random() * 0.08; const lg = ctx.createGain(); lg.gain.value = 140; lfo.connect(lg); lg.connect(f.frequency);
        const og = ctx.createGain(); og.gain.value = v; o.connect(f); f.connect(og); og.connect(g); o.start(); lfo.start(); mus.nodes.push(o, lfo); }
      mus.timer = setInterval(() => { while (mus.next < ctx.currentTime + 0.6){ const k = mus.step % 32;
        if (k % 4 === 0 && Math.random() < 0.55) pluck(NOTE(base + 24 + sc[(Math.random() * sc.length) | 0]), mus.next, 0.22);       // 띄엄띄엄 선율
        if (k === 0) note(NOTE(base + 12 + sc[2]), mus.next, 6, 'triangle', 0.05, 900);
        if (k % 16 === 8 && Math.random() < 0.5) drum(mus.next, 'tom', 0.18);
        mus.next += 0.42; mus.step++; } }, 200);
    }
  }
  function sting(name){ play(name, 0.9, null, { wet: 0.4 }); }
  return { init, play, music, stopMusic, setVol, setAmb, updLoops, sting, setListener(p){ listener = p; }, get ctx(){ return ctx; }, get musicKind(){ return mus.kind; }, has: n => !!S[n] || !!ALIAS[n], sample: n => { if (!ctx) return null; const b = getBufs(ALIAS[n] || n); return b ? Array.from(b[(Math.random() * b.length) | 0].getChannelData(0)) : null; } };
}
const ALIAS = { hitStone: 'hitBlunt', die: 'mv_blob_die', dieBig: 'bossDie', growl: 'mv_beast_aggro' };
window.makeSND = makeSND;
})();
