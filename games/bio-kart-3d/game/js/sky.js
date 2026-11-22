// Theme atmosphere: painted sky dome (clouds / veins / lab grid / underwater rays / space), ground textures, ambient particles
import * as THREE from 'three';
import { rng } from './track.js';

const cache = {};
/** equirect canvas painted per theme kind: top of canvas = zenith, middle = horizon */
export function skyCanvas(sky, W = 2048, H = 1024) {
  const key = sky.kind + W; if (cache[key]) return cache[key];
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'), r = rng(sky.kind.length * 99 + 3);
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, sky.cols[0]); gr.addColorStop(0.36, sky.cols[1]); gr.addColorStop(0.5, sky.cols[2]); gr.addColorStop(1, sky.cols[2]);
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  const blob = (x, y, rx, ry, col, a) => { g.save(); g.translate(x, y); g.scale(rx, ry); const rg = g.createRadialGradient(0, 0, 0, 0, 0, 1); rg.addColorStop(0, col.replace('A', a)); rg.addColorStop(1, col.replace('A', 0)); g.fillStyle = rg; g.beginPath(); g.arc(0, 0, 1, 0, 7); g.fill(); g.restore(); };
  const wrapDo = (x, f) => { f(x); if (x < 200) f(x + W); if (x > W - 200) f(x - W); };
  if (sky.kind === 'clouds') {
    for (let i = 0; i < 70; i++) { const x = r() * W, y = H * (0.3 + r() * 0.18), s = 30 + r() * 70;
      wrapDo(x, xx => { for (let k = 0; k < 5; k++) blob(xx + (r() - 0.5) * s * 2.4, y + (r() - 0.5) * s * 0.5, s * (0.7 + r()), s * 0.45 * (0.7 + r() * 0.6), 'rgba(255,255,255,A)', 0.55); }); }
    for (let i = 0; i < 18; i++) wrapDo(r() * W, xx => blob(xx, H * (0.08 + r() * 0.2), 120 + r() * 160, 18 + r() * 20, 'rgba(255,255,255,A)', 0.25));
  } else if (sky.kind === 'veins') {
    for (let i = 0; i < 40; i++) wrapDo(r() * W, xx => blob(xx, H * (0.1 + r() * 0.35), 60 + r() * 90, 40 + r() * 50, 'rgba(255,120,150,A)', 0.18));
    g.lineCap = 'round';
    const vein = (x, y, a, w, depth) => { if (depth > 6 || w < 0.6) return; const L = 40 + r() * 70, x2 = x + Math.cos(a) * L, y2 = y + Math.sin(a) * L * 0.6;
      g.strokeStyle = `rgba(${150 + depth * 12},20,50,${0.55 - depth * 0.05})`; g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo((x + x2) / 2 + (r() - 0.5) * 30, (y + y2) / 2 + (r() - 0.5) * 30, x2, y2); g.stroke();
      vein(x2, y2, a + (r() - 0.5) * 0.9, w * 0.8, depth + 1); if (r() < 0.55) vein(x2, y2, a + (r() < 0.5 ? 0.8 : -0.8), w * 0.55, depth + 1); };
    for (let i = 0; i < 26; i++) vein(r() * W, H * (0.02 + r() * 0.3), r() * 6.28, 9, 0);
    for (let i = 0; i < 90; i++) wrapDo(r() * W, xx => { const y = H * (0.05 + r() * 0.4), s = 6 + r() * 10; g.fillStyle = 'rgba(220,40,60,.5)'; g.beginPath(); g.ellipse(xx, y, s, s * 0.55, r() * 3, 0, 7); g.fill(); g.fillStyle = 'rgba(150,10,30,.5)'; g.beginPath(); g.ellipse(xx, y, s * 0.45, s * 0.25, 0, 0, 7); g.fill(); });
  } else if (sky.kind === 'grid') {
    g.strokeStyle = 'rgba(160,230,255,.22)'; g.lineWidth = 2;
    for (let x = 0; x <= W; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H * 0.5); g.stroke(); }
    for (let y = 16; y < H * 0.5; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    for (let i = 0; i < 26; i++) { const x = r() * W, y = H * (0.05 + r() * 0.32); g.fillStyle = 'rgba(200,245,255,.35)'; g.fillRect(x, y, 40 + r() * 80, 8); }
    for (let i = 0; i < 40; i++) wrapDo(r() * W, xx => blob(xx, H * (0.38 + r() * 0.1), 70 + r() * 80, 20 + r() * 20, 'rgba(255,255,255,A)', 0.45));
    g.font = 'bold 26px monospace'; g.fillStyle = 'rgba(160,255,200,.35)';
    for (let i = 0; i < 40; i++) g.fillText(['ATGC', 'GCTA', 'TTAG', 'CGAT', 'DNA', 'RNA'][i % 6], r() * W, H * (0.05 + r() * 0.35));
  } else if (sky.kind === 'underwater') {
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 46; i++) { const x = r() * W, w = 20 + r() * 60, lg = g.createLinearGradient(0, 0, 0, H * 0.5); lg.addColorStop(0, 'rgba(180,250,255,.28)'); lg.addColorStop(1, 'rgba(180,250,255,0)');
      g.fillStyle = lg; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + w, 0); g.lineTo(x + w * 2.2 + 30, H * 0.5); g.lineTo(x - w * 0.8 - 30, H * 0.5); g.fill(); }
    for (let i = 0; i < 260; i++) { g.strokeStyle = 'rgba(200,255,255,.12)'; g.lineWidth = 2; const x = r() * W, y = r() * H * 0.15, s = 10 + r() * 22; g.beginPath(); g.ellipse(x, y, s, s * 0.5, r() * 3, 0, 7); g.stroke(); }
    g.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 160; i++) { const x = r() * W, y = H * (0.1 + r() * 0.4), s = 2 + r() * 6; g.strokeStyle = 'rgba(220,255,255,.5)'; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, s, 0, 7); g.stroke(); }
    for (let i = 0; i < 24; i++) wrapDo(r() * W, xx => blob(xx, H * (0.44 + r() * 0.06), 90 + r() * 120, 30, 'rgba(10,60,90,A)', 0.5));
  } else if (sky.kind === 'space') {
    const neb = ['rgba(160,60,255,A)', 'rgba(60,140,255,A)', 'rgba(255,70,190,A)', 'rgba(60,230,220,A)'];
    for (let i = 0; i < 36; i++) wrapDo(r() * W, xx => blob(xx, H * (0.05 + r() * 0.4), 90 + r() * 200, 40 + r() * 90, neb[i % 4], 0.22));
    for (let i = 0; i < 2600; i++) { const y = Math.pow(r(), 1.3) * H * 0.52, s = r() < 0.03 ? 2.4 : r() < 0.2 ? 1.4 : 0.8; g.fillStyle = `rgba(255,255,255,${0.4 + r() * 0.6})`; g.fillRect(r() * W, y, s, s); }
    for (let i = 0; i < 40; i++) { const x = r() * W, y = r() * H * 0.45; g.strokeStyle = 'rgba(200,220,255,.8)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x - 7, y); g.lineTo(x + 7, y); g.moveTo(x, y - 7); g.lineTo(x, y + 7); g.stroke(); }
    g.strokeStyle = 'rgba(120,200,255,.18)'; g.lineWidth = 1.5;          // constellation-like neural links
    for (let i = 0; i < 50; i++) { const x = r() * W, y = r() * H * 0.4; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 4; k++) g.lineTo(x + (r() - 0.5) * 160, y + (r() - 0.5) * 90); g.stroke(); }
    blob(W / 2, H * 0.5, W * 0.7, 60, 'rgba(160,110,255,A)', 0.35);
  }
  return (cache[key] = c);
}
export function makeSkyDome(sky) {
  const t = new THREE.CanvasTexture(skyCanvas(sky)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.SphereGeometry(1100, 48, 24), new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false }));
  m.renderOrder = -10; m.frustumCulled = false; return m;
}

