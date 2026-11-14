/* 바이오 스포츠 천국 — 로비 · 모드 · 프리매치(팀·로스터·라인업·옵션) · 경기 진행 · 경기 현황 · 온라인 */
'use strict';
(function () {
  const {$, esc} = SP;
  const ORDER = ['soccer', 'basketball', 'baseball', 'volleyball', 'pool'];
  const DIFF = [['쉬움', '세포 입문'], ['보통', '연구실 리그'], ['어려움', '노벨상 리그']];
  const pref = (() => { try { return JSON.parse(localStorage.getItem('bioSportsPref') || '{}') || {}; } catch (e) { return {}; } })();
  const savePref = () => { try { localStorage.setItem('bioSportsPref', JSON.stringify(pref)); } catch (e) {} };
  pref.diff = pref.diff != null ? pref.diff : 1; pref.speed = pref.speed || 1;

  /* ================= 로비 ================= */
  function lobby() {
    SP.inMatch = false; SP.tick = lobbyTick; SP.onTab = null; SP.onEsc = null; SP.onPointer = null; SP.onWheel = null;
    $('top').hidden = true; $('help').hidden = true; $('keys').hidden = true; $('touch').hidden = true; $('info').innerHTML = ''; SP.minimap(null); SP.gauge(null); SP.info('');
    SP.clearScene(); SP.audio.crowd(0);
    if (window.LyricAudio) LyricAudio.theme('kingdom');
    // 배경: 다섯 경기장 미니어처 + 뛰는 선수
    SP.scene.background.set(0x8fd0e6);
    const g = SP.plane(80, 80, 0x7ccf86); SP.scene.add(g);
    const pads = [['#3fae6a', -12, -6], ['#d8935a', 0, -10], ['#c9a46a', 12, -6], ['#4a8adf', -7, 6], ['#2f8a5a', 7, 6]];
    lobbyGuys.length = 0;
    pads.forEach(([c, x, z], i) => { const p = SP.vox([[0, 0, 0, 7, 0.3, 5, c], [0, 0.3, 0, 6.2, 0.04, 0.12, '#ffffff'], [0, 0.3, 0, 0.12, 0.04, 4.2, '#ffffff']]); p.position.set(x, 0, z); SP.scene.add(p);
      for (let k = 0; k < 2; k++) { const m = SP.makePlayer(SP.ri(10), 7 + i * 2 + k); m.position.set(x + (k ? 1.6 : -1.6), 0.3, z); SP.scene.add(m); lobbyGuys.push({m, x, z, ph: Math.random() * 6, r: 1.6 + k * 0.4}); } });
    SP.camTo({x: 0, y: 0, z: 0, dist: 34, h: 24, yaw: 0.5}, true);
    const L = $('lobby'); L.hidden = false;
    L.innerHTML = `<h1>바이오 스포츠 천국</h1><p>생명과학 테마 5종목 종합 스포츠 · 10개 대학 · 팀당 20명</p>
      <div class="sports">${ORDER.map(id => { const S = SP.SPORTS[id]; return `<button type="button" data-s="${id}"><span>${S.icon}</span>${esc(S.name)}<small>${esc(S.desc)}</small></button>`; }).join('')}</div>
      <div class="row" style="justify-content:center"><button class="btn" id="lHelp">조작법</button><button class="btn" id="lSnd">${SP.audio.muted ? '🔇 소리 켜기' : '🔔 소리 끄기'}</button><button class="btn" onclick="location.href='../index.html'">🏠 게임 목록</button></div>`;
    L.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { SP.audio.click(); modeModal(b.dataset.s); });
    $('lHelp').onclick = () => { SP.modal(`<h2>조작법</h2><div class="sub" style="line-height:1.9"><b>이동</b> WASD·방향키 (휴대폰: 왼쪽 조이스틱)<br><b>J</b> 패스·토스·리시브 · <b>K / Space</b> 슛·타격·투구·스파이크 (누르고 있으면 힘 게이지) · <b>L</b> 태클·블록·도루 · <b>Q</b> 선수 전환<br><b>Tab</b> 경기 현황·작전 타임(교체) · <b>C</b> 원근/직교 시점 전환 · <b>Esc</b> 닫기<br>종목마다 화면 아래에 조작 안내가 나와요.</div><div class="row"><button class="btn pri" onclick="SP.closeModal()">알겠어요</button></div>`); };
    $('lSnd').onclick = () => { SP.audio.setMuted(!SP.audio.muted); lobby(); };
  }
  const lobbyGuys = [];
  function lobbyTick(dt) { const t = performance.now() / 1000; for (const g of lobbyGuys) { const a = t * 0.9 + g.ph; const x = g.x + Math.cos(a) * g.r, z = g.z + Math.sin(a) * g.r * 0.6; g.m.position.set(x, 0.3, z); SP.animPlayer(g.m, 3, dt, Math.atan2(-Math.sin(a), Math.cos(a) * 0.6)); } SP.cam.g.yaw += dt * 0.05; }

  /* ================= 모드 선택 ================= */
  function modeModal(sid) {
    const S = SP.SPORTS[sid];
    const m = SP.modal(`<h2>${S.icon} ${esc(S.name)}</h2><p class="sub">${esc(S.desc)}</p>
      <div class="lbl">모드</div><div class="seg"><button type="button" data-m="single" class="on">싱글 플레이<small>AI와 대결</small></button><button type="button" data-m="host">온라인 방 만들기<small>코드 6자리</small></button><button type="button" data-m="join">코드로 참가<small>친구 방</small></button></div>
      <div id="joinRow" hidden><div class="lbl">방 코드</div><div class="row"><input class="txt" id="code" maxlength="6" placeholder="ABC123"><button class="btn pri" id="joinGo">참가</button></div></div>
      <div class="row" style="margin-top:14px"><button class="btn pri" id="next">다음 → 팀 선택</button><button class="btn" id="cx">닫기</button></div>`);
    let mode = 'single';
    m.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { mode = b.dataset.m; m.querySelectorAll('[data-m]').forEach(x => x.classList.toggle('on', x === b)); $('joinRow').hidden = mode !== 'join'; $('next').hidden = mode === 'join'; });
    $('cx').onclick = SP.closeModal;
    $('next').onclick = () => prematch(sid, mode);
    $('joinGo').onclick = () => { const c = $('code').value.trim().toUpperCase(); if (c.length !== 6) { SP.toast('코드 6자리를 넣어 주세요'); return; } joinPick(sid, c); };
  }

  /* ================= 프리매치 ================= */
  function teamGrid(sel, sel2) { return `<div class="teams">${SP.TEAMS.map((T, i) => `<button type="button" data-t="${i}" class="${i === sel ? 'on' : i === sel2 ? 'on2' : ''}"><b><i class="chip" style="background:${T.c1}"></i>${esc(T.name)}</b><small>${esc(T.en)}</small><small style="color:#ffe7a8">${esc(T.trait)} · ${esc(T.desc)}</small></button>`).join('')}</div>`; }
  function prematch(sid, mode) {
    const S = SP.SPORTS[sid];
    const st = {sid, mode, my: pref.team != null ? pref.team : 0, op: pref.op != null ? pref.op : 1, step: 'team', opts: {}, lineup: null, slotSel: -1, form: null};
    (S.options || []).forEach(o => { st.opts[o.key] = (pref['o_' + sid + o.key] != null ? pref['o_' + sid + o.key] : o.def); });
    if (st.my === st.op) st.op = (st.my + 1) % 10;
    function render() {
      if (st.step === 'team') {
        const m = SP.modal(`<h2>① 팀 선택</h2><p class="sub">${mode === 'single' ? '우리 팀(초록 테두리)을 고른 뒤 상대 팀(분홍)을 골라요.' : '방장 팀을 골라요. 상대 팀은 들어온 친구가 골라요.'}</p>
          <div class="seg" style="margin-bottom:8px"><button type="button" data-w="my" class="${st.pick !== 'op' ? 'on' : ''}">우리 팀: ${esc(SP.TEAMS[st.my].name)}</button>${mode === 'single' ? `<button type="button" data-w="op" class="${st.pick === 'op' ? 'on' : ''}">상대 팀: ${esc(SP.TEAMS[st.op].name)}</button>` : ''}</div>
          ${teamGrid(st.my, mode === 'single' ? st.op : -1)}
          <div class="row" style="margin-top:12px"><button class="btn pri" id="go">${S.lineup ? '다음 → 로스터·라인업' : '다음 → 경기 옵션'}</button><button class="btn" id="back">뒤로</button></div>`, {lock: true});
        m.querySelectorAll('[data-w]').forEach(b => b.onclick = () => { st.pick = b.dataset.w; render(); });
        m.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { const i = +b.dataset.t; SP.audio.click(); if (st.pick === 'op') { if (i !== st.my) st.op = i; } else { st.my = i; if (st.op === i) st.op = (i + 1) % 10; if (mode === 'single') st.pick = 'op'; } st.lineup = null; render(); });
        $('go').onclick = () => { pref.team = st.my; pref.op = st.op; savePref(); st.step = S.lineup ? 'lineup' : 'opts'; render(); };
        $('back').onclick = () => modeModal(sid);
        return;
      }
      if (st.step === 'lineup') {
        const slots = S.slots(st.opts);
        if (!st.lineup || st.lineup.length !== slots.length) st.lineup = SP.autoLineup(st.my, slots);
        const ro = SP.roster(st.my), T = SP.TEAMS[st.my];
        const starters = new Set(st.lineup);
        const statBar = v => `<span class="bar"><i style="width:${v}%"></i></span>${v}`;
        const diagram = `<div class="pitch" style="background:${S.pitchBg || 'linear-gradient(#2f8a4a,#3fae6a)'};height:${S.pitchH || 320}px">${slots.map((s, i) => { const p = ro[st.lineup[i]]; return `<div class="ps ${st.slotSel === i ? 'sel' : ''}" data-slot="${i}" style="left:${s.x * 100}%;top:${s.y * 100}%"><i style="background:${T.c2}">${p.no}</i>${esc(s.label)}<br>${esc(p.name)}</div>`; }).join('')}</div>`;
        const table = `<div style="max-height:360px;overflow:auto"><table class="rt"><tr><th>#</th><th>이름</th><th>유형</th>${SP.STAT.map(s => `<th title="${esc(s[2])}">${esc(s[1].split(' ')[0])}</th>`).join('')}<th>종합</th><th>상태</th></tr>${ro.map(p => { const si = st.lineup.indexOf(p.i); return `<tr data-p="${p.i}" class="${si >= 0 ? 'st' : ''}"><td>${p.no}</td><td><b>${esc(p.name)}</b></td><td>${esc(p.role)}</td>${SP.STAT.map(s => `<td>${statBar(p.st[s[0]])}</td>`).join('')}<td><b>${p.ovr}</b></td><td>${si >= 0 ? esc(slots[si].label) : '후보'}</td></tr>`; }).join('')}</table></div>`;
        const extra = S.lineupExtra ? S.lineupExtra(st) : '';
        const m = SP.modal(`<h2>② 로스터 · 선발 라인업 · ${esc(S.formLabel || '포메이션')}</h2><p class="sub">${esc(T.name)} 20명 중 선발 ${slots.length}명, 후보 ${20 - slots.length}명. 위치(동그라미)를 누르고 표에서 선수를 누르면 바꿔요.${S.orderNote ? ' ' + S.orderNote : ''}</p>
          ${extra}<div class="wrap2"><div>${diagram}</div><div>${table}</div></div>
          <div class="row" style="margin-top:12px"><button class="btn" id="auto">자동 배치 (능력치 기준)</button><button class="btn pri" id="go">다음 → 경기 옵션</button><button class="btn" id="back">뒤로</button></div>`, {lock: true});
        m.querySelectorAll('[data-slot]').forEach(e => e.onclick = () => { const i = +e.dataset.slot; SP.audio.click(); if (st.slotSel >= 0 && st.slotSel !== i) { const a = st.lineup[st.slotSel]; st.lineup[st.slotSel] = st.lineup[i]; st.lineup[i] = a; st.slotSel = -1; } else st.slotSel = st.slotSel === i ? -1 : i; render(); });
        m.querySelectorAll('[data-p]').forEach(e => e.onclick = () => { if (st.slotSel < 0) { SP.toast('먼저 위치를 눌러요'); return; } const pi = +e.dataset.p, cur = st.lineup.indexOf(pi); if (cur >= 0) { st.lineup[cur] = st.lineup[st.slotSel]; } st.lineup[st.slotSel] = pi; st.slotSel = -1; SP.audio.click(); render(); });
        if (S.bindLineupExtra) S.bindLineupExtra(m, st, render);
        $('auto').onclick = () => { st.lineup = SP.autoLineup(st.my, S.slots(st.opts)); render(); };
        $('go').onclick = () => { st.step = 'opts'; render(); };
        $('back').onclick = () => { st.step = 'team'; render(); };
        return;
      }
      // 옵션
      const m = SP.modal(`<h2>③ 경기 옵션</h2><p class="sub">${esc(SP.TEAMS[st.my].name)} ${mode === 'single' ? 'vs ' + esc(SP.TEAMS[st.op].name) : '· 온라인 방'}</p>
        ${mode === 'single' ? `<div class="lbl">AI 난이도 (포지션별 전술 AI)</div><div class="seg">${DIFF.map((d, i) => `<button type="button" data-d="${i}" class="${pref.diff === i ? 'on' : ''}">${d[0]}<small>${d[1]}</small></button>`).join('')}</div>` : ''}
        ${(S.options || []).map(o => `<div class="lbl">${esc(o.label)}</div><div class="seg">${o.choices.map(([v, l]) => `<button type="button" data-o="${o.key}" data-v="${v}" class="${String(st.opts[o.key]) === String(v) ? 'on' : ''}">${esc(l)}</button>`).join('')}</div>`).join('')}
        ${S.speed !== false ? `<div class="lbl">진행 배속 (경기 시간이 흐르는 속도)</div><div class="seg">${[1, 2, 3].map(v => `<button type="button" data-sp="${v}" class="${pref.speed === v ? 'on' : ''}">${v}배속</button>`).join('')}</div>` : ''}
        <div class="row" style="margin-top:14px"><button class="btn gold" id="go">${mode === 'host' ? '방 만들기' : '🏁 경기 시작'}</button><button class="btn" id="back">뒤로</button></div>`, {lock: true});
      m.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { pref.diff = +b.dataset.d; savePref(); render(); });
      m.querySelectorAll('[data-sp]').forEach(b => b.onclick = () => { pref.speed = +b.dataset.sp; savePref(); render(); });
      m.querySelectorAll('[data-o]').forEach(b => b.onclick = () => { const o = (S.options || []).find(x => x.key === b.dataset.o); const v = isNaN(+b.dataset.v) ? b.dataset.v : +b.dataset.v; st.opts[o.key] = v; pref['o_' + sid + o.key] = v; savePref(); if (o.relineup) st.lineup = null; render(); });
      $('back').onclick = () => { st.step = S.lineup ? 'lineup' : 'team'; render(); };
      $('go').onclick = () => {
        const S2 = SP.SPORTS[sid], slots = S2.slots ? S2.slots(st.opts) : [];
        if (S2.lineup && (!st.lineup || st.lineup.length !== slots.length)) st.lineup = SP.autoLineup(st.my, slots);
        const cfg = {sid, teams: [st.my, st.op], lineups: [st.lineup || [], null], opts: st.opts, diff: pref.diff, speed: pref.speed};
        if (mode === 'single') { cfg.lineups[1] = S2.slots ? SP.autoLineup(st.op, slots) : []; cfg.sides = ['local', 'ai']; cfg.me = 0; SP.closeModal(); startMatch(cfg); }
        else net.host(cfg);
      };
    }
    render();
  }
  function joinPick(sid, code) {
    let my = pref.team != null ? pref.team : 2;
    const draw = () => { const m = SP.modal(`<h2>참가할 팀 고르기</h2><p class="sub">방 [${esc(code)}] · 내 팀을 골라요. 라인업은 능력치 기준으로 자동 배치돼요.</p>${teamGrid(my, -1)}<div class="row" style="margin-top:12px"><button class="btn pri" id="go">참가하기</button><button class="btn" id="cx">취소</button></div>`, {lock: true});
      m.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { my = +b.dataset.t; draw(); });
      $('go').onclick = () => { pref.team = my; savePref(); net.join(code, my); }; $('cx').onclick = SP.closeModal; };
    draw();
  }

  /* ================= 경기 진행 ================= */
  const M = SP.match = {game: null, cfg: null, host: true, remoteIn: SP.emptyInput(), snapT: 0, inT: 0, hudT: 0, paused: false, over: false, lastSnap: null};
  function startMatch(cfg, opt) {
    opt = opt || {};
    $('lobby').hidden = true; SP.clearScene();
    M.cfg = cfg; M.host = !opt.guest; M.over = false; M.paused = false; M.remoteIn = SP.emptyInput(); M.lastSnap = null;
    const S = SP.SPORTS[cfg.sid];
    SP.inMatch = true; $('top').hidden = false;
    $('touch').hidden = !SP.isTouch; $('keys').hidden = SP.isTouch; SP.setActs(defActs(S));
    if (window.LyricAudio) LyricAudio.theme('battle');
    M.game = S.create(cfg);
    SP.audio.crowd(0.4);
    SP.onTab = () => { if (SP.modalOpen && menuOpen) SP.closeModal(); else openMenu('stat'); };
    SP.onEsc = () => { if (SP.modalOpen) SP.closeModal(); else openMenu('stat'); };
    SP.tick = matchTick;
    $('bMenu').onclick = () => openMenu('stat');
    $('bCam').onclick = () => SP.toggleCam();
  }
  SP.startMatch = startMatch;
  function matchTick(dt) {
    const G = M.game; if (!G) return;
    const sp = M.cfg.speed || 1;
    if (M.host) {
      const paused = M.paused && M.cfg.sides[1] !== 'remote';
      if (!paused && !M.over) {
        const local = SP.consume(), ins = [null, null];
        if (M.cfg.sides[M.cfg.me] === 'local') ins[M.cfg.me] = local;
        if (M.cfg.sides[1] === 'remote') { ins[1] = Object.assign({}, M.remoteIn); M.remoteIn.a = M.remoteIn.b = M.remoteIn.c = M.remoteIn.q = 0; M.remoteIn.num = 0; M.remoteIn.ext = null; }
        G.step(dt, ins, sp);
        for (let k = 1; k < (M.cfg.sim || 1); k++) G.step(0.033, [ins[0] && SP.emptyInput(), ins[1] && SP.emptyInput()], sp);   // 시험용 빨리 돌리기
      } else SP.consume();
      if (M.cfg.sides[1] === 'remote') { M.snapT -= dt; if (M.snapT <= 0) { M.snapT = 1 / 15; net.send({t: 's', s: G.snap()}); } }
    } else {
      M.inT -= dt; if (M.inT <= 0) { M.inT = 0.05; net.send({t: 'i', i: SP.consume()}); }
      if (M.lastSnap) { G.apply(M.lastSnap); M.lastSnap = null; }
    }
    G.view(dt);
    M.hudT -= dt;
    if (M.hudT <= 0) { M.hudT = 0.1; const h = G.hud(); SP.score(h.score, h.extra); if (M.cfg.sides[M.cfg.me] === 'local' || !M.host) SP.setActs(G.buttons ? G.buttons(M.cfg.me) || defActs(SP.SPORTS[M.cfg.sid]) : defActs(SP.SPORTS[M.cfg.sid]), G.picks ? G.picks(M.cfg.me) : null); if (h.info != null) SP.info(h.info); if (G.minimap && (!G.miniOn || G.miniOn())) SP.minimap((c, w, hh) => G.minimap(c, w, hh)); else SP.minimap(null); }
    const res = G.result();
    if (res && !M.over) { M.over = true; setTimeout(() => showResult(res), 1500); }
  }
  function endMatch() { if (M.game) { try { M.game.dispose && M.game.dispose(); } catch (e) {} } M.game = null; SP.tick = null; SP.clearScene(); SP.onPointer = null; SP.onWheel = null; SP.gauge(null); SP.closeModal(); }
  function showResult(res) {
    SP.audio.fanfare(); SP.audio.cheer();
    const T = M.cfg.teams.map(i => SP.TEAMS[i]);
    const mine = M.cfg.me, won = res.winner === mine;
    let rk = '';
    if (won && M.cfg.sides[1 - mine] !== 'local') {
      try { const d = JSON.parse(localStorage.getItem('bioSportsWins') || '{}') || {}; d[M.cfg.sid] = (d[M.cfg.sid] || 0) + 1; d.total = (d.total || 0) + 1; localStorage.setItem('bioSportsWins', JSON.stringify(d));
        const pts = (M.cfg.diff || 0) + 1 + (M.cfg.sides[1 - mine] === 'remote' ? 2 : 0); d['p_' + M.cfg.sid] = (d['p_' + M.cfg.sid] || 0) + pts; localStorage.setItem('bioSportsWins', JSON.stringify(d));
        rk = {wins: d[M.cfg.sid], pts: d['p_' + M.cfg.sid]}; } catch (e) {}
    }
    SP.modal(`<h2>${res.winner < 0 ? '무승부' : (won ? '🏆 승리!' : '패배')} · ${esc(SP.SPORTS[M.cfg.sid].name)}</h2><p class="sub">${esc(T[0].name)} ${esc(res.score || '')} ${esc(T[1].name)}<br>${esc(res.text || '')}</p>
      ${M.game && M.game.status ? `<div style="max-height:46vh;overflow:auto">${M.game.status()}</div>` : ''}
      <div class="row" style="margin-top:12px">${rk && window.BioGoal ? '<button class="btn gold" id="rk">🏆 랭킹에 보내기</button>' : ''}<button class="btn pri" id="again">다시 하기</button><button class="btn" id="lb">로비로</button><button class="btn" onclick="location.href='../index.html'">게임 목록</button></div>`, {lock: true});
    const r = $('rk'); if (r) r.onclick = () => { BioGoal.result('bio-sports', rk.wins, {ok: true, title: SP.SPORTS[M.cfg.sid].name + ' 랭킹', text: `${SP.SPORTS[M.cfg.sid].name} ${rk.pts}점 (${rk.wins}승)`, rank: {cat: SP.SPORTS[M.cfg.sid].name, v: BioGoal.key([[rk.pts, 1e6, 1], [rk.wins, 1e5, 1]]), f: {pts: rk.pts, wins: rk.wins, team: SP.TEAMS[M.cfg.teams[mine]].name}}}); };
    $('again').onclick = () => { const cfg = M.cfg; endMatch(); if (cfg.sides[1] === 'remote' || !M.host) { net.close(); lobby(); return; } startMatch(cfg); };
    $('lb').onclick = () => { net.close(); endMatch(); lobby(); };
  }

  /* ================= 경기 현황 · 작전 타임 ================= */
  let subSel = null, menuOpen = false, menuTab = 'stat';
  function defActs(S) { const t = S.touch || {}; return {b: t.b, a: t.a, c: t.c, q: t.q}; }
  function openMenu(tab) {
    const G = M.game; if (!G) return; menuTab = tab || menuTab; menuOpen = true;
    if (M.cfg.sides[1] !== 'remote' && M.host) M.paused = true;
    SP.onModalClose = () => { M.paused = false; subSel = null; menuOpen = false; };
    const me = M.cfg.me, h = G.hud(), S = SP.SPORTS[M.cfg.sid], sub = G.subInfo ? G.subInfo(me) : null, field = G.lineupState ? G.lineupState(me) : null;
    const tabs = [['stat', '📊 경기 현황']].concat(field ? [['sub', '🔁 선수 교체']] : []).concat([['set', '⚙ 설정 · 조작법']]);
    if (!tabs.some(t => t[0] === menuTab)) menuTab = 'stat';
    let body = '';
    if (menuTab === 'stat') body = G.status();
    else if (menuTab === 'sub') {
      const atpBar = a => `<span class="bar"><i style="width:${Math.round(a * 100)}%;background:${a > .55 ? '#5ef2c8' : a > .3 ? '#ffd25e' : '#ff5d6c'}"></i></span>${Math.round(a * 100)}%`;
      body = `<p class="sub">${sub ? esc(sub.text) + ' · ' : ''}${sub && sub.ok ? '① 뛰는 선수를 누르고 ② 후보 선수를 누르면 교체돼요.' : esc(sub ? sub.why || '' : '')}</p>
        <div class="wrap2"><div style="max-height:52vh;overflow:auto"><table class="rt"><tr><th>위치</th><th>선수</th><th>ATP</th><th>상태</th></tr>${field.on.map(r => `<tr data-on="${r.slot}" class="${String(subSel) === String(r.slot) ? 'sel' : ''}"><td>${esc(r.pos)}</td><td><b>${r.no} ${esc(r.name)}</b></td><td>${atpBar(r.atp)}</td><td>${esc(r.note || '')}</td></tr>`).join('')}</table></div>
        <div style="max-height:52vh;overflow:auto"><table class="rt"><tr><th>후보</th><th>종합</th><th>ATP</th></tr>${field.bench.map(r => `<tr data-in="${r.idx}"><td><b>${r.no} ${esc(r.name)}</b> <small style="color:#c3d0ea">${esc(r.role)}</small></td><td>${r.ovr}</td><td>${atpBar(r.atp)}</td></tr>`).join('')}</table></div></div>`;
    } else body = `<div class="lbl">화면 · 소리</div><div class="row"><button class="btn" id="mCam">🎥 시점: ${SP.cam.mode === 'persp' ? '중계 카메라' : '쿼터뷰'} (C)</button><button class="btn" id="mSnd">${SP.audio.muted ? '🔇 소리 켜기' : '🔔 소리 끄기'}</button></div>
      <div class="lbl">조작법</div><div class="sub" style="line-height:2">${SP.isTouch ? '왼쪽 화면 아무 곳이나 눌러 끌면 이동 · 오른쪽 둥근 버튼은 상황에 맞게 이름이 바뀌어요.<br>' : ''}${S.controls || ''}</div>`;
    const m = SP.modal(`<div class="menu-head"><h2>⏸ 일시정지 · ${esc(S.name)}</h2>${SP.scoreHtml(h.score)}</div><p class="sub" style="margin-top:4px">${esc(h.score.sub || '')}</p>
      <div class="menu-tabs">${tabs.map(([k, n]) => `<button type="button" data-mt="${k}" class="${menuTab === k ? 'on' : ''}">${n}</button>`).join('')}</div>${body}
      <div class="row" style="margin-top:14px"><button class="btn pri" id="res">▶ 경기 계속</button><button class="btn" id="mExit">🏠 로비로 나가기</button></div>`);
    m.querySelectorAll('[data-mt]').forEach(b => b.onclick = () => { SP.audio.click(); subSel = null; openMenu(b.dataset.mt); });
    $('res').onclick = SP.closeModal;
    $('mExit').onclick = () => { if (confirm('경기를 그만두고 로비로 갈까요?')) { net.close(); endMatch(); lobby(); } };
    const mc = $('mCam'); if (mc) mc.onclick = () => { SP.toggleCam(); openMenu('set'); };
    const ms = $('mSnd'); if (ms) ms.onclick = () => { SP.audio.setMuted(!SP.audio.muted); openMenu('set'); };
    m.querySelectorAll('[data-on]').forEach(e => e.onclick = () => { subSel = e.dataset.on; openMenu('sub'); });
    m.querySelectorAll('[data-in]').forEach(e => e.onclick = () => {
      if (subSel == null) { SP.toast('먼저 교체할 선수(왼쪽)를 눌러요'); return; }
      const action = {slot: isNaN(+subSel) ? subSel : +subSel, inIdx: +e.dataset.in};
      if (!M.host) { net.send({t: 'sub', a: action}); SP.toast('교체 요청을 보냈어요'); subSel = null; setTimeout(() => openMenu('sub'), 400); return; }
      const r = G.sub(me, action.slot, action.inIdx); SP.toast(r.ok ? '선수 교체!' : '교체할 수 없어요', r.msg || '', 1300); if (r.ok) SP.audio.whistle(1); subSel = null; openMenu('sub');
    });
  }

  /* ================= 온라인 (PeerJS + 같은 기기 탭 BroadcastChannel) ================= */
  const PREFIX = 'biosports-v1-', myId = 'c' + Math.random().toString(36).slice(2, 9);
  const net = SP.net = {
    role: null, code: '', peer: null, conn: null, bc: null, cfg: null,
    opts() { return {debug: 0, config: {iceServers: [{urls: ['stun:stun.l.google.com:19302']}, {urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp'}]}}; },
    loadPeer() { return window.Peer ? Promise.resolve() : new Promise((ok, no) => { const s = document.createElement('script'); s.src = '../vendor/peerjs.min.js'; s.onload = ok; s.onerror = no; document.head.appendChild(s); }); },
    open(id) { return this.loadPeer().then(() => new Promise((ok, no) => { let p; try { p = id ? new Peer(id, this.opts()) : new Peer(this.opts()); } catch (e) { no(e); return; } const to = setTimeout(() => { try { p.destroy(); } catch (e) {} no(new Error('timeout')); }, 9000); p.on('open', () => { clearTimeout(to); ok(p); }); p.on('error', e => { clearTimeout(to); no(e); }); })); },
    send(m) { m.from = myId; if (this.conn && this.conn.open) try { this.conn.send(m); } catch (e) {} if (this.bc) try { this.bc.postMessage(m); } catch (e) {} },
    close() { try { this.peer && this.peer.destroy(); } catch (e) {} try { this.bc && this.bc.close(); } catch (e) {} this.peer = this.conn = this.bc = null; this.role = null; },
    bcOpen(code) { try { this.bc = new BroadcastChannel(PREFIX + code); this.bc.onmessage = e => { const m = e.data; if (m && m.from !== myId) this.recv(m); }; } catch (e) {} },
    async host(cfg) {
      this.close(); this.role = 'host'; this.cfg = cfg;
      const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; this.code = ''; for (let i = 0; i < 6; i++) this.code += c[SP.ri(c.length)];
      this.ui('방을 만드는 중…');
      try { this.peer = await this.open(PREFIX + this.code); this.peer.on('connection', cn => { this.conn = cn; cn.on('data', m => this.recv(m)); cn.on('close', () => this.lost()); }); } catch (e) { this.peer = null; }
      this.bcOpen(this.code);
      this.ui(this.peer ? '친구에게 코드를 알려 주세요. 들어오면 바로 경기가 시작돼요.' : '인터넷 연결이 안 돼서 같은 기기의 다른 탭에서만 들어올 수 있어요.');
    },
    ui(msg) { SP.modal(`<h2>온라인 방</h2><p class="sub">${esc(msg)}</p><div class="code">${esc(this.code)}</div><div class="row"><button class="btn" id="cxn">방 닫기</button></div>`, {lock: true}); $('cxn').onclick = () => { this.close(); SP.closeModal(); }; },
    async join(code, team) {
      this.close(); this.role = 'guest'; this.code = code; this.team = team;
      SP.modal(`<h2>방 [${esc(code)}]에 참가하는 중…</h2><p class="sub">방장이 받아 주면 시작해요.</p><div class="row"><button class="btn" id="cxn">취소</button></div>`, {lock: true}); $('cxn').onclick = () => { this.close(); SP.closeModal(); };
      this.bcOpen(code); this.send({t: 'hello', team});
      setTimeout(async () => { if (this.role !== 'guest' || this.started) return;
        try { this.peer = await this.open(null); const cn = this.peer.connect(PREFIX + code, {reliable: true}); this.conn = cn; cn.on('open', () => this.send({t: 'hello', team})); cn.on('data', m => this.recv(m)); cn.on('close', () => this.lost()); this.peer.on('error', e => { if (e && e.type === 'peer-unavailable') SP.toast('방을 찾을 수 없어요'); }); } catch (e) { SP.toast('연결하지 못했어요'); } }, 700);
    },
    recv(m) {
      if (this.role === 'host') {
        if (m.t === 'hello' && !SP.inMatch) { const cfg = this.cfg, S = SP.SPORTS[cfg.sid]; let ot = m.team | 0; if (ot === cfg.teams[0]) ot = (ot + 1) % 10; cfg.teams[1] = ot; cfg.lineups[1] = S.slots ? SP.autoLineup(ot, S.slots(cfg.opts)) : []; cfg.sides = ['local', 'remote']; cfg.me = 0; cfg.diff = 1;
          SP.closeModal(); startMatch(cfg); this.send({t: 'start', cfg}); }
        else if (m.t === 'i') { const r = M.remoteIn, i = m.i; r.mx = i.mx; r.my = i.my; r.hb = i.hb; r.ha = i.ha; r.a += i.a; r.b += i.b; r.c += i.c; r.q += i.q; if (i.num) r.num = i.num; if (i.ext) r.ext = Object.assign(r.ext || {}, i.ext); }
        else if (m.t === 'sub' && M.game) { const r = M.game.sub(1, m.a.slot, m.a.inIdx); if (r.ok) { SP.audio.whistle(1); SP.toast('상대 선수 교체', r.msg || '', 1100); } }
      } else if (this.role === 'guest') {
        if (m.t === 'start' && !this.started) { this.started = true; const cfg = m.cfg; cfg.sides = ['remote', 'local']; cfg.me = 1; SP.closeModal(); startMatch(cfg, {guest: true}); }
        else if (m.t === 's') M.lastSnap = m.s;
      }
    },
    lost() { if (SP.inMatch && !M.over) { SP.toast('상대와 연결이 끊겼어요', '', 2000); if (this.role === 'host' && M.cfg) { M.cfg.sides[1] = 'ai'; } } }
  };

  lobby();
  // 시험용: 주소에 ?sport=soccer&auto=1 → 바로 AI 대 AI
  try { const q = new URLSearchParams(location.search); const s = q.get('sport'); if (SP.SPORTS[s] && q.get('auto')) { const S = SP.SPORTS[s], opts = {}; (S.options || []).forEach(o => opts[o.key] = o.def); const slots = S.slots ? S.slots(opts) : []; startMatch({sid: s, teams: [0, 1], lineups: [S.slots ? SP.autoLineup(0, slots) : [], S.slots ? SP.autoLineup(1, slots) : []], opts, diff: 1, speed: +(q.get('speed') || 3), sim: +(q.get('sim') || 1), sides: q.get('human') ? ['local', 'ai'] : ['ai', 'ai'], me: 0}); } } catch (e) {}
})();
