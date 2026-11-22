// Items: definitions, item boxes, projectiles (antibody missile, bubble trap) and dropped traps (virus mine, slime)
import * as THREE from 'three';
import { load } from './assets.js';

export const ITEMS = {
  booster: { name: 'ATP 부스터', icon: 'G14_ATP_Booster', desc: '순간 가속' },
  missile: { name: '항체 미사일', icon: 'G10_Antibody_Missile', desc: '앞 순위를 추적해 공격' },
  mine: { name: '바이러스 지뢰', icon: 'G05_Virus_Mine', desc: '뒤에 설치, 밟으면 스핀' },
  slime: { name: '점액 폭탄', icon: 'G07_Slime_Puddle', desc: '뒤에 점액 웅덩이' },
  shield: { name: '세포막 실드', icon: 'G11_Shield_Bubble', desc: '공격 1회 방어' },
  bubble: { name: '산소 버블', icon: 'G03_Oxygen_Bubble', desc: '1위를 거품에 가둠' },
};
const TABLE = [ // weights by rank group: front / middle / back
  { booster: 2, missile: 1, mine: 4, slime: 3, shield: 3, bubble: 0 },
  { booster: 3, missile: 3, mine: 2, slime: 2, shield: 2, bubble: 1 },
  { booster: 5, missile: 4, mine: 1, slime: 1, shield: 1, bubble: 3 },
];
export function rollItem(rank, total) {
  const w = TABLE[rank <= 2 ? 0 : rank <= Math.ceil(total * 0.6) ? 1 : 2];
  let r = Math.random() * Object.values(w).reduce((a, b) => a + b, 0);
  for (const [k, v] of Object.entries(w)) { r -= v; if (r <= 0) return k; }
  return 'booster';
}

