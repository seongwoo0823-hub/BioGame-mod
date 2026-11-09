// BIO ARCADE 실시간 중계 서버 — Cloudflare Workers + Durable Objects 판
//   server/server.js(Render)와 주고받는 형식이 똑같음 → 사이트 쪽(net.js)은 주소만 바꾸면 됨
//     {"t":"open","id":…} / {"t":"connect","to","cid","meta"} / "D"+cid+내용 / "M"+cid들+"|"+내용 / {"t":"close","cid"} / {"t":"ping","ts"}
//   모든 연결을 Durable Object 하나('main')에 모아 방장과 손님이 같은 곳에서 만나게 함.
//   Durable Object는 처음 접속한 사람과 가까운 데이터센터에 만들어짐 → 한국에서 처음 열면 한국·도쿄 근처에 자리 잡음.
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_MSG = 256 * 1024;
const ROOM = 'main-v1';   // 위치를 다시 잡고 싶으면 이름을 바꿔 배포
const CORS = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
const rid = n => { const s = 'abcdefghijkmnpqrstuvwxyz23456789'; let o = ''; for (let i = 0; i < n; i++) o += s[Math.random() * s.length | 0]; return o; };

export class Relay {
  constructor(state, env) { this.state = state; this.peers = new Map(); this.links = new Map(); this.served = 0; this.colo = null; this.started = Date.now(); }
  async fetch(req) {
    if (req.headers.get('Upgrade') !== 'websocket') {
      // 상태 확인: 접속 수 + 이 서버가 자리 잡은 데이터센터(colo)
      if (!this.colo) { try { const t = await (await fetch('https://www.cloudflare.com/cdn-cgi/trace')).text(); this.colo = (t.match(/colo=(\w+)/) || [])[1] || '?'; } catch (e) { this.colo = '?'; } }
      return new Response(JSON.stringify({ ok: true, name: 'bio-arcade-relay-cf', peers: this.peers.size, links: this.links.size, served: this.served, colo: this.colo, edge: req.headers.get('x-edge-colo') || '' }),
        { headers: Object.assign({ 'Content-Type': 'application/json' }, CORS) });
    }
    const pair = new WebSocketPair(), client = pair[0], ws = pair[1];
    ws.accept();
    ws.id = null; ws.cids = new Set();
    ws.addEventListener('message', e => this.onMsg(ws, e.data));
    const bye = () => this.onClose(ws);
    ws.addEventListener('close', bye); ws.addEventListener('error', bye);
    return new Response(null, { status: 101, webSocket: client });
  }
  send(ws, o) { try { ws.send(typeof o === 'string' ? o : JSON.stringify(o)); } catch (e) { } }
  onMsg(ws, s) {
    if (typeof s !== 'string' || !s || s.length > MAX_MSG) return;
    const c0 = s.charCodeAt(0);
    if (c0 === 77) {   // M: 같은 내용을 여러 연결로
      const bar = s.indexOf('|'); if (bar < 9) return;
      const ids = s.slice(1, bar), body = s.slice(bar + 1);
      for (let i = 0; i + 8 <= ids.length; i += 8) {
        const cid = ids.slice(i, i + 8), L = this.links.get(cid);
        if (!L || (L[0] !== ws && L[1] !== ws)) continue;
        const other = L[0] === ws ? L[1] : L[0]; this.send(other, 'D' + cid + body); this.served++;
      }
      return;
    }
    if (c0 === 68) {   // D: 그대로 전달
      const cid = s.slice(1, 9), L = this.links.get(cid); if (!L) return;
      const other = L[0] === ws ? L[1] : L[0]; this.send(other, s); this.served++;
      return;
    }
    let m; try { m = JSON.parse(s); } catch (e) { return; }
    if (m.t === 'open') {
      if (ws.id) return;
      let id = m.id;
      if (id != null) {
        if (!ID_RE.test(id)) return this.send(ws, { t: 'error', type: 'invalid-id' });
        if (this.peers.has(id)) return this.send(ws, { t: 'error', type: 'unavailable-id' });
      } else { do { id = rid(16); } while (this.peers.has(id)); }
      ws.id = id; this.peers.set(id, ws); this.send(ws, { t: 'open', id, v: 2 });
    } else if (m.t === 'connect') {
      if (!ws.id || typeof m.cid !== 'string' || m.cid.length !== 8 || this.links.has(m.cid)) return;
      const target = this.peers.get(m.to);
      if (!target || target === ws) return this.send(ws, { t: 'error', type: 'peer-unavailable', cid: m.cid, message: 'Could not connect to peer ' + m.to });
      this.links.set(m.cid, [ws, target]); ws.cids.add(m.cid); target.cids.add(m.cid);
      this.send(target, { t: 'conn', from: ws.id, cid: m.cid, meta: m.meta === undefined ? null : m.meta });
      this.send(ws, { t: 'connopen', cid: m.cid });
    } else if (m.t === 'close') {
      this.drop(m.cid, ws);
    } else if (m.t === 'ping') {
      this.send(ws, { t: 'pong', ts: m.ts });
    }
  }
  drop(cid, from) {
    const L = this.links.get(cid); if (!L) return;
    this.links.delete(cid);
    for (const s of L) { s.cids.delete(cid); if (s !== from) this.send(s, { t: 'close', cid }); }
  }
  onClose(ws) {
    if (ws._gone) return; ws._gone = true;
    for (const cid of [...ws.cids]) this.drop(cid, ws);
    if (ws.id && this.peers.get(ws.id) === ws) this.peers.delete(ws.id);
  }
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: Object.assign({ 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Allow-Headers': '*' }, CORS) });
    const stub = env.RELAY.get(env.RELAY.idFromName(ROOM));
    const h = new Headers(req.headers); h.set('x-edge-colo', (req.cf && req.cf.colo) || '');
    return stub.fetch(new Request(req, { headers: h }));
  }
};
