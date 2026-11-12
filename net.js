/* BIO ARCADE 실시간 중계 연결 (교실 서버 경유)
 *   온라인 게임들은 원래 PeerJS로 기기끼리 직접(P2P) 연결합니다. 선생님 컴퓨터에서 교실 서버(server/server.js)를 켜고
 *   학생들이 그 서버 주소(예: http://192.168.0.12:8080)로 접속하면, 같은 서버에 웹소켓으로 붙어 서버가 메시지를 전달합니다.
 *   게임 코드는 그대로: vendor/peerjs.min.js가 new Peer()를 만들 때 BioRelay가 켜져 있으면 이 파일의 RelayPeer를 대신 돌려줌.
 *
 *   ▶ 켜지는 조건: 교실 서버가 이 파일을 보낼 때 맨 앞에 window.BIO_LOCAL_RELAY=1 을 붙여 줌 → 페이지를 연 그 서버로 중계
 *     GitHub Pages 등 다른 곳에서 열면 꺼짐(예전처럼 P2P). 시험용: ?relay=ws://주소 · 끄기 ?relay=off
 *   방 목록: BioRelay.rooms(접두어) · BioRelay.roomPanel({...}) — 서버에 열린 방을 보여 주고 눌러서 참가
 */
(function () {
  'use strict';
  if (window.BioRelay) return;
  // 교실 서버에서 연 페이지면 같은 주소로 중계 (http → ws, https → wss)
  var RELAY_URL = window.BIO_LOCAL_RELAY && /^https?:$/.test(location.protocol) ? (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host : '';

  var url = RELAY_URL;
  try {
    var q = new URLSearchParams(location.search).get('relay');
    if (q === 'off') url = '';
    else if (q && /^wss?:\/\//.test(q)) url = q;
    localStorage.removeItem('bioRelayUrl');   // 예전 Render 주소가 남아 있지 않게
  } catch (e) {}

  var WAKE_MAX = 20000;     // 서버에 닿지 않을 때 다시 시도하는 최대 시간 (그 뒤엔 P2P)
  var srv = {ok: false, t: 0}; // 마지막으로 확인한 서버 상태
  function rid(n) { var s = 'abcdefghijkmnpqrstuvwxyz23456789', o = ''; for (var i = 0; i < n; i++) o += s[Math.random() * s.length | 0]; return o; }
  function perr(type, msg) { var e = new Error(msg || type); e.type = type; return e; }

  function Emitter() { this._ev = {}; }
  Emitter.prototype.on = function (e, f) { (this._ev[e] = this._ev[e] || []).push(f); return this; };
  Emitter.prototype.once = function (e, f) { var self = this; function g() { self.off(e, g); f.apply(self, arguments); } return this.on(e, g); };
  Emitter.prototype.off = function (e, f) { var a = this._ev[e]; if (a) { var i = a.indexOf(f); if (i >= 0) a.splice(i, 1); } return this; };
  Emitter.prototype.removeListener = Emitter.prototype.off;
  Emitter.prototype.removeAllListeners = function (e) { if (e) delete this._ev[e]; else this._ev = {}; return this; };
  Emitter.prototype.emit = function (e) { var a = (this._ev[e] || []).slice(), args = [].slice.call(arguments, 1); for (var i = 0; i < a.length; i++) { try { a[i].apply(this, args); } catch (x) { console.error(x); } } return a.length > 0; };


  // ---------- 연결 방식 표시 (게임 화면 오른쪽 아래 작은 배지) ----------
  var live = 0, badgeEl = null, hideT = null;
  function badge(mode, ms) {
    if (!document.body) return;
    if (!badgeEl) {
      badgeEl = document.createElement('div');
      badgeEl.style.cssText = 'position:fixed;right:max(8px,env(safe-area-inset-right));bottom:max(8px,env(safe-area-inset-bottom));z-index:2147482000;pointer-events:none;' +
        'padding:4px 10px 4px 8px;border-radius:999px;font:600 11px/1.3 "Noto Sans KR",system-ui,sans-serif;color:#fff;background:rgba(10,14,28,.72);border:1px solid rgba(255,255,255,.22);' +
        'backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:flex;align-items:center;gap:6px;transition:opacity .3s';
      document.body.appendChild(badgeEl);
    }
    clearTimeout(hideT);
    if (!mode) { badgeEl.style.opacity = '0'; return; }
    var col = mode === 'server' ? '#34d399' : mode === 'p2p' ? '#fbbf24' : '#94a3b8';
    var txt = mode === 'server' ? '서버 연결' + (ms != null ? ' · ' + ms + 'ms' : '') : mode === 'p2p' ? 'P2P 직접 연결' : mode === 'wake' ? '교실 서버에 다시 연결하는 중…' : '서버 연결 중…';
    if (mode === 'wake') col = '#60a5fa';
    badgeEl.innerHTML = '<span style="width:8px;height:8px;border-radius:50%;background:' + col + ';box-shadow:0 0 6px ' + col + '"></span>' + txt;
    badgeEl.title = mode === 'server' ? '우리 중계 서버를 거쳐 연결됨' : mode === 'p2p' ? '서버 대신 기기끼리 직접 연결됨' : '';
    badgeEl.style.opacity = '1';
  }
  var curMode = null;   // 지금 연결 방식: 'server' | 'p2p' | null
  function peerUp(mode, ms) { curMode = mode; badge(mode, ms); }
  function peerDown() { live = Math.max(0, live - 1); if (!live) { curMode = null; clearTimeout(hideT); hideT = setTimeout(function () { badge(null); }, 1500); } }
  // 메인 화면용: 서버가 깨어 있는지와 응답 시간
  function check(timeout) {
    // 첫 요청은 연결 준비(보안 연결 등) 시간이 섞여 크게 나오므로, 연결을 연 뒤 몇 번 더 재서 가장 빠른 값을 씀
    if (!url) return Promise.resolve({ok: false, off: true});
    var base = url.replace(/^ws/, 'http') + '/__status';
    function one(to) {
      var t0 = performance.now(), ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var tm = setTimeout(function () { ctl && ctl.abort(); }, to);
      return fetch(base + '?t=' + Date.now() + Math.random(), {cache: 'no-store', signal: ctl && ctl.signal})
        .then(function (r) { return r.json(); })
        .then(function (j) { clearTimeout(tm); return {ok: !!j.ok, ms: Math.round(performance.now() - t0), peers: j.clients != null ? j.clients : j.peers, rooms: j.rooms}; })
        .catch(function () { clearTimeout(tm); return {ok: false}; });
    }
    return one(timeout || 8000).then(function (first) {
      if (!first.ok) return first;
      return one(4000).then(function (a) { return one(4000).then(function (b) {
        var best = first; [a, b].forEach(function (x) { if (x.ok && x.ms < best.ms) best = x; });
        return best;
      }); });
    });
  }

  // ---------- 연결 하나 (PeerJS DataConnection 모양) ----------
  function RelayConn(peer, cid, remote, meta) {
    Emitter.call(this);
    this._p = peer; this._cid = cid; this.peer = remote; this.metadata = meta; this.label = cid; this.connectionId = cid;
    this.open = false; this.reliable = true; this.serialization = 'json'; this.type = 'data'; this._closed = false;
  }
  RelayConn.prototype = Object.create(Emitter.prototype);
  Object.defineProperty(RelayConn.prototype, 'bufferSize', {get: function () { var ws = this._p._ws; return ws ? Math.floor(ws.bufferedAmount / 4096) : 0; }});
  RelayConn.prototype.send = function (d) {
    if (!this.open) return;
    var ws = this._p._ws; if (!ws || ws.readyState !== 1) return;
    // 서버 쪽으로 보내는 길이 막히면 위치처럼 계속 새로 오는 정보만 건너뜀 (사건·행동 정보는 절대 버리지 않음)
    if (ws.bufferedAmount > 65536 && BioRelay.droppable && BioRelay.droppable(d)) return;
    var body = JSON.stringify(d), P = this._p;
    if (!P._multi) { ws.send('D' + this._cid + body); return; }
    // 방장이 여러 참가자에게 같은 내용을 연달아 보내면 모아서 한 번만 올리고 서버가 나눠 줌 (방장 업로드를 참가자 수만큼 줄임)
    var q = P._q || (P._q = []), last = q[q.length - 1];
    if (last && last.b === body && last.ids.indexOf(this._cid) < 0) last.ids.push(this._cid); else q.push({b: body, ids: [this._cid]});   // 보내는 순서는 그대로 지킴
    if (!P._qT) { P._qT = true; Promise.resolve().then(function () { P._flush(); }); }
  };
  RelayConn.prototype.close = function () { if (this._closed) return; this._p._ctl({t: 'close', cid: this._cid}); this._end(); };
  RelayConn.prototype._open = function () { var c = this; setTimeout(function () { if (!c._closed && !c.open) { c.open = true; c.emit('open'); } }, 0); };
  RelayConn.prototype._end = function () { if (this._closed) return; this._closed = true; this.open = false; delete this._p._conns[this._cid]; this.emit('close'); };

  // ---------- 중계 서버 접속 (PeerJS Peer 모양) ----------
  function RelayPeer(id, opts, fallback) {
    Emitter.call(this);
    this.id = null; this.open = false; this.destroyed = false; this.disconnected = false;
    this.connections = {}; this.options = opts || {};
    this._conns = {}; this._want = id; this._fallbackFn = fallback; this._inner = null;
    this._key = rid(20); this._t0 = Date.now(); this._tries = 0;
    this.relay = true; live++; badge('wait');
    this._start();
  }
  RelayPeer.prototype = Object.create(Emitter.prototype);
  RelayPeer.prototype._start = function () {
    var self = this, ws, ok = false, failed = false;
    if (this.destroyed) return;
    this._tries++;
    try { ws = new WebSocket(url); } catch (e) { setTimeout(function () { self._retry(); }, 0); return; }
    this._ws = ws;
    var fail = function () { if (ok || failed) return; failed = true; clearTimeout(timer); try { ws.close(); } catch (e) {} if (self._ws === ws) self._retry(); };
    var timer = setTimeout(fail, BioRelay.waitMs || 7000);
    ws.onopen = function () { ok = true; clearTimeout(timer); srv = {ok: true, t: Date.now()}; self._ctl({t: 'open', id: self._want == null ? undefined : self._want, key: self._key}); };
    ws.onmessage = function (e) { self._msg(e.data); };
    ws.onerror = fail;
    ws.onclose = function () {
      if (!ok) { fail(); return; }
      if (self.destroyed || self._ws !== ws) return;
      clearInterval(self._pingT);
      var was = self.open;
      self.open = false; self.disconnected = true;
      for (var k in self._conns) self._conns[k]._end();
      if (was) { self.emit('disconnected', self.id); self.emit('error', perr('network', 'Lost connection to relay server')); }
      // 잠깐 끊긴 거면 같은 아이디·열쇠로 다시 접속 (서버가 예전 연결을 밀어내고 방을 돌려줌)
      setTimeout(function () { if (!self.destroyed && self.disconnected) self.reconnect(); }, 1000);
    };
  };
  // 서버에 닿지 않을 때: 서버가 깨어나는 중이면 계속 다시 시도, 정말 꺼져 있으면 P2P로
  RelayPeer.prototype._retry = function () {
    var self = this;
    if (this.destroyed || this._inner) return;
    if (Date.now() - this._t0 > WAKE_MAX) { this._fallback(); return; }
    badge('wake'); wake();
    var wait = Math.min(4000, 600 * this._tries);
    setTimeout(function () { if (!self.destroyed && !self._inner && !self.open) self._start(); }, wait);
  };
  RelayPeer.prototype._fallback = function () {
    if (this._inner || this.destroyed) return;
    srv = {ok: false, t: Date.now()};
    try { this._ws && this._ws.close(); } catch (e) {}
    this._ws = null;
    console.warn('[BioRelay] 서버에 연결하지 못해 P2P 방식으로 바꿉니다');
    if (!this._fallbackFn) { this.emit('error', perr('server-error', 'Relay server unavailable')); return; }
    var self = this, inner = this._fallbackFn();
    this._inner = inner; this.relay = false;
    ['open', 'connection', 'error', 'disconnected', 'close', 'call'].forEach(function (ev) {
      inner.on(ev, function () {
        if (ev === 'open') { self.id = inner.id; self.open = true; peerUp('p2p'); }
        if (ev === 'disconnected') self.disconnected = true;
        self.emit.apply(self, [ev].concat([].slice.call(arguments)));
      });
    });
  };
  RelayPeer.prototype._flush = function () {
    var q = this._q || [], ws = this._ws; this._q = []; this._qT = false;
    if (!ws || ws.readyState !== 1) return;
    for (var i = 0; i < q.length; i++) {
      var ids = q[i].ids, body = q[i].b;
      if (ids.length === 1) ws.send('D' + ids[0] + body);
      else ws.send('M' + ids.join('') + '|' + body);
    }
  };
  RelayPeer.prototype._ctl = function (o) { var ws = this._ws; if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };
  RelayPeer.prototype._msg = function (s) {
    if (typeof s !== 'string') return;
    if (s.charCodeAt(0) === 68) {
      var c = this._conns[s.slice(1, 9)];
      if (c && c.open) { var d; try { d = JSON.parse(s.slice(9)); } catch (e) { return; } c.emit('data', d); }
      return;
    }
    var m; try { m = JSON.parse(s); } catch (e) { return; }
    var c2;
    switch (m.t) {
      case 'open': this.id = m.id; this.open = true; this.disconnected = false; this._multi = (m.v || 1) >= 2; this._tries = 0; peerUp('server');
        if (this._info) this._ctl({t: 'info', info: this._info});
        var me = this; clearInterval(this._pingT); this._ping = function () { me._ctl({t: 'ping', ts: performance.now()}); }; this._ping(); this._pingT = setInterval(this._ping, 3000);
        this.emit('open', m.id); break;
      case 'pong': if (typeof m.ts === 'number') { this.rtt = Math.round(performance.now() - m.ts); peerUp('server', this.rtt); } break;
      case 'error':
        if (m.cid && (c2 = this._conns[m.cid])) { c2.emit('error', perr(m.type, m.message)); c2._closed = true; delete this._conns[m.cid]; }
        this.emit('error', perr(m.type, m.message || m.type));
        if (m.type === 'unavailable-id' || m.type === 'invalid-id') { this._dead = true; try { this._ws.close(); } catch (e) {} }
        break;
      case 'conn':
        c2 = new RelayConn(this, m.cid, m.from, m.meta);
        this._conns[m.cid] = c2; (this.connections[m.from] = this.connections[m.from] || []).push(c2);
        this.emit('connection', c2); c2._open();
        break;
      case 'connopen': if ((c2 = this._conns[m.cid])) c2._open(); break;
      case 'close': if ((c2 = this._conns[m.cid])) c2._end(); break;
    }
  };
  RelayPeer.prototype.connect = function (id, opts) {
    if (this._inner) return this._inner.connect(id, opts);
    var cid = rid(8), meta = opts && opts.metadata, c = new RelayConn(this, cid, id, meta), self = this;
    this._conns[cid] = c; (this.connections[id] = this.connections[id] || []).push(c);
    var go = function () { self._ctl({t: 'connect', to: id, cid: cid, meta: meta}); };
    if (this.open) go(); else this.once('open', go);
    return c;
  };
  RelayPeer.prototype.destroy = function () {
    if (this.destroyed) return;
    clearInterval(this._pingT); peerDown();
    if (this._inner) { this.destroyed = true; try { this._inner.destroy(); } catch (e) {} return; }
    this.destroyed = true; this.open = false;
    for (var k in this._conns) this._conns[k]._end();
    try { this._ws && this._ws.close(); } catch (e) {}
    this.emit('close');
  };
  RelayPeer.prototype.disconnect = function () { this.destroy(); };
  RelayPeer.prototype.reconnect = function () {
    if (this._inner) return this._inner.reconnect();
    if (this.destroyed || !this.disconnected || this._dead) return;
    this._want = this.id; this._t0 = Date.now(); this._tries = 0; this._start();
  };

  var httpBase = url ? url.replace(/^ws/, 'http').replace(/\/+$/, '') : '';
  function wake() { if (!url || document.hidden) return; try { fetch(httpBase + '/__status?t=' + Date.now(), {cache: 'no-store'}).then(function (r) { return r.json(); }).then(function (j) { if (j && j.ok) srv = {ok: true, t: Date.now()}; }).catch(function () {}); } catch (e) {} }

  // ---------- 열린 방 목록 ----------
  function rooms(prefix) {
    if (!url) return Promise.resolve(null);
    return fetch(httpBase + '/__rooms?p=' + encodeURIComponent(prefix) + '&t=' + Date.now(), {cache: 'no-store'})
      .then(function (r) { return r.json(); }).then(function (j) { return j && j.ok ? j.rooms : null; }).catch(function () { return null; });
  }
  //  opts: {prefix: 'biostrike-v1-', input: '#codeIn', join: 버튼 선택자 또는 함수(code), after: 목록을 붙일 요소(기본: 입력칸이 든 줄),
  //         hide: 숨길 코드 판별 함수(code) 선택, title: 제목}
  var panelCss = false;
  function roomPanel(o) {
    if (!url || !o || !o.prefix) return null;
    var input = typeof o.input === 'string' ? document.querySelector(o.input) : o.input;
    var anchor = o.after ? (typeof o.after === 'string' ? document.querySelector(o.after) : o.after) : input && (input.closest('.row,.netrow,div') || input.parentNode);
    if (!anchor || !anchor.parentNode) return null;
    if (!panelCss) {
      panelCss = true;
      var st = document.createElement('style');
      st.textContent = '.bio-rooms{margin:8px 0;padding:8px 10px;border-radius:12px;background:rgba(10,16,32,.55);border:1px solid rgba(255,255,255,.18);color:#fff;font:600 12.5px/1.35 "Noto Sans KR",system-ui,sans-serif;text-align:left;max-width:520px}' +
        '.bio-rooms .bh{display:flex;align-items:center;gap:6px;margin-bottom:6px;opacity:.9}.bio-rooms .bh i{width:7px;height:7px;border-radius:50%;background:#34d399;box-shadow:0 0 6px #34d399}' +
        '.bio-rooms .bl{display:flex;flex-wrap:wrap;gap:6px}.bio-rooms .bl button{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.12);color:#fff;font:700 12.5px "Noto Sans KR",system-ui,sans-serif;cursor:pointer}' +
        '.bio-rooms .bl button:hover{background:rgba(255,255,255,.24)}.bio-rooms .bl button small{font-weight:500;opacity:.75}.bio-rooms .be{opacity:.65;font-weight:500}';
      document.head.appendChild(st);
    }
    var box = document.createElement('div'); box.className = 'bio-rooms';
    box.innerHTML = '<div class="bh"><i></i>' + (o.title || '서버에 열린 방') + ' <small style="opacity:.6;font-weight:500">· 눌러서 참가</small></div><div class="bl"><span class="be">찾는 중…</span></div>';
    anchor.parentNode.insertBefore(box, anchor.nextSibling);
    var list = box.querySelector('.bl'), timer = null, last = '';
    function esc(t) { return String(t).replace(/[&<>"']/g, function (c) { return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]; }); }
    function pick(code) {
      var inp = typeof o.input === 'string' ? document.querySelector(o.input) : o.input;
      if (inp) { inp.value = code; inp.dispatchEvent(new Event('input', {bubbles: true})); }
      if (typeof o.join === 'function') o.join(code);
      else { var b = document.querySelector(o.join); if (b) b.click(); }
    }
    function tick() {
      if (!box.isConnected) { clearInterval(timer); return; }
      if (document.hidden || !box.offsetParent) return;
      rooms(o.prefix).then(function (rs) {
        if (rs == null) { list.innerHTML = '<span class="be">교실 서버에 닿지 않아요. 선생님 컴퓨터의 서버 창이 켜져 있는지 확인하세요.</span>'; last = ''; return; }
        rs = rs.filter(function (r) { return !(o.hide && o.hide(r.code)); });
        var key = JSON.stringify(rs); if (key === last) return; last = key;
        if (!rs.length) { list.innerHTML = '<span class="be">지금 열린 방이 없어요. 방을 만들면 다른 사람 화면에 여기 보여요.</span>'; return; }
        list.innerHTML = rs.map(function (r) {
          var nm = r.info && r.info.name ? esc(r.info.name) + ' · ' : '', play = r.info && r.info.playing ? ' · 경기 중' : '';
          return '<button type="button" data-c="' + esc(r.code) + '">🔑 ' + esc(r.code) + ' <small>' + nm + r.players + '명' + play + '</small></button>';
        }).join('');
        [].forEach.call(list.querySelectorAll('button'), function (b) { b.onclick = function () { pick(b.getAttribute('data-c')); }; });
      });
    }
    tick(); timer = setInterval(tick, 3000);
    return box;
  }
  if (url) wake();   // 페이지를 열 때 서버 상태를 한 번 확인

  var BioRelay = window.BioRelay = {
    url: url,
    // 서버를 쓸지: 주소가 있으면 항상 서버부터 (안 되면 RelayPeer가 알아서 기다리거나 P2P로 돌아감)
    enabled: function () { return !!url && typeof WebSocket !== 'undefined'; },
    rooms: rooms,
    roomPanel: roomPanel,
    // 방장이 방 정보(이름·진행 중 여부)를 방 목록에 보여 줄 때: BioRelay.setInfo(peer, {name, playing})
    setInfo: function (peer, info) { if (peer && peer.relay) { peer._info = info; peer._ctl({t: 'info', info: info}); } },
    status: function () { return srv; },
    // 게임이 '서버 연결 대기' 시간을 정할 때: 서버가 깨어 있으면 원래 시간, 잠들어 있을 수 있으면 깨어날 때까지(80초)
    wait: function (ms) { return !url || (srv.ok && Date.now() - srv.t < 120000) ? ms : Math.max(ms, WAKE_MAX + 5000); },
    wake: wake,
    check: check,
    // 서버를 쓰지 않는 P2P 연결(vendor/peerjs.min.js)도 배지를 띄움
    markP2P: function (peer) { live++; badge('wait'); peer.on('open', function () { peerUp('p2p'); }); var d = false, down = function () { if (!d) { d = true; peerDown(); } }; peer.on('close', down); var od = peer.destroy; peer.destroy = function () { down(); return od.apply(this, arguments); }; },
    create: function (id, opts, fallback) { return new RelayPeer(id, opts, fallback); },
    // 게임 화면에 쓸 연결 방식 이름 (서버 경유면 '서버', 기기끼리 직접이면 'P2P')
    mode: function () { return curMode; },
    label: function () { return curMode === 'server' ? '서버' : 'P2P'; },
    droppable: null,
    RelayPeer: RelayPeer
  };
})();
