// Visual effects: voxel particles, additive sparks, skid marks, speed lines, camera shake
import * as THREE from 'three';

class Pool {
  constructor(scene, geo, mat, n) {
    this.mesh = new THREE.InstancedMesh(geo, mat, n); this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false; scene.add(this.mesh);
    this.p = Array.from({ length: n }, () => ({ life: 0, max: 1, x: 0, y: -99, z: 0, vx: 0, vy: 0, vz: 0, s: 1, g: 9, c: new THREE.Color() }));
    this.next = 0; this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.v = new THREE.Vector3(); this.sv = new THREE.Vector3();
    for (let i = 0; i < n; i++) this.mesh.setColorAt(i, new THREE.Color(0));
  }
  emit(x, y, z, vx, vy, vz, color, life = 0.6, size = 1, grav = 9) {
    const p = this.p[this.next]; this.next = (this.next + 1) % this.p.length;
    Object.assign(p, { life, max: life, x, y, z, vx, vy, vz, s: size, g: grav }); p.c.set(color);
  }
  update(dt, ground) {
    for (let i = 0; i < this.p.length; i++) {
      const p = this.p[i];
      if (p.life > 0) { p.life -= dt; p.vy -= p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (ground && p.y < ground) { p.y = ground; p.vy *= -0.3; } }
      const k = Math.max(0, p.life / p.max), sc = p.s * k;
      this.m.compose(this.v.set(p.x, p.y, p.z), this.q, this.sv.set(sc, sc, sc)); this.mesh.setMatrixAt(i, this.m); this.mesh.setColorAt(i, p.c);
    }
    this.mesh.instanceMatrix.needsUpdate = true; this.mesh.instanceColor.needsUpdate = true;
  }
}

export class FX {
  constructor(scene) {
    this.scene = scene;
    this.voxels = new Pool(scene, new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial({ toneMapped: false }), 700);
    this.sparks = new Pool(scene, new THREE.SphereGeometry(0.06, 6, 4), new THREE.MeshBasicMaterial({ toneMapped: false, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }), 600);
    // skid marks: ring buffer of dark quads
    this.skidN = 900; this.skid = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.28, 0.5).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x111118, transparent: true, opacity: 0.55, depthWrite: false }), this.skidN);
    this.skid.frustumCulled = false; this.skidI = 0; const z = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < this.skidN; i++) this.skid.setMatrixAt(i, z); scene.add(this.skid);
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.up = new THREE.Vector3(0, 1, 0);
    this.shake = 0;
    // speed-line overlay
    this.cv = document.getElementById('speedlines'); this.g = this.cv.getContext('2d'); this.lines = [];
  }
  skidMark(x, y, z, yaw) {
    this.q.setFromAxisAngle(this.up, yaw); this.m.compose(new THREE.Vector3(x, y + 0.08, z), this.q, new THREE.Vector3(1, 1, 1));
    this.skid.setMatrixAt(this.skidI, this.m); this.skidI = (this.skidI + 1) % this.skidN; this.skid.instanceMatrix.needsUpdate = true;
  }
  kart(k, dt) {
    const fx = Math.sin(k.heading), fz = Math.cos(k.heading), lx = fz, lz = -fx, v = k.speed;
    const rear = (sd, back = 1.0) => [k.x - fx * back + lx * sd * 0.68, k.y + 0.12, k.z - fz * back + lz * sd * 0.68];
    if (k.grounded && v > 8) for (const sd of [-1, 1]) {           // glowing voxel splash from the rear wheels (like the concept art)
      if (Math.random() < 0.55) { const [x, y, z] = rear(sd); this.voxels.emit(x, y, z, -fx * v * 0.12 + lx * sd * (1 + Math.random() * 2), 1.5 + Math.random() * 2.5, -fz * v * 0.12 + lz * sd * (1 + Math.random() * 2), k.boostT > 0 ? 0xffe14a : k.color, 0.55, 1.2); }
    }
    if (k.drifting) {
      const hot = k.driftT > 1.2 ? 0x66ccff : k.driftT > 0.55 ? 0xffb020 : 0xffffff;
      for (const sd of [-1, 1]) { const [x, y, z] = rear(sd, 1.05);
        for (let i = 0; i < 2; i++) this.sparks.emit(x, y, z, (Math.random() - 0.5) * 6 - lx * k.driftDir * 3, 2 + Math.random() * 3, (Math.random() - 0.5) * 6 - lz * k.driftDir * 3, hot, 0.35, 1.4, 12);
        if (Math.random() < 0.7) this.skidMark(x, k.y, z, k.heading); }
    }
    if (k.boostT > 0) for (const sd of [-0.22, 0.22]) {
      const x = k.x - fx * 1.7 + lx * sd, z = k.z - fz * 1.7 + lz * sd;
      this.sparks.emit(x, k.y + 0.4, z, -fx * 8 + (Math.random() - 0.5) * 2, Math.random(), -fz * 8 + (Math.random() - 0.5) * 2, k.boostKind === 'draft' ? 0xffe14a : 0x66ccff, 0.3, 2.2, 0);
    }
  }
  burst(x, y, z, colors, n = 40, speed = 8, size = 2) {
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, e = Math.random() * 1.2, sp = speed * (0.4 + Math.random());
      this.voxels.emit(x, y, z, Math.cos(a) * Math.cos(e) * sp, Math.sin(e) * sp + 2, Math.sin(a) * Math.cos(e) * sp, colors[i % colors.length], 0.9, size); }
  }
  ring(x, y, z, color, n = 30) { for (let i = 0; i < n; i++) { const a = i / n * 6.28; this.sparks.emit(x, y, z, Math.cos(a) * 9, 0.5, Math.sin(a) * 9, color, 0.4, 2, 0); } }
  trail(e) { this.sparks.emit(e.x, e.y, e.z, (Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5), e.type === 'missile' ? 0xff70c0 : 0xa0e8ff, 0.4, 1.8, 0); }
  update(dt, speedFactor) {
    this.voxels.update(dt); this.sparks.update(dt); this.shake = Math.max(0, this.shake - dt * 2.5);
    // speed lines
    const cv = this.cv, g = this.g; if (cv.width !== innerWidth || cv.height !== innerHeight) { cv.width = innerWidth; cv.height = innerHeight; } const w = cv.width, h = cv.height;
    g.clearRect(0, 0, w, h);
    if (speedFactor > 0.05) {
      if (this.lines.length < 60 * speedFactor) this.lines.push({ a: Math.random() * 6.28, r: 0.25 + Math.random() * 0.2, sp: 1.5 + Math.random() * 2, len: 0.08 + Math.random() * 0.12 });
      g.strokeStyle = `rgba(255,255,255,${0.35 * speedFactor})`; g.lineWidth = 2;
      const cx = w / 2, cy = h * 0.45, R = Math.hypot(w, h) / 2;
      for (const l of this.lines) { l.r += l.sp * dt; const r0 = l.r * R, r1 = (l.r + l.len) * R; g.beginPath(); g.moveTo(cx + Math.cos(l.a) * r0, cy + Math.sin(l.a) * r0); g.lineTo(cx + Math.cos(l.a) * r1, cy + Math.sin(l.a) * r1); g.stroke(); }
      this.lines = this.lines.filter(l => l.r < 1.1);
    } else this.lines.length = 0;
  }
}
