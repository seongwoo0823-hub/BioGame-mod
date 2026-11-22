// Procedural audio (WebAudio): engine, drift screech, boost, one-shot SFX and a small step-sequenced BGM
export class Audio {
  constructor() { this.ctx = null; this.musicVol = 0.5; this.sfxVol = 0.8; this.bgmOn = false; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const C = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = C.createGain(); this.master.gain.value = 0.9; this.master.connect(C.destination);
    this.comp = C.createDynamicsCompressor(); this.comp.connect(this.master);
    this.sfx = C.createGain(); this.sfx.gain.value = this.sfxVol; this.sfx.connect(this.comp);
    this.music = C.createGain(); this.music.gain.value = this.musicVol * 0.35; this.music.connect(this.comp);
    const len = C.sampleRate * 2, buf = C.createBuffer(1, len, C.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    // engine
    this.eng = { o1: C.createOscillator(), o2: C.createOscillator(), f: C.createBiquadFilter(), g: C.createGain() };
    this.eng.o1.type = 'sawtooth'; this.eng.o2.type = 'square'; this.eng.f.type = 'lowpass'; this.eng.f.frequency.value = 900; this.eng.g.gain.value = 0;
    this.eng.o1.connect(this.eng.f); this.eng.o2.connect(this.eng.f); this.eng.f.connect(this.eng.g); this.eng.g.connect(this.sfx);
    this.eng.o1.start(); this.eng.o2.start();
    // drift screech + boost roar (looping noise)
    this.loopNoise = (type, freq, q) => { const s = C.createBufferSource(); s.buffer = this.noise; s.loop = true; const f = C.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = C.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(this.sfx); s.start(); return { s, f, g }; };
    this.screech = this.loopNoise('bandpass', 2100, 6); this.roar = this.loopNoise('lowpass', 700, 1);
    this.loadSamples();
  }
  /** recorded engine loops (loop_0 = idle ... loop_5 = top RPM) + tire squeal loop from ../sounds */
  async loadSamples() {
    const C = this.ctx, get = async f => C.decodeAudioData(await (await fetch('sounds/' + f)).arrayBuffer());
    try {
      const bufs = await Promise.all([0, 1, 2, 3, 4, 5].map(i => get(`loop_${i}.wav`)));
      const sq = await get('tires_squal_loop.wav');
      this.engBus = C.createGain(); this.engBus.gain.value = 0; this.engBus.connect(this.sfx);
      this.loops = bufs.map(b => { const s = C.createBufferSource(); s.buffer = b; s.loop = true; const g = C.createGain(); g.gain.value = 0; s.connect(g); g.connect(this.engBus); s.start(); return { s, g }; });
      const s = C.createBufferSource(); s.buffer = sq; s.loop = true; const g = C.createGain(); g.gain.value = 0; s.connect(g); g.connect(this.sfx); s.start();
      this.squeal = { s, g }; this.samples = true;
    } catch (e) { console.warn('sound samples unavailable, using synth engine', e); }
  }
  setVolumes(m, s) { this.musicVol = m; this.sfxVol = s; if (this.ctx) { this.music.gain.value = m * 0.35; this.sfx.gain.value = s; } }
  engine(speed, throttle, boost, drifting, active) {
    if (!this.ctx) return; const t = this.ctx.currentTime, e = this.eng;
    if (this.samples) {
      // RPM position 0..5 across the six loops; neighbours crossfade, pitch bends inside each band
      const rpm = Math.min(5.3, Math.max(0, speed / 36 * 4.6 + (throttle > 0 ? 0.35 : 0) + (boost ? 0.5 : 0)));
      this.loops.forEach((L, i) => {
        const w = Math.max(0, 1 - Math.abs(rpm - i));
        L.g.gain.setTargetAtTime(w, t, 0.06);
        L.s.playbackRate.setTargetAtTime(1 + (rpm - i) * 0.09, t, 0.06);
      });
      this.engBus.gain.setTargetAtTime(active ? 0.32 + throttle * 0.12 : 0, t, 0.12);
      e.g.gain.setTargetAtTime(0, t, 0.1);
      this.squeal.g.gain.setTargetAtTime(drifting && active ? 0.45 : 0, t, drifting ? 0.03 : 0.08);
      this.squeal.s.playbackRate.setTargetAtTime(0.9 + Math.min(0.3, speed / 160), t, 0.1);
      this.screech.g.gain.setTargetAtTime(0, t, 0.05);
    } else {
      const f = 48 + speed * 3.2 + (boost ? 30 : 0);
      e.o1.frequency.setTargetAtTime(f, t, 0.05); e.o2.frequency.setTargetAtTime(f * 0.501, t, 0.05);
      e.f.frequency.setTargetAtTime(500 + speed * 40 + throttle * 400, t, 0.08);
      e.g.gain.setTargetAtTime(active ? 0.05 + throttle * 0.04 + speed * 0.0012 : 0, t, 0.1);
      this.screech.g.gain.setTargetAtTime(drifting && active ? 0.09 : 0, t, 0.05);
      this.screech.f.frequency.setTargetAtTime(1800 + speed * 20, t, 0.1);
    }
    this.roar.g.gain.setTargetAtTime(boost && active ? 0.22 : 0, t, 0.08);
  }
  /** short tire chirp on drift start (re-uses the squeal recording) */
  chirp() { if (!this.samples) return; const C = this.ctx, s = C.createBufferSource(), g = C.createGain(); s.buffer = this.squeal.s.buffer; s.playbackRate.value = 1.15;
    g.gain.setValueAtTime(0.5, C.currentTime); g.gain.exponentialRampToValueAtTime(0.001, C.currentTime + 0.35); s.connect(g); g.connect(this.sfx); s.start(0, Math.random() * 2, 0.4); }
  /** engine rev in the waiting room / countdown */
  rev() { if (!this.samples) return; const C = this.ctx, t = C.currentTime, s = C.createBufferSource(), g = C.createGain(); s.buffer = this.loops[3].s.buffer; s.loop = true;
    s.playbackRate.setValueAtTime(0.8, t); s.playbackRate.linearRampToValueAtTime(1.5, t + 0.35); s.playbackRate.linearRampToValueAtTime(0.8, t + 0.9);
    g.gain.setValueAtTime(0.0, t); g.gain.linearRampToValueAtTime(0.4, t + 0.1); g.gain.exponentialRampToValueAtTime(0.001, t + 1.0); s.connect(g); g.connect(this.sfx); s.start(t); s.stop(t + 1.05); }
  tone(freq, dur = 0.15, type = 'square', vol = 0.2, slide = 0, delay = 0) {
    if (!this.ctx) return; const C = this.ctx, t = C.currentTime + delay, o = C.createOscillator(), g = C.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g); g.connect(this.sfx); o.start(t); o.stop(t + dur + 0.02);
  }
  burst(dur = 0.3, freq = 1200, type = 'lowpass', vol = 0.4, delay = 0, sweep = 0) {
    if (!this.ctx) return; const C = this.ctx, t = C.currentTime + delay, s = C.createBufferSource(), f = C.createBiquadFilter(), g = C.createGain();
    s.buffer = this.noise; f.type = type; f.frequency.setValueAtTime(freq, t); if (sweep) f.frequency.exponentialRampToValueAtTime(freq * sweep, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); s.connect(f); f.connect(g); g.connect(this.sfx); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  play(name) {
    switch (name) {
      case 'click': this.tone(880, 0.06, 'square', 0.08); break;
      case 'select': this.tone(660, 0.07, 'triangle', 0.15); this.tone(990, 0.1, 'triangle', 0.15, 0, 0.06); break;
      case 'count': this.tone(440, 0.25, 'square', 0.18); break;
      case 'go': this.tone(880, 0.6, 'square', 0.2); this.tone(1320, 0.6, 'triangle', 0.12); break;
      case 'boost': this.burst(0.6, 300, 'lowpass', 0.5, 0, 6); this.tone(220, 0.5, 'sawtooth', 0.12, 3); break;
      case 'mini': this.burst(0.3, 600, 'bandpass', 0.35, 0, 3); this.tone(523, 0.12, 'triangle', 0.12); this.tone(784, 0.15, 'triangle', 0.12, 0, 0.08); break;
      case 'item': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.14, 0, i * 0.05)); break;
      case 'coin': this.tone(988, 0.08, 'square', 0.1); this.tone(1319, 0.18, 'square', 0.1, 0, 0.07); break;
      case 'use': this.tone(330, 0.2, 'sawtooth', 0.12, 2.5); break;
      case 'missile': this.burst(0.5, 800, 'bandpass', 0.3, 0, 4); this.tone(300, 0.5, 'sawtooth', 0.1, 4); break;
      case 'hit': this.burst(0.6, 2000, 'lowpass', 0.6, 0, 0.1); this.tone(120, 0.4, 'sine', 0.5, 0.3); break;
      case 'spin': this.tone(900, 0.8, 'triangle', 0.15, 0.2); this.burst(0.4, 1500, 'bandpass', 0.3); break;
      case 'wall': this.tone(90, 0.18, 'sine', 0.5, 0.5); this.burst(0.12, 900, 'lowpass', 0.3); break;
      case 'jump': this.tone(300, 0.25, 'triangle', 0.15, 2); break;
      case 'land': this.tone(70, 0.2, 'sine', 0.5, 0.6); this.burst(0.15, 500, 'lowpass', 0.35); break;
      case 'bounce': this.tone(200, 0.4, 'sine', 0.3, 4); break;
      case 'slime': this.tone(160, 0.35, 'sine', 0.25, 0.5); this.burst(0.3, 400, 'lowpass', 0.25); break;
      case 'shield': [784, 988, 1175].forEach((f, i) => this.tone(f, 0.25, 'sine', 0.12, 1, i * 0.04)); break;
      case 'block': this.tone(1200, 0.3, 'sine', 0.2, 0.6); break;
      case 'bubble': this.tone(500, 0.25, 'sine', 0.25, 2.2); this.tone(700, 0.2, 'sine', 0.15, 2, 0.1); break;
      case 'lap': [659, 784, 1047].forEach((f, i) => this.tone(f, 0.18, 'square', 0.12, 0, i * 0.09)); break;
      case 'final': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.16, 'square', 0.14, 0, i * 0.07)); break;
      case 'finish': [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.25, 'square', 0.15, 0, i * 0.11)); break;
      case 'warn': this.tone(600, 0.12, 'square', 0.15); this.tone(600, 0.12, 'square', 0.15, 0, 0.2); break;
      case 'knock': this.tone(260, 0.12, 'square', 0.12, 0.6); break;
      case 'ready': this.tone(784, 0.08, 'square', 0.1); this.tone(1175, 0.12, 'square', 0.1, 0, 0.06); break;
      case 'chat': this.tone(1400, 0.04, 'sine', 0.08); break;
      case 'gauge': [880, 1109, 1319, 1760].forEach((f, i) => this.tone(f, 0.1, 'triangle', 0.13, 0, i * 0.04)); break;
    }
  }
  // --------------------------------------------------------------------- BGM sequencer
  startMusic(kind = 'race') {
    if (!this.ctx) return; this.stopMusic(); this.bgmOn = true; this.kind = kind;
    this.bpm = kind === 'race' ? 148 : 112; this.step = 0; this.nextT = this.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 25);
  }
  setTempo(bpm) { this.bpm = bpm; }
  stopMusic() { clearInterval(this.timer); this.bgmOn = false; }
  schedule() {
    const C = this.ctx; const spb = 60 / this.bpm / 4;
    const prog = this.kind === 'race' ? [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]] : [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]];
    while (this.nextT < C.currentTime + 0.12) {
      const st = this.step, t = this.nextT, bar = Math.floor(st / 16) % 4, chord = prog[bar], s16 = st % 16;
      const midi = m => 440 * Math.pow(2, (m - 69) / 12);
      const note = (f, d, type, vol) => { const o = C.createOscillator(), g = C.createGain(); o.type = type; o.frequency.value = f; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + d); o.connect(g); g.connect(this.music); o.start(t); o.stop(t + d + 0.02); };
      // drums
      if (s16 % 4 === 0) { const o = C.createOscillator(), g = C.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15); g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2); o.connect(g); g.connect(this.music); o.start(t); o.stop(t + 0.22); }
      if (this.kind === 'race' && (s16 === 4 || s16 === 12)) { const s = C.createBufferSource(), f = C.createBiquadFilter(), g = C.createGain(); s.buffer = this.noise; f.type = 'highpass'; f.frequency.value = 1500; g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15); s.connect(f); f.connect(g); g.connect(this.music); s.start(t, Math.random()); s.stop(t + 0.2); }
      if (s16 % 2 === 1) { const s = C.createBufferSource(), f = C.createBiquadFilter(), g = C.createGain(); s.buffer = this.noise; f.type = 'highpass'; f.frequency.value = 7000; g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05); s.connect(f); f.connect(g); g.connect(this.music); s.start(t, Math.random()); s.stop(t + 0.06); }
      // bass + arpeggio + lead hook
      if (s16 % 2 === 0) note(midi(chord[0] - 24 + (s16 % 8 === 6 ? 12 : 0)), spb * 1.8, 'square', 0.18);
      note(midi(chord[s16 % 3] + 12 + (s16 > 7 ? 12 : 0)), spb * 0.9, 'triangle', 0.07);
      const lead = [0, -1, 2, -1, 4, -1, 2, 0, 5, -1, 4, -1, 2, -1, 0, -1];
      if (this.kind === 'race' && lead[s16] >= 0 && bar % 2 === 1) note(midi(chord[0] + 12 + [0, 2, 3, 5, 7, 8][lead[s16]]), spb * 1.6, 'square', 0.05);
      this.step++; this.nextT += spb;
    }
  }
}
