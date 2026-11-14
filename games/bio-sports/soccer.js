/* 종목 1: 바이오 축구 — 11 대 11 · 전후반 · 연장 · 승부차기 · 오프사이드 · 옐로/레드카드 · 교체 2회 */
'use strict';
(function () {
  const L = 64, W = 42, GW = 6.2, GH = 2.3, BOX = 12;   // 경기장 길이·폭, 골문 폭·높이, 페널티 박스 깊이
  const FORMS = {
    '4-4-2': [[0.02, 0], [0.2, -0.75], [0.17, -0.27], [0.17, 0.27], [0.2, 0.75], [0.45, -0.75], [0.42, -0.25], [0.42, 0.25], [0.45, 0.75], [0.7, -0.25], [0.7, 0.25]],
    '4-3-3': [[0.02, 0], [0.2, -0.75], [0.17, -0.27], [0.17, 0.27], [0.2, 0.75], [0.4, -0.45], [0.38, 0], [0.4, 0.45], [0.7, -0.7], [0.74, 0], [0.7, 0.7]],
    '3-5-2': [[0.02, 0], [0.18, -0.5], [0.16, 0], [0.18, 0.5], [0.44, -0.85], [0.4, -0.35], [0.36, 0], [0.4, 0.35], [0.44, 0.85], [0.7, -0.25], [0.7, 0.25]]
  };
  const POSN = {
    '4-4-2': ['GK', 'LB', 'CB', 'CB', 'RB', 'LM', 'CM', 'CM', 'RM', 'ST', 'ST'],
    '4-3-3': ['GK', 'LB', 'CB', 'CB', 'RB', 'CM', 'DM', 'CM', 'LW', 'ST', 'RW'],
    '3-5-2': ['GK', 'CB', 'CB', 'CB', 'LWB', 'CM', 'DM', 'CM', 'RWB', 'ST', 'ST']
  };
  const WTS = {GK: {def: 1.2, bal: 0.8}, CB: {def: 1, pow: 0.4, atp: 0.3}, LB: {def: 0.7, spd: 0.6, atp: 0.4}, RB: {def: 0.7, spd: 0.6, atp: 0.4}, LWB: {spd: 0.8, atp: 0.6, def: 0.4}, RWB: {spd: 0.8, atp: 0.6, def: 0.4},
    DM: {def: 0.8, atp: 0.6, bal: 0.4}, CM: {bal: 0.9, atp: 0.6, spd: 0.3}, LM: {spd: 0.8, bal: 0.6}, RM: {spd: 0.8, bal: 0.6}, LW: {spd: 1, pow: 0.4}, RW: {spd: 1, pow: 0.4}, ST: {pow: 1, spd: 0.5, bal: 0.3}};
  const S = SP.SPORTS.soccer = {
    id: 'soccer', name: '바이오 축구', icon: '⚽', desc: '11 대 11 · 엽록체 틸라코이드 잔디 · 오프사이드·카드·교체 2회 · 연장·승부차기', lineup: true,
    formLabel: '포메이션', pitchBg: 'repeating-linear-gradient(90deg,#2f8a4a 0 40px,#38994f 40px 80px)', pitchH: 340,
    options: [{key: 'form', label: '포메이션', def: '4-4-2', choices: [['4-4-2', '4-4-2'], ['4-3-3', '4-3-3'], ['3-5-2', '3-5-2']], relineup: true},
      {key: 'half', label: '전·후반 시간 (경기 시간)', def: 7, choices: [[3, '3분'], [5, '5분'], [7, '7분 (정규)']]}],
    slots(o) { const f = (o && o.form) || '4-4-2'; return FORMS[f].map((p, i) => ({label: POSN[f][i], w: WTS[POSN[f][i]], x: 0.08 + p[0] * 1.1, y: 0.5 + p[1] * 0.42})).map(s => ({label: s.label, w: s.w, x: s.x, y: s.y})); },
    controls: '<kbd>WASD</kbd> 이동 · <kbd>J</kbd> 패스 · <kbd>K</kbd> 슛(꾹 눌러 힘) · <kbd>L</kbd> 슬라이딩 태클 · <kbd>Q</kbd> 선수 전환 · <kbd>Tab</kbd> 경기 현황·교체 · <kbd>C</kbd> 시점',
    touch: {c: '태클<br>(Q전환)', a: '패스', b: '슛', t: '현황'},
    create
  };
  // 슬롯 좌표를 가로 경기장 비율로 바꿈 (라인업 화면용)
  S.slots = function (o) { const f = (o && o.form) || '4-4-2'; return FORMS[f].map((p, i) => ({label: POSN[f][i], w: WTS[POSN[f][i]], x: 0.06 + p[0] * 1.15, y: 0.5 + p[1] * 0.42})); };

  function create(cfg) {
    const TM = SP.teamMods(cfg), form = cfg.opts.form || '4-4-2', halfLen = (cfg.opts.half || 7) * 60, D = cfg.diff;
    const sc = SP.scene; sc.background.set(0x7cc6e0);
    // 경기장: 엽록체 틸라코이드 잔디 (줄무늬 = 틸라코이드 원반)
    const tex = SP.canvasTex(1024, 672, (g, w, h) => {
      for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#3a9a4e' : '#34904a'; g.fillRect(i * w / 16, 0, w / 16 + 1, h); }
      g.globalAlpha = 0.12; g.fillStyle = '#9cff8a'; for (let k = 0; k < 90; k++) { const x = Math.random() * w, y = Math.random() * h; g.beginPath(); g.ellipse(x, y, 14, 6, 0, 0, 6.3); g.fill(); } g.globalAlpha = 1;
      g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 5; const sx = w / L, sz = h / W;
      g.strokeRect(3, 3, w - 6, h - 6); g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke(); g.beginPath(); g.arc(w / 2, h / 2, 6 * sx, 0, 6.3); g.stroke();
      for (const s of [0, 1]) { const x0 = s ? w - BOX * sx : 0; g.strokeRect(x0, h / 2 - 10 * sz, BOX * sx, 20 * sz); g.strokeRect(s ? w - 4.5 * sx : 0, h / 2 - 5 * sz, 4.5 * sx, 10 * sz); g.beginPath(); g.arc(s ? w - 8 * sx : 8 * sx, h / 2, 2, 0, 6.3); g.fill(); }
    });
    const field = SP.plane(L, W, 0, tex); sc.add(field);
    sc.add(SP.stadium(L, W, {out: 0x4f8f5a}));
    for (const s of [-1, 1]) { // 골대
      const gx = s * L / 2, post = '#ffffff', P = [[0, 0, -GW / 2, 0.18, GH, 0.18, post], [0, 0, GW / 2, 0.18, GH, 0.18, post], [0, GH, 0, 0.18, 0.18, GW + 0.18, post], [s * 1.2, 0, 0, 0.06, GH * 0.9, GW, '#d8e8f0'], [s * 0.6, GH, 0, 1.2, 0.05, GW, '#d8e8f0']];
      const g = SP.vox(P); g.position.x = gx; sc.add(g);
      for (const z of [-W / 2, W / 2]) { const f = SP.vox([[0, 0, 0, 0.08, 1.2, 0.08, '#ffffff'], [0, 1.0, 0.18, 0.04, 0.3, 0.36, '#ffd25e']]); f.position.set(gx, 0, z); sc.add(f); }
    }
    // 부심 깃발
    const flagger = SP.vox([[0, 0, 0, 0.4, 0.9, 0.3, '#222'], [0, 0.9, 0, 0.36, 0.4, 0.3, '#ffd8b4'], [0.3, 0.9, 0, 0.06, 0.9, 0.06, '#ddd'], [0.5, 1.5, 0, 0.4, 0.3, 0.04, '#ffd25e']]);
    flagger.position.set(0, 0, W / 2 + 1.2); sc.add(flagger);
    // 선수
    const slots = S.slots({form});
    const ents = [0, 1].flatMap(sd => SP.makeEnts(cfg, sd, slots, (k) => k === 0 ? {gk: sd ? '#ffe066' : '#ff9f43'} : {}));
    const ballM = SP.vox([[0, -0.2, 0, 0.4, 0.4, 0.4, '#ffffff'], [0, -0.06, 0.205, 0.14, 0.14, 0.02, '#2f8a4a'], [0.205, -0.06, 0, 0.02, 0.14, 0.14, '#2f8a4a'], [-0.205, -0.06, 0, 0.02, 0.14, 0.14, '#2f8a4a'], [0, -0.06, -0.205, 0.14, 0.14, 0.02, '#2f8a4a']]);
    sc.add(ballM);
    const ball = {x: 0, y: 0.2, z: 0, vx: 0, vy: 0, vz: 0, owner: -1, last: -1, lastSide: 0, lock: 0};
    const st = {score: [0, 0], period: 1, clock: halfLen, phase: 'kick', phaseT: 1.5, kickSide: 0, dirFlip: false, ctrl: [-1, -1], switchT: [0, 0],
      stats: [0, 1].map(() => ({shots: 0, onT: 0, off: 0, y: 0, r: 0, fouls: 0, pass: 0, poss: 0, subs: 2})), offPend: null, msg: '', msgT: 0,
      pk: null, holdT: [0, 0], usedOut: [new Set(), new Set()], restart: null, tackleT: ents.map(() => 0), aiT: ents.map(() => Math.random()), slide: ents.map(() => 0)};
    // 공격 방향: 전반 side0 → +x, 후반 반대
    const dir = sd => (sd === 0 ? 1 : -1) * (st.period === 2 || st.period === 4 ? -1 : 1);
    const EV = SP.makeEvents(e => fire(e)); const ev = (type, data) => EV.emit(type, data);
    function fire(e) { // 소리·연출 (호스트·게스트 공통)
      const A = SP.audio;
      if (e.type === 'whistle') A.whistle(e.n || 1); if (e.type === 'kick') A.kick(e.p); if (e.type === 'goal') { A.cheer(); A.whistle(1); SP.toast('⚽ GOAL!', e.text, 2200, true); SP.burst(e.x, 1, e.z, ['#ffd25e', '#ffffff', e.c], 60, 1.2); }
      if (e.type === 'card') { A.card(); SP.toast(e.red ? '🟥 레드카드!' : '🟨 옐로카드', e.text, 1800); } if (e.type === 'offside') { A.flag(); A.whistle(1); SP.toast('🚩 오프사이드', e.text, 1600); flagT = 1.6; }
      if (e.type === 'msg') SP.toast(e.text, e.sub || '', e.ms || 1500);
    }
    let flagT = 0;
    function kickSpot(e) { const f = FORMS[form][e.slot], d = dir(e.side); return [-d * (L / 2) + d * f[0] * L * 0.48, f[1] * W * 0.4]; }
    function celebrate(dt) { // 골 세리머니: 득점자는 코너로, 동료는 모이고, 상대는 제자리로
      const sc = 1 - st.kickSide, sh = ents[ball.last], cx = dir(sc) * (L / 2 - 2), cz = sh && sh.z > 0 ? W / 2 - 2 : -W / 2 + 2;
      ents.forEach(e => { if (e.out) return; if (e.side === sc) { if (e === sh) SP.walkTo(e, cx, cz, dt, SP.runSpeed(e, 7.5)); else if (e.slot && Math.hypot(e.x - cx, e.z - cz) < 30) SP.walkTo(e, cx - dir(sc) * (1 + (e.slot % 3)), cz - Math.sign(cz) * (e.slot % 4) * 0.9, dt, SP.runSpeed(e, 6.5)); else { const k = kickSpot(e); SP.walkTo(e, k[0], k[1], dt, SP.runSpeed(e, 3.5)); } }
        else { const k = kickSpot(e); SP.walkTo(e, k[0], k[1], dt, SP.runSpeed(e, 3.2)); } });
    }
    function restartMove(dt) { // 세트피스 준비: 키커는 공으로, 나머지는 자리 잡기
      const R = st.restart, bx = R.x, bz = R.z;
      ents.forEach(e => { if (e.out) return; const f = FORMS[form][e.slot], d = dir(e.side); let tx, tz;
        if (e.slot === 0) { tx = -d * L / 2 + d * 1.2; tz = SP.clamp(bz * 0.3, -2.5, 2.5); }
        else { tx = -d * L / 2 + d * f[0] * L * 0.8 + (bx - (-d * L / 2)) * 0.22; tz = f[1] * W * 0.4 + (bz - f[1] * W * 0.4) * 0.25; }
        if (e.side !== R.side && Math.hypot(tx - bx, tz - bz) < 6.5) { const a = Math.atan2(tz - bz, tx - bx); tx = bx + Math.cos(a) * 6.5; tz = bz + Math.sin(a) * 6.5; }
        SP.walkTo(e, SP.clamp(tx, -L / 2 + 0.5, L / 2 - 0.5), SP.clamp(tz, -W / 2 + 0.5, W / 2 - 0.5), dt, SP.runSpeed(e, 5.5), bx, bz); });
      const tk = R.type === 'goalkick' ? ents.find(e => e.side === R.side && e.slot === 0 && !e.out) : closest(R.side, bx, bz, true); if (tk) SP.walkTo(tk, bx - dir(R.side) * 0.5, bz, dt, SP.runSpeed(tk, 7), bx, bz);
    }
    function placeKickoff(kickSide) {
      ents.forEach(e => { if (e.out) return; const f = FORMS[form][e.slot], d = dir(e.side); e.x = -d * (L / 2) + d * f[0] * L * 0.48; e.z = f[1] * W * 0.4; e.vx = e.vz = 0; e.face = d > 0 ? Math.PI / 2 : -Math.PI / 2; });
      Object.assign(ball, {x: 0, y: 0.2, z: 0, vx: 0, vy: 0, vz: 0, owner: -1, lock: 0});
      const k = closest(kickSide, 0, 0, true); if (k) { k.x = -dir(kickSide) * 0.6; k.z = 0; }
      st.phase = 'kick'; st.phaseT = 1.6; st.kickSide = kickSide; st.offPend = null;
    }
    function closest(side, x, z, field) { let b = null, bd = 1e9; for (const e of ents) { if (e.side !== side || e.out || (field && e.slot === 0)) continue; const d = Math.hypot(e.x - x, e.z - z); if (d < bd) { bd = d; b = e; } } return b; }
    const idxOf = e => ents.indexOf(e);
    function kick(e, tx, tz, speed, loft, kind) {
      const dx = tx - ball.x, dz = tz - ball.z, d = Math.hypot(dx, dz) || 1;
      ball.vx = dx / d * speed; ball.vz = dz / d * speed; ball.vy = loft; ball.y = Math.max(ball.y, 0.25);
      ball.owner = -1; ball.last = idxOf(e); ball.lastSide = e.side; ball.lock = 0.25;
      SP.pose(e.mesh, 'kick', 250); ev('kick', {p: speed / 20});
      e.atp = Math.max(0.05, e.atp - 0.01);
      if (kind === 'pass') { st.stats[e.side].pass++; // 오프사이드 판정 준비: 패스 순간 위치
        const d0 = dir(e.side), opp = ents.filter(o => o.side !== e.side && !o.out).map(o => o.x * d0).sort((a, b) => b - a), second = opp[1] != null ? opp[1] : 0;
        st.offPend = {side: e.side, set: ents.filter(t => t.side === e.side && t !== e && !t.out && t.x * d0 > 0 && t.x * d0 > second + 0.3 && t.x * d0 > ball.x * d0 + 0.3).map(idxOf)}; }
      else st.offPend = null;
    }
    function shoot(e, power, aimZ) {
      const d0 = dir(e.side), gx = d0 * L / 2, T = TM[e.side];
      const acc = (1 - e.st.bal / 140) * (0.6 + power) * 9.0 * (e.atp < 0.4 ? 1.4 : 1), crit = Math.random() < (T.crit || 0.04);
      const tz = SP.clamp(aimZ, -GW / 2 + 0.4, GW / 2 - 0.4) + (crit ? 0 : (Math.random() - 0.5) * acc);
      const sp = (14 + power * 14) * (0.85 + e.st.pow / 400) * (T.shot || 1) * (crit ? 1.15 : 1);
      kick(e, gx, tz, sp, 2 + power * 5 + (Math.random() - 0.5) * 2, 'shot');
      st.stats[e.side].shots++; if (Math.abs(tz) < GW / 2) st.stats[e.side].onT++;
      if (crit) ev('msg', {text: '💥 돌연변이 슈팅!', sub: TM[e.side].trait, ms: 1000});
    }
    function passTarget(e, wantX, wantZ) {
      const d0 = dir(e.side), T = TM[e.side]; let best = null, bv = -1e9;
      for (const t of ents) { if (t.side !== e.side || t === e || t.out) continue;
        const dx = t.x - e.x, dz = t.z - e.z, d = Math.hypot(dx, dz); if (d < 3 || d > 30) continue;
        let v = dx * d0 * 0.6 - d * 0.15; if (wantX || wantZ) { const al = (dx * wantX + dz * wantZ) / d; v += al * 12; }
        let press = 99; for (const o of ents) if (o.side !== e.side && !o.out) press = Math.min(press, Math.hypot(o.x - t.x, o.z - t.z)); v += Math.min(press, 6) * (T.vision || 1);
        // 패스 길 위의 상대
        for (const o of ents) { if (o.side === e.side || o.out) continue; const px = o.x - e.x, pz = o.z - e.z, tproj = (px * dx + pz * dz) / (d * d); if (tproj > 0.1 && tproj < 0.9) { const qx = e.x + dx * tproj - o.x, qz = e.z + dz * tproj - o.z; if (Math.hypot(qx, qz) < 1.4) v -= 8; } }
        if (v > bv) { bv = v; best = t; } }
      return best;
    }
    function doPass(e, wx, wz) { const t = passTarget(e, wx, wz); if (!t) return false; const T = TM[e.side], d = Math.hypot(t.x - e.x, t.z - e.z); const lead = 0.35 + d / 30;
      const err = (1 - e.st.bal / 130) * 1.8 / (T.pass || 1); const tx = t.x + t.vx * lead + (Math.random() - .5) * err, tz = t.z + t.vz * lead + (Math.random() - .5) * err;
      kick(e, tx, tz, SP.clamp(8 + d * 0.55, 9, 22), d > 18 ? 4 : 0.6, 'pass'); return true; }
    function foul(off, vic, last) {
      st.stats[off.side].fouls++; ev('whistle', {n: 1});
      let card = 0; const r = Math.random(); if (last && r < 0.5) card = 2; else if (r < 0.3) card = 1;
      if (card === 1) { off.cards++; st.stats[off.side].y++; if (off.cards >= 2) card = 2; ev('card', {red: card === 2, text: `${off.no} ${off.name}${card === 2 ? ' (경고 2회 퇴장)' : ''}`}); }
      else if (card === 2) ev('card', {red: true, text: `${off.no} ${off.name} (결정적 반칙)`});
      if (card === 2) { off.out = true; st.stats[off.side].r++; off.x = 999; if (st.ctrl[off.side] === idxOf(off)) st.ctrl[off.side] = -1; }
      setRestart('free', vic.side, ball.x, ball.z, '프리킥');
    }
    function setRestart(type, side, x, z, label) { st.phase = 'restart'; st.phaseT = 1.7; st.restart = {type, side, x: SP.clamp(x, -L / 2 + 0.5, L / 2 - 0.5), z: SP.clamp(z, -W / 2 + 0.3, W / 2 - 0.3)}; Object.assign(ball, {vx: 0, vy: 0, vz: 0, owner: -1}); st.offPend = null; if (label) ev('msg', {text: label, sub: SP.TEAMS[cfg.teams[side]].name, ms: 1000}); }
    function doRestart() {
      const R = st.restart; Object.assign(ball, {x: R.x, y: 0.2, z: R.z, vx: 0, vy: 0, vz: 0});
      let taker = R.type === 'goalkick' ? ents.find(e => e.side === R.side && e.slot === 0 && !e.out) : closest(R.side, R.x, R.z, true);
      if (!taker) taker = closest(R.side, R.x, R.z, false);
      taker.x = R.x - dir(R.side) * 0.5; taker.z = R.z; ball.owner = idxOf(taker); ball.last = ball.owner; ball.lastSide = R.side;
      // 상대 선수는 공에서 떨어지기
      ents.forEach(e => { if (e.side !== R.side && !e.out) { const d = Math.hypot(e.x - R.x, e.z - R.z); if (d < 6) { e.x = R.x + (e.x - R.x) / (d || 1) * 6; e.z = R.z + (e.z - R.z) / (d || 1) * 6; } } });
      st.phase = 'play'; st.restart = null; st.holdT[R.side] = 0.6;
      if (st.ctrl[R.side] >= 0 || cfg.sides[R.side] !== 'ai') st.ctrl[R.side] = idxOf(taker);
    }
    placeKickoff(0); ev('whistle', {n: 1});

    /* ---------- 승부차기 ---------- */
    function startPK() { st.phase = 'pk'; st.pk = {n: [0, 0], goals: [0, 0], turn: 0, stage: 'aim', t: 0, aim: 0, dive: 0, res: ''}; ev('whistle', {n: 2}); ev('msg', {text: '승부차기!', sub: '방향을 정하고 K로 차요 · 골키퍼일 땐 방향을 정하고 K로 몸을 날려요', ms: 2500}); pkSetup(); }
    function pkSetup() { const P = st.pk, sh = P.turn, gx = L / 2; ents.forEach(e => { e.x = 999; });
      const shooter = ents.filter(e => e.side === sh && !e.out && e.slot !== 0).sort((a, b) => b.st.pow - a.st.pow)[P.n[sh] % 10], gk = ents.find(e => e.side !== sh && e.slot === 0 && !e.out) || ents.find(e => e.side !== sh && !e.out);
      shooter.x = gx - 11.5; shooter.z = 0; shooter.face = Math.PI / 2; gk.x = gx - 0.4; gk.z = 0; gk.face = -Math.PI / 2;
      P.sh = idxOf(shooter); P.gk = idxOf(gk); Object.assign(ball, {x: gx - 11, y: 0.2, z: 0, vx: 0, vy: 0, vz: 0, owner: -1}); P.stage = 'aim'; P.t = 0; P.aim = 0; P.dive = 0; P.chosen = false; P.gkChosen = false; }
    function pkStep(dt, ins) {
      const P = st.pk, sh = P.turn, sIn = ins[sh], gIn = ins[1 - sh];
      P.t += dt;
      if (P.stage === 'aim') {
        if (sIn) { P.aim = SP.clamp(sIn.my, -1, 1); if (sIn.b) P.chosen = true; } else if (P.t > 1.2) { P.aim = [-1, 0, 1][SP.ri(3)] * (0.6 + Math.random() * 0.4); P.chosen = true; }
        if (gIn) { P.dive = Math.round(SP.clamp(gIn.my, -1, 1)); if (gIn.b) P.gkChosen = true; } else P.dive = [-1, 0, 1][SP.ri(3)];
        if (P.chosen && (P.gkChosen || !gIn || P.t > 4)) { P.stage = 'fly'; P.t = 0; const s = ents[P.sh]; const tz = P.aim * (GW / 2 - 0.5);
          const miss = Math.random() < 0.08 + (1 - s.st.bal / 100) * 0.12; kick(s, L / 2, tz + (miss ? (tz >= 0 ? 1.6 : -1.6) : 0), 22, 1.2, 'shot'); P.tz = tz; P.miss = miss; }
      } else if (P.stage === 'fly') {
        const gk = ents[P.gk]; gk.z += (P.dive * 2.4 - gk.z) * Math.min(1, dt * 8);
        if (P.t > 0.55) { const saved = !P.miss && Math.round(P.tz / (GW / 2 - 0.5)) === P.dive && Math.random() < 0.55 + gk.st.def / 300;
          const goal = !P.miss && !saved; if (goal) { P.goals[sh]++; ev('goal', {text: '승부차기 성공', x: L / 2, z: P.tz, c: SP.TEAMS[cfg.teams[sh]].c1}); } else ev('msg', {text: P.miss ? '빗나감!' : '선방!', ms: 1000});
          P.n[sh]++; P.stage = 'wait'; P.t = 0; }
      } else if (P.stage === 'wait' && P.t > 1.6) {
        const [a, b] = P.n, [ga, gb] = P.goals;
        const left = n => Math.max(0, 5 - n);
        let done = false; if (a <= 5 && b <= 5) { if (ga > gb + left(b) || gb > ga + left(a)) done = true; if (a === 5 && b === 5 && ga !== gb) done = true; } else if (a === b && ga !== gb) done = true;
        if (done) { st.phase = 'end'; st.pkWinner = ga > gb ? 0 : 1; ev('whistle', {n: 3}); return; }
        P.turn = 1 - P.turn; pkSetup();
      }
      // 공 움직임
      ball.x += ball.vx * dt; ball.z += ball.vz * dt; ball.vy -= 18 * dt; ball.y = Math.max(0.2, ball.y + ball.vy * dt); if (ball.x > L / 2 + 1) { ball.vx = 0; ball.vz = 0; }
    }

    /* ---------- 경기 진행 (호스트) ---------- */
    function step(dt, ins, speed) {
      if (st.msgT > 0) st.msgT -= dt;
      if (st.phase === 'end') return;
      if (st.phase === 'pk') { pkStep(dt, ins); return; }
      if (st.phase === 'goal') { st.phaseT -= dt; moveFree(dt); celebrate(dt); if (st.phaseT <= 0) { st.phase = 'reform'; st.phaseT = 3.0; } return; }
      if (st.phase === 'reform') { st.phaseT -= dt; let all = true; ents.forEach(e => { if (e.out) return; const k = kickSpot(e); if (!SP.walkTo(e, k[0], k[1], dt, SP.runSpeed(e, 6.0), 0, 0)) all = false; }); if (all || st.phaseT <= 0) placeKickoff(st.kickSide); return; }
      if (st.phase === 'restart') { st.phaseT -= dt; restartMove(dt); if (st.phaseT <= 0) doRestart(); return; }
      if (st.phase === 'kick') ents.forEach(e => { if (!e.out) { e.spdNow = 0; e.face = Math.atan2(ball.x - e.x, ball.z - e.z); } });
      if (st.phase === 'kick') { st.phaseT -= dt; if (st.phaseT <= 0) { st.phase = 'play'; const k = closest(st.kickSide, 0, 0, true); ball.owner = idxOf(k); ball.lastSide = st.kickSide; if (cfg.sides[st.kickSide] !== 'ai') st.ctrl[st.kickSide] = ball.owner; ev('whistle', {n: 1}); } return; }
      // 시계
      st.clock -= dt * speed;
      if (ball.owner >= 0) st.stats[ents[ball.owner].side].poss += dt;
      if (st.clock <= 0) { endPeriod(); return; }
      for (let side = 0; side < 2; side++) controlSide(side, ins[side], dt);
      for (let i = 0; i < ents.length; i++) aiEnt(i, dt, ins);
      physics(dt);
      SP.audio.crowd(0.25 + Math.max(0, 1 - Math.abs(Math.abs(ball.x) - L / 2) / 18) * 0.6);
    }
    function endPeriod() {
      ev('whistle', {n: st.period >= 2 ? 3 : 2});
      const tie = st.score[0] === st.score[1];
      if (st.period === 1) { st.period = 2; st.clock = halfLen; ev('msg', {text: '후반전', sub: '진영을 바꿔요', ms: 1600}); placeKickoff(1); }
      else if (st.period === 2) { if (tie) { st.period = 3; st.clock = 180; ev('msg', {text: '연장전 3분', ms: 1800}); placeKickoff(0); } else st.phase = 'end'; }
      else if (st.period === 3) { if (tie) startPK(); else st.phase = 'end'; }
    }
    function controlSide(side, inp, dt) {
      if (!inp) return; // AI
      const T = TM[side];
      // 조작 선수 고르기: 공 가진 우리 선수 → 아니면 공과 가장 가까운 선수 (수동 전환은 잠시 유지)
      st.switchT[side] -= dt;
      const own = ball.owner >= 0 && ents[ball.owner].side === side ? ball.owner : -1;
      if (own >= 0) st.ctrl[side] = own;
      else if (st.switchT[side] <= 0 && (st.ctrl[side] < 0 || ents[st.ctrl[side]].out || ball.owner < 0 || ents[ball.owner].side !== side)) { const c = closest(side, ball.x + ball.vx * 0.3, ball.z + ball.vz * 0.3, false); if (c && (c.slot !== 0 || Math.abs(ball.x - c.x) < 8)) st.ctrl[side] = idxOf(c); }
      if (inp.q) { const cur = ents[st.ctrl[side]]; let b = null, bd = 1e9; for (const e of ents) { if (e.side !== side || e.out || e === cur || e.slot === 0) continue; const d = Math.hypot(e.x - ball.x, e.z - ball.z); if (d < bd) { bd = d; b = e; } } if (b) { st.ctrl[side] = idxOf(b); st.switchT[side] = 1.2; } }
      const e = ents[st.ctrl[side]]; if (!e || e.out) return;
      if (st.slide[st.ctrl[side]] > 0) return;
      const sp = SP.runSpeed(e, 7.4) * (ball.owner === idxOf(e) ? 0.9 : 1) * (inp.hb && ball.owner !== idxOf(e) ? 1.18 : 1);
      e.vx = inp.mx * sp; e.vz = inp.my * sp; const mv = Math.hypot(inp.mx, inp.my) > 0.1;
      if (mv) e.face = Math.atan2(inp.mx, inp.my);
      SP.drainATP(e, mv, dt, T, inp.hb ? 1.6 : 1);
      const has = ball.owner === idxOf(e);
      if (has) {
        if (inp.a) { if (!doPass(e, inp.mx, inp.my)) { const d0 = dir(side); kick(e, e.x + d0 * 8, e.z, 12, 0.5, 'pass'); } }
        if (inp.hb) { st.holdT[side] += dt; SP.gaugeVal = Math.min(1, st.holdT[side] / 1.0); }
        else if (st.holdT[side] > 0.04 && st.holdT[side] < 5) { shoot(e, Math.min(1, st.holdT[side] / 1.0), inp.my * 3 + e.z * 0.15); st.holdT[side] = 0; SP.gaugeVal = 0; }
        else st.holdT[side] = 0;
      } else { st.holdT[side] = 0; SP.gaugeVal = 0;
        if (inp.c) slideTackle(e);
        if (inp.a && ball.owner < 0) {} // 빈 공: 가까이 가면 자동으로 잡음
      }
    }
    function slideTackle(e) {
      const i = idxOf(e); if (st.tackleT[i] > 0) return; st.tackleT[i] = 1.2; st.slide[i] = 0.4;
      const sp = 11; e.vx = Math.sin(e.face) * sp; e.vz = Math.cos(e.face) * sp; e.mesh.rotation.x = 0; SP.pose(e.mesh, 'kick', 400);
      e.atp = Math.max(0.05, e.atp - 0.03);
      const ow = ball.owner >= 0 ? ents[ball.owner] : null;
      if (!ow || ow.side === e.side) { if (!ow && Math.hypot(ball.x - e.x, ball.z - e.z) < 2.2) { ball.owner = i; ball.lastSide = e.side; } return; }
      const d = Math.hypot(ow.x - e.x, ow.z - e.z); if (d > 2.6) return;
      const behind = Math.cos(ow.face - Math.atan2(e.x - ow.x, e.z - ow.z)) < -0.3; // 뒤에서 들어감
      const win = Math.random() < 0.38 + (e.st.def - ow.st.bal) / 120 + (behind ? -0.2 : 0.1);
      if (win) { ball.owner = -1; ball.vx = Math.sin(e.face) * 6; ball.vz = Math.cos(e.face) * 6; ball.vy = 1; ball.last = i; ball.lastSide = e.side; ball.lock = 0.15; SP.audio.kick(0.5); }
      else if (Math.random() < (behind ? 0.75 : 0.35)) { const lastMan = ents.filter(o => o.side === e.side && !o.out && o.slot !== 0 && o.x * dir(e.side) < e.x * dir(e.side)).length === 0 && Math.abs(ow.x - dir(ow.side) * L / 2) < 22; foul(e, ow, lastMan); }
    }
    function aiEnt(i, dt, ins) {
      const e = ents[i]; if (e.out) return; const side = e.side, T = TM[side];
      if (st.tackleT[i] > 0) st.tackleT[i] -= dt;
      if (st.slide[i] > 0) { st.slide[i] -= dt; e.x += e.vx * dt; e.z += e.vz * dt; e.vx *= 0.9; e.vz *= 0.9; e.spdNow = 0; return; }
      if (ins[side] && st.ctrl[side] === i) { e.x += e.vx * dt; e.z += e.vz * dt; clampE(e); e.spdNow = Math.hypot(e.vx, e.vz); return; }
      const d0 = dir(side), f = FORMS[form][e.slot], has = ball.owner === i, ourBall = ball.owner >= 0 && ents[ball.owner].side === side;
      const lvl = ins[side] ? 1 : D; // 사람 쪽 동료는 보통 AI
      let tx, tz, rush = 1;
      const bx = ball.x, bz = ball.z;
      if (e.slot === 0) { // 골키퍼
        const gx = -d0 * L / 2 + d0 * 1.2; tx = gx; tz = SP.clamp(bz * 0.35, -GW / 2 + 0.3, GW / 2 - 0.3);
        const inBox = Math.abs(bx - (-d0 * L / 2)) < BOX && Math.abs(bz) < 10;
        if (inBox && ball.owner < 0 && Math.hypot(bx - e.x, bz - e.z) < 9) { tx = bx; tz = bz; rush = 1.25; }
        if (ball.owner < 0 && Math.hypot(bx - e.x, bz - e.z) < 1.4 + e.st.def / 120 && ball.y < GH + 0.4 && ball.lock <= 0) { ball.owner = i; ball.vx = ball.vz = ball.vy = 0; ball.lastSide = side; ev('msg', {text: '🧤 선방!', ms: 700}); st.aiT[i] = 1.0; }
        if (has) { st.aiT[i] -= dt; tx = e.x; tz = e.z; if (st.aiT[i] <= 0) { if (!doPass(e, d0, 0)) kick(e, e.x + d0 * 25, (Math.random() - .5) * 20, 20, 7, 'pass'); } }
      } else if (has) { // 공 가진 AI
        st.aiT[i] -= dt;
        const gx = d0 * L / 2, distG = Math.abs(gx - e.x) + Math.abs(e.z) * 0.4;
        let press = 99, pr = null; for (const o of ents) if (o.side !== side && !o.out) { const dd = Math.hypot(o.x - e.x, o.z - e.z); if (dd < press) { press = dd; pr = o; } }
        tx = gx; tz = SP.clamp(e.z * 0.7, -10, 10);
        if (pr && press < 4) { tz = e.z + (e.z > pr.z ? 4 : -4); }
        if (st.holdT[side] > 0) st.holdT[side] -= dt;
        if (st.aiT[i] <= 0 && st.holdT[side] <= 0) {
          st.aiT[i] = 0.3 + Math.random() * 0.4;
          if (distG < 17 + e.st.pow / 20 && Math.random() < 0.5 + lvl * 0.15) shoot(e, 0.55 + Math.random() * 0.4, (Math.random() < 0.5 ? -1 : 1) * GW * (0.22 + Math.random() * 0.22));
          else if (press < 2.6 + lvl * 0.5 && Math.random() < 0.55 + lvl * 0.15) doPass(e, d0, 0);
          else if (Math.random() < 0.08 + lvl * 0.04) doPass(e, d0, 0);
        }
      } else if (ourBall) { // 공격 지원
        const push = 0.22 + (ball.x * d0 + L / 2) / L * 0.3;
        tx = -d0 * L / 2 + d0 * (f[0] + push) * L * 0.85; tz = f[1] * W * 0.42 + (bz - f[1] * W * 0.42) * 0.15;
        // 오프사이드 피하기 (어려울수록 잘 지킴)
        const opp = ents.filter(o => o.side !== side && !o.out).map(o => o.x * d0).sort((a, b) => b - a); const line = Math.max(opp[1] != null ? opp[1] : 0, ball.x * d0, 0);
        if (tx * d0 > line - 0.4 && Math.random() < 0.6 + lvl * 0.2) tx = (line - 0.6) * d0;
      } else { // 수비
        const chasers = ents.filter(o => o.side === side && !o.out && o.slot !== 0).sort((a, b) => Math.hypot(a.x - bx, a.z - bz) - Math.hypot(b.x - bx, b.z - bz));
        const rank = chasers.indexOf(e);
        if (rank === 0 || (rank === 1 && lvl >= 1)) { tx = bx + ball.vx * 0.2; tz = bz + ball.vz * 0.2; rush = 1.1;
          const ow = ball.owner >= 0 ? ents[ball.owner] : null;
          if (ow && ow.side !== side && Math.hypot(ow.x - e.x, ow.z - e.z) < 1.6 && st.tackleT[i] <= 0 && Math.random() < dt * (0.8 + lvl * 0.9)) { // 스탠딩 태클 / 가로채기
            st.tackleT[i] = 1.4 - lvl * 0.2;
            if (Math.random() < 0.3 + (e.st.def - ow.st.bal) / 140 + lvl * 0.08) { ball.owner = i; ball.lastSide = side; SP.audio.kick(0.4); }
            else if (Math.random() < 0.1) foul(e, ow, false);
          }
        } else { tx = -d0 * L / 2 + d0 * (f[0] * 0.8) * L * 0.85 + (bx - (-d0 * L / 2)) * 0.25; tz = f[1] * W * 0.38 + (bz - f[1] * W * 0.38) * 0.3; }
      }
      // 이동
      const dx = tx - e.x, dz = tz - e.z, dd = Math.hypot(dx, dz), sp = SP.runSpeed(e, 7.0) * rush * (0.9 + lvl * 0.06) * (st.period >= 2 && T.late ? T.late : 1) * (has ? 0.88 : 1);
      if (dd > 0.25) { e.vx = dx / dd * Math.min(sp, dd * 3); e.vz = dz / dd * Math.min(sp, dd * 3); e.face = Math.atan2(dx, dz); } else { e.vx *= 0.8; e.vz *= 0.8; }
      e.x += e.vx * dt; e.z += e.vz * dt; clampE(e);
      e.spdNow = Math.hypot(e.vx, e.vz); SP.drainATP(e, e.spdNow > 1, dt, T);
    }
    function clampE(e) { e.x = SP.clamp(e.x, -L / 2 - 2, L / 2 + 2); e.z = SP.clamp(e.z, -W / 2 - 1.5, W / 2 + 1.5); }
    function moveFree(dt) { ball.vy -= 18 * dt; ball.x += ball.vx * dt; ball.y += ball.vy * dt; ball.z += ball.vz * dt; if (ball.y < 0.2) { ball.y = 0.2; ball.vy = Math.abs(ball.vy) > 2 ? -ball.vy * 0.45 : 0; } const fr = ball.y <= 0.21 ? 1.5 : 0.15; ball.vx *= 1 - fr * dt; ball.vz *= 1 - fr * dt; }
    function physics(dt) {
      if (ball.lock > 0) ball.lock -= dt;
      if (ball.owner >= 0) { const o = ents[ball.owner]; if (o.out) { ball.owner = -1; } else { const fx = Math.sin(o.face), fz = Math.cos(o.face); ball.x = o.x + fx * 0.6; ball.z = o.z + fz * 0.6; ball.y = 0.2; ball.vx = o.vx; ball.vz = o.vz; } }
      else {
        const by = ball.y; moveFree(dt); if (by > 0.6 && ball.y <= 0.2) SP.audio.bounce();
        // 잡기
        if (ball.lock <= 0 && ball.y < 1.1) { let best = null, bd = 0.85; for (let i = 0; i < ents.length; i++) { const e = ents[i]; if (e.out || st.slide[i] > 0) continue; const d = Math.hypot(e.x - ball.x, e.z - ball.z); if (d < bd) { bd = d; best = i; } }
          if (best != null) { const e = ents[best]; touch(best); if (st.phase === 'play') { ball.owner = best; ball.last = best; ball.lastSide = e.side; } } }
      }
      // 골·아웃
      const ax = Math.abs(ball.x);
      if (ax > L / 2) {
        const sideGoal = ball.x > 0 ? 1 : -1; // 어느 쪽 골문인가
        if (Math.abs(ball.z) < GW / 2 && ball.y < GH) { // 골!
          const scorer = [0, 1].find(sd => dir(sd) === sideGoal);
          st.score[scorer]++; const sh = ents[ball.last]; ev('goal', {text: `${SP.TEAMS[cfg.teams[scorer]].name}${sh ? ' · ' + sh.no + ' ' + sh.name : ''}`, x: ball.x, z: ball.z, c: SP.TEAMS[cfg.teams[scorer]].c1});
          st.phase = 'goal'; st.phaseT = 2.6; st.kickSide = 1 - scorer; ball.owner = -1; ball.vx *= 0.2; ball.vz *= 0.2; return;
        }
        const defSide = [0, 1].find(sd => dir(sd) === -sideGoal); // 이 골문을 지키는 팀
        if (ball.lastSide === defSide) setRestart('corner', 1 - defSide, sideGoal * (L / 2 - 0.3), Math.sign(ball.z || 1) * (W / 2 - 0.3), '코너킥');
        else setRestart('goalkick', defSide, sideGoal * (L / 2 - 5), 0, '골킥');
        ev('whistle', {n: 1}); return;
      }
      if (Math.abs(ball.z) > W / 2) { setRestart('throw', 1 - ball.lastSide, ball.x, Math.sign(ball.z) * (W / 2 - 0.2), '스로인'); ev('whistle', {n: 1}); }
    }
    function touch(i) { // 오프사이드: 패스 받은 선수가 오프사이드 위치였으면
      const P = st.offPend; if (!P) return; const e = ents[i];
      if (e.side !== P.side) { st.offPend = null; return; }
      if (P.set.includes(i)) { st.stats[e.side].off++; ev('offside', {text: `${e.no} ${e.name} · 간접 프리킥`}); setRestart('free', 1 - e.side, e.x, e.z, ''); }
      st.offPend = null;
    }

    /* ---------- 화면 ---------- */
    function view(dt) {
      const me = cfg.me;
      SP.viewEnts(ents, dt, e => cfg.sides[me] === 'local' ? ents.indexOf(e) === st.ctrl[me] : false);
      ballM.position.set(ball.x, ball.y, ball.z); ballM.rotation.x += (ball.vz) * dt * 2; ballM.rotation.z -= (ball.vx) * dt * 2;
      if (flagT > 0) { flagT -= dt; flagger.position.x = ball.x; flagger.rotation.z = Math.sin(flagT * 20) * 0.3; } else flagger.rotation.z = 0;
      const c = SP.cam;
      if (st.phase === 'pk') SP.camTo({x: L / 2 - 6, y: 0, z: 0, dist: 14, h: 7, yaw: -Math.PI / 2 + 0.0001});
      else if (c.mode === 'persp') SP.camTo({x: ball.x * 0.92, y: 0, z: ball.z * 0.55 + 2, dist: 26, h: 20, yaw: 0});
      else SP.camTo({x: ball.x * 0.9, y: 0, z: ball.z * 0.6, dist: 34, h: 20, yaw: 0});
      SP.gauge(cfg.sides[me] === 'local' && st.holdT[me] > 0.04 && ball.owner === st.ctrl[me] ? Math.min(1, st.holdT[me]) : null, null, ents[st.ctrl[me]] ? {x: ents[st.ctrl[me]].mesh.position.x, y: 2.9, z: ents[st.ctrl[me]].mesh.position.z} : null);
    }
    const perName = () => st.phase === 'pk' ? '승부차기' : ['', '전반전', '후반전', '연장전'][st.period] || '';
    if (/[?&]pktest=1/.test(location.search)) startPK(); // 시험용: 바로 승부차기
    return {
      step, view,
      snap() { return {e: SP.snapEnts(ents), b: [ball.x, ball.y, ball.z, ball.vx, ball.vz].map(v => Math.round(v * 100) / 100), s: st.score, p: st.period, c: Math.round(st.clock), ph: st.phase, ct: st.ctrl, ev: EV.recent(), st: st.stats.map(x => Object.assign({}, x)), pk: st.pk ? {g: st.pk.goals, n: st.pk.n} : null, h: st.holdT, pw: st.pkWinner}; },
      apply(s) { SP.applyEnts(cfg, ents, s.e, e => e.slot === 0 ? {gk: e.side ? '#ffe066' : '#ff9f43'} : {}); [ball.x, ball.y, ball.z, ball.vx, ball.vz] = s.b; st.score = s.s; st.period = s.p; st.clock = s.c; st.phase = s.ph; st.ctrl = s.ct; st.stats = s.st; st.holdT = s.h; st.pkWinner = s.pw; if (s.pk) st.pk = Object.assign(st.pk || {}, {goals: s.pk.g, n: s.pk.n});
        EV.ingest(s.ev); },
      buttons(me) { if (st.phase === 'pk') return {b: st.pk && st.pk.turn === me ? '⚽ 킥' : '🧤 다이빙'}; if (st.phase !== 'play') return {}; const has = ball.owner >= 0 && ents[ball.owner].side === me; return has ? {b: '슛', a: '패스'} : {c: '태클', q: '선수<br>변경'}; },
      hud() { const T = cfg.teams.map(i => SP.TEAMS[i]); let pts = st.score.slice(); return {score: {a: {name: T[0].name, c1: SP.kit(cfg, 0).c1, pts: pts[0]}, b: {name: T[1].name, c1: SP.kit(cfg, 1).c1, pts: pts[1]}, sub: perName(), clock: st.phase === 'pk' ? `${st.pk.goals[0]} : ${st.pk.goals[1]}` : SP.fmtTime(st.clock)}, info: st.phase === 'pk' ? (st.pk.turn === cfg.me ? '⚽ 위·아래로 방향을 고르고 킥' : '🧤 막을 방향을 고르고 다이빙') : ''}; },
      minimap(g, w, h) { g.fillStyle = '#2f8a4a'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2; g.strokeRect(4, 4, w - 8, h - 8); g.beginPath(); g.moveTo(w / 2, 4); g.lineTo(w / 2, h - 4); g.stroke();
        const sx = (w - 8) / L, sz = (h - 8) / W; for (const e of ents) { if (e.out) continue; g.fillStyle = SP.kit(cfg, e.side).c1; g.beginPath(); g.arc(4 + (e.x + L / 2) * sx, 4 + (e.z + W / 2) * sz, ents.indexOf(e) === st.ctrl[cfg.me] ? 6 : 4, 0, 6.3); g.fill(); if (ents.indexOf(e) === st.ctrl[cfg.me]) { g.strokeStyle = '#ffe066'; g.stroke(); } }
        g.fillStyle = '#fff'; g.beginPath(); g.arc(4 + (ball.x + L / 2) * sx, 4 + (ball.z + W / 2) * sz, 3.5, 0, 6.3); g.fill(); },
      status() { const T = cfg.teams.map(i => SP.TEAMS[i]), a = st.stats[0], b = st.stats[1], tp = (a.poss + b.poss) || 1;
        const row = (l, x, y) => `<tr><td style="text-align:right;width:30%"><b>${x}</b></td><td style="text-align:center;color:#c3d0ea">${l}</td><td style="width:30%"><b>${y}</b></td></tr>`;
        return `<table class="rt"><tr><th style="text-align:right">${SP.esc(T[0].name)}</th><th style="text-align:center">항목</th><th>${SP.esc(T[1].name)}</th></tr>${row('점유율', Math.round(a.poss / tp * 100) + '%', Math.round(b.poss / tp * 100) + '%')}${row('슈팅 (유효)', `${a.shots} (${a.onT})`, `${b.shots} (${b.onT})`)}${row('패스', a.pass, b.pass)}${row('오프사이드', a.off, b.off)}${row('파울', a.fouls, b.fouls)}${row('옐로카드 🟨', a.y, b.y)}${row('레드카드 🟥', a.r, b.r)}${row('남은 교체', `${a.subs} / 2`, `${b.subs} / 2`)}${st.pk ? row('승부차기', st.pk.goals[0], st.pk.goals[1]) : ''}</table>`; },
      subInfo(side) { const n = st.stats[side].subs; return {ok: n > 0 && st.phase !== 'pk', text: `교체 ${2 - n}/2회 사용`, why: n <= 0 ? '교체 2회를 모두 썼어요' : st.phase === 'pk' ? '승부차기 중에는 교체할 수 없어요' : ''}; },
      lineupState(side) { return SP.lineupStateOf(cfg, ents, side, st.usedOut[side]); },
      sub(side, slot, inIdx) {
        if (st.stats[side].subs <= 0) return {ok: false, msg: '교체 2회를 모두 썼어요'};
        const e = ents.find(x => x.side === side && x.slot === slot); if (!e) return {ok: false};
        if (e.out) return {ok: false, msg: '퇴장당한 선수는 교체할 수 없어요'};
        if (ents.some(x => x.side === side && x.pi === inIdx) || st.usedOut[side].has(inIdx)) return {ok: false, msg: '이미 뛰었거나 뛰는 선수예요'};
        st.usedOut[side].add(e.pi); const outName = e.name; SP.doSwap(cfg, e, inIdx, slot === 0 ? {gk: side ? '#ffe066' : '#ff9f43'} : {});
        st.stats[side].subs--; return {ok: true, msg: `${outName} → ${e.name}`};
      },
      result() { if (st.phase !== 'end') return null; const s = st.score; let w = s[0] > s[1] ? 0 : s[1] > s[0] ? 1 : -1; let text = '';
        if (w < 0 && st.pkWinner != null) { w = st.pkWinner; text = `승부차기 ${st.pk.goals[0]} : ${st.pk.goals[1]}`; }
        return {winner: w, score: `${s[0]} : ${s[1]}`, text}; },
      dispose() {}
    };
  }
})();
