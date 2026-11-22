// 온라인 대전 연결 — 사이트 공용 방식(교실 서버면 중계, 아니면 PeerJS P2P, 같은 브라우저 탭은 BroadcastChannel)
// 방장: 대기실 자리·트랙·모드·AI를 관리하고 AI 카트를 계산. 모든 사람이 자기 카트를 직접 계산해 상태를 보내고,
// 방장이 모두의 상태를 모아 다시 나눠 줌. 아이템은 '발사' 소식만 나누고, 맞았는지는 맞는 사람 기기에서 판정.
const PREFIX = 'biokart3d-v1-', BC_PREFIX = 'biokart3d-bc-v1-', VER = 1;
const genCode = () => { const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 4; i++) s += c[Math.floor(Math.random() * c.length)]; return s; };
const peerOpts = () => ({ debug: 0, config: { iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }, { urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp' }] } });

export const NET = {
  role: null, code: '', myId: 'bk' + Math.random().toString(36).slice(2, 10), peer: null, hostConn: null, bc: null,
  conns: new Map(), seen: new Map(), lastHost: 0, on: {}, log: () => {},
  get active() { return !!this.role; },
  emit(t, ...a) { (this.on[t] || []).forEach(f => f(...a)); },
  listen(t, f) { (this.on[t] ||= []).push(f); },
  openPeer(id) {
    return new Promise((ok, no) => {
      if (!window.Peer) { no(new Error('peer-missing')); return; }
      let p; try { p = id ? new window.Peer(id, peerOpts()) : new window.Peer(peerOpts()); } catch (e) { no(e); return; }
      const to = setTimeout(() => { try { p.destroy(); } catch (e) {} no(new Error('server')); }, window.BioRelay && BioRelay.wait ? BioRelay.wait(12000) : 12000);
      p.on('open', () => { clearTimeout(to); ok(p); }); p.on('error', e => { clearTimeout(to); no(e); });
    });
  },
  openBc(c) {
    try {
      this.bc = new BroadcastChannel(BC_PREFIX + c);
      this.bc.onmessage = e => { const m = e.data; if (!m) return;
        if (this.role === 'host' && m.from && m.from !== this.myId) this.onHost(m, null);
        else if (this.role === 'guest' && !m.from && (!m.to || m.to === this.myId)) this.onGuest(m); };
    } catch (e) { this.bc = null; }
  },
  send(conn, m) { if (conn && conn.open) try { conn.send(m); } catch (e) {} },
  broadcast(m, except) { for (const [pid, c] of this.conns) if (pid !== except) this.send(c, m); if (this.bc) try { this.bc.postMessage(m); } catch (e) {} },
  sendTo(pid, m) { const c = this.conns.get(pid); if (c) this.send(c, m); else if (this.bc) try { this.bc.postMessage(Object.assign({ to: pid }, m)); } catch (e) {} },
  toHost(m) { m.from = this.myId; if (this.hostConn) this.send(this.hostConn, m); else if (this.bc) try { this.bc.postMessage(m); } catch (e) {} },
  // ---- 방장
  async host(nick) {
    this.leave(); this.role = 'host'; this.log('방을 만드는 중…');
    for (let k = 0; k < 4 && !this.peer; k++) { this.code = genCode(); try { this.peer = await this.openPeer(PREFIX + this.code); } catch (e) { if (!(e && e.type === 'unavailable-id')) break; } }
    if (!this.code) this.code = genCode();
    this.openBc(this.code);
    if (this.peer) {
      this.peer.on('connection', c => { c.on('data', m => this.onHost(m, c)); c.on('close', () => { if (c.pid) this.drop(c.pid); }); });
      try { window.BioRelay && BioRelay.setInfo && BioRelay.setInfo(this.peer, { name: nick + '의 방', playing: false }); } catch (e) {}
    }
    this.log(this.peer ? `방 코드 <b>${this.code}</b> — 친구에게 알려 주세요.` : `방 코드 <b>${this.code}</b> — 인터넷 연결이 없어 이 기기의 다른 탭에서만 참가할 수 있어요.`);
    return this.code;
  },
  onHost(m, c) {
    if (!m || !m.t) return; const pid = m.from; if (pid) this.seen.set(pid, performance.now());
    if (m.t === 'hello') {
      if (m.v !== VER) { const r = { t: 'deny', why: '게임 버전이 달라요. 새로고침해 주세요.' }; c ? this.send(c, r) : this.sendTo(pid, r); return; }
      const why = this.emitAsk('join', pid, m); if (why) { const r = { t: 'deny', why }; c ? this.send(c, r) : this.sendTo(pid, r); return; }
      if (c) { c.pid = pid; this.conns.set(pid, c); }
      this.sendTo(pid, { t: 'welcome', code: this.code });
      this.emit('joined', pid, m);
    } else if (m.t === 'bye') this.drop(pid);
    else if (m.t === 'ks' || m.t === 'item' || m.t === 'chat') { this.emit(m.t, m); this.broadcast(m, pid); }
    else this.emit(m.t, m);
  },
  emitAsk(t, ...a) { for (const f of this.on[t] || []) { const r = f(...a); if (r) return r; } return null; },
  drop(pid) { this.conns.delete(pid); this.seen.delete(pid); this.emit('left', pid); },
  // ---- 참가자
  async join(code, nick, combo) {
    this.leave(); code = String(code || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{3,6}$/.test(code)) { this.log('방 코드를 확인하세요.'); return false; }
    this.code = code; this.role = 'guest'; this.log('방에 연결하는 중…'); this.openBc(code);
    const hello = () => this.toHost({ t: 'hello', v: VER, name: nick, combo });
    hello();
    try {
      this.peer = await this.openPeer();
      this.hostConn = this.peer.connect(PREFIX + code, { reliable: true });
      this.hostConn.on('open', hello);
      this.hostConn.on('data', m => this.onGuest(m));
      this.hostConn.on('close', () => { if (this.role === 'guest') { this.emit('lost'); } });
      this.peer.on('error', e => { if (e && e.type === 'peer-unavailable' && !this.lastHost) this.log(`방 [${code}]을(를) 찾을 수 없어요.`); });
    } catch (e) { if (!this.lastHost) this.log('온라인 연결에 실패했어요. 인터넷을 확인하세요. (같은 기기의 다른 탭 방은 계속 찾는 중)'); }
    setTimeout(() => { if (this.role === 'guest' && !this.lastHost) this.log(`방 [${code}]에 연결하지 못했어요. 코드를 다시 확인해 주세요.`); }, 13000);
    return true;
  },
  onGuest(m) { if (!m || !m.t) return; this.lastHost = performance.now(); if (m.t === 'deny') { this.log('참가할 수 없어요: ' + m.why); this.emit('deny', m); this.role = null; return; } this.emit(m.t, m); },
  leave() {
    if (this.role === 'guest') this.toHost({ t: 'bye' });
    if (this.role === 'host') this.broadcast({ t: 'deny', why: '방장이 방을 닫았어요.' });
    try { if (this.peer) this.peer.destroy(); } catch (e) {} try { if (this.bc) this.bc.close(); } catch (e) {}
    this.peer = null; this.hostConn = null; this.bc = null; this.conns.clear(); this.seen.clear(); this.role = null; this.code = ''; this.lastHost = 0;
  },
};
setInterval(() => { if (NET.role === 'guest') NET.toHost({ t: 'ping' }); if (NET.role === 'host') { const now = performance.now(); for (const [pid, t] of NET.seen) if (now - t > 15000) NET.drop(pid); } }, 3000);
addEventListener('beforeunload', () => NET.leave());
