/* BIO ARCADE 목표 점수 (랭킹 대신)
 * 게임을 아주 잘하지 않아도 넘을 수 있는 목표를 미리 보여 주고, 판이 끝나면 '성공' / '실패'를 알려 줍니다.
 *   BioGoal.show(id)              게임을 열면 위쪽에 목표를 잠깐 보여 줌 (goal.js를 넣으면 자동으로 한 번)
 *   BioGoal.result(id, value, o)  판이 끝났을 때. o = {ok: true/false 직접 지정, text: '표시할 기록'}
 *   BioGoal.progress(id, value, o) 계속 이어지는 게임(ONLY UP)에서 목표에 처음 닿으면 성공을 띄움
 *   BioGoal.status(id)            {best, ok, tries} (메인 화면에서 읽음)
 */
(function () {
  'use strict';
  // tpl의 {t} 자리에 기준 값이 들어감. 기준 값은 메인 화면 '기준 수정'(비밀번호)으로 바꿀 수 있음 → localStorage 'bioGoalCfg'
  var GOALS = {
    'bio-beat':      {tpl: '아무 곡이나 점수 {t}점 넘기기', t: 650000, unit: '점'},
    'bio-kart':      {tpl: '레이스 {t}위 안으로 완주하기', t: 5, low: true, unit: '위'},
    'biotro':        {tpl: '앤티 {t}까지 도달하기', t: 3, unit: '앤티', pre: true},
    'cell-brawl':    {tpl: 'ATP 그랩 승리 또는 쇼다운 {t}등 안에 들기', t: 3, unit: '등', low: true, rankOnly: true},
    'only-up':       {tpl: '구간 {t}까지 올라가기', t: 3, unit: '구간', pre: true},
    'bio-strike':    {tpl: '생존 모드 점수 {t}점 넘기기', t: 3000, unit: '점'},
    'cell-frontier': {tpl: '한 지역에서 점수 {t}점 넘기기', t: 12000, unit: '점'},
    'codon-glass':   {tpl: '혼자 하기 점수 {t}점 넘기기', t: 50, unit: '점'},
    'bio-tower':     {tpl: '연속 {t}승 하기', t: 2, unit: '연승'},
    'bio-pyramid':   {tpl: '피라미드 {t}단계까지 짓기', t: 3, unit: '단계'},
    'cell-raid':     {tpl: '{t}구역까지 도달하기', t: 3, unit: '구역', pre: true},
    'lab-forge':     {tpl: '실험기구를 +{t}까지 강화하기', t: 10, unit: '단계', pre: true},
    'bio-board':     {tpl: '보드게임에서 AI를 {t}번 이기기', t: 1, unit: '승'}
  };
  var DEF = {};
  function applyCfg(cfg) {
    for (var id in GOALS) {
      var g = GOALS[id];
      if (DEF[id] == null) DEF[id] = g.t;
      var v = cfg && cfg[id];
      g.t = (typeof v === 'number' && isFinite(v) && v > 0 && !g.fixed) ? v : DEF[id];
      g.goal = g.tpl.replace('{t}', g.t.toLocaleString('ko-KR'));
    }
  }
  function loadCfg() { try { return JSON.parse(localStorage.getItem('bioGoalCfg') || '{}') || {}; } catch (e) { return {}; } }
  applyCfg(loadCfg());
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
      '.bg-card button{border:0;border-radius:999px;padding:8px 18px;font:700 14px "Noto Sans KR",sans-serif;color:#0b1220;background:#fff;cursor:pointer}',
      '.bg-card .bg-btns{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}.bg-card .bg-send{background:#38bdf8}.bg-card button:disabled{opacity:.5}',
      '.bg-card .bg-rk{margin:0 0 12px}.bg-card .bg-in{width:100%;box-sizing:border-box;height:40px;border-radius:12px;border:1px solid rgba(255,255,255,.35);background:rgba(255,255,255,.1);color:#fff;font:600 16px "Noto Sans KR",sans-serif;text-align:center;outline:0}',
      '.bg-gift{margin:0 0 12px;padding:10px 12px;border-radius:14px;background:linear-gradient(135deg,#ffe07a,#ff9fc8);color:#3a1020;font-weight:900;font-size:14px;line-height:1.4}.bg-gift small{display:block;font-weight:700;font-size:11.5px;opacity:.8;margin-top:3px}' +
      '.bg-card .bg-msg{font-size:12.5px;margin-top:6px;min-height:16px;color:rgba(255,255,255,.75)}.bg-card .bg-msg.err{color:#fca5a5}.bg-card .bg-msg.good{color:#86efac}'
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
    var ro = !!o.rankOnly;   // 목표와 상관없는 기록 (예: 온라인 대전) → 성공/실패 없이 기록만
    var d = load(), r = d[id] || {tries: 0};
    if (!ro) { r.tries++; r.last = Date.now(); }
    if (!ro && typeof value === 'number' && isFinite(value)) {
      if (r.best == null || (g.low ? (value > 0 && value < r.best) : value > r.best)) r.best = value;
    }
    if (ok && !ro) r.ok = true;
    d[id] = r; save(d);
    if (!document.body) return ok;
    css();
    if (resEl) resEl.remove();
    resEl = document.createElement('div'); resEl.className = 'bg-res';
    var shown = o.text != null ? o.text : fmtV(g, value);
    var canRank = !!(window.BioRank && BioRank.ready()) && o.rank !== false && rankOn(id);
    var gift = ok && !ro && giftOn(id);
    resEl.innerHTML = '<div class="bg-card ' + (ro ? 'ok' : ok ? 'ok' : 'no') + '"><div class="g">' + (ro ? (o.title || '기록') : '목표 · ' + g.goal) + '</div>' +
      '<div class="big">' + (ro ? '기록' : ok ? '성공!' : '실패') + '</div>' +
      '<div class="v">내 기록 <b>' + shown + '</b>' + (!ro && o.ok == null && g.t > 1 ? ' / 목표 ' + fmtV(g, g.t) : '') + '</div>' +
      (gift ? '<div class="bg-gift">🎁 사은품 대상이에요! 선생님께 이 화면을 보여 주세요<small>' + new Date().toLocaleString('ko-KR') + ' · 확인 코드 ' + (Date.now() % 9973 + 1000) + '</small></div>' : '') +
      (canRank ? '<div class="bg-rk" hidden><input class="bg-in" maxlength="20" placeholder="20800 홍길동" autocomplete="off"><div class="bg-msg"></div></div>' : '') +
      '<div class="bg-btns">' + (canRank ? '<button type="button" class="bg-send">랭킹에 보내기</button>' : '') + '<button type="button" class="bg-ok">' + (canRank ? '안 보내기' : '확인') + '</button></div></div>';
    document.body.appendChild(resEl);
    var close = function () { if (resEl) { resEl.remove(); resEl = null; } };
    resEl.querySelector('.bg-ok').onclick = close;
    clearTimeout(resT);
    if (!canRank && !gift) resT = setTimeout(close, 7000);
    else {
      var rk = resEl.querySelector('.bg-rk'), inp = resEl.querySelector('.bg-in'), msg = resEl.querySelector('.bg-msg'), send = resEl.querySelector('.bg-send');
      try { inp.value = localStorage.getItem('bioRankWho') || ''; } catch (e) {}
      ['keydown', 'keyup', 'keypress'].forEach(function (k) { inp.addEventListener(k, function (e) { e.stopPropagation(); if (k === 'keydown' && e.key === 'Enter') send.click(); }); });
      send.onclick = function () {
        if (rk.hidden) { rk.hidden = false; send.textContent = '보내기'; resEl.querySelector('.bg-ok').textContent = '닫기'; inp.focus(); return; }
        var who = inp.value.trim().replace(/\s+/g, ' ');
        if (!BioRank.parseName(who)) { msg.textContent = "학번 5자리와 이름을 띄어 써 주세요 (예: 20800 홍길동)"; msg.className = 'bg-msg err'; return; }
        send.disabled = true; msg.className = 'bg-msg'; msg.textContent = '보내는 중…';
        BioRank.submit(id, {who: who, value: typeof value === 'number' ? value : 0, text: String(shown).replace(/<[^>]*>/g, ''), ok: ok && !ro, rank: o.rank}).then(function () {
          try { localStorage.setItem('bioRankWho', who); } catch (e) {}
          msg.textContent = '랭킹에 올렸어요! 메인 화면 → 랭킹에서 볼 수 있어요.'; msg.className = 'bg-msg good';
          rk.querySelector('.bg-in').disabled = true; send.hidden = true; resEl.querySelector('.bg-ok').textContent = '확인';
        }).catch(function (e) { send.disabled = false; msg.className = 'bg-msg err'; msg.textContent = '보내지 못했어요: ' + (e && e.message || e); });
      };
    }
    return ok;
  }
  var reached = {};
  function progress(id, value, o) {
    var g = GOALS[id]; if (!g || reached[id]) return;
    if (g.low ? value <= g.t : value >= g.t) { reached[id] = true; result(id, value, o); }
  }
  // 여러 기준을 '클수록 좋은' 숫자 하나로: parts = [[값, 최대(칸 크기), 1 클수록 좋음 | -1 작을수록 좋음], ...]
  function key(parts) {
    var v = 0;
    parts.forEach(function (p) { var m = p[1], x = Math.max(0, Math.min(m - 1, Math.round(+p[0] || 0))); v = v * m + (p[2] < 0 ? m - 1 - x : x); });
    return v;
  }
  // 관리자 설정: cfg._rankOff = {게임: 1} (랭킹 끔) · cfg._gift = {게임: 1} (사은품 적용)
  function rankOn(id) { var c = loadCfg(); return !(c._rankOff && c._rankOff[id]); }
  function giftOn(id) { var c = loadCfg(); return !!(c._gift && c._gift[id]); }
  function setCfg(cfg) { try { localStorage.setItem('bioGoalCfg', JSON.stringify(cfg || {})); } catch (e) {} applyCfg(cfg || {}); }
  window.BioGoal = {GOALS: GOALS, DEFAULTS: DEF, show: show, result: result, progress: progress, status: function (id) { return load()[id] || null; }, all: load,
    config: loadCfg, setConfig: setCfg, key: key, rankOn: rankOn, giftOn: giftOn};
  // 게임 페이지(games/…/이름.html)라면 목표를 한 번 보여 줌
  var m = /\/games\/([a-z0-9-]+)\.html/.exec(location.pathname);
  if (m && GOALS[m[1]]) {
    var go = function () { setTimeout(function () { show(m[1]); }, 900); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
  }
})();
