// AI drivers: racing line with curvature-based braking, drifting, item tactics, mild rubber-banding
import { PHYS } from './kart.js';

export class AIDriver {
  constructor(kart, skill) { this.k = kart; this.skill = skill; this.lane = (Math.random() - 0.5) * 6; this.laneT = 0; this.itemT = 1 + Math.random() * 3; this.noise = Math.random() * 10; }
  think(dt, race, track, items) {
    const k = this.k, v = k.speed;
    this.laneT -= dt; if (this.laneT <= 0) { this.laneT = 2 + Math.random() * 3; this.lane = (Math.random() - 0.5) * (track.W - 6); }
    // dodge hazards ahead
    for (const e of items.entities) if ((e.type === 'mine' || e.type === 'slime') && (e.x - k.x) ** 2 + (e.z - k.z) ** 2 < 400) {
      const n = track.nearest(e.x, e.z, k.idx); if (Math.abs(n.lat - this.lane) < 3) this.lane = n.lat > 0 ? n.lat - 5 : n.lat + 5;
    }
    const look = 9 + v * 0.55, p = track.at(k.s + look);
    const kap = track.maxCurv(k.s + 4, 30 + v);
    // inside line on curves
    const lane = Math.max(-track.W / 2 + 2.5, Math.min(track.W / 2 - 2.5, this.lane + Math.sign(p.k) * Math.min(3, Math.abs(p.k) * 120)));
    const tx = p.x + p.lx * lane, tz = p.z + p.lz * lane;
    let want = Math.atan2(tx - k.x, tz - k.z) - k.heading; want = Math.atan2(Math.sin(want), Math.cos(want));
    // target speed from curvature (arcade lateral accel), skill + rubber band vs player
    let target = Math.min(PHYS.MAXV, Math.sqrt(27 / Math.max(kap, 1e-3))) * this.skill;
    const pl = race.player;
    if (pl) { const gap = (pl.progress - k.progress) / track.L; target *= 1 + Math.max(-0.08, Math.min(0.1, gap * 0.4)); }
    const inp = k.input;
    inp.steer = Math.max(-1, Math.min(1, want * 2.4 + Math.sin(race.t * 0.7 + this.noise) * 0.04));
    inp.throttle = v < target ? 1 : v > target + 4 ? -0.6 : 0.2;
    inp.drift = kap > 0.034 && v > 22 && Math.abs(want) > 0.12 && Math.abs(k.lat) < track.W / 2 - 3.5;
    // items
    this.itemT -= dt; inp.use = false;
    if (k.items.length && this.itemT <= 0 && race.state === 'race') {
      const it = k.items[0]; const sorted = [...race.karts].sort((a, b) => b.progress - a.progress); const myRank = sorted.indexOf(k);
      const ahead = sorted[myRank - 1], behind = sorted[myRank + 1];
      const gapA = ahead ? ahead.progress - k.progress : 1e9, gapB = behind ? k.progress - behind.progress : 1e9;
      let use = false;
      if (it === 'booster') use = kap < 0.012;
      else if (it === 'missile') use = gapA < 70;
      else if (it === 'bubble') use = myRank > 0;
      else if (it === 'mine' || it === 'slime') use = gapB < 30;
      else if (it === 'shield') use = true;
      if (use || this.itemT < -6) { inp.use = true; this.itemT = 1.5 + Math.random() * 3; }
    }
  }
}
