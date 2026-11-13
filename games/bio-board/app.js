/* 생명과학 보드게임 천국 — 로비 · 모드 선택 · 경기 진행 · 온라인(방 코드 6자리: PeerJS + 같은 기기 탭 BroadcastChannel) */
'use strict';
(function () {
  const {$, esc} = BB;
  const ORDER = ['rummi', 'cell', 'code', 'yut'];
  const LEVELS = [{id: 0, name: '유전자 수습생', sub: '초급'}, {id: 1, name: '세포 연구원', sub: '중급'}, {id: 2, name: '게놈 마스터', sub: '고급'}];
  BB.LEVELS = LEVELS;
  const ICONS = {
    rummi: '<svg viewBox="0 0 40 40"><rect x="4" y="9" width="10" height="16" rx="2.5" fill="#3fe0a0"/><rect x="15" y="9" width="10" height="16" rx="2.5" fill="#ffd166"/><rect x="26" y="9" width="10" height="16" rx="2.5" fill="#6aa8ff"/><rect x="4" y="27" width="32" height="5" rx="2" fill="#c9a27a"/></svg>',
    cell: '<svg viewBox="0 0 40 40"><rect x="5" y="5" width="30" height="30" rx="4" fill="none" stroke="#7cf5d4" stroke-width="5"/><circle cx="20" cy="20" r="6" fill="#ff7eb6"/><rect x="26" y="25" width="6" height="7" fill="#ffd166"/></svg>',
    code: '<svg viewBox="0 0 40 40"><rect x="6" y="8" width="9" height="22" rx="2" fill="#1f2a3c" stroke="#9fb4d8"/><rect x="17" y="8" width="9" height="22" rx="2" fill="#f4f6ff"/><rect x="28" y="8" width="7" height="22" rx="2" fill="#1f2a3c" stroke="#9fb4d8"/><text x="21.5" y="24" font-size="10" font-weight="900" text-anchor="middle" fill="#1f2a3c">7</text></svg>',
    yut: '<svg viewBox="0 0 40 40"><g transform="rotate(-18 20 20)"><rect x="7" y="6" width="5" height="28" rx="2.5" fill="#ffe0a8"/><rect x="14" y="6" width="5" height="28" rx="2.5" fill="#ffe0a8"/><rect x="21" y="6" width="5" height="28" rx="2.5" fill="#8a5a3a"/><rect x="28" y="6" width="5" height="28" rx="2.5" fill="#ffe0a8"/></g></svg>'
  };

  /* ================= 경기 진행 ================= */
  const M = BB.match = {game: null, G: null, state: null, seats: null, mode: null, host: true, view: null, queue: Promise.resolve(), busy: 0, mySeat: -1, viewer: 0, over: false, aiTimer: 0, coverFor: -1};
  BB.isHost = () => M.host;
  const ctx = {
    dispatch(a, seat) { return dispatch(a, seat == null ? curSeat() : seat); },
    // 이 기기에서 조작할 수 있는 자리인가
    canAct(seat) { if (M.over || seat < 0 || !M.seats[seat]) return false; const s = M.seats[seat]; if (s.type !== 'human') return false; if (M.mode === 'online') return seat === M.mySeat; return M.coverFor < 0; },
    viewer() { return M.viewer; },          // 비공개 패를 보여 줄 자리
    seats() { return M.seats; },
    mode() { return M.mode; },
    busy() { return M.busy > 0; }
  };
  BB.ctx = ctx;
  const curSeat = () => M.G ? M.G.current(M.state) : -1;

  function startMatch(gameId, seats, mode, opt) {
    clearTimeout(M.aiTimer);
    if (M.view) { try { M.view.destroy(); } catch (e) {} }
    M.token = (M.token || 0) + 1; M.queue = Promise.resolve(); M.busy = 0;
    M.game = gameId; M.G = BB.GAMES[gameId]; M.seats = seats; M.mode = mode; M.host = !(opt && opt.client); M.over = false; M.coverFor = -1;
    M.mySeat = opt && opt.mySeat != null ? opt.mySeat : seats.findIndex(s => s.type === 'human');
    M.viewer = M.mySeat >= 0 ? M.mySeat : 0;
    showGameUI(true);
    BB.newRoot(); BB.music(gameId);
    M.state = opt && opt.state ? opt.state : M.G.init(seats.map(s => ({name: s.name, char: s.char})));
    M.view = M.G.createView(ctx);
    renderPlayers();
    enqueue(M.state, [{t: 'start'}]);
    BB.audio.turn();
  }
  BB.startMatch = startMatch;

  function dispatch(a, seat) {
    if (M.over || !a) return false;
    if (!M.host) { net.toHost({t: 'act', a, seat}); return true; }
    const ev = M.G.act(M.state, a, seat);
    if (!ev) return false;
    if (M.mode === 'online') net.broadcast({t: 'state', state: M.state, ev});
    enqueue(M.state, ev);
    return true;
  }
  function enqueue(state, ev) {
    const snap = BB.clone(state), tok = M.token, view = M.view;
    M.busy++;
    M.queue = M.queue.then(async () => {
      if (tok !== M.token) return;
      try { await view.sync(snap, ev || []); } catch (e) { console.error(e); }
      if (tok !== M.token) return;
      M.busy--; renderPlayers(snap);
      if (M.busy === 0) afterSync(snap);
    });
  }
  function afterSync(snap) {
    const res = M.G.result(snap);
    if (res) { if (!M.over) { M.over = true; showResult(res); } return; }
    const cur = M.G.current(snap);
    if (cur < 0) return;
    const s = M.seats[cur];
    // 한 기기 여러 명: 비공개 정보가 있는 게임은 화면을 넘겨 줄 때 가림막
    if (M.mode === 'local' && s.type === 'human' && M.viewer !== cur) {
      if (M.G.hidden) { coverFor(cur); return; }
      M.viewer = cur; M.view.sync(BB.clone(M.state), [{t: 'viewer'}]);
    }
    if (s.type === 'ai' && M.host) {
      clearTimeout(M.aiTimer);
      M.aiTimer = setTimeout(() => {
        if (M.over || M.busy || M.G.current(M.state) !== cur) return;
        let a = null; try { a = M.G.ai(M.state, cur, s.level != null ? s.level : 1); } catch (e) { console.error(e); }
        if (!a || !dispatch(a, cur)) { const fb = M.G.fallback && M.G.fallback(M.state, cur); if (fb) dispatch(fb, cur); }
      }, (M.G.aiDelay || 650) * BB.timeScale);
    }
  }
  function coverFor(seat) {
    M.coverFor = seat;
    const s = M.seats[seat];
    BB.modal(`<h2>${esc(s.name)} 차례</h2><p class="sub">다른 사람은 화면을 보지 않게 해 주세요. 준비되면 아래 버튼을 눌러요.</p><div class="row"><button class="btn pri" id="cv">내 패 보기</button></div>`, {lock: true});
    $('cv').onclick = () => { BB.closeModal(); M.coverFor = -1; M.viewer = seat; M.view.sync(BB.clone(M.state), [{t: 'viewer'}]); };
  }
  function renderPlayers(st) {
    st = st || M.state; if (!M.G || !st) return;
    const cur = M.G.current(st), info = M.G.playerInfo ? M.G.playerInfo(st) : [];
    $('players').innerHTML = M.seats.map((s, i) => {
      const ch = BB.CHARS[s.char], pi = info[i] || {};
      return `<div class="pl glass ${i === cur ? 'on' : ''} ${pi.out ? 'out' : ''}" data-info='${esc(JSON.stringify(ch.info))}'><i style="background:${ch.color}">${i + 1}</i><div><b>${esc(s.name)}${i === M.mySeat && M.mode !== 'local' ? ' (나)' : ''}</b><small>${esc(pi.sub || (s.type === 'ai' ? 'AI · ' + LEVELS[s.level || 0].sub : s.type === 'remote' ? '온라인' : '사람'))}</small></div></div>`;
    }).join('');
    $('title').querySelector('b').textContent = M.G.name;
    $('title').querySelector('small').textContent = M.G.sub;
  }
  BB.renderPlayers = renderPlayers;
  function showResult(res) {
    BB.audio.fanfare();
    const w = M.seats[res.winner];
    if (w) { try { const k = 'bioBoardStats'; const st = JSON.parse(localStorage.getItem(k) || '{}') || {}; st.played = (st.played || 0) + 1; if (w.type === 'human') st.wins = (st.wins || 0) + 1; st[M.game] = (st[M.game] || 0) + 1; localStorage.setItem(k, JSON.stringify(st)); } catch (e) {} }
    const rk = rankResult(res);
    setTimeout(() => {
      BB.modal(`<h2>🏆 ${w ? esc(w.name) + ' 승리!' : '경기 끝'}</h2>${rk ? `<p class="sub" style="color:#9ff5dc">랭킹 점수 +${rk.gain} · ${esc(M.G.name)} 누적 <b>${rk.pts}점</b> (${rk.wins}승)</p>` : ''}<p class="sub">${esc(res.text || '')}</p>
        <div class="list">${(res.rank || []).map((r, i) => `<div><b style="width:22px">${i + 1}</b><span style="flex:1">${esc(M.seats[r.seat].name)}</span><small>${esc(r.note || '')}</small></div>`).join('')}</div>
        <div class="row">${M.mode !== 'online' || M.host ? '<button class="btn pri" id="again">한 판 더</button>' : ''}${rk && window.BioRank && BioRank.ready() ? '<button class="btn warn" id="sendRk">🏆 랭킹에 보내기</button>' : ''}<button class="btn" id="toLobby">로비로</button><button class="btn" id="toList">게임 목록</button></div>`, {lock: true});
      const sr = $('sendRk'); if (sr) sr.onclick = () => { BB.closeModal(); sendRank(rk); };
      $('toList').onclick = () => { location.href = '../index.html'; };
      const ag = $('again'); if (ag) ag.onclick = () => { BB.closeModal(); const seats = M.seats; if (M.mode === 'online') { net.startGame(); } else startMatch(M.game, seats, M.mode); };
      $('toLobby').onclick = () => { BB.closeModal(); toLobby(); };
    }, 900);
  }

  /* ---------- 랭킹: 게임마다 이긴 점수 누적 (AI 대결·온라인만) ---------- */
  const RANK_KEY = 'bioBoardRank';
  const rankLoad = () => { try { return JSON.parse(localStorage.getItem(RANK_KEY) || '{}') || {}; } catch (e) { return {}; } };
  function rankResult(res) {
    if (M.mode === 'local') return null;
    const me = M.mySeat, w = M.seats[res.winner]; if (me < 0 || res.winner !== me || !w) return null;
    // 점수 = 이긴 상대마다 (AI: 난이도 1~3점, 사람: 3점)
    let gain = 0, best = -1;
    M.seats.forEach((s, i) => { if (i === me) return; if (s.type === 'ai') { gain += (s.level || 0) + 1; best = Math.max(best, s.level || 0); } else { gain += 3; best = Math.max(best, 2); } });
    const d = rankLoad(), g = d[M.game] || {wins: 0, pts: 0, best: -1};
    g.wins++; g.pts += gain; g.best = Math.max(g.best, best); d[M.game] = g;
    try { localStorage.setItem(RANK_KEY, JSON.stringify(d)); } catch (e) {}
    return {gain, pts: g.pts, wins: g.wins, best: g.best, game: M.game};
  }
  function sendRank(rk) {
    if (!window.BioGoal) return;
    const G = BB.GAMES[rk.game];
    BioGoal.result('bio-board', rk.wins, {ok: true, title: G.name + ' 랭킹', text: `${G.name} · ${rk.pts}점 (${rk.wins}승)`,
      rank: {cat: G.name, v: BioGoal.key([[rk.pts, 1e6, 1], [rk.wins, 1e5, 1]]), f: {pts: rk.pts, wins: rk.wins, best: rk.best >= 0 ? LEVELS[rk.best].name : '-'}}});
  }
  BB.rankLoad = rankLoad;
  // 로비의 랭킹 창: 게임별 탭
  function rankModal(id) {
    id = id || ORDER[0];
    const mine = rankLoad()[id];
    const m = BB.modal(`<h2>🏆 보드게임 랭킹</h2><p class="sub">AI 대결·온라인에서 이기면 점수가 쌓여요 (이긴 상대마다 초급 1 · 중급 2 · 고급 3 · 사람 3점). 결과 창의 [랭킹에 보내기]로 올려요.</p>
      <div class="seg">${ORDER.map(g => `<button type="button" data-g="${g}" class="${g === id ? 'on' : ''}">${esc(BB.GAMES[g].short)}</button>`).join('')}</div>
      <div class="lbl">내 기록 (이 기기)</div><div class="list"><div><span style="flex:1">${mine ? `${mine.pts}점 · ${mine.wins}승 · 최고 난이도 ${mine.best >= 0 ? LEVELS[mine.best].name : '-'}` : '아직 기록이 없어요'}</span></div></div>
      <div class="lbl">공용 랭킹</div><div class="list" id="rkList"><div>${window.BioRank && BioRank.ready() ? '불러오는 중…' : '랭킹 서버가 설정되지 않았어요'}</div></div>
      <div class="row"><button class="btn" id="rkClose">닫기</button></div>`);
    m.querySelectorAll('[data-g]').forEach(b => b.onclick = () => rankModal(b.dataset.g));
    $('rkClose').onclick = BB.closeModal;
    if (window.BioRank && BioRank.ready()) BioRank.top('bio-board', BB.GAMES[id].name, 30).then(r => {
      const L = $('rkList'); if (!L) return;
      L.innerHTML = r.list.length ? r.list.map((x, i) => `<div><b style="width:24px">${i + 1}</b><span style="flex:1">${esc(x.sid)} ${esc(x.name)}</span><small>${esc((x.f && x.f.pts) || 0)}점 · ${esc((x.f && x.f.wins) || 0)}승</small></div>`).join('') : '<div>아직 아무도 올리지 않았어요. 첫 번째가 되어 보세요!</div>';
    }).catch(() => { const L = $('rkList'); if (L) L.innerHTML = '<div>랭킹을 불러오지 못했어요</div>'; });
  }
  BB.rankModal = rankModal;
  // 게임 중 메뉴: 계속 · 규칙 · 소리 · 다른 보드게임(로비) · 게임 목록
  function menuModal() {
    BB.modal(`<h2>메뉴</h2><p class="sub">${esc(M.G ? M.G.name : '')}</p><div class="list" style="gap:8px">
      <button class="btn pri" id="mResume">▶ 계속하기</button><button class="btn" id="mRules">📖 규칙 보기</button><button class="btn" id="mRank">🏆 랭킹</button>
      <button class="btn" id="mSound">${BB.soundLabel()}</button><button class="btn warn" id="mLobby">🎲 다른 보드게임 고르기 (로비)</button><button class="btn" id="mList">🏠 게임 목록으로</button></div>`);
    $('mResume').onclick = BB.closeModal; $('mRules').onclick = () => rulesModal(M.game); $('mRank').onclick = () => rankModal(M.game);
    $('mSound').onclick = () => { BB.cycleSound(); $('mSound').textContent = BB.soundLabel(); };
    $('mLobby').onclick = () => { BB.closeModal(); toLobby(); };
    $('mList').onclick = () => { location.href = '../index.html'; };
  }
  BB.menuModal = menuModal;
  // 소리: 음악+효과음 → 효과음만 → 끔
  BB.soundLabel = () => window.LyricAudio ? LyricAudio.label : (BB.audio.muted ? '🔇 소리 끔' : '🔔 소리 켬');
  BB.cycleSound = () => { BB.audio.unlock(); if (window.LyricAudio) { const m = LyricAudio.cycle(); BB.audio.setMuted(m === 'off'); } else BB.audio.setMuted(!BB.audio.muted); };
  BB.music = name => { if (window.LyricAudio) LyricAudio.theme(name); };
  addEventListener('keydown', e => { if (e.key === 'Escape' && M.G && !M.over) { if (BB.$('scrim').hidden) menuModal(); else BB.closeModal(); } });

  function showGameUI(on) {
    $('top').hidden = !on; $('bar').hidden = !on; document.body.classList.toggle('ingame', !!on);
    $('dock').hidden = on; $('lobbyHead').hidden = on;
    BB.msg(''); BB.acts([]);
    $('homeBtns').innerHTML = on ? '<button class="btn sm" id="bMenu" type="button">☰ 메뉴</button><button class="btn sm" id="bRules" type="button">규칙</button><button class="btn sm" id="bSound" type="button"></button><button class="btn sm" id="bExit" type="button">로비로</button><button class="btn sm" type="button" onclick="location.href=\'../index.html\'">🏠 게임 목록</button>'
      : '<button class="btn sm" id="bHelp" type="button">도움말</button><button class="btn sm" id="bRank" type="button">🏆 랭킹</button><button class="btn sm" id="bSound" type="button"></button><button class="btn sm" type="button" onclick="location.href=\'../index.html\'">🏠 게임 목록</button>';
    const snd = $('bSound'); snd.textContent = BB.soundLabel();
    snd.onclick = () => { BB.cycleSound(); snd.textContent = BB.soundLabel(); };
    if (on) {
      $('bRules').onclick = () => rulesModal(M.game); $('bMenu').onclick = menuModal;
      $('bExit').onclick = () => { BB.modal('<h2>로비로 나갈까요?</h2><p class="sub">지금 경기는 끝나요.</p><div class="row"><button class="btn warn" id="yx">나가기</button><button class="btn" id="nx">계속하기</button></div>'); $('yx').onclick = () => { BB.closeModal(); toLobby(); }; $('nx').onclick = BB.closeModal; };
    } else { $('bHelp').onclick = helpModal; $('bRank').onclick = () => rankModal(); }
  }
  function toLobby() {
    clearTimeout(M.aiTimer); M.over = true;
    if (M.view) { try { M.view.destroy(); } catch (e) {} M.view = null; }
    M.token = (M.token || 0) + 1; M.busy = 0; M.G = null; net.close();
    showGameUI(false); buildLobby();
  }
  BB.toLobby = toLobby;

  function rulesModal(id) {
    const G = BB.GAMES[id];
    BB.modal(`<h2>${esc(G.name)} 규칙</h2><p class="sub">${esc(G.sub)}</p><div class="rules">${G.rules}</div><div class="row" style="margin-top:12px"><button class="btn pri" id="ok">알겠어요</button></div>`);
    $('ok').onclick = BB.closeModal;
  }
  function helpModal() {
    BB.modal(`<h2>생명과학 보드게임 천국</h2><p class="sub">4가지 보드게임을 생명과학 개념으로 다시 만든 컬렉션이에요.</p><div class="rules">
      <ul><li><b>코돈 타일</b> — 숫자 타일을 사슬(같은 색 연속 숫자)과 복합체(같은 숫자 다른 색)로 내려놓는 게임</li>
      <li><b>모두의 세포</b> — 주사위로 세포 소기관을 돌며 ATP로 사고 짓는 경영 게임</li>
      <li><b>게놈 해독 코드</b> — 상대의 숨겨진 염기 번호를 추리하는 게임</li>
      <li><b>혈류 윷놀이</b> — 염색체 윷을 던져 심장에서 출발해 혈관을 돌아오는 전통 윷놀이</li></ul>
      <b>조작</b>: 드래그로 판을 돌리고, 휠·두 손가락으로 확대해요. 칸·타일·말 위에 마우스를 올리면(휴대폰은 탭) 생명과학 설명 카드가 떠요.<br>
      <b>모드</b>: AI 대결(난이도 3단계) · 온라인 방(6자리 코드, 같은 기기의 다른 탭도 됨) · 한 기기 여러 명(2~4명 돌아가며).</div>
      <div class="row" style="margin-top:12px"><button class="btn pri" id="ok">닫기</button></div>`);
    $('ok').onclick = BB.closeModal;
  }

  /* ================= 로비 (3D 아케이드) ================= */
  function buildLobby() {
    const root = BB.newRoot(); BB.music('boardLobby');
    BB.scene.background.set(0x7cc6e0);
    BB.setView({tx: 0, ty: 1.5, tz: 0, az: Math.PI / 4, el: 0.6, zoom: innerWidth < innerHeight ? 15.5 : 13});
    const g = BB.ground(30, 0x4fa866, 0x6cc584); root.add(g);
    // 길 (십자)
    for (let k = 0; k < 4; k++) { const p = BB.box(k % 2 ? 26 : 3, 0.08, k % 2 ? 3 : 26, 0xf4e8c8); p.position.y = 0.04; root.add(p); }
    const plaza = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.4, 0.3, 40), new THREE.MeshLambertMaterial({color: 0xe8f1ff})); plaza.position.y = 0.15; plaza.receiveShadow = true; root.add(plaza);
    // DNA 이중나선 타워
    const tower = new THREE.Group(); tower.position.y = 0.3; root.add(tower);
    const BP = ['#3fe0a0', '#ff6b6b', '#ffd166', '#5aa0ff'];
    const P = [];
    for (let i = 0; i < 64; i++) { // 두 가닥 뼈대 (당-인산)
      const y = i * 0.17, a = i * 0.2;
      P.push([Math.cos(a) * 1.5, y, Math.sin(a) * 1.5, 0.46, 0.3, 0.46, '#eef2fb'], [-Math.cos(a) * 1.5, y, -Math.sin(a) * 1.5, 0.46, 0.3, 0.46, '#c4d2f0']);
    }
    for (let i = 0; i < 16; i++) { // 염기쌍 막대 (A-T, G-C)
      const y = i * 0.68 + 0.04, a = i * 0.8, k = i % 4, c1 = BP[k], c2 = BP[k ^ 1];
      const rung = new THREE.Group(); rung.position.y = y; rung.rotation.y = -a;
      rung.add(BB.vox([[0.72, 0, 0, 1.44, 0.2, 0.22, c1], [-0.72, 0, 0, 1.44, 0.2, 0.22, c2], [0, -0.02, 0, 0.12, 0.24, 0.26, '#ffffff']]));
      tower.add(rung);
    }
    const dna = BB.vox(P); tower.add(dna);
    BB.ticks.push((dt) => { tower.rotation.y += dt * 0.5; });
    const lbl = BB.label('DNA 이중 나선 타워', {size: 0.9}); lbl.position.set(0, 12.2, 0); root.add(lbl);
    dna.userData.pick = true; dna.userData.info = ['DNA 이중 나선', '두 가닥의 뉴클레오타이드 사슬이 꼬인 구조. A는 T와, G는 C와 수소 결합으로 짝을 지어요(상보적 결합).', '로비'];
    BB.pickables.push(dna);
    // 4개 존
    const pos = [[-8, -8], [8, -8], [-8, 8], [8, 8]];
    ORDER.forEach((id, i) => {
      const G = BB.GAMES[id], z = new THREE.Group(); z.position.set(pos[i][0], 0, pos[i][1]); root.add(z);
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.6, 0.5, 6), new THREE.MeshLambertMaterial({color: G.color})); pad.position.y = 0.25; pad.castShadow = true; pad.receiveShadow = true; z.add(pad);
      const deco = G.lobbyModel(); deco.position.y = 0.5; z.add(deco);
      const lb = BB.label(G.name, {size: 0.85}); lb.position.set(0, 4.2, 0); z.add(lb);
      const ch = BB.makeChar(i, 0.8); ch.position.set(2.2, 0.5, 1.6); ch.rotation.y = -0.6 + i; z.add(ch);
      let hopT = i * 0.7; BB.ticks.push((dt) => { hopT += dt; const k = (hopT % 2.2) / 0.4; if (k < 1) { ch.position.y = 0.5 + Math.sin(k * Math.PI) * 0.5; } else ch.position.y = 0.5; });
      z.userData.pick = true; z.userData.info = [G.name, G.sub, '보드게임 존']; z.userData.onPick = () => { BB.audio.click(); modeModal(id); };
      z.userData.hover = on => { pad.material.emissive && pad.material.emissive.setHex(on ? 0x223344 : 0); };
      BB.pickables.push(z);
    });
    // 나무·세포 장식
    for (let k = 0; k < 18; k++) {
      const a = k / 18 * Math.PI * 2 + 0.2, r = 12.5 + (k % 3) * 0.6, x = Math.cos(a) * r, zz = Math.sin(a) * r;
      if (Math.abs(x) < 2 || Math.abs(zz) < 2) continue;
      const t = k % 3 === 0 ? BB.vox([[0, 0, 0, 0.4, 0.8, 0.4, '#8a5a3a'], [0, 0.8, 0, 1.4, 1.2, 1.4, '#3fae6a'], [0, 2.0, 0, 0.9, 0.6, 0.9, '#5ccf84']])
        : BB.vox([[0, 0, 0, 1.1, 0.8, 1.1, ['#ffb3d9', '#9ad0ff', '#ffe08a'][k % 3]], [0, 0.25, 0, 0.5, 0.45, 0.5, '#7a5af0']]);
      t.position.set(x, 0, zz); root.add(t);
    }
    // 독
    $('dock').innerHTML = ORDER.map(id => `<button type="button" data-g="${id}" data-info='${esc(JSON.stringify([BB.GAMES[id].name, BB.GAMES[id].sub, BB.GAMES[id].min + '~' + BB.GAMES[id].max + '명']))}'>${ICONS[id]}<span>${esc(BB.GAMES[id].short)}</span></button>`).join('');
    $('dock').querySelectorAll('button').forEach(b => b.onclick = () => { BB.audio.click(); modeModal(b.dataset.g); });
  }

  /* ================= 모드 선택 ================= */
  const pref = (() => { try { return JSON.parse(localStorage.getItem('bioBoardPref') || '{}') || {}; } catch (e) { return {}; } })();
  const savePref = () => { try { localStorage.setItem('bioBoardPref', JSON.stringify(pref)); } catch (e) {} };
  pref.char = pref.char || 0; pref.n = pref.n || 2; pref.lv = pref.lv != null ? pref.lv : 1; pref.name = pref.name || '';
  let thumbs = null;
  function modeModal(id, tab) {
    const G = BB.GAMES[id]; tab = tab || pref.tab || 'ai';
    if (!thumbs) thumbs = BB.CHARS.map((c, i) => BB.charThumb(i));
    const nOpts = []; for (let n = G.min; n <= G.max; n++) nOpts.push(n);
    if (pref.n < G.min || pref.n > G.max) pref.n = G.min;
    const charsHtml = `<div class="lbl">내 말(캐릭터)</div><div class="chars">${BB.CHARS.map((c, i) => `<button type="button" data-c="${i}" class="${pref.char === i ? 'on' : ''}" data-info='${esc(JSON.stringify(c.info))}'><img src="${thumbs[i]}" style="width:54px;height:54px;display:block;margin:0 auto 3px">${esc(c.name)}</button>`).join('')}</div>`;
    let body = '';
    if (tab === 'ai') body = `${charsHtml}<div class="lbl">인원 (나 + AI)</div><div class="seg" id="sN">${nOpts.map(n => `<button type="button" data-n="${n}" class="${pref.n === n ? 'on' : ''}">${n}명</button>`).join('')}</div>
      <div class="lbl">AI 난이도</div><div class="seg" id="sL">${LEVELS.map(l => `<button type="button" data-l="${l.id}" class="${pref.lv === l.id ? 'on' : ''}">${l.name}<small>${l.sub}</small></button>`).join('')}</div>
      <div class="row"><button class="btn pri" id="go">AI와 대결 시작</button></div>`;
    else if (tab === 'local') body = `<p class="sub">한 기기에서 돌아가며 해요. 말은 1번부터 차례로 정해져요.${G.hidden ? ' 숨긴 패가 있는 게임이라 차례가 바뀔 때마다 가림막이 나와요.' : ''}</p><div class="lbl">인원</div><div class="seg" id="sN">${nOpts.filter(n => n >= 2).map(n => `<button type="button" data-n="${n}" class="${pref.n === n ? 'on' : ''}">${n}명</button>`).join('')}</div>
      <div class="row"><button class="btn pri" id="go">한 기기 대결 시작</button></div>`;
    else body = `${charsHtml}<div class="lbl">내 이름</div><div class="row"><input class="txt" id="nm" maxlength="8" style="text-transform:none;letter-spacing:0" value="${esc(pref.name)}" placeholder="이름"></div>
      <div class="lbl" style="margin-top:12px">방 만들기</div><div class="row"><button class="btn pri" id="mk">새 방 만들기 (6자리 코드)</button></div>
      <div class="lbl" style="margin-top:12px">코드로 입장</div><div class="row"><input class="txt" id="cd" maxlength="6" placeholder="ABC123"><button class="btn" id="jn">입장</button></div>
      <p class="sub" style="margin-top:10px">같은 와이파이·교실 서버가 아니어도 인터넷으로 연결돼요. 같은 컴퓨터의 다른 탭끼리도 바로 연결돼요.</p>`;
    const m = BB.modal(`<h2>${esc(G.name)}</h2><p class="sub">${esc(G.sub)}</p>
      <div class="seg" id="tabs"><button type="button" data-t="ai" class="${tab === 'ai' ? 'on' : ''}">AI 대결<small>난이도 3단계</small></button><button type="button" data-t="online" class="${tab === 'online' ? 'on' : ''}">온라인 방<small>코드 6자리</small></button><button type="button" data-t="local" class="${tab === 'local' ? 'on' : ''}">한 기기 다인<small>2~${G.max}명</small></button></div>
      ${body}<div class="row" style="margin-top:10px"><button class="btn sm" id="rl">규칙 보기</button></div>`);
    m.querySelectorAll('#tabs button').forEach(b => b.onclick = () => { pref.tab = b.dataset.t; savePref(); modeModal(id, b.dataset.t); });
    m.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { pref.char = +b.dataset.c; savePref(); m.querySelectorAll('[data-c]').forEach(x => x.classList.toggle('on', x === b)); });
    m.querySelectorAll('[data-n]').forEach(b => b.onclick = () => { pref.n = +b.dataset.n; savePref(); m.querySelectorAll('[data-n]').forEach(x => x.classList.toggle('on', x === b)); });
    m.querySelectorAll('[data-l]').forEach(b => b.onclick = () => { pref.lv = +b.dataset.l; savePref(); m.querySelectorAll('[data-l]').forEach(x => x.classList.toggle('on', x === b)); });
    $('rl').onclick = () => rulesModal(id);
    const go = $('go');
    if (go) go.onclick = () => {
      BB.closeModal(); BB.audio.unlock();
      let seats;
      if (tab === 'ai') { const others = [0, 1, 2, 3].filter(c => c !== pref.char); seats = [{name: '나', char: pref.char, type: 'human'}]; for (let k = 1; k < pref.n; k++) seats.push({name: BB.CHARS[others[k - 1]].name, char: others[k - 1], type: 'ai', level: pref.lv}); }
      else { seats = []; for (let k = 0; k < Math.max(2, pref.n); k++) seats.push({name: (k + 1) + '번 ' + BB.CHARS[k].name.split(' ')[0], char: k, type: 'human'}); }
      startMatch(id, seats, tab);
    };
    const mk = $('mk'), jn = $('jn');
    if (mk) mk.onclick = () => { pref.name = ($('nm').value.trim() || '연구원').slice(0, 8); savePref(); net.host(id); };
    if (jn) jn.onclick = () => { pref.name = ($('nm').value.trim() || '연구원').slice(0, 8); savePref(); const c = $('cd').value.trim().toUpperCase(); if (c.length !== 6) { BB.toast('코드 6자리를 넣어 주세요'); return; } net.join(c); };
  }
  BB.modeModal = modeModal;

  /* ================= 온라인 ================= */
  const PREFIX = 'biob-v1-';
  const myId = 'c' + Math.random().toString(36).slice(2, 10);
  const net = BB.net = {
    role: null, code: '', peer: null, bc: null, conns: new Map(), hostConn: null, game: null, players: [], aiFill: true, lv: 1,
    peerOpts() { return {debug: 0, config: {iceServers: [{urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302']}, {urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp'}]}}; },
    loadPeer() { return window.Peer ? Promise.resolve() : new Promise((ok, no) => { const s = document.createElement('script'); s.src = '../vendor/peerjs.min.js'; s.onload = ok; s.onerror = no; document.head.appendChild(s); }); },
    openPeer(id) { return this.loadPeer().then(() => new Promise((ok, no) => { let p; try { p = id ? new Peer(id, this.peerOpts()) : new Peer(this.peerOpts()); } catch (e) { no(e); return; }
      const to = setTimeout(() => { try { p.destroy(); } catch (e) {} no(new Error('timeout')); }, window.BioRelay && BioRelay.wait ? BioRelay.wait(10000) : 10000);
      p.on('open', () => { clearTimeout(to); ok(p); }); p.on('error', e => { clearTimeout(to); no(e); }); })); },
    genCode() { const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let r = ''; for (let i = 0; i < 6; i++) r += c[BB.ri(c.length)]; return r; },
    openBc(code) { try { this.bc = new BroadcastChannel(PREFIX + code); this.bc.onmessage = e => { const m = e.data; if (!m) return; if (this.role === 'host' && m.from && m.from !== myId) this.onHost(m, null); else if (this.role === 'guest' && !m.from && (!m.to || m.to === myId)) this.onGuest(m); }; } catch (e) { this.bc = null; } },
    send(c, m) { if (c && c.open) try { c.send(m); } catch (e) {} },
    broadcast(m) { for (const c of this.conns.values()) this.send(c, m); if (this.bc) try { this.bc.postMessage(m); } catch (e) {} },
    toHost(m) { m.from = myId; if (this.hostConn) this.send(this.hostConn, m); else if (this.bc) try { this.bc.postMessage(m); } catch (e) {} },
    close() { try { this.peer && this.peer.destroy(); } catch (e) {} try { this.bc && this.bc.close(); } catch (e) {} this.peer = null; this.bc = null; this.conns.clear(); this.hostConn = null; this.role = null; this.players = []; },
    async host(game) {
      this.close(); this.role = 'host'; this.game = game; this.players = [{cid: myId, name: pref.name, char: pref.char}];
      this.lobbyUI('방을 만드는 중…');
      for (let k = 0; k < 3 && !this.peer; k++) { this.code = this.genCode(); try { this.peer = await this.openPeer(PREFIX + this.code); } catch (e) { if (!(e && e.type === 'unavailable-id')) break; } }
      if (!this.code) this.code = this.genCode();
      this.openBc(this.code);
      if (this.peer) this.peer.on('connection', c => { c.on('data', m => this.onHost(m, c)); c.on('close', () => { if (c.cid) this.gone(c.cid); }); });
      this.lobbyUI(this.peer ? '친구에게 코드를 알려 주세요' : '인터넷 연결이 안 돼서 같은 기기의 다른 탭에서만 들어올 수 있어요');
    },
    async join(code) {
      this.close(); this.role = 'guest'; this.code = code; this.players = [];
      this.joinUI('방을 찾는 중…');
      this.openBc(code);
      this.toHost({t: 'hello', name: pref.name, char: pref.char});
      await BB.wait(700);
      if (this.role !== 'guest') return;
      if (!this.players.length) {
        try {
          this.peer = await this.openPeer(null);
          const c = this.peer.connect(PREFIX + code, {reliable: true}); this.hostConn = c;
          c.on('open', () => { this.send(c, {t: 'hello', name: pref.name, char: pref.char, from: myId}); });
          c.on('data', m => this.onGuest(m));
          c.on('close', () => { if (this.role === 'guest') { BB.toast('방장과 연결이 끊겼어요'); toLobby(); } });
          this.peer.on('error', e => { if (e && e.type === 'peer-unavailable') this.joinUI(`방 [${code}]을(를) 찾을 수 없어요.`); });
        } catch (e) { this.joinUI('연결하지 못했어요. 코드를 확인하고 다시 해 보세요.'); }
      }
    },
    onHost(m, c) {
      if (m.t === 'hello') {
        if (c) { c.cid = m.from; this.conns.set(m.from, c); }
        if (M.G && !M.over && M.mode === 'online') { this.sendTo(m.from, {t: 'full'}); return; }
        if (!this.players.find(p => p.cid === m.from)) { if (this.players.length >= BB.GAMES[this.game].max) { this.sendTo(m.from, {t: 'full'}); return; } this.players.push({cid: m.from, name: (m.name || '친구').slice(0, 8), char: m.char | 0}); }
        this.pushLobby();
      } else if (m.t === 'act') {
        const seat = M.seats ? M.seats.findIndex(s => s.cid === m.from) : -1;
        if (seat >= 0 && seat === m.seat) dispatch(m.a, seat);
      } else if (m.t === 'bye') this.gone(m.from);
    },
    sendTo(cid, msg) { const c = this.conns.get(cid); if (c) this.send(c, msg); else if (this.bc) try { this.bc.postMessage(Object.assign({to: cid}, msg)); } catch (e) {} },
    gone(cid) {
      const i = this.players.findIndex(p => p.cid === cid); if (i >= 0 && !(M.G && M.mode === 'online')) { this.players.splice(i, 1); this.pushLobby(); }
      if (M.G && M.mode === 'online' && M.seats) { const s = M.seats.find(x => x.cid === cid); if (s && s.type === 'remote') { s.type = 'ai'; s.level = 1; s.name += ' (AI)'; BB.toast(s.name.replace(' (AI)', '') + ' 님이 나가서 AI가 이어서 해요'); this.broadcast({t: 'seats', seats: M.seats}); renderPlayers(); afterSync(BB.clone(M.state)); } }
    },
    pushLobby() { this.broadcast({t: 'lobby', game: this.game, players: this.players}); if (this.role === 'host') this.lobbyUI(); },
    onGuest(m) {
      if (m.t === 'lobby') { this.players = m.players; this.game = m.game; this.joinUI('방장이 시작하기를 기다리는 중…'); }
      else if (m.t === 'full') { BB.toast('방이 가득 찼거나 이미 시작했어요'); this.close(); }
      else if (m.t === 'start') {
        BB.closeModal(); const seats = m.seats.map(s => Object.assign({}, s, {type: s.cid === myId ? 'human' : (s.type === 'ai' ? 'ai' : 'remote')}));
        startMatch(m.game, seats, 'online', {client: true, mySeat: seats.findIndex(s => s.cid === myId), state: m.state});
      } else if (m.t === 'state') { if (M.G && !M.host) { M.state = m.state; enqueue(m.state, m.ev); } }
      else if (m.t === 'seats') { if (M.seats) { m.seats.forEach((s, i) => { if (M.seats[i] && M.seats[i].cid !== myId) { M.seats[i].type = s.type === 'ai' ? 'ai' : 'remote'; M.seats[i].name = s.name; } }); renderPlayers(); } }
    },
    startGame() {
      const G = BB.GAMES[this.game];
      const seats = this.players.map(p => ({name: p.name, char: p.char, cid: p.cid, type: p.cid === myId ? 'human' : 'remote'}));
      // 말 캐릭터가 겹치면 다른 말로
      const used = new Set(); seats.forEach(s => { if (used.has(s.char)) s.char = [0, 1, 2, 3].find(c => !used.has(c)); used.add(s.char); });
      const want = Math.max(G.min, this.aiFill ? Math.max(seats.length, this.aiN || G.min) : seats.length);
      while (seats.length < Math.min(G.max, want)) { const c = [0, 1, 2, 3].find(x => !used.has(x)); used.add(c); seats.push({name: BB.CHARS[c].name + ' (AI)', char: c, type: 'ai', level: this.lv, cid: 'ai' + seats.length}); }
      if (seats.length < G.min) { BB.toast(G.min + '명부터 시작할 수 있어요'); return; }
      BB.closeModal();
      startMatch(this.game, seats, 'online', {mySeat: 0});
      this.broadcast({t: 'start', game: this.game, seats: M.seats.map(s => ({name: s.name, char: s.char, cid: s.cid, type: s.type === 'ai' ? 'ai' : 'human', level: s.level})), state: M.state});
    },
    lobbyUI(note) {
      const G = BB.GAMES[this.game]; if (M.G && M.mode === 'online') return;
      this.aiN = this.aiN || G.min;
      const m = BB.modal(`<h2>${esc(G.name)} · 온라인 방</h2><p class="sub">${esc(note || '')}</p><div class="code">${esc(this.code || '······')}</div>
        <div class="lbl">참가자 (${this.players.length}/${G.max})</div><div class="list">${this.players.map((p, i) => `<div><span style="width:12px;height:12px;border-radius:4px;background:${BB.CHARS[p.char].color}"></span><span style="flex:1">${esc(p.name)}${p.cid === myId ? ' (방장)' : ''}</span><small>${esc(BB.CHARS[p.char].name)}</small></div>`).join('')}</div>
        <div class="lbl">빈자리는 AI로 채우기 (총 인원)</div><div class="seg" id="aN">${[G.min, G.min + 1, G.max].filter((v, i, a) => a.indexOf(v) === i && v <= G.max).map(n => `<button type="button" data-n="${n}" class="${this.aiN === n ? 'on' : ''}">${n}명</button>`).join('')}</div>
        <div class="seg" id="aL">${LEVELS.map(l => `<button type="button" data-l="${l.id}" class="${this.lv === l.id ? 'on' : ''}">${l.name}<small>${l.sub}</small></button>`).join('')}</div>
        <div class="row"><button class="btn pri" id="st">경기 시작</button><button class="btn" id="cx">방 닫기</button></div>`, {lock: true});
      m.querySelectorAll('[data-n]').forEach(b => b.onclick = () => { this.aiN = +b.dataset.n; this.lobbyUI(note); });
      m.querySelectorAll('[data-l]').forEach(b => b.onclick = () => { this.lv = +b.dataset.l; this.lobbyUI(note); });
      $('st').onclick = () => this.startGame();
      $('cx').onclick = () => { this.broadcast({t: 'full'}); this.close(); BB.closeModal(); };
    },
    joinUI(note) {
      if (M.G && M.mode === 'online') return;
      const G = this.game ? BB.GAMES[this.game] : null;
      BB.modal(`<h2>${G ? esc(G.name) + ' · ' : ''}방 [${esc(this.code)}]</h2><p class="sub">${esc(note || '')}</p>
        <div class="list">${this.players.map(p => `<div><span style="width:12px;height:12px;border-radius:4px;background:${BB.CHARS[p.char].color}"></span><span style="flex:1">${esc(p.name)}${p.cid === myId ? ' (나)' : ''}</span></div>`).join('')}</div>
        <div class="row"><button class="btn" id="cx">나가기</button></div>`, {lock: true});
      $('cx').onclick = () => { this.toHost({t: 'bye'}); this.close(); BB.closeModal(); };
    }
  };
  addEventListener('beforeunload', () => { if (net.role === 'guest') net.toHost({t: 'bye'}); });

  // 시작
  if (window.LyricAudio) { LyricAudio.init('bioBoard'); BB.audio.muted = LyricAudio.mode === 'off'; }
  showGameUI(false);
  buildLobby();
  BB.start();
  // 주소에 ?game=yut 처럼 넣으면 그 게임 모드 창을 바로 열기
  try { const q = new URLSearchParams(location.search).get('game'); if (BB.GAMES[q]) setTimeout(() => modeModal(q), 300); } catch (e) {}
})();
