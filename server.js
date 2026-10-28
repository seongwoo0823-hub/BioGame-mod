#!/usr/bin/env node
/**
 * BIO ARCADE — 초저지연 통합 실시간 매칭 & 릴레이 서버 (server.js)
 * 지원 게임: BIO BEAT (biobeat), 바이오 카트 (biokart), 셀 브롤 (cellbrawl), 혈관 협곡 (biocanyon)
 *
 * [특징]
 * 1. uWebSockets.js (C++ 네이티브 코어) 우선 구동 + 미설치 환경에서는 외부 패키지 없이
 *    Node.js 내장(http + net + crypto, TCP_NODELAY 적용) RFC 6455 WebSocket 엔진으로 자동 폴백!
 *    → `node server.js` 한 줄로 즉시 실행 가능하며, `npm run install-uws` 설치 시 uWebSockets.js로 동작합니다.
 * 2. 1:N 브로드캐스트 팬아웃(Fan-out): 방장이 `state`/`board` 패킷을 서버로 1번만 전송하면
 *    서버가 방 안의 모든 게스트에게 초저지연 복제 전송합니다 (방장 업로드 대역폭 1/N 절감).
 * 3. 백프레셔(Backpressure) 자동 드롭: 특정 게스트의 네트워크가 일시적으로 밀려 송신 버퍼가
 *    임계치(16KB)를 넘으면 최신이 아닌 `volatile`(`state`/`input`/`live`) 패킷을 즉시 건너뛰어
 *    Head-of-Line Blocking(화면 멈춤 후 배속 순간이동 현상)을 원천 차단합니다.
 * 4. 0.1초 즉시 빠른 매칭(Quick Match): 서버 메모리에서 대기 중인 방을 즉시 탐색·배정합니다.
 * 5. 정적 파일 서빙 내장: 별도 웹 서버 없이 `http://localhost:9001` 접속 시 게임 9종이 바로 실행됩니다.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');

const PORT = +(process.env.PORT || 9001);
const HOST = process.env.HOST || '0.0.0.0';
const ROOT_DIR = __dirname;
const MAX_BACKPRESSURE = 16 * 1024; // 16KB 이상 밀린 소켓은 volatile 스냅샷 드롭
const PEER_IDLE_MS = 45000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// ============================================================================
// 인메모리 피어 & 룸 레지스트리
// ============================================================================
const peers = new Map();
const rooms = new Map();

const GAME_PREFIXES = [
  { prefix: 'biobeat-v1-', game: 'biobeat', maxPlayers: 4 },
  { prefix: 'biokart-p2p-v1-', game: 'biokart', maxPlayers: 8 },
  { prefix: 'cellbrawl-v2-', game: 'cellbrawl', maxPlayers: 6 },
  { prefix: 'biocanyon-room-', game: 'biocanyon', maxPlayers: 10 }
];

function parsePeerId(peerId) {
  const s = String(peerId || '');
  for (const g of GAME_PREFIXES) {
    if (s.startsWith(g.prefix)) {
      const code = s.slice(g.prefix.length).toUpperCase();
      if (code && code !== 'LOBBY') {
        return { isHostId: true, prefix: g.prefix, game: g.game, code, maxPlayers: g.maxPlayers };
      }
    }
  }
  return { isHostId: false, prefix: '', game: '', code: '', maxPlayers: 8 };
}

function genRoomCode(prefix) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let k = 0; k < 50; k++) {
    let c = '';
    for (let i = 0; i < 4; i++) c += chars[(Math.random() * chars.length) | 0];
    if (!peers.has(prefix + c) && !rooms.has(prefix + c)) return c;
  }
  return 'R' + ((100 + Math.random() * 899) | 0);
}

function isVolatilePayload(data) {
  if (!data || typeof data !== 'object') return false;
  const t = data.type;
  return t === 'state' || t === 'input' || t === 'live' || t === 'board' || t === 'ping' || t === 'pong' ||
    (t === 'cmd' && data.cmd && (data.cmd.k === 'move' || data.cmd.k === 'ping'));
}

function sendJson(session, obj, volatile = false) {
  if (!session || !session.isOpen()) return false;
  if (volatile && session.getBufferedAmount() > MAX_BACKPRESSURE) {
    session.dropped = (session.dropped || 0) + 1;
    return false;
  }
  try {
    session.sendText(JSON.stringify(obj));
    return true;
  } catch (_) {
    return false;
  }
}

function unregisterPeer(session) {
  if (!session || !session.peerId) return;
  const pid = session.peerId;
  if (peers.get(pid) === session) {
    peers.delete(pid);
  }
  const room = rooms.get(pid);
  if (room && room.host === session) {
    rooms.delete(pid);
    for (const guestId of room.guests) {
      const g = peers.get(guestId);
      if (g) {
        g.joinedRoomKey = null;
        sendJson(g, { op: 'close', peer: pid });
      }
    }
  }
  if (session.joinedRoomKey) {
    const r = rooms.get(session.joinedRoomKey);
    session.joinedRoomKey = null;
    if (r) {
      r.guests.delete(pid);
      if (r.host && r.host.isOpen()) {
        sendJson(r.host, { op: 'close', peer: pid });
      }
    }
  }
  if (session.links && session.links.size) {
    for (const targetId of session.links) {
      const t = peers.get(targetId);
      if (t && t.isOpen()) {
        if (t.links) t.links.delete(pid);
        sendJson(t, { op: 'close', peer: pid });
      }
    }
    session.links.clear();
  }
  session.peerId = null;
}

function updateRoomMetaFromPayload(room, payload) {
  if (!room || !payload || typeof payload !== 'object') return;
  if (payload.type === 'start' || payload.type === 'match_start') {
    room.inGame = true;
  } else if (payload.type === 'room' || payload.type === 'room_state') {
    if (typeof payload.inGame === 'boolean') room.inGame = payload.inGame;
    if (Array.isArray(payload.players)) room.playerCount = payload.players.length;
    else if (payload.players && typeof payload.players === 'object') room.playerCount = Object.keys(payload.players).length;
  } else if (payload.type === 'lobby') {
    room.inGame = false;
    if (Array.isArray(payload.humans)) room.playerCount = payload.humans.length;
  }
}

function handleClientMessage(session, rawText) {
  session.lastSeen = Date.now();
  let msg;
  try {
    msg = JSON.parse(rawText);
  } catch (_) {
    return;
  }
  if (!msg || typeof msg !== 'object') return;

  switch (msg.op) {
    case 'open': {
      const reqId = String(msg.id || '').trim() || ('p_' + crypto.randomBytes(4).toString('hex'));
      const existing = peers.get(reqId);
      if (existing && existing !== session && existing.isOpen()) {
        sendJson(session, { op: 'error', type: 'unavailable-id', message: `ID ${reqId} is taken` });
        return;
      }
      if (session.peerId && session.peerId !== reqId) {
        unregisterPeer(session);
      }
      session.peerId = reqId;
      session.links = session.links || new Set();
      peers.set(reqId, session);

      const info = parsePeerId(reqId);
      if (info.isHostId) {
        rooms.set(reqId, {
          key: reqId,
          prefix: info.prefix,
          game: info.game,
          code: info.code,
          host: session,
          guests: new Set(),
          maxPlayers: info.maxPlayers,
          inGame: false,
          isPublic: true,
          createdAt: Date.now()
        });
      }
      sendJson(session, { op: 'open', id: reqId });
      break;
    }

    case 'destroy': {
      if (!msg.id || session.peerId === msg.id) {
        unregisterPeer(session);
      }
      break;
    }

    case 'connect': {
      const targetId = String(msg.dst || '').trim();
      const connId = String(msg.cid || '');
      const target = peers.get(targetId);
      if (!target || !target.isOpen()) {
        sendJson(session, { op: 'error', type: 'peer-unavailable', message: `Could not connect to peer ${targetId}`, dst: targetId, cid: connId });
        return;
      }
      session.links = session.links || new Set();
      target.links = target.links || new Set();
      session.links.add(targetId);
      target.links.add(session.peerId);

      const room = rooms.get(targetId);
      if (room) {
        room.guests.add(session.peerId);
        session.joinedRoomKey = targetId;
      }

      sendJson(target, { op: 'conn_open', peer: session.peerId, cid: connId, meta: msg.meta || {} });
      sendJson(session, { op: 'conn_ack', peer: targetId, cid: connId });
      break;
    }

    case 'data': {
      const targetId = String(msg.dst || '');
      const target = peers.get(targetId);
      if (!target || !target.isOpen()) return;
      const payload = msg.d;
      const volatile = !!msg.v || isVolatilePayload(payload);

      updateRoomMetaFromPayload(rooms.get(session.peerId), payload);
      sendJson(target, { op: 'data', src: session.peerId, cid: msg.cid, d: payload }, volatile);
      break;
    }

    case 'bcast': {
      const payload = msg.d;
      const volatile = !!msg.v || isVolatilePayload(payload);
      const room = rooms.get(session.peerId);
      updateRoomMetaFromPayload(room, payload);

      const targets = Array.isArray(msg.dsts)
        ? msg.dsts
        : (room ? [...room.guests] : [...(session.links || [])]);

      if (!targets.length) break;
      const outStr = JSON.stringify({ op: 'data', src: session.peerId, d: payload });
      for (const dstId of targets) {
        const guest = peers.get(dstId);
        if (!guest || !guest.isOpen()) continue;
        if (volatile && guest.getBufferedAmount() > MAX_BACKPRESSURE) {
          guest.dropped = (guest.dropped || 0) + 1;
          continue;
        }
        try { guest.sendText(outStr); } catch (_) {}
      }
      break;
    }

    case 'quick_match': {
      const prefix = String(msg.prefix || '');
      const maxP = +(msg.max || 8);
      let foundRoom = null;

      for (const r of rooms.values()) {
        if (r.prefix !== prefix) continue;
        if (!r.host || !r.host.isOpen()) continue;
        if (r.host === session) continue;
        if (r.inGame) continue;
        const curCount = r.playerCount || (1 + r.guests.size);
        if (curCount < (r.maxPlayers || maxP)) {
          foundRoom = r;
          break;
        }
      }

      if (foundRoom) {
        sendJson(session, {
          op: 'quick_match_res',
          reqId: msg.reqId,
          action: 'join',
          code: foundRoom.code,
          hostPeerId: foundRoom.key
        });
      } else {
        const newCode = genRoomCode(prefix);
        sendJson(session, {
          op: 'quick_match_res',
          reqId: msg.reqId,
          action: 'create',
          code: newCode,
          hostPeerId: prefix + newCode
        });
      }
      break;
    }

    case 'close_conn': {
      const target = peers.get(String(msg.dst || ''));
      if (target && target.isOpen()) {
        sendJson(target, { op: 'close', peer: session.peerId, cid: msg.cid });
      }
      break;
    }

    case 'hb': {
      sendJson(session, { op: 'hb_ack', t: msg.t });
      break;
    }
  }
}

setInterval(() => {
  const now = Date.now();
  for (const s of peers.values()) {
    if (!s.isOpen() || now - (s.lastSeen || now) > PEER_IDLE_MS * 2) {
      unregisterPeer(s);
    }
  }
}, 15000).unref();

function getStatusSummary() {
  const activeRooms = [];
  for (const r of rooms.values()) {
    if (r.host && r.host.isOpen()) {
      activeRooms.push({
        game: r.game,
        code: r.code,
        players: r.playerCount || (1 + r.guests.size),
        maxPlayers: r.maxPlayers,
        inGame: !!r.inGame
      });
    }
  }
  return {
    ok: true,
    engine: activeEngineName,
    peers: peers.size,
    rooms: activeRooms
  };
}

function resolveStaticFile(urlPath) {
  let clean = decodeURIComponent(String(urlPath || '/').split('?')[0]);
  if (clean === '/' || clean === '') clean = '/index.html';
  const fullPath = path.normalize(path.join(ROOT_DIR, clean));
  if (!fullPath.startsWith(ROOT_DIR)) return null;
  try {
    const st = fs.statSync(fullPath);
    if (st.isFile()) return fullPath;
  } catch (_) {}
  return null;
}

// ============================================================================
// 엔진 1: uWebSockets.js (설치되어 있을 때 최우선 구동)
// ============================================================================
let activeEngineName = 'node-native-ws';

function startWithUWS(uWS) {
  activeEngineName = 'uWebSockets.js';
  const app = uWS.App();

  app.ws('/*', {
    compression: uWS.DISABLED,
    maxPayloadLength: 256 * 1024,
    idleTimeout: 60,
    open: (ws) => {
      ws.session = {
        peerId: null,
        links: new Set(),
        joinedRoomKey: null,
        lastSeen: Date.now(),
        closed: false,
        isOpen: () => !ws.session.closed,
        getBufferedAmount: () => ws.getBufferedAmount(),
        sendText: (txt) => ws.send(txt, false, false)
      };
    },
    message: (ws, message) => {
      if (!ws.session) return;
      const text = Buffer.from(message).toString('utf8');
      handleClientMessage(ws.session, text);
    },
    close: (ws) => {
      if (ws.session) {
        ws.session.closed = true;
        unregisterPeer(ws.session);
      }
    }
  });

  app.get('/api/status', (res) => {
    const body = JSON.stringify(getStatusSummary());
    res.writeHeader('Content-Type', 'application/json; charset=utf-8');
    res.writeHeader('Access-Control-Allow-Origin', '*');
    res.end(body);
  });

  app.get('/*', (res, req) => {
    const filePath = resolveStaticFile(req.getUrl());
    if (!filePath) {
      res.writeStatus('404 Not Found').end('Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream');
    res.writeHeader('Cache-Control', 'no-cache');
    res.end(fs.readFileSync(filePath));
  });

  app.listen(HOST, PORT, (token) => {
    if (token) {
      console.log(`[BIO ARCADE Server] ⚡ uWebSockets.js 엔진 가동 중!`);
      console.log(`  - 게임 접속 주소 : http://localhost:${PORT}`);
      console.log(`  - WebSocket 주소 : ws://localhost:${PORT}/ws`);
    } else {
      console.error(`[BIO ARCADE Server] 포트 ${PORT} 바인딩 실패`);
      process.exit(1);
    }
  });
}

// ============================================================================
// 엔진 2: 무의존성 Node.js 내장 RFC 6455 WebSocket + HTTP 서버 (폴백)
// ============================================================================
function encodeWsFrame(str) {
  const payload = Buffer.from(str, 'utf8');
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.allocUnsafe(2);
    header[0] = 0x81;
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.allocUnsafe(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.allocUnsafe(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}

function startWithNativeNode() {
  activeEngineName = 'node-native-ws (TCP_NODELAY)';

  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.url.startsWith('/api/status')) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(getStatusSummary()));
      return;
    }
    const filePath = resolveStaticFile(req.url);
    if (!filePath) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    fs.createReadStream(filePath).pipe(res);
  });

  server.on('upgrade', (req, socket) => {
    const key = req.headers['sec-websocket-key'];
    if (!key) {
      socket.destroy();
      return;
    }
    socket.setNoDelay(true);
    socket.setKeepAlive(true, 15000);

    const accept = crypto
      .createHash('sha1')
      .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
      .digest('base64');

    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
    );

    const session = {
      peerId: null,
      links: new Set(),
      joinedRoomKey: null,
      lastSeen: Date.now(),
      closed: false,
      isOpen: () => !session.closed && !socket.destroyed && socket.writable,
      getBufferedAmount: () => socket.writableLength || 0,
      sendText: (txt) => {
        if (!session.closed && socket.writable) {
          socket.write(encodeWsFrame(txt));
        }
      }
    };

    let buf = Buffer.alloc(0);

    socket.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      while (buf.length >= 2) {
        const firstByte = buf[0];
        const opcode = firstByte & 0x0f;
        const secondByte = buf[1];
        const isMasked = (secondByte & 0x80) !== 0;
        let payloadLen = secondByte & 0x7f;
        let offset = 2;

        if (payloadLen === 126) {
          if (buf.length < 4) return;
          payloadLen = buf.readUInt16BE(2);
          offset = 4;
        } else if (payloadLen === 127) {
          if (buf.length < 10) return;
          payloadLen = Number(buf.readBigUInt64BE(2));
          offset = 10;
        }

        const maskLen = isMasked ? 4 : 0;
        const totalFrameLen = offset + maskLen + payloadLen;
        if (buf.length < totalFrameLen) return;

        if (opcode === 0x08) {
          session.closed = true;
          unregisterPeer(session);
          socket.end();
          return;
        } else if (opcode === 0x09) {
          const pong = Buffer.from([0x8a, 0x00]);
          if (socket.writable) socket.write(pong);
        } else if (opcode === 0x01 || opcode === 0x02) {
          const payload = buf.subarray(offset + maskLen, totalFrameLen);
          if (isMasked) {
            const mask = buf.subarray(offset, offset + 4);
            for (let i = 0; i < payload.length; i++) {
              payload[i] ^= mask[i & 3];
            }
          }
          handleClientMessage(session, payload.toString('utf8'));
        }
        buf = buf.subarray(totalFrameLen);
      }
    });

    const onDisconnect = () => {
      if (!session.closed) {
        session.closed = true;
        unregisterPeer(session);
      }
    };
    socket.on('close', onDisconnect);
    socket.on('error', onDisconnect);
    socket.on('end', onDisconnect);
  });

  server.listen(PORT, HOST, () => {
    console.log(`[BIO ARCADE Server] 🚀 실시간 매칭·릴레이 서버 가동 중! (${activeEngineName})`);
    console.log(`  - 게임 접속 주소 : http://localhost:${PORT}`);
    console.log(`  - WebSocket 주소 : ws://localhost:${PORT}/ws`);
    console.log(`  - 상태 확인 API  : http://localhost:${PORT}/api/status`);
  });
}

try {
  const uWS = require('uWebSockets.js');
  startWithUWS(uWS);
} catch (_) {
  startWithNativeNode();
}
