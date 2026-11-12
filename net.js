/* BIO ARCADE 실시간 중계 연결 (개선판 v2.0 - 저지연 로컬/릴레이 자동 감지 + 패킷 유실 방지 + 백그라운드 스로틀링 방지)
 *   1. 로컬 Node.js 서버(ws://127.0.0.1:8080 또는 현재 호스트) 자동 감지 및 즉시 연결 (콜드 스타트 0초)
 *   2. RelayConn.close()의 readyState !== 1 오타 버그 수정 (유령 커넥션 누적 및 렉 방지)
 *   3. 초기 핸드셰이크(connopen 전) 패킷 유실 방지용 송신 큐(_queue) 및 연결 큐(_connectQueue) 도입
 *   4. 방장(Host)이 브라우저 탭을 내리거나 다른 창을 볼 때 게임 루프가 멈추는 현상을 막는 Web Worker 타이머 보정
 *   5. 실시간 핑(RTT ms) 측정 및 우측 하단 배지 표시, M(멀티캐스트) 자동 헬퍼 지원
 */
(function () {
  'use strict';
  if (window.BioRelay) return;

  var DEFAULT_REMOTE_RELAY = 'wss://bio-arcade-relay.onrender.com';
  var LOCAL_RELAY = 'ws://127.0.0.1:8080';

  // 접속할 기본 URL 결정 (쿼리 파라미터 > localStorage > 로컬 호스트 서빙 > 원격 서버)
  var explicitUrl = '';
  var forceOff = false;
  try {
    var q = new URLSearchParams(location.search).get('relay');
    if (q === 'off') {
      forceOff = true;
    } else if (q === 'local') {
      explicitUrl = LOCAL_RELAY;
      localStorage.setItem('bioRelayUrl', LOCAL_RELAY);
    } else if (q === 'reset') {
      localStorage.removeItem('bioRelayUrl');
    } else if (q && /^wss?:\/\//.test(q)) {
      explicitUrl = q;
      localStorage.setItem('bioRelayUrl', q);
    } else if (localStorage.getItem('bioRelayUrl')) {
      explicitUrl = localStorage.getItem('bioRelayUrl');
    } else if (location.protocol === 'http:' && location.port === '8080') {
      explicitUrl = 'ws://' + location.host;
    }
  } catch (e) {}

  var activeUrl = forceOff ? '' : (explicitUrl || DEFAULT_REMOTE_RELAY);
  var localChecked = false;
  var isLocalServer = explicitUrl.indexOf('127.0.0.1') >= 0 || explicitUrl.indexOf('localhost') >= 0;

  var downAt = 0;
  function rid(n) {
    var s = 'abcdefghijklmnopqrstuvwxyz23456789', o = '';
    for (var i = 0; i < n; i++) o += s[Math.random() * s.length | 0];
    return o;
  }
  function perr(type, msg) {
    var e = new Error(msg || type);
    e.type = type;
    return e;
  }

  // ---------- 이벤트 에미터 ----------
  function Emitter() { this._ev = {}; }
  Emitter.prototype.on = function (e, f) { (this._ev[e] = this._ev[e] || []).push(f); return this; };
  Emitter.prototype.once = function (e, f) {
    var self = this;
    function g() { self.off(e, g); f.apply(self, arguments); }
    return this.on(e, g);
  };
  Emitter.prototype.off = function (e, f) {
    var a = this._ev[e];
    if (a) { var i = a.indexOf(f); if (i >= 0) a.splice(i, 1); }
    return this;
  };
  Emitter.prototype.removeListener = Emitter.prototype.off;
  Emitter.prototype.removeAllListeners = function (e) {
    if (e) delete this._ev[e]; else this._ev = {};
    return this;
  };
  Emitter.prototype.emit = function (e) {
    var a = (this._ev[e] || []).slice(), args = [].slice.call(arguments, 1);
    for (var i = 0; i < a.length; i++) {
      try { a[i].apply(this, args); } catch (x) { console.error(x); }
    }
    return a.length > 0;
  };

  // ---------- 방장 백그라운드 탭 스로틀링 방지 (Web Worker 기반 30Hz 보조 틱) ----------
  // 방장이 다른 창으로 전환해 document.hidden 상태가 되면 requestAnimationFrame이 멈추는 현상을 방지합니다.
  (function setupBackgroundKeepAlive() {
    try {
      var blob = new Blob([
        'var t=null;onmessage=function(e){if(e.data==="start"){if(!t)t=setInterval(function(){postMessage(1)},33)}else{clearInterval(t);t=null}};'
      ], { type: 'application/javascript' });
      var worker = new Worker(URL.createObjectURL(blob));
      var rafCallbacks = [];
      var origRaf = window.requestAnimationFrame;

      window.requestAnimationFrame = function (cb) {
        if (document.hidden) {
          rafCallbacks.push(cb);
          return rafCallbacks.length;
        }
        return origRaf.call(window, cb);
      };

      worker.onmessage = function () {
        if (!document.hidden || !rafCallbacks.length) return;
        var list = rafCallbacks.slice();
        rafCallbacks.length = 0;
        var now = performance.now();
        for (var i = 0; i < list.length; i++) {
          try { list[i](now); } catch (err) { console.error(err); }
        }
      };

      document.addEventListener('visibilitychange', function () {
        worker.postMessage(document.hidden ? 'start' : 'stop');
      });
    } catch (e) {}
  })();

  // ---------- 연결 방식 및 실시간 핑(ms) 배지 표시 ----------
  var live = 0, badgeEl = null, hideT = null, lastRtt = null;
  function badge(mode, ms) {
    if (typeof ms === 'number') lastRtt = ms;
    if (!document.body) {
      window.addEventListener('DOMContentLoaded', function () { badge(mode, ms); }, { once: true });
      return;
    }
    if (!badgeEl) {
      badgeEl = document.createElement('div');
      badgeEl.style.cssText = 'position:fixed;right:max(8px,env(safe-area-inset-right));bottom:max(8px,env(safe-area-inset-bottom));z-index:2147482000;pointer-events:none;' +
        'padding:4px 10px 4px 8px;border-radius:999px;font:600 11px/1.3 "Noto Sans KR",system-ui,sans-serif;color:#fff;background:rgba(10,14,28,.78);border:1px solid rgba(255,255,255,.22);' +
        'backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:flex;align-items:center;gap:6px;transition:opacity .3s';
      document.body.appendChild(badgeEl);
    }
    clearTimeout(hideT);
    badgeEl.style.opacity = '1';
    var dot = (mode === 'relay' || mode === 'local')
      ? '<span style="width:6px;height:6px;border-radius:50%;background:#10b981;box-shadow:0 0 6px #10b981;display:inline-block"></span>'
      : mode === 'p2p'
      ? '<span style="width:6px;height:6px;border-radius:50%;background:#3b82f6;box-shadow:0 0 6px #3b82f6;display:inline-block"></span>'
      : '<span style="width:6px;height:6px;border-radius:50%;background:#eab308;box-shadow:0 0 6px #eab308;display:inline-block"></span>';
    var rttText = (typeof lastRtt === 'number') ? ' (' + lastRtt + 'ms)' : '';
    var txt = mode === 'local' ? 'Node 로컬 서버' + rttText
            : mode === 'relay' ? (isLocalServer ? 'Node 로컬 서버' : '중계 서버') + rttText
            : mode === 'p2p'   ? 'P2P 직접연결'
            : mode === 'fall'  ? '서버 응답 지연 → P2P 전환'
            : mode === 'down'  ? '서버 오프라인 → P2P 사용'
            : mode;
    badgeEl.innerHTML = dot + '<span>' + txt + '</span>';
    if (mode === 'fall' || mode === 'down') {
      hideT = setTimeout(function () { if (badgeEl) badgeEl.style.opacity = '0'; }, 5000);
    }
  }

  // 로컬 PC(127.0.0.1:8080)에 켜져 있는 Node.js 서버가 있는지 먼저 400ms 안에 빠르게 탐색
  function detectLocalOrWakeRemote() {
    if (forceOff) return;
    if (!explicitUrl && !localChecked) {
      localChecked = true;
      try {
        var lws = new WebSocket(LOCAL_RELAY);
        var lt = setTimeout(function () { try { lws.close(); } catch (e) {} }, 450);
        lws.onopen = function () {
          clearTimeout(lt);
          activeUrl = LOCAL_RELAY;
          isLocalServer = true;
          live = 1;
          try { lws.close(); } catch (e) {}
        };
        lws.onerror = function () { clearTimeout(lt); };
      } catch (e) {}
    }
    if (!activeUrl || live || isLocalServer) return;
    try {
      var ws = new WebSocket(activeUrl);
      ws.onopen = function () { live = 1; try { ws.close(); } catch (e) {} };
      ws.onerror = function () {};
    } catch (e) {}
  }
  detectLocalOrWakeRemote();
  setInterval(detectLocalOrWakeRemote, 4 * 60 * 1000);

  // ---------- RelayConn: 단일 P2P 커넥션 모사 (패킷 큐잉 및 버그 수정 포함) ----------
  function RelayConn(peer, peerId, cid) {
    Emitter.call(this);
    this.peer = peer;
    this.peerId = peerId;
    this.id = cid;
    this.open = false;
    this._sentClose = false;
    this._queue = []; // connopen 완료 전 전송된 초기 패킷 유실 방지용 큐
  }
  RelayConn.prototype = Object.create(Emitter.prototype);
  RelayConn.prototype.constructor = RelayConn;

  RelayConn.prototype._flush = function () {
    if (!this.open || !this.peer._ws || this.peer._ws.readyState !== 1) return;
    while (this._queue.length > 0) {
      var item = this._queue.shift();
      this.send(item);
    }
  };

  RelayConn.prototype.send = function (data) {
    if (this._sentClose) return;
    // 아직 핸드셰이크(open)가 끝나지 않았다면 버리지 않고 큐에 보관 후 open 즉시 발송
    if (!this.open || !this.peer._ws || this.peer._ws.readyState !== 1) {
      if (this._queue.length < 64) this._queue.push(data);
      return;
    }
    var payload = typeof data === 'string' ? data : JSON.stringify(data);
    // 버퍼 과부하 시(1MB 초과) 오래된 이동 스냅샷이 쌓여 렉이 발생하는 것을 방지
    if (this.peer._ws.bufferedAmount > 1024 * 1024) return;
    this.peer._ws.send('D' + this.id + payload);
  };

  RelayConn.prototype.close = function () {
    if (this._sentClose) return;
    this._sentClose = true;
    this._queue.length = 0;
    // [버그 수정] 기존 코드의 readyState !== 1 오타를 === 1 로 바로잡아 상대방에게 즉시 close 전달
    if (this.open && this.peer._ws && this.peer._ws.readyState === 1) {
      try { this.peer._ws.send(JSON.stringify({ t: 'close', cid: this.id })); } catch (e) {}
    }
    this.open = false;
    this.emit('close');
  };

  // ---------- RelayPeer: PeerJS 호환 고성능 WebSocket 중계 Peer ----------
  function RelayPeer(id, opts) {
    Emitter.call(this);
    if (typeof id === 'object') { opts = id; id = null; }
    this.options = opts || {};
    this.id = id || null;
    this.open = false;
    this.disconnected = false;
    this.destroyed = false;
    this.connections = {}; // PeerJS 표준 호환용
    this._conns = {};
    this._pending = {};
    this._connectQueue = []; // 소켓이 열리기 전에 호출된 connect() 요청 보관
    this._ws = null;
    this._pingTimer = null;
    this._lastPingSent = 0;
    this._connectWithProbe();
  }
  RelayPeer.prototype = Object.create(Emitter.prototype);
  RelayPeer.prototype.constructor = RelayPeer;

  RelayPeer.prototype._connectWithProbe = function () {
    var self = this;
    // 명시적 URL이 없으면 로컬 Node.js 서버(127.0.0.1:8080)가 켜져 있는지 350ms 동안 우선 시도
    if (!explicitUrl && !isLocalServer) {
      try {
        var probe = new WebSocket(LOCAL_RELAY);
        var done = false;
        var pt = setTimeout(function () {
          if (done) return;
          done = true;
          try { probe.close(); } catch (e) {}
          self._connect(activeUrl);
        }, 350);
        probe.onopen = function () {
          if (done) return;
          done = true;
          clearTimeout(pt);
          activeUrl = LOCAL_RELAY;
          isLocalServer = true;
          try { probe.close(); } catch (e) {}
          self._connect(LOCAL_RELAY);
        };
        probe.onerror = function () {
          if (done) return;
          done = true;
          clearTimeout(pt);
          self._connect(activeUrl);
        };
        return;
      } catch (e) {}
    }
    self._connect(activeUrl);
  };

  RelayPeer.prototype._connect = function (targetUrl) {
    var self = this;
    var ws;
    try { ws = new WebSocket(targetUrl); } catch (e) { return self._fail(e); }
    self._ws = ws;

    var timeoutMs = isLocalServer ? 3000 : 8000;
    var timer = setTimeout(function () {
      if (!self.open) {
        downAt = Date.now();
        badge('fall');
        try { ws.close(); } catch (e) {}
        self._fail(perr('network', 'Relay server timeout'));
      }
    }, timeoutMs);

    ws.onopen = function () {
      ws.send(JSON.stringify({ t: 'open', id: self.id }));
    };

    ws.onmessage = function (ev) {
      var data = ev.data;
      if (typeof data === 'string' && data.charCodeAt(0) === 68 /* 'D' */) {
        var cid = data.slice(1, 9);
        var body = data.slice(9);
        var c = self._conns[cid];
        if (c && c.open) {
          try { c.emit('data', JSON.parse(body)); } catch (e) { c.emit('data', body); }
        }
        return;
      }
      var msg;
      try { msg = JSON.parse(data); } catch (e) { return; }

      if (msg.t === 'open') {
        clearTimeout(timer);
        live = 1;
        self.id = msg.id;
        self.open = true;
        badge(isLocalServer ? 'local' : 'relay');
        self._startHeartbeat();
        self.emit('open', self.id);
        // 대기 중이던 connect() 요청 일괄 전송
        while (self._connectQueue.length > 0) {
          var req = self._connectQueue.shift();
          self._sendConnectPacket(req.peerId, req.cid, req.meta);
        }
      } else if (msg.t === 'pong') {
        if (self._lastPingSent > 0) {
          var rtt = Math.max(1, Date.now() - self._lastPingSent);
          badge(isLocalServer ? 'local' : 'relay', rtt);
        }
      } else if (msg.t === 'conn') {
        var conn = new RelayConn(self, msg.from, msg.cid);
        conn.metadata = msg.meta;
        self._conns[msg.cid] = conn;
        self.connections[msg.from] = self.connections[msg.from] || [];
        self.connections[msg.from].push(conn);
        ws.send(JSON.stringify({ t: 'connack', cid: msg.cid }));
        conn.open = true;
        self.emit('connection', conn);
        setTimeout(function () {
          conn.emit('open');
          conn._flush();
        }, 0);
      } else if (msg.t === 'connopen') {
        var pending = self._pending[msg.cid];
        if (pending) {
          delete self._pending[msg.cid];
          pending.open = true;
          pending.emit('open');
          pending._flush();
        }
      } else if (msg.t === 'close') {
        var c2 = self._conns[msg.cid];
        if (c2) {
          c2.open = false;
          c2._sentClose = true;
          c2.emit('close');
          delete self._conns[msg.cid];
        }
      } else if (msg.t === 'error') {
        if (msg.cid && self._pending[msg.cid]) {
          var p = self._pending[msg.cid];
          delete self._pending[msg.cid];
          delete self._conns[msg.cid];
          p.emit('error', perr(msg.type, msg.msg || msg.type));
        } else {
          self.emit('error', perr(msg.type, msg.msg || msg.type));
        }
      }
    };

    ws.onerror = function () {
      if (!self.open) {
        clearTimeout(timer);
        if (isLocalServer && !explicitUrl) {
          // 로컬 서버 실패 시 원격 서버로 즉시 재시도
          isLocalServer = false;
          activeUrl = DEFAULT_REMOTE_RELAY;
          self._connect(activeUrl);
          return;
        }
        downAt = Date.now();
        badge('down');
        self._fail(perr('network', 'Relay connection error'));
      }
    };

    ws.onclose = function () {
      self._stopHeartbeat();
      var wasOpen = self.open;
      self.open = false;
      self.disconnected = true;
      if (wasOpen) self.emit('disconnected', self.id);
      Object.keys(self._conns).forEach(function (k) {
        var c = self._conns[k];
        if (c.open) { c.open = false; c.emit('close'); }
      });
    };
  };

  RelayPeer.prototype._startHeartbeat = function () {
    var self = this;
    self._stopHeartbeat();
    function sendPing() {
      if (!self.open || !self._ws || self._ws.readyState !== 1) return;
      self._lastPingSent = Date.now();
      try { self._ws.send(JSON.stringify({ t: 'ping' })); } catch (e) {}
    }
    sendPing();
    self._pingTimer = setInterval(sendPing, 5000);
  };

  RelayPeer.prototype._stopHeartbeat = function () {
    if (this._pingTimer) {
      clearInterval(this._pingTimer);
      this._pingTimer = null;
    }
  };

  RelayPeer.prototype._fail = function (err) {
    if (this.destroyed) return;
    this.emit('error', err);
  };

  RelayPeer.prototype._sendConnectPacket = function (peerId, cid, meta) {
    if (this._ws && this._ws.readyState === 1) {
      this._ws.send(JSON.stringify({ t: 'connect', to: peerId, cid: cid, meta: meta }));
    }
  };

  RelayPeer.prototype.connect = function (peerId, opts) {
    var cid = rid(8);
    var conn = new RelayConn(this, peerId, cid);
    conn.metadata = opts && opts.metadata;
    this._conns[cid] = conn;
    this._pending[cid] = conn;
    this.connections[peerId] = this.connections[peerId] || [];
    this.connections[peerId].push(conn);

    // 아직 RelayPeer가 서버와 open 핸드셰이크 중이면 에러를 내지 않고 큐에 넣어 open 직후 전송
    if (!this.open || !this._ws || this._ws.readyState !== 1) {
      this._connectQueue.push({ peerId: peerId, cid: cid, meta: conn.metadata });
      return conn;
    }
    this._sendConnectPacket(peerId, cid, conn.metadata);
    return conn;
  };

  RelayPeer.prototype.reconnect = function () {
    if (this.destroyed) return;
    this.disconnected = false;
    this._connectWithProbe();
  };

  RelayPeer.prototype.disconnect = function () {
    if (this.disconnected) return;
    this._stopHeartbeat();
    this.disconnected = true;
    this.open = false;
    if (this._ws) try { this._ws.close(); } catch (e) {}
    this.emit('disconnected', this.id);
  };

  RelayPeer.prototype.destroy = function () {
    if (this.destroyed) return;
    this.destroyed = true;
    this._connectQueue.length = 0;
    this.disconnect();
    this.emit('close');
  };

  // 멀티캐스트 브로드캐스트 ('M' 프로토콜로 방장의 업로드 패킷 횟수를 1회로 압축)
  RelayPeer.prototype.broadcast = function (conns, data) {
    if (!this.open || !this._ws || this._ws.readyState !== 1) return;
    if (this._ws.bufferedAmount > 1024 * 1024) return;
    var validCids = [];
    for (var i = 0; i < conns.length; i++) {
      var c = conns[i];
      if (c && c.open && c.peer === this) validCids.push(c.id);
    }
    if (!validCids.length) return;
    var payload = typeof data === 'string' ? data : JSON.stringify(data);
    this._ws.send('M' + validCids.join('') + '|' + payload);
  };

  // ---------- PeerJS 가로채기 (Wrapping) ----------
  function wrapPeer() {
    var OrigPeer = window.Peer;
    if (!OrigPeer) return;

    function SmartPeer(id, opts) {
      if (!(this instanceof SmartPeer)) return new SmartPeer(id, opts);
      if (typeof id === 'object') { opts = id; id = null; }
      opts = opts || {};

      var useRelay = !forceOff && !!activeUrl && (Date.now() - downAt > 15000);
      if (useRelay) {
        var rp = new RelayPeer(id, opts);
        rp.on('error', function (err) {
          if (err && (err.type === 'network' || err.type === 'server-error')) {
            downAt = Date.now();
          }
        });
        return rp;
      }
      badge('p2p');
      return new OrigPeer(id, opts);
    }

    SmartPeer.prototype = OrigPeer.prototype;
    for (var k in OrigPeer) {
      if (Object.prototype.hasOwnProperty.call(OrigPeer, k)) {
        SmartPeer[k] = OrigPeer[k];
      }
    }
    window.Peer = SmartPeer;
  }

  wrapPeer();

  window.BioRelay = {
    url: activeUrl,
    badge: badge,
    RelayPeer: RelayPeer,
    setServer: function (newUrl) {
      if (!newUrl) {
        localStorage.removeItem('bioRelayUrl');
      } else {
        localStorage.setItem('bioRelayUrl', newUrl);
        activeUrl = newUrl;
      }
    }
  };
})();