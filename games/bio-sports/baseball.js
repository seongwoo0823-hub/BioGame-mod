/* 종목 3: 바이오 야구 — 9명 수비 · 지명타자 타순 · 볼/스트라이크/아웃 · 3/6/9이닝 + 연장 · 파울 · 뜬공 · 땅볼 송구 · 도루 · 홈런 · 구종 · 존 조준 · 타이밍 */
'use strict';
(function () {
  const BS = 13, BX = BS / Math.SQRT2;
  const BASE = [[0, 0], [BX, BX], [2 * BX, 0], [BX, -BX], [0, 0]];
  const SL = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];
  const SLK = ['투수', '포수', '1루수', '2루수', '3루수', '유격수', '좌익수', '중견수', '우익수', '지명타자'];
  const FP = [[8.6, 0], [-1.4, 0], [BX + 2.4, BX + 0.6], [2 * BX - 1.2, 5.6], [BX + 2.4, -BX - 0.6], [2 * BX - 1.2, -5.6], [31, -16], [38, 0], [31, 16]];
  const WTS = {P: {pow: 0.8, bal: 1, atp: 0.6}, C: {def: 1, bal: 0.6}, '1B': {pow: 0.8, def: 0.4}, '2B': {spd: 0.6, bal: 0.6, def: 0.4}, '3B': {def: 0.8, pow: 0.4}, SS: {spd: 0.8, def: 0.8}, LF: {spd: 0.6, pow: 0.6}, CF: {spd: 1, bal: 0.4}, RF: {pow: 0.6, spd: 0.4, bal: 0.4}, DH: {pow: 1, bal: 0.6}};
  const PT = [{n: '직구', s: 1.0, bx: 0, by: 0.12}, {n: '효소 커브', s: 0.72, bx: -0.35, by: -0.95}, {n: 'DNA 슬라이더', s: 0.84, bx: 0.85, by: -0.25}, {n: '리보솜 체인지업', s: 0.76, bx: 0.2, by: -0.5}];
  const G = 25, FENCE = a => 46 - Math.abs(a) / (Math.PI / 4) * 6;
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 1.15;
  const okBat = b => Array.isArray(b) && b.length === 9 && new Set(b).size === 9 && b.every(v => v >= 1 && v <= 9);
  function autoBat(ti, lineup) {
    const ro = SP.roster(ti), val = s => { const p = ro[lineup[s]].st; return p.pow * 0.6 + p.bal * 0.4 + p.spd * 0.2; };
    const L = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort((a, b) => val(b) - val(a));
    return [L[4], L[3], L[1], L[0], L[2], L[5], L[6], L[7], L[8]];
  }
  const S = SP.SPORTS.baseball = {
    id: 'baseball', name: '바이오 야구', icon: '⚾', desc: '9명 수비 · 지명타자 · 구종 4개 · 존 조준 · 도루 · 홈런 · 연장', lineup: true, formLabel: '수비 위치 · 타순', speed: false,
    pitchBg: 'radial-gradient(circle at 50% 95%,#c8925a 0 22%,#3fae6a 22% 70%,#2f8a4a 70%)', pitchH: 340,
    orderNote: '타순은 아래 버튼으로 바꿔요.',
    options: [{key: 'inn', label: '이닝 수', def: 3, choices: [[3, '3이닝'], [6, '6이닝'], [9, '9이닝 (정규)']]}],
    slots() { return SL.map((l, i) => i === 9 ? {label: l, w: WTS[l], x: 0.88, y: 0.9} : {label: l, w: WTS[l], x: SP.clamp(0.5 + FP[i][1] / 44, 0.08, 0.92), y: SP.clamp(0.9 - FP[i][0] / 46, 0.08, 0.95)}); },
    lineupExtra(st) { const ro = SP.roster(st.my); if (!okBat(st.opts.bat)) st.opts.bat = autoBat(st.my, st.lineup);
      return `<div class="lbl">타순 (▲ 누르면 한 칸 위로 · 투수 대신 지명타자 DH가 쳐요)</div><div class="row" style="flex-wrap:wrap;gap:6px;margin-bottom:8px">${st.opts.bat.map((s, k) => `<button type="button" class="btn" data-bat="${k}" style="padding:4px 9px;font-size:12px">${k + 1}번 ${SL[s]} ${SP.esc(ro[st.lineup[s]].name)}${k ? ' ▲' : ''}</button>`).join('')}<button type="button" class="btn" id="batAuto" style="padding:4px 9px;font-size:12px">타순 자동</button></div>`; },
    bindLineupExtra(m, st, render) { m.querySelectorAll('[data-bat]').forEach(b => b.onclick = () => { const k = +b.dataset.bat, a = st.opts.bat; if (!k) return; [a[k - 1], a[k]] = [a[k], a[k - 1]]; SP.audio.click(); render(); }); const ba = m.querySelector('#batAuto'); if (ba) ba.onclick = () => { st.opts.bat = autoBat(st.my, st.lineup); render(); }; },
    controls: '<b>투수</b> <kbd>1~4</kbd>·<kbd>L</kbd> 구종 · <kbd>WASD</kbd> 코스 조준 · <kbd>K</kbd> 투구 &nbsp; <b>타자</b> <kbd>WASD</kbd> 타격 위치 · <kbd>K</kbd> 스윙(타이밍!) · <kbd>J</kbd> 도루 · 수비·주루는 자동 · <kbd>Tab</kbd> 현황·교체',
    touch: {c: '구종', a: '도루', b: '투구<br>스윙', t: '현황'},
    create
  };
  function create(cfg) {
    const TM = SP.teamMods(cfg), D = cfg.diff, innN = cfg.opts.inn || 3, sc = SP.scene;
    sc.background.set(0x8fd0ff);
    buildField(sc);
    const slots = S.slots();
    const ents = [0, 1].flatMap(sd => SP.makeEnts(cfg, sd, slots, () => ({cap: true})));
    const E = (sd, k) => ents[sd * 10 + k], idx = e => ents.indexOf(e);
    const bat = [okBat(cfg.opts.bat) ? cfg.opts.bat.slice() : autoBat(cfg.teams[0], cfg.lineups[0]), autoBat(cfg.teams[1], cfg.lineups[1])];
    // 모델: 공·배트·스트라이크 존·조준점
    const ballM = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), new THREE.MeshLambertMaterial({color: 0xffffff})); ballM.castShadow = true; sc.add(ballM);
    const batM = SP.vox([[0, 0, 0, 0.08, 0.9, 0.08, '#c98a4a'], [0, 0.55, 0, 0.11, 0.35, 0.11, '#b07a3a']]); sc.add(batM);
    const zone = new THREE.Group(); const zm = new THREE.MeshBasicMaterial({color: 0xffffff, transparent: true, opacity: 0.55});
    [[0, 0.6, 0.92, 0.03], [0, 1.6, 0.92, 0.03], [-0.45, 1.1, 0.03, 1.0], [0.45, 1.1, 0.03, 1.0]].forEach(([z, y, w, h]) => { const b = new THREE.Mesh(new THREE.BoxGeometry(0.02, h, w), zm); b.position.set(0.15, y, z); zone.add(b); });
    [[0, 0.933, 0.9, 0.012], [0, 1.267, 0.9, 0.012], [-0.15, 1.1, 0.012, 1.0], [0.15, 1.1, 0.012, 1.0]].forEach(([z, y, w, h]) => { const b = new THREE.Mesh(new THREE.BoxGeometry(0.01, h, w), new THREE.MeshBasicMaterial({color: 0xffffff, transparent: true, opacity: 0.3})); b.position.set(0.15, y, z); zone.add(b); });
    const zfill = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.0), new THREE.MeshBasicMaterial({color: 0xffffff, transparent: true, opacity: 0.08, side: THREE.DoubleSide})); zfill.rotation.y = -Math.PI / 2; zfill.position.set(0.15, 1.1, 0); zone.add(zfill);
    const cur = col => { const m = new THREE.Mesh(new THREE.RingGeometry(0.07, 0.11, 20), new THREE.MeshBasicMaterial({color: col, side: THREE.DoubleSide, transparent: true, depthTest: false})); m.rotation.y = -Math.PI / 2; m.renderOrder = 9; zone.add(m); return m; };
    const curP = cur(0xff5d6c), curB = cur(0x5ef2c8); sc.add(zone);
    const st = {inn: 1, half: 0, outs: 0, balls: 0, strikes: 0, score: [0, 0], line: [[], []], H: [0, 0], Er: [0, 0], phase: 'pre', t: 0, pt: 0, ptype: 0, aimP: {x: 0, y: 0}, aimB: {x: 0, y: 0}, pitch: null, steal: -1, used: [new Set(), new Set()], batI: [0, 0],
      bs: ents.map(() => ({ab: 0, h: 0, hr: 0, rbi: 0, k: 0, bb: 0, r: 0, sb: 0})), ps: ents.map(() => ({p: 0, k: 0, bb: 0, r: 0, h: 0})), end: false, swingT: -1, deadT: 1, next: 'batter', msg: '', lastType: ''};
    let runners = []; // {ei, p, to, forced, out, home, returning}
    const ball = {x: 8.4, y: 1.7, z: 0, vx: 0, vy: 0, vz: 0, live: false, holder: -1, bounced: false, thrown: null, holdT: 0};
    const play = {chaser: -1, chT: 0, outs: 0, fly: false, err: false, runs: [], batterOutAt1: false, lastOutForce: false, hr: false, foulFly: false};
    const EV = SP.makeEvents(fire); const ev = (t, d) => EV.emit(t, d);
    function fire(e) { const A = SP.audio;
      if (e.type === 'bat') { A.bat(e.v || 1); SP.burst(0.4, 1.1, -0.2, ['#fff', '#ffd25e'], 10, 0.4); } if (e.type === 'mitt') A.mitt(); if (e.type === 'whistle') A.whistle(e.n || 1);
      if (e.type === 'cheer') { A.cheer(); if (e.big) A.fanfare(); } if (e.type === 'msg') SP.toast(e.text, e.sub || '', e.ms || 1300); if (e.type === 'clack') A.clack(0.12); }
    const bsd = () => st.half, fsd = () => 1 - st.half;
    const batter = () => E(bsd(), bat[bsd()][st.batI[bsd()]]);
    const fielders = () => ents.slice(fsd() * 10, fsd() * 10 + 9);
    const posOf = p => { p = SP.clamp(p, 0, 4); const i = Math.min(3, Math.floor(p)), f = p - i, a = BASE[i], b = BASE[i + 1]; return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]; };
    const lvlOf = sd => cfg.sides[sd] === 'ai' ? D : 1;
    function atBase(b) { return runners.find(r => !r.out && !r.home && Math.abs(r.p - b) < 0.01 && r.to === b); }
    function placeTeams() {
      const f = fsd(), b = bsd();
      for (let k = 0; k < 10; k++) { const e = E(f, k); if (k === 9) { e.out = true; e.x = -6; e.z = 14; continue; } e.out = false; e.x = FP[k][0]; e.z = FP[k][1]; e.face = Math.atan2(-e.x, -e.z); e.spdNow = 0; }
      for (let k = 0; k < 10; k++) { const e = E(b, k); e.out = true; e.x = -5; e.z = -14 - k * 0.6; }
      const bt = batter(); bt.out = false; bt.x = -0.2; bt.z = -1.0; bt.face = 0;
      for (const r of runners) { const e = ents[r.ei]; e.out = false; [e.x, e.z] = posOf(r.p); e.face = Math.atan2(-e.z, e.x); }
    }
    function beginAtBat() { st.balls = 0; st.strikes = 0; startPitchAim(); placeTeams(); const bt = batter(); ev('msg', {text: `${st.batI[bsd()] + 1}번 타자 ${bt.name}`, sub: `${SLK[bt.slot]} · 타율 ${avg(idx(bt))}`, ms: 1100}); }
    function startPitchAim() { st.phase = 'aim'; st.t = 0; st.pitch = null; st.swingT = -1; st.steal = -1; st.aimP = {x: 0, y: 0}; ball.live = false; ball.holder = -1; ball.thrown = null; placeTeams(); }
    function avg(i) { const s = st.bs[i]; return s.ab ? (s.h / s.ab).toFixed(3).replace(/^0/, '') : '-'; }
    // ---------- 투구 ----------
    function trySteal() { if (st.steal >= 0) return; for (let b = 2; b >= 1; b--) { const r = atBase(b); if (r && !atBase(b + 1)) { st.steal = b; ev('msg', {text: '도루 준비!', sub: `${ents[r.ei].name} · ${b + 1}루로`, ms: 800}); return; } } }
    function aiPitch() { const w = [0.45, 0.2, 0.2, 0.15], r = Math.random(); let a = 0; st.ptype = 0; for (let i = 0; i < 4; i++) { a += w[i]; if (r < a) { st.ptype = i; break; } }
      const edge = st.strikes > st.balls ? 1.2 : st.balls >= 3 ? 0.75 : 1.0; st.aimP = {x: (Math.random() * 2 - 1) * 1.3 * edge, y: (Math.random() * 2 - 1) * 1.25 * edge}; }
    function release(human) {
      const f = fsd(), p = E(f, 0), P = PT[st.ptype];
      const noise = 0.2 * (1.25 - p.st.bal / 110) * (1.5 - p.atp * 0.5) * (human ? 1 : 1.15 - lvlOf(f) * 0.1);
      const loc = {x: st.aimP.x + gauss() * noise, y: st.aimP.y + gauss() * noise};
      let T = 0.7 / P.s * (1.12 - p.st.pow / 500) * (1 + (1 - p.atp) * 0.2);
      if (cfg.sides[f] === 'ai') T *= [1.2, 1.07, 1][D] || 1;
      st.pitch = {T, loc, type: st.ptype, inZ: Math.abs(loc.x) <= 1.05 && Math.abs(loc.y) <= 1.05};
      if (cfg.sides[bsd()] === 'ai') st.pitch.ai = aiBat(st.pitch, batter());
      st.phase = 'pitch'; st.pt = 0; st.swingT = -1; st.lastType = P.n;
      p.atp = Math.max(0.05, p.atp - 0.011 * (1.25 - p.st.atp / 200)); st.ps[idx(p)].p++;
      SP.pose(p.mesh, 'swing', 300);
      if (cfg.sides[bsd()] === 'ai' && st.steal < 0) { const r1 = atBase(1); if (r1 && !atBase(2) && ents[r1.ei].st.spd > 70 && Math.random() < 0.16) st.steal = 1; }
      if (st.steal >= 0) { const r = atBase(st.steal); if (r) { r.to = st.steal + 1; r.p += 0.12; r.steal = true; } }
      ball.live = false; ball.holder = -1;
    }
    function aiBat(P, b) {
      const lvl = D, two = st.strikes === 2; let sp = P.inZ ? (two ? 0.92 : 0.72) : (two ? 0.38 : 0.22); if (st.balls === 3 && st.strikes < 2) sp *= 0.6;
      if (Math.random() > sp) return {swing: false};
      const sig = (0.095 - lvl * 0.017) * (P.type ? 1.3 : 1) * (1.2 - b.st.bal / 250), an = 0.32 - lvl * 0.07;
      return {swing: true, ts: P.T + gauss() * sig, aim: {x: P.loc.x + gauss() * an, y: P.loc.y + gauss() * an - 0.06}};
    }
    function pitchPos(k) { const P = st.pitch, PTp = PT[P.type], s = [8.3, 1.75, 0.2], e = [0.1, 1.1 + P.loc.y * 0.5, P.loc.x * 0.45], w = k * (1 - k) * 1.6;
      return [s[0] + (e[0] - s[0]) * k, s[1] + (e[1] - s[1]) * k - PTp.by * 0.5 * w, s[2] + (e[2] - s[2]) * k - PTp.bx * 0.45 * w]; }
    function swing(t) {
      st.swingT = t; const P = st.pitch, b = batter(), human = cfg.sides[bsd()] !== 'ai';
      const err = t - P.T, win = 0.11 + b.st.bal / 1500 + (human ? 0.02 : 0), reach = 0.42 + b.st.bal / 500 + (human ? 0.06 : 0);
      const d = Math.hypot(P.loc.x - st.aimB.x, (P.loc.y - st.aimB.y) * 1.2);
      if (Math.abs(err) > win || d > reach) { P.miss = true; return; }
      const q = SP.clamp((1 - Math.abs(err) / win) * 0.55 + (1 - d / reach) * 0.45, 0, 1);
      const spray = err / win * 58 + (Math.random() - 0.5) * 30;
      const launch = SP.clamp(14 + (P.loc.y - st.aimB.y) * 55 + (Math.random() - 0.5) * 16, -12, 70);
      P.contact = true;
      if (q < 0.16 || Math.abs(spray) > 46) { ev('bat', {v: 0.5}); foul('파울'); return; }
      const T = TM[bsd()], crit = Math.random() < (T.crit || 0) * 0.6;
      const v = (13 + q * (15 + b.st.pow * 0.18) * (crit ? 1.15 : 1)) * (0.85 + 0.15 * b.atp) * (T.shot || 1) ** 0.5;
      ev('bat', {v: 0.6 + q}); if (crit) ev('msg', {text: '💥 돌연변이 타격!', ms: 800});
      startPlay(v, launch, spray);
    }
    function foul(txt) {
      if (st.strikes < 2) st.strikes++;
      runners.forEach(r => { if (r.steal) { r.p = r.to - 1; r.to = r.p; r.steal = false; } });
      dead(txt, 0.9, 'pitch');
    }
    function dead(txt, t, next, sub) { st.phase = 'dead'; st.t = 0; st.deadT = t; st.next = next; if (txt) ev('msg', {text: txt, sub: sub || '', ms: Math.min(1600, t * 1000)}); }
    function pitchCaught() {
      const P = st.pitch, b = batter(), bi = idx(b), pi = idx(E(fsd(), 0)); ev('mitt');
      const strike = P.miss || (st.swingT < 0 && P.inZ);
      if (strike) st.strikes++; else st.balls++;
      ball.holder = fsd() * 10 + 1; ball.live = true;
      if (st.strikes >= 3) { st.bs[bi].ab++; st.bs[bi].k++; st.ps[pi].k++; outRec(null); ev('msg', {text: P.miss ? '헛스윙 삼진!' : '루킹 삼진!', sub: `${st.lastType}`, ms: 1200}); ev('clack');
        if (st.outs >= 3) { dead(null, 1.3, 'half'); return; }
        if (runners.some(r => r.steal)) { beginStealPlay(true); return; } dead(null, 1.2, 'batter'); return; }
      if (st.balls >= 4) { st.bs[bi].bb++; st.ps[pi].bb++; walk(bi); return; }
      if (runners.some(r => r.steal)) { beginStealPlay(false); return; }
      dead(strike ? (st.swingT >= 0 ? '헛스윙 스트라이크' : '스트라이크') : '볼', 0.8, 'pitch', `${st.lastType} · B${st.balls} S${st.strikes}`);
    }
    function walk(bi) {
      runners.forEach(r => r.steal = false);
      let need = 1; for (let b = 1; b <= 3; b++) { const r = atBase(b); if (r && need === b) { need = b + 1; } else break; }
      for (let b = need - 1; b >= 1; b--) { const r = atBase(b); if (r) { r.p = r.to = b + 1; if (r.p >= 4) scoreRun(r, true); } }
      runners.push({ei: bi, p: 1, to: 1}); runners = runners.filter(r => !r.home);
      dead('볼넷 · 1루 출루', 1.2, 'batter');
    }
    // ---------- 인플레이 ----------
    function resetPlay() { Object.assign(play, {chaser: -1, chT: 0, outs: 0, fly: false, err: false, runs: [], batterOutAt1: false, lastOutForce: false, hr: false, catchDist: 0, t: 0, endT: 0, steal: false, flyCaught: false, runTo: null, kOut: false}); }
    function beginStealPlay(kOut) { resetPlay(); play.steal = true; st.phase = 'play'; ball.live = true; ball.thrown = null; ball.holder = fsd() * 10 + 1; ball.holdT = -0.55 + E(fsd(), 1).st.bal / 400; [ball.x, ball.z] = [-1.2, 0]; ball.y = 1.1; play.kOut = kOut; }
    function startPlay(v, launch, spray) {
      resetPlay(); st.phase = 'play'; const la = launch * Math.PI / 180, sa = spray * Math.PI / 180;
      Object.assign(ball, {x: 0.4, y: 1.0, z: -0.2, vx: v * Math.cos(la) * Math.cos(sa), vy: v * Math.sin(la), vz: v * Math.cos(la) * Math.sin(sa), live: true, holder: -1, bounced: false, thrown: null, holdT: 0});
      play.fly = launch >= 22; play.before = runners.map(r => ({ei: r.ei, p: Math.round(r.to === r.p ? r.p : r.p - 0.12)}));
      const bi = idx(batter());
      const occ = b => runners.some(r => Math.round(r.steal ? r.to - 1 : r.p) === b);
      let forced = true; for (let b = 1; b <= 3; b++) { const r = runners.find(x => Math.round(x.steal ? x.to - 1 : x.p) === b); if (!r) { forced = false; continue; } r.forced = forced && occ(b); if (!r.forced) forced = false; }
      // 강제 진루 계산은 1루부터 연속으로 차 있을 때만
      let chain = true; for (let b = 1; b <= 3; b++) { const r = runners.find(x => Math.round(x.steal ? x.to - 1 : x.p) === b); if (!r) chain = false; if (r) r.forced = chain; }
      for (const r of runners) { if (r.forced) r.forceBase = Math.round(r.steal ? r.to - 1 : r.p) + 1;
        if (play.fly && st.outs < 2) { if (!r.steal) r.to = r.p; r.wait = true; } else if (r.forced) r.to = Math.floor(r.p) + 1; else if (!r.steal) r.wait = true; }
      runners.push({ei: bi, p: 0, to: 1, forced: true, forceBase: 1, batter: true});
      const b = batter(); b.face = Math.PI / 4;
    }
    function landing() { // 공중 공이 떨어질 곳
      if (ball.bounced || ball.y <= 0.2) return null; const a = -G / 2, bq = ball.vy, c = ball.y - 0.4, t = (-bq - Math.sqrt(Math.max(0, bq * bq - 4 * a * c))) / (2 * a);
      return {t, x: ball.x + ball.vx * t, z: ball.z + ball.vz * t}; }
    function predict(t) { // 굴러가는 공 예측
      if (!ball.bounced) { const L = landing(); if (L && t < L.t) return {x: ball.x + ball.vx * t, z: ball.z + ball.vz * t}; }
      const sp = Math.hypot(ball.vx, ball.vz), tt = Math.min(t, sp / 6), d = sp * tt - 3 * tt * tt; const k = sp ? d / sp : 0; return {x: ball.x + ball.vx * k, z: ball.z + ball.vz * k}; }
    function coverOf(b) { // 베이스 커버 수비수 슬롯
      const f = fsd(), ch = play.chaser >= 0 ? ents[play.chaser].slot : -1;
      if (b === 4) return 1; if (b === 1) return ch === 2 ? 0 : 2; if (b === 2) return ch === 5 || (ch !== 3 && ball.z > 0) ? 3 : 5; if (b === 3) return ch === 4 ? 5 : 4; return -1; }
    function fieldStep(dt) {
      const fs = fielders(), f = fsd();
      play.chT -= dt;
      if (ball.holder < 0 && !ball.thrown && play.chT <= 0) { play.chT = 0.3; let best = -1, bt = 1e9;
        for (const e of fs) { if (e.slot === 1 && Math.hypot(ball.x, ball.z) > 7) continue; const sp = SP.runSpeed(e, 7.2); let tt = 0, P = null; for (let k = 0; k < 4; k++) { P = predict(tt); tt = Math.hypot(P.x - e.x, P.z - e.z) / sp + 0.15; } const L = landing(); if (L && !ball.bounced) { const tl = Math.hypot(L.x - e.x, L.z - e.z) / sp; if (tl < tt) tt = tl; } if (tt < bt) { bt = tt; best = idx(e); } }
        play.chaser = best; }
      const covers = {}; for (let b = 1; b <= 4; b++) covers[coverOf(b)] = b;
      for (const e of fs) {
        const i = idx(e); let tx = FP[e.slot][0], tz = FP[e.slot][1], sp = SP.runSpeed(e, 6.4) * (0.85 + TM[f].mod.spd / 100);
        if (play.t < 0.3 - e.st.spd / 1000 && !play.steal) { e.spdNow = 0; continue; }
        if (i === ball.holder) { if (play.runTo != null) { const B = BASE[play.runTo % 4]; tx = B[0]; tz = B[1]; } else { tx = e.x; tz = e.z; } }
        else if (i === play.chaser && ball.holder < 0 && !ball.thrown) { const L = landing(); let P; if (L && !ball.bounced) P = L; else { let tt = 0.2; for (let k = 0; k < 3; k++) { P = predict(tt); tt = Math.hypot(P.x - e.x, P.z - e.z) / sp + 0.1; } } tx = P.x; tz = P.z; }
        else if (covers[e.slot] != null && (ball.live)) { const B = BASE[covers[e.slot] % 4]; tx = B[0] + (covers[e.slot] === 4 ? -0.6 : 0); tz = B[1]; }
        else if (e.slot >= 6) { tx += (ball.x - tx) * 0.25; tz += (ball.z - tz) * 0.25; sp *= 0.7; }
        const dx = tx - e.x, dz = tz - e.z, d = Math.hypot(dx, dz);
        if (d > 0.15) { const m = Math.min(sp, d * 4); e.x += dx / d * m * dt; e.z += dz / d * m * dt; e.face = Math.atan2(dx, dz); e.spdNow = m; SP.drainATP(e, true, dt, TM[f], 0.3); } else { e.spdNow = 0; e.face = Math.atan2(ball.x - e.x, ball.z - e.z); }
      }
    }
    function ballStep(dt) {
      if (ball.holder >= 0) { const h = ents[ball.holder]; ball.x = h.x + Math.sin(h.face) * 0.3; ball.z = h.z + Math.cos(h.face) * 0.3; ball.y = 1.1; ball.holdT += dt; return; }
      if (ball.thrown) { const T = ball.thrown; T.t += dt; const k = Math.min(1, T.t / T.T); ball.x = T.sx + (T.tx - T.sx) * k; ball.z = T.sz + (T.tz - T.sz) * k; ball.y = 1.3 + Math.sin(k * Math.PI) * T.h;
        if (k >= 1) { ball.thrown = null; const cs = coverOf(T.b), rc = cs >= 0 ? E(fsd(), cs) : null; let recv = rc; if (!recv || Math.hypot(recv.x - T.tx, recv.z - T.tz) > 3) { recv = fielders().sort((a, b) => Math.hypot(a.x - T.tx, a.z - T.tz) - Math.hypot(b.x - T.tx, b.z - T.tz))[0]; } recv.x = T.tx + (T.b === 4 ? -0.6 : 0) * 0; recv.z = T.tz; ball.holder = idx(recv); ball.holdT = 0; play.runTo = null; ev('mitt'); checkTagAt(); }
        return; }
      // 타구
      ball.vy -= G * dt; ball.x += ball.vx * dt; ball.y += ball.vy * dt; ball.z += ball.vz * dt;
      const r = Math.hypot(ball.x, ball.z), ang = Math.atan2(ball.z, ball.x), fair = Math.abs(ang) <= Math.PI / 4 + 0.01;
      if (r >= FENCE(ang) && fair) { if (ball.y > 2.4 && !ball.bounced) { homeRun(); return; } ball.vx *= -0.3; ball.vz *= -0.3; const k = (FENCE(ang) - 0.3) / r; ball.x *= k; ball.z *= k; }
      if (r > 52) { foul('파울'); return; }
      if (ball.y < 0.12) { ball.y = 0.12; if (!ball.bounced) { ball.bounced = true; if (!fair && r > 1.5) { foul('파울'); return; } if (Math.hypot(ball.x, ball.z) < 1.2 && ball.x < 0) { foul('파울'); return; } }
        if (Math.abs(ball.vy) > 1.5) { ball.vy = -ball.vy * 0.38; ball.vx *= 0.72; ball.vz *= 0.72; ev('clack'); } else { ball.vy = 0; const sp = Math.hypot(ball.vx, ball.vz); if (sp > 0) { const ns = Math.max(0, sp - 6 * dt); ball.vx *= ns / sp; ball.vz *= ns / sp; } } }
      // 포구
      if (ball.y < 2.5) for (const e of fielders()) { const d = Math.hypot(e.x - ball.x, e.z - ball.z); if (d > (ball.bounced ? 0.85 : 0.55) + e.st.def / 500) continue;
        if (!ball.bounced) { // 뜬공·직선타 포구
          if (Math.random() < 0.015) { ball.vx *= -0.2; ball.vz *= -0.2; ball.vy = 2; ball.bounced = true; play.err = true; st.Er[fsd()]++; ev('msg', {text: '실책! 공을 놓쳤어요', ms: 900}); break; }
          ball.holder = idx(e); ball.holdT = 0; ev('mitt'); flyOut(e); return; }
        if (Math.random() < 0.025 * (1.3 - e.st.def / 100)) { ball.vx = (Math.random() - .5) * 6; ball.vz = (Math.random() - .5) * 6; play.err = true; st.Er[fsd()]++; ev('msg', {text: '실책! 땅볼을 흘렸어요', ms: 900}); break; }
        ball.holder = idx(e); ball.holdT = -0.1 + e.st.bal / 1000; ev('mitt'); return; }
    }
    function flyOut(e) {
      play.fly = true; play.flyCaught = true; play.catchDist = Math.hypot(e.x, e.z);
      const bi = idx(batter()), br = runners.find(r => r.batter); if (br) { br.out = true; ents[br.ei].out = true; }
      st.bs[bi].ab++; play.outs++; outRec(null);
      ev('msg', {text: play.catchDist > 22 ? '외야 뜬공 아웃' : play.catchDist > 10 ? '내야 뜬공 아웃' : '파울/팝 플라이 아웃', ms: 900});
      runners = runners.filter(r => !r.out);
      for (const r of runners) { r.forced = false; const base = Math.floor(r.p + 0.001); if (r.p > base + 0.001 || r.to > base) { r.to = base; r.returning = true; r.wait = false; } else if (base === 3 && st.outs < 3 && play.catchDist > 26) { r.to = 4; r.wait = false; r.tag = true; } else r.wait = false; }
      if (st.outs >= 3) endPlay();
    }
    function homeRun() {
      play.hr = true; const bi = idx(batter()), n = runners.length;
      ev('cheer', {big: true}); ev('msg', {text: n >= 4 ? '🎆 만루 홈런!!' : '🎆 홈런!!', sub: `${batter().name} · ${n}점`, ms: 2000}); SP.cam.shake = 0.6;
      st.bs[bi].ab++; st.bs[bi].h++; st.bs[bi].hr++; st.H[bsd()]++; st.ps[idx(E(fsd(), 0))].h++;
      for (const r of runners) { r.to = 4; r.wait = false; r.trot = true; scoreRun(r, false, true); }
      ball.vx = ball.vz = ball.vy = 0; ball.y = -5; ball.live = false;
      dead(null, 3.2, 'batter');
    }
    function scoreRun(r, walkRun, hrTrot) {
      if (r.counted) return; r.counted = true; const sd = bsd(); st.score[sd]++; const li = st.inn - 1; st.line[sd][li] = (st.line[sd][li] || 0) + 1; st.bs[r.ei].r++; st.ps[idx(E(fsd(), 0))].r++;
      if (!play.err || walkRun) st.bs[idx(batter())].rbi++;
      if (!hrTrot) { play.runs.push(r); ev('cheer', {}); ev('msg', {text: '득점!', sub: ents[r.ei].name + ' 홈인', ms: 900}); }
      if (!hrTrot) { r.home = true; ents[r.ei].out = true; }
      if (st.half === 1 && st.inn >= innN && st.score[1] > st.score[0]) { st.walkoff = true; }
    }
    function outRec(r) { st.outs++; if (r) { r.out = true; ents[r.ei].out = true; } }
    function checkTagAt() { // 공을 잡은 수비수가 베이스 위에 있으면 그 베이스로 오는 주자 아웃
      const h = ents[ball.holder]; for (let b = 1; b <= 4; b++) { const B = BASE[b % 4]; if (Math.hypot(h.x - B[0], h.z - B[1]) > 1.0) continue;
        for (const r of runners) { if (r.out || r.home || r.to !== b || Math.abs(r.p - b) < 0.01) continue; if (r.wait) continue;
          const force = r.forced && r.forceBase === b; outRec(r); play.outs++; play.lastOutForce = force; if (r.batter) { play.batterOutAt1 = b === 1; st.bs[r.ei].ab++; }
          ev('msg', {text: b === 4 ? '홈에서 아웃!' : r.steal && play.steal ? '도루 저지! 아웃' : `${b}루 ${force ? '포스' : '태그'} 아웃`, sub: ents[r.ei].name, ms: 1000}); ev('clack');
          if (st.outs >= 3) { endPlay(); return; } } }
      runners = runners.filter(r => !r.out);
    }
    function runnerSpeed(r) { return SP.runSpeed(ents[r.ei], 6.4) / BS; }
    function ballEta(b) { const B = BASE[b % 4], thr = 30;
      if (ball.holder >= 0) { const h = ents[ball.holder]; return Math.hypot(h.x - B[0], h.z - B[1]) / thr + 0.25 - Math.min(0, ball.holdT); }
      if (ball.thrown) { const T = ball.thrown; return (T.T - T.t) + Math.hypot(T.tx - B[0], T.tz - B[1]) / thr + 0.2; }
      let bt = 9; for (const e of fielders()) bt = Math.min(bt, Math.hypot(e.x - ball.x, e.z - ball.z) / 7);
      const L = landing(); if (L) bt = Math.max(bt, L.t);
      return bt + 0.3 + Math.hypot(ball.x - B[0], ball.z - B[1]) / thr; }
    function runnersStep(dt) {
      runners.sort((a, b) => b.p - a.p);
      for (const r of runners) { if (r.out || r.home) continue; const e = ents[r.ei];
        if (r.wait) { // 뜬공: 공이 떨어지면 판단
          if (ball.bounced || ball.holder >= 0 && !play.flyCaught) { r.wait = false; if (r.forced) r.to = Math.floor(r.p) + 1; } else { e.spdNow = 0; continue; } }
        if (Math.abs(r.p - r.to) < 0.001) { // 베이스 위: 더 갈지 판단
          if (!play.flyCaught || r.tag) { const nb = Math.round(r.p) + 1; if (nb <= 4 && st.phase === 'play' && !runners.some(o => o !== r && !o.out && !o.home && (Math.round(o.to) === nb || (Math.round(o.p) === nb && Math.abs(o.p - o.to) < 0.01)))) { const tRun = 1 / runnerSpeed(r), eta = ballEta(nb); if (tRun * 1.08 < eta && (ball.holder < 0 || ball.holdT < 0.6 || eta > tRun * 1.4)) r.to = nb; } }
          if (Math.abs(r.p - r.to) < 0.001) { e.spdNow = 0; e.face = Math.atan2(ball.x - e.x, ball.z - e.z); continue; } }
        const sp = runnerSpeed(r) * (r.trot ? 0.8 : 1), dir = Math.sign(r.to - r.p); r.p += dir * Math.min(sp * dt, Math.abs(r.to - r.p));
        const [nx, nz] = posOf(r.p); e.face = Math.atan2(nx - e.x, nz - e.z); e.x = nx; e.z = nz; e.spdNow = sp * BS; SP.drainATP(e, true, dt, TM[bsd()]);
        if (Math.abs(r.p - r.to) < 0.001) { r.returning = false; if (r.p >= 4) { if (r.trot) { r.home = true; e.out = true; } else scoreRun(r); } else if (r.steal && play.steal) { /* 도루 판정은 공이 올 때 */ } }
      }
      runners = runners.filter(r => !r.out && !r.home);
    }
    function holderStep() {
      if (ball.holder < 0 || ball.holdT < 0.15) return; const h = ents[ball.holder];
      checkTagAt(); if (st.phase !== 'play') return;
      const moving = runners.filter(r => !r.out && !r.home && Math.abs(r.p - r.to) > 0.001 && !r.wait);
      if (!moving.length) { play.endT += 1 / 60; if (play.endT > 0.35 || ball.holdT > 0.8) endPlay(); return; }
      if (ball.thrown || play.runTo != null) return;
      let best = null;
      for (const r of moving) { const B = BASE[r.to % 4], dB = Math.hypot(h.x - B[0], h.z - B[1]), tBall = dB < 2.5 ? dB / SP.runSpeed(h, 7) : dB / (26 + h.st.pow / 10) + 0.12, tRun = Math.abs(r.to - r.p) / runnerSpeed(r);
        if (tBall < tRun && (!best || r.to > best.to)) best = r; }
      const tgt = best ? best.to : Math.max(...moving.map(r => r.to));
      const B = BASE[tgt % 4], dB = Math.hypot(h.x - B[0], h.z - B[1]);
      if (dB < 2.5 && best) { play.runTo = tgt; return; }
      if (ball.holdT < 0.3) return;
      const cs = coverOf(tgt), rc = cs >= 0 ? E(fsd(), cs) : null; if (rc === h) { play.runTo = tgt; return; }
      const v = 26 + h.st.pow / 10; ball.thrown = {sx: ball.x, sz: ball.z, tx: B[0] + (Math.random() - .5) * 0.4 * (1.2 - h.st.bal / 100), tz: B[1], t: 0, T: dB / v, h: 0.5 + dB * 0.03, b: tgt}; ball.holder = -1; SP.pose(h.mesh, 'swing', 250);
    }
    function endPlay() {
      if (st.phase !== 'play') return;
      const bi = idx(batter()), br = runners.find(r => r.batter);
      // 3아웃이 포스아웃·타자주자 1루 아웃이면 그 플레이의 득점 취소
      if (st.outs >= 3 && (play.lastOutForce || play.batterOutAt1) && play.runs.length) { const sd = bsd(), li = st.inn - 1; for (const r of play.runs) { st.score[sd]--; st.line[sd][li]--; st.bs[r.ei].r--; if (!play.err) st.bs[bi].rbi--; } play.runs = []; st.walkoff = false; }
      let txt = '', sub = '';
      if (play.steal) { const ok = runners.some(r => r.steal); if (ok) { runners.filter(r => r.steal).forEach(r => { st.bs[r.ei].sb++; }); txt = '도루 성공!'; } else txt = txt || ''; }
      else if (play.flyCaught) txt = play.outs >= 2 ? '더블 플레이!' : '';
      else if (br && !br.out) { const fb = Math.round(br.p); if (play.err) txt = '실책으로 출루'; else if (play.outs > 0) txt = '야수 선택 · 출루'; else { st.bs[bi].ab++; st.bs[bi].h++; st.H[bsd()]++; st.ps[idx(E(fsd(), 0))].h++; txt = ['', '안타!', '2루타!', '3루타!'][fb] || '안타!'; ev('cheer', {}); }
        if (play.err || play.outs > 0) st.bs[bi].ab++; }
      else if (!br && !play.flyCaught) txt = play.outs >= 2 ? '병살!' : '땅볼 아웃';
      if (play.outs >= 2 && !play.flyCaught && br && br.out) txt = '병살 플레이!';
      runners.forEach(r => { r.p = r.to = Math.round(r.p); r.batter = false; r.steal = false; r.forced = false; r.wait = false; r.tag = false; r.returning = false; r.trot = false; });
      runners = runners.filter(r => !r.out && !r.home && r.p >= 1 && r.p <= 3);
      const pk = play.kOut; const nxt = st.outs >= 3 ? 'half' : (play.steal && !pk && st.balls < 4) ? 'pitch' : 'batter';
      dead(txt, 1.3, nxt, sub);
    }
    function afterDead() {
      if (st.walkoff || st.end) { st.end = true; st.phase = 'end'; return; }
      if (st.next === 'pitch') { startPitchAim(); return; }
      if (st.next === 'batter') { st.batI[bsd()] = (st.batI[bsd()] + 1) % 9; beginAtBat(); return; }
      if (st.next === 'half') { // 공수 교대
        st.batI[bsd()] = (st.batI[bsd()] + 1) % 9;
        const sd = bsd(); st.line[sd][st.inn - 1] = st.line[sd][st.inn - 1] || 0;
        if (st.half === 0 && st.inn >= innN && st.score[1] > st.score[0]) { st.end = true; st.phase = 'end'; return; }
        if (st.half === 1 && st.inn >= innN && (st.score[0] !== st.score[1] || st.inn >= innN + 3)) { st.end = true; st.phase = 'end'; return; }
        if (st.half === 1) st.inn++; st.half ^= 1; st.outs = 0; runners = [];
        aiBullpen(fsd());
        ev('whistle', {n: 2}); ev('msg', {text: `${st.inn}회${st.half ? '말' : '초'}${st.inn > innN ? ' (연장)' : ''}`, sub: `${SP.TEAMS[cfg.teams[bsd()]].name} 공격`, ms: 1500});
        st.phase = 'pre'; st.t = -0.6; placeTeams(); return; }
    }
    function aiBullpen(f) { if (cfg.sides[f] !== 'ai') return; const p = E(f, 0); if (p.atp > 0.3) return;
      const used = new Set(ents.slice(f * 10, f * 10 + 10).map(e => e.pi)); const c = SP.roster(cfg.teams[f]).filter(x => !used.has(x.i) && !st.used[f].has(x.i)).sort((a, b) => (b.st.pow + b.st.bal) - (a.st.pow + a.st.bal))[0];
      if (c) { st.used[f].add(p.pi); SP.doSwap(cfg, p, c.i, {cap: true}); p.atp = 1; ev('msg', {text: '투수 교체', sub: `${SP.TEAMS[cfg.teams[f]].name} · ${c.name}`, ms: 1300}); } }
    // ---------- 프레임 ----------
    function step(dt, ins) {
      if (st.end) return; st.t += dt;
      const b = bsd(), f = fsd(), iB = ins[b], iF = ins[f];
      SP.audio.crowd(0.25 + (runners.length ? 0.15 : 0) + (st.phase === 'play' ? 0.35 : 0));
      if (st.phase === 'pre') { if (st.t > 0.9) beginAtBat(); return; }
      if (st.phase === 'dead') { runnersStep(dt); if (st.t > st.deadT) afterDead(); return; }
      const moveAim = (a, inp, k) => { a.x = SP.clamp(a.x + inp.mx * dt * k, -1.6, 1.6); a.y = SP.clamp(a.y - inp.my * dt * k, -1.6, 1.6); };
      if (st.phase === 'aim') {
        if (iB) { moveAim(st.aimB, iB, 2.4); if (iB.a) trySteal(); }
        if (iF) { if (iF.num >= 1 && iF.num <= 4) st.ptype = iF.num - 1; if (iF.c) st.ptype = (st.ptype + 1) % 4; moveAim(st.aimP, iF, 1.8); if ((iF.b && st.t > 0.35) || st.t > 20) release(true); }
        else if (st.t > 1.4) { aiPitch(); release(false); }
        return;
      }
      if (st.phase === 'pitch') {
        st.pt += dt; const P = st.pitch;
        if (iB) { moveAim(st.aimB, iB, 2.4); if (iB.b && st.swingT < 0) swing(st.pt); }
        else if (P.ai && P.ai.swing && st.swingT < 0 && st.pt >= P.ai.ts) { st.aimB = P.ai.aim; swing(st.pt); }
        runnersStep(dt);
        if (st.phase === 'pitch') { const [x, y, z] = pitchPos(Math.min(1, st.pt / P.T)); ball.x = x; ball.y = y; ball.z = z; if (st.pt > P.T) { const k = (st.pt - P.T) / 0.12; ball.x = 0.1 - k * 1.3; }
          if (st.pt >= P.T + 0.12) pitchCaught(); }
        return;
      }
      if (st.phase === 'play') { play.t += dt; fieldStep(dt); ballStep(dt); if (st.phase !== 'play') return; holderStep(); if (st.phase !== 'play') return; runnersStep(dt);
        if (play.t > 22) endPlay(); }
    }
    // ---------- 화면 ----------
    function view(dt) {
      const me = cfg.me, local = cfg.sides[me] === 'local';
      SP.viewEnts(ents, dt, e => false);
      ballM.position.set(ball.x, ball.y, ball.z); ballM.visible = ball.y > -1;
      const bt = batter(); const sw = st.swingT >= 0 && (st.phase === 'pitch' || st.phase === 'play' || st.phase === 'dead') ? Math.min(1, ((st.phase === 'pitch' ? st.pt : 9) - st.swingT) / 0.18) : 0;
      batM.visible = !bt.out && (st.phase === 'aim' || st.phase === 'pitch' || (st.phase === 'dead' && st.next !== 'batter' && st.next !== 'half') || (st.phase === 'play' && play.t < 0.3));
      batM.position.set(bt.mesh.position.x + 0.1, 1.0, bt.mesh.position.z + 0.25); batM.rotation.set(0, 0, 0);
      batM.rotation.z = sw ? -1.6 : 0.6; batM.rotation.y = sw ? Math.PI * (0.2 + sw * 1.1) : -0.5;
      const showZone = st.phase === 'aim' || st.phase === 'pitch'; zone.visible = showZone;
      const pcam = showZone || (st.phase === 'dead' && st.next === 'pitch'); const ct = E(fsd(), 1).mesh; ct.scale.y = pcam ? 0.62 : 1; ct.userData.bar.visible = ct.userData.barBg.visible = !pcam; bt.mesh.userData.bar.visible = bt.mesh.userData.barBg.visible = !pcam; E(bsd(), 1).mesh.scale.y = 1;
      const amP = local && me === fsd(), amB = local && me === bsd();
      curP.visible = showZone && amP && st.phase === 'aim'; curB.visible = showZone && amB;
      curP.position.set(0.14, 1.1 + st.aimP.y * 0.5, st.aimP.x * 0.45); curB.position.set(0.13, 1.1 + st.aimB.y * 0.5, st.aimB.x * 0.45);
      if (st.phase === 'aim' || st.phase === 'pitch' || (st.phase === 'dead' && st.next === 'pitch')) SP.camTo(SP.cam.mode === 'persp' ? {x: 5, y: 1.0, z: 0, dist: 9.5, h: 2.7, yaw: -Math.PI / 2 + 0.13} : {x: 6, y: 0, z: 0, dist: 22, h: 10, yaw: -Math.PI / 2});
      else if (st.phase === 'play' || st.phase === 'dead') SP.camTo(SP.cam.mode === 'persp' ? {x: 6 + Math.max(0, ball.x) * 0.55, y: 0, z: ball.z * 0.5, dist: 26 + Math.max(0, ball.x) * 0.3, h: 22, yaw: -Math.PI / 2} : {x: 14 + ball.x * 0.3, y: 0, z: ball.z * 0.3, dist: 56, h: 22, yaw: -Math.PI / 2});
      else SP.camTo({x: 16, y: 0, z: 0, dist: 34, h: 26, yaw: -Math.PI / 2});
      SP.gauge(null);
    }
    function countHtml() { const on = b => runners.some(r => Math.abs(r.p - b) < 0.3);
      const dia = (x, y, f) => `<rect x="${x - 7}" y="${y - 7}" width="14" height="14" transform="rotate(45 ${x} ${y})" fill="${f ? '#ffd25e' : 'rgba(255,255,255,.12)'}" stroke="#fff" stroke-width="1.5"/>`;
      const dots = (n, max, c) => Array.from({length: max}, (_, i) => `<i style="display:inline-block;width:10px;height:10px;border-radius:50%;margin-left:3px;background:${i < n ? c : 'rgba(255,255,255,.18)'}"></i>`).join('');
      return `<div style="display:flex;gap:12px;align-items:center"><svg width="56" height="44" viewBox="0 0 56 44">${dia(28, 10, on(2))}${dia(12, 26, on(3))}${dia(44, 26, on(1))}</svg><div style="line-height:1.45;font-size:12px"><div>B${dots(st.balls, 3, '#5ef2a0')}</div><div>S${dots(st.strikes, 2, '#ffd25e')}</div><div>O${dots(st.outs, 2, '#ff5d6c')}</div></div></div>`; }
    function hudInfo() { const me = cfg.me; if (cfg.sides[me] !== 'local') return '';
      if (st.phase === 'aim' && me === fsd()) return `⚾ <b>${PT[st.ptype].n}</b> · 빨간 원을 던질 코스로 옮기고 투구`;
      if ((st.phase === 'aim' || st.phase === 'pitch') && me === bsd()) return st.steal >= 0 ? '🏃 도루 준비 완료! · 초록 원을 공에 맞추고 스윙' : '초록 원을 공 위치에 맞추고, 공이 존에 닿는 순간 스윙';
      return ''; }
    const N = n => n.toString();
    return {
      step, view,
      snap() { return {e: SP.snapEnts(ents), b: [ball.x, ball.y, ball.z].map(v => Math.round(v * 100) / 100), s: [st.inn, st.half, st.outs, st.balls, st.strikes, st.score, st.phase, st.ptype, st.swingT, st.pt, st.next, st.batI, st.H, st.Er, st.steal], ap: [st.aimP.x, st.aimP.y, st.aimB.x, st.aimB.y].map(v => Math.round(v * 100) / 100), ln: st.line, bs: st.bs, ps: st.ps, r: runners.map(r => [r.ei, Math.round(r.p * 100) / 100]), ev: EV.recent(), end: st.end}; },
      apply(s) { SP.applyEnts(cfg, ents, s.e, () => ({cap: true})); [ball.x, ball.y, ball.z] = s.b; [st.inn, st.half, st.outs, st.balls, st.strikes, st.score, st.phase, st.ptype, st.swingT, st.pt, st.next, st.batI, st.H, st.Er, st.steal] = s.s; [st.aimP.x, st.aimP.y] = s.ap; if (cfg.sides[cfg.me] !== 'local' || cfg.me !== bsd()) [st.aimB.x, st.aimB.y] = s.ap.slice(2); else [st.aimB.x, st.aimB.y] = s.ap.slice(2); st.line = s.ln; st.bs = s.bs; st.ps = s.ps; runners = s.r.map(a => ({ei: a[0], p: a[1], to: a[1]})); st.end = s.end; EV.ingest(s.ev); },
      miniOn() { return st.phase === 'play' || st.phase === 'pre' || (st.phase === 'dead' && st.next !== 'pitch'); },
      buttons(me) { if (st.phase === 'aim' && me === fsd()) return {b: '투구', c: '구종', move: true}; if ((st.phase === 'aim' || st.phase === 'pitch') && me === bsd()) return {b: '스윙', a: runners.some(r => Math.round(r.p) <= 2) ? '도루' : null}; return {move: false}; },
      picks(me) { return st.phase === 'aim' && me === fsd() && cfg.sides[me] === 'local' ? PT.map((p, i) => ({n: i + 1, label: p.n, on: st.ptype === i})) : null; },
      hud() { const T = cfg.teams.map(i => SP.TEAMS[i]); const bases = [1, 2, 3].map(b => runners.some(r => Math.round(r.p) === b && Math.abs(r.p - b) < 0.3) ? '◆' : '◇');
        return {score: {a: {name: T[0].name, c1: SP.kit(cfg, 0).c1, pts: st.score[0]}, b: {name: T[1].name, c1: SP.kit(cfg, 1).c1, pts: st.score[1]}, sub: `${st.inn}회${st.half ? '말' : '초'} · ${SP.TEAMS[cfg.teams[bsd()]].name} 공격 · 투구 ${st.ps[idx(E(fsd(), 0))].p}`, clock: `${st.inn}${st.half ? '▼' : '▲'}`}, info: hudInfo(), extra: countHtml()}; },
      minimap(g, w, h) { g.fillStyle = '#2f8a4a'; g.fillRect(0, 0, w, h); const s = Math.min(w / 72, h / 52), ox = w / 2, oy = h - 6, P = (x, z) => [ox + z * s, oy - x * s];
        g.fillStyle = '#3fae6a'; g.beginPath(); g.moveTo(...P(0, 0)); for (let a = -45; a <= 45; a += 5) { const r = FENCE(a * Math.PI / 180); g.lineTo(...P(Math.cos(a * Math.PI / 180) * r, Math.sin(a * Math.PI / 180) * r)); } g.closePath(); g.fill();
        g.fillStyle = '#c8925a'; g.beginPath(); BASE.forEach((b, i) => g[i ? 'lineTo' : 'moveTo'](...P(b[0] * 1.35 - (i % 2 ? 0 : 0), b[1] * 1.35))); g.fill();
        g.fillStyle = '#fff'; for (let b = 0; b < 4; b++) { const [x, y] = P(BASE[b][0], BASE[b][1]); g.fillRect(x - 3, y - 3, 6, 6); }
        for (const e of ents) { if (e.out) continue; g.fillStyle = SP.kit(cfg, e.side).c1; const [x, y] = P(e.x, e.z); g.beginPath(); g.arc(x, y, 4, 0, 6.3); g.fill(); }
        if (ball.y > -1) { g.fillStyle = '#fff'; const [x, y] = P(ball.x, ball.z); g.beginPath(); g.arc(x, y, 3, 0, 6.3); g.fill(); } },
      status() { const T = cfg.teams.map(i => SP.TEAMS[i]), n = Math.max(innN, st.inn);
        const cells = sd => Array.from({length: n}, (_, i) => `<td>${st.line[sd][i] != null ? st.line[sd][i] : (i < st.inn - 1 || (i === st.inn - 1 && sd < st.half) ? 0 : '')}</td>`).join('');
        const line = `<table class="rt"><tr><th>팀</th>${Array.from({length: n}, (_, i) => `<th>${i + 1}</th>`).join('')}<th>R</th><th>H</th><th>E</th></tr>${[0, 1].map(sd => `<tr><td><b>${SP.esc(T[sd].name)}</b></td>${cells(sd)}<td><b>${st.score[sd]}</b></td><td>${st.H[sd]}</td><td>${st.Er[sd]}</td></tr>`).join('')}</table>`;
        const bats = sd => bat[sd].map((s, k) => { const e = E(sd, s), b = st.bs[idx(e)]; return `${k + 1}. ${SL[s]} ${SP.esc(e.name)} — ${b.h}/${b.ab} (${avg(idx(e))}) ${b.hr ? b.hr + '홈런 ' : ''}${b.rbi ? b.rbi + '타점 ' : ''}${b.bb ? b.bb + '볼넷 ' : ''}${b.sb ? b.sb + '도루' : ''}`; }).join('<br>');
        const pit = sd => { const e = E(sd, 0), p = st.ps[idx(e)]; return `<b>투수 ${SP.esc(e.name)}</b> · 투구수 ${p.p} · 탈삼진 ${p.k} · 볼넷 ${p.bb} · 피안타 ${p.h} · 실점 ${p.r} · ATP ${Math.round(e.atp * 100)}%`; };
        return line + `<div class="wrap2" style="margin-top:8px"><div class="sub" style="font-size:12.5px">${pit(0)}<br>${bats(0)}</div><div class="sub" style="font-size:12.5px">${pit(1)}<br>${bats(1)}</div></div>`; },
      subInfo() { const ok = st.phase === 'aim' || st.phase === 'pre' || st.phase === 'dead'; return {ok, text: '투구 사이에 교체 · 교체된 선수는 다시 못 나와요', why: ok ? '' : '공이 살아 있을 때는 교체할 수 없어요'}; },
      lineupState(side) { const r = SP.lineupStateOf(cfg, ents, side, st.used[side]); r.on.forEach(o => { const e = E(side, o.slot), b = st.bs[idx(e)]; o.pos = SLK[o.slot]; o.note = o.slot === 0 ? `투구 ${st.ps[idx(e)].p}개` : `${b.h}/${b.ab} 타수`; }); return r; },
      sub(side, slot, inIdx) { const ok = st.phase === 'aim' || st.phase === 'pre' || st.phase === 'dead'; if (!ok) return {ok: false, msg: '공이 살아 있을 때는 교체할 수 없어요'};
        const e = E(side, slot); if (!e || ents.some(x => x.side === side && x.pi === inIdx) || st.used[side].has(inIdx)) return {ok: false, msg: '교체할 수 없는 선수예요'};
        const o = e.name; st.used[side].add(e.pi); SP.doSwap(cfg, e, inIdx, {cap: true}); e.atp = 1; if (slot === 0 && st.phase === 'aim') st.t = 0; placeTeams(); if (st.phase !== 'aim') runners.forEach(r => { const re = ents[r.ei]; re.out = false; }); return {ok: true, msg: `${SLK[slot]} ${o} → ${e.name}`}; },
      result() { if (!st.end) return null; const s = st.score; return {winner: s[0] > s[1] ? 0 : s[1] > s[0] ? 1 : -1, score: `${s[0]} : ${s[1]}`, text: st.walkoff ? '끝내기!' : st.inn > innN ? '연장 승부' : ''}; },
      dispose() {}
    };
  }
  function buildField(sc) {
    const tex = SP.canvasTex(1024, 1024, (g, w, h) => {
      const s = w / 120, P = (x, z) => [w / 2 + z * s, h - 140 - x * s * 1.0];
      g.fillStyle = '#3a9a5a'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 24; i++) { g.fillStyle = i % 2 ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.04)'; g.beginPath(); g.moveTo(...P(0, 0)); const a1 = (-45 + i * 3.75) * Math.PI / 180, a2 = a1 + 3.75 * Math.PI / 180; g.lineTo(...P(Math.cos(a1) * 70, Math.sin(a1) * 70)); g.lineTo(...P(Math.cos(a2) * 70, Math.sin(a2) * 70)); g.fill(); }
      // 내야 흙 (세포질 갈색) + 잔디 다이아몬드
      g.fillStyle = '#c8925a'; g.beginPath(); g.arc(...P(8, 0), 15.5 * s, 0, 6.3); g.fill();
      g.fillStyle = '#4aae66'; g.beginPath(); [[1.5, 0], [BX, BX - 1.6], [2 * BX - 1.8, 0], [BX, -BX + 1.6]].forEach((b, i) => g[i ? 'lineTo' : 'moveTo'](...P(b[0], b[1]))); g.fill();
      g.fillStyle = '#c8925a'; g.beginPath(); g.arc(...P(8.6, 0), 1.6 * s, 0, 6.3); g.fill(); g.beginPath(); g.arc(...P(0, 0), 2.4 * s, 0, 6.3); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 4; g.beginPath(); g.moveTo(...P(0, 0)); g.lineTo(...P(50, 50)); g.moveTo(...P(0, 0)); g.lineTo(...P(50, -50)); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2; g.strokeRect(P(0, -1.4)[0], P(0.9, 0)[1], 0.7 * s, 1.8 * s); g.strokeRect(P(0, 0.7)[0], P(0.9, 0)[1], 0.7 * s, 1.8 * s);
      // 경고 트랙
      g.strokeStyle = '#b07a4a'; g.lineWidth = 3 * s; g.beginPath(); for (let a = -45; a <= 45; a += 2) { const r = FENCE(a * Math.PI / 180) - 1.5; g[a === -45 ? 'moveTo' : 'lineTo'](...P(Math.cos(a * Math.PI / 180) * r, Math.sin(a * Math.PI / 180) * r)); } g.stroke();
    });
    const pl = SP.plane(120, 120, 0, tex), pg = new THREE.Group(); pg.add(pl); pg.rotation.y = -Math.PI / 2; pg.position.x = (1024 - 140 - 512) / (1024 / 120); sc.add(pg); // 캔버스 위쪽 = 외야(+x)
    const parts = [];
    // 베이스·홈·마운드
    [[BX, BX], [2 * BX, 0], [BX, -BX]].forEach(([x, z]) => parts.push([x, 0, z, 0.55, 0.12, 0.55, '#ffffff']));
    parts.push([0, 0, 0, 0.5, 0.05, 0.5, '#ffffff'], [8.6, 0, 0, 2.2, 0.12, 2.2, '#c8925a'], [8.6, 0.12, 0, 0.7, 0.05, 0.18, '#ffffff']);
    // 세포막 펜스 (인지질 이중층 무늬)
    for (let a = -45; a < 45; a += 3) { const r = FENCE(a * Math.PI / 180), ar = (a + 1.5) * Math.PI / 180, x = Math.cos(ar) * (r + 0.3), z = Math.sin(ar) * (r + 0.3), len = r * 3 * Math.PI / 180 + 0.2;
      parts.push({x, z, len, rot: ar}); }
    const fence = new THREE.Group();
    for (const p of parts) { if (Array.isArray(p)) continue; const m = SP.vox([[0, 0, 0, 0.5, 2.6, p.len, '#2a6a8a'], [0, 2.6, 0, 0.6, 0.3, p.len, '#ffd25e'], [-0.26, 0.6, 0, 0.04, 0.5, p.len * 0.9, '#7ad3ff'], [-0.26, 1.6, 0, 0.04, 0.5, p.len * 0.9, '#ff9ec4']]); m.position.set(p.x, 0, p.z); m.rotation.y = -p.rot; fence.add(m); }
    sc.add(fence); sc.add(SP.vox(parts.filter(Array.isArray)));
    // 더그아웃·백스톱
    sc.add(SP.vox([[-4.5, 0, 0, 0.4, 3.5, 12, '#2a3348'], [-4.5, 3.5, 0, 0.5, 0.2, 12.2, '#ffd25e'], [-3, 0, 13, 6, 1.4, 2, '#3a4a6a'], [-3, 0, -13, 6, 1.4, 2, '#3a4a6a']]));
    const stands = SP.stadium(70, 112, {out: 0x2f6a4a}); stands.position.x = 22; sc.add(stands);
  }
})();
