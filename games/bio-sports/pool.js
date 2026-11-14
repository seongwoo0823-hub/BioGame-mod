/* 종목 5: 바이오 포켓볼 (8볼) — 1 대 1 · 브레이크 · 그람 양성균(1~7) vs 그람 음성균(9~15) · 8번 핵소체 · 스크래치=프리볼 · 8번 조기 투입=패배 · 30초 샷 타이머 · 드래그/키 조준 · 회전 · 파워 게이지 · 궤적 가이드 */
'use strict';
(function () {
  const L = 20, W = 10, R = 0.25, HX = L / 2, HZ = W / 2;
  const POCKETS = [[-HX - 0.05, -HZ - 0.05, 0.56], [0, -HZ - 0.22, 0.48], [HX + 0.05, -HZ - 0.05, 0.56], [-HX - 0.05, HZ + 0.05, 0.56], [0, HZ + 0.22, 0.48], [HX + 0.05, HZ + 0.05, 0.56]];
  const COL = ['#f4f4f8', '#f2c230', '#2a5ae0', '#e0322a', '#7a3ac8', '#f07a1a', '#1a9a4a', '#8a2a1a', '#15151a', '#f2c230', '#2a5ae0', '#e0322a', '#7a3ac8', '#f07a1a', '#1a9a4a', '#8a2a1a'];
  const SPIN = [['가운데', 0, 0], ['밀어치기 (팔로우)', 1, 0], ['끌어치기 (드로우)', -1, 0], ['왼쪽 회전', 0, -1], ['오른쪽 회전', 0, 1]];
  const grp = n => n >= 1 && n <= 7 ? 'solid' : n >= 9 && n <= 15 ? 'stripe' : null;
  const GN = {solid: '그람 양성균 (1~7)', stripe: '그람 음성균 (9~15)'};
  const S = SP.SPORTS.pool = {
    id: 'pool', name: '바이오 포켓볼', icon: '🎱', desc: '1 대 1 · 8볼 · 그람 양성균 vs 그람 음성균 · 핵소체 8번 · 30초 타이머', lineup: false, speed: false,
    options: [{key: 'guide', label: '궤적 가이드', def: 'full', choices: [['full', '길게 (연습용)'], ['short', '짧게 (실전)']]}, {key: 'timer', label: '샷 시간', def: 30, choices: [[30, '30초 (정규)'], [60, '60초 (여유)']]}],
    controls: '<kbd>A</kbd><kbd>D</kbd> 조준 · <kbd>W</kbd><kbd>S</kbd> 미세 조준 · 화면 드래그로 조준 · <kbd>K</kbd> 꾹 눌러 파워 → 놓으면 샷 · <kbd>J</kbd> 회전 바꾸기 · 프리볼일 때 <kbd>L</kbd> 공 옮기기 모드(WASD·드래그로 큐볼 이동) · <kbd>Tab</kbd> 현황',
    touch: {c: '큐볼<br>옮기기', a: '회전', b: '샷<br>(꾹)', t: '현황'},
    create
  };
  function ballTex(n) {
    return SP.canvasTex(256, 128, (g, w, h) => {
      const c = COL[n]; if (n === 0) { g.fillStyle = '#f8f8fc'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(200,120,200,.35)'; for (let i = 0; i < 14; i++) { g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 5 + Math.random() * 7, 0, 6.3); g.fill(); } g.fillStyle = '#c34a9a'; g.beginPath(); g.arc(w * 0.25, h / 2, 14, 0, 6.3); g.fill(); g.beginPath(); g.arc(w * 0.75, h / 2, 14, 0, 6.3); g.fill(); return; }
      if (n >= 9) { g.fillStyle = '#f8f8fc'; g.fillRect(0, 0, w, h); g.fillStyle = c; g.fillRect(0, h * 0.27, w, h * 0.46); } else { g.fillStyle = c; g.fillRect(0, 0, w, h); }
      if (n === 8) { g.fillStyle = '#3a2a5a'; for (let i = 0; i < 10; i++) { g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 4, 0, 6.3); g.fill(); } }
      for (const x of [w * 0.25, w * 0.75]) { g.fillStyle = '#fff'; g.beginPath(); g.arc(x, h / 2, 20, 0, 6.3); g.fill(); g.fillStyle = '#111'; g.font = '900 24px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), x, h / 2 + 1); }
    });
  }
  function create(cfg) {
    const D = cfg.diff, sc = SP.scene, TL = cfg.opts.timer || 30, guideLong = (cfg.opts.guide || 'full') === 'full';
    sc.background.set(0x1a1626);
    // 바닥·테이블 (배양 접시 한천 배지 펠트)
    const floorT = SP.canvasTex(512, 512, (g, w, h) => { g.fillStyle = '#3a2a3a'; g.fillRect(0, 0, w, h); for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) { g.fillStyle = (i + j) % 2 ? '#43304a' : '#3a2a40'; g.fillRect(i * 32, j * 32, 32, 32); } });
    const fl = SP.plane(80, 60, 0, floorT); fl.position.y = -3; sc.add(fl);
    const felt = SP.canvasTex(1024, 512, (g, w, h) => { g.fillStyle = '#1f8a7a'; g.fillRect(0, 0, w, h); const gr = g.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, w * 0.6); gr.addColorStop(0, 'rgba(255,255,255,.08)'); gr.addColorStop(1, 'rgba(0,0,0,.18)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.globalAlpha = 0.08; g.strokeStyle = '#fff'; g.lineWidth = 3; for (let k = 1; k < 6; k++) { g.beginPath(); g.arc(w * 0.75, h / 2, k * 40, 0, 6.3); g.stroke(); } g.globalAlpha = 1;
      g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(w * 0.25, 0); g.lineTo(w * 0.25, h); g.stroke(); g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.arc(w * 0.25, h / 2, 4, 0, 6.3); g.fill(); g.beginPath(); g.arc(w * 0.75, h / 2, 4, 0, 6.3); g.fill(); });
    const top = SP.plane(L, W, 0, felt); sc.add(top);
    const P = [];
    // 쿠션·나무 테두리
    P.push([0, -0.35, -HZ - 0.45, L + 0.5, 0.6, 0.5, '#1a6a5e'], [0, -0.35, HZ + 0.45, L + 0.5, 0.6, 0.5, '#1a6a5e'], [-HX - 0.45, -0.35, 0, 0.5, 0.6, W + 0.5, '#1a6a5e'], [HX + 0.45, -0.35, 0, 0.5, 0.6, W + 0.5, '#1a6a5e']);
    P.push([0, -0.5, -HZ - 1.0, L + 2.6, 0.75, 0.7, '#7a4a2a'], [0, -0.5, HZ + 1.0, L + 2.6, 0.75, 0.7, '#7a4a2a'], [-HX - 1.0, -0.5, 0, 0.7, 0.75, W + 2.6, '#7a4a2a'], [HX + 1.0, -0.5, 0, 0.7, 0.75, W + 2.6, '#7a4a2a']);
    P.push([0, -1.6, 0, L + 2, 1.1, W + 2, '#5a3420']); for (const [x, z] of [[-HX, -HZ], [HX, -HZ], [-HX, HZ], [HX, HZ]]) P.push([x * 0.9, -3, z * 0.85, 1.0, 1.6, 1.0, '#4a2a18']);
    for (let i = -3; i <= 3; i++) if (i) { P.push([i * 2.5, 0.26, -HZ - 1.0, 0.18, 0.04, 0.18, '#ffe6a0'], [i * 2.5, 0.26, HZ + 1.0, 0.18, 0.04, 0.18, '#ffe6a0']); }
    sc.add(SP.vox(P));
    for (const [x, z, r] of POCKETS) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.8, 0.5, 18), new THREE.MeshBasicMaterial({color: 0x050508})); m.position.set(x, -0.2, z); sc.add(m); }
    // 공
    const balls = []; const geo = new THREE.SphereGeometry(R, 24, 16);
    for (let n = 0; n < 16; n++) { const m = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({map: ballTex(n), shininess: 90})); m.castShadow = true; sc.add(m); balls.push({n, x: 0, z: 0, vx: 0, vz: 0, on: true, m}); }
    const cue = balls[0];
    // 큐대·가이드
    const stick = SP.vox([[0, 0, -4.4, 0.09, 0.09, 8.6, '#d8b07a'], [0, 0, -0.08, 0.1, 0.1, 0.16, '#3a8ae8'], [0, 0, -8.4, 0.13, 0.13, 1.0, '#2a1a10']], true); sc.add(stick);
    const lineG = new THREE.BufferGeometry(); lineG.setAttribute('position', new THREE.Float32BufferAttribute(new Array(18).fill(0), 3));
    const guide = new THREE.LineSegments(lineG, new THREE.LineBasicMaterial({color: 0xffffff, transparent: true, opacity: 0.85})); sc.add(guide);
    const ghost = new THREE.Mesh(new THREE.RingGeometry(R * 0.9, R, 24), new THREE.MeshBasicMaterial({color: 0xffffff, transparent: true, opacity: 0.7, side: THREE.DoubleSide})); ghost.rotation.x = -Math.PI / 2; sc.add(ghost);
    const handRing = new THREE.Mesh(new THREE.RingGeometry(R * 1.3, R * 1.6, 24), new THREE.MeshBasicMaterial({color: 0xffe066, side: THREE.DoubleSide})); handRing.rotation.x = -Math.PI / 2; sc.add(handRing);
    const pname = sd => { const ro = SP.roster(cfg.teams[sd]).slice().sort((a, b) => b.st.bal - a.st.bal); return ro[0].name; };
    const st = {turn: Math.random() < 0.5 ? 0 : 1, group: [null, null], phase: 'aim', aim: 0, power: 0, charging: false, chargeT: 0, spin: 0, inHand: true, kitchen: true, moveMode: false, timer: TL, broke: false, shots: [0, 0], fouls: [0, 0], potted: [[], []], end: false, winner: -1, why: '', info: null, aiT: 0, aiPlan: null, simT: 0, msgT: 0, names: [pname(0), pname(1)]};
    const EV = SP.makeEvents(fire); const ev = (t, d) => EV.emit(t, d);
    function fire(e) { const A = SP.audio; if (e.type === 'clack') A.clack(e.v); if (e.type === 'pocket') A.pocket(); if (e.type === 'cue') A.clack(0.2); if (e.type === 'rail') A.bounce(); if (e.type === 'msg') SP.toast(e.text, e.sub || '', e.ms || 1400); if (e.type === 'win') { A.fanfare(); A.cheer(); } if (e.type === 'whistle') A.whistle(1); }
    function rack() {
      const order = [1, 9, 2, 10, 8, 3, 11, 4, 12, 5, 13, 6, 14, 7, 15]; // 자리 고정: 가운데 8, 뒤 모서리는 양성/음성 하나씩
      const others = [2, 3, 4, 5, 6, 7, 10, 11, 12, 13, 14, 15].sort(() => Math.random() - 0.5);
      let k = 0; const fx = HX / 2, dx = R * 2 * Math.cos(Math.PI / 6) + 0.003;
      const pos = []; for (let row = 0; row < 5; row++) for (let j = 0; j <= row; j++) pos.push([fx + row * dx, (j - row / 2) * (R * 2 + 0.003)]);
      const fixed = {0: 1, 4: 8, 10: 9, 14: 7}; // 꼭짓점 1번, 가운데 8번, 뒤 두 모서리
      pos.forEach((p, i) => { const n = fixed[i] != null ? fixed[i] : others[k++]; const b = balls[n]; b.x = p[0]; b.z = p[1]; b.vx = b.vz = 0; b.on = true; });
      cue.x = -HX / 2; cue.z = 0; cue.on = true; cue.vx = cue.vz = 0;
    }
    rack();
    ev('msg', {text: `${SP.TEAMS[cfg.teams[st.turn]].name} 브레이크`, sub: '큐볼을 왼쪽 구역 안에서 옮길 수 있어요', ms: 1800});
    const moving = () => balls.some(b => b.on && (b.vx || b.vz));
    // ---------- 물리 ----------
    let shot = null;
    function strike(power, aim, spin) {
      const v = 6 + power * 30; cue.vx = Math.cos(aim) * v; cue.vz = Math.sin(aim) * v;
      shot = {first: null, potted: [], rail: false, scratch: false, spin: SPIN[spin], firstHitDone: false, sideUsed: false, aim, v, brk: !st.broke};
      st.phase = 'roll'; st.simT = 0; st.inHand = false; st.moveMode = false; st.shots[st.turn]++; ev('cue'); st.power = 0; st.charging = false;
    }
    function physics(dt) {
      const sub = 6, h = dt / sub;
      for (let s = 0; s < sub; s++) {
        for (const b of balls) { if (!b.on) continue; const sp = Math.hypot(b.vx, b.vz); if (!sp) continue; const dec = (2.4 + 0.12 * sp) * h; if (sp <= dec) { b.vx = b.vz = 0; continue; } b.vx *= (sp - dec) / sp; b.vz *= (sp - dec) / sp; b.x += b.vx * h; b.z += b.vz * h; b.m.rotateOnWorldAxis(new THREE.Vector3(b.vz, 0, -b.vx).normalize(), sp * h / R); }
        // 공끼리
        for (let i = 0; i < 16; i++) { const a = balls[i]; if (!a.on) continue; for (let j = i + 1; j < 16; j++) { const b = balls[j]; if (!b.on) continue; let dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz); if (d >= 2 * R || d === 0) continue;
          const nx = dx / d, nz = dz / d, rv = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz; const ov = (2 * R - d) / 2; a.x -= nx * ov; a.z -= nz * ov; b.x += nx * ov; b.z += nz * ov; if (rv <= 0) continue;
          const imp = rv * 0.97; a.vx -= imp * nx; a.vz -= imp * nz; b.vx += imp * nx; b.vz += imp * nz; ev('clack', {v: Math.min(0.25, rv / 60)});
          if (shot && (a === cue || b === cue)) { const o = a === cue ? b : a; if (!shot.first) shot.first = o.n; if (!shot.firstHitDone) { shot.firstHitDone = true; const sp = shot.spin, f = sp[1]; if (f) { const k = f > 0 ? 0.32 : 0.45; cue.vx += Math.cos(shot.aim) * rv * k * f; cue.vz += Math.sin(shot.aim) * rv * k * f; } } } } }
        // 포켓·쿠션
        for (const b of balls) { if (!b.on) continue;
          for (const [px, pz, pr] of POCKETS) if (Math.hypot(b.x - px, b.z - pz) < pr) { b.on = false; b.vx = b.vz = 0; ev('pocket'); if (shot) { if (b === cue) shot.scratch = true; else shot.potted.push(b.n); } break; }
          if (!b.on) continue;
          const nearCorner = Math.abs(b.x) > HX - 0.75 && Math.abs(b.z) > HZ - 0.75, nearSide = Math.abs(b.x) < 0.55 && Math.abs(b.z) > HZ - 0.6;
          if (!nearCorner && !nearSide) {
            if (Math.abs(b.x) > HX - R) { b.x = Math.sign(b.x) * (HX - R); b.vx = -b.vx * 0.76; b.vz *= 0.94; railHit(b, 'x'); }
            if (Math.abs(b.z) > HZ - R) { b.z = Math.sign(b.z) * (HZ - R); b.vz = -b.vz * 0.76; b.vx *= 0.94; railHit(b, 'z'); } }
          else { if (Math.abs(b.x) > HX + 0.4) { b.x = Math.sign(b.x) * (HX + 0.4); b.vx = -b.vx * 0.3; } if (Math.abs(b.z) > HZ + 0.4) { b.z = Math.sign(b.z) * (HZ + 0.4); b.vz = -b.vz * 0.3; } }
        }
      }
    }
    function railHit(b, ax) { if (Math.hypot(b.vx, b.vz) > 1.5) ev('rail'); if (!shot) return; if (shot.first != null || b !== cue) shot.rail = true;
      if (b === cue && !shot.sideUsed && shot.spin[2]) { shot.sideUsed = true; const sp = Math.hypot(b.vx, b.vz), s = shot.spin[2] * sp * 0.22; if (ax === 'x') b.vz += s * Math.sign(b.vx || 1); else b.vx -= s * Math.sign(b.vz || 1); } }
    // ---------- 규칙 판정 ----------
    function own(p) { return st.group[p]; }
    function remaining(g) { return balls.filter(b => b.on && grp(b.n) === g).length; }
    function judge() {
      const p = st.turn, o = 1 - p, sh = shot, g = own(p), wasBreak = sh.brk; st.broke = true;
      const groupClear = g && remaining(g) === 0 && !sh.potted.some(n => grp(n) === g) ? true : (g ? remaining(g) + sh.potted.filter(n => grp(n) === g).length === 0 : false);
      let foul = '', lost = '';
      if (sh.scratch) foul = '스크래치 (큐볼이 포켓에)';
      else if (sh.first == null) foul = '공을 하나도 못 맞혔어요';
      else if (g && !groupClear && grp(sh.first) !== g) foul = `자기 공(${g === 'solid' ? '1~7' : '9~15'})을 먼저 맞혀야 해요`;
      else if (g && groupClear && sh.first !== 8) foul = '8번을 먼저 맞혀야 해요';
      else if (!g && sh.first === 8 && !wasBreak) foul = '오픈 테이블에서 8번을 먼저 맞혔어요';
      else if (!wasBreak && !sh.potted.length && !sh.rail) foul = '맞힌 뒤 쿠션에 닿은 공이 없어요';
      sh.potted.forEach(n => { if (n !== 8) { const who = st.group[p] ? (grp(n) === st.group[p] ? p : o) : p; st.potted[who].push(n); } });
      if (sh.potted.includes(8)) {
        if (wasBreak) { const b = balls[8]; b.on = true; b.x = HX / 2; b.z = 0; for (const q of balls) if (q !== b && q.on && Math.hypot(q.x - b.x, q.z - b.z) < 2 * R) { b.x += 2 * R + 0.02; } ev('msg', {text: '브레이크에서 8번 투입', sub: '핵소체를 제자리에 다시 놓아요', ms: 1400}); }
        else if (foul) lost = '8번을 넣으면서 반칙';
        else if (!groupClear) lost = '8번(핵소체)을 너무 일찍 넣었어요';
        else { finish(p, '🎱 8번(핵소체) 투입 성공!'); return; }
      }
      if (lost) { finish(o, lost); return; }
      // 그룹 정하기
      if (!g && !foul && !wasBreak) { const f = sh.potted.find(n => n !== 8); if (f) { st.group[p] = grp(f); st.group[o] = grp(f) === 'solid' ? 'stripe' : 'solid'; ev('msg', {text: `${SP.TEAMS[cfg.teams[p]].name}: ${GN[st.group[p]]}`, sub: `상대는 ${GN[st.group[o]]}`, ms: 1800}); } }
      const g2 = own(p), good = !foul && (wasBreak ? sh.potted.some(n => n !== 8) : g2 ? sh.potted.some(n => grp(n) === g2) : sh.potted.some(n => n !== 8));
      if (foul) { st.fouls[p]++; ev('whistle'); ev('msg', {text: '반칙! ' + foul, sub: `${SP.TEAMS[cfg.teams[o]].name} 프리볼 (큐볼을 원하는 곳에)`, ms: 2000}); nextTurn(o, true); return; }
      if (good) { ev('msg', {text: '계속 치기!', sub: sh.potted.filter(n => n !== 8).map(n => n + '번').join(', ') + ' 투입', ms: 1000}); nextTurn(p, false); return; }
      nextTurn(o, false);
    }
    function nextTurn(p, inHand) {
      st.turn = p; st.phase = 'aim'; st.timer = TL; st.inHand = inHand; st.kitchen = false; st.moveMode = inHand; st.aiT = 0; st.aiPlan = null; shot = null; st.power = 0; st.charging = false;
      if (inHand && !cue.on) { cue.on = true; cue.vx = cue.vz = 0; placeFree(-HX / 2, 0); }
      if (!inHand && !cue.on) { cue.on = true; placeFree(-HX / 2, 0); }
      st.aim = aimToNearest(p);
    }
    function finish(w, why) { st.end = true; st.winner = w; st.why = why; st.phase = 'end'; ev('win'); ev('msg', {text: why, sub: `${SP.TEAMS[cfg.teams[w]].name} 승리!`, ms: 2600}); }
    function validSpot(x, z) { if (Math.abs(x) > HX - R || Math.abs(z) > HZ - R) return false; if (st.kitchen && x > -HX / 2) return false; for (const b of balls) if (b !== cue && b.on && Math.hypot(b.x - x, b.z - z) < 2 * R + 0.01) return false; return true; }
    function placeFree(x, z) { for (let r = 0; r < 8; r += 0.3) for (let a = 0; a < 6.3; a += 0.5) { const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; if (validSpot(px, pz)) { cue.x = px; cue.z = pz; return; } } }
    function aimToNearest(p) { const g = own(p); let best = null, bd = 1e9; for (const b of balls) { if (!b.on || b === cue) continue; if (g && grp(b.n) !== g && !(remaining(g) === 0 && b.n === 8)) continue; if (!g && b.n === 8) continue; const d = Math.hypot(b.x - cue.x, b.z - cue.z); if (d < bd) { bd = d; best = b; } } return best ? Math.atan2(best.z - cue.z, best.x - cue.x) : 0; }
    // ---------- AI ----------
    function clearPath(ax, az, bx, bz, skip) { const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz; for (const b of balls) { if (!b.on || skip.includes(b)) continue; const t = SP.clamp(((b.x - ax) * dx + (b.z - az) * dz) / (L2 || 1), 0, 1); if (Math.hypot(ax + dx * t - b.x, az + dz * t - b.z) < 2 * R - 0.01) return false; } return true; }
    function bestShot(cx, cz, p) {
      const g = own(p), targets = balls.filter(b => b.on && b !== cue && (g ? (grp(b.n) === g || (remaining(g) === 0 && b.n === 8)) : b.n !== 8));
      let best = null;
      for (const t of targets) for (const [px, pz] of POCKETS) {
        const tpx = px - t.x, tpz = pz - t.z, dtp = Math.hypot(tpx, tpz), ux = tpx / dtp, uz = tpz / dtp, gx = t.x - ux * 2 * R, gz = t.z - uz * 2 * R;
        const cgx = gx - cx, cgz = gz - cz, dcg = Math.hypot(cgx, cgz); if (dcg < 0.05) continue; const cut = Math.acos(SP.clamp((cgx * ux + cgz * uz) / dcg, -1, 1)); if (cut > 1.35) continue;
        const fake = {x: cx, z: cz}; if (!clearPath(cx, cz, gx, gz, [cue, t])) continue; if (!clearPath(t.x, t.z, px, pz, [t, cue])) continue;
        const score = Math.cos(cut) * 3 - dcg * 0.06 - dtp * 0.09 + (Math.abs(pz) > HZ && Math.abs(px) < 1 ? -0.4 * (1 - Math.abs(uz)) : 0);
        if (!best || score > best.score) best = {score, aim: Math.atan2(cgz, cgx), power: SP.clamp(0.1 + (dcg + dtp * 1.5) / (44 * Math.max(0.4, Math.cos(cut))), 0.14, 0.7), t: t.n};
      }
      return best;
    }
    function aiThink() {
      const p = st.turn, lvl = D;
      if (!st.broke) return {aim: Math.atan2((Math.random() - 0.5) * 0.08, HX / 2 - cue.x), power: 0.92 + Math.random() * 0.08, spin: 0};
      if (st.inHand) { let bp = null, bs = -1e9; for (let i = 0; i < 60; i++) { const x = (Math.random() * 2 - 1) * (HX - 0.6), z = (Math.random() * 2 - 1) * (HZ - 0.6); if (!validSpot(x, z)) continue; const s = bestShot(x, z, p); if (s && s.score > bs) { bs = s.score; bp = [x, z]; } } if (bp) { cue.x = bp[0]; cue.z = bp[1]; } }
      const s = bestShot(cue.x, cue.z, p);
      const noise = [0.035, 0.016, 0.006][lvl] || 0.016;
      if (s) return {aim: s.aim + (Math.random() - .5) * 2 * noise, power: s.power * (0.9 + Math.random() * 0.2), spin: Math.random() < 0.45 ? 2 : 0};
      return {aim: aimToNearest(p) + (Math.random() - .5) * noise, power: 0.35, spin: 0}; // 안전하게 맞히기
    }
    // ---------- 프레임 ----------
    function step(dt, ins) {
      if (st.end) return;
      if (st.phase === 'roll') { physics(dt); st.simT += dt; if (!moving() || st.simT > 14) { balls.forEach(b => { b.vx = b.vz = 0; }); judge(); } return; }
      const p = st.turn, i = ins[p];
      st.timer -= dt; if (st.timer <= 0) { st.fouls[p]++; ev('whistle'); ev('msg', {text: '⏱ 시간 초과 반칙', sub: `${SP.TEAMS[cfg.teams[1 - p]].name} 프리볼`, ms: 1800}); nextTurn(1 - p, true); return; }
      if (!i) { // AI
        st.aiT += dt; if (!st.aiPlan && st.aiT > 0.5) st.aiPlan = aiThink();
        if (st.aiPlan) { let da = st.aiPlan.aim - st.aim; da = Math.atan2(Math.sin(da), Math.cos(da)); st.aim += da * Math.min(1, dt * 4); st.spin = st.aiPlan.spin;
          if (st.aiT > 1.4) { st.power = Math.min(st.aiPlan.power, st.power + dt * 1.2); st.charging = true; if (st.power >= st.aiPlan.power - 0.001) strike(st.aiPlan.power, st.aiPlan.aim, st.aiPlan.spin); } }
        return; }
      // 사람
      if (i.a) { st.spin = (st.spin + 1) % SPIN.length; ev('msg', {text: '회전: ' + SPIN[st.spin][0], ms: 700}); }
      if (i.c && st.inHand) st.moveMode = !st.moveMode;
      const ex = i.ext || {};
      if (ex.place && st.inHand && !st.charging) { const [x, z] = ex.place; if (validSpot(x, z)) { cue.x = x; cue.z = z; } }
      if (ex.aim != null && !st.charging) st.aim = ex.aim;
      if (st.inHand && st.moveMode && !st.charging) { const nx = cue.x + i.mx * dt * 4, nz = cue.z + i.my * dt * 4; if (validSpot(nx, nz)) { cue.x = nx; cue.z = nz; } }
      else if (!st.charging) { st.aim += i.mx * dt * 1.3; st.aim -= i.my * dt * 0.12; }
      if (i.hb) { st.charging = true; st.chargeT += dt; const ph = (st.chargeT / 1.3) % 2; st.power = ph < 1 ? ph : 2 - ph; }
      else if (st.charging) { const pw = Math.max(0.05, st.power); st.chargeT = 0; strike(pw, st.aim, st.spin); }
    }
    // 마우스·터치 조준
    SP.onPointer = (kind, e) => {
      if (st.phase !== 'aim' || cfg.sides[st.turn] === 'ai' || (cfg.sides[st.turn] === 'remote') || st.turn !== cfg.me) return;
      const g = SP.groundAt(e.clientX, e.clientY, 0); if (!g) return;
      if (kind === 'down') st.dragCue = st.inHand && Math.hypot(g.x - cue.x, g.z - cue.z) < 0.8;
      if (kind === 'up') { st.dragCue = false; return; }
      if (kind === 'move' && !SP.mouse.down) return;
      SP.input.ext = SP.input.ext || {};
      if (st.dragCue) SP.input.ext.place = [g.x, g.z]; else SP.input.ext.aim = Math.atan2(g.z - cue.z, g.x - cue.x);
    };
    SP.onWheel = dy => { if (st.turn === cfg.me) { SP.input.ext = SP.input.ext || {}; SP.input.ext.aim = st.aim + dy * 0.0006; } };
    function trace() { // 가이드: 큐볼이 처음 닿는 공·쿠션
      const dx = Math.cos(st.aim), dz = Math.sin(st.aim); let best = null, bt = 60;
      for (const b of balls) { if (!b.on || b === cue) continue; const ox = b.x - cue.x, oz = b.z - cue.z, t = ox * dx + oz * dz; if (t <= 0) continue; const d2 = ox * ox + oz * oz - t * t; if (d2 > 4 * R * R) continue; const th = t - Math.sqrt(4 * R * R - d2); if (th < bt) { bt = th; best = b; } }
      let tw = 60; if (dx) tw = Math.min(tw, ((dx > 0 ? HX - R : -HX + R) - cue.x) / dx); if (dz) tw = Math.min(tw, ((dz > 0 ? HZ - R : -HZ + R) - cue.z) / dz);
      if (best && bt < tw) { const gx = cue.x + dx * bt, gz = cue.z + dz * bt, nx = best.x - gx, nz = best.z - gz, nl = Math.hypot(nx, nz); return {gx, gz, ball: best, ox: nx / nl, oz: nz / nl}; }
      return {gx: cue.x + dx * tw, gz: cue.z + dz * tw, ball: null};
    }
    function view(dt) {
      const me = cfg.me, myTurn = st.turn === me && cfg.sides[me] === 'local';
      for (const b of balls) { b.m.visible = b.on; b.m.position.set(b.x, R, b.z); }
      const aiming = st.phase === 'aim';
      stick.visible = aiming && cue.on; guide.visible = ghost.visible = aiming && cue.on && (myTurn || cfg.sides[st.turn] !== 'local');
      handRing.visible = aiming && st.inHand && myTurn; handRing.position.set(cue.x, 0.02, cue.z); handRing.material.color.set(st.moveMode ? 0xffe066 : 0x88ccff);
      if (aiming) {
        const back = 0.35 + st.power * 1.6; stick.position.set(cue.x - Math.cos(st.aim) * back, R + 0.15, cue.z - Math.sin(st.aim) * back); stick.rotation.set(0, Math.PI / 2 - st.aim, 0); stick.rotateX(-0.08);
        const tr = trace(), pos = lineG.attributes.position.array, k = guideLong ? 1 : 0.45;
        pos.set([cue.x, 0.06, cue.z, cue.x + (tr.gx - cue.x) * (guideLong ? 1 : Math.min(1, 3 / Math.max(0.01, Math.hypot(tr.gx - cue.x, tr.gz - cue.z)))), 0.06, cue.z + (tr.gz - cue.z) * (guideLong ? 1 : Math.min(1, 3 / Math.max(0.01, Math.hypot(tr.gx - cue.x, tr.gz - cue.z))))], 0);
        if (tr.ball && guideLong) { pos.set([tr.ball.x, 0.06, tr.ball.z, tr.ball.x + tr.ox * 3 * k, 0.06, tr.ball.z + tr.oz * 3 * k], 6); const tx = -tr.oz, tz = tr.ox, sgn = Math.sign(Math.cos(st.aim) * tx + Math.sin(st.aim) * tz) || 1; pos.set([tr.gx, 0.06, tr.gz, tr.gx + tx * sgn * 1.6 * k, 0.06, tr.gz + tz * sgn * 1.6 * k], 12); }
        else pos.fill(0, 6);
        lineG.attributes.position.needsUpdate = true; ghost.position.set(tr.gx, 0.04, tr.gz);
      }
      const persp = SP.cam.mode === 'persp';
      SP.camTo(persp ? {x: 0, y: 0, z: 0.2, dist: 1.4, h: 15.5, yaw: 0} : {x: 0, y: 0, z: 0, dist: 16, h: 10, yaw: 0});
      SP.gauge(aiming && (st.charging) && (myTurn || cfg.sides[st.turn] === 'ai') ? st.power : null, null);
    }
    return {
      step, view,
      snap() { return {b: balls.map(b => [Math.round(b.x * 1000) / 1000, Math.round(b.z * 1000) / 1000, b.on ? 1 : 0]), s: [st.turn, st.group, st.phase, Math.round(st.aim * 1000) / 1000, Math.round(st.power * 100) / 100, st.charging, st.spin, st.inHand, st.moveMode, Math.ceil(st.timer), st.broke, st.shots, st.fouls, st.potted, st.end, st.winner, st.why, st.kitchen], ev: EV.recent()}; },
      apply(s) { s.b.forEach((a, i) => { const b = balls[i]; const dx = a[0] - b.x, dz = a[1] - b.z, d = Math.hypot(dx, dz); if (d > 0.001 && d < 2) b.m.rotateOnWorldAxis(new THREE.Vector3(dz, 0, -dx).normalize(), d / R); b.x = a[0]; b.z = a[1]; b.on = !!a[2]; });
        [st.turn, st.group, st.phase, st.aim, st.power, st.charging, st.spin, st.inHand, st.moveMode, st.timer, st.broke, st.shots, st.fouls, st.potted, st.end, st.winner, st.why, st.kitchen] = s.s; EV.ingest(s.ev); },
      buttons(me) { if (st.phase !== 'aim' || st.turn !== me) return {move: false}; return {b: '샷<br><small>꾹</small>', a: '회전', c: st.inHand ? (st.moveMode ? '조준<br>모드' : '큐볼<br>옮기기') : null}; },
      hud() { const T = cfg.teams.map(i => SP.TEAMS[i]); const left = sd => st.group[sd] ? remaining(st.group[sd]) : 7;
        const g = st.group, gtxt = g[0] ? `${g[0] === 'solid' ? '●양성' : '◐음성'} vs ${g[1] === 'solid' ? '●양성' : '◐음성'}` : '오픈 테이블';
        return {score: {a: {name: `${T[0].name}`, c1: T[0].c1, pts: 7 - left(0)}, b: {name: `${T[1].name}`, c1: T[1].c1, pts: 7 - left(1)}, sub: `${gtxt} · ${st.turn === 0 ? '◀' : '▶'} ${SP.TEAMS[cfg.teams[st.turn]].name} 차례`, clock: st.phase === 'aim' ? `⏱ ${Math.max(0, Math.ceil(st.timer))}` : '🎱'}, info: hudInfo(), extra: trackHtml()}; },
      status() { const T = cfg.teams.map(i => SP.TEAMS[i]); const row = (l, x, y) => `<tr><td style="text-align:right"><b>${x}</b></td><td style="text-align:center;color:#c3d0ea">${l}</td><td><b>${y}</b></td></tr>`;
        const gl = sd => st.group[sd] ? GN[st.group[sd]] : '아직 안 정해짐';
        const rem = sd => st.group[sd] ? balls.filter(b => b.on && grp(b.n) === st.group[sd]).map(b => b.n).join(', ') || '모두 넣음 → 8번!' : '-';
        return `<table class="rt"><tr><th style="text-align:right">${SP.esc(T[0].name)} · ${SP.esc(st.names[0])}</th><th style="text-align:center">항목</th><th>${SP.esc(T[1].name)} · ${SP.esc(st.names[1])}</th></tr>${row('공 그룹', gl(0), gl(1))}${row('넣은 공', st.potted[0].join(', ') || '-', st.potted[1].join(', ') || '-')}${row('남은 공', rem(0), rem(1))}${row('샷 수', st.shots[0], st.shots[1])}${row('반칙', st.fouls[0], st.fouls[1])}</table>
          <p class="sub">규칙: 브레이크 뒤 처음 넣은 공으로 그룹이 정해져요. 자기 공을 넣으면 계속, 스크래치·헛치기·남의 공 먼저 맞히기·쿠션 미접촉·시간 초과는 반칙(상대 프리볼). 자기 공을 다 넣고 8번(핵소체)을 넣으면 승리, 먼저 넣으면 패배!</p>`; },
      result() { if (!st.end) return null; return {winner: st.winner, score: `${15 - balls.filter(b => b.on && b.n).length}개 투입`, text: st.why}; },
      dispose() { SP.onPointer = null; SP.onWheel = null; }
    };
    function trackHtml() { // 남은 공 표시 (내 그룹 · 상대 그룹 · 8번)
      const ball = n => `<i style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;margin-right:3px;font:900 9.5px sans-serif;color:#111;background:${n >= 9 ? `linear-gradient(#f8f8fc 28%,${COL[n]} 28% 72%,#f8f8fc 72%)` : COL[n]};${balls[n].on ? '' : 'opacity:.18;'}box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.5)"><b style="background:#fff;border-radius:50%;width:11px;height:11px;line-height:11px;text-align:center">${n}</b></i>`;
      const row = (sd) => { const g = st.group[sd], ns = g === 'solid' ? [1, 2, 3, 4, 5, 6, 7] : g === 'stripe' ? [9, 10, 11, 12, 13, 14, 15] : null; return `<div style="display:flex;align-items:center;gap:6px;margin:2px 0"><span style="width:56px;font-size:11px;color:${st.turn === sd ? '#ffd25e' : '#c3d0ea'}">${st.turn === sd ? '▶ ' : ''}${SP.esc(SP.TEAMS[cfg.teams[sd]].name)}</span>${ns ? ns.map(ball).join('') : '<span style="font-size:11px;color:#c3d0ea">그룹 미정</span>'}</div>`; };
      return row(0) + row(1) + `<div style="font-size:11px;color:#c3d0ea;margin-top:2px">8번 핵소체 ${ball(8)} · 회전 ${SPIN[st.spin][0]}</div>`; }
    function hudInfo() { const me = cfg.me; if (cfg.sides[me] !== 'local' || st.turn !== me || st.phase !== 'aim') return st.phase === 'aim' && st.turn !== me ? '상대 차례예요' : '';
      return st.inHand && st.moveMode ? '🟡 프리볼 · 큐볼을 끌어서 놓을 곳에 두세요' : `화면을 끌어 조준 · <b>샷</b>을 꾹 눌렀다 놓기${st.inHand ? ' · 프리볼' : ''}`; }
  }
})();
