/**
 * BIO ARCADE — Dedicated uWebSockets.js Client + Enhanced Unreliable P2P Fallback Engine
 * (window.BIO_RT & window.Peer Hybrid Transport Adapter)
 *
 * 1. 전용 실시간 서버(uWebSockets.js / server.js) 자동 감지 및 멀티플렉싱:
 *    - URL 파라미터(?ws=wss://...), localStorage('biogame_ws_url'), 현재 호스트(/ws),
 *      또는 로컬 서버(ws://localhost:9001/ws)를 자동으로 탐색해 단일 초저지연 WebSocket으로 연결합니다.
 *    - 방장이 여러 게스트에게 스냅샷(state/board/room_state)을 보낼 때 동일 틱의 패킷을
 *      단 1개의 `bcast` 프레임으로 병합 전송하여 방장의 업로드 대역폭을 1/N로 줄입니다.
 * 2. 정적 호스팅(GitHub Pages 등) 단독 실행 시 개선된 WebRTC P2P 자동 폴백:
 *    - 누락된 STUN/TURN(iceServers) 설정을 모든 게임에 자동 주입합니다.
 *    - 제어 채널(reliable: true)과 실시간 상태/입력 채널(reliable: false, maxRetransmits: 0, UDP 방식)을
 *      자동으로 이원화하여 패킷 유실 시 발생하는 Head-of-Line Blocking(화면 멈춤 후 배속 튀는 현상)을 제거합니다.
 * 3. Web Worker 백그라운드 타이머(Anti-Throttle):
 *    - 방장 탭이 백그라운드로 전환(document.hidden)되어도 25Hz 물리/네트워크 틱을 유지합니다.
 * 4. 초고속 매치메이킹(BIO_RT.quickMatch):
 *    - 전용 서버 연결 시 0.1초 이내에 서버 인메모리 매칭 결과를 반환하며,
 *      P2P 폴백 시에도 다중 슬롯(QM1~QM6)을 병렬 탐색하여 1.5초 이내에 매칭합니다.
 */
