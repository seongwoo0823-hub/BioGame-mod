/* 게임 4: 순환계 혈류 윷놀이 — 전통 윷놀이 규칙 (29칸 · 지름길 · 업기 · 잡기 · 빽도 · 윷/모 한 번 더) */
'use strict';
BB.GAMES = BB.GAMES || {};
(function () {
  const TAU = Math.PI * 2;
  const NAMES = ['도', '개', '걸', '윷', '모'];
  const RES = {'-1': ['빽도', '판막 역류 · 1칸 뒤로'], 1: ['도', '확산 · 1칸'], 2: ['개', '삼투 · 2칸'], 3: ['걸', '촉진 확산 · 3칸'], 4: ['윷', '능동 수송 · 4칸 + 한 번 더'], 5: ['모', '도약 전도 · 5칸 + 한 번 더']};
  const RES_INFO = {
    '-1': ['빽도 (판막 역류)', '심장과 정맥의 판막은 피가 거꾸로 흐르지 못하게 막아요. 판막이 고장 나면 역류가 생겨요. 1칸 뒤로!'],
    1: ['도 (확산)', '물질이 농도가 높은 곳에서 낮은 곳으로 저절로 퍼지는 현상. 에너지가 필요 없어요.'],
    2: ['개 (삼투)', '반투과성 막을 사이에 두고 물이 농도가 낮은 쪽에서 높은 쪽(용질이 많은 쪽)으로 이동해요.'],
    3: ['걸 (촉진 확산)', '막의 운반체·통로 단백질을 통해 농도 차를 따라 이동해요. 포도당이 세포로 들어갈 때처럼요.'],
    4: ['윷 (능동 수송)', 'ATP를 써서 농도 차를 거슬러 운반해요(Na⁺-K⁺ 펌프). 4칸 + 한 번 더 던지기!'],
    5: ['모 (도약 전도)', '말이집 신경에서는 흥분이 랑비에 결절을 건너뛰며 빠르게 전도돼요. 5칸 + 한 번 더 던지기!']
  };
  // 29개 혈관 노드 좌표 (0 = 출발/도착, 반시계 방향으로 돎)
  const S = 2.4, P = [];
  for (let k = 0; k < 20; k++) {
    if (k <= 5) P[k] = [5, 5 - 2 * k];
    else if (k <= 10) P[k] = [5 - 2 * (k - 5), -5];
    else if (k <= 15) P[k] = [-5, -5 + 2 * (k - 10)];
    else P[k] = [-5 + 2 * (k - 15), 5];
  }
  const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  P[20] = lerp2(P[5], [0, 0], 1 / 3); P[21] = lerp2(P[5], [0, 0], 2 / 3); P[22] = [0, 0]; P[23] = lerp2([0, 0], P[15], 1 / 3); P[24] = lerp2([0, 0], P[15], 2 / 3);
  P[25] = lerp2(P[10], [0, 0], 1 / 3); P[26] = lerp2(P[10], [0, 0], 2 / 3); P[27] = lerp2([0, 0], P[0], 1 / 3); P[28] = lerp2([0, 0], P[0], 2 / 3);
  const POS = P.map(p => [p[0] * S / 2 * 1.0, p[1] * S / 2 * 1.0]);
  const NODE = [
    ['대정맥 · 우심방', '출발점이자 도착점. 온몸을 돈 혈액이 대정맥을 거쳐 우심방으로 돌아와요. 이 칸을 지나가야 완주!'],
    ['우심실', '우심실은 혈액을 폐로 보내요. 폐까지만 보내면 되어서 좌심실보다 벽이 얇아요.'],
    ['폐동맥판', '우심실과 폐동맥 사이의 판막. 혈액이 우심실로 되돌아오지 않게 막아요.'],
    ['폐동맥', '동맥이지만 산소가 적은 정맥혈이 흘러요!'],
    ['폐동맥 가지', '폐동맥은 좌우 폐로 갈라져 들어가요.'],
    ['폐동맥 분기점', '모서리 분기점! 여기에 딱 멈추면 대각선 지름길(관상 순환 길)로 들어갈 수 있어요.'],
    ['폐 모세혈관', '폐포를 감싼 모세혈관에서 산소가 혈액으로 확산돼요.'],
    ['폐포', '지름 약 0.2mm의 공기주머니. 수억 개라 기체 교환 면적이 아주 넓어요.'],
    ['폐정맥', '정맥이지만 산소가 많은 동맥혈이 흘러요! 좌심방으로 들어가요.'],
    ['좌심방', '폐에서 돌아온 혈액을 받아 좌심실로 보내요.'],
    ['대동맥궁 분기점', '모서리 분기점! 여기에 딱 멈추면 중앙을 가로지르는 최단 지름길로 들어갈 수 있어요.'],
    ['하행 대동맥', '대동맥은 몸에서 가장 굵은 동맥. 혈압이 높아 벽이 두껍고 탄력이 있어요.'],
    ['복부 대동맥', '소화 기관과 콩팥으로 가는 동맥이 여기서 갈라져요.'],
    ['콩팥 동맥', '콩팥에서 혈액 속 노폐물(요소)을 걸러 오줌을 만들어요.'],
    ['넙다리 동맥', '다리로 가는 큰 동맥이에요.'],
    ['발끝 모세혈관', '모세혈관은 세포 한 층으로 된 벽이라 조직 세포와 물질 교환이 잘 돼요.'],
    ['넙다리 정맥', '정맥은 혈압이 낮아서 판막이 있어 역류를 막아요.'],
    ['엉덩 정맥', '다리 근육이 정맥을 눌러 주면 혈액이 심장 쪽으로 올라가요.'],
    ['하대정맥', '하반신의 혈액을 모아 우심방으로 보내는 큰 정맥이에요.'],
    ['우심방 입구', '거의 다 왔어요! 우심방으로 들어가요.'],
    ['관상동맥', '심장 근육 자신에게 산소를 공급하는 동맥. 막히면 심근경색이 생겨요.'],
    ['심근 모세혈관', '쉬지 않고 뛰는 심장 근육 세포에 산소와 영양소를 줘요.'],
    ['심장 판막 · 간문맥 허브', '중앙 교차점! 여기에 딱 멈추면 대정맥(도착점)으로 바로 가는 최단 길이 열려요.'],
    ['간문맥', '소장에서 흡수한 영양소를 실은 혈액이 간으로 먼저 가는 길이에요.'],
    ['간 모세혈관', '간은 포도당을 글리코젠으로 저장하고 해독 작용을 해요.'],
    ['경동맥', '뇌로 가는 동맥. 목에서 맥박을 느낄 수 있어요.'],
    ['뇌 모세혈관', '뇌는 혈액뇌장벽으로 아무 물질이나 들어가지 못하게 막아요.'],
    ['상대정맥', '상반신의 혈액을 모아 우심방으로 보내는 정맥이에요.'],
    ['우심방 앞', '도착점 바로 앞!']
  ];
  const SPECIAL = new Set([0, 5, 10, 15, 22]);

  // ---------- 규칙 ----------
  // 한 칸 앞으로: from = 지금 칸, prev = 직전 칸, first = 이번 이동의 첫 걸음인가
  function nextNode(n, prev, first) {
    if (n === 'S') return 1;
    if (first) { if (n === 5) return 20; if (n === 10) return 25; if (n === 22) return 27; }
    if (n === 0) return 'D';       // 출발점을 지나면 완주
    if (n >= 1 && n <= 18) return n + 1;
    if (n === 19) return 0;
    if (n === 20) return 21; if (n === 21) return 22;
    if (n === 22) return prev === 26 ? 27 : 23;
    if (n === 23) return 24; if (n === 24) return 15;
    if (n === 25) return 26; if (n === 26) return 22;
    if (n === 27) return 28; if (n === 28) return 0;
    return 'D';
  }
  // 이동 계산 → {path:[노드...], end: 노드|'D', hist}
  function walk(node, hist, steps) {
    hist = hist.slice();
    if (steps < 0) { // 빽도
      if (node === -1) return null;
      let to;
      if (hist.length) to = hist.pop(); else to = node === 0 ? 19 : (node > 0 && node <= 19 ? node - 1 : 0);
      return {path: [to], end: to, hist};
    }
    let n = node === -1 ? 'S' : node, prev = hist.length ? hist[hist.length - 1] : null; const path = [];
    if (node === -1) { hist = [0]; }
    for (let i = 0; i < steps; i++) {
      const nx = nextNode(n, prev, i === 0 && node !== -1);
      if (nx === 'D') { path.push('D'); return {path, end: 'D', hist}; }
      if (n !== 'S') hist.push(n);
      prev = n === 'S' ? 0 : n; n = nx; path.push(n);
    }
    return {path, end: n, hist};
  }
  function stepsLeft(node, hist) { // 완주까지 남은 최소 걸음 (말 평가용)
    if (node === -2) return 0; if (node === -1) return 21;
    let best = 99;
    for (let s = 1; s <= 25; s++) { const w = walk(node, hist, s); if (w && w.end === 'D') { best = s; break; } }
    return best;
  }
  function throwSticks() {
    const sticks = [0, 1, 2, 3].map(() => Math.random() < 0.58 ? 1 : 0); // 1 = 발현(밝은 면)
    const f = sticks.reduce((a, b) => a + b, 0);
    let r = f === 0 ? 5 : f;
    if (f === 1 && sticks[0] === 1) r = -1;   // 표시된 1번 염색체만 발현 → 빽도
    return {sticks, r};
  }
  const groupAt = (pl, node) => pl.pieces.map((p, i) => i).filter(i => pl.pieces[i].node === node);
  function canUse(st, seat, r) {
    const pl = st.players[seat];
    if (r < 0) return pl.pieces.some(p => p.node >= 0);
    return pl.pieces.some(p => p.node !== -2);
  }
  function legalMoves(st, seat) {
    const pl = st.players[seat], out = [];
    st.results.forEach((r, ri) => {
      const seen = new Set();
      pl.pieces.forEach((p, pi) => {
        if (p.node === -2) return;
        if (r < 0 && p.node < 0) return;
        const key = p.node === -1 ? 'home' : p.node; if (seen.has(key)) return; seen.add(key);
        out.push({t: 'move', r: ri, p: pi});
      });
    });
    return out;
  }
  function nextTurn(st) {
    st.results = []; st.throwsLeft = 1; st.phase = 'throw';
    for (let k = 1; k <= st.players.length; k++) { const c = (st.cur + k) % st.players.length; if (!st.players[c].done) { st.cur = c; break; } }
  }
  function prune(st, ev) { // 쓸 수 없는 결과(말이 없는데 빽도 등) 버리기
    const before = st.results.length;
    st.results = st.results.filter(r => canUse(st, st.cur, r));
    if (st.results.length < before) ev.push({t: 'note', text: '움직일 말이 없어 빽도는 넘어가요'});
    if (!st.results.length && st.throwsLeft <= 0) { nextTurn(st); ev.push({t: 'turn', seat: st.cur}); }
    else if (st.throwsLeft <= 0) st.phase = 'move';
  }

  const G = BB.GAMES.yut = {
    id: 'yut', name: '순환계 혈류 윷놀이', short: '혈류 윷놀이', sub: '염색체 윷을 던져 심장에서 출발해 폐순환·온몸순환을 돌아 대정맥으로 귀환!', color: 0xff8fa3, min: 2, max: 4, hidden: false, aiDelay: 700,
    rules: `<ul><li>차례가 오면 <b>염색체 윷 4개</b>를 던져요. 발현(밝은 면)된 개수: 1개 <b>도</b>(1칸), 2개 <b>개</b>(2칸), 3개 <b>걸</b>(3칸), 4개 <b>윷</b>(4칸), 0개 <b>모</b>(5칸).</li>
      <li><b>윷·모</b>가 나오면 한 번 더 던져요. 결과가 여러 개 쌓이면 <b>원하는 결과를 골라</b> 원하는 말에 써요.</li>
      <li>빨간 표시가 있는 1번 염색체만 발현되면 <b>빽도</b>(1칸 뒤로). 출발 직후(도 자리)에서 빽도면 도착점 바로 앞(대정맥 칸)으로 가요.</li>
      <li>모서리 분기점(폐동맥 분기점·대동맥궁 분기점)과 중앙 허브에 <b>딱 멈추면</b> 다음 이동은 지름길로 가요.</li>
      <li>내 말이 있는 칸에 도착하면 <b>업기</b>(세포 응집) — 함께 움직여요. 상대 말이 있는 칸에 도착하면 <b>잡기</b>(식세포 작용) — 상대 말은 골수로 돌아가고 나는 <b>한 번 더</b> 던져요.</li>
      <li>출발점(대정맥)을 <b>지나가야</b> 완주. 말 4개를 먼저 모두 완주시키면 승리!</li></ul>`,
    init(seats) {
      return {players: seats.map(s => ({name: s.name, char: s.char, pieces: [0, 1, 2, 3].map(() => ({node: -1, hist: []})), done: false})),
        cur: 0, phase: 'throw', throwsLeft: 1, results: [], last: null, winner: -1, finishOrder: [], turnNo: 0};
    },
    current(st) { return st.winner >= 0 ? -1 : st.cur; },
    playerInfo(st) { return st.players.map(p => { const d = p.pieces.filter(x => x.node === -2).length, o = p.pieces.filter(x => x.node >= 0).length; return {sub: `완주 ${d}/4 · 혈관 ${o}`, out: false}; }); },
    act(st, a, seat) {
      if (st.winner >= 0 || seat !== st.cur) return null;
      const ev = [];
      if (a.t === 'throw') {
        if (st.phase !== 'throw' || st.throwsLeft <= 0) return null;
        const {sticks, r} = throwSticks();
        st.throwsLeft--; if (r >= 4) st.throwsLeft++;
        st.results.push(r); st.last = sticks;
        ev.push({t: 'throw', seat, sticks, r});
        if (st.throwsLeft <= 0) { st.phase = 'move'; prune(st, ev); }
        return ev;
      }
      if (a.t === 'move') {
        if (st.phase !== 'move') return null;
        const r = st.results[a.r]; if (r == null) return null;
        const pl = st.players[seat], p = pl.pieces[a.p]; if (!p || p.node === -2) return null;
        if (r < 0 && p.node < 0) return null;
        const group = p.node === -1 ? [a.p] : groupAt(pl, p.node);
        const w = walk(p.node, p.hist, r); if (!w) return null;
        st.results.splice(a.r, 1);
        const capture = [];
        for (const gi of group) { const q = pl.pieces[gi]; q.node = w.end === 'D' ? -2 : w.end; q.hist = w.end === 'D' ? [] : w.hist.slice(); }
        if (w.end !== 'D') {
          st.players.forEach((op, oi) => { if (oi === seat) return; op.pieces.forEach((q, qi) => { if (q.node === w.end) { q.node = -1; q.hist = []; capture.push({seat: oi, p: qi}); } }); });
        }
        const stacked = w.end !== 'D' ? groupAt(pl, w.end).length : 0;
        ev.push({t: 'move', seat, pieces: group, from: p.node, path: w.path, r, capture, stacked});
        if (capture.length) { st.throwsLeft++; st.phase = 'throw'; }
        if (pl.pieces.every(q => q.node === -2)) {
          pl.done = true; st.finishOrder.push(seat); st.winner = seat;
          ev.push({t: 'win', seat}); return ev;
        }
        if (st.phase === 'move' && !st.results.length && st.throwsLeft <= 0) { nextTurn(st); ev.push({t: 'turn', seat: st.cur}); }
        else if (st.phase === 'move') prune(st, ev);
        return ev;
      }
      return null;
    },
    result(st) {
      if (st.winner < 0) return null;
      const rank = st.players.map((p, i) => ({seat: i, d: p.pieces.filter(x => x.node === -2).length, left: p.pieces.reduce((a, x) => a + stepsLeft(x.node, x.hist), 0)}))
        .sort((a, b) => b.d - a.d || a.left - b.left).map(x => ({seat: x.seat, note: `완주 ${x.d}/4`}));
      return {winner: st.winner, text: '적혈구 말 4개가 모두 온몸을 돌아 대정맥으로 귀환했어요!', rank};
    },
    // ---------- AI ----------
    ai(st, seat, lv) {
      if (st.phase === 'throw') return {t: 'throw'};
      const moves = legalMoves(st, seat); if (!moves.length) return null;
      if (lv === 0 && Math.random() < 0.45) return moves[BB.ri(moves.length)];
      let best = null, bs = -1e9;
      for (const m of moves) { const s = score(st, seat, m, lv) + Math.random() * (lv === 2 ? 0.5 : 4); if (s > bs) { bs = s; best = m; } }
      return best;
    },
    fallback(st, seat) { if (st.phase === 'throw') return {t: 'throw'}; const m = legalMoves(st, seat); return m[0] || null; },
    createView
  };
  function score(st, seat, m, lv) {
    const pl = st.players[seat], p = pl.pieces[m.p], r = st.results[m.r];
    const group = p.node === -1 ? [m.p] : groupAt(pl, p.node);
    const w = walk(p.node, p.hist, r); if (!w) return -1e9;
    let s = 0;
    const before = stepsLeft(p.node, p.hist), after = w.end === 'D' ? 0 : stepsLeft(w.end, w.hist);
    s += (before - after) * 2 * group.length;
    if (w.end === 'D') s += 55 * group.length;
    else {
      // 1순위: 잡기 (업힌 말이 많을수록 좋음)
      let cap = 0; st.players.forEach((op, oi) => { if (oi !== seat) cap += op.pieces.filter(q => q.node === w.end).length; });
      if (cap) s += 100 + 30 * cap;
      // 2순위: 지름길 칸에 딱 멈추기
      if (w.end === 5 || w.end === 10 || w.end === 22) s += 40;
      // 3순위: 업기
      const mine = pl.pieces.filter((q, i) => q.node === w.end && !group.includes(i)).length;
      if (mine) s += lv === 0 ? 8 : 25 * mine;
      // 4순위: 위험 피하기 (상대 말이 1~5칸 뒤에 있으면)
      if (lv >= 1) {
        let danger = 0;
        st.players.forEach((op, oi) => { if (oi === seat) return; op.pieces.forEach(q => { if (q.node === -2) return; for (let k = 1; k <= 5; k++) { const ww = walk(q.node, q.hist, k); if (ww && ww.end === w.end) { danger += k <= 3 ? 1.4 : 0.6; break; } } }); });
        s -= danger * (lv === 2 ? 14 : 7) * (group.length + mine);
        // 지금 있는 자리가 위험하면 도망가는 게 좋음
        if (p.node >= 0) { let d0 = 0; st.players.forEach((op, oi) => { if (oi === seat) return; op.pieces.forEach(q => { for (let k = 1; k <= 3; k++) { const ww = walk(q.node, q.hist, k); if (ww && ww.end === p.node) { d0++; break; } } }); }); s += d0 * (lv === 2 ? 10 : 4) * group.length; }
      }
      if (p.node === -1) s += lv === 2 ? 6 : 10;   // 새 말 출발
    }
    if (r < 0) s -= 6;
    return s;
  }

  // ---------- 3D 화면 ----------
  function createView(ctx) {
    const root = BB.root; BB.scene.background.set(0xf7b8c6);
    BB.setView({tx: innerWidth < innerHeight ? 0.5 : 1.5, ty: 0, tz: 0.5, az: 0.42, el: 0.8, zoom: innerWidth < innerHeight ? 8.6 : 9.6}); BB.view.minZ = 4; BB.view.maxZ = 18;
    const base = BB.ground(17, 0xb8607a, 0xe58aa0); base.position.x = 1.5; root.add(base);
    // 판 (복셀 받침)
    const board = BB.vox([[0, 0, 0, 13.2, 0.35, 13.2, '#c8506a'], [0, 0.35, 0, 12.6, 0.06, 12.6, '#ffd6de']]); root.add(board);
    const Y = 0.41;
    // 혈관 선
    const lines = [[0, 5], [5, 10], [10, 15], [15, 0], [5, 15], [10, 0]];
    for (const [a, b] of lines) {
      const A = POS[a], B = POS[b], L = Math.hypot(B[0] - A[0], B[1] - A[1]);
      const vessel = BB.box(L, 0.08, 0.32, a === 5 || a === 10 ? 0xb03050 : (a === 0 || a === 15 ? 0x4a6ad8 : 0xd83a4a));
      vessel.position.set((A[0] + B[0]) / 2, Y + 0.02, (A[1] + B[1]) / 2); vessel.rotation.y = -Math.atan2(B[1] - A[1], B[0] - A[0]); root.add(vessel);
    }
    const nodeMesh = [];
    POS.forEach((p, i) => {
      const big = SPECIAL.has(i), r = big ? 0.78 : 0.52;
      const col = i === 0 ? 0x4a6ad8 : i === 22 ? 0xffc04a : (i === 5 || i === 10 || i === 15) ? 0xff7a8a : (i >= 20 ? 0xff9fb0 : (i <= 4 || (i >= 16 && i <= 19) ? 0x7a8af0 : 0xf05a6a));
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.08, big ? 0.34 : 0.26, big ? 8 : 16), new THREE.MeshLambertMaterial({color: col}));
      m.position.set(p[0], Y + (big ? 0.17 : 0.13), p[1]); m.castShadow = true; m.receiveShadow = true; root.add(m);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.62, r * 0.62, 0.05, big ? 8 : 16), new THREE.MeshLambertMaterial({color: 0xffffff, transparent: true, opacity: 0.55})); cap.position.y = (big ? 0.17 : 0.13) + 0.02; m.add(cap);
      m.userData.pick = true; m.userData.info = [NODE[i][0], NODE[i][1], big ? '혈관 거점' : '혈관 노드']; m.userData.node = i;
      BB.pickables.push(m); nodeMesh[i] = m;
    });
    const lb0 = BB.label('출발·도착 (대정맥)', {size: 0.5}); lb0.position.set(POS[0][0] + 0.3, 1.6, POS[0][1] + 1.3); root.add(lb0);
    const lbC = BB.label('판막·간문맥 허브', {size: 0.42}); lbC.position.set(0, 1.4, 0.9); root.add(lbC);
    // 심장 장식
    const heart = BB.vox([[0, 0, 0, 1.6, 1.2, 1.2, '#e8404f'], [-0.45, 1.2, 0, 0.7, 0.4, 1.0, '#e8404f'], [0.45, 1.2, 0, 0.7, 0.4, 1.0, '#e8404f'], [0, 0, 0, 0.9, 1.6, 0.6, '#ff7a85'], [-0.3, 1.6, 0, 0.25, 0.6, 0.25, '#4a6ad8'], [0.3, 1.6, 0, 0.25, 0.7, 0.25, '#d83a4a']]);
    heart.position.set(7.4, 0.4, 7.2); heart.scale.setScalar(0.8); root.add(heart);
    heart.userData.pick = true; heart.userData.info = ['심장', '2심방 2심실. 우심실 → 폐동맥 → 폐 → 폐정맥 → 좌심방이 폐순환, 좌심실 → 대동맥 → 온몸 → 대정맥 → 우심방이 온몸순환이에요.', '순환계']; BB.pickables.push(heart);
    BB.ticks.push((dt, t) => { const k = 1 + Math.max(0, Math.sin(t * 7)) * 0.06; heart.scale.setScalar(0.8 * k); });
    // 윷 던지는 곳 (오른쪽)
    const TX = 10.4, TZ = -1.0;
    const mat = BB.vox([[0, 0, 0, 4.4, 0.12, 6.4, '#ffe8b0'], [0, 0.12, 0, 4.0, 0.04, 6.0, '#fff5d8']]); mat.position.set(TX, 0, TZ); root.add(mat);
    const mlb = BB.label('염색체 윷 던지는 곳', {size: 0.45}); mlb.position.set(TX, 0.9, TZ - 3.6); root.add(mlb);
    // 염색체 윷가락 4개
    const sticks = [];
    for (let i = 0; i < 4; i++) {
      const g = new THREE.Group();
      const front = [], back = [];
      // 염색분체 2개 + 동원체 (앞면 = 발현 · 밝은 색 / 뒷면 = 응축 · 어두운 색)
      const L = 2.4;
      for (let s = 0; s < 8; s++) { const z = -L / 2 + (s + 0.5) * L / 8, w = Math.abs(s - 3.5) < 0.6 ? 0.34 : 0.5; const band = s % 2 ? '#ffd88a' : '#fff1c8';
        front.push([0, 0.12, z, w, 0.08, L / 8 - 0.02, i === 0 && s === 1 ? '#ff3b5c' : band]); back.push([0, 0, z, w, 0.12, L / 8 - 0.02, s % 2 ? '#6a3a2a' : '#8a5a3a']); }
      front.push([0, 0.12, 0, 0.62, 0.1, 0.16, '#ff8fb8']);
      const mesh = BB.vox(front.concat(back)); mesh.position.y = -0.1; g.add(mesh);
      g.position.set(TX - 1.5 + i, 0.25, TZ); g.userData.i = i;
      g.userData.pick = true; g.userData.info = i === 0 ? ['1번 염색체 (빽도 표시)', '빨간 표시가 있는 염색체만 발현되면 빽도! 염색체는 DNA가 히스톤 단백질에 감겨 응축된 구조예요.', '윷가락'] : ['염색체 윷가락', '밝은 면 = 유전자 발현(풀린 염색질) · 어두운 면 = 응축된 염색체. 세포 분열 때 염색체는 두 염색분체가 동원체로 붙어 있어요.', '윷가락'];
      BB.pickables.push(g); root.add(g); sticks.push(g);
    }
    // 대기석 (골수) · 완주석
    const homeSpot = (seat, k) => { const side = [[-8.8, 3.6], [-8.8, -3.6], [-6.6, 3.6], [-6.6, -3.6]][seat]; return [side[0] + (k % 2) * 1.0, side[1] + Math.floor(k / 2) * 1.0 * (seat % 2 ? 1 : -1)]; };
    const doneSpot = (seat, k) => [6.6 + k * 0.62, 6.0 + seat * 0.62];
    for (let s = 0; s < 4; s++) { const sp = homeSpot(s, 0); const pad = BB.vox([[0, 0, 0, 2.4, 0.16, 2.4, '#ffd0dc']]); pad.position.set(sp[0] + 0.5, 0, sp[1] + (s % 2 ? 0.5 : -0.5)); root.add(pad); pad.userData.pick = true; pad.userData.info = ['골수 (말 대기석)', '혈구는 골수의 조혈 모세포에서 만들어져요. 잡힌 말은 여기로 돌아와요.', '대기석']; BB.pickables.push(pad); }
    const homeLbl = BB.label('골수 생성소 (대기)', {size: 0.42}); homeLbl.position.set(-7.8, 1.3, 0); root.add(homeLbl);
    // 말
    let state = null; const pieces = []; // pieces[seat][k] = mesh
    const stackBadges = [];
    function placeAll(st, instant) {
      st.players.forEach((pl, s) => {
        pieces[s] = pieces[s] || [];
        const byNode = {};
        pl.pieces.forEach((p, k) => {
          let m = pieces[s][k];
          if (!m) { m = BB.makeChar(pl.char, 0.5); m.userData.pick = true; m.userData.seat = s; m.userData.k = k; root.add(m); BB.pickables.push(m); pieces[s][k] = m; m.userData.onPick = () => pickPiece(s, k); }
          m.userData.info = [pl.name + '의 말 ' + (k + 1), p.node === -1 ? '골수에서 대기 중' : p.node === -2 ? '완주!' : NODE[p.node][0] + ' 칸', '말'];
          let x, z, y = 0.45;
          if (p.node === -1) [x, z] = homeSpot(s, k);
          else if (p.node === -2) { [x, z] = doneSpot(s, k); y = 0.05; }
          else { byNode[p.node] = (byNode[p.node] || 0) + 1; const h = byNode[p.node] - 1; [x, z] = POS[p.node]; y = Y + 0.3 + h * 0.62; }
          m.userData.target = [x, y, z];
          if (instant) m.position.set(x, y, z);
        });
      });
      updateBadges(st);
    }
    function updateBadges(st) {
      for (const b of stackBadges) root.remove(b); stackBadges.length = 0;
      st.players.forEach((pl, s) => {
        const cnt = {}; pl.pieces.forEach(p => { if (p.node >= 0) cnt[p.node] = (cnt[p.node] || 0) + 1; });
        for (const n in cnt) if (cnt[n] > 1) { const b = BB.label('x' + cnt[n], {size: 0.55, color: '#7dffe0', bg: 'rgba(20,40,70,.75)'}); const [x, z] = POS[n]; b.position.set(x, Y + 0.55 + cnt[n] * 0.62 + 0.5, z); root.add(b); stackBadges.push(b); }
      });
    }
    async function animateThrow(e) {
      BB.audio.yut();
      const TXc = TX, TZc = TZ;
      await Promise.all(sticks.map((g, i) => {
        const x0 = TXc - 1.5 + i, endX = TXc - 1.35 + i * 0.95 + BB.rand(-0.15, 0.15), endZ = TZc + BB.rand(-0.8, 0.8);
        const spins = 2 + BB.ri(2), up = e.sticks[i] === 1;
        const endRot = (up ? 0 : Math.PI) + spins * TAU, yaw0 = g.rotation.y, yaw1 = BB.rand(-0.35, 0.35);
        g.rotation.z = 0;
        return BB.tween(0.9 + i * 0.05, k => {
          g.position.set(x0 + (endX - x0) * k, 0.25 + Math.sin(k * Math.PI) * 4.2, TZc + (endZ - TZc) * k);
          g.rotation.z = endRot * k; g.rotation.y = yaw0 + (yaw1 - yaw0) * k; g.rotation.x = Math.sin(k * Math.PI) * 0.8;
        }, 'lin').then(() => { g.rotation.z = up ? 0 : Math.PI; g.rotation.x = 0; BB.ring(g.position.x, 0.1, g.position.z, 0xffd88a); });
      }));
      const [nm, sub] = RES[e.r];
      BB.toast(nm + '!', sub, 1400);
      if (e.r >= 4) BB.audio.bonus(); else if (e.r < 0) BB.audio.wrong(); else BB.audio.land();
      await BB.wait(450);
    }
    async function animateMove(st, e) {
      const pl = st.players[e.seat];
      const ms = e.pieces.map(k => pieces[e.seat][k]);
      // 출발 칸 쌓임 높이
      for (let si = 0; si < e.path.length; si++) {
        const n = e.path[si];
        let x, z, y;
        if (n === 'D') { x = POS[0][0] + 1.2; z = POS[0][1] + 1.2; y = 0.5; }
        else { [x, z] = POS[n]; y = Y + 0.3; }
        await Promise.all(ms.map((m, j) => BB.hop(m, x, y + j * 0.62, z, {h: 0.9, dur: 0.26})));
        if (n !== 'D') BB.ring(x, Y, z, 0xffffff);
      }
      if (e.capture.length) {
        const [x, z] = POS[e.path[e.path.length - 1]];
        BB.audio.capture(); BB.burst(x, Y + 0.6, z, ['#ff4d6d', '#ffd166', '#ffffff', BB.CHARS[st.players[e.capture[0].seat].char].color], 70, 1.2);
        BB.toast('식세포 작용!', '상대 말을 잡아 골수로 돌려보내요 · 한 번 더 던지기', 1600);
        for (const c of e.capture) { const m = pieces[c.seat][c.p]; const [hx, hz] = homeSpot(c.seat, c.p); BB.hop(m, hx, 0.45, hz, {h: 4, dur: 0.7}); }
        await BB.wait(700);
      } else if (e.stacked > 1) { BB.audio.bonus(); BB.toast('업기! x' + e.stacked, '세포 응집 — 함께 움직여요', 1200); }
      if (e.path[e.path.length - 1] === 'D') { BB.audio.coin(); BB.toast('완주!', pl.name + '의 말이 대정맥으로 귀환', 1200); }
    }
    let selR = 0;
    function pickPiece(s, k) {
      if (!state || state.phase !== 'move' || !ctx.canAct(state.cur) || s !== state.cur || ctx.busy()) return;
      const p = state.players[s].pieces[k]; if (p.node === -2) return;
      const r = state.results[selR]; if (r == null) return;
      if (r < 0 && p.node < 0) { BB.toast('빽도는 혈관 위의 말만 쓸 수 있어요'); return; }
      ctx.dispatch({t: 'move', r: selR, p: k}, s); selR = 0;
    }
    BB.onPick = o => { if (o && o.userData.node != null && state && state.phase === 'move') { const n = o.userData.node; const pl = state.players[state.cur]; const k = pl.pieces.findIndex(p => p.node === n); if (k >= 0) pickPiece(state.cur, k); } };
    // 이동 미리보기 링
    const hints = [];
    function showHints(st) {
      for (const h of hints) root.remove(h); hints.length = 0;
      if (!st || st.phase !== 'move' || !ctx.canAct(st.cur)) return;
      const r = st.results[selR]; if (r == null) return;
      const pl = st.players[st.cur], seen = new Set();
      pl.pieces.forEach(p => {
        if (p.node === -2 || (r < 0 && p.node < 0)) return; const key = p.node; if (seen.has(key)) return; seen.add(key);
        const w = walk(p.node, p.hist, r); if (!w) return;
        let x, z; if (w.end === 'D') { x = POS[0][0] + 1.2; z = POS[0][1] + 1.2; } else [x, z] = POS[w.end];
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.08, 8, 28), new THREE.MeshBasicMaterial({color: BB.CHARS[pl.char].color === '#f2f5ff' ? 0x7dffe0 : BB.CHARS[pl.char].color}));
        ring.rotation.x = Math.PI / 2; ring.position.set(x, Y + 0.45, z); root.add(ring); hints.push(ring);
      });
    }
    BB.ticks.push((dt, t) => { for (const h of hints) h.position.y = Y + 0.45 + Math.sin(t * 5) * 0.08; });
    function hud(st) {
      const me = ctx.canAct(st.cur), pl = st.players[st.cur];
      if (st.winner >= 0) { BB.msg(''); BB.acts([]); return; }
      const badges = st.results.map((r, i) => ({badge: true, on: i === selR, t: `${RES[r][0]} <small>${r < 0 ? '−1' : '+' + r}</small>`, info: RES_INFO[r], fn: () => { selR = i; hud(state); showHints(state); }}));
      if (st.phase === 'throw') {
        BB.msg(`<b>${BB.esc(pl.name)}</b> 차례 · ${me ? '윷을 던지세요' : '던지는 중…'}${st.results.length ? ' (쌓인 결과 ' + st.results.length + '개)' : ''}`);
        BB.acts(badges.concat([me ? {t: '🧬 염색체 윷 던지기', cls: 'pri', fn: () => ctx.dispatch({t: 'throw'}, st.cur)} : null]));
      } else {
        if (selR >= st.results.length) selR = 0;
        const homeK = pl.pieces.findIndex(p => p.node === -1);
        BB.msg(`<b>${BB.esc(pl.name)}</b> ${me ? '· 결과를 고르고 움직일 말(또는 칸)을 누르세요' : '· 말을 고르는 중…'}`);
        BB.acts(badges.concat(me ? [homeK >= 0 && st.results[selR] > 0 ? {t: '새 말 출발', cls: 'pri', fn: () => pickPiece(st.cur, homeK)} : null] : []));
      }
    }
    return {
      async sync(st, evs) {
        const first = !state; state = st;
        if (first) { placeAll(st, true); }
        for (const e of evs) {
          if (e.t === 'throw') await animateThrow(e);
          else if (e.t === 'move') await animateMove(st, e);
          else if (e.t === 'note') BB.toast(e.text, '', 1200);
          else if (e.t === 'turn') { BB.audio.turn(); }
        }
        placeAll(st, false);
        // 남은 위치 보정
        await Promise.all(pieces.flat().filter(Boolean).map(m => { const t = m.userData.target; if (!t) return null; if (m.position.distanceTo(new THREE.Vector3(t[0], t[1], t[2])) > 0.05) return BB.moveTo(m, t[0], t[1], t[2], 0.25, 'out'); return null; }));
        if (selR >= st.results.length) selR = 0;
        hud(st); showHints(st);
      },
      destroy() { BB.onPick = null; }
    };
  }

  G.lobbyModel = function () {
    const g = new THREE.Group();
    const b = BB.vox([[0, 0, 0, 3.2, 0.2, 3.2, '#fff0f3'], [0, 0.2, 0, 2.8, 0.05, 0.2, '#d83a4a'], [0, 0.2, 0, 0.2, 0.05, 2.8, '#d83a4a']]); g.add(b);
    for (let i = 0; i < 4; i++) { const s = BB.vox([[0, 0, 0, 0.3, 0.12, 1.6, i === 1 ? '#8a5a3a' : '#ffe0a8']]); s.position.set(-0.6 + i * 0.4, 0.6 + i * 0.25, 0); s.rotation.set(0.4 * i, 0.3, 0.6 + i * 0.3); g.add(s); }
    return g;
  };
  BB.yutRules = {walk, nextNode, throwSticks, stepsLeft, legalMoves};
})();
