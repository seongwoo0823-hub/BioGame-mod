// 생물의 번제 — 화면 UI: 화면 맞춤 · 메뉴 · 알림 · 보스 등장 · 결과 · 도감 · 터치 버튼 · 기록
(function () {
  'use strict';
  const CR = window.CR, G = CR.G, AU = CR.audio, IN = CR.input, W = CR.W, H = CR.H;
  const $ = s => document.querySelector(s);
  const box = $('#box'), cv = $('#game');
  const ui = CR.ui = {};
  const RANK_ID = 'cell-raid';

  /* ───────── 화면 맞춤 ───────── */
  function resize() {
    const touch = IN.touch || matchMedia('(pointer: coarse)').matches;
    const vw = innerWidth, vh = innerHeight, portrait = vh > vw;
    let s = Math.min(vw / W, vh / H);
    if (touch && portrait) s = vw / W;                 // 세로 폰: 화면 너비에 맞추고 아래는 조작 공간
    const w = Math.floor(W * s), h = Math.floor(H * s);
    box.style.width = w + 'px'; box.style.height = h + 'px';
    box.style.left = Math.floor((vw - w) / 2) + 'px';
    box.style.top = (touch && portrait ? Math.max(8, Math.floor(vh * 0.08)) : Math.floor((vh - h) / 2)) + 'px';
    document.documentElement.style.setProperty('--s', s.toFixed(3));
    document.body.classList.toggle('portrait', portrait); document.body.classList.toggle('touch', touch);
  }
  addEventListener('resize', resize); addEventListener('orientationchange', () => setTimeout(resize, 200)); resize();

  /* ───────── 기록 ───────── */
  const loadJ = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') || d; } catch (e) { return d; } };
  const saveJ = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  let stats = loadJ('cellRaidStats', { runs: 0, wins: 0, bestStage: 0, bestTime: 0, kills: 0 });
  const seen = new Set(loadJ('cellRaidSeen', []));
  ui.markSeen = id => { if (!seen.has(id)) { seen.add(id); saveJ('cellRaidSeen', [...seen]); } };

  /* ───────── 알림 · 배너 · 보스 등장 ───────── */
  const toastEl = $('#toast'); let toastT = 0, toastQ = [];
  ui.toast = (name, desc, col) => { toastQ.push({ name, desc, col }); if (toastQ.length > 4) toastQ.shift(); if (!toastT) nextToast(); };
  function nextToast() {
    const m = toastQ.shift(); if (!m) { toastEl.classList.remove('on'); toastT = 0; return; }
    toastEl.querySelector('b').textContent = m.name; toastEl.querySelector('b').style.color = m.col || '#fff'; toastEl.querySelector('span').textContent = m.desc || '';
    toastEl.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => { toastEl.classList.remove('on'); toastT = setTimeout(nextToast, 220); }, 2600);
  }
  const bannerEl = $('#banner'); let bannerT = 0;
  ui.banner = (a, b) => { bannerEl.innerHTML = '<small>' + a + '</small><b>' + b + '</b>'; bannerEl.classList.add('on'); clearTimeout(bannerT); bannerT = setTimeout(() => bannerEl.classList.remove('on'), 2200); $('#stageName').textContent = b; };
  const introEl = $('#bossIntro');
  ui.bossIntro = def => {
    if (!def) { introEl.classList.remove('on'); return; }
    introEl.querySelector('img').src = CR.url(CR.mob(def.shape, 32, def.col, { c2: def.c2, angry: 1, crown: def.crown }, 0));
    introEl.querySelector('b').textContent = def.name; introEl.querySelector('span').textContent = def.desc;
    introEl.classList.add('on');
  };
  ui.bossBar = () => {};

  /* ───────── 화면 전환 ───────── */
  const screens = ['#title', '#pause', '#over', '#codex', '#help'];
  function show(id) { screens.forEach(s => $(s).classList.toggle('on', s === id)); }
  ui.show = show;
  function titleInfo() {
    $('#titleRec').innerHTML = stats.runs ? `도전 <b>${stats.runs}</b>회 · 최고 <b>${stats.wins ? '완주 ' + stats.wins + '회' : '구역 ' + (stats.bestStage || 1)}</b>${stats.bestTime ? ' · 최고 기록 <b>' + CR.fmtTime(stats.bestTime) + '</b>' : ''}` : '면역 백혈구가 되어 인체 6구역에 침입한 병원체를 물리치세요';
  }
  titleInfo(); show('#title');
  ui.onStart = () => { G.mapToggle = false; show(null); $('#touch').classList.toggle('on', IN.touch || matchMedia('(pointer: coarse)').matches); resize(); };
  function begin(o) { AU.init(); AU.sfx('menu'); CR.startRun(o); }
  $('#btnStart').onclick = () => begin({});
  $('#btnCodexT').onclick = () => openCodex();
  $('#btnHelpT').onclick = () => { AU.sfx('menu'); show('#help'); };
  $('#helpBack').onclick = () => { AU.sfx('menu'); show(G.mode === 'title' ? '#title' : (G.mode === 'pause' ? '#pause' : null)); };
  // 일시정지
  function pause(on) {
    if (on && G.mode === 'play') { G.mode = 'pause'; show('#pause'); syncSnd(); }
    else if (!on && G.mode === 'pause') { G.mode = 'play'; show(null); }
  }
  ui.pause = pause;
  $('#btnResume').onclick = () => pause(false);
  $('#btnCodexP').onclick = () => openCodex();
  $('#btnHelpP').onclick = () => show('#help');
  $('#btnRestart').onclick = () => { if (confirm('처음부터 다시 시작할까요? 지금 진행은 사라져요.')) begin({}); };
  $('#btnMusic').onclick = () => { AU.music = !AU.music; AU.apply(); syncSnd(); };
  $('#btnSfx').onclick = () => { AU.on = !AU.on; AU.apply(); syncSnd(); };
  function syncSnd() { $('#btnMusic').textContent = '배경 음악 ' + (AU.music ? '켜짐' : '꺼짐'); $('#btnSfx').textContent = '모든 소리 ' + (AU.on ? '켜짐' : '꺼짐'); }
  // 결과
  ui.gameOver = o => {
    const sb = G.sandbox;
    stats.runs++; stats.kills += o.kills;
    if (!sb) { stats.bestStage = Math.max(stats.bestStage, o.stage); if (o.win) { stats.wins++; if (!stats.bestTime || o.time < stats.bestTime) stats.bestTime = o.time; } }
    saveJ('cellRaidStats', stats); titleInfo();
    $('#overTitle').textContent = o.win ? '인체 정화 완료!' : '백혈구가 쓰러졌어요';
    $('#overTitle').className = o.win ? 'win' : 'lose';
    $('#overStats').innerHTML = `<div><small>진행 시간</small><b>${CR.fmtTime(o.time)}</b></div><div><small>도달 구역</small><b>${o.win ? '완주' : o.stage + '구역'}</b></div><div><small>처치한 병원체</small><b>${o.kills}</b></div><div><small>모은 아이템</small><b>${o.items}개</b></div>` + (sb ? '<p class="sb">샌드박스를 쓴 판이라 랭킹에는 기록되지 않아요</p>' : '');
    setTimeout(() => {
      show('#over');
      if (!sb && window.BioGoal) {
        const v = o.win ? 7 : o.stage, sec = Math.round(o.time);
        BioGoal.result(RANK_ID, v, { text: (o.win ? '완주' : '구역 ' + o.stage) + ' · ' + CR.fmtTime(o.time).slice(0, 8), rank: { v: BioGoal.key([[v, 10, 1], [Math.min(sec, 35999), 36000, -1]]), f: { stage: o.win ? '완주' : o.stage, time: sec } } });
      }
    }, o.win ? 1200 : 900);
  };
  $('#btnAgain').onclick = () => begin({});
  $('#btnOverTitle').onclick = () => { G.mode = 'title'; AU.play(null); show('#title'); $('#touch').classList.remove('on'); };

  /* ───────── 바이오 도감 (열람 전용) ───────── */
  const TABS = [
    ['passive', '패시브 70', () => CR.PASSIVES], ['active', '액티브 30', () => CR.ACTIVES], ['tool', '수술도구 20', () => CR.TOOLS], ['chart', '진단서 10', () => CR.CHARTS],
    ['hormone', '호르몬 8', () => CR.HORMONES], ['enemy', '병원체 40', () => CR.ENEMIES], ['boss', '보스 21', () => CR.BOSSES],
  ];
  let tab = 'passive', codexFrom = 'title';
  function iconOf(x) {
    if (x.kind === 'enemy') return CR.url(CR.mob(x.shape, x.S || 16, x.col, { c2: x.c2, angry: x.angry }, 0));
    if (x.kind === 'boss') return CR.url(CR.mob(x.shape, 32, x.col, { c2: x.c2, angry: 1, crown: x.crown }, 0));
    if (x.kind === 'hormone') return CR.url(CR.icon('pill', x.col, x.col2));
    return CR.url(CR.icon(x.glyph, x.col, x.col2));
  }
  // 도감: 시작 화면·일시정지 메뉴에서 들어가 열람만 함
  function openCodex() {
    AU.init(); AU.sfx('menu');
    codexFrom = G.mode === 'pause' ? 'pause' : 'title';
    show('#codex'); renderCodex();
  }
  ui.openCodex = openCodex;
  function closeCodex() { AU.sfx('menu'); show(codexFrom === 'pause' ? '#pause' : '#title'); }
  $('#codexClose').onclick = closeCodex;
  function renderCodex() {
    $('#codexTabs').innerHTML = TABS.map(([k, n]) => `<button type="button" data-tab="${k}" class="${k === tab ? 'on' : ''}">${n}</button>`).join('');
    $('#codexTabs').querySelectorAll('button').forEach(b => b.onclick = () => { tab = b.dataset.tab; AU.sfx('menu'); renderCodex(); });
    const L = TABS.find(t => t[0] === tab)[2](), list = $('#codexList');
    let n = 0;
    list.innerHTML = L.map(x => {
      const met = seen.has(x.id); if (met) n++;
      const tier = x.tier === 4 ? '<i class="op">사기템</i>' : x.tier ? `<i>등급 ${x.tier}</i>` : x.charge != null ? `<i>충전 ${x.charge}칸</i>` : x.kind === 'enemy' ? `<i>${x.st}구역 · 체력 ${x.hp}</i>` : x.kind === 'boss' ? `<i>${x.st}구역 보스 · 체력 ${x.hp}</i>` : x.kind === 'hormone' ? `<i class="${x.good ? '' : 'bad'}">${x.good ? '좋은 효과' : '나쁜 효과'}</i>` : '';
      return `<div class="card ${x.tier === 4 ? 'legend' : ''} ${met ? '' : 'unseen'}"><img src="${iconOf(x)}" alt=""><div class="tx"><b>${x.name}${met ? '' : ' <small class="new">미발견</small>'}</b><small>${x.id} ${tier}</small><p>${x.desc}</p></div></div>`;
    }).join('');
    $('#codexNote').textContent = `이 기기에서 만나 본 것 ${n} / ${L.length} — 게임에서 만나면 밝게 표시돼요`;
  }
  /* ───────── 키 · 터치 버튼 ───────── */
  // 먹기 전 미리보기 말풍선
  const peekEl = $('#peek'); let peekKey = '';
  const PKN = { heart: ['ATP 하트', '체력 1칸 회복'], bomb: ['리소좀 폭탄', '폭탄 +1'], key: ['제한효소 열쇠', '열쇠 +1'] };
  function updatePeek() {
    const pk = G.mode === 'play' && !G.intro && G.peek;
    if (!pk) { if (peekKey) { peekEl.classList.remove('on'); peekKey = ''; } return; }
    const k = (pk.id || pk.pk || (pk.custom && pk.custom.name)) + '|' + (pk.price || '') + '|' + (pk.hpCost || '');
    if (k !== peekKey) {
      peekKey = k; let name, desc, tag = '', cls = '';
      if (pk.custom) { name = pk.custom.name; desc = pk.custom.desc; tag = pk.custom.tag; }
      else if (pk.pk) { [name, desc] = PKN[pk.pk] || [pk.pk, '']; }
      else { const x = CR.ALL[pk.id]; name = x.name; desc = x.desc;
        if (x.kind === 'passive') { tag = x.tier === 4 ? '사기템' : '패시브 · 등급 ' + x.tier; cls = x.tier === 4 ? 'op' : ''; }
        else if (x.kind === 'active') tag = '액티브 · 충전 ' + x.charge + '칸 (Space)';
        else if (x.kind === 'tool') tag = '수술도구 (G로 버리기)';
        else if (x.kind === 'chart') tag = '진단서 (Q 사용 · F 버리기)';
        else if (x.kind === 'hormone') { tag = (x.good ? '호르몬' : '호르몬 · 나쁜 효과') + ' (Q 사용 · F 버리기)'; cls = x.good ? '' : 'bad'; }
        peekEl.querySelector('b').style.color = x.tier === 4 ? '#ffd75e' : '#fff'; }
      if (pk.pk || pk.custom) peekEl.querySelector('b').style.color = pk.custom ? '#9fe8ff' : '#fff';
      peekEl.querySelector('b').textContent = name; const ti = peekEl.querySelector('i'); ti.textContent = tag; ti.className = cls; ti.style.display = tag ? '' : 'none';
      peekEl.querySelector('span').textContent = desc;
      peekEl.querySelector('em').textContent = pk.custom ? '' : pk.price ? '가격 ' + pk.price + ' ATP 코인 — 닿으면 구매' : pk.hpCost ? '최대 체력 1칸을 내고 가져가요 — 닿으면 거래' : '닿으면 먹어요 · 그냥 지나가도 돼요';
      peekEl.classList.add('on');
    }
    const s = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--s')) || 2;
    peekEl.style.left = ((CR.RX + pk.x) * s) + 'px'; peekEl.style.top = ((CR.RY + pk.y) * s) + 'px';
  }
  ui.frame = () => {
    updatePeek();
    if (IN.take('Escape') || IN.take('p')) { if ($('#codex').classList.contains('on')) closeCodex(); else if (G.mode === 'play') pause(true); else if (G.mode === 'pause') pause(false); }
    IN.take('Tab');
    G.bigMap = G.mode === 'play' && (IN.keys.Tab || G.mapToggle);
    $('#mapLegend').classList.toggle('on', !!G.bigMap);
    if (IN.take('m')) { AU.music = !AU.music; AU.apply(); CR.toast('배경 음악 ' + (AU.music ? '켜짐' : '꺼짐'), 'M 키로 바꿀 수 있어요', '#cfe0f0'); }
    if (G.mode === 'over' && (IN.take('Enter') || IN.take('r'))) begin({});
    if (G.mode !== 'play') { IN.take(' '); IN.take('q'); IN.take('e'); IN.take('f'); IN.take('g'); IN.take('x'); }
    // 아래 이름표
    if (G.P && (G.tick % 15 === 0)) {
      const tn = G.P.tools.map(id => CR.ALL[id].name).join(' · '), cn = G.P.cons.map(id => CR.ALL[id].name).join(' · ');
      $('#toolName').textContent = tn; $('#consName').textContent = cn ? cn + ' (Q)' : '';
      if (G.P.active) $('#actName').textContent = CR.ALL[G.P.active.id].name; else $('#actName').textContent = '';
    }
  };
  document.querySelectorAll('#touch [data-act]').forEach(b => {
    const k = b.dataset.act;
    b.addEventListener('touchstart', e => { e.preventDefault(); AU.init(); if (k === 'pause') { pause(G.mode === 'play'); return; } if (k === 'map') { G.mapToggle = !G.mapToggle; return; } IN.pressed[k] = true; }, { passive: false });
  });
  CR.bindTouch($('#touchLayer'), { L: { base: $('#stickL'), knob: $('#stickL i') }, R: { base: $('#stickR'), knob: $('#stickR i') } });
  addEventListener('touchstart', () => { if (!IN.touch) { IN.touch = true; resize(); if (G.mode === 'play') $('#touch').classList.add('on'); } }, { passive: true });
  // 다른 창으로 가면 자동 일시정지
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(true); });

  // 입력 기록(../ilog.js)이 읽을 게임 상태
  window.ILOG_WATCH = () => G.P ? { mode: G.mode, stage: G.stage, room: G.room && G.room.type, hp: G.P.hp, enemies: G.room ? G.room.ents.length : 0, t: Math.round(G.time) } : { mode: G.mode };
})();