export class ItemSystem {
  constructor(world) { this.world = world; this.entities = []; this.protos = {}; }
  async init() {
    for (const id of ['G10_Antibody_Missile', 'G05_Virus_Mine', 'G07_Slime_Puddle', 'G03_Oxygen_Bubble']) this.protos[id] = await load(id);
  }
  clone(id) { const o = this.protos[id].clone(true); this.world.scene.add(o); return o; }
  use(kart, race) {
    const type = kart.items.shift(); if (!type) return;
    const ev = this.world.events, tr = this.world.track;
    ev.emit('useItem', kart, type);
    const behind = () => { const p = { x: kart.x - Math.sin(kart.heading) * 2.8, z: kart.z - Math.cos(kart.heading) * 2.8 }; const n = tr.nearest(p.x, p.z, kart.idx); return { ...p, y: tr.heightAt(n.s) }; };
    if (type === 'booster') kart.boost('booster');
    else if (type === 'shield') kart.shieldT = 6;
    else if (type === 'mine' || type === 'slime') {
      const p = behind(), info = { type, x: p.x, y: p.y, z: p.z };
      this.spawn(info, kart, null); this.world.onItem && this.world.onItem(Object.assign({ from: kart.netId, target: null }, info));
    } else if (type === 'missile' || type === 'bubble') {
      const sorted = [...race.karts].sort((a, b) => b.progress - a.progress);
      let target = type === 'bubble' ? sorted[0] : sorted[sorted.indexOf(kart) - 1];
      if (!target || target === kart) target = null;
      const info = { type, x: kart.x, y: kart.y + 0.8, z: kart.z, heading: kart.heading, speed: kart.speed + 30, idx: kart.idx };
      this.spawn(info, kart, target); this.world.onItem && this.world.onItem(Object.assign({ from: kart.netId, target: target ? target.netId : null }, info));
    }
  }
  // 아이템 실물 만들기 (내가 쓴 것 · 온라인으로 받은 다른 사람의 것 공통)
  spawn(info, owner, target) {
    const type = info.type, ev = this.world.events;
    if (type === 'mine' || type === 'slime') {
      const o = this.clone(type === 'mine' ? 'G05_Virus_Mine' : 'G07_Slime_Puddle'); o.position.set(info.x, info.y + 0.02, info.z); o.scale.setScalar(type === 'mine' ? 1.3 : 1.5);
      this.entities.push({ type, obj: o, x: info.x, z: info.z, r: type === 'mine' ? 1.5 : 2.6, life: type === 'mine' ? 30 : 16, owner, arm: 0.6 });
    } else if (type === 'missile' || type === 'bubble') {
      const o = this.clone(type === 'missile' ? 'G10_Antibody_Missile' : 'G03_Oxygen_Bubble'); o.scale.setScalar(type === 'missile' ? 1.3 : 1.6);
      const e = { type, obj: o, x: info.x, y: info.y, z: info.z, heading: info.heading, speed: info.speed, target, owner, life: 5, idx: info.idx ?? -1 };
      o.position.set(e.x, e.y, e.z); this.entities.push(e);
      if (target) ev.emit('targeted', target, type, owner);
    }
  }
  update(dt, race) {
    const ev = this.world.events, tr = this.world.track;
    for (const e of this.entities) {
      e.life -= dt;
      if (e.type === 'mine' || e.type === 'slime') {
        e.arm -= dt; e.obj.rotation.y += dt * (e.type === 'mine' ? 1.5 : 0.2);
        if (e.arm <= 0) for (const k of race.karts) {
          if (k.remote) continue;   // 다른 사람 카트는 그 사람 기기에서 판정
          if ((k.x - e.x) ** 2 + (k.z - e.z) ** 2 < e.r * e.r && k.grounded) {
            if (e.type === 'mine') { k.hit('spin', e.owner); ev.emit('explode', e.x, k.y + 0.5, e.z, 0xff4040); e.life = 0; break; }
            else { if (k.slowT <= 0 && k.shieldT <= 0) ev.emit('slime', k); if (k.shieldT <= 0) k.slowT = 1.2; }
          }
        }
      } else {   // homing projectile: chase target, following the track
        const spd = e.type === 'missile' ? Math.max(62, e.speed) : 48;
        let tx, tz;
        if (e.target && !e.target.finished) { tx = e.target.x; tz = e.target.z; }
        else { const p = tr.at(tr.nearest(e.x, e.z, e.idx).s + 15); tx = p.x; tz = p.z; }
        const n = tr.nearest(e.x, e.z, e.idx); e.idx = n.i;
        const dist = Math.hypot(tx - e.x, tz - e.z);
        if (dist > 25) { const p = tr.at(n.s + 12); tx = p.x + p.lx * (e.target ? e.target.lat * 0.5 : 0); tz = p.z + p.lz * (e.target ? e.target.lat * 0.5 : 0); }
        let want = Math.atan2(tx - e.x, tz - e.z) - e.heading; want = Math.atan2(Math.sin(want), Math.cos(want));
        e.heading += Math.max(-1, Math.min(1, want)) * dt * 7;
        e.x += Math.sin(e.heading) * spd * dt; e.z += Math.cos(e.heading) * spd * dt;
        e.y += ((tr.heightAt(n.s) + 0.9) - e.y) * Math.min(1, dt * 8);
        e.obj.position.set(e.x, e.y + (e.type === 'bubble' ? Math.sin(e.life * 8) * 0.2 : 0), e.z); e.obj.rotation.y = e.heading;
        ev.emit('trail', e);
        if (e.target && dist < 2.2 && Math.abs(e.target.y - e.y) < 2.5) {
          if (e.target.remote) ev.emit('explode', e.x, e.y, e.z, e.type === 'missile' ? 0xff60c0 : 0x80e0ff);
          else if (e.target.hit(e.type === 'missile' ? 'launch' : 'trap', e.owner)) ev.emit('explode', e.x, e.y, e.z, e.type === 'missile' ? 0xff60c0 : 0x80e0ff);
          e.life = 0;
        }
      }
    }
    for (const e of this.entities) if (e.life <= 0) this.world.scene.remove(e.obj);
    this.entities = this.entities.filter(e => e.life > 0);
  }
  clear() { for (const e of this.entities) this.world.scene.remove(e.obj); this.entities = []; }
}
