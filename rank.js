/* BIO ARCADE 공용 랭킹 (Firebase Firestore, REST)
 *   게임이 끝나 목표 결과가 나오면 '랭킹에 보내기'를 고를 수 있고, 학번+이름('20800 홍길동')을 적어 보냄.
 *   보낸 기록은 어느 기기에서든 메인 화면 '랭킹'에서 볼 수 있음.
 *   저장 위치: rankings/{게임 id}/scores/{자동 id}  ·  성공 기준: config/goals
 *
 *   ▶ 설정: 아래 FIREBASE.projectId (Firebase 프로젝트 ID). 비어 있으면 랭킹 버튼이 숨겨짐
 */
(function () {
  'use strict';
  var FIREBASE = {
    apiKey: '',                 // 없어도 됨 (Firestore 보안 규칙이 허용하면 키 없이 읽고 씀)
    projectId: 'biogame-2f966'
  };
  var NAME_RE = /^(\d{5})\s+([가-힣]{2,5})$/;
  function ready() { return !!FIREBASE.projectId; }
  function base() { return 'https://firestore.googleapis.com/v1/projects/' + FIREBASE.projectId + '/databases/(default)/documents'; }
  function key() { return FIREBASE.apiKey ? '?key=' + encodeURIComponent(FIREBASE.apiKey) : ''; }
  function toFields(o) {
    var f = {};
    for (var k in o) {
      var v = o[k];
      if (typeof v === 'number') f[k] = Number.isInteger(v) ? {integerValue: String(v)} : {doubleValue: v};
      else if (typeof v === 'boolean') f[k] = {booleanValue: v};
      else if (v && typeof v === 'object') f[k] = {mapValue: {fields: toFields(v)}};
      else f[k] = {stringValue: String(v == null ? '' : v)};
    }
    return f;
  }
  function fromFields(f) {
    var o = {};
    for (var k in f || {}) {
      var v = f[k];
      if ('integerValue' in v) o[k] = +v.integerValue;
      else if ('doubleValue' in v) o[k] = +v.doubleValue;
      else if ('booleanValue' in v) o[k] = v.booleanValue;
      else if ('mapValue' in v) o[k] = fromFields(v.mapValue.fields);
      else if ('timestampValue' in v) o[k] = v.timestampValue;
      else o[k] = v.stringValue;
    }
    return o;
  }
  function req(method, url, body) {
    return fetch(url, {method: method, headers: {'Content-Type': 'application/json'}, body: body ? JSON.stringify(body) : undefined})
      .then(function (r) { if (!r.ok) return r.text().then(function (t) { throw new Error(r.status + ' ' + t.slice(0, 200)); }); return r.json(); });
  }
  function parseName(s) {
    var m = NAME_RE.exec(String(s || '').trim().replace(/\s+/g, ' '));
    return m ? {sid: m[1], name: m[2]} : null;
  }
  // ---------- 게임별 순위 기준 ----------
  //  how: 순위 기준 설명, cat: 분류 이름(곡·맵·모드·지역, 없으면 null), cols: [키, 머리글, 형식]
  //  형식: n 숫자 · t 시간(초) · p 퍼센트 · s 글자
  //  기록의 value는 '클수록 좋은' 하나의 숫자로 게임이 만들어 보냄 (BioGoal.key)
  var SPEC = {
    'bio-beat':      {how: '난이도(레벨)가 높은 순 → 같은 난이도에서는 점수가 높은 순', cat: '곡', cols: [['diff', '난이도', 's'], ['score', '점수', 'n']]},
    'bio-kart':      {how: '맵마다 완주 시간이 빠른 순', cat: '맵', cols: [['time', '완주 시간', 't'], ['place', '순위', 's']]},
    'biotro':        {how: '도달 앤티가 높은 순 → 같으면 최고 핸드 점수가 높은 순', cols: [['ante', '앤티', 'n'], ['score', '최고 핸드 점수', 'n']]},
    'cell-bound':    {how: '도달 층이 깊은 순 → 같으면 걸린 시간이 짧은 순', cols: [['floor', '도달 층', 'n'], ['time', '걸린 시간', 't']]},
    'cell-brawl':    {how: 'ATP 그랩 수가 많은 순 → 같으면 총 킬 수가 많은 순', cat: '모드', cols: [['grab', 'ATP 그랩', 'n'], ['kills', '총 킬', 'n']]},
    'only-up':       {how: '도달 구간이 높은 순 → 같으면 걸린 시간이 짧은 순', cols: [['stage', '도달 구간', 's'], ['time', '걸린 시간', 't']]},
    'bio-strike':    {how: '생존 모드는 점수가 높은 순, 온라인은 총 킬 수가 많은 순', cat: '모드', cols: [['score', '점수', 'n'], ['kills', '킬', 'n']]},
    'helix':         {how: '정리한 방(층) 수가 많은 순 → 같으면 걸린 시간이 짧은 순', cols: [['rooms', '정리한 방', 'n'], ['time', '걸린 시간', 't']]},
    'cell-frontier': {how: '지역마다 점유 면적이 넓은 순 → 점수가 높은 순 → 걸린 시간이 짧은 순', cat: '지역', cols: [['area', '점유 면적', 'p'], ['score', '점수', 'n'], ['time', '걸린 시간', 't']]},
    'codon-glass':   {how: '모드마다 점수가 높은 순', cat: '모드', cols: [['score', '점수', 'n']]},
    'bio-tower':     {how: '연속 승리 수가 많은 순', cols: [['streak', '연속 승리', 'n'], ['height', '최고 탑 높이', 's']]},
    'bio-pyramid':   {how: '최고 피라미드 단계가 높은 순 → 같으면 총점이 높은 순', cols: [['stage', '최고 단계', 'n'], ['score', '총점', 'k'], ['skin', '스킨', 's']]},
    'cell-expedition': {how: '깬 원정 스테이지가 높은 순 → 같으면 전투력이 높은 순', cols: [['stage', '스테이지', 'n'], ['power', '전투력', 'n']]}
  };
  function fmtCol(v, f) {
    if (v == null || v === '') return '-';
    if (f === 't') { v = +v; var m = Math.floor(v / 60), s = v - m * 60; return (m ? m + '분 ' : '') + s.toFixed(1) + '초'; }
    if (f === 'p') return (+v).toFixed(1) + '%';
    if (f === 'n') return typeof v === 'number' ? v.toLocaleString('ko-KR') : String(v);
    if (f === 'k') return typeof v === 'number' ? korNum(v) : String(v);
    return String(v);
  }
  // 10억 이상은 한국식 단위(만·억·조·경·해…)로: 1,234,567,890 → '12억 3456만'
  var KOR_U = ['', '만', '억', '조', '경', '해', '자', '양', '구', '간', '정', '재', '극', '항하사', '아승기', '나유타', '불가사의', '무량대수'];
  function korNum(v) {
    v = Math.floor(+v || 0); if (Math.abs(v) < 1e9) return v.toLocaleString('ko-KR');
    var neg = v < 0; v = Math.abs(v);
    var e = Math.min(KOR_U.length - 1, Math.floor(Math.log10(v) / 4 + 1e-9));
    var big = Math.floor(v / Math.pow(10, e * 4)), rest = Math.floor(v / Math.pow(10, (e - 1) * 4)) % 10000;
    return (neg ? '-' : '') + big.toLocaleString('ko-KR') + KOR_U[e] + (rest > 0 && e < KOR_U.length - 1 ? ' ' + rest + KOR_U[e - 1] : '');
  }
  // 기록 보내기: entry = {who, value, text, ok, rank: {v, cat, f}}
  function submit(game, entry) {
    if (!ready()) return Promise.reject(new Error('랭킹 서버가 아직 설정되지 않았어요'));
    var who = parseName(entry.who);
    if (!who) return Promise.reject(new Error("'20800 홍길동' 처럼 학번 5자리와 이름을 띄어 써 주세요"));
    var R = entry.rank || {};
    var base0 = {sid: who.sid, name: who.name, value: Number(R.v != null ? R.v : entry.value) || 0, text: entry.text || '', ok: !!entry.ok, t: Date.now(), dev: (navigator.userAgent || '').slice(0, 80)};
    var doc = Object.assign({}, base0, {r: 2, cat: R.cat || '', f: R.f || {}});
    var url = base() + '/rankings/' + encodeURIComponent(game) + '/scores' + key();
    return req('POST', url, {fields: toFields(doc)}).catch(function (e) {
      // 보안 규칙이 새 칸을 막으면, 기존 칸만 쓰고 분류·세부 기록은 text 안에 넣어 보냄
      if (!/^(400|403)/.test(e.message)) throw e;
      var d2 = Object.assign({}, base0, {text: '§' + JSON.stringify({r: 2, cat: R.cat || '', f: R.f || {}, text: entry.text || ''})});
      return req('POST', url, {fields: toFields(d2)});
    });
  }
  function norm(x) {
    if (typeof x.text === 'string' && x.text.charAt(0) === '§') { try { var j = JSON.parse(x.text.slice(1)); x.r = j.r; x.cat = j.cat; x.f = j.f; x.text = j.text; } catch (e) { } }
    x.f = x.f || {}; x.cat = x.cat || ''; return x;
  }
  function run(game, q) {
    return req('POST', base() + '/rankings/' + encodeURIComponent(game) + ':runQuery' + key(), q).then(function (rows) {
      return (rows || []).filter(function (r) { return r.document; }).map(function (r) { return norm(fromFields(r.document.fields)); }).filter(function (x) { return x.r === 2; });
    });
  }
  // 랭킹 읽기: {list, cats}. cat을 주면 그 분류만. 같은 학번은 가장 좋은 기록 하나만
  function top(game, cat, limit) {
    if (!ready()) return Promise.resolve({list: [], cats: []});
    var q = {structuredQuery: {from: [{collectionId: 'scores'}], orderBy: [{field: {fieldPath: 'value'}, direction: 'DESCENDING'}], limit: 600}};
    return run(game, q).then(function (all) {
      var cats = []; all.forEach(function (x) { if (x.cat && cats.indexOf(x.cat) < 0) cats.push(x.cat); }); cats.sort();
      var list = cat ? all.filter(function (x) { return x.cat === cat; }) : all;
      var seen = {}, out = [];
      list.forEach(function (x) { var k = x.sid + x.name; if (!seen[k]) { seen[k] = 1; out.push(x); } });
      return {list: out.slice(0, limit || 100), cats: cats};
    });
  }
  // 한 사람 기록 전체 (최근 순)
  function mine(game, who) {
    var w = parseName(who); if (!ready() || !w) return Promise.resolve([]);
    var q = {structuredQuery: {from: [{collectionId: 'scores'}], where: {fieldFilter: {field: {fieldPath: 'sid'}, op: 'EQUAL', value: {stringValue: w.sid}}}, limit: 300}};
    return run(game, q).then(function (l) { return l.filter(function (x) { return x.name === w.name; }).sort(function (a, b) { return b.t - a.t; }); });
  }
  // 성공 기준 (선생님이 바꾼 값) — 모든 기기 공용
  function loadGoalConfig() {
    if (!ready()) return Promise.resolve(null);
    return req('GET', base() + '/config/goals' + key()).then(function (d) { return fromFields(d.fields).cfg || {}; }).catch(function () { return null; });
  }
  function saveGoalConfig(cfg) {
    if (!ready()) return Promise.resolve();
    return req('PATCH', base() + '/config/goals' + key(), {fields: toFields({cfg: cfg || {}, t: Date.now()})});
  }
  window.BioRank = {SPEC: SPEC, fmtCol: fmtCol, korNum: korNum, ready: ready, submit: submit, top: top, mine: mine, parseName: parseName, loadGoalConfig: loadGoalConfig, saveGoalConfig: saveGoalConfig};
  // 시작할 때 공용 성공 기준을 받아 적용
  if (ready()) loadGoalConfig().then(function (cfg) { if (cfg && window.BioGoal) BioGoal.setConfig(cfg); if (window.onBioGoalCfg) window.onBioGoalCfg(); });
})();
