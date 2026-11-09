/* BIO ARCADE 플레이어별 입력 기록 (모든 게임 공통)
   세 단계를 시간순으로 남겨 "눌렀는데 안 됐어요"가 어디서 끊겼는지 확인한다.
     1) 사용자 입력  U  키·마우스·터치 (자동 수집, 바뀔 때만)
     2) 게임 입력    G  게임이 입력을 어떤 행동으로 바꿨는지      → 게임이 ILOG.game('돌진', '방향 …') 한 줄
     3) 입력 결과    R  위치·점수·체력·화면 상태가 실제로 바뀐 것  → 게임별 상태 읽기(아래 WATCH)를 0.2초마다 비교
   · 기기 안(IndexedDB)에 게임마다 최근 5판만 저장, 판이 끝나거나 창을 떠날 때 한 번에 씀
   · 입력창(채팅·이름)에 치는 글자는 기록하지 않음
   · 끊긴 곳 자동 표시: 입력은 있는데 행동이 없음(U→G), 행동은 있는데 결과가 없음(G→R)
   · ILOG.openViewer() : 기록 보기(세 단계 나란히) · CSV 내보내기 */
(function () {
  'use strict';
  if (window.ILOG) return;
  const GAME = (location.pathname.split('/').pop() || 'index.html').replace(/\.html?$/, '') || 'index';
  const KEEP = 5, MAXEV = 6000, SAMPLE = 0.2;
  const T0 = performance.now(), now = () => +((performance.now() - T0) / 1000).toFixed(3);
  const prof = (() => { try { return JSON.parse(localStorage.getItem('bioArcadeStudentProfile')) || {}; } catch (e) { return {}; } })();
  const device = (() => { const u = navigator.userAgent; const kind = /iPad|Tablet/i.test(u) ? '태블릿' : /Mobi|Android|iPhone/i.test(u) ? '휴대폰' : 'PC';
    const os = /iPhone|iPad|Mac OS/.test(u) ? (/iPhone|iPad/.test(u) ? 'iOS' : 'macOS') : /Android/.test(u) ? 'Android' : /Windows/.test(u) ? 'Windows' : /CrOS/.test(u) ? 'ChromeOS' : 'Linux';
    const br = /Edg\//.test(u) ? 'Edge' : /Whale/.test(u) ? 'Whale' : /SamsungBrowser/.test(u) ? 'Samsung' : /Chrome\//.test(u) ? 'Chrome' : /Safari\//.test(u) ? 'Safari' : /Firefox/.test(u) ? 'Firefox' : '기타';
    return `${kind} · ${os} · ${br} · ${innerWidth}×${innerHeight}`; })();
  let run = null, usesGame = false, lastSnap = '', snapObj = null;

  // ---------------------------------------------------------------- 게임별 상태 읽기 (결과 단계)
  const r1 = v => typeof v === 'number' ? Math.round(v * 10) / 10 : v;
  const WATCH = {
    'only-up': () => ({화면: state, x: r1(pl.x), y: r1(pl.y), z: r1(pl.z), 낙하: falls, 점프: jumps}),
    'bio-kart': () => { const P = G.R && G.R.player; return {화면: G.screen, 바퀴: P && P.lap, 순위: P && P.rank, x: P && r1(P.x), y: P && r1(P.y)}; },
    'bio-strike': () => ({모드: G.mode, 체력: G.player && r1(G.player.hp), x: G.player && r1(G.player.pos.x), y: G.player && r1(G.player.pos.y), z: G.player && r1(G.player.pos.z), 점수: G.score}),
    'biotro': () => ({점수: G && G.score, 남은손: G && G.hands, 손패: G && G.hand && G.hand.length}),
    'cell-bound': () => ({화면: G.mode, 체력: G.player && G.player.hp, x: G.player && r1(G.player.x), y: G.player && r1(G.player.y)}),
    'cell-brawl': () => ({화면: state, 체력: G && G.player && r1(G.player.hp), x: G && G.player && G.player.pos && r1(G.player.pos.x), z: G && G.player && G.player.pos && r1(G.player.pos.z)}),
    'cell-pinball': () => ({화면: G.mode, 점수: G.players && G.players[G.cur] && G.players[G.cur].score, 공: G.balls && G.balls.length}),
    'immune-strike': () => ({화면: state, 점수: score, x: pl && r1(pl.x), y: pl && r1(pl.y), 체력: pl && pl.hp, 목숨: pl && pl.lives}),
    'vessel-canyon': () => ({화면: STATE, 체력: G && G.player && r1(G.player.hp), x: G && G.player && r1(G.player.x), y: G && G.player && r1(G.player.y)}),
    'helix': () => ({화면: G.state, 동작: G.player && G.player.act, x: G.player && Math.round(G.player.x), z: G.player && Math.round(G.player.z), 체력: G.player && G.player.hp, 방: G.run ? G.run.ch + '-' + G.run.room : ''}),
  };
  let watchFn = WATCH[GAME] || null;
  function snapshot() {
    if (window.ILOG_WATCH && watchFn !== window.ILOG_WATCH) watchFn = window.ILOG_WATCH;   // 게임이 안쪽에서 정해 둔 상태 읽기
    if (!watchFn) return null;
    let o; try { o = watchFn(); } catch (e) { return null; }
    if (!o) return null;
    for (const k in o) if (o[k] === undefined || o[k] === null || (typeof o[k] === 'number' && !isFinite(o[k]))) delete o[k];
    return o;
  }

  // ---------------------------------------------------------------- 판 관리
  function newRun() {
    run = {game: GAME, start: new Date().toISOString(), uid: prof.uid || '', stId: prof.stId || '', name: prof.name || '', device, ev: [], open: []};
    push('R', '시작', describe(snapshot()));
  }
  const PASSIVE = GAME === 'index';   // 메인 화면은 기록하지 않고 보기만
  function push(st, what, d, dev) {
    if (PASSIVE) return {};
    if (!run) newRun();
    if (run.ev.length >= MAXEV) run.ev.splice(0, 500);
    const e = {t: now(), st, w: String(what).slice(0, 60)}; if (d) e.d = String(d).slice(0, 160); if (dev) e.dv = dev;
    run.ev.push(e); return e;
  }
  const describe = o => o ? Object.entries(o).map(([k, v]) => k + ' ' + v).join(', ') : '';
  function diffSnap(a, b) {
    if (!a || !b) return describe(b);
    const out = []; for (const k in b) if (a[k] !== b[k]) out.push(k + ' ' + (a[k] === undefined ? '' : a[k] + '→') + b[k]);
    return out.join(', ');
  }
  // 상태 비교: 바뀌었을 때만 결과(R) 기록
  setInterval(() => {
    if (document.hidden) return;
    const s = snapshot(); if (!s) return;
    const key = JSON.stringify(s); if (key === lastSnap) return;
    const d = diffSnap(snapObj, s); lastSnap = key; snapObj = s;
    if (run && d) { push('R', '상태', d); markResolved('R'); }
  }, SAMPLE * 1000);

  // ---------------------------------------------------------------- 끊긴 곳 판정
  // 사용자 입력 뒤 0.5초 안에 게임 행동이 없으면 "행동 없음", 게임 행동 뒤 1초 안에 결과가 없으면 "결과 없음"
  const pendingU = [], pendingG = [];
  function markResolved(st) { if (st === 'G') pendingU.length = 0; if (st === 'R') pendingG.length = 0; }
  setInterval(() => {
    const t = now();
    while (pendingU.length && t - pendingU[0].t > 0.5) { const e = pendingU.shift(); if (usesGame) { e.gap = 'U'; } }
    while (pendingG.length && t - pendingG[0].t > 1.0) { const e = pendingG.shift(); if (watchFn) e.gap = 'G'; }
  }, 150);

  // ---------------------------------------------------------------- 1) 사용자 입력 자동 수집
  const typing = e => { const t = e.target; return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable); };
  const held = new Set();
  const label = el => { if (!el || el === document || el === window) return ''; const id = el.id ? '#' + el.id : ''; const a = el.dataset && (el.dataset.act || el.dataset.i || el.dataset.k); return (el.tagName || '').toLowerCase() + id + (a ? '[' + a + ']' : ''); };
  function userIn(what, d, dev, act) {
    const e = push('U', what, d, dev);
    if (act) pendingU.push(e);
  }
  addEventListener('keydown', e => { if (typing(e) || e.repeat) return; held.add(e.code); userIn('키 누름 ' + e.code, '', '키보드', true); }, true);
  addEventListener('keyup', e => { if (typing(e) || !held.has(e.code)) return; held.delete(e.code); userIn('키 뗌 ' + e.code, '', '키보드'); }, true);
  addEventListener('pointerdown', e => { if (e.pointerType === 'touch') return; userIn(e.pointerType === 'pen' ? '펜' : '마우스 ' + ['왼쪽', '가운데', '오른쪽'][e.button] + ' 누름', `${Math.round(e.clientX)},${Math.round(e.clientY)} ${label(e.target)}`, '마우스', true); }, true);
  addEventListener('pointerup', e => { if (e.pointerType === 'touch') return; userIn('마우스 뗌', label(e.target), '마우스'); }, true);
  addEventListener('pointercancel', e => userIn('입력 취소(pointercancel)', label(e.target), e.pointerType === 'touch' ? '터치' : '마우스'), true);
  const touchMove = new Map();
  addEventListener('touchstart', e => { for (const t of e.changedTouches) { touchMove.set(t.identifier, 0); userIn('터치 시작', `${Math.round(t.clientX)},${Math.round(t.clientY)} ${label(e.target)} · 손가락 ${e.touches.length}`, '터치', true); } }, {capture: true, passive: true});
  addEventListener('touchmove', e => { for (const t of e.changedTouches) { const n = (touchMove.get(t.identifier) || 0) + 1; touchMove.set(t.identifier, n); if (n === 1) userIn('터치 이동', `${Math.round(t.clientX)},${Math.round(t.clientY)} · 손가락 ${e.touches.length}`, '터치'); } }, {capture: true, passive: true});
  addEventListener('touchend', e => { for (const t of e.changedTouches) { touchMove.delete(t.identifier); userIn('터치 끝', `${Math.round(t.clientX)},${Math.round(t.clientY)}`, '터치'); } }, {capture: true, passive: true});
  addEventListener('touchcancel', e => { for (const t of e.changedTouches) { touchMove.delete(t.identifier); userIn('터치 취소(브라우저가 가져감)', '', '터치'); } }, {capture: true, passive: true});
  if (window.visualViewport) { let sc = visualViewport.scale; visualViewport.addEventListener('resize', () => { if (Math.abs(visualViewport.scale - sc) > 0.02) { sc = visualViewport.scale; push('R', '화면 확대/축소', '배율 ' + sc.toFixed(2)); } }); }
  addEventListener('blur', () => { if (held.size) { push('U', '창을 벗어남', '누르고 있던 키 ' + [...held].join(' ')); held.clear(); } });
  addEventListener('error', e => push('R', '오류', (e.message || '') + ' @' + (e.lineno || '')));

  // ---------------------------------------------------------------- 저장 (IndexedDB)
  let dbp = null;
  function db() {
    if (dbp) return dbp;
    return dbp = new Promise((ok, no) => { try { const r = indexedDB.open('bioarcade-inputlog', 1); r.onupgradeneeded = () => { const s = r.result.createObjectStore('runs', {keyPath: 'id', autoIncrement: true}); s.createIndex('game', 'game'); }; r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); } catch (e) { no(e); } });
  }
  function summarize(r) {
    const s = {user: 0, game_: 0, result: 0, gapNoAction: 0, gapNoResult: 0};
    for (const e of r.ev) { if (e.st === 'U') s.user++; else if (e.st === 'G') s.game_++; else s.result++; if (e.gap === 'U') s.gapNoAction++; if (e.gap === 'G') s.gapNoResult++; }
    return s;
  }
  async function save() {
    if (!run || run.ev.length < 3) return;
    const r = run; r.end = new Date().toISOString(); r.sum = summarize(r); delete r.open;
    run = null; lastSnap = ''; snapObj = null;
    try {
      const d = await db(); const tx = d.transaction('runs', 'readwrite'), st = tx.objectStore('runs');
      st.add(r);
      const all = await new Promise(ok => { const q = st.index('game').getAllKeys(r.game); q.onsuccess = () => ok(q.result || []); q.onerror = () => ok([]); });
      if (all.length >= KEEP) all.slice(0, all.length - KEEP + 1).forEach(k => st.delete(k));
    } catch (e) {}
  }
  addEventListener('pagehide', () => { save(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  async function list(game) {
    try { const d = await db(); return await new Promise(ok => { const st = d.transaction('runs').objectStore('runs'); const q = game ? st.index('game').getAll(game) : st.getAll(); q.onsuccess = () => ok(q.result || []); q.onerror = () => ok([]); }); } catch (e) { return []; }
  }

  // ---------------------------------------------------------------- 처음 한 번 안내
  function notice() {
    try { if (localStorage.getItem('ilogNotice')) return; localStorage.setItem('ilogNotice', '1'); } catch (e) { return; }
    const n = document.createElement('div');
    n.textContent = '안내: 문제를 찾기 위해 이 기기에 입력 기록(누른 키·터치와 게임 상태)을 최근 5판까지 저장합니다. 채팅·이름 입력 내용은 저장하지 않으며, 선생님 화면에는 판 수와 끊김 횟수만 올라갑니다.';
    Object.assign(n.style, {position: 'fixed', left: '50%', bottom: '14px', transform: 'translateX(-50%)', maxWidth: 'min(92vw,560px)', zIndex: 2147483000, background: 'rgba(12,16,24,.94)', color: '#e8eef6', font: '13px/1.5 system-ui,sans-serif', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,.18)', boxShadow: '0 6px 24px rgba(0,0,0,.4)', pointerEvents: 'none'});
    document.body.appendChild(n); setTimeout(() => n.remove(), 7000);
  }
  if (document.body) notice(); else addEventListener('DOMContentLoaded', notice);

  // ---------------------------------------------------------------- 기록 보기
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  function csv(runs) {
    const rows = [['게임', '시작', '학번', '이름', '기기', '시각(초)', '단계', '내용', '자세히', '장치', '끊김']];
    const stName = {U: '1.사용자 입력', G: '2.게임 입력', R: '3.입력 결과'};
    for (const r of runs) for (const e of r.ev) rows.push([r.game, r.start, r.stId, r.name, r.device, e.t, stName[e.st], e.w, e.d || '', e.dv || '', e.gap === 'U' ? '행동 없음' : e.gap === 'G' ? '결과 없음' : '']);
    return '﻿' + rows.map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\r\n');
  }
  async function openViewer(opt = {}) {
    if (run && run.ev.length > 2) await save();
    const all = (await list(opt.all ? null : (opt.game || (GAME === 'index' ? null : GAME)))).sort((a, b) => (b.start > a.start ? 1 : -1));
    const old = document.getElementById('ilogView'); if (old) old.remove();
    const v = document.createElement('div'); v.id = 'ilogView';
    v.innerHTML = `<style>#ilogView{position:fixed;inset:0;z-index:2147483001;background:rgba(5,8,12,.94);color:#e8eef6;font:13px/1.45 system-ui,"Noto Sans KR",sans-serif;display:flex;flex-direction:column;padding:14px;gap:10px;touch-action:auto}
      #ilogView .bar,#ilogView .sum,#ilogView>small{flex:none}#ilogView .bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center}#ilogView select,#ilogView button{font:inherit;background:#18202c;color:#e8eef6;border:1px solid #33415a;border-radius:8px;padding:6px 10px;cursor:pointer}
      #ilogView .cols{flex:1;overflow:auto;border:1px solid #2a3446;border-radius:10px}#ilogView table{width:100%;border-collapse:collapse}#ilogView th{position:sticky;top:0;background:#141b26;text-align:left;padding:6px 8px;font-weight:700}
      #ilogView td{padding:3px 8px;border-top:1px solid #1b2330;vertical-align:top}#ilogView td.t{color:#8a9ab0;white-space:nowrap;font-variant-numeric:tabular-nums}#ilogView .gap{background:rgba(255,80,90,.18)}#ilogView .gap b{color:#ff8a96}
      #ilogView .sum span{display:inline-block;margin-right:12px}#ilogView small{color:#8a9ab0}</style>
      <div class="bar"><b style="font-size:16px">입력 기록 보기</b><select id="ilogRun">${all.map((r, i) => `<option value="${i}">${esc(r.game)} · ${esc((r.start || '').replace('T', ' ').slice(0, 19))} · ${esc(r.name || '')} (${r.ev.length})</option>`).join('') || '<option>기록 없음</option>'}</select>
      <label><input type="checkbox" id="ilogGaps"> 끊긴 곳만</label><button id="ilogCsv">CSV 내보내기 (전체)</button><button id="ilogClose" style="margin-left:auto">닫기</button></div>
      <div class="sum" id="ilogSum"></div><div class="cols"><table><thead><tr><th>시각</th><th>1. 사용자 입력</th><th>2. 게임 입력</th><th>3. 입력 결과</th></tr></thead><tbody id="ilogBody"></tbody></table></div>
      <small>빨간 줄: 입력은 있는데 게임 행동이 없음(1→2에서 끊김) 또는 행동은 있는데 결과가 없음(2→3에서 끊김).</small>`;
    document.body.appendChild(v);
    const $ = id => v.querySelector('#' + id);
    const show = () => {
      const r = all[+$('ilogRun').value]; if (!r) { $('ilogBody').innerHTML = '<tr><td colspan="4">저장된 기록이 없습니다. 게임을 한 판 하고 다시 열어 보세요.</td></tr>'; return; }
      const s = r.sum || summarize(r), only = $('ilogGaps').checked;
      $('ilogSum').innerHTML = `<span>${esc(r.stId)} ${esc(r.name)}</span><span>${esc(r.device)}</span><span>사용자 입력 ${s.user}</span><span>게임 입력 ${s.game_}</span><span>결과 ${s.result}</span><span style="color:#ff8a96">행동 없음 ${s.gapNoAction} · 결과 없음 ${s.gapNoResult}</span>`;
      const cell = (e, st) => e.st === st ? `<b>${esc(e.w)}</b> <small>${esc(e.d || '')}</small>` : '';
      $('ilogBody').innerHTML = r.ev.filter(e => !only || e.gap).slice(-2500).map(e => `<tr class="${e.gap ? 'gap' : ''}"><td class="t">${e.t.toFixed(2)}</td><td>${cell(e, 'U')}${e.gap === 'U' ? ' <b>← 행동 없음</b>' : ''}</td><td>${cell(e, 'G')}${e.gap === 'G' ? ' <b>← 결과 없음</b>' : ''}</td><td>${cell(e, 'R')}</td></tr>`).join('');
    };
    $('ilogRun').onchange = show; $('ilogGaps').onchange = show; $('ilogClose').onclick = () => v.remove();
    $('ilogCsv').onclick = () => { const b = new Blob([csv(all)], {type: 'text/csv'}); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'bioarcade_inputlog_' + new Date().toISOString().slice(0, 10) + '.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
    show();
  }
  // 단축키: Ctrl+Shift+L 로 기록 보기
  addEventListener('keydown', e => { if (e.ctrlKey && e.shiftKey && e.code === 'KeyL') { e.preventDefault(); openViewer(); } });

  // 구글 시트로 보낼 요약 (판 수 · 단계별 끊김 횟수만)
  async function summaryRows(since) {
    const all = await list(null), by = {};
    for (const r of all) { if (since && r.end && r.end <= since) continue; const s = r.sum || summarize(r), g = by[r.game] || (by[r.game] = {game: r.game, runs: 0, user: 0, game_: 0, result: 0, gapNoAction: 0, gapNoResult: 0}); g.runs++; for (const k in s) g[k] += s[k]; }
    return Object.values(by);
  }

  window.ILOG = {
    game(what, d) { usesGame = true; const e = push('G', what, d); markResolved('G'); pendingG.push(e); return e; },   // 2) 게임 입력
    result(what, d) { push('R', what, d); markResolved('R'); },                                                              // 3) 결과 (상태 읽기로 못 잡는 것)
    watch(fn) { watchFn = fn; },
    runStart(what) { if (run && run.ev.length > 3) save(); newRun(); if (what) push('R', what); },
    runEnd(what) { if (what) push('R', what); return save(); },
    openViewer, list, csv, summaryRows, device, snap: snapshot, get game_() { return GAME; },
  };
})();
