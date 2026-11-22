// Kart: arcade physics (grip / drift slide, boost, draft, jumps, walls) + model animation
import * as THREE from 'three';
import { load, byId, b2t } from './assets.js';

export const PHYS = {
  MAXV: 36, BOOSTV: 50, MINI_BOOSTV: 44, DRAFTV: 41, ACC: 21, BOOST_ACC: 48, BRAKE: 42, REVERSE: 10,
  TURN: 2.05, DRIFT_TURN: 1.5, GRIP: 11, DRIFT_GRIP: 1.7, GRAVITY: 26, WALL_E: 0.28, RADIUS: 1.05,
  BOOST_TIME: 2.0, MINI_TIME: 0.6, GAUGE_GAIN: 26,
};
const _v = new THREE.Vector3();

export class Kart {
  constructor(world, combo, name, color, isPlayer) {
    Object.assign(this, { world, combo, name, color, isPlayer });
    this.x = 0; this.y = 0; this.z = 0; this.vx = 0; this.vz = 0; this.vy = 0; this.heading = 0;
    this.steer = 0; this.drifting = false; this.driftT = 0; this.driftDir = 0; this.gauge = 0; this.draft = 0; this.draftOn = 0;
    this.boostT = 0; this.boostKind = ''; this.spinT = 0; this.flipT = 0; this.trapT = 0; this.slowT = 0; this.shieldT = 0;
    this.grounded = true; this.airT = 0; this.idx = -1; this.s = 0; this.lat = 0; this.lap = 0; this.lastS = 0; this.progress = 0;
    this.items = []; this.finished = false; this.finishTime = 0; this.lapTimes = []; this.lapStart = 0; this.rank = 1; this.wrongWay = 0;
    this.input = { throttle: 0, steer: 0, drift: false, use: false };
  }
  async build(scene) {
    const c = this.combo;
    const [k, d, p, b] = await Promise.all([load(c.kart), load(c.driver), load(c.pet), load(c.balloon)]);
    this.root = new THREE.Group(); this.pivot = new THREE.Group(); this.root.add(this.pivot); this.pivot.add(k, d); scene.add(this.root);
    const sock = byId[c.kart].sockets;
    this.balloon = new THREE.Group(); this.balloon.position.copy(b2t(sock.Balloon)); this.balloon.scale.setScalar(0.8); this.balloon.add(b); this.pivot.add(this.balloon);
    this.petSock = b2t(sock.Pet); this.pet = new THREE.Group(); this.pet.add(p); scene.add(this.pet);
    this.wheels = []; this.front = [];
    k.traverse(o => { if (/_Wheel_(FL|FR|RL|RR)$/.test(o.name)) { o.rotation.order = 'YXZ'; this.wheels.push(o); if (/_F[LR]$/.test(o.name)) this.front.push(o); } });
    d.traverse(o => { if (/_Driver$/.test(o.name)) this.driver = o; });
    this.driverY = this.driver ? this.driver.position.y : 0; this.driverS = this.driver ? this.driver.scale.x : 1;
    // boost flames
    this.flames = [];
    const fm = new THREE.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    const core = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    for (const sx of [-0.22, 0.22]) {
      const g = new THREE.Group(); g.position.set(sx, 0.38, -1.2);
      const outer = new THREE.Mesh(new THREE.ConeGeometry(0.14, 1.1, 12), fm.clone()); outer.rotation.x = -Math.PI / 2; outer.position.z = -0.5;
      const inner = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.6, 10), core); inner.rotation.x = -Math.PI / 2; inner.position.z = -0.3;
      g.add(outer, inner); g.visible = false; this.root.add(g); this.flames.push({ g, outer });
    }
    // shield + trap bubbles
    this.shield = new THREE.Mesh(new THREE.IcosahedronGeometry(1.7, 2), new THREE.MeshBasicMaterial({ color: 0x66e8ff, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.shield.position.y = 0.9; this.shield.visible = false; this.root.add(this.shield);
    this.bubble = new THREE.Mesh(new THREE.SphereGeometry(1.8, 24, 16), new THREE.MeshPhysicalMaterial({ color: 0xaee6ff, transparent: true, opacity: 0.35, roughness: 0, clearcoat: 1 }));
    this.bubble.position.y = 0.9; this.bubble.visible = false; this.root.add(this.bubble);
    // name tag
    if (!this.isPlayer) {
      const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; this.tagCtx = cv.getContext('2d');
      this.tagTex = new THREE.CanvasTexture(cv); this.tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tagTex, depthTest: false, transparent: true }));
      this.tag.scale.set(2.4, 0.6, 1); this.tag.position.y = 2.6; this.tag.renderOrder = 10; this.root.add(this.tag); this.drawTag();
    }
    return this;
  }
  drawTag() {
    const g = this.tagCtx; g.clearRect(0, 0, 256, 64);
    g.font = 'bold 26px system-ui,"Malgun Gothic"'; g.textAlign = 'center';
    g.fillStyle = '#' + this.color.toString(16).padStart(6, '0'); g.fillRect(70, 6, 30, 30);
    g.fillStyle = '#fff'; g.fillText(String(this.rank), 85, 31);
    g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,.6)'; g.strokeText(this.name, 128 + 22, 31); g.fillText(this.name, 128 + 22, 31);
    this.tagTex.needsUpdate = true; this._tagRank = this.rank;
  }
  place(track, s, lat) {
    const p = track.place(s, lat); this.x = p.x; this.z = p.z; this.y = p.y; this.heading = p.yaw; this.vx = this.vz = this.vy = 0;
    const n = track.nearest(this.x, this.z); this.idx = n.i; this.s = n.s; this.lastS = n.s;
  }
  get speed() { return Math.hypot(this.vx, this.vz); }
  get fwdSpeed() { return this.vx * Math.sin(this.heading) + this.vz * Math.cos(this.heading); }
  // --------------------------------------------------------------------------- items / effects from outside
  boost(kind = 'booster') {
    const t = kind === 'mini' ? PHYS.MINI_TIME : kind === 'pad' ? 1.2 : kind === 'draft' ? 1.4 : PHYS.BOOST_TIME;
    if (this.boostKind !== 'booster' || kind === 'booster' || this.boostT <= 0) this.boostKind = kind;
    this.boostT = Math.max(this.boostT, t);
    this.world.events.emit('boost', this, kind);
  }
  hit(kind, from) {
    if (this.shieldT > 0) { this.shieldT = 0; this.world.events.emit('blocked', this, kind); return false; }
    if (kind === 'spin') { this.spinT = 1.2; this.vx *= 0.35; this.vz *= 0.35; }
    if (kind === 'launch') { this.spinT = 1.4; this.flipT = 1.0; this.vy = 9; this.grounded = false; this.vx *= 0.3; this.vz *= 0.3; }
    if (kind === 'trap') { this.trapT = 1.8; }
    this.boostT = 0; this.drifting = false;
    this.world.events.emit('hit', this, kind, from);
    return true;
  }
  // --------------------------------------------------------------------------- physics
  update(dt, race) {
    const P = PHYS, tr = this.world.track, inp = this.input;
    const disabled = this.spinT > 0 || this.trapT > 0 || race.state !== 'race';
    let throttle = disabled ? 0 : inp.throttle, steerIn = disabled ? 0 : inp.steer;
    // timers
    for (const k of ['boostT', 'spinT', 'flipT', 'slowT', 'shieldT']) this[k] = Math.max(0, this[k] - dt);
    if (this.trapT > 0) { this.trapT -= dt; this.vx *= Math.pow(0.02, dt); this.vz *= Math.pow(0.02, dt); }
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading), lx = fz, lz = -fx;
    let vf = this.vx * fx + this.vz * fz, vl = this.vx * lx + this.vz * lz;
    // drift state
    const wantDrift = !disabled && inp.drift && Math.abs(steerIn) > 0.15 && vf > 12 && this.grounded;
    if (wantDrift && !this.drifting) { this.drifting = true; this.driftT = 0; this.driftDir = Math.sign(steerIn); this.world.events.emit('driftStart', this); }
    if (this.drifting && (!inp.drift || vf < 8 || disabled)) {
      if (this.driftT > 0.55 && !disabled) { this.boost('mini'); if (race.mode !== 'item') this.gauge = Math.min(100, this.gauge + 6); }   // release -> instant mini booster (+gauge)
      this.drifting = false; this.world.events.emit('driftEnd', this);
    }
    if (this.drifting) this.driftT += dt;
    if (race.mode !== 'item' && !disabled) {
      // gauge: fast while drifting (≈1.6 s of a good slide fills it), slowly at speed, bonus for boosting/drafting
      if (this.drifting) this.gauge += (Math.abs(vl) * 0.6 + 6) * dt * P.GAUGE_GAIN / 4;
      else if (vf > 24 && this.grounded) this.gauge += dt * (this.boostT > 0 ? 8 : 5);
      if (this.gauge >= 100) {
        if (this.items.length < 2) { this.gauge = 0; this.items.push('booster'); this.world.events.emit('gotItem', this, 'booster'); this.world.events.emit('gaugeFull', this); }
        else this.gauge = 100;
      }
    }
    // draft (slipstream) - behind another kart, roughly aligned
    let drafting = false;
    if (!disabled && vf > 20) for (const o of race.karts) {
      if (o === this) continue; const dx = o.x - this.x, dz = o.z - this.z, dist = Math.hypot(dx, dz);
      if (dist > 3.5 && dist < 18 && (dx * fx + dz * fz) / dist > 0.97) { drafting = true; break; }
    }
    this.draft = drafting ? Math.min(100, this.draft + dt * 55) : Math.max(0, this.draft - dt * 80);
    this.draftOn = drafting ? 1 : 0;
    if (this.draft >= 100) { this.draft = 0; this.boost('draft'); }
    // speed limits
    const bk = this.boostT > 0 ? this.boostKind : '';
    let vmax = bk === 'booster' ? P.BOOSTV : bk === 'mini' ? P.MINI_BOOSTV : bk === 'pad' ? P.BOOSTV : bk === 'draft' ? P.DRAFTV : P.MAXV;
    if (this.slowT > 0) vmax *= 0.5;
    const acc = bk ? P.BOOST_ACC : P.ACC;
    if (this.grounded) {
      if (bk) vf += acc * dt * (vf < vmax ? 1 : 0);
      else if (throttle > 0) vf += acc * throttle * dt * Math.max(0, 1 - vf / vmax) * 1.6;
      else if (throttle < 0) vf -= (vf > 0 ? P.BRAKE : P.REVERSE) * dt;
      else vf -= Math.sign(vf) * Math.min(Math.abs(vf), 4 * dt);
      if (vf > vmax) vf = Math.max(vmax, vf - 30 * dt);
      vf = Math.max(-9, vf);
      // lateral grip: drifting lets the kart slide
      const grip = this.drifting ? P.DRIFT_GRIP : this.slowT > 0 ? 4 : P.GRIP;
      vl *= Math.exp(-grip * dt);
      if (this.drifting) vf -= Math.abs(vl) * 0.25 * dt;   // scrub
    }
    // steering
    this.steer += (steerIn - this.steer) * Math.min(1, dt * 9);
    const sf = Math.min(1, Math.abs(vf) / 9) * (1 - 0.32 * Math.min(1, Math.abs(vf) / P.MAXV));
    let yaw = this.steer * P.TURN * sf * Math.sign(vf || 1);
    if (this.drifting) yaw = (this.steer * 0.6 + this.driftDir * 0.75) * P.TURN * P.DRIFT_TURN * sf;
    if (!this.grounded) yaw *= 0.35;
    if (this.spinT > 0) yaw = 11;
    this.heading += yaw * dt;
    // drifting: rotating the body converts some forward speed into slide (the kart "swings")
    const nfx = Math.sin(this.heading), nfz = Math.cos(this.heading), nlx = nfz, nlz = -nfx;
    if (this.drifting) { vl -= this.driftDir * vf * 0.9 * dt * 2.2; }
    this.vx = nfx * vf + nlx * vl; this.vz = nfz * vf + nlz * vl;
    // integrate
    this.x += this.vx * dt; this.z += this.vz * dt;
    // track position, walls
    const n = tr.nearest(this.x, this.z, this.idx); this.idx = n.i; this.lat = n.lat;
    const lim = tr.W / 2 - P.RADIUS;
    if (Math.abs(n.lat) > lim) {
      const sgn = Math.sign(n.lat), ex = n.lat - sgn * lim;
      this.x -= n.lx * ex; this.z -= n.lz * ex;
      const vn = (this.vx * n.lx + this.vz * n.lz) * sgn;          // speed into the wall
      if (vn > 0) {
        this.vx -= (1 + P.WALL_E) * vn * sgn * n.lx; this.vz -= (1 + P.WALL_E) * vn * sgn * n.lz;
        this.vx *= 0.93; this.vz *= 0.93;
        if (vn > 4) this.world.events.emit('wall', this, vn, sgn);
        if (this.drifting && vn > 8) { this.drifting = false; }
      }
    }
    // ground / air
    const g = tr.heightAt(n.s);
    if (this.grounded) {
      const vyG = (g - this.y) / Math.max(dt, 1e-4);
      if (vyG < this.vy - 4 && this.speed > 12) { this.grounded = false; this.airT = 0; this.world.events.emit('jump', this); }
      else { this.y = g; this.vy = vyG; }
    }
    if (!this.grounded) {
      this.airT += dt; this.vy -= P.GRAVITY * dt; this.y += this.vy * dt;
      if (this.y <= g) { const impact = -this.vy; this.y = g; this.vy = 0; this.grounded = true; if (impact > 6) this.world.events.emit('land', this, impact); }
    }
    // track features
    for (const pd of tr.dynamic.pads) { const ds = tr.wrap(n.s - pd.s + 2); if (ds < pd.len && Math.abs(n.lat - pd.lat) < pd.r && this.grounded) { if (this.boostT < 0.4) this.boost('pad'); } }
    for (const b of tr.dynamic.bounce) if (this.grounded && (this.x - b.x) ** 2 + (this.z - b.z) ** 2 < b.r * b.r) { this.vy = 12.5; this.grounded = false; this.y += 0.1; this.world.events.emit('bounce', this); }
    for (const sl of tr.dynamic.slime) if (this.grounded && (this.x - sl.x) ** 2 + (this.z - sl.z) ** 2 < sl.r * sl.r && this.shieldT <= 0) { if (this.slowT <= 0) this.world.events.emit('slime', this); this.slowT = 0.6; }
    // lap / progress
    const s = n.s;
    if (this.lastS > tr.L * 0.75 && s < tr.L * 0.25) { this.lap++; this.world.events.emit('lap', this); }
    else if (this.lastS < tr.L * 0.25 && s > tr.L * 0.75) this.lap--;
    this.lastS = s; this.s = s; this.progress = this.lap * tr.L + s;
    // wrong way?
    this.wrongWay = (nfx * n.tx + nfz * n.tz) < -0.3 && this.speed > 3 ? this.wrongWay + dt : 0;
  }
  // --------------------------------------------------------------------------- visuals
  animate(dt, t, cam) {
    this.root.position.set(this.x, this.y, this.z); this.root.rotation.y = this.heading;
    const vf = this.fwdSpeed, sp = Math.min(1, Math.abs(vf) / PHYS.MAXV);
    for (const w of this.wheels) w.rotation.x += vf * dt / 0.36;
    for (const w of this.front) w.rotation.y = this.steer * 0.45;
    const roll = -this.steer * 0.06 * sp - (this.drifting ? this.driftDir * 0.05 : 0);
    this.pivot.rotation.z += (roll - this.pivot.rotation.z) * Math.min(1, dt * 7);
    this.pivot.rotation.y += ((this.drifting ? this.driftDir * 0.42 : 0) - this.pivot.rotation.y) * Math.min(1, dt * 8);
    const pitch = !this.grounded ? -Math.max(-0.35, Math.min(0.35, this.vy * 0.03)) : 0;
    this.pivot.rotation.x = this.flipT > 0 ? -(1 - this.flipT) * Math.PI * 2 : pitch;
    this.pivot.position.y = (this.grounded ? Math.abs(Math.sin(t * 24)) * 0.012 * sp : 0) + (this.trapT > 0 ? 1.4 + Math.sin(t * 4) * 0.15 : 0);
    if (this.driver) {
      const b = Math.sin(t * 9 + this.color); this.driver.position.y = this.driverY + b * 0.025 * (0.3 + sp);
      this.driver.rotation.z = -this.steer * 0.18 * sp; const sq = 1 + b * 0.025 + (this.boostT > 0 ? 0.04 : 0);
      this.driver.scale.set(this.driverS / Math.sqrt(sq), this.driverS * sq, this.driverS / Math.sqrt(sq));
    }
    // pet follows smoothly in world space
    _v.copy(this.petSock); _v.y += Math.sin(t * 2.4 + this.color) * 0.15; this.root.localToWorld(_v);
    this.pet.position.lerp(_v, Math.min(1, dt * 5)); this.pet.rotation.y += (this.heading - this.pet.rotation.y) * Math.min(1, dt * 4);
    this.balloon.rotation.x = -0.12 - sp * 0.5 + Math.sin(t * 3 + this.color) * 0.05; this.balloon.rotation.z = -this.steer * 0.3 * sp;
    for (const f of this.flames) {
      f.g.visible = this.boostT > 0; const fl = 0.8 + Math.random() * 0.5, big = this.boostKind === 'booster' || this.boostKind === 'pad' ? 1.3 : 0.8;
      f.g.scale.set(fl * big, fl * big, fl * big * 1.3); f.outer.material.color.setHex(this.boostKind === 'draft' ? 0xffe14a : this.boostKind === 'mini' ? 0x9dff5a : 0x66ccff);
    }
    this.shield.visible = this.shieldT > 0; this.shield.rotation.y += dt * 2; this.bubble.visible = this.trapT > 0;
    if (this.tag && this._tagRank !== this.rank) this.drawTag();
  }
  dispose(scene) { scene.remove(this.root); scene.remove(this.pet); }
}