export function groundTexture(kind, base) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), r = rng(kind.length * 7 + 1);
  const col = new THREE.Color(base), hex = (dl) => { const k = col.clone().offsetHSL(0, 0, dl); return '#' + k.getHexString(); };
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 256);
  if (kind === 'tiles') { for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) { g.fillStyle = (x + y) % 2 ? '#ffffff' : '#e6ebf5'; g.fillRect(x * 64 + 1, y * 64 + 1, 62, 62); } }
  else if (kind === 'cosmos') { g.fillStyle = '#c8c8d8'; g.fillRect(0, 0, 256, 256); g.strokeStyle = '#ffffff'; g.lineWidth = 2; g.globalAlpha = 0.5; g.strokeRect(1, 1, 254, 254); g.beginPath(); g.moveTo(128, 0); g.lineTo(128, 256); g.moveTo(0, 128); g.lineTo(256, 128); g.stroke(); g.globalAlpha = 1;
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,255,255,${r()})`; g.fillRect(r() * 256, r() * 256, 2, 2); } }
  else {
    const n = kind === 'grass' ? 900 : kind === 'sand' ? 1400 : 500;
    for (let i = 0; i < n; i++) { const x = r() * 256, y = r() * 256, v = 0.82 + r() * 0.3; g.fillStyle = `rgb(${v * 255 | 0},${v * 255 | 0},${v * 255 | 0})`;
      if (kind === 'grass') g.fillRect(x, y, 2, 4 + r() * 4); else if (kind === 'flesh') { g.beginPath(); g.arc(x, y, 3 + r() * 8, 0, 7); g.fill(); } else g.fillRect(x, y, 2, 2); }
    if (kind === 'sand') { g.strokeStyle = 'rgba(0,0,0,.08)'; g.lineWidth = 3; for (let y = 0; y < 256; y += 32) { g.beginPath(); for (let x = 0; x <= 256; x += 8) g.lineTo(x, y + Math.sin(x / 256 * 6.28 * 2) * 8); g.stroke(); } }
  }
  void hex;
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(kind === 'tiles' ? 220 : 140, kind === 'tiles' ? 220 : 140); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

/** particles that live in a box around the camera and wrap */
export class Ambient {
  constructor(scene, kind) {
    this.kind = kind; const N = kind === 'stars' ? 500 : 380, B = this.B = 110;
    const pos = new Float32Array(N * 3); for (let i = 0; i < N * 3; i++) pos[i] = (Math.random() - 0.5) * B;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d');
    const cfg = { pollen: ['#fff3a0', 0.5, false], rbc: ['#ff4060', 0.9, false], sparkle: ['#bff6ff', 0.45, true], bubbles: ['#dffcff', 0.8, false], stars: ['#d8d0ff', 0.5, true] }[kind] || ['#fff', 0.5, true];
    if (kind === 'bubbles') { x.strokeStyle = cfg[0]; x.lineWidth = 5; x.beginPath(); x.arc(32, 32, 24, 0, 7); x.stroke(); x.fillStyle = '#fff'; x.beginPath(); x.arc(22, 22, 6, 0, 7); x.fill(); }
    else if (kind === 'rbc') { x.fillStyle = cfg[0]; x.beginPath(); x.arc(32, 32, 28, 0, 7); x.fill(); x.fillStyle = '#a0102a'; x.beginPath(); x.arc(32, 32, 12, 0, 7); x.fill(); }
    else { const rg = x.createRadialGradient(32, 32, 0, 32, 32, 32); rg.addColorStop(0, '#fff'); rg.addColorStop(0.3, cfg[0]); rg.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = rg; x.fillRect(0, 0, 64, 64); }
    const t = new THREE.CanvasTexture(cv);
    this.pts = new THREE.Points(g, new THREE.PointsMaterial({ map: t, size: cfg[1], transparent: true, depthWrite: false, blending: cfg[2] ? THREE.AdditiveBlending : THREE.NormalBlending, sizeAttenuation: true }));
    this.pts.frustumCulled = false; scene.add(this.pts); this.t = 0;
  }
  update(dt, cam) {
    this.t += dt; const a = this.pts.geometry.attributes.position, B = this.B, h = B / 2, k = this.kind;
    const vy = k === 'bubbles' ? 2.2 : k === 'pollen' ? -0.25 : k === 'rbc' ? 0 : 0, vx = k === 'rbc' ? 3 : k === 'pollen' ? 0.6 : 0;
    for (let i = 0; i < a.count; i++) {
      let x = a.getX(i) + vx * dt + Math.sin(this.t + i) * 0.01, y = a.getY(i) + vy * dt, z = a.getZ(i);
      x = ((x - cam.x + h) % B + B) % B - h + cam.x; y = ((y - cam.y - 10 + h) % B + B) % B - h + cam.y + 10; z = ((z - cam.z + h) % B + B) % B - h + cam.z;
      a.setXYZ(i, x, Math.max(0.5, y), z);
    }
    a.needsUpdate = true;
    if (k === 'stars' || k === 'sparkle') this.pts.material.opacity = 0.7 + Math.sin(this.t * 3) * 0.3;
  }
}
