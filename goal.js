/* BIO ARCADE 목표 점수 (랭킹 대신)
 * 게임을 아주 잘하지 않아도 넘을 수 있는 목표를 미리 보여 주고, 판이 끝나면 '성공' / '실패'를 알려 줍니다.
 *   BioGoal.show(id)              게임을 열면 위쪽에 목표를 잠깐 보여 줌 (goal.js를 넣으면 자동으로 한 번)
 *   BioGoal.result(id, value, o)  판이 끝났을 때. o = {ok: true/false 직접 지정, text: '표시할 기록'}
 *   BioGoal.progress(id, value)   계속 이어지는 게임(ONLY UP)에서 목표에 처음 닿으면 성공을 띄움
 *   BioGoal.status(id)            {best, ok, tries} (메인 화면에서 읽음)
 */
(function () {
  'use strict';
  var GOALS = {
    'bio-beat':      {goal: '아무 곡이나 점수 650,000점 넘기기', t: 650000, unit: '점'},
    'immune-strike': {goal: '점수 15,000점 넘기기', t: 15000, unit: '점'},
    'bio-kart':      {goal: '레이스 5위 안으로 완주하기', t: 5, low: true, unit: '위'},
    'biotro':        {goal: '앤티 3까지 도달하기', t: 3, unit: '앤티', pre: true},
    'cell-bound':    {goal: '3층까지 내려가기', t: 3, unit: '층'},
    'cell-pinball':  {goal: '한 판 점수 500,000점 넘기기', t: 500000, unit: '점'},
    'cell-brawl':    {goal: 'ATP 그랩 승리 또는 쇼다운 3등 안에 들기', t: 1, unit: ''},
    'only-up':       {goal: '구간 3까지 올라가기', t: 3, unit: '구간', pre: true},
    'bio-strike':    {goal: '생존 모드 점수 3,000점 넘기기', t: 3000, unit: '점'},
    'helix':         {goal: '한 번의 출정에서 방 6개 정리하기', t: 6, unit: '방'},
    'cell-frontier': {goal: '한 지역에서 점수 12,000점 넘기기', t: 12000, unit: '점'},
    'codon-glass':   {goal: '혼자 하기 점수 50점 넘기기', t: 50, unit: '점'}
  };
  var KEY = 'bioGoal';
  function load() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } }
  function save(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} }
  function num(v) { return typeof v === 'number' ? v.toLocaleString('ko-KR') : String(v); }
  function fmtV(g, v) { if (g.pre) return g.unit + ' ' + num(v); return num(v) + g.unit; }
  function css() {
    if (document.getElementById('bioGoalCss')) return;
    var s = document.createElement('style'); s.id = 'bioGoalCss';
    s.textContent = [
      '.bg-pill{position:fixed;left:50%;top:max(10px,env(safe-area-inset-top));transform:translate(-50%,-140%);z-index:2147483000;',
      'padding:8px 16px;border-radius:999px;font:700 14px/1.3 "Noto Sans KR",system-ui,sans-serif;color:#fff;',
      'background:rgba(20,28,48,.72);border:1px solid rgba(255,255,255,.28);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);',
      'box-shadow:0 8px 28px rgba(0,0,0,.35);transition:transform .45s cubic-bezier(.2,.9,.3,1.2);pointer-events:none;white-space:nowrap;max-width:94vw;overflow:hidden;text-overflow:ellipsis}',
      '.bg-pill.on{transform:translate(-50%,0)}',
      '.bg-res{position:fixed;inset:0;z-index:2147483001;display:flex;align-items:center;justify-content:center;pointer-events:none}',
      '.bg-card{pointer-events:auto;min-width:min(86vw,320px);padding:22px 26px 18px;border-radius:24px;text-align:center;color:#fff;',
      'font-family:"Noto Sans KR",system-ui,sans-serif;background:rgba(18,24,40,.78);border:1px solid rgba(255,255,255,.25);',
      'backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);box-shadow:0 18px 60px rgba(0,0,0,.5);animation:bgIn .5s cubic-bezier(.2,.9,.3,1.25)}',
      '@keyframes bgIn{from{transform:scale(.6);opacity:0}to{transform:scale(1);opacity:1}}',
      '.bg-card .big{font-size:44px;font-weight:900;letter-spacing:.04em;margin:2px 0 6px}',
      '.bg-card.ok .big{color:#5effa8;text-shadow:0 0 24px rgba(94,255,168,.55)}.bg-card.no .big{color:#ff7a8a;text-shadow:0 0 24px rgba(255,122,138,.45)}',
      '.bg-card .g{font-size:13px;color:rgba(255,255,255,.75)}.bg-card .v{font-size:16px;margin:8px 0 12px}.bg-card .v b{font-size:20px}',
      '.bg-card button{border:0;border-radius:999px;padding:8px 22px;font:700 14px "Noto Sans KR",sans-serif;color:#0b1220;background:#fff;cursor:pointer}'
    ].join('');
    document.head.appendChild(s);
  }
  var pillEl = null, pillT = null;
  function show(id, ms) {
    var g = GOALS[id]; if (!g || !document.body) return;
    css();
    if (!pillEl) { pillEl = document.createElement('div'); pillEl.className = 'bg-pill'; document.body.appendChild(pillEl); }
    var st = load()[id];
    pillEl.textContent = '🎯 목표 · ' + g.goal + (st && st.ok ? '  ✅ 달성함' : '');
    requestAnimationFrame(function () { pillEl.classList.add('on'); });
    clearTimeout(pillT); pillT = setTimeout(function () { pillEl.classList.remove('on'); }, ms || 5200);
  }
  var resEl = null, resT = null;
  function result(id, value, o) {
    var g = GOALS[id]; if (!g) return null;
    o = o || {};
    var ok = typeof o.ok === 'boolean' ? o.ok : (g.low ? (value > 0 && value <= g.t) : value >= g.t);
    var d = load(), r = d[id] || {tries: 0};
    r.tries++; r.last = Date.now();
    if (typeof value === 'number' && isFinite(value)) {
      if (r.best == null || (g.low ? (value > 0 && value < r.best) : value > r.best)) r.best = value;
    }
    if (ok) r.ok = true;
    d[id] = r; save(d);
    if (!document.body) return ok;
    css();
    if (resEl) resEl.remove();
    resEl = document.createElement('div'); resEl.className = 'bg-res';
    var shown = o.text != null ? o.text : fmtV(g, value);
    resEl.innerHTML = '<div class="bg-card ' + (ok ? 'ok' : 'no') + '"><div class="g">🎯 ' + g.goal + '</div>' +
      '<div class="big">' + (ok ? '성공!' : '실패') + '</div>' +
      '<div class="v">내 기록 <b>' + shown + '</b>' + (o.ok == null && g.t > 1 ? ' / 목표 ' + fmtV(g, g.t) : '') + '</div>' +
      '<button type="button">확인</button></div>';
    document.body.appendChild(resEl);
    var close = function () { if (resEl) { resEl.remove(); resEl = null; } };
    resEl.querySelector('button').onclick = close;
    clearTimeout(resT); resT = setTimeout(close, 7000);
    return ok;
  }
  var reached = {};
  function progress(id, value) {
    var g = GOALS[id]; if (!g || reached[id]) return;
    if (g.low ? value <= g.t : value >= g.t) { reached[id] = true; result(id, value); }
  }
  window.BioGoal = {GOALS: GOALS, show: show, result: result, progress: progress, status: function (id) { return load()[id] || null; }, all: load};
  // 게임 페이지(games/…/이름.html)라면 목표를 한 번 보여 줌
  var m = /\/games\/([a-z0-9-]+)\.html/.exec(location.pathname);
  if (m && GOALS[m[1]]) {
    var go = function () { setTimeout(function () { show(m[1]); }, 900); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
  }
})();
