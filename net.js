/* BIO ARCADE 실시간 중계 연결 (개선판 v2.1 - index.html & PeerJS 100% 호환 + 로컬/원격 자동 전환 + 버그 수정)
 *   1. index.html의 상단 서버 상태 표시줄(BioRelay.check / BioRelay.wake) 및 /health 엔드포인트 완벽 호환
 *   2. games/*.html에서 net.js가 peerjs.min.js보다 먼저 로드될 때 Object.defineProperty로 window.Peer 자동 래핑
 *   3. 기존 코드에서 RelayConn 생성자의 this.peer가 상대 ID 문자열로 덮어써져 send()가 먹통이 되던 치명적 버그 수정
 *   4. 초기 연결(open/connopen) 완료 전에 호출된 connect() 및 conn.send() 패킷을 버리지 않고 큐에 담아 순서대로 전송
 *   5. 로컬 Node.js 서버(ws://127.0.0.1:8080)가 켜져 있으면 0.3초 만에 자동 감지해 연결하고, 꺼져 있으면 Render 서버로 자동 연결
 *   6. 방장(Host)이 탭을 내리거나 다른 창을 볼 때 게임 루프가 멈추는 현상을 방지하는 Web Worker 백그라운드 타이머 내장
 */
(function () {
  'use strict';
  if (window.BioRelay) return;

  var REMOTE_RELAY_URL = 'wss://bio-arcade-relay.onrender.com';
  var LOCAL_RELAY_URL = 'ws://127.0.0.1:8080';

  var url = REMOTE_RELAY_URL;
  var explicitMode = false;
  var forceOff = false;

  try {
    var q = new URLSearchParams(location.search).get('relay');
    if (q === 'off') {
      url = '';
      forceOff = true;
      explicitMode = true;
    } else if (q === 'local') {
      url = LOCAL_RELAY_URL;
      explicitMode = true;
      localStorage.setItem('bioRelayUrl', LOCAL_RELAY_URL);
    } else if (q === 'reset') {
      localStorage.removeItem('bioRelayUrl');
    } else if (q && /^wss?:\/\//.test(q)) {
      url = q;
      explicitMode = true;
      localStorage.setItem('bioRelayUrl', q);
    } else if (localStorage.getItem('bioRelayUrl')) {
      url = localStorage.getItem('bioRelayUrl');
      explicitMode = true;
    } else if (location.protocol === 'http:' && (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.port === '8080')) {
      url = 'ws://' + location.host;
      explicitMode = true;
    }
  } catch (e) {}

  var downAt = 0;
  var isLocalActive = url.indexOf('127.0.0.1') >= 0 || url.indexOf('localhost') >= 0;

  function rid(n) {
    var s = 'abcdefghijkmnpqrstuvwxyz23456789', o = '';
    for (var i = 0; i < n; i++) o += s[Math.floor(Math.random() * s.length)];
    return o;
  }

  function perr(type, msg) {
    var e = new Error(msg || type);
    e.type = type;
    return e;
  }

  // ---------- 이벤트 에미터 ----------
  function Emitter() { this._ev = {}; }
  Emitter.prototype.on = function (e, f) {
    (this._ev[e] = this._ev[e] || []).push(f);
    return this;
  };
  Emitter.prototype.once = function (e, f) {
    var self = this;
    function g() { self.off(e, g); f.apply(self, arguments); }
    return this.on(e, g);
  };
  Emitter.prototype.off = function (e, f) {
    if (!this._ev[e]) return this;
    if (!f) { delete this._ev[e]; return this; }
    this._ev[e] = this._ev[e].filter(function (x) { return x !== f; });
    return this;
  };
  Emitter.prototype.removeListener = Emitter.prototype.off;
  Emitter.prototype.removeAllListeners = function (e) {
    if (e) delete this._ev[e]; else this._ev = {};
    return this;
  };
  Emitter.prototype.emit = function (e, a, b, c) {
    var list = (this._ev[e] || []).slice();
    for (var i = 0; i < list.length; i++) {
      try { list[i](a, b, c); } catch (err) { console.error(err); }
    }
    return list.length > 0;
  };

  // ---------- 방장(Host) 백그라운드 탭 스로틀링 방지 (Web Worker 30Hz 보조 타이머) ----------
  (function setupBackgroundKeepAlive() {
    try {
      var blob = new Blob([
        'var t=null;onmessage=function(e){if(e.data==="start"){if(!t)t=setInterval(function(){postMessage(1)},33)}else{clearInterval(t);t=null}};'
      ], { type: 'application/javascript' });
      var worker = new Worker(URL.createObjectURL(blob));
      var rafQueue = [];
      var origRaf = window.requestAnimationFrame;

      window.requestAnimationFrame = function (cb) {
        if (document.hidden) {
          rafQueue.push(cb);
          return rafQueue.length;
        }
        return origRaf.call(window, cb);
      };

      worker.onmessage = function () {
        if (!document.hidden || !rafQueue.length) return;
        var copy = rafQueue.slice();
        rafQueue.length = 0;
        var now = performance.now();
        for (var i = 0; i < copy.length; i++) {
          try { copy[i](now); } catch (err) { console.error(err); }
        }
      };

      document.addEventListener('visibilitychange', function () {
        worker.postMessage(document.hidden ? 'start' : 'stop');
      });
    } catch (e) {}
  })();

  // ---------- 게임 화면 우측 하단 연결 상태 배지 ----------
  var badgeEl = null, hideT = null, lastRtt = null;
  function badge(mode, ms) {
    if (typeof ms === 'number') lastRtt = ms;
    if (!document.body) {
      window.addEventListener('DOMContentLoaded', function () { badge(mode, ms); }, { once: true });
      return;
    }
    // 메인 로비(index.html)에는 상단 #srv 표시줄이 있으므로 중복 배지를 띄우지 않음
    if (document.getElementById('srv')) return;

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
    var rttStr = (typeof lastRtt === 'number') ? ' (' + lastRtt + 'ms)' : '';
    var txt = mode === 'local' ? '로컬 Node 서버' + rttStr
            : mode === 'relay' ? (isLocalActive ? '로컬 Node 서버' : '중계 서버') + rttStr
            : mode === 'p2p'   ? 'P2P 직접연결'
            : mode === 'fall'  ? '서버 응답 지연 → P2P 전환'
            : mode === 'down'  ? '서버 오프라인 → P2P 사용'
            : mode;
    badgeEl.innerHTML = dot + '<span>' + txt + '</span>';
    if (mode === 'fall' || mode === 'down') {
      hideT = setTimeout(function () { if (badgeEl) badgeEl.style.opacity = '0'; }, 5000);
    }
  }

  // ---------- RelayConn: 단일 P2P 데이터 커넥션 ----------
  function RelayConn(ownerPeer, cid, peerId, meta) {
    Emitter.call(this);
    // [핵심 버그 수정] 기존 코드에서 this.peer에 RelayPeer를 넣었다가 바로 다음 줄에서 peerId(문자열)로 덮어써서
    // this.peer._sendRaw() 호출이 실패하던 문제를 _owner 분리로 완벽 해결
    this._owner = ownerPeer;
    this.peer = peerId;       // PeerJS 호환: 상대방 peerId 문자열
    this.peerId = peerId;
    this.connectionId = cid;  // PeerJS 호환
    this.id = cid;
    this.metadata = meta;
    this.open = false;
    this.serialization = 'json';
    this.reliable = true;
    this._sentClose = false;
    this._queue = [];         // open 되기 전에 호출된 send() 패킷 유실 방지 큐
  }
  RelayConn.prototype = Object.create(Emitter.prototype);
  RelayConn.prototype.constructor = RelayConn;

  RelayConn.prototype._flush = function () {
    if (!this.open || !this._owner) return;
    while (this._queue.length > 0) {
      var data = this._queue.shift();
      this.send(data);
    }
  };

  RelayConn.prototype.send = function (data) {
    if (this._sentClose || !this._owner) return;
    if (!this.open || !this._owner.ws || this._owner.ws.readyState !== 1) {
      if (this._queue.length < 100) this._queue.push(data);
      return;
    }
    var payload;
    try { payload = typeof data === 'string' ? data : JSON.stringify(data); } catch (e) { return; }
    this._owner._sendRaw('D' + this.connectionId + payload);
  };

  RelayConn.prototype.close = function () {
    if (this._sentClose) return;
    this._sentClose = true;
    this._queue.length = 0;
    var wasOpen = this.open;
    this.open = false;
    if (wasOpen && this._owner) {
      this._owner._send({ t: 'close', cid: this.connectionId });
    }
    this.emit('close');
  };

  // ---------- RelayPeer: PeerJS 완벽 호환 WebSocket 중계 객체 ----------
  function RelayPeer(id, options) {
    Emitter.call(this);
    if (typeof id === 'object') { options = id; id = null; }
    this.requestedId = id || null;
    this.id = null;
    this.options = options || {};
    this.open = false;
    this.destroyed = false;
    this.disconnected = false;
    this.conns = {};
    this.connections = {}; // PeerJS 표준 프로퍼티 호환
    this.ws = null;
    this._pendingWire = []; // 서버에서 'open' 응답을 받기 전에 요청된 제어 메시지 큐
    this._pingInterval = null;
    this._lastPingTs = 0;
    this._startConnect();
  }
  RelayPeer.prototype = Object.create(Emitter.prototype);
  RelayPeer.prototype.constructor = RelayPeer;

  RelayPeer.prototype._startConnect = function () {
    var self = this;
    if (forceOff || self.destroyed) return self._fail('server-error', 'relay disabled');

    // 사용자가 별도 주소를 지정하지 않았을 때, 내 PC의 로컬 Node.js 서버(127.0.0.1:8080)가 켜져 있는지 350ms 안에 먼저 확인
    if (!explicitMode && !isLocalActive) {
      probeLocalServer(350).then(function (localOk) {
        if (self.destroyed) return;
        if (localOk) {
          url = LOCAL_RELAY_URL;
          isLocalActive = true;
          if (window.BioRelay) window.BioRelay.url = url;
        }
        self._connectTo(url);
      });
      return;
    }
    self._connectTo(url);
  };

  RelayPeer.prototype._connectTo = function (targetUrl) {
    var self = this;
    if (!targetUrl || self.destroyed) return self._fail('server-error', 'relay disabled');

    var ws;
    try { ws = new WebSocket(targetUrl); } catch (e) {
      if (isLocalActive && !explicitMode) {
        isLocalActive = false;
        url = REMOTE_RELAY_URL;
        if (window.BioRelay) window.BioRelay.url = url;
        return self._connectTo(url);
      }
      return self._fail('server-error', e.message);
    }
    self.ws = ws;

    var timeoutMs = isLocalActive ? 3000 : 8000;
    var timer = setTimeout(function () {
      if (ws.readyState !== 1 || !self.open) {
        try { ws.close(); } catch (e) {}
        if (isLocalActive && !explicitMode) {
          isLocalActive = false;
          url = REMOTE_RELAY_URL;
          if (window.BioRelay) window.BioRelay.url = url;
          self._connectTo(url);
          return;
        }
        badge('fall');
        self._fail('server-error', 'timeout');
      }
    }, timeoutMs);

    ws.onopen = function () {
      ws.send(JSON.stringify({ t: 'open', id: self.requestedId }));
    };

    ws.onmessage = function (ev) {
      var d = ev.data;
      if (typeof d === 'string' && d.charCodeAt(0) === 68 /* 'D' */) {
        var cid = d.slice(1, 9), body = d.slice(9);
        var conn = self.conns[cid];
        if (!conn) return;
        // 만약 D 패킷이 connopen보다 미세하게 먼저 도착하더라도 오픈 처리 후 즉시 전달
        if (!conn.open) {
          conn.open = true;
          conn.emit('open');
          conn._flush();
        }
        var data = body;
        try { data = JSON.parse(body); } catch (e) {}
        conn.emit('data', data);
        return;
      }

      var m;
      try { m = JSON.parse(d); } catch (e) { return; }

      if (m.t === 'open') {
        clearTimeout(timer);
        self.id = m.id;
        self.open = true;
        badge(isLocalActive ? 'local' : 'relay');
        self._startPing();
        // 서버가 ID 등록을 마쳤으므로 대기 중이던 connect 요청 등을 순서대로 전송
        while (self._pendingWire.length > 0) {
          var raw = self._pendingWire.shift();
          if (ws.readyState === 1) ws.send(raw);
        }
        self.emit('open', m.id);
      } else if (m.t === 'pong') {
        if (self._lastPingTs > 0) {
          badge(isLocalActive ? 'local' : 'relay', Math.max(1, Date.now() - self._lastPingTs));
        }
      } else if (m.t === 'conn') {
        var c = new RelayConn(self, m.cid, m.from, m.meta);
        c.open = true;
        self.conns[m.cid] = c;
        self.connections[m.from] = self.connections[m.from] || [];
        self.connections[m.from].push(c);
        // 구버전/신버전 서버 모두 호환되도록 connack 전송
        self._send({ t: 'connack', cid: m.cid });
        self.emit('connection', c);
        c.emit('open');
        c._flush();
      } else if (m.t === 'connopen') {
        var c2 = self.conns[m.cid];
        if (c2 && !c2.open) {
          c2.open = true;
          c2.emit('open');
          c2._flush();
        }
      } else if (m.t === 'close') {
        var c3 = self.conns[m.cid];
        if (c3) {
          c3.open = false;
          c3._sentClose = true;
          c3.emit('close');
          delete self.conns[m.cid];
        }
      } else if (m.t === 'error') {
        clearTimeout(timer);
        var errMsg = m.message || m.msg || m.type;
        if (m.cid && self.conns[m.cid]) {
          var c4 = self.conns[m.cid];
          delete self.conns[m.cid];
          c4.emit('error', perr(m.type, errMsg));
        } else {
          self.emit('error', perr(m.type, errMsg));
        }
      }
    };

    ws.onerror = function () {
      clearTimeout(timer);
      if (!self.open && isLocalActive && !explicitMode) {
        isLocalActive = false;
        url = REMOTE_RELAY_URL;
        if (window.BioRelay) window.BioRelay.url = url;
        self._connectTo(url);
        return;
      }
      if (!self.open) {
        badge('down');
        self._fail('server-error', 'ws error');
      }
    };

    ws.onclose = function () {
      clearTimeout(timer);
      self._stopPing();
      if (self.destroyed) return;
      var wasOpen = self.open;
      self.open = false;
      self.disconnected = true;
      Object.keys(self.conns).forEach(function (k) {
        var c = self.conns[k];
        if (c && c.open) {
          c.open = false;
          c._sentClose = true;
          c.emit('close');
        }
      });
      if (wasOpen) self.emit('disconnected', self.id);
    };
  };

  RelayPeer.prototype._startPing = function () {
    var self = this;
    self._stopPing();
    function ping() {
      if (!self.open || !self.ws || self.ws.readyState !== 1) return;
      self._lastPingTs = Date.now();
      try { self.ws.send(JSON.stringify({ t: 'ping', ts: self._lastPingTs })); } catch (e) {}
    }
    ping();
    self._pingInterval = setInterval(ping, 5000);
  };

  RelayPeer.prototype._stopPing = function () {
    if (this._pingInterval) {
      clearInterval(this._pingInterval);
      this._pingInterval = null;
    }
  };

  RelayPeer.prototype._send = function (obj) {
    var str = JSON.stringify(obj);
    if (this.open && this.ws && this.ws.readyState === 1) {
      this.ws.send(str);
    } else if (!this.destroyed && this._pendingWire.length < 64) {
      this._pendingWire.push(str);
    }
  };

  RelayPeer.prototype._sendRaw = function (str) {
    if (this.open && this.ws && this.ws.readyState === 1) {
      if (this.ws.bufferedAmount > 1024 * 1024) return;
      this.ws.send(str);
    } else if (!this.destroyed && this._pendingWire.length < 64) {
      this._pendingWire.push(str);
    }
  };

  RelayPeer.prototype._fail = function (type, msg) {
    downAt = Date.now();
    this.emit('error', perr(type, msg));
  };

  RelayPeer.prototype.connect = function (peerId, options) {
    options = options || {};
    var cid = rid(8);
    var conn = new RelayConn(this, cid, peerId, options.metadata);
    this.conns[cid] = conn;
    this.connections[peerId] = this.connections[peerId] || [];
    this.connections[peerId].push(conn);
    this._send({ t: 'connect', to: peerId, cid: cid, meta: options.metadata });
    return conn;
  };

  // 다중 클라이언트에게 상태를 한 번에 쏘는 멀티캐스트 헬퍼
  RelayPeer.prototype.broadcast = function (conns, data) {
    if (!this.open || !this.ws || this.ws.readyState !== 1) return;
    if (this.ws.bufferedAmount > 1024 * 1024) return;
    var cids = [];
    for (var i = 0; i < conns.length; i++) {
      var c = conns[i];
      if (c && c.open && c._owner === this) cids.push(c.connectionId);
    }
    if (!cids.length) return;
    var payload;
    try { payload = typeof data === 'string' ? data : JSON.stringify(data); } catch (e) { return; }
    this.ws.send('M' + cids.join('') + '|' + payload);
  };

  RelayPeer.prototype.reconnect = function () {
    if (this.destroyed) return;
    this.disconnected = false;
    this._startConnect();
  };

  RelayPeer.prototype.disconnect = function () {
    this._stopPing();
    if (this.ws) try { this.ws.close(); } catch (e) {}
    this.open = false;
    this.disconnected = true;
    this.emit('disconnected');
  };

  RelayPeer.prototype.destroy = function () {
    if (this.destroyed) return;
    this.destroyed = true;
    this._pendingWire.length = 0;
    this.disconnect();
    this.emit('close');
  };

  // ---------- 로컬 서버 빠른 감지 및 index.html 호환 상태 체크 ----------
  function fetchHealth(baseWsUrl, timeoutMs) {
    var httpUrl = baseWsUrl.replace(/^ws/, 'http').replace(/\/$/, '') + '/health';
    var start = Date.now();
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var tm = setTimeout(function () { if (ctrl) ctrl.abort(); }, timeoutMs || 5000);
    return fetch(httpUrl, { mode: 'cors', cache: 'no-store', signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) {
        clearTimeout(tm);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (d) {
        return { ok: true, ms: Math.max(1, Date.now() - start), peers: d.peers, local: baseWsUrl === LOCAL_RELAY_URL };
      })
      .catch(function (e) {
        clearTimeout(tm);
        return { ok: false, reason: e && e.name === 'AbortError' ? 'timeout' : 'down' };
      });
  }

  function probeLocalServer(timeoutMs) {
    if (forceOff) return Promise.resolve(false);
    return fetchHealth(LOCAL_RELAY_URL, timeoutMs || 400).then(function (r) {
      return !!r.ok;
    });
  }

  // index.html에서 호출하는 BioRelay.check(timeoutMs)
  function checkServer(timeoutMs) {
    if (forceOff || !url) return Promise.resolve({ ok: false, reason: 'off' });

    // 먼저 내 PC에 켜진 로컬 Node.js 서버(http://127.0.0.1:8080/health)가 있는지 400ms 동안 확인
    if (!explicitMode) {
      return fetchHealth(LOCAL_RELAY_URL, 400).then(function (localRes) {
        if (localRes.ok) {
          url = LOCAL_RELAY_URL;
          isLocalActive = true;
          window.BioRelay.url = url;
          downAt = 0;
          return localRes;
        }
        // 로컬 서버가 꺼져 있으면 기본 원격 서버(Render) 확인
        isLocalActive = false;
        url = REMOTE_RELAY_URL;
        window.BioRelay.url = url;
        return fetchHealth(REMOTE_RELAY_URL, timeoutMs || 6000);
      });
    }

    return fetchHealth(url, timeoutMs || 6000);
  }

  // index.html에서 호출하는 BioRelay.wake()
  function wakeServer() {
    if (forceOff || !url) return;
    checkServer(8000);
  }

  window.BioRelay = {
    url: url,
    Peer: RelayPeer,
    RelayPeer: RelayPeer,
    badge: badge,
    check: checkServer,
    wake: wakeServer,
    isDownRecently: function () { return Date.now() - downAt < 30000; }
  };

  // ---------- PeerJS 로드 순서와 무관하게 window.Peer 자동 가로채기 ----------
  // games/*.html 에서 <script src="../net.js">가 <script src="../vendor/peerjs.min.js">보다 먼저 실행되므로
  // Object.defineProperty getter/setter를 사용해 peerjs.min.js가 로드되는 순간 자동으로 SmartPeer로 감쌉니다.
  var origPeer = window.Peer;

  function SmartPeer(id, options) {
    if (!(this instanceof SmartPeer)) return new SmartPeer(id, options);
    if (!forceOff && url && !window.BioRelay.isDownRecently()) {
      try { return new RelayPeer(id, options); } catch (e) {}
    }
    if (origPeer) {
      badge('p2p');
      return new origPeer(id, options);
    }
    // 혹시라도 PeerJS가 아직 로드되지 않았더라도 RelayPeer로 폴백 시도
    return new RelayPeer(id, options);
  }

  function syncPeerStatics(fn) {
    if (!fn) return;
    SmartPeer.prototype = fn.prototype;
    for (var k in fn) {
      if (Object.prototype.hasOwnProperty.call(fn, k)) {
        SmartPeer[k] = fn[k];
      }
    }
  }

  if (origPeer) syncPeerStatics(origPeer);

  try {
    Object.defineProperty(window, 'Peer', {
      configurable: true,
      enumerable: true,
      get: function () {
        return SmartPeer;
      },
      set: function (v) {
        if (v && v !== SmartPeer) {
          origPeer = v;
          syncPeerStatics(v);
        }
      }
    });
  } catch (e) {
    window.Peer = SmartPeer;
  }
})();