(function (global) {
  'use strict';
  if (global.BIO_RT) return;

  const RawPeer = global.Peer;
  global.RawPeer = RawPeer;

  const DEFAULT_ICE_SERVERS = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] },
    { urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp' }
  ];

  function isVolatileMessage(msg) {
    if (!msg || typeof msg !== 'object') return false;
    const t = msg.type;
    return t === 'state' || t === 'input' || t === 'live' || t === 'board' || t === 'ping' || t === 'pong' ||
      (t === 'cmd' && msg.cmd && (msg.cmd.k === 'move' || msg.cmd.k === 'ping'));
  }

  // ==========================================================================
  // 간단 이벤트 이미터
  // ==========================================================================
  class Emitter {
    constructor() {
      this._evs = Object.create(null);
    }
    on(ev, fn) {
      if (typeof fn !== 'function') return this;
      (this._evs[ev] || (this._evs[ev] = [])).push(fn);
      return this;
    }
    off(ev, fn) {
      const arr = this._evs[ev];
      if (!arr) return this;
      if (!fn) {
        delete this._evs[ev];
      } else {
        const i = arr.indexOf(fn);
        if (i >= 0) arr.splice(i, 1);
      }
      return this;
    }
    emit(ev, ...args) {
      const arr = this._evs[ev];
      if (!arr || !arr.length) return;
      for (const fn of arr.slice()) {
        try { fn(...args); } catch (e) { console.error('[BIO_RT]', e); }
      }
    }
  }

  // ==========================================================================
  // 전용 서버(uWebSockets.js) 연결 관리자
  // ==========================================================================
  const WSManager = {
    ws: null,
    url: null,
    state: 'idle', // 'idle' | 'connecting' | 'connected' | 'failed'
    lastFailAt: 0,
    peers: new Map(), // localPeerId -> WSRelayPeer
    pendingOpens: new Map(), // reqId -> { peer, resolve, reject }
    pendingQuick: new Map(), // reqId -> resolve
    waiters: [],
// vendor/biogame-realtime.js 내 resolveCandidateUrls() 안에 한 줄 추가 예시
list.push('wss://biogame-mod.onrender.com/ws');
    resolveCandidateUrls() {
      const q = new URLSearchParams(global.location ? global.location.search : '');
      if (q.get('p2p') === '1' || q.get('nop2pws') === '1') return [];
      const custom = q.get('ws') || q.get('server') || (() => {
        try { return global.localStorage && global.localStorage.getItem('biogame_ws_url'); } catch (_) { return null; }
      })();
      if (custom) {
        try { if (q.get('ws')) global.localStorage.setItem('biogame_ws_url', custom); } catch (_) {}
        return [custom];
      }
      const list = [];
      if (global.location && (global.location.protocol === 'http:' || global.location.protocol === 'https:')) {
        const proto = global.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = global.location.host;
        const hostname = global.location.hostname;
        // 현재 웹 서버와 같은 포트(/ws) 우선 시도
        list.push(`${proto}//${host}/ws`);
        // 로컬 개발 환경에서 정적 서버(8000 등)와 실시간 서버(9001)를 분리 실행한 경우 자동 감지
        if ((hostname === 'localhost' || hostname === '127.0.0.1') && global.location.port !== '9001') {
          list.push(`ws://${hostname}:9001/ws`);
        }
      } else if (global.location && global.location.protocol === 'file:') {
        list.push('ws://localhost:9001/ws');
      }
      return list;
    },

    ensureConnected(timeoutMs = 750) {
      if (this.state === 'connected' && this.ws && this.ws.readyState === 1) {
        return Promise.resolve(true);
      }
      const urls = this.resolveCandidateUrls();
      if (!urls.length) return Promise.resolve(false);

      // 최근 4초 내 연결 실패 시 재시도 생략하여 P2P 폴백 지연 방지
      if (this.state === 'failed' && Date.now() - this.lastFailAt < 4000) {
        return Promise.resolve(false);
      }
      if (this.state === 'connecting') {
        return new Promise(res => this.waiters.push(res));
      }

      this.state = 'connecting';
      return new Promise(resolve => {
        this.waiters.push(resolve);
        const finish = (ok, sock, url) => {
          this.state = ok ? 'connected' : 'failed';
          if (!ok) this.lastFailAt = Date.now();
          if (ok) {
            this.ws = sock;
            this.url = url;
            this.bindSocket(sock);
          }
          const w = this.waiters.splice(0, this.waiters.length);
          w.forEach(fn => { try { fn(ok); } catch (_) {} });
        };

        let idx = 0;
        const tryNext = () => {
          if (idx >= urls.length) {
            finish(false, null, null);
            return;
          }
          const u = urls[idx++];
          let settled = false;
          let sock;
          try {
            sock = new WebSocket(u);
          } catch (_) {
            tryNext();
            return;
          }
          const timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            try { sock.close(); } catch (_) {}
            tryNext();
          }, timeoutMs);

          sock.onopen = () => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            finish(true, sock, u);
          };
          sock.onerror = () => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            try { sock.close(); } catch (_) {}
            tryNext();
          };
          sock.onclose = () => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            tryNext();
          };
        };
        tryNext();
      });
    },

    bindSocket(sock) {
      sock.onmessage = (ev) => {
        let msg;
        try { msg = JSON.parse(ev.data); } catch (_) { return; }
        if (!msg || typeof msg !== 'object') return;

        switch (msg.op) {
          case 'open': {
            for (const [id, p] of this.peers) {
              if (id === msg.id || p._pendingId === msg.id) {
                p._onServerOpen(msg.id);
                return;
              }
            }
            break;
          }
          case 'error': {
            if (msg.type === 'unavailable-id') {
              for (const p of this.peers.values()) {
                if (!p.open) {
                  p._onServerError({ type: 'unavailable-id', message: msg.message });
                  return;
                }
              }
            } else if (msg.type === 'peer-unavailable') {
              for (const p of this.peers.values()) {
                p._onPeerUnavailable(msg.dst, msg.cid);
              }
            }
            break;
          }
          case 'conn_open': {
            // 방장(또는 수신 피어)이 게스트의 가상 DataConnection 요청을 받음
            for (const p of this.peers.values()) {
              if (p.open && !p.destroyed) {
                p._onIncomingConn(msg.peer, msg.cid, msg.meta);
              }
            }
            break;
          }
          case 'conn_ack': {
            // 게스트가 연결 승인 응답을 받음
            for (const p of this.peers.values()) {
              p._onConnAck(msg.peer, msg.cid);
            }
            break;
          }
          case 'data': {
            for (const p of this.peers.values()) {
              if (p.id !== msg.src) {
                p._onIncomingData(msg.src, msg.cid, msg.d);
              }
            }
            break;
          }
          case 'close': {
            for (const p of this.peers.values()) {
              p._onRemoteClose(msg.peer, msg.cid);
            }
            break;
          }
          case 'quick_match_res': {
            const cb = this.pendingQuick.get(msg.reqId);
            if (cb) {
              this.pendingQuick.delete(msg.reqId);
              cb(msg);
            }
            break;
          }
        }
      };

      sock.onclose = () => {
        if (this.ws === sock) {
          this.ws = null;
          this.state = 'idle';
          for (const p of this.peers.values()) {
            p._onSocketDisconnected();
          }
        }
      };
    },

    send(obj) {
      if (this.ws && this.ws.readyState === 1) {
        try {
          this.ws.send(JSON.stringify(obj));
          return true;
        } catch (_) {}
      }
      return false;
    }
  };

  // ==========================================================================
  // 전용 서버용 가상 DataConnection & WSRelayPeer (1:N 브로드캐스트 자동 병합)
  // ==========================================================================
  class WSDataConnection extends Emitter {
    constructor(localPeer, remotePeerId, cid, metadata) {
      super();
      this._localPeer = localPeer;
      this.peer = remotePeerId;
      this.connectionId = cid || ('c_' + Math.random().toString(36).slice(2, 10));
      this.metadata = metadata || {};
      this.open = false;
      this.reliable = true;
      this.serialization = 'json';
      this._rxQueue = [];
    }

    on(ev, fn) {
      super.on(ev, fn);
      if (ev === 'open' && this.open) {
        queueMicrotask(() => { if (this.open) fn(); });
      } else if (ev === 'data' && this._rxQueue.length) {
        const q = this._rxQueue.splice(0, this._rxQueue.length);
        queueMicrotask(() => {
          for (const d of q) {
            try { fn(d); } catch (e) { console.error(e); }
          }
        });
      }
      return this;
    }

    _handleData(data) {
      const handlers = this._evs['data'];
      if (handlers && handlers.length) {
        this.emit('data', data);
      } else {
        if (this._rxQueue.length < 64) this._rxQueue.push(data);
      }
    }

    send(data) {
      if (!this.open || !this._localPeer || this._localPeer.destroyed) return;
      this._localPeer._queueSend(this.peer, this.connectionId, data);
    }

    close() {
      if (!this.open) return;
      this.open = false;
      WSManager.send({ op: 'close_conn', dst: this.peer, cid: this.connectionId });
      this.emit('close');
    }
  }

  class WSRelayPeer extends Emitter {
    constructor(id, opts) {
      super();
      this.id = id || ('u_' + Math.random().toString(36).slice(2, 10));
      this._pendingId = this.id;
      this.options = opts || {};
      this.open = false;
      this.destroyed = false;
      this.disconnected = false;
      this.isDedicatedServer = true;
      this._conns = new Map(); // remotePeerId -> WSDataConnection
      this._batchMap = new Map(); // msgRef -> Set<remotePeerId>
      this._batchScheduled = false;

      WSManager.peers.set(this.id, this);
      WSManager.send({ op: 'open', id: this.id });
    }

    _onServerOpen(assignedId) {
      if (this.destroyed) return;
      if (assignedId && assignedId !== this.id) {
        WSManager.peers.delete(this.id);
        this.id = assignedId;
        WSManager.peers.set(this.id, this);
      }
      this.open = true;
      this.disconnected = false;
      this.emit('open', this.id);
    }

    _onServerError(errObj) {
      if (this.destroyed) return;
      this.emit('error', errObj);
    }

    _onPeerUnavailable(dstId, cid) {
      if (this.destroyed) return;
      const c = this._conns.get(dstId);
      if (c) {
        this._conns.delete(dstId);
        c.open = false;
      }
      this.emit('error', { type: 'peer-unavailable', message: `Could not connect to peer ${dstId}` });
    }

    connect(targetId, opts) {
      opts = opts || {};
      const cid = 'c_' + Math.random().toString(36).slice(2, 10);
      const conn = new WSDataConnection(this, targetId, cid, opts.metadata);
      this._conns.set(targetId, conn);
      WSManager.send({ op: 'connect', dst: targetId, cid, meta: opts.metadata || {} });
      return conn;
    }

    _onIncomingConn(remotePeerId, cid, meta) {
      if (this.destroyed) return;
      let conn = this._conns.get(remotePeerId);
      if (!conn) {
        conn = new WSDataConnection(this, remotePeerId, cid, meta);
        this._conns.set(remotePeerId, conn);
      }
      // 먼저 'connection' 이벤트를 발생시켜 호스트가 conn.on('open')과 conn.on('data')를 바인딩하게 함
      this.emit('connection', conn);
      queueMicrotask(() => {
        if (!this.destroyed && !conn.open) {
          conn.open = true;
          conn.emit('open');
        }
      });
    }

    _onConnAck(remotePeerId, cid) {
      if (this.destroyed) return;
      const conn = this._conns.get(remotePeerId);
      if (!conn) return;
      // 호스트의 'connection' 핸들러가 먼저 준비되도록 짧은 틱 후 게스트 'open' 발생
      setTimeout(() => {
        if (!this.destroyed && !conn.open) {
          conn.open = true;
          conn.emit('open');
        }
      }, 4);
    }

    _onIncomingData(remotePeerId, cid, payload) {
      if (this.destroyed) return;
      let conn = this._conns.get(remotePeerId);
      if (!conn) {
        // 호스트가 아직 커넥션 객체를 등록하기 직전에 데이터가 도착한 경우 자동 생성
        conn = new WSDataConnection(this, remotePeerId, cid, {});
        this._conns.set(remotePeerId, conn);
        this.emit('connection', conn);
        conn.open = true;
        conn.emit('open');
      }
      conn._handleData(payload);
    }

    _onRemoteClose(remotePeerId) {
      const conn = this._conns.get(remotePeerId);
      if (conn) {
        this._conns.delete(remotePeerId);
        if (conn.open) {
          conn.open = false;
          conn.emit('close');
        }
      }
    }

    _onSocketDisconnected() {
      if (this.destroyed) return;
      this.disconnected = true;
      this.emit('disconnected');
    }

    // 1:N 브로드캐스트 자동 병합: 같은 틱에 여러 게스트에게 동일 객체 전송 시 서버로 1번만 `bcast` 전송
    _queueSend(dstPeerId, cid, data) {
      const volatile = isVolatileMessage(data);
      if (data && typeof data === 'object' && this._conns.size >= 2) {
        let entry = this._batchMap.get(data);
        if (!entry) {
          entry = { dsts: [], cid, volatile };
          this._batchMap.set(data, entry);
        }
        if (!entry.dsts.includes(dstPeerId)) entry.dsts.push(dstPeerId);
        if (!this._batchScheduled) {
          this._batchScheduled = true;
          queueMicrotask(() => this._flushBatch());
        }
        return;
      }
      WSManager.send({ op: 'data', dst: dstPeerId, cid, d: data, v: volatile ? 1 : 0 });
    }

    _flushBatch() {
      this._batchScheduled = false;
      if (this.destroyed) {
        this._batchMap.clear();
        return;
      }
      for (const [data, entry] of this._batchMap.entries()) {
        if (entry.dsts.length === 1) {
          WSManager.send({ op: 'data', dst: entry.dsts[0], cid: entry.cid, d: data, v: entry.volatile ? 1 : 0 });
        } else if (entry.dsts.length > 1) {
          WSManager.send({ op: 'bcast', dsts: entry.dsts, d: data, v: entry.volatile ? 1 : 0 });
        }
      }
      this._batchMap.clear();
    }

    reconnect() {
      if (this.destroyed) return;
      WSManager.ensureConnected(1000).then(ok => {
        if (ok && !this.destroyed) {
          WSManager.send({ op: 'open', id: this.id });
        }
      });
    }

    destroy() {
      if (this.destroyed) return;
      this.destroyed = true;
      this.open = false;
      for (const conn of this._conns.values()) {
        if (conn.open) {
          conn.open = false;
          WSManager.send({ op: 'close_conn', dst: conn.peer, cid: conn.connectionId });
          conn.emit('close');
        }
      }
      this._conns.clear();
      WSManager.peers.delete(this.id);
      WSManager.send({ op: 'destroy', id: this.id });
      this.emit('close');
    }
  }

  // ==========================================================================
  // P2P 폴백 래퍼: STUN/TURN 자동 주입 + Dual DataChannel (Reliable + Unreliable UDP)
  // ==========================================================================
  function enhanceP2POptions(opts) {
    const o = Object.assign({ debug: 0 }, opts || {});
    o.config = Object.assign({}, o.config || {});
    if (!Array.isArray(o.config.iceServers) || !o.config.iceServers.length) {
      o.config.iceServers = DEFAULT_ICE_SERVERS;
    }
    return o;
  }

  function wrapP2PConnection(rawPeer, mainConn, isInitiator) {
    if (!mainConn || mainConn.__bioWrapped) return mainConn;
    mainConn.__bioWrapped = true;

    let fastConn = null;
    let txSeq = 0;
    let rxMaxSeq = 0;

    const attachFastChannel = (fc) => {
      if (!fc || fastConn === fc) return;
      fastConn = fc;
      fc.__isFastChannel = true;
      fc.on('data', (pkt) => {
        if (pkt && typeof pkt === 'object' && pkt.__uSeq) {
          // 이전 순번의 뒤늦은 UDP 패킷은 무시하여 위치 역행 방지
          if (pkt.__uSeq < rxMaxSeq && rxMaxSeq - pkt.__uSeq < 10000) return;
          rxMaxSeq = pkt.__uSeq;
          mainConn.emit('data', pkt.d);
        } else {
          mainConn.emit('data', pkt);
        }
      });
      fc.on('error', () => {});
    };

    if (isInitiator && rawPeer && !rawPeer.destroyed) {
      mainConn.on('open', () => {
        try {
          const fc = rawPeer.connect(mainConn.peer, {
            label: '__bio_fast_udp',
            reliable: false,
            maxRetransmits: 0,
            serialization: 'json',
            metadata: { __fastFor: mainConn.peer }
          });
          if (fc) attachFastChannel(fc);
        } catch (_) {}
      });
    }

    mainConn._attachFast = attachFastChannel;

    const origSend = mainConn.send.bind(mainConn);
    mainConn.send = function (data) {
      if (fastConn && fastConn.open && isVolatileMessage(data)) {
        try {
          fastConn.send({ __uSeq: ++txSeq, d: data });
          return;
        } catch (_) {}
      }
      return origSend(data);
    };

    const origClose = mainConn.close.bind(mainConn);
    mainConn.close = function () {
      if (fastConn) {
        try { fastConn.close(); } catch (_) {}
        fastConn = null;
      }
      return origClose();
    };

    return mainConn;
  }

  function createEnhancedRawPeer(id, opts) {
    const cleanOpts = enhanceP2POptions(opts);
    const p = id ? new RawPeer(id, cleanOpts) : new RawPeer(cleanOpts);
    const mainConnsByPeer = new Map();

    // 수신 측에서 보조 UDP 채널(__bio_fast_udp)이 들어오면 게임 로직에 노출하지 않고 메인 채널에 결합
    const origEmit = p.emit.bind(p);
    p.emit = function (ev, ...args) {
      if (ev === 'connection' && args[0]) {
        const c = args[0];
        if (c.label === '__bio_fast_udp' || (c.metadata && c.metadata.__fastFor)) {
          const main = mainConnsByPeer.get(c.peer);
          if (main && main._attachFast) {
            main._attachFast(c);
          } else {
            p._pendingFast = p._pendingFast || new Map();
            p._pendingFast.set(c.peer, c);
          }
          return false;
        }
        wrapP2PConnection(p, c, false);
        mainConnsByPeer.set(c.peer, c);
        if (p._pendingFast && p._pendingFast.has(c.peer)) {
          c._attachFast(p._pendingFast.get(c.peer));
          p._pendingFast.delete(c.peer);
        }
      }
      return origEmit(ev, ...args);
    };

    const origConnect = p.connect.bind(p);
    p.connect = function (target, cOpts) {
      const c = origConnect(target, cOpts);
      wrapP2PConnection(p, c, true);
      mainConnsByPeer.set(target, c);
      return c;
    };

    return p;
  }

  // ==========================================================================
  // 통합 하이브리드 Peer 클래스 (uWebSockets.js 전용 서버 우선 -> P2P 자동 폴백)
  // ==========================================================================
  class BioHybridPeer extends Emitter {
    constructor(a, b) {
      super();
      let id = null, opts = {};
      if (typeof a === 'string') {
        id = a;
        opts = b || {};
      } else if (a && typeof a === 'object') {
        opts = a;
      }
      this.id = id;
      this.options = opts;
      this.open = false;
      this.destroyed = false;
      this.disconnected = false;
      this._impl = null;
      this._mode = 'init'; // 'ws' | 'p2p'

      const hasExplicitPeerServer = !!(opts && opts.host);
      if (hasExplicitPeerServer) {
        this._initP2P(id, opts);
      } else {
        WSManager.ensureConnected(700).then((wsOk) => {
          if (this.destroyed) return;
          if (wsOk) {
            this._initWS(id, opts);
          } else {
            this._initP2P(id, opts);
          }
        });
      }
    }

    _bindImpl(impl, mode) {
      this._impl = impl;
      this._mode = mode;
      global.BIO_RT.lastMode = mode;

      impl.on('open', (assignedId) => {
        this.id = assignedId;
        this.open = true;
        this.disconnected = false;
        this.emit('open', assignedId);
      });
      impl.on('connection', (conn) => {
        this.emit('connection', conn);
      });
      impl.on('error', (err) => {
        this.emit('error', err);
      });
      impl.on('disconnected', () => {
        this.disconnected = true;
        this.emit('disconnected');
      });
      impl.on('close', () => {
        this.open = false;
        this.emit('close');
      });
    }

    _initWS(id, opts) {
      const wsPeer = new WSRelayPeer(id, opts);
      this._bindImpl(wsPeer, 'ws');
    }

    _initP2P(id, opts) {
      if (!RawPeer) {
        queueMicrotask(() => this.emit('error', { type: 'browser-incompatible' }));
        return;
      }
      try {
        const p2pPeer = createEnhancedRawPeer(id, opts);
        this._bindImpl(p2pPeer, 'p2p');
      } catch (e) {
        queueMicrotask(() => this.emit('error', e));
      }
    }

    connect(target, opts) {
      if (this._impl) {
        return this._impl.connect(target, opts);
      }
      // 아직 초기화 중인 경우 임시 프록시 커넥션 반환
      const proxy = new WSDataConnection(null, target, null, opts && opts.metadata);
      this.on('open', () => {
        if (this.destroyed || !this._impl) return;
        const real = this._impl.connect(target, opts);
        real.on('open', () => { proxy.open = true; proxy.emit('open'); });
        real.on('data', (d) => proxy._handleData(d));
        real.on('close', () => { proxy.open = false; proxy.emit('close'); });
        real.on('error', (e) => proxy.emit('error', e));
        proxy.send = (d) => real.send(d);
        proxy.close = () => real.close();
      });
      return proxy;
    }

    reconnect() {
      if (this._impl && typeof this._impl.reconnect === 'function') {
        this._impl.reconnect();
      }
    }

    destroy() {
      if (this.destroyed) return;
      this.destroyed = true;
      this.open = false;
      if (this._impl) {
        try { this._impl.destroy(); } catch (_) {}
      }
    }
  }

  // ==========================================================================
  // Web Worker 백그라운드 타이머 (방장 탭 비활성화 시에도 25Hz 틱 유지)
  // ==========================================================================
  const bgCallbacks = new Set();
  let bgWorker = null;

  function initBgWorker() {
    if (bgWorker) return;
    try {
      const blob = new Blob([
        'let t=null;onmessage=e=>{if(e.data==="start"){if(!t)t=setInterval(()=>postMessage(1),40);}else{clearInterval(t);t=null;}};'
      ], { type: 'application/javascript' });
      bgWorker = new Worker(URL.createObjectURL(blob));
      bgWorker.onmessage = () => {
        if (!document.hidden) return;
        for (const fn of bgCallbacks) {
          try { fn(0.04); } catch (_) {}
        }
      };
      document.addEventListener('visibilitychange', () => {
        bgWorker.postMessage(document.hidden ? 'start' : 'stop');
      });
      if (document.hidden) bgWorker.postMessage('start');
    } catch (_) {
      // Worker 생성 불가 환경에서는 일반 setInterval 폴백
      setInterval(() => {
        if (!document.hidden) return;
        for (const fn of bgCallbacks) {
          try { fn(0.05); } catch (_) {}
        }
      }, 50);
    }
  }

  // ==========================================================================
  // BIO_RT 전역 API (초고속 서버 매칭 + P2P 병렬 매칭 + 서버 주소 설정)
  // ==========================================================================
  global.BIO_RT = {
    lastMode: 'auto',
    get isDedicatedServer() {
      return WSManager.state === 'connected' && !!WSManager.ws && WSManager.ws.readyState === 1;
    },
    get serverUrl() {
      return WSManager.url || '';
    },
    setServerUrl(url) {
      try {
        if (url) global.localStorage.setItem('biogame_ws_url', url.trim());
        else global.localStorage.removeItem('biogame_ws_url');
      } catch (_) {}
      if (WSManager.ws) {
        try { WSManager.ws.close(); } catch (_) {}
      }
      WSManager.state = 'idle';
      WSManager.lastFailAt = 0;
      return WSManager.ensureConnected(1200);
    },
    onBackgroundTick(fn) {
      initBgWorker();
      bgCallbacks.add(fn);
      return () => bgCallbacks.delete(fn);
    },

    /**
     * 빠른 매칭 탐색:
     * 1) 전용 실시간 서버(uWebSockets.js) 연결 시 0.1초 이내에 열린 방(또는 새 방 코드) 반환
     * 2) P2P 폴백 시 후보 방 코드들(candidateCodes)을 직렬이 아닌 병렬로 동시 탐색(2초 타임아웃)
     */
    async quickMatch(prefix, candidateCodes = ['QM1', 'QM2', 'QM3', 'QM4'], maxPlayers = 8) {
      const wsOk = await WSManager.ensureConnected(700);
      if (wsOk) {
        const reqId = 'qm_' + Math.random().toString(36).slice(2, 9);
        const res = await new Promise((resolve) => {
          const timer = setTimeout(() => {
            WSManager.pendingQuick.delete(reqId);
            resolve(null);
          }, 1500);
          WSManager.pendingQuick.set(reqId, (data) => {
            clearTimeout(timer);
            resolve(data);
          });
          WSManager.send({ op: 'quick_match', reqId, prefix, max: maxPlayers });
        });
        if (res && res.code) {
          return { action: res.action, code: res.code, mode: 'ws' };
        }
      }

      // P2P 폴백: 후보 방 코드들을 병렬로 프로빙하여 가장 먼저 열리는 방 반환
      if (!RawPeer) return { action: 'create', code: candidateCodes[0] || 'QM1', mode: 'p2p' };
      return new Promise((resolve) => {
        let tempPeer;
        try {
          tempPeer = createEnhancedRawPeer(null, {});
        } catch (_) {
          resolve({ action: 'create', code: candidateCodes[0] || 'QM1', mode: 'p2p' });
          return;
        }
        let settled = false;
        const unavailableSet = new Set();
        const conns = [];

        const finish = (result) => {
          if (settled) return;
          settled = true;
          clearTimeout(overallTimer);
          conns.forEach(c => { try { c.close(); } catch (_) {} });
          setTimeout(() => { try { tempPeer.destroy(); } catch (_) {} }, 80);
          resolve(result);
        };

        const overallTimer = setTimeout(() => {
          const freeCode = candidateCodes.find(c => unavailableSet.has(c)) || candidateCodes[0] || 'QM1';
          finish({ action: 'create', code: freeCode, mode: 'p2p' });
        }, 2000);

        tempPeer.on('open', () => {
          tempPeer.on('error', (err) => {
            if (err && err.type === 'peer-unavailable') {
              const msg = String(err.message || '');
              for (const c of candidateCodes) {
                if (msg.includes(prefix + c)) unavailableSet.add(c);
              }
              if (unavailableSet.size >= candidateCodes.length) {
                finish({ action: 'create', code: candidateCodes[0], mode: 'p2p' });
              }
            }
          });

          for (const code of candidateCodes) {
            try {
              const conn = tempPeer.connect(prefix + code, { reliable: true });
              conns.push(conn);
              conn.on('open', () => {
                finish({ action: 'join', code, mode: 'p2p' });
              });
            } catch (_) {
              unavailableSet.add(code);
            }
          }
        });

        tempPeer.on('error', (err) => {
          if (!tempPeer.open) {
            finish({ action: 'create', code: candidateCodes[0] || 'QM1', mode: 'p2p' });
          }
        });
      });
    }
  };

  // 페이지 로드 시 백그라운드로 전용 실시간 서버 연결 미리 준비
  WSManager.ensureConnected(800);

  // 전역 Peer를 하이브리드 클래스로 교체
  global.Peer = BioHybridPeer;
})(typeof window !== 'undefined' ? window : globalThis);
