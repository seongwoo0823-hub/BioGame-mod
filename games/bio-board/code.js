/* 게임 3: 게놈 해독 코드 — 숨긴 번호 추리 게임 (흑색 DNA 주형 0~11+메틸화 조커 · 백색 mRNA 0~11+인트론 조커) */
'use strict';
BB.GAMES = BB.GAMES || {};
(function () {
  const J = 12; // 조커 값
  const COLN = ['DNA 주형 가닥 (흑색)', 'mRNA 전사 가닥 (백색)'];
  const JOKN = ['DNA 메틸화 마커', '스플라이싱 인트론'];
  const vname = (t) => t.v === J ? '−' : String(t.v);
  const key = t => t.v * 2 + t.c;   // 같은 숫자면 흑색(0)이 왼쪽
  // 손패에 넣기: 조커가 아니면 조커를 건너뛰며 정렬 위치에, 조커면 pos(없으면 맨 뒤)
  function insert(st, hand, tid, pos) {
    const t = st.tiles[tid];
    if (t.v === J) { const p = pos == null ? hand.length : Math.max(0, Math.min(hand.length, pos)); hand.splice(p, 0, tid); return p; }
    let i = 0;
    for (; i < hand.length; i++) { const u = st.tiles[hand[i]]; if (u.v !== J && key(u) > key(t)) break; }
    // 바로 앞이 조커들이고 그 앞 숫자가 더 크면 조커 앞쪽으로
    hand.splice(i, 0, tid); return i;
  }
  function alive(st) { return st.players.map((p, i) => p.out ? -1 : i).filter(i => i >= 0); }
  function nextTurn(st, ev) {
    st.pending = null; st.phase = 'draw';
    const n = st.players.length;
    for (let k = 1; k <= n; k++) { const c = (st.cur + k) % n; if (!st.players[c].out) { st.cur = c; break; } }
    if (!st.pool.length) st.phase = 'guess';
    ev.push({t: 'turn', seat: st.cur});
  }
  function checkOut(st, s, ev) {
    const p = st.players[s];
    if (!p.out && p.hand.every(t => st.rev[t])) { p.out = true; st.outOrder.push(s); ev.push({t: 'out', seat: s}); }
    const al = alive(st); if (al.length === 1) st.winner = al[0];
  }
  function endTurnKeep(st, s, ev, revealed) { // 뽑아 둔 타일을 내 줄에 넣고 차례 끝
    const p = st.players[s];
    if (st.pending != null) {
      const tid = st.pending, t = st.tiles[tid];
      if (revealed) st.rev[tid] = 1;
      if (t.v === J && st.jpos != null) insert(st, p.hand, tid, st.jpos); else insert(st, p.hand, tid, t.v === J ? BB.ri(p.hand.length + 1) : null);
      ev.push({t: 'place', seat: s, tid, revealed: !!revealed});
      st.pending = null; st.jpos = null;
    } else if (revealed) { // 더 뽑을 타일이 없으면 내 숨긴 타일 하나를 공개
      const hid = p.hand.filter(t => !st.rev[t]); if (hid.length) { const t = hid[BB.ri(hid.length)]; st.rev[t] = 1; ev.push({t: 'reveal', seat: s, tid: t, self: 1}); }
    }
    checkOut(st, s, ev);
    if (st.winner < 0) nextTurn(st, ev);
  }

  const G = BB.GAMES.code = {
    id: 'code', name: '게놈 해독 코드', short: '게놈 해독', sub: '상대 연구원의 숨겨진 DNA·mRNA 번호와 후성유전 마커를 추리해 게놈 지도를 해독하는 마인드 게임', color: 0xa9b8ff, min: 2, max: 4, hidden: true, aiDelay: 900,
    rules: `<ul><li>흑색(DNA 주형 가닥) 0~11, 백색(mRNA 전사 가닥) 0~11, 조커 2개(흑: <b>DNA 메틸화 마커</b> · 백: <b>스플라이싱 인트론</b>) — 총 26개.</li>
      <li>2~3명은 4개, 4명은 3개씩 받아 <b>왼쪽부터 작은 수 순서</b>로 세워요. 같은 숫자면 흑색이 왼쪽. 조커(−)는 아무 자리에나 둘 수 있어요.</li>
      <li>차례마다 가운데 유전자 풀에서 1개를 뽑고, 상대의 숨긴 타일 하나를 골라 번호를 맞혀요.</li>
      <li><b>맞히면</b> 그 타일이 공개되고, 계속 맞힐지(연속 해독) 멈출지 골라요. 멈추면 뽑은 타일을 숨긴 채 내 줄에 넣어요.</li>
      <li><b>틀리면</b> 뽑은 타일을 공개한 채로 내 줄에 넣고 차례가 끝나요.</li>
      <li>타일이 모두 공개된 사람은 탈락. 마지막까지 남은 사람이 승리!</li></ul>`,
    init(seats) {
      const tiles = []; for (let c = 0; c < 2; c++) for (let v = 0; v <= J; v++) tiles.push({c, v});
      const pool = BB.shuffle(tiles.map((t, i) => i));
      const per = seats.length >= 4 ? 3 : 4;
      const st = {tiles, pool, rev: {}, wrong: {}, players: seats.map(s => ({name: s.name, char: s.char, hand: [], out: false})), cur: 0, phase: 'draw', pending: null, jpos: null, winner: -1, outOrder: [], log: []};
      st.players.forEach(p => { for (let k = 0; k < per; k++) { const tid = pool.pop(); insert(st, p.hand, tid, st.tiles[tid].v === J ? BB.ri(p.hand.length + 1) : null); } });
      return st;
    },
    current(st) { return st.winner >= 0 ? -1 : st.cur; },
    playerInfo(st) { return st.players.map(p => ({sub: p.out ? '해독 완료(탈락)' : `숨김 ${p.hand.filter(t => !st.rev[t]).length}/${p.hand.length}`, out: p.out})); },
    act(st, a, s) {
      if (st.winner >= 0 || s !== st.cur) return null;
      const ev = [], p = st.players[s];
      if (a.t === 'draw') {
        if (st.phase !== 'draw' || !st.pool.length) return null;
        st.pending = st.pool.pop(); st.phase = 'guess'; ev.push({t: 'draw', seat: s, tid: st.pending});
        return ev;
      }
      if (a.t === 'jpos') { if (st.pending == null || st.tiles[st.pending].v !== J) return null; st.jpos = Math.max(0, Math.min(p.hand.length, a.i | 0)); ev.push({t: 'jpos', seat: s, i: st.jpos}); return ev; }
      if (a.t === 'guess') {
        if (st.phase !== 'guess') return null;
        const tp = st.players[a.target]; if (!tp || a.target === s || tp.out) return null;
        const tid = a.tid; if (!tp.hand.includes(tid) || st.rev[tid]) return null;
        const v = a.v | 0; if (v < 0 || v > J) return null;
        const t = st.tiles[tid];
        if (t.v === v) {
          st.rev[tid] = 1; ev.push({t: 'hit', seat: s, target: a.target, tid, v});
          checkOut(st, a.target, ev);
          if (st.winner >= 0) { if (st.pending != null) { insert(st, p.hand, st.pending, null); st.pending = null; } return ev; }
          st.phase = 'cont'; return ev;
        }
        (st.wrong[tid] = st.wrong[tid] || []).push(v);
        ev.push({t: 'miss', seat: s, target: a.target, tid, v});
        endTurnKeep(st, s, ev, true);
        return ev;
      }
      if (a.t === 'again') { if (st.phase !== 'cont') return null; st.phase = 'guess'; ev.push({t: 'again', seat: s}); return ev; }
      if (a.t === 'stop') { if (st.phase !== 'cont') return null; endTurnKeep(st, s, ev, false); return ev; }
      return null;
    },
    result(st) {
      if (st.winner < 0) return null;
      const order = [st.winner].concat(st.outOrder.slice().reverse());
      return {winner: st.winner, text: '마지막까지 게놈 서열을 지켜 낸 연구원이 승리했어요!', rank: order.map((s, i) => ({seat: s, note: i === 0 ? '생존' : '탈락'}))};
    },
    // ---------- AI: 소거법 추리 ----------
    ai(st, s, lv) {
      if (st.phase === 'draw') return {t: 'draw'};
      if (st.phase === 'cont') {
        const best = bestGuess(st, s, lv);
        const go = best && (lv === 2 ? best.cands.length <= 2 : lv === 1 ? best.cands.length === 1 : Math.random() < 0.25);
        return {t: go ? 'again' : 'stop'};
      }
      if (st.pending != null && st.tiles[st.pending].v === J && st.jpos == null) { return {t: 'jpos', i: BB.ri(st.players[s].hand.length + 1)}; }
      const best = bestGuess(st, s, lv); if (!best) return null;
      const w = best.cands; let v = w[BB.ri(w.length)];
      if (lv >= 1 && w.length > 1 && w.includes(J) && Math.random() < 0.75) { const nz = w.filter(x => x !== J); v = nz[BB.ri(nz.length)]; }
      return {t: 'guess', target: best.target, tid: best.tid, v};
    },
    fallback(st, s) {
      if (st.phase === 'draw') return {t: 'draw'}; if (st.phase === 'cont') return {t: 'stop'};
      for (let o = 0; o < st.players.length; o++) { if (o === s || st.players[o].out) continue; const tid = st.players[o].hand.find(t => !st.rev[t]); if (tid != null) return {t: 'guess', target: o, tid, v: 0}; }
      return null;
    },
    createView
  };
  // s의 입장에서 tid(상대 o의 손패 idx 위치)가 될 수 있는 값
  function candidates(st, s, o, idx, lv) {
    const hand = st.players[o].hand, tid = hand[idx], t = st.tiles[tid];
    const known = new Set();
    // 내가 아는 타일: 내 손패 전부 + 뽑아 둔 타일 + 공개된 타일
    const mine = st.players[s].hand.concat(st.pending != null && st.cur === s ? [st.pending] : []);
    for (const k of mine) if (st.tiles[k].c === t.c) known.add(st.tiles[k].v);
    for (const k in st.rev) if (st.rev[k] && st.tiles[k].c === t.c) known.add(st.tiles[k].v);
    const wrong = new Set(st.wrong[tid] || []);
    let lo = -1, hi = 99, loKey = -1, hiKey = 999;
    if (lv >= 1) { // 이웃한 공개 타일로 범위 좁히기 (조커는 건너뜀)
      for (let i = idx - 1; i >= 0; i--) { const u = st.tiles[hand[i]]; if (u.v === J) continue; if (st.rev[hand[i]]) { loKey = key(u); break; } }
      for (let i = idx + 1; i < hand.length; i++) { const u = st.tiles[hand[i]]; if (u.v === J) continue; if (st.rev[hand[i]]) { hiKey = key(u); break; } }
      if (lv >= 2) { // 사이에 숨긴 타일 수만큼 더 좁히기
        let left = 0, right = 0;
        for (let i = idx - 1; i >= 0; i--) { const u = st.tiles[hand[i]]; if (st.rev[hand[i]] && u.v !== J) break; if (!st.rev[hand[i]]) left++; }
        for (let i = idx + 1; i < hand.length; i++) { const u = st.tiles[hand[i]]; if (st.rev[hand[i]] && u.v !== J) break; if (!st.rev[hand[i]]) right++; }
        lo = left; hi = right; // 사용: 아래에서 키 간격
      }
    }
    const out = [];
    for (let v = 0; v <= J; v++) {
      if (known.has(v) || wrong.has(v)) continue;
      if (v === J) { out.push(v); continue; }
      const k = v * 2 + t.c;
      if (k <= loKey || k >= hiKey) continue;
      if (lv >= 2 && lo >= 0 && hi < 99) { // 왼쪽에 숨긴 타일 lo개가 들어갈 자리가 있어야 함 (조커 가능성 때문에 느슨하게)
        if (loKey >= 0 && Math.floor((k - loKey - 1) / 1) < Math.max(0, lo - 2)) continue;
      }
      out.push(v);
    }
    // 조커는 이미 보였으면 후보에서 빼기
    const jt = st.tiles.findIndex(x => x.c === t.c && x.v === J);
    if (st.rev[jt] || mine.includes(jt)) { const i = out.indexOf(J); if (i >= 0) out.splice(i, 1); }
    return out;
  }
  function bestGuess(st, s, lv) {
    let best = null;
    st.players.forEach((p, o) => {
      if (o === s || p.out) return;
      p.hand.forEach((tid, idx) => {
        if (st.rev[tid]) return;
        const c = candidates(st, s, o, idx, lv === 0 ? 0 : lv);
        const score = c.length + (lv === 0 ? Math.random() * 6 : Math.random() * 0.3);
        if (c.length && (!best || score < best.score)) best = {target: o, tid, cands: c, score};
      });
    });
    return best;
  }

  // ---------- 3D ----------
  function createView(ctx) {
    const root = BB.root; BB.scene.background.set(0xb4bdea);
    BB.setView({tx: 0, ty: 0, tz: 0.6, az: 0.0001, el: 0.82, zoom: 7.6}); BB.view.minZ = 4; BB.view.maxZ = 14;
    root.add(BB.ground(18, 0x5a68b0, 0x7c8ad0));
    const table = BB.vox([[0, 0, 0, 12, 0.5, 12, '#5a4a7a'], [0, 0.5, 0, 11.4, 0.06, 11.4, '#2f6a5a']]); root.add(table);
    const TOP = 0.56;
    // 가운데 유전자 풀
    const poolG = new THREE.Group(); root.add(poolG);
    const pl = BB.label('유전자 풀', {size: 0.42}); pl.position.set(0, 1.6, -0.6); root.add(pl);
    const W = 0.78, Hh = 1.15, D = 0.36;
    const faceTex = (t, open) => BB.textTex('dv' + t.c + '-' + t.v + (open ? 'o' : ''), (g, w, h) => {
      g.fillStyle = t.c ? '#f6f7fb' : '#1e2638'; g.fillRect(0, 0, w, h);
      g.strokeStyle = t.c ? '#c8cede' : '#3a4560'; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8);
      g.fillStyle = t.c ? '#1e2638' : '#f6f7fb'; g.textAlign = 'center'; g.textBaseline = 'middle';
      if (t.v === J) { g.font = BB.font(96); g.fillText('−', w / 2, h / 2 - 8); g.font = BB.font(20, 800); g.fillText(t.c ? '인트론' : '메틸화', w / 2, h - 30); }
      else { g.font = BB.font(100); g.fillText(String(t.v), w / 2, h / 2 - 4); if (t.v === 6 || t.v === 9) { g.fillRect(w / 2 - 22, h - 40, 44, 6); } }
      g.font = BB.font(18, 800); g.fillStyle = t.c ? '#7a8498' : '#8a96b8'; g.fillText(t.c ? 'mRNA' : 'DNA', w / 2, 24);
    }, 128, 192);
    const backTex = c => BB.textTex('dvb' + c, (g, w, h) => { g.fillStyle = c ? '#eef0f7' : '#232c40'; g.fillRect(0, 0, w, h); g.strokeStyle = c ? '#d0d6e6' : '#3a4560'; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8);
      g.strokeStyle = c ? '#b6bfd6' : '#4a5a80'; g.lineWidth = 6; g.beginPath(); for (let y = 30; y < h - 20; y += 6) { const x = w / 2 + Math.sin(y / 14) * 26; if (y === 30) g.moveTo(x, y); else g.lineTo(x, y); } g.stroke();
      g.beginPath(); for (let y = 30; y < h - 20; y += 6) { const x = w / 2 - Math.sin(y / 14) * 26; if (y === 30) g.moveTo(x, y); else g.lineTo(x, y); } g.stroke(); }, 128, 192);
    const meshes = {};
    function tileMesh(st, tid) {
      if (meshes[tid]) return meshes[tid];
      const t = st.tiles[tid];
      const side = new THREE.MeshLambertMaterial({color: t.c ? 0xe6e9f2 : 0x2a3348});
      const front = new THREE.MeshLambertMaterial({map: faceTex(t)}), back = new THREE.MeshLambertMaterial({map: backTex(t.c)});
      const m = new THREE.Mesh(new THREE.BoxGeometry(W, Hh, D), [side, side, side, side, front, back]);
      m.castShadow = true; m.receiveShadow = true; m.userData.pick = true; m.userData.tid = tid; m.userData.front = front; m.userData.backM = back;
      root.add(m); BB.pickables.push(m); meshes[tid] = m; return m;
    }
    let state = null;
    // 자리 배치: 보는 사람(viewer)이 앞(아래쪽), 나머지는 시계 방향
    function seatSide(st, s) { const n = st.players.length, v = ctx.viewer(); const rel = (s - v + n) % n; if (n === 2) return rel === 0 ? 0 : 2; if (n === 3) return [0, 1, 3][rel]; return rel; }
    function sideTransform(side) { // 0 앞, 1 왼쪽, 2 뒤, 3 오른쪽 → [중심x, 중심z, 바라보는 각]
      return [[0, 4.3, 0], [-4.3, 0, -Math.PI / 2], [0, -4.3, Math.PI], [4.3, 0, Math.PI / 2]][side];
    }
    function layout(st, instant) {
      const v = ctx.viewer();
      const placed = new Set();
      st.players.forEach((p, s) => {
        const side = seatSide(st, s), [cx, cz, ang] = sideTransform(side);
        const n = p.hand.length, gap = W + 0.08;
        p.hand.forEach((tid, i) => {
          const m = tileMesh(st, tid); placed.add(tid);
          const off = (i - (n - 1) / 2) * gap;
          const x = cx + Math.cos(ang) * off, z = cz - Math.sin(ang) * off;
          const t = st.tiles[tid], rev = !!st.rev[tid], mine = s === v;
          // 앞면(+z)이 주인을 바라봄. 공개된 타일은 뒤로 눕혀 모두에게 보이게
          let rx = 0, y = TOP + Hh / 2;
          if (rev) { rx = -1.25; y = TOP + 0.35; }
          m.userData.goal = {x, y, z, ry: ang, rx};
          m.material[4] = rev || mine ? m.userData.front : m.userData.backM;   // 남의 숨긴 타일은 앞면에도 번호 없음 (판을 돌려도 안 보임)
          m.userData.info = rev ? [COLN[t.c] + ' ' + vname(t), t.v === J ? JOKN[t.c] + ' — 조커! 아무 자리에나 놓을 수 있어요.' : '공개된 타일', '공개'] : mine ? [COLN[t.c] + ' ' + vname(t) + ' (내 타일)', '상대는 아직 이 번호를 몰라요.', '숨김'] : [COLN[t.c] + ' (숨김)', s === st.cur ? '' : '누르면 번호를 추리해요. ' + (t.c ? 'mRNA는 DNA를 주형으로 전사돼요(T 대신 U).' : 'DNA 주형 가닥의 염기 서열이 mRNA로 전사돼요.'), '추리 대상'];
          m.userData.seat = s;
        });
      });
      // 뽑아 둔 타일 (내 앞 오른쪽에 세움)
      if (st.pending != null) {
        const m = tileMesh(st, st.pending); placed.add(st.pending);
        const side = seatSide(st, st.cur), [cx, cz, ang] = sideTransform(side);
        const x = cx * 0.55 + Math.cos(ang) * 3.4, z = cz * 0.55 - Math.sin(ang) * 3.4;
        m.userData.goal = {x, y: TOP + Hh / 2 + 0.05, z, ry: ang, rx: 0.15};
        m.material[4] = st.cur === v ? m.userData.front : m.userData.backM;
        m.userData.info = ['방금 뽑은 타일', st.cur === v ? '맞히면 숨긴 채로, 틀리면 공개된 채로 내 줄에 들어가요.' : '', '뽑은 타일'];
      }
      // 풀
      st.pool.forEach((tid, i) => {
        const m = tileMesh(st, tid); placed.add(tid);
        const col = i % 7, row = Math.floor(i / 7);
        m.userData.goal = {x: (col - 3) * 0.86, y: TOP + D / 2, z: (row - 1.5) * 0.9 + 0.3, ry: 0, rx: Math.PI / 2};   // 뒷면이 위로
        m.material[4] = m.userData.backM;
        m.userData.info = ['유전자 풀', `남은 타일 ${st.pool.length}개. 차례마다 1개씩 뽑아요.`, '풀'];
      });
      for (const tid in meshes) { const m = meshes[tid]; const g = m.userData.goal; if (!g) continue;
        if (instant) { m.position.set(g.x, g.y, g.z); m.rotation.set(g.rx, g.ry, 0, 'YXZ'); } }
    }
    async function animateAll(dur) {
      const jobs = [];
      for (const tid in meshes) {
        const m = meshes[tid], g = m.userData.goal; if (!g) continue;
        m.rotation.order = 'YXZ';
        const a = {x: m.position.x, y: m.position.y, z: m.position.z, rx: m.rotation.x, ry: m.rotation.y};
        let dry = g.ry - a.ry; dry = ((dry + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
        if (Math.abs(a.x - g.x) + Math.abs(a.y - g.y) + Math.abs(a.z - g.z) + Math.abs(a.rx - g.rx) + Math.abs(dry) < 0.01) continue;
        jobs.push(BB.tween(dur, k => { m.position.set(a.x + (g.x - a.x) * k, a.y + (g.y - a.y) * k + Math.sin(k * Math.PI) * 0.5, a.z + (g.z - a.z) * k); m.rotation.x = a.rx + (g.rx - a.rx) * k; m.rotation.y = a.ry + dry * k; }, 'inout'));
      }
      await Promise.all(jobs);
    }
    // 내 타일 위 번호는 내 쪽에서만 읽힘: 다른 사람 앞면은 카메라 반대쪽을 봄 → 자동으로 숨겨짐
    function guessModal(st, target, tid) {
      const t = st.tiles[tid], wrong = new Set(st.wrong[tid] || []);
      const btn = v => `<button type="button" data-v="${v}" class="${wrong.has(v) ? 'x' : ''}" style="${t.c ? 'background:#f2f4fa;color:#1e2638' : 'background:#1e2638;color:#fff'}">${v === J ? '−' : v}</button>`;
      const m = BB.modal(`<h2>번호 추리</h2><p class="sub">${BB.esc(st.players[target].name)}의 <b>${COLN[t.c]}</b> 타일. 몇 번일까요? (−는 조커: ${JOKN[t.c]})${wrong.size ? ' · 줄 친 번호는 이미 틀린 번호' : ''}</p>
        <div class="numgrid">${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, J].map(btn).join('')}</div><div class="row"><button class="btn" id="cx">취소</button></div>`);
      m.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { BB.closeModal(); ctx.dispatch({t: 'guess', target, tid, v: +b.dataset.v}, st.cur); });
      BB.$('cx').onclick = BB.closeModal;
    }
    BB.onPick = o => {
      if (!state || !o || o.userData.tid == null || ctx.busy()) return;
      const s = state.cur; if (!ctx.canAct(s) || state.phase !== 'guess') return;
      if (state.pending != null && state.tiles[state.pending].v === J && state.jpos == null) { BB.toast('먼저 조커를 놓을 자리를 골라요'); return; }
      const tid = o.userData.tid, owner = o.userData.seat;
      if (owner == null || owner === s || state.rev[tid] || !state.players[owner].hand.includes(tid)) return;
      guessModal(state, owner, tid);
    };
    function hud(st) {
      if (st.winner >= 0) { BB.msg(''); BB.acts([]); return; }
      const s = st.cur, p = st.players[s], me = ctx.canAct(s), nm = `<b>${BB.esc(p.name)}</b>`;
      if (st.phase === 'draw') { BB.msg(`${nm} 차례 · ${me ? '유전자 풀에서 타일을 뽑으세요' : '뽑는 중…'}`); BB.acts(me ? [{t: '🧬 타일 뽑기', cls: 'pri', fn: () => ctx.dispatch({t: 'draw'}, s)}] : []); return; }
      if (st.phase === 'guess') {
        if (me && st.pending != null && st.tiles[st.pending].v === J && st.jpos == null) {
          BB.msg(`${nm} · 조커(${JOKN[st.tiles[st.pending].c]})를 뽑았어요! 내 줄 어디에 둘지 골라요`);
          BB.acts(p.hand.map((tid, i) => ({t: i === 0 ? '맨 왼쪽' : vname(st.tiles[p.hand[i - 1]]) + ' 뒤', cls: 'sm', fn: () => ctx.dispatch({t: 'jpos', i}, s)})).concat([{t: '맨 오른쪽', cls: 'sm', fn: () => ctx.dispatch({t: 'jpos', i: p.hand.length}, s)}]));
          return;
        }
        BB.msg(`${nm} · ${me ? '상대의 숨긴 타일을 눌러 번호를 추리하세요' : '추리하는 중…'}${st.pool.length ? '' : ' (풀이 비었어요: 틀리면 내 타일 하나가 공개돼요)'}`); BB.acts([]); return;
      }
      if (st.phase === 'cont') { BB.msg(`${nm} · 해독 성공! 계속 추리할까요?`); BB.acts(me ? [{t: '연속 해독', cls: 'pri', fn: () => ctx.dispatch({t: 'again'}, s)}, {t: '멈추고 내 타일 숨기기', fn: () => ctx.dispatch({t: 'stop'}, s)}] : []); }
    }
    return {
      async sync(st, evs) {
        const first = !state; state = st;
        if (first) { layout(st, true); }
        for (const e of evs) {
          if (e.t === 'draw') { BB.audio.flip(); }
          else if (e.t === 'hit') {
            layout(st, false); await animateAll(0.5);
            const m = meshes[e.tid]; BB.audio.flip(); BB.audio.decode(); BB.burst(m.position.x, m.position.y + 0.4, m.position.z, ['#5ef2c8', '#ffffff', '#9ad0ff'], 30, 0.6);
            BB.toast('해독 성공!', st.players[e.target].name + '의 ' + COLN[st.tiles[e.tid].c] + ' = ' + vname(st.tiles[e.tid]), 1500); await BB.wait(700);
          } else if (e.t === 'miss') { BB.audio.wrong(); BB.toast('해독 실패', `${e.v === J ? '조커' : e.v + '번'}이(가) 아니에요`, 1400); await BB.wait(500); }
          else if (e.t === 'place') { if (e.revealed) BB.toast('뽑은 타일 공개', COLN[st.tiles[e.tid].c] + ' ' + vname(st.tiles[e.tid]), 1100); BB.audio.tile(); }
          else if (e.t === 'out') { BB.audio.capture(); BB.toast('게놈 해독 완료!', st.players[e.seat].name + '의 서열이 모두 밝혀졌어요 (탈락)', 1600); await BB.wait(600); }
          else if (e.t === 'turn') BB.audio.turn();
          else if (e.t === 'viewer') {}
        }
        // 보는 사람이 바뀌면 자리 다시
        layout(st, false); await animateAll(evs.some(e => e.t === 'viewer') ? 0.6 : 0.45);
        hud(st);
      },
      destroy() { BB.onPick = null; }
    };
  }
  G.lobbyModel = function () {
    const g = new THREE.Group();
    g.add(BB.vox([[0, 0, 0, 3.2, 0.2, 3.2, '#2f6a5a']]));
    for (let i = 0; i < 5; i++) { const c = i % 2; const t = BB.vox([[0, 0, 0, 0.5, 0.75, 0.24, c ? '#f4f6ff' : '#1e2638']]); t.position.set(-1.1 + i * 0.55, 0.2, 0); t.rotation.y = 0.1; g.add(t); }
    const f = BB.vox([[0, 0, 0, 0.5, 0.24, 0.75, '#f4f6ff'], [0, 0.24, 0, 0.18, 0.02, 0.4, '#1e2638']]); f.position.set(0.4, 0.2, 0.9); g.add(f);
    return g;
  };
  BB.codeRules = {candidates, bestGuess, insert};
})();
