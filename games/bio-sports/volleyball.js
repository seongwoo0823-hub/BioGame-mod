/* 종목 4: 바이오 배구 — 5 대 5 (전위 2 · 후위 3 · 후보 15) · 서브→리시브→토스→스파이크 · 3터치 · 블로킹 · 인/아웃 · 5인 로테이션 · 듀스 · 세트제 */
'use strict';
(function () {
  const L = 18, W = 9, NET = 2.43;
  const POS = [[-7.4, 2.7], [-1.9, 2.3], [-1.9, -2.3], [-6.2, -2.7], [-6.4, 0]]; // 로테이션 자리 (0 = 서버/라이트 백, 1 = 라이트 프론트, 2 = 레프트 프론트, 3 = 레프트 백, 4 = 센터 백)
  const PN = ['라이트 백(서버)', '라이트 프론트', '레프트 프론트', '레프트 백', '센터 백'];
  const SLB = ['S·RB', 'RF', 'LF', 'LB', 'CB'];
  const WTS = [{bal: 0.8, pow: 0.6}, {pow: 1, def: 0.6}, {pow: 1, def: 0.6}, {def: 1, bal: 0.6}, {def: 1, bal: 0.8}];
  const S = SP.SPORTS.volleyball = {
    id: 'volleyball', name: '바이오 배구', icon: '🏐', desc: '5 대 5 · 서브·리시브·토스·스파이크 · 블로킹 · 로테이션 · 듀스', lineup: true, formLabel: '로테이션 시작 자리', speed: false,
    pitchBg: 'linear-gradient(90deg,#e8a05a 50%,#2a5aa8 50%)', pitchH: 280,
    options: [{key: 'pts', label: '세트 점수', def: 25, choices: [[25, '25점 (정규)'], [15, '15점 (빠른 경기)']]}, {key: 'sets', label: '세트 수', def: 3, choices: [[1, '단판'], [3, '3세트 (2선승)']]}],
    slots() { return POS.map((p, i) => ({label: SLB[i], w: WTS[i], x: 0.5 + p[0] / 20, y: 0.5 + p[1] / 10.5})); },
    controls: '<kbd>WASD</kbd> 선수 이동(손 떼면 자동 위치) · <kbd>J</kbd> 리시브/토스(방향키로 공격수 고르기) · <kbd>K</kbd> 서브(꾹 눌러 힘)·스파이크(타이밍) · <kbd>L</kbd> 블로킹 점프 · <kbd>Tab</kbd> 현황·교체',
    touch: {c: '블로킹', a: '리시브<br>토스', b: '서브<br>스파이크', t: '현황'},
    create
  };
  function create(cfg) {
    const TM = SP.teamMods(cfg), D = cfg.diff, setPts = cfg.opts.pts || 25, setsN = cfg.opts.sets || 3, needSets = setsN === 1 ? 1 : 2, sc = SP.scene;
    sc.background.set(0x24304a);
    const tex = SP.canvasTex(1024, 512, (g, w, h) => {
      g.fillStyle = '#3a6ac8'; g.fillRect(0, 0, w, h); const px = w / 24, ox = 3 * px, oy = (h - 9 * px * 1.0) / 2 + 0;
      g.fillStyle = '#e8a05a'; g.fillRect(ox, h / 2 - 4.5 * (h / 12), 18 * px, 9 * (h / 12));
      g.globalAlpha = 0.12; g.fillStyle = '#8a3a2a'; for (let i = 0; i < 40; i++) { g.beginPath(); g.arc(ox + Math.random() * 18 * px, h / 2 + (Math.random() - .5) * 9 * (h / 12), 6 + Math.random() * 14, 0, 6.3); g.fill(); } g.globalAlpha = 1;
      const zy = h / 12; g.strokeStyle = '#fff'; g.lineWidth = 5; g.strokeRect(ox, h / 2 - 4.5 * zy, 18 * px, 9 * zy); g.beginPath(); g.moveTo(w / 2, h / 2 - 4.5 * zy); g.lineTo(w / 2, h / 2 + 4.5 * zy); g.stroke();
      g.lineWidth = 3; g.beginPath(); g.moveTo(w / 2 - 3 * px, h / 2 - 4.5 * zy); g.lineTo(w / 2 - 3 * px, h / 2 + 4.5 * zy); g.moveTo(w / 2 + 3 * px, h / 2 - 4.5 * zy); g.lineTo(w / 2 + 3 * px, h / 2 + 4.5 * zy); g.stroke();
    });
    const fl = SP.plane(24, 12, 0, tex); sc.add(fl); sc.add(SP.stadium(26, 16, {out: 0x2a3a5a}));
    // 네트: 세포막 그물
    const netM = new THREE.Mesh(new THREE.PlaneGeometry(W + 1, 1.0, 20, 4), new THREE.MeshBasicMaterial({color: 0x1a2030, wireframe: true, transparent: true, opacity: 0.9})); netM.rotation.y = Math.PI / 2; netM.position.set(0, NET - 0.5, 0); sc.add(netM);
    sc.add(SP.vox([[0, NET - 0.06, 0, 0.06, 0.08, W + 1, '#ffffff'], [0, 0, W / 2 + 0.7, 0.14, NET + 0.1, 0.14, '#c33'], [0, 0, -W / 2 - 0.7, 0.14, NET + 0.1, 0.14, '#c33'], [0, NET, W / 2 + 0.05, 0.04, 0.8, 0.04, '#ff5d6c'], [0, NET, -W / 2 - 0.05, 0.04, 0.8, 0.04, '#ff5d6c']]));
    const slots = S.slots();
    const ents = [0, 1].flatMap(sd => SP.makeEnts(cfg, sd, slots));
    ents.forEach(e => { e.rot = e.slot; e.jump = 0; });
    const idx = e => ents.indexOf(e), team = sd => ents.filter(e => e.side === sd);
    const ballM = SP.vox([[0, -0.15, 0, 0.3, 0.3, 0.3, '#fff4c8'], [0, -0.16, 0, 0.32, 0.1, 0.32, '#3a8ae8'], [0, -0.16, 0, 0.1, 0.32, 0.32, '#ffd25e']]); sc.add(ballM);
    const mark = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.4, 20), new THREE.MeshBasicMaterial({color: 0xffe066, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false})); mark.rotation.x = -Math.PI / 2; mark.position.y = 0.03; sc.add(mark);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.2, 12), new THREE.MeshBasicMaterial({color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false})); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02; sc.add(shadow);
    const ball = {x: 0, y: 1, z: 0, tr: null};
    const st = {score: [0, 0], sets: [0, 0], setNo: 1, setLog: [], serve: 0, phase: 'serveWait', t: 0, hold: [0, 0], aim: [{x: 0, z: 0}, {x: 0, z: 0}], touches: 0, lastTeam: -1, lastToucher: -1, kind: '', rcv: [-1, -1], ctrl: [-1, -1], press: [{}, {}], idle: [9, 9], end: false, msg: '', subs: [0, 0], usedSet: [new Set(), new Set()],
      stats: [0, 1].map(() => ({ace: 0, kill: 0, blk: 0, err: 0, dig: 0, rec: 0, att: 0})), pp: ents.map(() => ({pts: 0, dig: 0})), planHit: [-1, -1], block: null, rallyT: 0};
    const EV = SP.makeEvents(fire); const ev = (t, d) => EV.emit(t, d);
    function fire(e) { const A = SP.audio;
      if (e.type === 'touch') A.bounce(); if (e.type === 'spike') { A.spike(); SP.cam.shake = 0.25; } if (e.type === 'whistle') A.whistle(e.n || 1); if (e.type === 'land') { A.kick(); SP.burst(e.x, 0.1, e.z, ['#fff', '#ffd25e'], 10, 0.4); }
      if (e.type === 'cheer') A.cheer(); if (e.type === 'msg') SP.toast(e.text, e.sub || '', e.ms || 1200); if (e.type === 'block') { A.clack(0.2); A.spike(); } }
    const mir = (sd, p) => sd === 0 ? p : [-p[0], -p[1]];
    const dirX = sd => sd === 0 ? 1 : -1; // 상대 코트 방향
    function home(e) { return mir(e.side, POS[e.rot]); }
    function lvl(sd) { return cfg.sides[sd] === 'ai' ? D : 1; }
    function setupServe() {
      st.phase = 'serveWait'; st.t = 0; st.touches = 0; st.lastTeam = -1; st.hold = [0, 0]; st.block = null; st.rallyT = 0;
      for (const e of ents) { const p = home(e); e.x = p[0]; e.z = p[1]; e.y = 0; e.jump = 0; e.face = e.side ? -Math.PI / 2 : Math.PI / 2; e.spdNow = 0; }
      const sv = server(); sv.x = dirX(st.serve) * -9.8; sv.z = mir(st.serve, [0, 2.6])[1];
      ball.tr = null; ball.x = sv.x + dirX(st.serve) * 0.4; ball.y = 1.3; ball.z = sv.z;
      st.aim[st.serve] = {x: 0.55, z: 0}; st.ctrl = [-1, -1]; st.ctrl[st.serve] = idx(sv);
    }
    const server = () => team(st.serve).find(e => e.rot === 0);
    // 공 궤적: 시작 → 목표 (끝 높이 ey), 시간 T, 꼭대기 추가 높이 h
    function arcH(tx, ey, margin) { const kc = Math.abs(ball.x) / (Math.abs(ball.x) + Math.abs(tx) || 1), yl = ball.y + (ey - ball.y) * kc; return Math.max(0.1, (NET + margin - yl) / (4 * kc * (1 - kc) || 1)); }
    function launch(tx, tz, ey, T, h, kind, side, extra) { st.kind = kind; ball.tr = Object.assign({sx: ball.x, sy: ball.y, sz: ball.z, tx, tz, ey, T, h, t: 0, kind, side, crossed: Math.sign(ball.x) === Math.sign(tx) || Math.abs(ball.x) < 0.05 ? 1 : 0}, extra || {}); }
    function trPos(tr, t) { const k = t / tr.T; return [tr.sx + (tr.tx - tr.sx) * k, tr.sy + (tr.ey - tr.sy) * k + 4 * tr.h * k * (1 - k), tr.sz + (tr.tz - tr.sz) * k]; }
    function landingOf(tr) { // 땅(0.15)에 닿는 시점 (끝까지 이어진다고 보고)
      const vx = (tr.tx - tr.sx) / tr.T, vz = (tr.tz - tr.sz) / tr.T; let t = tr.t; for (let i = 0; i < 80; i++) { t += 0.03; const [, y] = trPos(tr, t); if (y < 0.15) break; } const [x, , z] = trPos(tr, t); return {x, z, t}; }
    function serveBall(power, aim) {
      const sv = server(), sd = st.serve, T = TM[sd], q = 1 - Math.min(1, Math.abs(power - 0.72) / 0.42);
      const err = (1 - sv.st.bal / 130) * (1.6 - q) * (cfg.sides[sd] === 'ai' ? 1.25 - lvl(sd) * 0.15 : 1);
      const depth = 1.5 + aim.x * 6.5 + (power - 0.72) * 6 + (Math.random() - .5) * err * 2.2, tz = SP.clamp(aim.z, -1, 1) * 4.0 + (Math.random() - .5) * err * 2.4;
      const sp = 0.85 + power * 0.5 + sv.st.pow / 400;
      ball.y = 2.6; const tx0 = dirX(sd) * depth; launch(tx0, tz, 0.1, 1.15 / sp, arcH(tx0, 0.1, 0.35 + 0.5 * (1 - power) - (power < 0.22 ? 0.9 : 0) + (Math.random() - .5) * err * 0.4), 'serve', sd);
      st.phase = 'rally'; st.lastTeam = sd; st.lastToucher = idx(sv); st.touches = 0; sv.jump = 0.4; SP.pose(sv.mesh, 'up', 300); ev('spike'); st.stats[sd].att++;
      planReceive(1 - sd);
    }
    function planReceive(sd) { // 공이 오는 팀: 받을 선수 정하기
      const L0 = landingOf(ball.tr); let best = null, bd = 1e9; for (const e of team(sd)) { const d = Math.hypot(e.x - L0.x, e.z - L0.z) + (e.rot === 1 || e.rot === 2 ? 0.6 : 0); if (d < bd) { bd = d; best = e; } }
      st.rcv[sd] = idx(best); if (cfg.sides[sd] !== 'ai') st.ctrl[sd] = idx(best); st.react = st.react || [0, 0]; st.react[sd] = (st.kind === 'spike' ? 0.22 : 0.12) + (2 - lvl(sd)) * 0.08; st.planT = st.planT || [0, 0]; st.planT[sd] = st.rallyT;
    }
    function inCourt(x, z) { return Math.abs(x) <= L / 2 + 0.08 && Math.abs(z) <= W / 2 + 0.08; }
    function point(win, why, who) {
      if (st.phase === 'point') return; st.phase = 'point'; st.t = 0; st.score[win]++; st.ptWin = win; st.ptWhy = why; ball.tr = null;
      if (who != null) st.pp[who].pts++;
      ev('whistle', {n: 1}); ev('cheer'); ev('msg', {text: why, sub: `${SP.TEAMS[cfg.teams[win]].name} 득점 · ${st.score[0]} : ${st.score[1]}`, ms: 1300});
    }
    function afterPoint() {
      const win = st.ptWin, tgt = st.setNo === 3 || (setsN === 3 && st.setNo === 3) ? 15 : setPts;
      const [a, b] = st.score;
      if ((a >= tgt || b >= tgt) && Math.abs(a - b) >= 2) { const w = a > b ? 0 : 1; st.sets[w]++; st.setLog.push([a, b]); ev('msg', {text: `${st.setNo}세트 종료`, sub: `${SP.TEAMS[cfg.teams[w]].name} 세트 획득 · ${a}:${b}`, ms: 1800}); SP.audio.fanfare();
        if (st.sets[w] >= needSets) { st.end = true; st.phase = 'end'; return; }
        st.setNo++; st.score = [0, 0]; st.subs = [0, 0]; st.serve = st.setNo % 2 ? 0 : 1; ents.forEach(e => { e.atp = Math.min(1, e.atp + 0.35); }); setupServe(); st.t = -1.5; return; }
      if (a === b && a >= tgt - 1) ev('msg', {text: '듀스!', sub: '2점 차가 나야 세트가 끝나요', ms: 1100});
      if (win !== st.serve) { st.serve = win; for (const e of team(win)) e.rot = (e.rot + 4) % 5; ev('msg', {text: '사이드 아웃 · 로테이션', sub: `${SP.TEAMS[cfg.teams[win]].name} 서브`, ms: 1000}); }
      setupServe();
    }
    function touch(e, q) { // 공을 건드림 → 다음 동작
      const sd = e.side, T = TM[sd];
      if (st.lastTeam === sd) st.touches++; else { st.touches = 1; st.lastTeam = sd; }
      st.lastToucher = idx(e); ev('touch'); SP.pose(e.mesh, 'bump', 260);
      if (st.touches > 3) { point(1 - sd, '포 히트 반칙 (4번 터치)'); return; }
      const human = cfg.sides[sd] !== 'ai', pr = st.press[sd], pa = pr.a, pdz = pr.dz; pr.a = null;
      if (st.touches === 1) { // 리시브 / 디그 → 세터에게
        if (st.kind === 'spike' || st.kind === 'block') { st.stats[sd].dig++; st.pp[idx(e)].dig++; } else st.stats[sd].rec++;
        const setter = pickSetter(sd, e); const tp = mir(sd, [-1.4, 0.4]);
        if (q < 0.18) { // 셩크: 엉뚱한 방향
          launch(e.x + (Math.random() - .5) * 8, e.z + (Math.random() - .5) * 8, 0.1, 1.2, 3.2, 'shank', sd); ev('msg', {text: '리시브 실패!', ms: 700}); st.rcv[sd] = idx(nearestTo(sd, ball.tr.tx, ball.tr.tz, e)); return; }
        const off = (1 - q) * 2.6; const tx = tp[0] + (Math.random() - .5) * off, tz = tp[1] + (Math.random() - .5) * off;
        launch(tx, tz, 1.9, 1.1, 2.6, 'pass', sd); st.rcv[sd] = idx(setter); st.planHit[sd] = -1; if (human) st.ctrl[sd] = idx(setter);
        return; }
      if (st.touches === 2) { // 토스 → 공격수
        let hitters = team(sd).filter(x => x !== e && (x.rot === 1 || x.rot === 2 || (x.rot === 4 && Math.random() < 0.3))); if (!hitters.length) hitters = team(sd).filter(x => x !== e && x.rot !== 0);
        let h = hitters[Math.floor(Math.random() * hitters.length)];
        if (human && pa != null && st.rallyT - pa < 0.6 && pdz) { const want = hitters.slice().sort((a, b) => (b.z - a.z) * pdz); h = want[0]; }
        else if (!human) h = hitters.slice().sort((a, b) => (b.st.pow - a.st.pow) + (Math.random() - .5) * 30)[0];
        if (q < 0.15) { // 토스 실패 → 넘기기
          freeBall(e, sd); return; }
        const hp = mir(sd, [-1.2, (h.z * (sd ? -1 : 1)) > 0 ? 3.0 : -3.0]); const back = h.rot !== 1 && h.rot !== 2;
        launch(back ? mir(sd, [-3.6, 0])[0] : hp[0], back ? h.z : hp[1], 3.0, 0.95, 1.6 + (1 - q) * 0.8, 'set', sd, {q}); st.rcv[sd] = idx(h); st.planHit[sd] = idx(h); if (human) st.ctrl[sd] = idx(h);
        return; }
      // 세 번째 터치: 스파이크 (높은 공) 또는 넘기기
      if (st.planHit[sd] === idx(e) && ball.y > 2.2) spike(e, q); else freeBall(e, sd);
    }
    function pickSetter(sd, recv) { const fr = team(sd).filter(x => x !== recv && (x.rot === 1)); if (fr.length) return fr[0]; const any = team(sd).filter(x => x !== recv).sort((a, b) => Math.abs(a.x) - Math.abs(b.x)); return any[0]; }
    function nearestTo(sd, x, z, ex) { return team(sd).filter(e => e !== ex).sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0]; }
    function freeBall(e, sd) { const tx = dirX(sd) * (3 + Math.random() * 4.5), tz = (Math.random() - .5) * 6; launch(tx, tz, 0.1, 1.4, 2.6, 'free', sd); planReceive(1 - sd); ev('msg', {text: '넘기기', ms: 600}); }
    function spike(e, q) {
      const sd = e.side, T = TM[sd], human = cfg.sides[sd] !== 'ai', pr = st.press[sd]; st.stats[sd].att++;
      e.jump = 0.55; SP.pose(e.mesh, 'up', 400);
      // 목표: 사람은 방향키로, AI는 빈 곳
      let tx, tz; const opp = team(1 - sd);
      if (human && pr.b != null && st.rallyT - pr.b < 0.7) { tx = dirX(sd) * SP.clamp(5 + (pr.bx || 0) * dirX(sd) * 3.5, 2.5, 8.6); tz = SP.clamp((pr.bz || 0) * 4.2, -4.3, 4.3); }
      else { let best = null, bv = -1; for (let i = 0; i < 14; i++) { const cx = dirX(sd) * (2.6 + Math.random() * 6), cz = (Math.random() * 2 - 1) * 4; let md = 99; for (const o of opp) md = Math.min(md, Math.hypot(o.x - cx, o.z - cz)); if (md > bv) { bv = md; best = [cx, cz]; } } [tx, tz] = best; }
      const err = (1 - e.st.bal / 140) * (1.5 - q) * (human ? 1 : 1.25 - lvl(sd) * 0.12);
      tx += (Math.random() - .5) * err * 2.6; tz += (Math.random() - .5) * err * 2.6;
      if (q < 0.12) tx = dirX(sd) * 0.3; // 네트에 걸림
      const pw = (0.6 + q * 0.4) * (0.8 + e.st.pow / 300) * (T.shot || 1) * (0.75 + 0.25 * e.atp); const crit = Math.random() < (T.crit || 0);
      ball.y = 3.35; launch(tx, tz, 0.1, Math.max(0.32, 0.62 / pw / (crit ? 1.2 : 1)), q < 0.12 ? 0.05 : arcH(tx, 0.1, 0.18 + Math.random() * 0.2), 'spike', sd, {hitter: idx(e)}); pr.b = null;
      ev('spike'); if (crit) ev('msg', {text: '💥 돌연변이 스파이크!', ms: 800});
      e.atp = Math.max(0.05, e.atp - 0.03);
      // 블로킹 판정 준비
      const blockers = opp.filter(o => (o.rot === 1 || o.rot === 2) && Math.abs(o.x) < 3 && Math.abs(o.z - e.z) < 2.2);
      st.block = {t: 0.12, blockers: blockers.map(idx), hitter: idx(e), side: 1 - sd, done: false};
      planReceive(1 - sd);
    }
    function resolveBlock() {
      const B = st.block; B.done = true; const sd = B.side, human = cfg.sides[sd] !== 'ai', pr = st.press[sd];
      let power = 0, n = 0;
      for (const bi of B.blockers) { const b = ents[bi]; let jump; if (human && bi === st.ctrl[sd]) jump = pr.c != null && st.rallyT - pr.c < 0.55; else if (human) jump = Math.random() < 0.5; else jump = Math.random() < 0.3 + lvl(sd) * 0.12;
        if (!jump) continue; b.jump = 0.5; SP.pose(b.mesh, 'up', 450); n++; power += b.st.def / 100 * (0.8 + b.st.pow / 400); }
      if (!n) return; const h = ents[B.hitter], r = Math.random(), stuff = 0.075 * power * (1.2 - h.st.pow / 200) * (1 + (n - 1) * 0.4), soft = 0.2 * power;
      ev('block');
      if (r < stuff) { // 셧아웃: 공격 팀 코트로 떨어짐
        const att = 1 - sd; ball.x = att === 0 ? -0.2 : 0.2; launch((att === 0 ? -1 : 1) * (0.8 + Math.random() * 2), ball.z + (Math.random() - .5) * 2, 0.1, 0.45, 0.3, 'stuff', sd, {crossed: 1}); st.kind = 'block'; st.lastTeam = sd; st.touches = 0; st.blockWho = B.blockers.find(bi => ents[bi].jump > 0); ev('msg', {text: '🧱 블로킹!', ms: 800}); }
      else if (r < stuff + soft) { // 유효 블로킹: 공이 느려져 수비하기 쉬움 (터치 수에 안 셈)
        const L0 = landingOf(ball.tr); launch(L0.x * 0.7, L0.z * 0.7, 0.1, 1.2, 2.2, 'soft', 1 - sd, {crossed: 1}); st.kind = 'block'; st.lastTeam = sd; st.touches = 0; st.softBlock = true; planReceive(sd); ev('msg', {text: '유효 블로킹', ms: 600}); }
    }
    // ---------- 프레임 ----------
    function step(dt, ins) {
      if (st.end) return; st.t += dt;
      for (let sd = 0; sd < 2; sd++) { const i = ins[sd]; if (!i) continue; if (i.a) Object.assign(st.press[sd], {a: st.rallyT, dz: i.my || 0}); if (i.b && st.phase === 'rally') Object.assign(st.press[sd], {b: st.rallyT, bx: i.mx, bz: i.my}); if (i.c) st.press[sd].c = st.rallyT; }
      SP.audio.crowd(0.25 + (st.phase === 'rally' ? 0.35 : 0));
      if (st.phase === 'point') { moveAll(dt, ins, true); if (st.t > 1.6) afterPoint(); return; }
      if (st.phase === 'serveWait') {
        const sd = st.serve, i = ins[sd]; moveAll(dt, ins, true);
        if (st.t < 0.6) return;
        if (i) { st.aim[sd].x = SP.clamp(st.aim[sd].x + i.mx * dirX(sd) * dt * 0.9, 0, 1); st.aim[sd].z = SP.clamp(st.aim[sd].z + i.my * dt * 1.2, -1, 1);
          if (i.hb) { st.hold[sd] += dt; SP.gaugeVal = Math.min(1, st.hold[sd] / 1.1); } else if (st.hold[sd] > 0.05) { serveBall(Math.min(1, st.hold[sd] / 1.1), st.aim[sd]); st.hold[sd] = 0; } else if (st.t > 15) serveBall(0.7, st.aim[sd]); }
        else if (st.t > 1.3) { const l = lvl(sd); serveBall(SP.clamp(0.6 + Math.random() * 0.25 + l * 0.04, 0, 1), {x: 0.3 + Math.random() * 0.6, z: (Math.random() * 2 - 1) * 0.85}); }
        return;
      }
      if (st.phase !== 'rally') return;
      st.rallyT += dt; moveAll(dt, ins, false);
      const tr = ball.tr; if (!tr) return;
      const prevX = ball.x; tr.t += dt; [ball.x, ball.y, ball.z] = trPos(tr, tr.t);
      // 네트 통과
      if (!tr.crossed && Math.sign(prevX) !== Math.sign(ball.x) && prevX !== 0) { tr.crossed = 1;
        if (ball.y < NET + 0.12 || Math.abs(ball.z) > W / 2 + 0.5) { const sd = tr.side; ball.x = (sd === 0 ? -0.25 : 0.25); launch(ball.x, ball.z, 0.1, 0.45, 0, 'net', sd, {crossed: 1}); st.stats[sd].err++; point(1 - sd, tr.kind === 'serve' ? '서브 네트 걸림' : '네트에 걸렸어요'); return; }
        if (st.block && !st.block.done && tr.kind === 'spike') resolveBlock(); if (ball.tr && ball.tr.kind !== 'spike' && ball.tr.kind !== 'serve' && ball.tr.kind !== 'free') planReceive(ball.x < 0 ? 0 : 1); }
      if (st.block && !st.block.done && tr.kind === 'spike' && tr.t > tr.T * 0.25) resolveBlock();
      // 수비 터치: 공이 내려올 때 받을 선수 근처
      const comingTo = ball.x < 0 ? 0 : 1;
      if (ball.y < (tr.kind === 'set' ? 3.2 : tr.kind === 'pass' ? 2.1 : 1.15) && tr.t > tr.T * 0.45 && tr.kind !== 'net' && tr.kind !== 'stuff') {
        const sd = (tr.kind === 'pass' || tr.kind === 'set') ? tr.side : comingTo;
        const cand = st.rcv[sd] >= 0 ? ents[st.rcv[sd]] : null;
        const reach = (tr.kind === 'spike' ? 0.8 : 1.3) + (cand ? cand.st.def / (tr.kind === 'spike' ? 450 : 300) : 0);
        const own = (tr.kind === 'serve' || tr.kind === 'spike' || tr.kind === 'free') && tr.side === sd;
        const letGo = !own && (tr.kind === 'serve' || tr.kind === 'spike' || tr.kind === 'free') && !inCourt(tr.tx, tr.tz) && cfg.sides[sd] === 'ai' && Math.random() < 0.3 + lvl(sd) * 0.3;
        if (cand && cand.side === sd && !own && !tr.letGo && Math.hypot(cand.x - ball.x, cand.z - ball.z) < reach) {
          if (letGo) { tr.letGo = true; } else { const q = touchQuality(cand, tr, sd); ball.tr = null; touch(cand, q); return; } }
      }
      if (tr.t >= tr.T || ball.y <= 0.12) { // 바닥
        ball.y = 0.12; ev('land', {x: ball.x, z: ball.z}); const inn = inCourt(ball.x, ball.z), half = ball.x < 0 ? 0 : 1;
        if (tr.kind === 'net' || tr.kind === 'stuff') { const sd = tr.side; if (tr.kind === 'stuff') { st.stats[sd].blk++; point(sd, '🧱 블로킹 득점!', st.blockWho); } else point(1 - sd, '네트에 걸렸어요'); return; }
        if (inn) { const win = 1 - half; if (tr.kind === 'serve') { st.stats[win].ace++; point(win, '🎯 서브 에이스!', st.lastToucher); } else if (tr.kind === 'spike' && win === tr.side) { st.stats[win].kill++; point(win, '💥 스파이크 득점!', tr.hitter); } else point(win, win === tr.side ? '득점!' : '수비 실패'); }
        else { const loser = st.lastTeam; if (st.kind === 'block' && loser !== tr.side) { point(tr.side, '블로킹 아웃 (터치 아웃)', tr.hitter); } else { st.stats[loser].err++; point(1 - loser, tr.kind === 'serve' ? '서브 아웃' : '아웃!'); } }
      }
    }
    function inCourtLanding(tr) { const L0 = {x: tr.tx, z: tr.tz}; return inCourt(L0.x, L0.z); }
    function touchQuality(e, tr, sd) {
      const human = cfg.sides[sd] !== 'ai', pr = st.press[sd];
      let q = 0.45 + e.st.bal / 300 + e.st.def / 500 - (tr.kind === 'spike' ? 0.28 : tr.kind === 'serve' ? 0.12 : 0) + (st.softBlock ? 0.2 : 0);
      const key = tr.kind === 'set' ? 'b' : 'a';
      if (human) { const pt = pr[key]; const ok = pt != null && st.rallyT - pt < 0.45; q += ok ? 0.18 : -0.12; }
      else q += (lvl(sd) - 1) * 0.08;
      q *= 0.75 + 0.25 * e.atp; q += (Math.random() - .5) * 0.3; st.softBlock = false;
      return SP.clamp(q, 0, 1);
    }
    function moveAll(dt, ins, idleOnly) {
      for (let sd = 0; sd < 2; sd++) {
        const i = ins[sd]; if (i && (Math.abs(i.mx) > 0.1 || Math.abs(i.my) > 0.1)) st.idle[sd] = 0; else st.idle[sd] += dt;
        if (i && st.phase === 'rally' && (st.ctrl[sd] < 0 || ents[st.ctrl[sd]].side !== sd)) st.ctrl[sd] = st.rcv[sd] >= 0 ? st.rcv[sd] : idx(team(sd)[0]);
        for (const e of team(sd)) {
          if (e.jump > 0) { e.jump -= dt; e.y = Math.max(0, Math.sin(Math.max(0, e.jump) / 0.55 * Math.PI) * 0.9); } else e.y = 0;
          if (st.phase === 'serveWait' && e === server()) { e.spdNow = 0; continue; }
          let tx, tz; const hp = home(e);
          if (idleOnly) { tx = hp[0]; tz = hp[1]; }
          else { tx = hp[0]; tz = hp[1]; const tr = ball.tr;
            if (tr && idx(e) === st.rcv[sd]) { const L0 = (tr.kind === 'pass' || tr.kind === 'set') ? {x: tr.tx, z: tr.tz} : landingOf(tr); tx = L0.x; tz = L0.z; if (tr.kind === 'set') { tx = tr.tx - dirX(sd) * 0.4; } }
            else if (tr && (e.rot === 1 || e.rot === 2) && st.lastTeam !== sd && tr.kind === 'set') { tx = sd === 0 ? -0.8 : 0.8; tz = SP.clamp(ball.z, -4, 4) * 0.8 + (e.rot === 1 ? 0.6 : -0.6) * (sd ? -1 : 1); } // 블로킹 준비
          }
          const human = i && idx(e) === st.ctrl[sd];
          let vx, vz; const sp = SP.runSpeed(e, 6.0);
          if (human && st.idle[sd] < 0.3 && st.phase !== 'serveWait') { vx = i.mx * sp; vz = i.my * sp; }
          else { const dx = tx - e.x, dz = tz - e.z, d = Math.hypot(dx, dz); const re = st.react ? st.react[sd] : 0; if (d > 0.08 && !(idx(e) === st.rcv[sd] && st.rallyT < re + (st.planT ? st.planT[sd] : 0) && !idleOnly)) { const m = Math.min(sp * (cfg.sides[sd] === 'ai' ? 0.9 + lvl(sd) * 0.06 : 1), d * 5); vx = dx / d * m; vz = dz / d * m; } else { vx = 0; vz = 0; } }
          e.x += vx * dt; e.z += vz * dt;
          // 자기 코트 안에서만
          if (sd === 0) e.x = SP.clamp(e.x, -11, -0.3); else e.x = SP.clamp(e.x, 0.3, 11); e.z = SP.clamp(e.z, -6, 6);
          e.spdNow = Math.hypot(vx, vz); if (e.spdNow > 0.3) e.face = Math.atan2(vx, vz); else e.face = Math.atan2(ball.x - e.x, ball.z - e.z);
          SP.drainATP(e, e.spdNow > 0.5, dt, TM[sd], 0.6);
        }
      }
    }
    function view(dt) {
      const me = cfg.me, local = cfg.sides[me] === 'local';
      SP.viewEnts(ents, dt, e => local && idx(e) === st.ctrl[me]);
      ballM.position.set(ball.x, ball.y, ball.z); ballM.rotation.x += dt * 8; shadow.position.set(ball.x, 0.02, ball.z);
      const tr = ball.tr; mark.visible = false;
      if (st.phase === 'serveWait' && local && st.serve === me) { mark.visible = true; const a = st.aim[me]; mark.position.set(dirX(me) * (1.5 + a.x * 6.5), 0.03, a.z * 4.0); }
      else if (tr && st.phase === 'rally' && (tr.kind !== 'pass' && tr.kind !== 'set')) { const L0 = landingOf(tr); mark.visible = true; mark.position.set(L0.x, 0.03, L0.z); }
      SP.camTo(SP.cam.mode === 'persp' ? {x: ball.x * 0.25, y: 1.2, z: 0.5, dist: 15.5, h: 8.5, yaw: 0.42} : {x: ball.x * 0.2, y: 0, z: 0, dist: 24, h: 10, yaw: 0});
      SP.gauge(st.phase === 'serveWait' && local && st.serve === me && st.hold[me] > 0.05 ? SP.gaugeVal || 0 : null, 0.65);
    }
    return {
      step, view,
      snap() { return {e: SP.snapEnts(ents), r: ents.map(e => e.rot), b: [ball.x, ball.y, ball.z].map(v => Math.round(v * 100) / 100), s: [st.score, st.sets, st.setNo, st.serve, st.phase, st.touches, st.lastTeam, st.ctrl, st.setLog, st.stats, st.pp], a: st.aim, tr: ball.tr ? [ball.tr.tx, ball.tr.tz, ball.tr.kind] : null, ev: EV.recent(), end: st.end}; },
      apply(s) { SP.applyEnts(cfg, ents, s.e); s.r.forEach((r, i) => ents[i].rot = r); [ball.x, ball.y, ball.z] = s.b; [st.score, st.sets, st.setNo, st.serve, st.phase, st.touches, st.lastTeam, st.ctrl, st.setLog, st.stats, st.pp] = s.s; st.aim = s.a; ball.tr = s.tr ? {sx: ball.x, sy: ball.y, sz: ball.z, tx: s.tr[0], tz: s.tr[1], ey: 0.1, T: 1, h: 1, t: 0, kind: s.tr[2]} : null; st.end = s.end; EV.ingest(s.ev); },
      hud() { const T = cfg.teams.map(i => SP.TEAMS[i]);
        return {score: {a: {name: T[0].name, c1: SP.kit(cfg, 0).c1, pts: st.score[0]}, b: {name: T[1].name, c1: SP.kit(cfg, 1).c1, pts: st.score[1]}, sub: `${st.setNo}세트 · 세트 ${st.sets[0]}:${st.sets[1]}${st.phase === 'rally' && st.lastTeam >= 0 ? ` · 터치 ${st.touches}/3` : ''}`, clock: `🏐 ${SP.TEAMS[cfg.teams[st.serve]].name} 서브`}, info: hudInfo()}; },
      status() { const T = cfg.teams.map(i => SP.TEAMS[i]), [a, b] = st.stats;
        const row = (l, x, y) => `<tr><td style="text-align:right"><b>${x}</b></td><td style="text-align:center;color:#c3d0ea">${l}</td><td><b>${y}</b></td></tr>`;
        const log = st.setLog.map((s, i) => `${i + 1}세트 ${s[0]}:${s[1]}`).join(' · ') || '첫 세트 진행 중';
        const rot = sd => team(sd).slice().sort((p, q) => p.rot - q.rot).map(e => `${PN[e.rot]}: ${e.no} ${SP.esc(e.name)} (${st.pp[idx(e)].pts}점)`).join('<br>');
        return `<p class="sub">${log}</p><table class="rt"><tr><th style="text-align:right">${SP.esc(T[0].name)}</th><th style="text-align:center">항목</th><th>${SP.esc(T[1].name)}</th></tr>${row('스파이크 득점', a.kill, b.kill)}${row('블로킹 득점', a.blk, b.blk)}${row('서브 에이스', a.ace, b.ace)}${row('범실', a.err, b.err)}${row('디그', a.dig, b.dig)}${row('리시브', a.rec, b.rec)}${row('이번 세트 교체', st.subs[0] + '/6', st.subs[1] + '/6')}</table>
          <div class="lbl">로테이션 (사이드 아웃 때 시계 방향으로 한 칸)</div><div class="wrap2"><div class="sub" style="font-size:12.5px">${rot(0)}</div><div class="sub" style="font-size:12.5px">${rot(1)}</div></div>`; },
      subInfo(side) { const ok = st.phase !== 'rally' && st.subs[side] < 6; return {ok, text: `랠리 사이 · 세트당 6번 (남은 ${6 - st.subs[side]}번)`, why: st.phase === 'rally' ? '랠리 중에는 교체할 수 없어요' : '이번 세트 교체를 다 썼어요'}; },
      lineupState(side) { const r = SP.lineupStateOf(cfg, ents, side, null); r.on.forEach(o => { const e = team(side).find(x => x.slot === o.slot); o.pos = PN[e.rot]; o.note = `${st.pp[idx(e)].pts}점 · 디그 ${st.pp[idx(e)].dig}`; }); return r; },
      sub(side, slot, inIdx) { if (st.phase === 'rally') return {ok: false, msg: '랠리 중에는 교체할 수 없어요'}; if (st.subs[side] >= 6) return {ok: false, msg: '이번 세트 교체 6번을 다 썼어요'};
        const e = team(side).find(x => x.slot === slot); if (!e || ents.some(x => x.side === side && x.pi === inIdx)) return {ok: false, msg: '교체할 수 없는 선수예요'};
        const o = e.name; SP.doSwap(cfg, e, inIdx); e.atp = 1; st.pp[idx(e)] = {pts: 0, dig: 0}; st.subs[side]++; return {ok: true, msg: `${o} → ${e.name}`}; },
      result() { if (!st.end) return null; const s = st.sets; return {winner: s[0] > s[1] ? 0 : 1, score: `세트 ${s[0]} : ${s[1]}`, text: st.setLog.map(x => x.join(':')).join(', ')}; },
      dispose() {}
    };
    function hudInfo() { const me = cfg.me; if (cfg.sides[me] !== 'local') return '';
      if (st.phase === 'serveWait' && st.serve === me) return '서브: WASD로 노란 원 조준 · K를 꾹 눌렀다 놓기 (빨간 선 근처가 좋아요)';
      if (st.phase === 'rally') { const tr = ball.tr; if (!tr) return ''; if (tr.kind === 'set' && tr.side === me) return '공격수에게 토스! 공이 올 때 K = 스파이크 (방향키로 코스)'; if (tr.kind === 'pass' && tr.side === me) return '세터: J = 토스 (위/아래 방향키로 공격수 고르기)'; if (tr.side !== me && tr.kind === 'spike') return 'L = 블로킹 점프 · 받을 선수를 노란 원으로!'; if (tr.side !== me) return '노란 원으로 가서 J = 리시브'; }
      return ''; }
  }
})();
