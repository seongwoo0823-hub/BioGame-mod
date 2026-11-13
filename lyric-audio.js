// BIO ARCADE 서정 사운드 엔진: 배경 음악 + 다듬은 효과음 (Web Audio 합성, 외부 음원 파일 없음)
// 사용: LyricAudio.init('게임키') → LyricAudio.theme('pyramid'|'kingdom'|'battle') / LyricAudio.sfx('이름') / LyricAudio.cycle()
window.LyricAudio = (function () {
  'use strict';
  let ctx = null, master, comp, musicBus, sfxBus, revIn, noiseBuf;
  let gameKey = 'bio', mode = 'all';            // all: 음악+효과음 · sfx: 효과음만 · off: 모두 끔
  let cur = null, want = null, step = 0, nextT = 0, timer = null, switching = false;
  const MUSIC_VOL = 0.24, SFX_VOL = 0.85;
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const rnd = (a, b) => a + Math.random() * (b - a);

  function loadMode() { try { const v = localStorage.getItem('lyricAudioMode:' + gameKey); if (v === 'all' || v === 'sfx' || v === 'off') mode = v; } catch (e) {} }
  function saveMode() { try { localStorage.setItem('lyricAudioMode:' + gameKey, mode); } catch (e) {} }

  function makeIR(sec, decay) {
    const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); }
    return b;
  }
  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    try { ctx = new AC(); } catch (e) { return null; }
    comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = 0.008; comp.release.value = 0.25;
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(comp); comp.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = 0; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = mode === 'off' ? 0 : SFX_VOL; sfxBus.connect(master);
    const rev = ctx.createConvolver(); rev.buffer = makeIR(3.4, 2.4);
    const revOut = ctx.createGain(); revOut.gain.value = 0.5; rev.connect(revOut); revOut.connect(master);
    const revLp = ctx.createBiquadFilter(); revLp.type = 'lowpass'; revLp.frequency.value = 5200; revLp.connect(rev);
    revIn = revLp;
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    return ctx;
  }
  // 소리 출력 연결: bus로 직접 + 잔향 보내기
  function out(node, bus, send) {
    node.connect(bus);
    if (send > 0) { const s = ctx.createGain(); s.gain.value = send; node.connect(s); s.connect(revIn); }
  }
  function osc(type, f, t, stop, det) { const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); if (det) o.detune.value = det; o.start(t); o.stop(stop); return o; }
  function noise(t, dur) { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.start(t, Math.random() * 0.5); s.stop(t + dur); return s; }

  /* ───────────── 악기 ───────────── */
  const I = {
    piano(t, m, dur, vel, bus, send) {
      const f = mtof(m), end = t + dur + 1.6;
      const e = ctx.createGain(), r = ctx.createGain(), lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.Q.value = 0.6;
      lp.frequency.setValueAtTime(Math.min(9000, f * 9), t); lp.frequency.setTargetAtTime(Math.max(700, f * 2.4), t, 0.5);
      e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(vel, t + 0.006);
      e.gain.setTargetAtTime(0.0001, t + 0.01, m < 60 ? 1.3 : (m < 72 ? 0.9 : 0.6));
      r.gain.setValueAtTime(1, t + dur); r.gain.linearRampToValueAtTime(0, t + dur + 0.35);
      const a = osc('triangle', f, t, end), b = osc('sine', f, t, end, 5), c = osc('sine', f * 2, t, end, -3), g2 = ctx.createGain(); g2.gain.value = 0.22;
      a.connect(lp); b.connect(lp); c.connect(g2); g2.connect(lp); lp.connect(e); e.connect(r); out(r, bus, send);
    },
    harp(t, m, dur, vel, bus, send) {
      const f = mtof(m), end = t + Math.max(dur, 1.4) + 0.2;
      const e = ctx.createGain(), lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
      lp.frequency.setValueAtTime(Math.min(8000, f * 7), t); lp.frequency.setTargetAtTime(f * 2, t, 0.25);
      e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(vel, t + 0.004); e.gain.setTargetAtTime(0.0001, t + 0.005, 0.42);
      const a = osc('sine', f, t, end), b = osc('triangle', f * 2, t, end), g2 = ctx.createGain(); g2.gain.value = 0.18;
      a.connect(lp); b.connect(g2); g2.connect(lp); lp.connect(e); out(e, bus, send);
    },
    pad(t, ms, dur, vel, bus, send) {
      const end = t + dur + 1.6, e = ctx.createGain(), lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 950; lp.Q.value = 0.4;
      e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(vel, t + Math.min(1.1, dur * 0.4));
      e.gain.setValueAtTime(vel, t + dur); e.gain.linearRampToValueAtTime(0.0001, end - 0.05);
      ms.forEach(m => { const f = mtof(m); osc('sawtooth', f, t, end, -7).connect(lp); osc('sawtooth', f, t, end, 7).connect(lp); });
      lp.connect(e); out(e, bus, send);
    },
    flute(t, m, dur, vel, bus, send) {
      const f = mtof(m), end = t + dur + 0.4, e = ctx.createGain();
      e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(vel, t + 0.07); e.gain.setTargetAtTime(vel * 0.8, t + 0.07, 0.3);
      e.gain.setValueAtTime(vel * 0.8, t + dur); e.gain.linearRampToValueAtTime(0.0001, t + dur + 0.3);
      const a = osc('sine', f, t, end), b = osc('sine', f * 2, t, end), g2 = ctx.createGain(); g2.gain.value = 0.1;
      const lfo = osc('sine', 5.2, t, end), lg = ctx.createGain();
      lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.006, t + Math.min(0.5, dur));
      lfo.connect(lg); lg.connect(a.frequency); lg.connect(b.frequency);
      a.connect(e); b.connect(g2); g2.connect(e);
      // 숨소리(시작할 때 살짝)
      const n = noise(t, 0.12), bp = ctx.createBiquadFilter(), ng = ctx.createGain(); bp.type = 'bandpass'; bp.frequency.value = f * 2; bp.Q.value = 3;
      ng.gain.setValueAtTime(vel * 0.25, t); ng.gain.linearRampToValueAtTime(0.0001, t + 0.12); n.connect(bp); bp.connect(ng); ng.connect(e);
      out(e, bus, send);
    },
    bell(t, m, dur, vel, bus, send) {
      const f = mtof(m), end = t + 3, e = ctx.createGain();
      e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(vel, t + 0.003); e.gain.setTargetAtTime(0.0001, t + 0.004, 0.75);
      [[1, 1], [2.76, 0.28], [5.4, 0.1]].forEach(([k, a]) => { const g = ctx.createGain(); g.gain.value = a; osc('sine', f * k, t, end).connect(g); g.connect(e); });
      out(e, bus, send);
    },
    bass(t, m, dur, vel, bus, send) {
      const f = mtof(m), end = t + dur + 0.5, e = ctx.createGain(), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520;
      e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(vel, t + 0.02); e.gain.setTargetAtTime(vel * 0.5, t + 0.02, 0.5);
      e.gain.setValueAtTime(vel * 0.5, t + dur); e.gain.linearRampToValueAtTime(0.0001, t + dur + 0.3);
      osc('triangle', f, t, end).connect(lp); osc('sine', f, t, end).connect(lp); lp.connect(e); out(e, bus, send);
    },
    timpani(t, m, vel, bus, send) {
      const f = mtof(m), e = ctx.createGain(), o = osc('sine', f * 1.12, t, t + 1.6);
      o.frequency.exponentialRampToValueAtTime(f, t + 0.12);
      e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(vel, t + 0.005); e.gain.setTargetAtTime(0.0001, t + 0.01, 0.42);
      o.connect(e);
      const n = noise(t, 0.08), lp = ctx.createBiquadFilter(), ng = ctx.createGain(); lp.type = 'lowpass'; lp.frequency.value = 500;
      ng.gain.setValueAtTime(vel * 0.6, t); ng.gain.linearRampToValueAtTime(0.0001, t + 0.08); n.connect(lp); lp.connect(ng); ng.connect(e);
      out(e, bus, send);
    },
    kick(t, vel, bus) {
      const e = ctx.createGain(), o = osc('sine', 115, t, t + 0.4); o.frequency.exponentialRampToValueAtTime(42, t + 0.13);
      e.gain.setValueAtTime(vel, t); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.32); o.connect(e); out(e, bus, 0);
    },
    shaker(t, vel, bus) {
      const n = noise(t, 0.07), hp = ctx.createBiquadFilter(), e = ctx.createGain(); hp.type = 'highpass'; hp.frequency.value = 6500;
      e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(vel, t + 0.012); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.065);
      n.connect(hp); hp.connect(e); out(e, bus, 0.1);
    },
    swell(t, dur, vel, bus) {
      const n = noise(t, dur + 0.05), bp = ctx.createBiquadFilter(), e = ctx.createGain(); bp.type = 'bandpass'; bp.Q.value = 0.8;
      bp.frequency.setValueAtTime(1500, t); bp.frequency.exponentialRampToValueAtTime(9000, t + dur);
      e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(vel, t + dur); e.gain.linearRampToValueAtTime(0.0001, t + dur + 0.04);
      n.connect(bp); bp.connect(e); out(e, bus, 0.5);
    },
  };

  /* ───────────── 곡 ───────────── */
  const MAJ = [0, 2, 4, 5, 7, 9, 11], MIN = [0, 2, 3, 5, 7, 8, 10];
  const dg = (root, sc, d) => root + 12 * Math.floor(d / 7) + sc[((d % 7) + 7) % 7];
  const hz = (t) => t + rnd(-0.006, 0.006);   // 사람 손 같은 미세한 흔들림

  const THEMES = {
    // 따스한 섬의 오후 — F장조 3/4 왈츠 (바이오 피라미드)
    pyramid: {
      bpm: 80, spb: 6, bars: 16, passes: 3, root: 65,
      prog: [0, 2, 3, 0, 5, 3, 1, 4, 0, 4, 5, 2, 3, 0, 1, 4],
      mel: [
        [[0, 4, 3], [3, 2, 1], [4, 4, 2]], [[0, 6, 3], [3, 4, 1], [4, 2, 2]], [[0, 5, 4], [4, 7, 2]], [[0, 4, 6]],
        [[0, 9, 3], [3, 7, 1], [4, 5, 2]], [[0, 7, 2], [2, 5, 2], [4, 3, 2]], [[0, 3, 3], [3, 1, 1], [4, 3, 1], [5, 4, 1]], [[0, 4, 4], [4, 1, 2]],
        [[0, 7, 3], [3, 6, 1], [4, 7, 2]], [[0, 8, 4], [4, 6, 2]], [[0, 7, 3], [3, 5, 1], [4, 9, 2]], [[0, 8, 3], [3, 6, 1], [4, 4, 2]],
        [[0, 5, 2], [2, 7, 2], [4, 10, 2]], [[0, 9, 4], [4, 7, 2]], [[0, 8, 2], [2, 5, 2], [4, 6, 2]], [[0, 6, 2], [2, 8, 4]],
      ],
      play(t, b, s, p, sd) {
        const R = this.root, r = this.prog[b], n = d => dg(R, MAJ, d), M = musicBus, bar = sd * this.spb;
        if (s === 0) {
          I.pad(t, [n(r) - 12, n(r + 2) - 12, n(r + 4) - 12], bar, 0.028, M, 0.5);
          I.bass(t, n(r) - 24, bar * 0.9, 0.26, M, 0.15);
        }
        if (p !== 2 && (s === 2 || s === 4)) [n(r + 2) - 12, n(r + 4) - 12, n(r + 7) - 12].forEach((m, i) => I.piano(hz(t) + i * 0.012, m, sd * 1.6, 0.075 * rnd(0.85, 1.1), M, 0.35));
        const arp = [r, r + 2, r + 4, r + 7, r + 4, r + 2];
        if (p >= 1) I.harp(hz(t), n(arp[s]), sd, (s === 0 ? 0.11 : 0.08) * rnd(0.85, 1.1), M, 0.45);
        const note = this.mel[b].find(x => x[0] === s);
        if (note) {
          const len = note[2] * sd;
          if (p === 0) I.piano(hz(t), n(note[1]), len * 1.05, 0.24 * rnd(0.9, 1.05), M, 0.4);
          if (p === 1) { I.flute(t, n(note[1]), len * 0.95, 0.12, M, 0.5); if (note[2] >= 4) I.bell(t, n(note[1]) + 12, len, 0.045, M, 0.6); }
        }
        if (p === 2 && (s === 0 || s === 3) && b % 2 === 0) I.bell(t, n(r + (s ? 4 : 7)) + 12, sd * 3, 0.06, M, 0.7);
      },
    },
    // 왕국의 아침 — D장조 4/4 (세포 원정대 왕국)
    kingdom: {
      bpm: 76, spb: 8, bars: 16, passes: 3, root: 62,
      prog: [0, 4, 5, 3, 0, 4, 3, 4, 5, 2, 3, 0, 1, 4, 0, 4],
      mel: [
        [[0, 4, 3], [3, 2, 1], [4, 4, 2], [6, 7, 2]], [[0, 8, 3], [3, 6, 1], [4, 4, 4]], [[0, 7, 3], [3, 5, 1], [4, 7, 2], [6, 9, 2]], [[0, 8, 6], [6, 7, 2]],
        [[0, 7, 3], [3, 6, 1], [4, 4, 4]], [[0, 6, 3], [3, 4, 1], [4, 1, 2], [6, 4, 2]], [[0, 5, 3], [3, 3, 1], [4, 5, 2], [6, 7, 2]], [[0, 6, 8]],
        [[0, 9, 3], [3, 8, 1], [4, 7, 2], [6, 5, 2]], [[0, 6, 4], [4, 4, 2], [6, 2, 2]], [[0, 5, 3], [3, 7, 1], [4, 10, 4]], [[0, 9, 6], [6, 7, 2]],
        [[0, 8, 3], [3, 5, 1], [4, 3, 2], [6, 5, 2]], [[0, 4, 3], [3, 6, 1], [4, 8, 4]], [[0, 9, 2], [2, 8, 2], [4, 7, 4]], [[0, 8, 4], [4, 6, 4]],
      ],
      play(t, b, s, p, sd) {
        const R = this.root, r = this.prog[b], n = d => dg(R, MAJ, d), M = musicBus, bar = sd * this.spb;
        if (s === 0) I.pad(t, [n(r) - 12, n(r + 2) - 12, n(r + 4) - 12], bar, 0.03, M, 0.5);
        if (s === 0 || s === 4) I.bass(t, n(s ? r + 4 : r) - 24, sd * 3.6, 0.24, M, 0.15);
        const arp = [r, r + 4, r + 7, r + 9, r + 7, r + 4, r + 2, r + 4];
        if (p === 1 || s % 2 === 0) I.harp(hz(t), n(arp[s]) - 12, sd * 2, 0.09 * rnd(0.85, 1.1), M, 0.45);
        const note = this.mel[b].find(x => x[0] === s);
        if (note) {
          const len = note[2] * sd;
          if (p === 0) I.piano(hz(t), n(note[1]), len * 1.05, 0.23 * rnd(0.9, 1.05), M, 0.4);
          if (p === 1) { I.flute(t, n(note[1]), len * 0.95, 0.12, M, 0.5); if (note[2] >= 4) I.bell(t, n(note[1]) + 12, len, 0.04, M, 0.6); }
        }
        if (p === 2) {
          if (s === 0 || s === 3 || s === 6) I.piano(hz(t), n(r + [7, 9, 11][s / 3]), sd * 3, 0.12, M, 0.45);
          if (s === 4 && b % 2) I.bell(t, n(r + 4) + 12, sd * 4, 0.05, M, 0.7);
        }
      },
    },
    // 푸른 혈관의 결의 — D단조 4/4, 서정적이면서 힘 있게 (세포 원정대 전투)
    battle: {
      bpm: 104, spb: 8, bars: 8, passes: 3, root: 62,
      prog: [0, 5, 2, 6, 0, 5, 3, 'V'],
      mel: [
        [[0, 4, 2], [2, 7, 2], [4, 9, 3], [7, 8, 1]], [[0, 7, 4], [4, 5, 2], [6, 4, 2]], [[0, 6, 2], [2, 4, 2], [4, 2, 2], [6, 4, 2]], [[0, 8, 6], [6, 6, 2]],
        [[0, 9, 3], [3, 8, 1], [4, 7, 2], [6, 9, 2]], [[0, 11, 4], [4, 9, 2], [6, 7, 2]], [[0, 10, 3], [3, 9, 1], [4, 7, 2], [6, 5, 2]], [[0, 8, 8]],
      ],
      chord(b) { const r = this.prog[b], R = this.root; return r === 'V' ? [R + 7, R + 11, R + 14] : [dg(R, MIN, r), dg(R, MIN, r + 2), dg(R, MIN, r + 4)]; },
      play(t, b, s, p, sd) {
        const R = this.root, n = d => dg(R, MIN, d), M = musicBus, bar = sd * this.spb, ch = this.chord(b), root = ch[0];
        if (s === 0) { I.pad(t, ch.map(m => m - 12), bar, 0.036, M, 0.45); I.timpani(t, root - 24, 0.22, M, 0.3); }
        if (b === 7 && (s === 6 || s === 7)) I.timpani(t, root - 24, 0.16, M, 0.3);
        if (s === 0 || s === 3 || s === 6) I.bass(t, root - 24, sd * 2.6, 0.26, M, 0.1);
        const ost = [root, ch[2], root + 12, ch[2]];
        I.harp(hz(t), ost[s % 4] - 12, sd, (s % 2 ? 0.07 : 0.1), M, 0.3);
        if (p !== 2 && (s === 0 || s === 4)) I.kick(t, 0.16, M);
        if (p === 1) I.shaker(t, s % 2 ? 0.02 : 0.03, M);
        if (b === 7 && s === 0) I.swell(t, bar, 0.05, M);
        const note = this.mel[b].find(x => x[0] === s);
        if (note && p !== 2) {
          const len = note[2] * sd;
          I.flute(t, n(note[1]), len * 0.95, 0.13, M, 0.45);
          if (p === 1) I.bell(t, n(note[1]) + 12, len, 0.04, M, 0.55);
        }
        if (p === 2) {
          if (s === 0) ch.forEach((m, i) => I.piano(hz(t) + i * 0.015, m, sd * 6, 0.1, M, 0.5));
          if (s === 4 || s === 6) I.bell(t, ch[s === 4 ? 1 : 2] + 12, sd * 2, 0.05, M, 0.6);
        }
      },
    },
  };

  function tick() {
    if (!ctx || !cur) return;
    if (mode !== 'all' || ctx.state !== 'running') { nextT = ctx.currentTime + 0.1; return; }
    const T = THEMES[cur], sd = 60 / T.bpm / 2, ahead = ctx.currentTime + 0.35;
    if (nextT < ctx.currentTime) nextT = ctx.currentTime + 0.05;
    while (nextT < ahead) {
      const barAbs = Math.floor(step / T.spb), b = barAbs % T.bars, p = Math.floor(barAbs / T.bars) % T.passes, s = step % T.spb;
      try { T.play(nextT, b, s, p, sd); } catch (e) {}
      step++; nextT += sd;
    }
  }
  function fadeMusic(to, sec) {
    if (!ctx) return; const g = musicBus.gain, now = ctx.currentTime;
    g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.linearRampToValueAtTime(to, now + sec);
  }
  function startTheme(name) {
    cur = name; step = 0; nextT = ctx.currentTime + 0.12;
    fadeMusic(mode === 'all' ? MUSIC_VOL : 0, 2.5);
  }
  function theme(name) {
    want = name;
    if (!ctx || ctx.state !== 'running') return;          // 첫 터치 뒤 시작
    if (cur === name || switching) return;
    if (!cur) { startTheme(name); return; }
    switching = true; fadeMusic(0, 0.9);
    setTimeout(() => { switching = false; startTheme(want); }, 950);
  }

  // 첫 터치/키 입력 때 소리 켜기 (브라우저 자동 재생 정책)
  function unlock() {
    if (!ensure()) return;
    if (ctx.state === 'suspended' && !document.hidden) ctx.resume().then(() => { if (want && !cur) theme(want); }).catch(() => {});
    else if (want && !cur) theme(want);
  }
  ['pointerdown', 'touchend', 'keydown', 'mousedown'].forEach(ev => addEventListener(ev, unlock, { passive: true, capture: true }));
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend().catch(() => {}); else ctx.resume().catch(() => {});
  });

  /* ───────────── 효과음 ───────────── */
  const last = {}, GAP = { pickup: 0.035, slash: 0.045, hit: 0.09, slotTick: 0.02, coin: 0.04, pop: 0.03, down: 0.12 };
  const PENTA = [0, 2, 4, 7, 9];
  let pickIdx = 0;
  const S = {
    pickup(t, o, B) {   // 양분 블록 줍기: 방울 + 오음음계 반짝임(연달아 주우면 선율처럼)
      const e = ctx.createGain(), a = osc('sine', 600, t, t + 0.12); a.frequency.exponentialRampToValueAtTime(1250, t + 0.07);
      e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(0.09, t + 0.008); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.1); a.connect(e); out(e, B, 0.1);
      pickIdx = (pickIdx + 1 + (Math.random() < 0.3 ? 1 : 0)) % 10;
      I.bell(t + 0.02, 77 + PENTA[pickIdx % 5] + (pickIdx >= 5 ? 12 : 0), 0.3, 0.035, B, 0.3);
    },
    build(t, o, B) {    // 블록 쌓기: 묵직한 "톡" + 단계마다 올라가는 맑은 음
      const k = (o && o.n) || 0;
      const e = ctx.createGain(), a = osc('sine', 190, t, t + 0.2); a.frequency.exponentialRampToValueAtTime(85, t + 0.12);
      e.gain.setValueAtTime(0.2, t); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.16); a.connect(e); out(e, B, 0.15);
      const n = noise(t, 0.05), bp = ctx.createBiquadFilter(), ng = ctx.createGain(); bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 1.2;
      ng.gain.setValueAtTime(0.12, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.05); n.connect(bp); bp.connect(ng); out(ng, B, 0.1);
      const i = k % 15; I.harp(t + 0.015, 65 + 12 * Math.floor(i / 5) + PENTA[i % 5], 0.5, 0.11, B, 0.35);
    },
    slotTick(t, o, B) { // 뽑기 회전: 나무 딸깍
      const e = ctx.createGain(), a = osc('sine', rnd(1300, 1600), t, t + 0.04); e.gain.setValueAtTime(0.05, t); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.035); a.connect(e); out(e, B, 0.05);
    },
    slotStop(t, o, B) { I.harp(t, 79, 0.4, 0.14, B, 0.3); I.harp(t + 0.07, 84, 0.6, 0.12, B, 0.4); },
    jackpot(t, o, B) {  // 대박: 하프 글리산도 + 종소리 화음 + 반짝임
      [0, 2, 4, 7, 9, 12, 14, 16, 19, 21].forEach((d, i) => I.harp(t + i * 0.045, 72 + d, 0.6, 0.1, B, 0.5));
      [84, 88, 91, 96].forEach((m, i) => I.bell(t + 0.48 + i * 0.02, m, 1.5, 0.07, B, 0.7));
      S.sparkle(t + 0.45, o, B);
    },
    sparkle(t, o, B) {
      for (let i = 0; i < 6; i++) I.bell(t + i * 0.06 + rnd(0, 0.02), 96 + PENTA[Math.floor(rnd(0, 5))], 0.4, 0.025, B, 0.7);
    },
    springUnlock(t, o, B) { // 온천: 물소리 + 따뜻한 화음 펼침
      const n = noise(t, 0.9), lp = ctx.createBiquadFilter(), e = ctx.createGain(); lp.type = 'lowpass';
      lp.frequency.setValueAtTime(3500, t); lp.frequency.exponentialRampToValueAtTime(500, t + 0.8);
      e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(0.09, t + 0.05); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.85); n.connect(lp); lp.connect(e); out(e, B, 0.4);
      [65, 69, 72, 77, 81].forEach((m, i) => I.harp(t + 0.1 + i * 0.07, m, 1, 0.11, B, 0.55));
      I.bell(t + 0.5, 89, 1.5, 0.05, B, 0.7);
    },
    upgrade(t, o, B) {  // 강화·구매: 마림바 두 음(5도 위로) + 작은 반짝임
      I.harp(t, 74, 0.4, 0.15, B, 0.35); I.harp(t + 0.085, 81, 0.6, 0.14, B, 0.4); I.bell(t + 0.17, 93, 0.6, 0.03, B, 0.6);
    },
    levelup(t, o, B) { [72, 76, 79, 84].forEach((m, i) => I.harp(t + i * 0.06, m, 0.5, 0.13, B, 0.45)); I.bell(t + 0.24, 96, 0.8, 0.035, B, 0.6); },
    pop(t, o, B) {      // 일반 버튼·수확: 부드러운 방울
      const e = ctx.createGain(), a = osc('sine', 480, t, t + 0.15); a.frequency.exponentialRampToValueAtTime(900, t + 0.06);
      e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(0.11, t + 0.006); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.12); a.connect(e); out(e, B, 0.15);
    },
    open(t, o, B) {     // 창 열기: 가벼운 바람 + 톡
      const n = noise(t, 0.16), bp = ctx.createBiquadFilter(), e = ctx.createGain(); bp.type = 'bandpass'; bp.Q.value = 1;
      bp.frequency.setValueAtTime(900, t); bp.frequency.exponentialRampToValueAtTime(3200, t + 0.14);
      e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(0.035, t + 0.05); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.16); n.connect(bp); bp.connect(e); out(e, B, 0.2);
      I.harp(t + 0.03, 84, 0.3, 0.05, B, 0.3);
    },
    coin(t, o, B) {     // 코인 수확: 맑은 "칭"
      [[1975, 0.06], [2637, 0.05]].forEach(([f, v], i) => { const e = ctx.createGain(), a = osc('sine', f, t + i * 0.05, t + 0.5); e.gain.setValueAtTime(0.0001, t + i * 0.05); e.gain.linearRampToValueAtTime(v, t + i * 0.05 + 0.004); e.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.05 + 0.35); a.connect(e); out(e, B, 0.3); });
    },
    slash(t, o, B) {    // 베기: 바람 가르는 소리 + 금속 울림
      const n = noise(t, 0.16), bp = ctx.createBiquadFilter(), e = ctx.createGain(); bp.type = 'bandpass'; bp.Q.value = 2.2;
      const f0 = rnd(2400, 3200); bp.frequency.setValueAtTime(f0, t); bp.frequency.exponentialRampToValueAtTime(f0 * 0.25, t + 0.13);
      e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(0.1, t + 0.02); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.14); n.connect(bp); bp.connect(e); out(e, B, 0.12);
      const g = ctx.createGain(), a = osc('triangle', rnd(1700, 2100), t + 0.03, t + 0.3); g.gain.setValueAtTime(0.03, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25); a.connect(g); out(g, B, 0.2);
    },
    hit(t, o, B) {      // 적의 공격을 맞음: 둔탁한 쿵
      const e = ctx.createGain(), a = osc('sine', 150, t, t + 0.2); a.frequency.exponentialRampToValueAtTime(60, t + 0.1);
      e.gain.setValueAtTime(0.13, t); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.15); a.connect(e); out(e, B, 0.05);
      const n = noise(t, 0.04), lp = ctx.createBiquadFilter(), ng = ctx.createGain(); lp.type = 'lowpass'; lp.frequency.value = 1400;
      ng.gain.setValueAtTime(0.06, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.04); n.connect(lp); lp.connect(ng); out(ng, B, 0);
    },
    down(t, o, B) {     // 아군 쓰러짐: 내려가는 두 음
      I.harp(t, 69, 0.4, 0.12, B, 0.4); I.harp(t + 0.12, 62, 0.6, 0.11, B, 0.5); S.hit(t, o, B);
    },
    skill(t, o, B) {    // 스킬: 차오르는 마법 + 종소리 펼침
      const e = ctx.createGain(), lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
      lp.frequency.setValueAtTime(400, t); lp.frequency.exponentialRampToValueAtTime(4000, t + 0.35);
      e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(0.06, t + 0.3); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      [62, 69, 74].forEach(m => { osc('sawtooth', mtof(m), t, t + 0.65, -6).connect(lp); osc('sawtooth', mtof(m), t, t + 0.65, 6).connect(lp); });
      lp.connect(e); out(e, B, 0.5);
      [74, 78, 81, 86, 90].forEach((m, i) => I.bell(t + 0.12 + i * 0.05, m, 0.6, 0.045, B, 0.6));
    },
    summon(t, o, B) { S.skill(t, o, B); S.sparkle(t + 0.5, o, B); },
    victory(t, o, B) {  // 스테이지 클리어: 서정적인 짧은 팡파르
      [[62, 0], [66, 0.12], [69, 0.24], [74, 0.36]].forEach(([m, d]) => I.harp(t + d, m, 0.8, 0.14, B, 0.5));
      [74, 78, 81].forEach(m => I.flute(t + 0.5, m, 0.9, 0.06, B, 0.6));
      I.bell(t + 0.5, 86, 1.5, 0.06, B, 0.7); S.sparkle(t + 0.6, o, B);
    },
    defeat(t, o, B) { [[69, 0], [65, 0.25], [62, 0.5]].forEach(([m, d]) => I.piano(t + d, m, 0.8, 0.16, B, 0.6)); I.pad(t + 0.5, [50, 53, 57], 1.2, 0.03, B, 0.6); },
  };
  function sfx(name, o) {
    if (mode === 'off' || !ensure() || ctx.state !== 'running') return;
    const fn = S[name]; if (!fn) return;
    const now = ctx.currentTime;
    if (GAP[name] && last[name] && now - last[name] < GAP[name]) return;
    last[name] = now;
    try { fn(now + 0.005, o, sfxBus); } catch (e) {}
  }

  /* ───────────── 켜기/끄기 ───────────── */
  const LABEL = { all: '🎵 음악 + 효과음', sfx: '🔔 효과음만', off: '🔇 소리 끔' };
  function apply() {
    if (ctx) {
      const now = ctx.currentTime;
      sfxBus.gain.cancelScheduledValues(now); sfxBus.gain.setValueAtTime(mode === 'off' ? 0 : SFX_VOL, now);
      fadeMusic(mode === 'all' && cur ? MUSIC_VOL : 0, 0.6);
    }
  }
  let toastEl = null, toastT = 0;
  function toast(text) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.style.cssText = 'position:fixed;left:50%;bottom:max(18px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:9999;padding:8px 16px;border-radius:999px;background:rgba(15,23,42,.88);color:#fff;font:800 13px/1.2 system-ui,sans-serif;pointer-events:none;transition:opacity .3s;opacity:0';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = text; toastEl.style.opacity = '1'; clearTimeout(toastT); toastT = setTimeout(() => { toastEl.style.opacity = '0'; }, 1400);
  }
  function setMode(m) { if (!LABEL[m]) return; mode = m; saveMode(); apply(); }
  function cycle() {
    setMode(mode === 'all' ? 'sfx' : mode === 'sfx' ? 'off' : 'all');
    unlock(); toast(LABEL[mode]);
    if (mode !== 'off') setTimeout(() => sfx('pop'), 30);
    return mode;
  }
  function init(key) {
    gameKey = key || gameKey; loadMode();
    if (!timer) timer = setInterval(tick, 90);
  }
  // 진단용(시험 도구가 사용): 상태와 출력 크기
  let an = null;
  function _dbg() {
    if (!ctx) return { ctx: false };
    if (!an) { an = ctx.createAnalyser(); an.fftSize = 2048; comp.connect(an); }
    const d = new Float32Array(an.fftSize); an.getFloatTimeDomainData(d);
    let pk = 0, ss = 0; for (const v of d) { pk = Math.max(pk, Math.abs(v)); ss += v * v; }
    return { state: ctx.state, cur, step, music: +musicBus.gain.value.toFixed(3), peak: +pk.toFixed(3), rms: +Math.sqrt(ss / d.length).toFixed(4), mode };
  }
  function _tap() { if (!ensure()) return null; const d = ctx.createMediaStreamDestination(); comp.connect(d); return d.stream; }
  return { init, theme, sfx, cycle, setMode, _dbg, _tap, get mode() { return mode; }, get label() { return LABEL[mode]; } };
})();
