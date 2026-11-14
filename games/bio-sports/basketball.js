/* 종목 2: 바이오 농구 — 5 대 5 · 전후반 · 연장 · 2점/3점 · 24초 샷클락 · 아웃 오브 바운드 · 파울·자유투 · 리바운드 · 덩크/레이업/외곽슛 게이지 */
'use strict';
(function () {
  const L = 28, W = 15, HX = 12.6, RIM = 3.05, THREE_R = 6.75;
  const POS = ['PG', 'SG', 'SF', 'PF', 'C'];
  const WTS = {PG: {bal: 1, spd: 0.8}, SG: {bal: 0.8, pow: 0.6, spd: 0.4}, SF: {spd: 0.6, pow: 0.6, def: 0.4}, PF: {pow: 0.8, def: 0.8}, C: {def: 1, pow: 0.8, atp: 0.2}};
  // 공격 때 서는 자리 (공격 방향 +x 기준, 골대 = x 12.6)
  const SPOTS = [[5.6, 0], [8.4, -5.6], [8.4, 5.6], [11.0, -2.6], [11.6, 2.2]];
  const S = SP.SPORTS.basketball = {
    id: 'basketball', name: '바이오 농구', icon: '🏀', desc: '5 대 5 · 골지체 코트 · 3점 라인 · 24초 샷클락 · 자유투 · 리바운드', lineup: true, formLabel: '포지션',
    pitchBg: 'linear-gradient(90deg,#d8935a,#e6a46a)', pitchH: 300,
    options: [{key: 'half', label: '전·후반 시간 (경기 시간)', def: 5, choices: [[3, '3분'], [5, '5분 (정규)']]}],
    slots() { return POS.map((p, i) => ({label: p, w: WTS[p], x: 0.15 + [0.15, 0.4, 0.4, 0.62, 0.68][i] * 0.8, y: 0.5 + [0, -0.32, 0.32, -0.15, 0.15][i]})); },
    controls: '<kbd>WASD</kbd> 이동 · <kbd>J</kbd> 패스 · <kbd>K</kbd> 슛(꾹 눌러 초록 칸에서 놓기 · 골밑에서 뛰며 누르면 덩크/레이업) · <kbd>L</kbd> 스틸/블록 · <kbd>Q</kbd> 선수 전환 · <kbd>Tab</kbd> 현황·교체',
    touch: {c: '스틸<br>블록', a: '패스', b: '슛', t: '현황'},
    create
  };
  function create(cfg) {
    const TM = SP.teamMods(cfg), halfLen = (cfg.opts.half || 5) * 60, D = cfg.diff, sc = SP.scene;
    sc.background.set(0x2a2440);
    // 골지체 코트: 납작한 주머니(시스터나) 무늬 마루
    const tex = SP.canvasTex(1024, 548, (g, w, h) => {
      g.fillStyle = '#d99a5c'; g.fillRect(0, 0, w, h); for (let i = 0; i < 28; i++) { g.fillStyle = i % 2 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.04)'; g.fillRect(0, i * h / 28, w, h / 28); }
      g.globalAlpha = 0.18; g.strokeStyle = '#8a3a9a'; g.lineWidth = 10; for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(w / 2, h / 2, 60 + k * 26, 22 + k * 10, 0, Math.PI * 0.15, Math.PI * 0.85); g.stroke(); } g.globalAlpha = 1;
      const sx = w / L, sz = h / W; g.strokeStyle = '#fff'; g.lineWidth = 5; g.strokeRect(3, 3, w - 6, h - 6); g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke(); g.beginPath(); g.arc(w / 2, h / 2, 1.8 * sx, 0, 6.3); g.stroke();
      for (const s of [-1, 1]) { const hx = w / 2 + s * HX * sx; g.fillStyle = 'rgba(120,40,150,.35)'; g.fillRect(s > 0 ? w - 5.8 * sx : 0, h / 2 - 2.45 * sz, 5.8 * sx, 4.9 * sz); g.strokeRect(s > 0 ? w - 5.8 * sx : 0, h / 2 - 2.45 * sz, 5.8 * sx, 4.9 * sz);
        g.beginPath(); g.arc(hx, h / 2, THREE_R * sx, s > 0 ? Math.PI * 0.5 + 0.2 : -Math.PI * 0.5 + 0.2, s > 0 ? Math.PI * 1.5 - 0.2 : Math.PI * 0.5 - 0.2); g.stroke(); g.beginPath(); g.arc(s > 0 ? w - 5.8 * sx : 5.8 * sx, h / 2, 1.8 * sx, 0, 6.3); g.stroke(); }
    });
    sc.add(SP.plane(L, W, 0, tex)); sc.add(SP.stadium(L + 6, W + 8, {out: 0x3a3450}));
    const hoopM = [];
    for (const s of [-1, 1]) { const g = SP.vox([[s * 1.2, 0, 0, 0.3, 3.4, 0.3, '#555a66'], [s * 0.9, 3.0, 0, 0.8, 0.15, 0.2, '#555a66'], [s * 0.45, 2.85, 0, 0.08, 1.05, 1.8, '#f4f8ff'], [s * 0.42, 3.05, 0, 0.04, 0.45, 0.6, '#d33']]); g.position.x = s * HX; sc.add(g);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.03, 8, 20), new THREE.MeshLambertMaterial({color: 0xff6a2a})); rim.rotation.x = Math.PI / 2; rim.position.set(s * HX, RIM, 0); sc.add(rim);
      const net = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.15, 0.42, 12, 1, true), new THREE.MeshBasicMaterial({color: 0xffffff, wireframe: true})); net.position.set(s * HX, RIM - 0.22, 0); sc.add(net); hoopM.push(net); }
    const slots = S.slots();
    const ents = [0, 1].flatMap(sd => SP.makeEnts(cfg, sd, slots));
    ents.forEach(e => { e.fouls = 0; e.pts = 0; e.reb = 0; });
    const ballM = SP.vox([[0, -0.13, 0, 0.26, 0.26, 0.26, '#e86a2a'], [0, -0.01, 0.135, 0.27, 0.02, 0.02, '#3a1a0a'], [0, -0.13, 0.135, 0.02, 0.26, 0.02, '#3a1a0a']]); sc.add(ballM);
    const ball = {x: 0, y: 1, z: 0, owner: -1, fl: null, vx: 0, vy: 0, vz: 0, lastSide: 0, lock: 0};
    const st = {score: [0, 0], period: 1, clock: halfLen, shot: 24, off: 0, phase: 'jump', phaseT: 1.5, ctrl: [-1, -1], hold: [0, 0], switchT: [0, 0], ft: null,
      stats: [0, 1].map(() => ({reb: 0, fga: 0, fgm: 0, tpa: 0, tpm: 0, to: 0, fouls: 0, tf: 0, fta: 0, ftm: 0})), stealT: ents.map(() => 0), aiT: ents.map(() => Math.random())};
    const dir = sd => (sd === 0 ? 1 : -1) * (st.period === 2 ? -1 : 1);
    const idx = e => ents.indexOf(e);
    const EV = SP.makeEvents(fire); const ev = (t, d) => EV.emit(t, d);
    function fire(e) { const A = SP.audio;
      if (e.type === 'whistle') A.whistle(e.n || 1); if (e.type === 'bounce') A.bounce(); if (e.type === 'swish') { A.swish(); A.cheer(); SP.toast(e.text, e.sub || '', 1300); SP.burst(e.x, RIM, 0, ['#ffd25e', '#ff7eb6', '#fff'], 30, 0.8); }
      if (e.type === 'rim') A.rim(); if (e.type === 'buzzer') A.buzzer(); if (e.type === 'msg') SP.toast(e.text, e.sub || '', e.ms || 1300); }
    function setOffense(side, how) { // 공격권 넘기기: 자기 진영 끝에서 시작
      st.off = side; st.shot = 24; ball.fl = null; const d = dir(side), pg = ents.find(e => e.side === side && e.slot === 0) || ents.find(e => e.side === side);
      ents.forEach(e => { const sp = SPOTS[e.slot]; if (e.side === side) { e.x = d * (-4 + sp[0] * 0.3); e.z = sp[1] * 0.8; } else { e.x = d * (sp[0] * 0.5 + 2); e.z = sp[1] * 0.7; } });
      pg.x = -d * 9; pg.z = 0; ball.owner = idx(pg); ball.lastSide = side; if (cfg.sides[side] !== 'ai') st.ctrl[side] = ball.owner;
      st.phase = 'play'; if (how) ev('msg', {text: how, sub: SP.TEAMS[cfg.teams[side]].name + ' 공격', ms: 1100});
    }
    function jumpBall() { ents.forEach(e => { const sp = SPOTS[e.slot], d = dir(e.side); e.x = -d * (1 + sp[0] * 0.25); e.z = sp[1] * 0.6; }); Object.assign(ball, {x: 0, y: 4, z: 0, owner: -1, fl: null, vx: 0, vy: 2, vz: 0}); st.phase = 'jump'; st.phaseT = 1.2; }
    jumpBall(); ev('whistle', {n: 1});
    const hoopX = side => dir(side) * HX;
    function distHoop(e, side) { return Math.hypot(e.x - hoopX(side), e.z); }
    function contest(e) { let d = 99; for (const o of ents) if (o.side !== e.side) d = Math.min(d, Math.hypot(o.x - e.x, o.z - e.z)); return d; }
    function shoot(e, timing, kind) { // timing: 0~1 (1 = 완벽)
      const side = e.side, T = TM[side], dh = distHoop(e, side), three = dh > THREE_R && kind !== 'dunk', cd = contest(e);
      kind = kind || (dh < 1.6 ? 'dunk' : dh < 2.6 ? 'layup' : 'jump');
      let p = kind === 'dunk' ? 0.88 : kind === 'layup' ? 0.7 : three ? 0.36 : SP.clamp(0.58 - (dh - 2.6) * 0.03, 0.4, 0.58);
      p *= (0.55 + timing * 0.6) * (0.75 + (e.st.bal + e.st.pow) / 600) * (cd < 1.0 ? 0.72 : cd < 2.0 ? 0.88 : 1) * (0.7 + 0.3 * e.atp) * (st.period === 2 && T.late ? T.late : 1);
      if (kind === 'dunk' && e.st.pow < 70) kind = 'layup';
      const made = Math.random() < SP.clamp(p, 0.03, 0.97) + (Math.random() < (T.crit || 0) ? 0.25 : 0);
      st.stats[side].fga++; if (three) st.stats[side].tpa++;
      const foul = cd < 1.1 && Math.random() < 0.18;
      ball.owner = -1; const T0 = kind === 'dunk' ? 0.35 : 0.45 + dh * 0.05;
      ball.fl = {sx: ball.x, sy: 2.2, sz: ball.z, tx: hoopX(side), tz: 0, t: 0, T: T0, made, three, side, shooter: idx(e), kind, foul, h: kind === 'dunk' ? 0.5 : 1.5 + dh * 0.18};
      SP.pose(e.mesh, 'up', 450); e.y = kind === 'dunk' ? 1.0 : 0.45; e.jumpT = 0.45;
      ev('msg', {text: kind === 'dunk' ? '덩크!' : kind === 'layup' ? '레이업' : three ? '3점슛' : '점프슛', ms: 600});
      st.shot = 24; e.atp = Math.max(0.05, e.atp - 0.02);
    }
    function pass(e, wx, wz) {
      let best = null, bv = -1e9; const T = TM[e.side];
      for (const t of ents) { if (t.side !== e.side || t === e) continue; const dx = t.x - e.x, dz = t.z - e.z, d = Math.hypot(dx, dz); if (d < 1.5) continue;
        let v = -d * 0.2 + Math.min(contest(t), 4) * (T.vision || 1); if (wx || wz) v += (dx * wx + dz * wz) / d * 6; v += (8 - distHoop(t, e.side)) * 0.2;
        if (v > bv) { bv = v; best = t; } }
      if (!best) return;
      // 가로채기
      let steal = null; for (const o of ents) { if (o.side === e.side) continue; const dx = best.x - e.x, dz = best.z - e.z, d = Math.hypot(dx, dz) || 1, px = o.x - e.x, pz = o.z - e.z, tp = (px * dx + pz * dz) / (d * d);
        if (tp > 0.15 && tp < 0.85 && Math.hypot(e.x + dx * tp - o.x, e.z + dz * tp - o.z) < 0.55 && Math.random() < 0.15 + o.st.def / 600 - (T.pass ? 0.1 : 0)) { steal = o; break; } }
      const tgt = steal || best;
      ball.owner = -1; ball.fl = {sx: ball.x, sy: 1.2, sz: ball.z, tx: tgt.x, tz: tgt.z, t: 0, T: Math.hypot(tgt.x - ball.x, tgt.z - ball.z) / 16 + 0.08, pass: idx(tgt), steal: !!steal, h: 0.4};
      SP.pose(e.mesh, 'bump', 200);
    }
    function turnover(side, why) { st.stats[side].to++; ev('whistle', {n: 1}); setOffense(1 - side, why); }
    function personalFoul(off, vic, shooting) {
      off.fouls++; st.stats[off.side].fouls++; st.stats[off.side].tf++; ev('whistle', {n: 1});
      let txt = `${off.no} ${off.name} 파울 (${off.fouls}개)`;
      if (off.fouls >= 5) { txt += ' · 5반칙 퇴장'; autoSub(off); }
      ev('msg', {text: '파울', sub: txt, ms: 1300});
      if (st.stats[off.side].tf > 5) { startFT(vic, 2); return; } // 팀 파울 보너스
      setOffense(vic.side, null);
    }
    function autoSub(e) { const used = new Set(ents.filter(x => x.side === e.side).map(x => x.pi)); const ro = SP.roster(cfg.teams[e.side]).filter(p => !used.has(p.i) && !(st.fouledOut || new Set()).has(p.i)).sort((a, b) => b.ovr - a.ovr)[0]; st.fouledOut = st.fouledOut || new Set(); st.fouledOut.add(e.pi); if (ro) { SP.doSwap(cfg, e, ro.i); e.fouls = 0; e.pts = 0; e.reb = 0; } }
    function startFT(e, n) { st.phase = 'ft'; st.ft = {shooter: idx(e), n, done: 0, made: 0, t: 0, hold: 0}; ents.forEach(o => { if (o !== e) { const s = SPOTS[o.slot]; o.x = hoopX(e.side) - dir(e.side) * (1.5 + (o.slot % 3)); o.z = (o.slot % 2 ? -1 : 1) * (2 + o.slot * 0.3); } }); e.x = hoopX(e.side) - dir(e.side) * 4.6; e.z = 0; e.face = dir(e.side) > 0 ? Math.PI / 2 : -Math.PI / 2; ball.owner = idx(e); ball.fl = null; ev('msg', {text: `자유투 ${n}개`, sub: `${e.no} ${e.name}`, ms: 1300}); }
    function ftStep(dt, ins) {
      const F = st.ft, e = ents[F.shooter], inp = ins[e.side]; F.t += dt;
      if (F.wait) { F.wait -= dt; if (F.wait <= 0) { F.wait = 0; if (F.done >= F.n) { if (F.lastMade) setOffense(1 - e.side, null); else { st.phase = 'play'; ball.owner = -1; ballRebound(e.side); } } } return; }
      let release = false, timing = 0.6;
      if (inp) { if (inp.hb) F.hold += dt; else if (F.hold > 0.05) { release = true; timing = 1 - Math.min(1, Math.abs(F.hold - 0.8) / 0.5); } SP.gaugeVal = Math.min(1, F.hold / 0.9); }
      else if (F.t > 0.9) { release = true; timing = SP.clamp(0.35 + e.st.bal / 140 + Math.random() * 0.3, 0, 1); }
      if (release) { const made = Math.random() < SP.clamp(0.35 + timing * 0.45 + e.st.bal / 400, 0.1, 0.97); F.done++; F.hold = 0; F.t = 0; st.stats[e.side].fta++;
        if (made) { st.stats[e.side].ftm++; st.score[e.side]++; e.pts++; ev('swish', {text: '자유투 성공', x: hoopX(e.side)}); } else ev('rim');
        F.lastMade = made; F.wait = 0.9; }
    }
    function ballRebound(shotSide) { const hx = hoopX(shotSide); ball.fl = null; ball.owner = -1; ball.x = hx - dir(shotSide) * (0.6 + Math.random() * 1.6); ball.z = (Math.random() - .5) * 3; ball.y = 3.2; ball.vy = 2; ball.vx = -dir(shotSide) * 1.5; ball.vz = (Math.random() - .5) * 2; ball.lock = 0.35; ball.rebSide = shotSide; }
    function step(dt, ins, speed) {
      if (st.phase === 'end') return;
      if (st.phase === 'ft') { ftStep(dt, ins); moveBodies(dt); return; }
      if (st.phase === 'jump') { st.phaseT -= dt; ball.vy -= 6 * dt; ball.y += ball.vy * dt; if (st.phaseT <= 0) { const win = Math.random() < 0.5 + (ents[4].st.pow - ents[9].st.pow) / 200 ? 0 : 1; setOffense(win, '점프볼'); ev('whistle', {n: 1}); } return; }
      if (st.phase === 'dead') { st.phaseT -= dt; if (st.phaseT <= 0) setOffense(st.next, st.nextMsg); moveBodies(dt); return; }
      st.clock -= dt * speed; st.shot -= dt * speed;
      if (st.clock <= 0) { ev('buzzer'); endPeriod(); return; }
      if (st.shot <= 0 && ball.owner >= 0) { ev('buzzer'); turnover(st.off, '24초 샷클락 위반'); return; }
      for (let sd = 0; sd < 2; sd++) control(sd, ins[sd], dt);
      for (let i = 0; i < ents.length; i++) ai(i, dt, ins);
      ballPhys(dt); moveBodies(dt);
      SP.audio.crowd(0.3 + (st.shot < 5 ? 0.4 : 0) + (st.clock < 30 ? 0.3 : 0));
    }
    function endPeriod() {
      ev('whistle', {n: 2});
      if (st.period === 1) { st.period = 2; st.clock = halfLen; st.stats.forEach(s => s.tf = 0); ev('msg', {text: '후반전', ms: 1500}); setOffense(1, null); }
      else if (st.score[0] === st.score[1]) { st.period = 3; st.clock = 180; st.stats.forEach(s => s.tf = 0); ev('msg', {text: '연장전 3분', ms: 1600}); jumpBall(); }
      else st.phase = 'end';
    }
    function moveBodies(dt) { for (const e of ents) { if (e.jumpT > 0) { e.jumpT -= dt; if (e.jumpT <= 0) e.y = 0; } } }
    function control(side, inp, dt) {
      if (!inp) return; st.switchT[side] -= dt;
      const own = ball.owner >= 0 && ents[ball.owner].side === side ? ball.owner : -1;
      if (own >= 0) st.ctrl[side] = own;
      else if (st.switchT[side] <= 0 && (st.ctrl[side] < 0 || (ball.owner >= 0 && ents[ball.owner].side !== side && Math.random() < dt * 2))) { let b = null, bd = 1e9; for (const e of ents) if (e.side === side) { const d = Math.hypot(e.x - ball.x, e.z - ball.z); if (d < bd) { bd = d; b = e; } } st.ctrl[side] = idx(b); }
      if (inp.q && own < 0) { const cur = ents[st.ctrl[side]]; let b = null, bd = 1e9; for (const e of ents) if (e.side === side && e !== cur) { const d = Math.hypot(e.x - ball.x, e.z - ball.z); if (d < bd) { bd = d; b = e; } } st.ctrl[side] = idx(b); st.switchT[side] = 1.5; }
      const e = ents[st.ctrl[side]]; if (!e) return; const has = ball.owner === idx(e);
      const sp = SP.runSpeed(e, 6.8) * (has ? 0.92 : 1);
      e.vx = inp.mx * sp; e.vz = inp.my * sp; const mv = Math.hypot(inp.mx, inp.my) > 0.1; if (mv) e.face = Math.atan2(inp.mx, inp.my);
      SP.drainATP(e, mv, dt, TM[side]); e.x += e.vx * dt; e.z += e.vz * dt; clampE(e); e.spdNow = Math.hypot(e.vx, e.vz);
      if (has) {
        if (inp.a) pass(e, inp.mx, inp.my);
        const dh = distHoop(e, side);
        if (inp.hb) { if (dh < 2.4 && mv) { shoot(e, 0.9, dh < 1.7 ? 'dunk' : 'layup'); st.hold[side] = 0; } else { st.hold[side] += dt; SP.gaugeVal = Math.min(1, st.hold[side] / 0.9); } }
        else if (st.hold[side] > 0.05) { const h = st.hold[side], timing = h >= 0.72 && h <= 0.9 ? 1 : 1 - Math.min(1, Math.abs(h - 0.81) / 0.45); shoot(e, timing); st.hold[side] = 0; if (timing > 0.95) ev('msg', {text: '퍼펙트 릴리스!', ms: 700}); }
      } else { st.hold[side] = 0; if (inp.c) defend(e); }
    }
    function defend(e) { // 스틸 / 블록
      const i = idx(e); if (st.stealT[i] > 0) return; st.stealT[i] = 1.5;
      if (ball.fl && !ball.fl.pass && ball.fl.t < 0.25 && Math.hypot(ball.x - e.x, ball.z - e.z) < 1.6) { e.y = 0.9; e.jumpT = 0.4; SP.pose(e.mesh, 'up', 400); if (Math.random() < 0.25 + e.st.def / 300) { ev('msg', {text: '🖐 블록!', ms: 900}); SP.audio.spike(); st.stats[ball.fl.side].fga += 0; const sd = ball.fl.side; ball.fl = null; ballRebound(sd); ball.x = e.x; } return; }
      const ow = ball.owner >= 0 ? ents[ball.owner] : null; if (!ow || ow.side === e.side || Math.hypot(ow.x - e.x, ow.z - e.z) > 1.5) return;
      SP.pose(e.mesh, 'bump', 250);
      if (Math.random() < 0.12 + (e.st.def - ow.st.bal) / 250) { ball.owner = i; ball.lastSide = e.side; st.stats[ow.side].to++; st.off = e.side; st.shot = 24; ev('msg', {text: '스틸!', ms: 800}); if (cfg.sides[e.side] !== 'ai') st.ctrl[e.side] = i; }
      else if (Math.random() < 0.15) personalFoul(e, ow, false);
    }
    function clampE(e) { e.x = SP.clamp(e.x, -L / 2 + 0.3, L / 2 - 0.3); e.z = SP.clamp(e.z, -W / 2 + 0.3, W / 2 - 0.3); }
    function ai(i, dt, ins) {
      const e = ents[i], side = e.side; if (st.stealT[i] > 0) st.stealT[i] -= dt;
      if (ins[side] && st.ctrl[side] === i) return;
      const lvl = ins[side] ? 1 : D, d0 = dir(side), has = ball.owner === i, offense = st.off === side;
      let tx, tz;
      if (ball.owner < 0 && !ball.fl) { tx = ball.x; tz = ball.z; } // 루즈볼·리바운드
      else if (offense) {
        const sp = SPOTS[e.slot]; tx = d0 * sp[0]; tz = sp[1];
        if (has) {
          st.aiT[i] -= dt; const dh = distHoop(e, side), cd = contest(e);
          if (st.lastOwner !== i) { st.lastOwner = i; e.plan = Math.random() < (e.slot === 1 || e.slot === 2 ? 0.5 : e.slot === 0 ? 0.25 : 0.05) ? 'three' : 'drive'; st.aiT[i] = 0.35 + Math.random() * 0.3; }
          if (e.plan === 'three' && st.shot > 4) { if (dh > THREE_R + 0.3) { tx = e.x; tz = e.z; } else { tx = e.x - d0 * 1.2; tz = e.z * 1.1; } if (dh > THREE_R + 0.15 && st.aiT[i] <= 0 && cd > 1.3) { shoot(e, SP.clamp(0.5 + lvl * 0.16 + Math.random() * 0.3, 0, 1)); return; } if (cd < 1.0 && st.aiT[i] <= 0) e.plan = 'drive'; }
          else { tx = hoopX(side) - d0 * 1.0; tz = e.z * 0.7; }
          if (st.aiT[i] <= 0) { st.aiT[i] = 0.25 + Math.random() * 0.35;
            if (dh > THREE_R && dh < 7.8 && cd > 1.8 && Math.random() < (e.slot === 1 || e.slot === 2 ? 0.5 : 0.25)) { shoot(e, SP.clamp(0.45 + lvl * 0.18 + Math.random() * 0.35, 0, 1)); return; }
            const good = (dh < 2.2) || (cd > 2.4 && (dh < 5.5 || (dh > THREE_R && dh < 8.2))) || st.shot < 4;
            if (good && Math.random() < 0.45 + lvl * 0.15) shoot(e, SP.clamp(0.45 + lvl * 0.18 + Math.random() * 0.35, 0, 1), dh < 1.7 && e.st.pow > 70 ? 'dunk' : null);
            else if ((cd < 1.0 && Math.random() < 0.5) || Math.random() < 0.15) pass(e, 0, 0);
          }
        }
      } else { // 수비: 같은 번호 선수 막기 (골대 쪽에 서기)
        const man = ents.find(o => o.side !== side && o.slot === e.slot) || ents.find(o => o.side !== side); const hx = hoopX(1 - side);
        const k = man === (ball.owner >= 0 ? ents[ball.owner] : null) ? 0.8 : 0.65; tx = man.x + (hx - man.x) * (1 - k) * 0.6; tz = man.z * k;
        if (ball.owner >= 0 && ents[ball.owner] === man && Math.hypot(man.x - e.x, man.z - e.z) < 1.4 && Math.random() < dt * (0.15 + lvl * 0.15)) defend(e);
        if (ball.fl && !ball.fl.pass && Math.hypot(ball.x - e.x, ball.z - e.z) < 1.5 && Math.random() < 0.05 + lvl * 0.05) defend(e);
      }
      const dx = tx - e.x, dz = tz - e.z, dd = Math.hypot(dx, dz), sp = SP.runSpeed(e, 6.4) * (0.88 + lvl * 0.07) * (has ? 0.9 : 1);
      if (dd > 0.2) { e.vx = dx / dd * Math.min(sp, dd * 3); e.vz = dz / dd * Math.min(sp, dd * 3); e.face = Math.atan2(dx, dz); } else { e.vx *= 0.7; e.vz *= 0.7; }
      e.x += e.vx * dt; e.z += e.vz * dt; clampE(e); e.spdNow = Math.hypot(e.vx, e.vz); SP.drainATP(e, e.spdNow > 1, dt, TM[side]);
    }
    function ballPhys(dt) {
      if (ball.lock > 0) ball.lock -= dt;
      if (ball.owner >= 0) { const o = ents[ball.owner], b = Math.abs(Math.sin(performance.now() / 160)); ball.x = o.x + Math.sin(o.face) * 0.45; ball.z = o.z + Math.cos(o.face) * 0.45; ball.y = 0.2 + b * 0.8; if (b < 0.05 && Math.random() < 0.3) ev('bounce'); return; }
      if (ball.fl) { const F = ball.fl; F.t += dt; const k = Math.min(1, F.t / F.T);
        ball.x = F.sx + (F.tx - F.sx) * k; ball.z = F.sz + (F.tz - F.sz) * k; ball.y = F.sy + ((F.pass ? 1.2 : RIM) - F.sy) * k + Math.sin(k * Math.PI) * F.h;
        if (k >= 1) {
          if (F.pass != null) { const t = ents[F.pass]; ball.fl = null; ball.owner = F.pass; ball.lastSide = t.side; if (F.steal) { st.stats[1 - t.side].to++; st.off = t.side; st.shot = 24; ev('msg', {text: '패스 가로채기!', ms: 800}); } if (cfg.sides[t.side] !== 'ai') st.ctrl[t.side] = F.pass; return; }
          const sh = ents[F.shooter], pts = F.three ? 3 : 2;
          if (F.made) { st.score[F.side] += pts; sh.pts += pts; st.stats[F.side].fgm++; if (F.three) st.stats[F.side].tpm++; ev('swish', {text: `${pts}점!`, sub: `${sh.no} ${sh.name}`, x: F.tx}); hoopM[F.tx > 0 ? 1 : 0].scale.y = 1.6;
            if (F.foul) { startFT(sh, 1); ev('msg', {text: '앤드원!', ms: 900}); return; }
            st.phase = 'dead'; st.phaseT = 1.0; st.next = 1 - F.side; st.nextMsg = null; ball.fl = null; return; }
          ev('rim'); if (F.foul) { const df = ents.filter(o => o.side !== F.side).sort((a, b) => Math.hypot(a.x - sh.x, a.z - sh.z) - Math.hypot(b.x - sh.x, b.z - sh.z))[0]; df.fouls++; st.stats[df.side].fouls++; st.stats[df.side].tf++; ev('whistle'); startFT(sh, F.three ? 3 : 2); return; }
          ballRebound(F.side); }
        return; }
      // 루즈볼
      ball.vy -= 14 * dt; ball.x += ball.vx * dt; ball.y += ball.vy * dt; ball.z += ball.vz * dt; if (ball.y < 0.15) { ball.y = 0.15; ball.vy = Math.abs(ball.vy) > 1 ? -ball.vy * 0.55 : 0; ev('bounce'); } ball.vx *= 1 - dt; ball.vz *= 1 - dt;
      if (Math.abs(ball.x) > L / 2 || Math.abs(ball.z) > W / 2) { turnover(ball.lastSide, '아웃 오브 바운드'); return; }
      if (ball.lock <= 0 && ball.y < 2.6) { let b = null, bv = -1e9; for (const e of ents) { const d = Math.hypot(e.x - ball.x, e.z - ball.z); if (d > 1.1) continue; const v = -d * 3 + (e.st.def + e.st.pow) / 60 * (TM[e.side].vision || 1) + Math.random() * 1.2; if (v > bv) { bv = v; b = e; } }
        if (b) { ball.owner = idx(b); ball.lastSide = b.side; if (ball.rebSide != null) { b.reb++; st.stats[b.side].reb++; ball.rebSide = null; } if (st.off !== b.side) { st.off = b.side; } st.shot = 24; if (cfg.sides[b.side] !== 'ai') st.ctrl[b.side] = idx(b); } }
    }
    function view(dt) {
      const me = cfg.me;
      SP.viewEnts(ents, dt, e => cfg.sides[me] === 'local' && idx(e) === st.ctrl[me]);
      ballM.position.set(ball.x, ball.y, ball.z); ballM.rotation.x += dt * 6;
      hoopM.forEach(n => { n.scale.y += (1 - n.scale.y) * Math.min(1, dt * 4); });
      SP.camTo(SP.cam.mode === 'persp' ? {x: ball.x * 0.8, y: 0, z: 1.5, dist: 17, h: 12, yaw: 0} : {x: ball.x * 0.8, y: 0, z: 0, dist: 22, h: 12, yaw: 0});
      const holding = (st.phase === 'ft' && st.ft && ents[st.ft.shooter].side === me) || (ball.owner === st.ctrl[me] && st.hold[me] > 0.05);
      SP.gauge(cfg.sides[me] === 'local' && holding ? SP.gaugeVal || 0 : null, 0.85);
    }
    return {
      step, view,
      snap() { return {e: SP.snapEnts(ents), b: [ball.x, ball.y, ball.z].map(v => Math.round(v * 100) / 100), s: st.score, p: st.period, c: Math.round(st.clock), sh: Math.round(st.shot), ph: st.phase, ct: st.ctrl, ev: EV.recent(), st: st.stats, of: st.off, pp: ents.map(e => [e.pts, e.reb, e.fouls]), g: SP.gaugeVal || 0}; },
      apply(s) { SP.applyEnts(cfg, ents, s.e); [ball.x, ball.y, ball.z] = s.b; st.score = s.s; st.period = s.p; st.clock = s.c; st.shot = s.sh; st.phase = s.ph; st.ctrl = s.ct; st.stats = s.st; st.off = s.of; s.pp.forEach((a, i) => { [ents[i].pts, ents[i].reb, ents[i].fouls] = a; }); EV.ingest(s.ev); },
      hud() { const T = cfg.teams.map(i => SP.TEAMS[i]); return {score: {a: {name: T[0].name, c1: SP.kit(cfg, 0).c1, pts: st.score[0]}, b: {name: T[1].name, c1: SP.kit(cfg, 1).c1, pts: st.score[1]}, sub: (['', '전반', '후반', '연장'][st.period] || '') + ` · 샷클락 ${Math.max(0, Math.ceil(st.shot))}`, clock: SP.fmtTime(st.clock)}, info: st.phase === 'ft' && st.ft && ents[st.ft.shooter].side === cfg.me && cfg.sides[cfg.me] === 'local' ? '자유투: K를 꾹 눌렀다가 초록 선 근처에서 놓아요' : ''}; },
      minimap(g, w, h) { g.fillStyle = '#c8874a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(3, 3, w - 6, h - 6); g.beginPath(); g.moveTo(w / 2, 3); g.lineTo(w / 2, h - 3); g.stroke();
        const sx = (w - 6) / L, sz = (h - 6) / W; for (const s of [-1, 1]) { g.beginPath(); g.arc(3 + (s * HX + L / 2) * sx, h / 2, THREE_R * sx, 0, 6.3); g.stroke(); }
        for (const e of ents) { g.fillStyle = SP.kit(cfg, e.side).c1; g.beginPath(); g.arc(3 + (e.x + L / 2) * sx, 3 + (e.z + W / 2) * sz, idx(e) === st.ctrl[cfg.me] ? 7 : 5, 0, 6.3); g.fill(); }
        g.fillStyle = '#ff6a2a'; g.beginPath(); g.arc(3 + (ball.x + L / 2) * sx, 3 + (ball.z + W / 2) * sz, 4, 0, 6.3); g.fill(); },
      status() { const T = cfg.teams.map(i => SP.TEAMS[i]), [a, b] = st.stats; const pct = (m, n) => n ? Math.round(m / n * 100) + '%' : '-';
        const row = (l, x, y) => `<tr><td style="text-align:right"><b>${x}</b></td><td style="text-align:center;color:#c3d0ea">${l}</td><td><b>${y}</b></td></tr>`;
        const players = sd => ents.filter(e => e.side === sd).map(e => `${e.no} ${SP.esc(e.name)} <b>${e.pts}</b>점 · 리바 ${e.reb} · 파울 ${e.fouls}`).join('<br>');
        return `<table class="rt"><tr><th style="text-align:right">${SP.esc(T[0].name)}</th><th style="text-align:center">항목</th><th>${SP.esc(T[1].name)}</th></tr>${row('야투 (성공률)', `${a.fgm}/${a.fga} (${pct(a.fgm, a.fga)})`, `${b.fgm}/${b.fga} (${pct(b.fgm, b.fga)})`)}${row('3점슛 (성공률)', `${a.tpm}/${a.tpa} (${pct(a.tpm, a.tpa)})`, `${b.tpm}/${b.tpa} (${pct(b.tpm, b.tpa)})`)}${row('자유투', `${a.ftm}/${a.fta}`, `${b.ftm}/${b.fta}`)}${row('팀 리바운드', a.reb, b.reb)}${row('턴오버', a.to, b.to)}${row('파울 (이번 쿼터 팀파울)', `${a.fouls} (${a.tf})`, `${b.fouls} (${b.tf})`)}</table>
          <div class="wrap2" style="margin-top:8px"><div class="sub" style="font-size:13px">${players(0)}</div><div class="sub" style="font-size:13px">${players(1)}</div></div>`; },
      subInfo() { return {ok: true, text: '작전 타임 중 자유롭게 교체', why: ''}; },
      lineupState(side) { const r = SP.lineupStateOf(cfg, ents, side, st.fouledOut); r.on.forEach(o => { const e = ents.find(x => x.side === side && x.slot === o.slot); o.note = `${e.pts}점 · 파울 ${e.fouls}`; }); return r; },
      sub(side, slot, inIdx) { const e = ents.find(x => x.side === side && x.slot === slot); if (!e || ents.some(x => x.side === side && x.pi === inIdx) || (st.fouledOut && st.fouledOut.has(inIdx))) return {ok: false, msg: '교체할 수 없는 선수예요'}; const o = e.name; SP.doSwap(cfg, e, inIdx); e.fouls = 0; e.pts = 0; e.reb = 0; if (ball.owner === idx(e)) {} return {ok: true, msg: `${o} → ${e.name}`}; },
      result() { if (st.phase !== 'end') return null; const s = st.score; return {winner: s[0] > s[1] ? 0 : s[1] > s[0] ? 1 : -1, score: `${s[0]} : ${s[1]}`, text: st.period === 3 ? '연장전 끝' : ''}; },
      dispose() {}
    };
  }
})();
