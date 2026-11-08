/* BIO ARCADE 실시간 중계 연결 (서버 경유)
 *   온라인 게임들은 원래 PeerJS로 기기끼리 직접(P2P) 연결합니다. 학교 와이파이처럼 직접 연결이 막히면
 *   해외 중계를 돌아 느려지므로, 우리 서버(server/server.js)에 웹소켓으로 접속해 서버가 메시지를 전달하게 합니다.
 *   게임 코드는 그대로: vendor/peerjs.min.js가 new Peer()를 만들 때 BioRelay가 켜져 있으면 이 파일의 RelayPeer를 대신 돌려줍니다.
 *   (RelayPeer는 PeerJS와 같은 모양: on('open'|'connection'|'error'|'disconnected'), connect(), destroy(), conn.send/close/on('open'|'data'|'close'))
 *   서버에 4초 안에 닿지 않으면 자동으로 원래 P2P 방식으로 돌아갑니다.
 *
 *   ▶ 설정: RELAY_URL 에 서버 주소 (예: 'wss://biogame.duckdns.org'). 비어 있으면 꺼짐(지금처럼 P2P).
 *     시험용: 주소창에 ?relay=wss://… 를 붙이거나 localStorage 'bioRelayUrl', 끄기 ?relay=off
 */
(function () {
  'use strict';
  if (window.BioRelay) return;
  var RELAY_URL = '';

  var url = RELAY_URL;
  try {
    var q = new URLSearchParams(location.search).get('relay');
    if (q === 'off') url = '';
    else if (q && /^wss?:\/\//.test(q)) { url = q; localStorage.setItem('bioRelayUrl', q); }
    else if (localStorage.getItem('bioRelayUrl')) url = localStorage.getItem('bioRelayUrl');
  } catch (e) {}

  var downAt = 0;
  function rid(n) { var s = 'abcdefghijkmnpqrstuvwxyz23456789', o = ''; for (var i = 0; i < n; i++) o += s[Math.random() * s.length | 0]; return o; }
  function perr(type, msg) { var e = new Error(msg || type); e.type = type; return e; }

  function Emitter() { this._ev = {}; }
  Emitter.prototype.on = function (e, f) { (this._ev[e] = this._ev[e] || []).push(f); return this; };
  Emitter.prototype.once = function (e, f) { var self = this; function g() { self.off(e, g); f.apply(self, arguments); } return this.on(e, g); };
  Emitter.prototype.off = function (e, f) { var a = this._ev[e]; if (a) { var i = a.indexOf(f); if (i >= 0) a.splice(i, 1); } return this; };
  Emitter.prototype.removeListener = Emitter.prototype.off;
  Emitter.prototype.removeAllListeners = function (e) { if (e) delete this._ev[e]; else this._ev = {}; return this; };
  Emitter.prototype.emit = function (e) { var a = (this._ev[e] || []).slice(), args = [].slice.call(arguments, 1); for (var i = 0; i < a.length; i++) { try { a[i].apply(this, args); } catch (x) { console.error(x); } } return a.length > 0; };

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
    ws.send('D' + this._cid + JSON.stringify(d));
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
    this.relay = true;
    this._start();
  }
  RelayPeer.prototype = Object.create(Emitter.prototype);
  RelayPeer.prototype._start = function () {
    var self = this, ws, ok = false;
    try { ws = new WebSocket(url); } catch (e) { setTimeout(function () { self._fallback(); }, 0); return; }
    this._ws = ws;
    var timer = setTimeout(function () { if (!ok) { try { ws.close(); } catch (e) {} self._fallback(); } }, 4000);
    ws.onopen = function () { ok = true; clearTimeout(timer); self._ctl({t: 'open', id: self._want == null ? undefined : self._want}); };
    ws.onmessage = function (e) { self._msg(e.data); };
    ws.onerror = function () { if (!ok) { clearTimeout(timer); self._fallback(); } };
    ws.onclose = function () {
      if (!ok || self.destroyed || self._ws !== ws) return;
      self.open = false; self.disconnected = true;
      for (var k in self._conns) self._conns[k]._end();
      self.emit('disconnected', self.id);
      self.emit('error', perr('network', 'Lost connection to relay server'));
      // 잠깐 끊긴 거면 같은 아이디로 다시 접속
      setTimeout(function () { if (!self.destroyed && self.disconnected) self.reconnect(); }, 1500);
    };
  };
  RelayPeer.prototype._fallback = function () {
    if (this._inner || this.destroyed) return;
    downAt = Date.now();
    console.warn('[BioRelay] 서버에 연결하지 못해 P2P 방식으로 바꿉니다');
    if (!this._fallbackFn) { this.emit('error', perr('server-error', 'Relay server unavailable')); return; }
    var self = this, inner = this._fallbackFn();
    this._inner = inner; this.relay = false;
    ['open', 'connection', 'error', 'disconnected', 'close', 'call'].forEach(function (ev) {
      inner.on(ev, function () {
        if (ev === 'open') { self.id = inner.id; self.open = true; }
        if (ev === 'disconnected') self.disconnected = true;
        self.emit.apply(self, [ev].concat([].slice.call(arguments)));
      });
    });
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
      case 'open': this.id = m.id; this.open = true; this.disconnected = false; this.emit('open', m.id); break;
      case 'error':
        if (m.cid && (c2 = this._conns[m.cid])) { c2.emit('error', perr(m.type, m.message)); c2._closed = true; delete this._conns[m.cid]; }
        this.emit('error', perr(m.type, m.message || m.type));
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
    if (this._inner) { this.destroyed = true; try { this._inner.destroy(); } catch (e) {} return; }
    if (this.destroyed) return;
    this.destroyed = true; this.open = false;
    for (var k in this._conns) this._conns[k]._end();
    try { this._ws && this._ws.close(); } catch (e) {}
    this.emit('close');
  };
  RelayPeer.prototype.disconnect = function () { this.destroy(); };
  RelayPeer.prototype.reconnect = function () {
    if (this._inner) return this._inner.reconnect();
    if (this.destroyed || !this.disconnected) return;
    this._want = this.id; this._start();
  };

  var BioRelay = window.BioRelay = {
    url: url,
    // 서버를 쓸지: 주소가 있고, 최근 1분 안에 연결 실패가 없을 때
    enabled: function () { return !!url && typeof WebSocket !== 'undefined' && Date.now() - downAt > 60000; },
    create: function (id, opts, fallback) { return new RelayPeer(id, opts, fallback); },
    droppable: null,
    RelayPeer: RelayPeer
  };
})();
