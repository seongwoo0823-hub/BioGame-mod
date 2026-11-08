/* BIO ARCADE 공용 랭킹 (Firebase Firestore, REST)
 *   게임이 끝나 목표 결과가 나오면 '랭킹에 보내기'를 고를 수 있고, 학번+이름('20800 홍길동')을 적어 보냄.
 *   보낸 기록은 어느 기기에서든 메인 화면 '랭킹'에서 볼 수 있음.
 *   저장 위치: rankings/{게임 id}/scores/{자동 id}  ·  성공 기준: config/goals
 *
 *   ▶ 설정: 아래 FIREBASE에 Firebase 웹 앱 설정의 apiKey · projectId 를 넣으면 켜짐 (비어 있으면 랭킹 버튼이 숨겨짐)
 */
(function () {
  'use strict';
  var FIREBASE = {
    apiKey: '',
    projectId: ''
  };
  var NAME_RE = /^(\d{5})\s+([가-힣]{2,5})$/;
  function ready() { return !!(FIREBASE.apiKey && FIREBASE.projectId); }
  function base() { return 'https://firestore.googleapis.com/v1/projects/' + FIREBASE.projectId + '/databases/(default)/documents'; }
  function key() { return '?key=' + encodeURIComponent(FIREBASE.apiKey); }
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
  // 기록 보내기
  function submit(game, entry) {
    if (!ready()) return Promise.reject(new Error('랭킹 서버가 아직 설정되지 않았어요'));
    var who = parseName(entry.who);
    if (!who) return Promise.reject(new Error("'20800 홍길동' 처럼 학번 5자리와 이름을 띄어 써 주세요"));
    var doc = {sid: who.sid, name: who.name, value: Number(entry.value) || 0, text: entry.text || '', ok: !!entry.ok, t: Date.now(), dev: (navigator.userAgent || '').slice(0, 80)};
    return req('POST', base() + '/rankings/' + encodeURIComponent(game) + '/scores' + key(), {fields: toFields(doc)});
  }
  // 랭킹 읽기 (low: 작을수록 좋은 기록)
  function top(game, low, limit) {
    if (!ready()) return Promise.resolve([]);
    var q = {structuredQuery: {from: [{collectionId: 'scores'}], orderBy: [{field: {fieldPath: 'value'}, direction: low ? 'ASCENDING' : 'DESCENDING'}], limit: (limit || 100) * 2}};
    return req('POST', base() + '/rankings/' + encodeURIComponent(game) + ':runQuery' + key(), q).then(function (rows) {
      var list = (rows || []).filter(function (r) { return r.document; }).map(function (r) { return fromFields(r.document.fields); });
      if (low) list = list.filter(function (x) { return x.value > 0; });
      // 같은 학번은 가장 좋은 기록 하나만
      var seen = {}, out = [];
      list.forEach(function (x) { var k = x.sid + x.name; if (!seen[k]) { seen[k] = 1; out.push(x); } });
      return out.slice(0, limit || 100);
    });
  }
  // 한 사람 기록 전체 (최근 순)
  function mine(game, who) {
    var w = parseName(who); if (!ready() || !w) return Promise.resolve([]);
    var q = {structuredQuery: {from: [{collectionId: 'scores'}], where: {fieldFilter: {field: {fieldPath: 'sid'}, op: 'EQUAL', value: {stringValue: w.sid}}}, limit: 200}};
    return req('POST', base() + '/rankings/' + encodeURIComponent(game) + ':runQuery' + key(), q).then(function (rows) {
      return (rows || []).filter(function (r) { return r.document; }).map(function (r) { return fromFields(r.document.fields); })
        .filter(function (x) { return x.name === w.name; }).sort(function (a, b) { return b.t - a.t; });
    });
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
  window.BioRank = {ready: ready, submit: submit, top: top, mine: mine, parseName: parseName, loadGoalConfig: loadGoalConfig, saveGoalConfig: saveGoalConfig};
  // 시작할 때 공용 성공 기준을 받아 적용
  if (ready()) loadGoalConfig().then(function (cfg) { if (cfg && window.BioGoal) BioGoal.setConfig(cfg); if (window.onBioGoalCfg) window.onBioGoalCfg(); });
})();
