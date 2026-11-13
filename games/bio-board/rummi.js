/* 게임 1: 코돈 타일 — 숫자 타일 조합 게임 (106개: 4염기 색 × 1~13 × 2 + CRISPR 조커 2) */
'use strict';
BB.GAMES = BB.GAMES || {};
(function () {
  const BASES = [
    {b: 'A', name: '아데닌', col: '#12b981', hex: 0x12b981},
    {b: 'U', name: '유라실', col: '#ff5d5d', hex: 0xff5d5d},
    {b: 'G', name: '구아닌', col: '#f2a20c', hex: 0xf2a20c},
    {b: 'C', name: '시토신', col: '#3b7ff6', hex: 0x3b7ff6}
  ];
  const BASE_INFO = [
    '아데닌(A): 퓨린 계열 염기. DNA에서는 티민(T), RNA에서는 유라실(U)과 수소 결합 2개로 짝지어요.',
    '유라실(U): RNA에만 있는 피리미딘 염기. DNA의 티민(T) 대신 들어가 아데닌과 짝지어요.',
    '구아닌(G): 퓨린 계열 염기. 시토신(C)과 수소 결합 3개로 짝지어 더 단단해요.',
    '시토신(C): 피리미딘 계열 염기. 구아닌(G)과 짝지어요.'
  ];
  // ---------- 세트 판정 ----------
  function analyze(tiles) { // tiles: [{c,n,j}] → {type, value, order(인덱스 순서)} | null
    const L = tiles.length; if (L < 3) return null;
    const nj = tiles.map((t, i) => ({t, i})).filter(x => !x.t.j), J = L - nj.length;
    if (!nj.length) return null;
    let grp = null, run = null;
    // 코돈 복합체: 같은 숫자, 서로 다른 색, 3~4개
    if (L <= 4 && nj.every(x => x.t.n === nj[0].t.n) && new Set(nj.map(x => x.t.c)).size === nj.length) {
      const order = nj.slice().sort((a, b) => a.t.c - b.t.c).map(x => x.i).concat(tiles.map((t, i) => t.j ? i : -1).filter(i => i >= 0));
      grp = {type: 'group', value: nj[0].t.n * L, order};
    }
    // 전사 사슬: 같은 색, 연속 숫자 (조커로 빈칸 채움)
    if (L <= 13 && nj.every(x => x.t.c === nj[0].t.c) && new Set(nj.map(x => x.t.n)).size === nj.length) {
      const ns = nj.map(x => x.t.n).sort((a, b) => a - b), mn = ns[0], mx = ns[ns.length - 1];
      const gaps = (mx - mn + 1) - nj.length;
      if (gaps <= J) {
        let extra = J - gaps, start = mn, end = mx + extra;
        if (end > 13) { start -= end - 13; end = 13; }
        if (start >= 1) {
          const byN = {}; nj.forEach(x => byN[x.t.n] = x.i); const jk = tiles.map((t, i) => t.j ? i : -1).filter(i => i >= 0);
          const order = []; let value = 0; for (let n = start; n <= end; n++) { order.push(byN[n] != null ? byN[n] : jk.pop()); value += n; }
          run = {type: 'run', value, order, start};
        }
      }
    }
    if (grp && run) return run.value >= grp.value ? run : grp;
    return grp || run;
  }
  const tilesOf = (st, ids) => ids.map(i => st.tiles[i]);
  const setOK = (st, ids) => !!analyze(tilesOf(st, ids));
  const setValue = (st, ids) => { const a = analyze(tilesOf(st, ids)); return a ? a.value : 0; };
  function arrange(st, ids) { const a = analyze(tilesOf(st, ids)); if (!a) return ids.slice().sort((x, y) => (st.tiles[x].j - st.tiles[y].j) || (st.tiles[x].n - st.tiles[y].n) || (st.tiles[x].c - st.tiles[y].c)); return a.order.map(k => ids[k]); }
  const rackValue = (st, ids) => ids.reduce((a, i) => a + (st.tiles[i].j ? 30 : st.tiles[i].n), 0);
  const sameSet = (a, b) => a.length === b.length && a.slice().sort((x, y) => x - y).every((v, i) => v === b.slice().sort((x, y) => x - y)[i]);
  // 플레이 검증 (호스트·화면 공용)
  function checkPlay(st, s, table) {
    if (!Array.isArray(table)) return '잘못된 배치';
    const flat = table.flat(), seen = new Set();
    for (const id of flat) { if (seen.has(id) || !st.tiles[id]) return '타일이 겹쳐요'; seen.add(id); }
    for (const set of table) if (!setOK(st, set)) return '규칙에 맞지 않는 세트가 있어요 (빨간 줄)';
    const old = st.table.flat();
    for (const id of old) if (!seen.has(id)) return '판에 있던 타일은 판에 남아 있어야 해요';
    const rack = new Set(st.racks[s]), added = flat.filter(id => !old.includes(id));
    if (!added.length) return '랙에서 타일을 1개 이상 내려놓아야 해요';
    for (const id of added) if (!rack.has(id)) return '내 타일이 아닌 타일이 있어요';
    if (!st.melded[s]) {
      // 첫 등록: 판의 기존 세트는 그대로, 새 세트는 내 타일로만, 합 30 이상
      const used = new Set();
      for (const os of st.table) { const k = table.findIndex((ns, i) => !used.has(i) && sameSet(ns, os)); if (k < 0) return '첫 등록 전에는 판의 세트를 바꿀 수 없어요'; used.add(k); }
      let sum = 0;
      table.forEach((ns, i) => { if (used.has(i)) return; sum += setValue(st, ns); });
      for (let i = 0; i < table.length; i++) if (!used.has(i) && table[i].some(id => old.includes(id))) return '첫 등록 전에는 판의 타일을 쓸 수 없어요';
      if (sum < 30) return `첫 등록은 합이 30 이상이어야 해요 (지금 ${sum})`;
    }
    return '';
  }
  function nextTurn(st, ev) { st.cur = (st.cur + 1) % st.players.length; st.turnNo++; ev.push({t: 'turn', seat: st.cur}); }

  const G = BB.GAMES.rummi = {
    id: 'rummi', name: '코돈 타일', short: '코돈 타일', sub: 'mRNA 염기 타일로 전사 사슬과 코돈 복합체를 만들어 폴리펩타이드를 합성하는 타일 조합 게임', color: 0xffd166, min: 2, max: 4, hidden: true, aiDelay: 900,
    rules: `<ul><li>타일 106개: 4가지 염기 색(<b style="color:#12b981">A</b> · <b style="color:#ff5d5d">U</b> · <b style="color:#f2a20c">G</b> · <b style="color:#3b7ff6">C</b>) × 유전자 좌위 번호 1~13 × 2세트 + <b>CRISPR-Cas9 조커</b> 2개. 처음에 14개씩 받아요.</li>
      <li><b>전사 사슬(Run)</b>: 같은 색 연속 번호 3개 이상 · <b>코돈 복합체(Group)</b>: 같은 번호 다른 색 3~4개. 조커는 아무 타일 대신 쓸 수 있어요.</li>
      <li><b>첫 등록</b>은 내 타일만으로 합 <b>30 이상</b>(30 kDa 단백질 합성 개시). 그 뒤로는 판의 세트를 나누고 붙여 <b>재조합</b>할 수 있어요 — 차례가 끝날 때 모든 세트가 규칙에 맞아야 해요.</li>
      <li>내려놓을 수 없거나 내려놓기 싫으면 <b>타일 1개 뽑기</b>. 1-2-3 같은 색 사슬을 새로 만들면 <b>개시 코돈(AUG) 보너스</b> 연출!</li>
      <li>랙을 먼저 모두 비우면 승리. 풀이 비고 모두 넘기면 랙의 수 합이 가장 작은 사람이 승리.</li>
      <li>조작: 내 타일·판의 타일을 눌러 고르고 → 세트 끝의 <b>＋</b> 칸을 누르면 붙이고, <b>새 세트로</b> 버튼이면 새 줄이 돼요.</li></ul>`,
    init(seats) {
      const tiles = []; for (let k = 0; k < 2; k++) for (let c = 0; c < 4; c++) for (let n = 1; n <= 13; n++) tiles.push({c, n, j: 0});
      tiles.push({c: -1, n: 0, j: 1}, {c: -1, n: 0, j: 1});
      const pool = BB.shuffle(tiles.map((t, i) => i));
      const racks = seats.map(() => { const r = []; for (let k = 0; k < 14; k++) r.push(pool.pop()); return r; });
      return {tiles, pool, racks, table: [], melded: seats.map(() => false), players: seats.map(s => ({name: s.name, char: s.char})), cur: 0, passes: 0, winner: -1, turnNo: 0, endText: ''};
    },
    current(st) { return st.winner >= 0 ? -1 : st.cur; },
    playerInfo(st) { return st.players.map((p, i) => ({sub: `타일 ${st.racks[i].length}개${st.melded[i] ? '' : ' · 등록 전'}`})); },
    act(st, a, s) {
      if (st.winner >= 0 || s !== st.cur) return null;
      const ev = [];
      if (a.t === 'draw') {
        if (st.pool.length) { const id = st.pool.pop(); st.racks[s].push(id); st.passes = 0; ev.push({t: 'draw', seat: s, id}); }
        else { st.passes++; ev.push({t: 'pass', seat: s}); if (st.passes >= st.players.length) {
          let best = 0; st.racks.forEach((r, i) => { if (rackValue(st, r) < rackValue(st, st.racks[best])) best = i; }); st.winner = best; st.endText = '풀이 비어 모두 넘겼어요. 남은 타일 합이 가장 작은 연구원이 승리!'; ev.push({t: 'end'}); return ev; } }
        nextTurn(st, ev); return ev;
      }
      if (a.t === 'play') {
        const err = checkPlay(st, s, a.table); if (err) return null;
        const old = st.table.map(x => x.slice());
        const table = a.table.map(set => arrange(st, set));
        const added = table.flat().filter(id => !old.flat().includes(id));
        st.racks[s] = st.racks[s].filter(id => !added.includes(id));
        // 개시 코돈 보너스: 같은 색 1-2-3이 들어간 새 사슬
        let aug = false;
        for (const set of table) { if (old.some(o => sameSet(o, set))) continue; const an = analyze(tilesOf(st, set)); if (an && an.type === 'run') { const ns = set.filter(id => !st.tiles[id].j).map(id => st.tiles[id].n); if (ns.includes(1) && ns.includes(2) && ns.includes(3)) aug = true; } }
        const first = !st.melded[s];
        st.table = table; st.melded[s] = true; st.passes = 0;
        ev.push({t: 'play', seat: s, added, first, aug, value: first ? table.filter(set => !old.some(o => sameSet(o, set))).reduce((a2, set) => a2 + setValue(st, set), 0) : 0});
        if (!st.racks[s].length) { st.winner = s; st.endText = '랙의 타일을 모두 내려놓아 폴리펩타이드 합성을 완료했어요!'; ev.push({t: 'end'}); return ev; }
        nextTurn(st, ev); return ev;
      }
      return null;
    },
    result(st) {
      if (st.winner < 0) return null;
      const rank = st.racks.map((r, i) => ({seat: i, v: rackValue(st, r), n: r.length})).sort((a, b) => (a.seat === st.winner ? -1 : b.seat === st.winner ? 1 : a.v - b.v)).map(x => ({seat: x.seat, note: `남은 타일 ${x.n}개 (합 ${x.v})`}));
      return {winner: st.winner, text: st.endText, rank};
    },
    ai(st, s, lv) { const t = aiPlay(st, s, lv); return t ? {t: 'play', table: t} : {t: 'draw'}; },
    fallback() { return {t: 'draw'}; },
    createView
  };

  // ---------- AI ----------
  function genCandidates(st, rack, useJ, maxLen) {
    const cnt = {}; let jokers = 0;
    for (const id of rack) { const t = st.tiles[id]; if (t.j) jokers++; else cnt[t.c * 14 + t.n] = (cnt[t.c * 14 + t.n] || 0) + 1; }
    const J = useJ ? Math.min(2, jokers) : 0;
    const out = [];
    const has = (c, n) => (cnt[c * 14 + n] || 0) > 0;
    for (let n = 1; n <= 13; n++) { // 복합체
      const cols = [0, 1, 2, 3].filter(c => has(c, n));
      const subsets = []; const rec = (i, cur) => { if (i === cols.length) { if (cur.length) subsets.push(cur.slice()); return; } rec(i + 1, cur); cur.push(cols[i]); rec(i + 1, cur); cur.pop(); }; rec(0, []);
      for (const sub of subsets) for (let j = 0; j <= J; j++) { const L = sub.length + j; if (L >= 3 && L <= 4 && sub.length >= 2 - (j > 1 ? 1 : 0)) out.push({spec: sub.map(c => c * 14 + n), j}); }
    }
    for (let c = 0; c < 4; c++) for (let a = 1; a <= 13; a++) for (let L = 3; L <= maxLen && a + L - 1 <= 13; L++) { // 사슬
      let miss = 0; const spec = []; for (let n = a; n < a + L; n++) { if (has(c, n)) spec.push(c * 14 + n); else miss++; }
      if (miss <= J && spec.length >= 2 && (miss === 0 || useJ)) out.push({spec, j: miss});
      if (miss > J) break;
    }
    return {out, cnt, jokers: rack.filter(id => st.tiles[id].j)};
  }
  function bestCover(st, rack, cands, wantValue, limit) {
    const pool = {}; for (const id of rack) { const t = st.tiles[id]; if (!t.j) (pool[t.c * 14 + t.n] = pool[t.c * 14 + t.n] || []).push(id); }
    let jokers = rack.filter(id => st.tiles[id].j);
    cands.sort((x, y) => (y.spec.length + y.j) - (x.spec.length + x.j));
    let best = {score: 0, sets: []}, nodes = 0;
    const scoreOf = sets => wantValue ? sets.reduce((a, s) => a + setValue(st, s), 0) : sets.reduce((a, s) => a + s.length, 0) - sets.reduce((a, s) => a + s.filter(id => st.tiles[id].j).length, 0) * 0.6;
    const dfs = (i, sets) => {
      if (++nodes > limit) return;
      const sc = scoreOf(sets); if (sc > best.score) best = {score: sc, sets: sets.map(s => s.slice())};
      for (let k = i; k < cands.length; k++) {
        const c = cands[k];
        if (!c.spec.every(key => pool[key] && pool[key].length) || jokers.length < c.j) continue;
        const ids = c.spec.map(key => pool[key].pop()), jk = jokers.splice(0, c.j);
        const set = ids.concat(jk);
        if (setOK(st, set)) dfs(k, sets.concat([set]));
        c.spec.forEach((key, x) => pool[key].push(ids[x])); jokers = jk.concat(jokers);
        if (nodes > limit) return;
      }
    };
    dfs(0, []);
    return best;
  }
  function aiPlay(st, s, lv) {
    if (lv === 0 && Math.random() < 0.2) return null;
    const rack = st.racks[s].slice();
    const {out} = genCandidates(st, rack, lv >= 1, lv === 0 ? 3 : 13);
    const melded = st.melded[s];
    const cover = bestCover(st, rack, out, !melded, lv === 2 ? 30000 : lv === 1 ? 6000 : 800);
    let table = st.table.map(x => x.slice());
    if (!melded) {
      if (cover.score < 30) return null;
      return table.concat(cover.sets);
    }
    table = table.concat(cover.sets);
    let left = rack.filter(id => !cover.sets.flat().includes(id));
    if (lv >= 1) { // 판의 세트에 붙이기
      let changed = true;
      while (changed) { changed = false;
        for (const id of left.slice()) { if (lv === 1 && st.tiles[id].j) continue;
          for (const set of table) { const t2 = set.concat([id]); if (setOK(st, t2)) { set.push(id); left = left.filter(x => x !== id); changed = true; break; } } } }
    }
    if (lv === 2) { // 판에서 타일 하나 빌려 새 복합체 만들기
      let progress = true;
      while (progress) { progress = false;
        const nonj = left.filter(id => !st.tiles[id].j);
        outer: for (let a = 0; a < nonj.length; a++) for (let b = a + 1; b < nonj.length; b++) {
          const A = st.tiles[nonj[a]], B = st.tiles[nonj[b]]; if (A.n !== B.n || A.c === B.c) continue;
          for (const set of table) for (const tid of set) { const T = st.tiles[tid]; if (T.j || T.n !== A.n || T.c === A.c || T.c === B.c) continue;
            const rest = set.filter(x => x !== tid); if (!setOK(st, rest)) continue;
            set.splice(set.indexOf(tid), 1); table.push([nonj[a], nonj[b], tid]); left = left.filter(x => x !== nonj[a] && x !== nonj[b]); progress = true; break outer; }
        }
      }
    }
    if (left.length === rack.length) return null;
    return checkPlay(st, s, table) ? null : table;
  }

  // ---------- 3D ----------
  const TW = 0.86, TH = 0.24, TD = 1.18;
  function tileTex(t) {
    return BB.textTex('rk' + (t.j ? 'J' : t.c + '-' + t.n), (g, W, H) => {
      g.fillStyle = '#fffaf0'; g.fillRect(0, 0, W, H); g.strokeStyle = '#e6dcc4'; g.lineWidth = 8; g.strokeRect(4, 4, W - 8, H - 8);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      if (t.j) { g.fillStyle = '#8a3ffc'; g.font = BB.font(64); g.fillText('✂', W / 2, H / 2 - 18); g.font = BB.font(22, 900); g.fillText('CRISPR', W / 2, H - 46); g.font = BB.font(18, 800); g.fillText('Cas9', W / 2, H - 22); return; }
      const B = BASES[t.c]; g.fillStyle = B.col; g.font = BB.font(84); g.fillText(String(t.n), W / 2, H / 2 + 2);
      g.font = BB.font(26, 900); g.fillText(B.b, W / 2, 32); g.beginPath(); g.arc(W / 2, H - 30, 9, 0, Math.PI * 2); g.fill();
      if (t.n === 6 || t.n === 9) g.fillRect(W / 2 - 18, H / 2 + 44, 36, 5);
    }, 128, 176);
  }
  function createView(ctx) {
    const root = BB.root; BB.scene.background.set(0xf6d48e);
    const narrowV = innerWidth < innerHeight;
    BB.setView(narrowV ? {tx: 0, ty: 0, tz: 1.2, az: 0.0001, el: 1.05, zoom: 6.4} : {tx: 0, ty: 0, tz: 0.9, az: 0.0001, el: 1.0, zoom: 6.6}); BB.view.minZ = 4; BB.view.maxZ = 18;
    root.add(BB.ground(28, 0xb07a3a, 0xd6a05a));
    const table = BB.vox([[0, 0, 0, 24, 0.4, 13.6, '#7a4f2a'], [0, 0.4, -0.9, 23.2, 0.06, 10.4, '#2f7a5c'], [0, 0.4, 5.0, 23.2, 0.5, 2.6, '#c9925a'], [0, 0.9, 5.9, 23.2, 0.3, 0.5, '#a8743f']]); table.position.z = -0.3; root.add(table);
    const Y = 0.47;
    const meshes = {};
    function tm(st, id) {
      if (meshes[id]) return meshes[id];
      const t = st.tiles[id];
      const side = new THREE.MeshLambertMaterial({color: 0xf3ead6}), top = new THREE.MeshLambertMaterial({map: tileTex(t)}), back = new THREE.MeshLambertMaterial({color: 0xd9c9a8});
      const m = new THREE.Mesh(new THREE.BoxGeometry(TW, TH, TD), [side, side, top, back, side, side]);
      m.castShadow = true; m.receiveShadow = true; m.userData.pick = true; m.userData.tid = id; m.userData.topM = top; m.userData.backM = back;
      m.userData.info = t.j ? ['CRISPR-Cas9 유전자 가위 (조커)', '가이드 RNA가 찾은 DNA 서열을 Cas9 단백질이 잘라 유전자를 편집해요. 어떤 타일 대신에도 쓸 수 있어요.', '조커'] : [BASES[t.c].b + ' ' + t.n + ' (' + BASES[t.c].name + ')', BASE_INFO[t.c] + ' 번호 ' + t.n + '은 유전자 좌위(위치) 번호예요.', '염기 타일'];
      m.userData.onPick = () => clickTile(id);
      root.add(m); BB.pickables.push(m); meshes[id] = m; return m;
    }
    let state = null, work = null, sel = [], workFor = -1, sortMode = 0;
    const drops = [], marks = [];
    const poolLbl = BB.label('남은 타일 106', {size: 0.45}); poolLbl.position.set(11.6, 2.2, -5.2); root.add(poolLbl);
    const myTurn = () => state && state.winner < 0 && ctx.canAct(state.cur) && state.cur === ctx.viewer();
    function resetWork() { work = {table: state.table.map(x => x.slice()), rack: state.racks[state.cur].slice()}; sel = []; workFor = state.turnNo; }
    function clickTile(id) {
      if (!myTurn() || ctx.busy()) return;
      if (!work || workFor !== state.turnNo) resetWork();
      const inRack = work.rack.includes(id), onTable = work.table.some(set => set.includes(id));
      if (!inRack && !onTable) return;
      if (onTable && !state.melded[state.cur] && state.table.flat().includes(id)) { BB.toast('첫 등록(합 30) 전에는 판의 타일을 움직일 수 없어요'); return; }
      const i = sel.indexOf(id); if (i >= 0) sel.splice(i, 1); else sel.push(id);
      BB.audio.click(); render(false);
    }
    function moveSelTo(target) { // target: 세트 인덱스 또는 -1(새 세트)
      if (!sel.length) return;
      const take = sel.slice();
      work.rack = work.rack.filter(id => !take.includes(id));
      let tset = target >= 0 ? work.table[target] : null;
      work.table.forEach(set => { for (const id of take) { const k = set.indexOf(id); if (k >= 0) set.splice(k, 1); } });
      if (tset) tset.push(...take); else work.table.push(take);
      work.table = work.table.filter(set => set.length);
      work.table = work.table.map(set => setOK(state, set) ? arrange(state, set) : set);
      sel = []; BB.audio.tile(); render(false);
    }
    function backToRack() {
      const mine = new Set(state.racks[state.cur]);
      const back = sel.filter(id => mine.has(id)); if (!back.length) { BB.toast('판에 있던 타일은 랙으로 가져올 수 없어요'); return; }
      work.table.forEach(set => { for (const id of back) { const k = set.indexOf(id); if (k >= 0) set.splice(k, 1); } }); work.table = work.table.filter(s => s.length);
      for (const id of back) if (!work.rack.includes(id)) work.rack.push(id);
      sel = sel.filter(id => !back.includes(id)); render(false);
    }
    function sortedRack(st, rack) {
      const r = rack.slice();
      return sortMode ? r.sort((a, b) => (st.tiles[a].j - st.tiles[b].j) || (st.tiles[a].n - st.tiles[b].n) || (st.tiles[a].c - st.tiles[b].c))
        : r.sort((a, b) => (st.tiles[a].j - st.tiles[b].j) || (st.tiles[a].c - st.tiles[b].c) || (st.tiles[a].n - st.tiles[b].n));
    }
    // 배치 계산 → 각 타일 목표 위치
    function layoutGoals(st) {
      const showWork = myTurn() && work && workFor === st.turnNo;
      const tbl = showWork ? work.table : st.table;
      const goals = {}, setBoxes = [];
      // 판: 줄 바꿈하며 세트 배치
      const narrow = innerWidth < innerHeight, maxW = narrow ? 11 : 22, X0 = -maxW / 2, gx = TW + 0.05; let x = X0, z = -5.3, rowH = TD + 0.32;
      tbl.forEach((set, si) => {
        const w = set.length * gx + 0.9;
        if (x + w > X0 + maxW && x > X0) { x = X0; z += rowH; }
        set.forEach((id, k) => { goals[id] = {x: x + k * gx + TW / 2, y: Y + TH / 2, z, rx: 0, up: sel.includes(id) ? 0.35 : 0}; });
        setBoxes.push({si, x0: x, x1: x + set.length * gx, z, ok: setOK(st, set)});
        x += w;
      });
      const newZ = x + 2.6 > X0 + maxW ? z + rowH : z, newX = x + 2.6 > X0 + maxW ? X0 : x;
      // 랙 (보는 사람)
      const v = ctx.viewer();
      const rack = showWork ? sortedRack(st, work.rack) : sortedRack(st, st.racks[v] || []);
      const perRow = narrow ? Math.max(8, Math.ceil(rack.length / 3)) : Math.max(16, Math.ceil(rack.length / 2));
      rack.forEach((id, k) => { const row = Math.floor(k / perRow), col = k % perRow, cnt = Math.min(perRow, rack.length - row * perRow);
        goals[id] = {x: (col - (cnt - 1) / 2) * (TW + 0.06), y: 1.0 + row * 0.02, z: 3.95 + row * (narrow ? 0.95 : 1.0), rx: 0.95, up: sel.includes(id) ? 0.3 : 0, rack: true}; });
      // 다른 사람 랙: 뒤쪽에 뒷면으로
      const others = st.players.map((p, i) => i).filter(i => i !== v);
      others.forEach((s, oi) => {
        const r = st.racks[s], cx = (oi - (others.length - 1) / 2) * 7.6;
        r.forEach((id, k) => { if (goals[id]) return; const col = k % 10, row = Math.floor(k / 10); goals[id] = {x: cx + (col - 4.5) * 0.5, y: Y + TH / 2 + row * TH, z: -7.1, rx: Math.PI, sc: 0.55, hidden: true}; });
      });
      // 풀
      st.pool.forEach((id, k) => { goals[id] = {x: 11.6 + (k % 2) * 0.1, y: Y + TH / 2 + Math.floor(k / 2) * 0.05, z: -5.2, rx: Math.PI, sc: 0.9, hidden: true, pool: true}; });
      return {goals, setBoxes, newX, newZ, showWork};
    }
    function render(instant) {
      const st = state; if (!st) return;
      const L = layoutGoals(st);
      for (const id in L.goals) {
        const m = tm(st, +id), g = L.goals[id];
        m.material[2] = g.hidden ? m.userData.backM : m.userData.topM;
        const sc = g.sc || 1;
        m.scale.setScalar(sc); m.visible = !g.pool || st.pool.indexOf(+id) >= st.pool.length - 2;
        const tx = g.x, ty = g.y + (g.up || 0), tz = g.z;
        if (instant) { m.position.set(tx, ty, tz); m.rotation.set(g.rx, 0, 0); }
        else { m.userData.dest = [tx, ty, tz, g.rx]; }
      }
      poolLbl.material.map = BB.label('남은 타일 ' + st.pool.length, {size: 0.45}).material.map;
      // 세트 표시판 · 붙이기 칸
      for (const d of drops) root.remove(d); drops.length = 0; for (const mk of marks) root.remove(mk); marks.length = 0;
      for (const b of L.setBoxes) {
        const plate = new THREE.Mesh(new THREE.BoxGeometry(b.x1 - b.x0 + 0.12, 0.04, TD + 0.12), new THREE.MeshBasicMaterial({color: b.ok ? 0x5ef2c8 : 0xff4d6d, transparent: true, opacity: b.ok ? 0.28 : 0.6}));
        plate.position.set((b.x0 + b.x1) / 2, Y + 0.02, b.z); root.add(plate); marks.push(plate);
        if (L.showWork && sel.length) {
          const d = new THREE.Mesh(new THREE.BoxGeometry(TW * 0.8, 0.1, TD), new THREE.MeshLambertMaterial({color: 0x5ef2c8, emissive: 0x1a6650, transparent: true, opacity: 0.85}));
          d.position.set(b.x1 + 0.45, Y + 0.06, b.z); d.userData.pick = true; d.userData.info = ['여기에 붙이기', '고른 타일을 이 세트 끝에 붙여요.', '배치']; const si = b.si; d.userData.onPick = () => moveSelTo(si);
          const plus = BB.label('＋', {size: 0.7, bg: 'none', color: '#0b5a46'}); plus.position.set(0, 0.25, 0); d.add(plus);
          root.add(d); BB.pickables.push(d); drops.push(d);
        }
      }
      if (L.showWork && sel.length) {
        const d = new THREE.Mesh(new THREE.BoxGeometry(TW * 3, 0.1, TD), new THREE.MeshLambertMaterial({color: 0xffd166, emissive: 0x664400, transparent: true, opacity: 0.85}));
        d.position.set(L.newX + TW * 1.5, Y + 0.06, L.newZ); d.userData.pick = true; d.userData.info = ['새 세트', '고른 타일로 새 줄을 만들어요.', '배치']; d.userData.onPick = () => moveSelTo(-1);
        const lb = BB.label('새 세트', {size: 0.45}); lb.position.set(0, 0.4, 0); d.add(lb); root.add(d); BB.pickables.push(d); drops.push(d);
      }
      hud(st, L);
    }
    async function animate(dur) {
      const jobs = [];
      for (const id in meshes) { const m = meshes[id], d = m.userData.dest; if (!d) continue; m.userData.dest = null;
        if (Math.abs(m.position.x - d[0]) + Math.abs(m.position.y - d[1]) + Math.abs(m.position.z - d[2]) + Math.abs(m.rotation.x - d[3]) < 0.01) continue;
        const a = [m.position.x, m.position.y, m.position.z, m.rotation.x];
        jobs.push(BB.tween(dur, k => { m.position.set(a[0] + (d[0] - a[0]) * k, a[1] + (d[1] - a[1]) * k + Math.sin(k * Math.PI) * 0.6, a[2] + (d[2] - a[2]) * k); m.rotation.x = a[3] + (d[3] - a[3]) * k; }, 'inout')); }
      await Promise.all(jobs);
    }
    function hud(st, L) {
      if (st.winner >= 0) { BB.msg(''); BB.acts([]); return; }
      const s = st.cur, nm = `<b>${BB.esc(st.players[s].name)}</b>`;
      if (!myTurn()) { BB.msg(`${nm} 차례 · ${ctx.canAct(s) ? '' : '생각하는 중…'}`); BB.acts([{t: sortMode ? '색깔순 정렬' : '숫자순 정렬', cls: 'sm', fn: () => { sortMode ^= 1; render(false); animate(0.25); }}]); return; }
      const changed = L.showWork && (work.rack.length !== st.racks[s].length || JSON.stringify(work.table) !== JSON.stringify(st.table));
      const err = changed ? checkPlay(st, s, work.table) : '';
      let info = '';
      if (!st.melded[s] && L.showWork) { const used = new Set(); st.table.forEach(os => { const k = work.table.findIndex((ns, i) => !used.has(i) && sameSet(ns, os)); if (k >= 0) used.add(k); }); const sum = work.table.reduce((a, ns, i) => a + (used.has(i) ? 0 : setValue(st, ns)), 0); info = ` · 첫 등록 합 <b>${sum}</b>/30`; }
      BB.msg(`${nm} 차례${info} · ${sel.length ? `${sel.length}개 고름 — ＋칸이나 [새 세트]를 누르세요` : '타일을 눌러 고르세요'}${changed && err ? `<br><span style="color:#ffb3c1">${BB.esc(err)}</span>` : ''}`);
      BB.acts([
        sel.length ? {t: '새 세트로', cls: 'pri', fn: () => moveSelTo(-1)} : null,
        sel.length ? {t: '랙으로', fn: backToRack} : null,
        changed ? {t: '✔ 확정', cls: 'pri', dis: !!err, fn: () => { const tbl = work.table.map(x => x.slice()); if (ctx.dispatch({t: 'play', table: tbl}, s)) { work = null; sel = []; } }} : null,
        changed ? {t: '↺ 처음으로', fn: () => { resetWork(); render(false); animate(0.3); }} : null,
        !changed ? {t: st.pool.length ? '타일 뽑기 (넘기기)' : '넘기기', cls: 'warn', fn: () => { work = null; sel = []; ctx.dispatch({t: 'draw'}, s); }} : null,
        {t: sortMode ? '색깔순' : '숫자순', cls: 'sm', fn: () => { sortMode ^= 1; render(false); animate(0.25); }}
      ]);
    }
    const _render = render; // 클릭 후 바로 애니메이션
    render = function (instant) { _render(instant); if (!instant) animate(0.22); };
    return {
      async sync(st, evs) {
        const first = !state; state = st;
        if (work && workFor !== st.turnNo) { work = null; sel = []; }
        if (myTurn() && (!work || workFor !== st.turnNo)) resetWork();
        if (first) { _render(true); }
        for (const e of evs) {
          if (e.t === 'draw') BB.audio.tile();
          else if (e.t === 'play') {
            BB.audio.tile();
            _render(false); await animate(0.45);
            if (e.aug) { BB.audio.bonus(); BB.toast('개시 코돈 AUG 보너스!', '1-2-3 사슬 완성 · 번역 개시!', 1800); BB.burst(0, 1.5, -2, ['#12b981', '#ff5d5d', '#f2a20c', '#3b7ff6', '#ffffff'], 80, 1.1); await BB.wait(700); }
            else if (e.first) { BB.audio.coin(); BB.toast('첫 등록 성공!', e.value + ' kDa 단백질 합성 개시', 1300); }
          } else if (e.t === 'pass') BB.toast('넘기기', st.players[e.seat].name, 900);
          else if (e.t === 'turn') BB.audio.turn();
        }
        _render(false); await animate(0.35);
      },
      destroy() {}
    };
  }
  G.lobbyModel = function () {
    const g = new THREE.Group();
    g.add(BB.vox([[0, 0, 0, 3.2, 0.2, 3.2, '#2f7a5c']]));
    const cols = ['#12b981', '#ff5d5d', '#f2a20c', '#3b7ff6'];
    for (let i = 0; i < 4; i++) { const t = BB.vox([[0, 0, 0, 0.55, 0.16, 0.75, '#fffaf0'], [0, 0.16, 0, 0.3, 0.02, 0.4, cols[i]]]); t.position.set(-1.0 + i * 0.66, 0.2, -0.5); g.add(t); }
    for (let i = 0; i < 3; i++) { const t = BB.vox([[0, 0, 0, 0.55, 0.16, 0.75, '#fffaf0'], [0, 0.16, 0, 0.3, 0.02, 0.4, cols[3]]]); t.position.set(-0.6 + i * 0.66, 0.2, 0.6); g.add(t); }
    return g;
  };
  BB.rummiRules = {analyze, checkPlay, aiPlay, genCandidates};
})();
