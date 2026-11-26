// 면역 방어선: 종이 카드 모형(면역세포 16 · 병원체 19 · 배경 소품 · 효과). 모든 조각은 오린 판지에 겹겹이 붙인 그림.
// 카드 좌표: 바닥 y = 0, 가운데 x = 0, 키 약 3.4(보드에 놓을 때 0.22배).
import * as THREE from 'three';
import { makeCard, crossCard } from '../bio-valley/lib/paperkit-3d.js';
import * as P2 from '../bio-valley/lib/paperkit-2d.js';

const { shade, mix, fillLeaf, fillLimb } = P2;
const circ = (g, x, y, r) => { g.beginPath(); g.arc(x, y, Math.max(1e-4, r), 0, Math.PI * 2); g.fill(); };
const ell = (g, x, y, rx, ry, a = 0) => { g.beginPath(); g.ellipse(x, y, Math.max(1e-4, rx), Math.max(1e-4, ry), a, 0, Math.PI * 2); g.fill(); };
const rr = (g, x, y, w, h, r) => { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2)); else g.rect(x, y, w, h); g.fill(); };
const poly = (g, pts) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); };
const INK = '#2a1a14';

// 얼굴: 흰자(층) + 눈동자·볼·입(인쇄)
function face(g, ink, x, y, s = 1, mood = 'cute') {
  const gap = 0.42 * s, er = 0.24 * s;
  if (mood !== 'sleepy') { g.fillStyle = ink('#fbf6ea'); for (const k of [-1, 1]) ell(g, x + k * gap, y, er, er * 1.15); }
  g.fillStyle = ink(INK, 'print');
  if (mood === 'sleepy') { for (const k of [-1, 1]) rr(g, x + k * gap - er, y - 0.04 * s, er * 2, 0.08 * s, 0.04 * s); }
  else for (const k of [-1, 1]) { circ(g, x + k * gap + 0.04 * s * k, y - 0.03 * s, er * 0.55); }
  if (mood !== 'sleepy') { g.fillStyle = ink('#ffffff', 'print'); for (const k of [-1, 1]) circ(g, x + k * gap + 0.1 * s * k, y + 0.06 * s, er * 0.2); }
  if (mood === 'angry' || mood === 'brave') {
    g.fillStyle = ink(INK, 'print');
    for (const k of [-1, 1]) { g.save(); g.translate(x + k * gap, y + er * 1.5); g.rotate(mood === 'angry' ? k * 0.45 : -k * 0.15); rr(g, -er, -0.05 * s, er * 2, 0.11 * s, 0.05 * s); g.restore(); }
  }
  if (mood === 'cute') { g.fillStyle = ink('#f08aa0', 'print'); for (const k of [-1, 1]) ell(g, x + k * gap * 1.75, y - er * 1.4, er * 0.55, er * 0.35); }
  g.fillStyle = ink(INK, 'print');
  if (mood === 'angry') rr(g, x - 0.18 * s, y - er * 2.2, 0.36 * s, 0.08 * s, 0.04 * s);
  else { g.beginPath(); g.ellipse(x, y - er * 1.9, 0.16 * s, 0.1 * s, 0, Math.PI, 0); g.fill(); }
}
// 둘레에 돌기(바이러스 스파이크)
function spikes(g, ink, cx, cy, r, n, stem, tip, len = 0.45) {
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2 + 0.2, x0 = cx + Math.cos(a) * r * 0.9, y0 = cy + Math.sin(a) * r * 0.9, x1 = cx + Math.cos(a) * (r + len), y1 = cy + Math.sin(a) * (r + len);
    if (y1 < 0.05) continue;
    g.fillStyle = ink(stem); fillLimb(g, x0, y0, (x0 + x1) / 2, (y0 + y1) / 2, x1, y1, 0.16, 0.1, 6);
  }
  g.fillStyle = ink(tip);
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + 0.2, x1 = cx + Math.cos(a) * (r + len), y1 = cy + Math.sin(a) * (r + len); if (y1 < 0.05) continue; circ(g, x1, y1, 0.16); }
}
function dots(g, ink, cx, cy, rx, ry, n, col, size, seed = 3) {
  const r = P2.rng(seed); g.fillStyle = ink(col, 'print');
  for (let i = 0; i < n; i++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.8; circ(g, cx + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d, size * (0.7 + r() * 0.6)); }
}
const Y = (g, x, y, s, a = 0) => { g.save(); g.translate(x, y); g.rotate(a); rr(g, -0.07 * s, 0, 0.14 * s, 0.45 * s, 0.05 * s); g.save(); g.translate(0, 0.42 * s); g.rotate(0.6); rr(g, -0.06 * s, 0, 0.12 * s, 0.32 * s, 0.05 * s); g.restore(); g.save(); g.translate(0, 0.42 * s); g.rotate(-0.6); rr(g, -0.06 * s, 0, 0.12 * s, 0.32 * s, 0.05 * s); g.restore(); g.restore(); };

/** 모형 도면: drawFn(g, ink) 를 단위 박스(w×h) 안에 그림 */
export const DRAW = {
  // ---------------- 면역세포 ----------------
  mito: { w: 3.6, h: 2.6, d(g, ink) { g.fillStyle = ink('#f08a3a'); ell(g, 0, 1.25, 1.75, 1.15); g.fillStyle = ink('#ffc27a'); ell(g, 0, 1.25, 1.35, 0.8); g.strokeStyle = ink('#d0601e', 'print'); g.lineWidth = 0.12; g.beginPath(); for (let i = 0; i <= 12; i++) { const x = -1.15 + i * 0.19, y = 1.25 + (i % 2 ? 0.45 : -0.45); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); face(g, ink, 0, 1.45, 1.1, 'cute'); } },
  neutro: { w: 3.8, h: 3.3, d(g, ink) { g.fillStyle = ink('#f2f6ff'); ell(g, -1.55, 1.1, 0.42, 0.36); ell(g, 1.55, 1.25, 0.42, 0.36); g.fillStyle = ink('#8fd2ff'); circ(g, 0, 1.55, 1.45); g.fillStyle = ink('#9b6bd8'); ell(g, -0.55, 2.35, 0.55, 0.38); ell(g, 0.2, 2.55, 0.5, 0.36); ell(g, 0.8, 2.25, 0.45, 0.32); dots(g, ink, 0, 1.3, 1.1, 0.8, 14, '#ff8ab4', 0.07); face(g, ink, 0, 1.45, 1, 'brave'); } },
  barrier: { w: 3.2, h: 3.6, d(g, ink) { g.fillStyle = ink('#f2b48a'); rr(g, -1.5, 0, 3, 3.4, 0.35); g.fillStyle = ink('#e09a70'); for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) rr(g, -1.38 + c * 0.95 + (r % 2) * 0.45 - 0.2, 0.15 + r * 0.82, 0.85, 0.7, 0.12); g.fillStyle = ink('#f6c4a0'); rr(g, -1.1, 1.35, 2.2, 1.3, 0.4); face(g, ink, 0, 2.05, 1.1, 'cute'); } },
  bcell: { w: 3.3, h: 3.8, d(g, ink) { g.fillStyle = ink('#ffd84a'); Y(g, -0.7, 2.6, 1.6, -0.2); Y(g, 0.7, 2.6, 1.6, 0.2); g.fillStyle = ink('#ff9ccd'); circ(g, 0, 1.5, 1.45); g.fillStyle = ink('#ffc0de'); ell(g, -0.4, 2.0, 0.5, 0.32, -0.4); face(g, ink, 0, 1.4, 1, 'cute'); } },
  macro: { w: 4.4, h: 3.5, d(g, ink) { g.fillStyle = ink('#b48cff'); ell(g, -1.75, 1.0, 0.65, 0.55, 0.4); ell(g, 1.85, 1.3, 0.62, 0.52, -0.4); ell(g, 0, 1.55, 1.75, 1.45); g.fillStyle = ink('#d0b4ff'); ell(g, -0.3, 2.1, 0.8, 0.45, -0.3); dots(g, ink, 0, 1.3, 1.3, 0.9, 8, '#7a4ad0', 0.12, 9); face(g, ink, 0, 1.75, 1.15, 'brave'); g.fillStyle = ink('#5a2a8a', 'print'); rr(g, -0.55, 0.65, 1.1, 0.14, 0.07); } },
  comp: { w: 3.0, h: 3.6, d(g, ink) { g.fillStyle = ink('#5a3a2a'); rr(g, -0.1, 2.4, 0.2, 0.7, 0.08); g.fillStyle = ink('#ffe27a'); poly(g, [[0, 3.6], [0.25, 3.1], [0.05, 3.15], [0.2, 2.9], [-0.25, 3.25], [-0.05, 3.2]]); g.fillStyle = ink('#ff5a4a'); circ(g, 0, 1.35, 1.3); g.fillStyle = ink('#ffad3a'); for (const [x, y] of [[-0.55, 1.9], [0.55, 1.9], [0, 1.3], [-0.6, 0.75], [0.6, 0.75]]) circ(g, x, y, 0.3); face(g, ink, 0, 1.4, 0.95, 'angry'); } },
  memb: { w: 3.3, h: 4.0, d(g, ink) { g.fillStyle = ink('#ffd84a'); Y(g, -0.9, 2.6, 1.5, -0.35); Y(g, 0, 2.85, 1.6, 0); Y(g, 0.9, 2.6, 1.5, 0.35); g.fillStyle = ink('#ff6fb0'); circ(g, 0, 1.5, 1.45); face(g, ink, 0, 1.45, 1, 'cute'); g.strokeStyle = ink(INK, 'print'); g.lineWidth = 0.09; for (const k of [-1, 1]) { g.beginPath(); g.arc(k * 0.42, 1.45, 0.34, 0, Math.PI * 2); g.stroke(); } g.beginPath(); g.moveTo(-0.08, 1.5); g.lineTo(0.08, 1.5); g.stroke(); } },
  mast: { w: 3.3, h: 3.3, d(g, ink) { g.fillStyle = ink('#ffdf5a'); circ(g, 0, 1.55, 1.5); g.fillStyle = ink('#fff0a0'); ell(g, -0.45, 2.15, 0.55, 0.32, -0.4); dots(g, ink, 0, 1.5, 1.2, 1.1, 18, '#8a4ad0', 0.11, 5); face(g, ink, 0, 1.45, 1, 'cute'); } },
  killer: { w: 4.0, h: 3.6, d(g, ink) { g.fillStyle = ink('#f2f6ff'); ell(g, -1.6, 1.05, 0.5, 0.45); ell(g, 1.6, 1.05, 0.5, 0.45); g.fillStyle = ink('#4a78e0'); circ(g, 0, 1.6, 1.5); g.fillStyle = ink('#ff3b4a'); rr(g, -1.45, 2.25, 2.9, 0.42, 0.2); poly(g, [[1.3, 2.5], [1.9, 2.75], [1.75, 2.3]]); face(g, ink, 0, 1.55, 1, 'brave'); } },
  nk: { w: 3.2, h: 3.5, d(g, ink) { g.fillStyle = ink('#a874ff'); ell(g, 0, 1.6, 1.4, 1.55); g.fillStyle = ink('#ffe14a'); poly(g, [[0.35, 3.0], [-0.35, 1.95], [0.05, 1.95], [-0.3, 1.0], [0.5, 2.15], [0.1, 2.15]]); face(g, ink, 0, 1.25, 0.95, 'angry'); } },
  eos: { w: 3.3, h: 3.3, d(g, ink) { g.fillStyle = ink('#ff7a4a'); circ(g, 0, 1.55, 1.5); dots(g, ink, 0, 1.6, 1.2, 1.1, 16, '#ffd0a0', 0.12, 11); g.fillStyle = ink('#c84a2a'); ell(g, -0.5, 2.3, 0.45, 0.3); ell(g, 0.5, 2.3, 0.45, 0.3); face(g, ink, 0, 1.4, 1, 'brave'); } },
  plate: { w: 3.6, h: 1.6, d(g, ink) { const r = P2.rng(4); for (let i = 0; i < 9; i++) { g.fillStyle = ink(i % 2 ? '#ff6a78' : '#e84a5a'); ell(g, -1.4 + (i % 5) * 0.7 + (i > 4 ? 0.35 : 0), 0.4 + (i > 4 ? 0.6 : 0) + r() * 0.1, 0.42, 0.3); } g.strokeStyle = ink('#ffd0d6', 'print'); g.lineWidth = 0.06; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(-1.6 + r() * 3.2, 0.2 + r()); g.lineTo(-1.6 + r() * 3.2, 0.2 + r()); g.stroke(); } } },
  dend: { w: 4.2, h: 4.0, d(g, ink) { g.fillStyle = ink('#5cc85a'); for (const a of [0.3, 0.9, 1.55, 2.2, 2.85, -0.3, 3.45]) { const x1 = Math.cos(a) * 1.9, y1 = 1.6 + Math.sin(a) * 1.8; if (y1 < 0.1) continue; fillLimb(g, 0, 1.6, Math.cos(a) * 1.1, 1.6 + Math.sin(a) * 1.0, x1, y1, 0.35, 0.12, 8); } g.fillStyle = ink('#c8ff9a'); for (const a of [0.3, 0.9, 1.55, 2.2, 2.85]) circ(g, Math.cos(a) * 1.9, 1.6 + Math.sin(a) * 1.8, 0.2); g.fillStyle = ink('#8ae886'); circ(g, 0, 1.55, 1.1); face(g, ink, 0, 1.5, 0.85, 'cute'); } },
  ifn: { w: 3.0, h: 3.8, d(g, ink) { g.fillStyle = ink('#a0a8b8'); rr(g, -1.2, 0, 0.22, 3.7, 0.08); g.fillStyle = ink('#6fd8ff'); poly(g, [[-1.0, 3.6], [1.4, 3.3], [1.1, 2.75], [1.45, 2.2], [-1.0, 2.2]]); g.fillStyle = ink('#ffffff', 'print'); for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(-0.3 + i * 0.5, 2.9, 0.18, 0.1, 0, 0, Math.PI * 2); g.fill(); } } },
  cilia: { w: 3.4, h: 3.4, d(g, ink) { g.fillStyle = ink('#ff7aa8'); for (let i = 0; i < 9; i++) { const x = -1.3 + i * 0.33; fillLimb(g, x, 1.8, x + 0.15, 2.5, x + (i % 2 ? 0.3 : -0.2), 3.2, 0.14, 0.08, 6); } g.fillStyle = ink('#ffb3cf'); rr(g, -1.55, 0, 3.1, 2.0, 0.4); face(g, ink, 0, 1.0, 1, 'cute'); } },
  fever: { w: 2.0, h: 3.8, d(g, ink) { g.fillStyle = ink('#f4f6ff'); rr(g, -0.35, 0.6, 0.7, 3.1, 0.35); g.fillStyle = ink('#ff4a3a'); circ(g, 0, 0.62, 0.62); rr(g, -0.14, 0.8, 0.28, 2.2, 0.14); g.fillStyle = ink(INK, 'print'); for (let i = 0; i < 6; i++) rr(g, 0.18, 1.2 + i * 0.35, 0.16, 0.05, 0.02); } },
  // ---------------- 병원체 ----------------
  cold: { w: 3.4, h: 3.4, d(g, ink) { spikes(g, ink, 0, 1.6, 1.15, 11, '#5aa040', '#ff5a6a'); g.fillStyle = ink('#7ee05a'); circ(g, 0, 1.6, 1.2); g.fillStyle = ink('#a8f080'); ell(g, -0.4, 2.1, 0.45, 0.28, -0.4); face(g, ink, 0, 1.55, 0.95, 'angry'); } },
  flag: { w: 4.0, h: 4.6, d(g, ink) { g.fillStyle = ink('#7a5a3a'); rr(g, 1.25, 0, 0.16, 4.5, 0.06); g.fillStyle = ink('#ff3b4a'); poly(g, [[1.4, 4.45], [3.0, 4.15], [2.6, 3.75], [3.0, 3.35], [1.4, 3.35]]); g.fillStyle = ink('#ffffff', 'print'); circ(g, 2.0, 3.9, 0.18); spikes(g, ink, -0.2, 1.6, 1.15, 11, '#5aa040', '#ff5a6a'); g.fillStyle = ink('#7ee05a'); circ(g, -0.2, 1.6, 1.2); face(g, ink, -0.2, 1.55, 0.95, 'angry'); } },
  capsid: { w: 3.4, h: 3.4, d(g, ink) { spikes(g, ink, 0, 1.6, 1.15, 11, '#5aa040', '#ff5a6a'); g.fillStyle = ink('#7ee05a'); circ(g, 0, 1.6, 1.2); face(g, ink, 0, 1.55, 0.95, 'angry'); } },
  capsidArmor: { w: 3.2, h: 2.4, d(g, ink) { for (let r = 0; r < 3; r++) for (let c = 0; c < 4 - (r % 2); c++) { const x = -1.2 + c * 0.8 + (r % 2) * 0.4, y = 0.4 + r * 0.66; g.fillStyle = ink((r + c) % 2 ? '#a8b0c0' : '#8a92a4'); g.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + Math.PI / 6; k ? g.lineTo(x + Math.cos(a) * 0.48, y + Math.sin(a) * 0.48) : g.moveTo(x + Math.cos(a) * 0.48, y + Math.sin(a) * 0.48); } g.closePath(); g.fill(); } } },
  ecoli: { w: 4.6, h: 2.4, d(g, ink) { g.strokeStyle = ink('#6a4a2a', 'print'); g.lineWidth = 0.12; for (const yy of [0.9, 1.3]) { g.beginPath(); for (let i = 0; i <= 20; i++) { const x = 1.6 + i * 0.1, y = yy + Math.sin(i * 0.8) * 0.18; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); } g.fillStyle = ink('#c98a52'); rr(g, -1.9, 0.3, 3.6, 1.6, 0.8); g.fillStyle = ink('#e0a870'); rr(g, -1.5, 1.25, 2.6, 0.4, 0.2); face(g, ink, -0.6, 1.1, 0.85, 'angry'); } },
  phage: { w: 2.6, h: 4.4, d(g, ink) { g.fillStyle = ink('#5a6ab0'); for (const [a, b] of [[-1.1, -0.5], [1.1, 0.5], [-0.6, -0.2], [0.6, 0.2]]) fillLimb(g, b * 0.4, 1.2, a * 0.8, 0.6, a, 0, 0.13, 0.1, 6); g.fillStyle = ink('#c0c8e0'); rr(g, -0.18, 1.1, 0.36, 1.4, 0.1); g.fillStyle = ink('#7a8ae0'); poly(g, [[0, 4.3], [0.95, 3.75], [0.95, 2.75], [0, 2.25], [-0.95, 2.75], [-0.95, 3.75]]); g.fillStyle = ink('#a0b0f0'); poly(g, [[0, 4.1], [0.6, 3.75], [0, 3.4], [-0.6, 3.75]]); face(g, ink, 0, 3.15, 0.75, 'angry'); } },
  tb: { w: 3.4, h: 2.2, d(g, ink) { g.fillStyle = ink('#8a7a6a'); rr(g, -1.5, 0.3, 3, 1.5, 0.75); face(g, ink, 0, 1.05, 0.85, 'sleepy'); } },
  tbArmor: { w: 3.8, h: 2.6, d(g, ink) { g.fillStyle = ink('#f4f0e4'); rr(g, -1.8, 0.1, 3.6, 2.3, 0.9); g.fillStyle = ink('#e0d8c4'); for (const [x, y] of [[-1.1, 0.7], [0.2, 1.8], [1.1, 0.9], [-0.4, 1.4], [0.8, 1.6]]) ell(g, x, y, 0.28, 0.2); face(g, ink, 0, 1.25, 0.9, 'angry'); } },
  spore: { w: 3.4, h: 3.4, d(g, ink) { spikes(g, ink, 0, 1.6, 1.2, 14, '#5cc86a', '#bff0a0', 0.3); g.fillStyle = ink('#5cc86a'); circ(g, 0, 1.6, 1.25); dots(g, ink, 0, 1.6, 1, 1, 10, '#3a9a4a', 0.14, 7); face(g, ink, 0, 1.55, 0.9, 'angry'); } },
  sporelet: { w: 2.0, h: 2.0, d(g, ink) { g.fillStyle = ink('#7ad87a'); circ(g, 0, 0.95, 0.85); face(g, ink, 0, 0.95, 0.6, 'angry'); } },
  toxin: { w: 3.4, h: 2.8, d(g, ink) { g.fillStyle = ink('#5aff6a'); for (const x of [-0.8, 0.3, 1.0]) { ell(g, x, 0.25, 0.14, 0.24); } g.fillStyle = ink('#9a4ad0'); rr(g, -1.55, 0.45, 3.1, 1.9, 0.8); g.fillStyle = ink('#5aff6a'); ell(g, -0.6, 0.8, 0.22, 0.14); ell(g, 0.5, 0.75, 0.2, 0.13); face(g, ink, 0, 1.55, 0.9, 'angry'); } },
  malaria: { w: 3.2, h: 3.2, d(g, ink) { g.fillStyle = ink('#ff8ab0'); g.beginPath(); g.arc(0, 1.55, 1.5, 0.6, Math.PI * 2 - 0.6, false); g.arc(0.9, 1.55, 1.1, Math.PI * 2 - 1.2, 1.2, true); g.closePath(); g.fill(); g.fillStyle = ink('#ffc0d4'); ell(g, -0.6, 2.2, 0.4, 0.22, -0.5); face(g, ink, -0.55, 1.5, 0.8, 'angry'); } },
  worm: { w: 6.4, h: 2.4, d(g, ink) { for (let i = 6; i >= 0; i--) { g.fillStyle = ink(i % 2 ? '#f0b088' : '#ffc8a0'); circ(g, -2.4 + i * 0.85, 1.0 + Math.sin(i * 0.9) * 0.25, 0.8 - (i > 4 ? (i - 4) * 0.12 : 0)); } face(g, ink, -2.4, 1.1, 0.7, 'angry'); } },
  hiv: { w: 3.0, h: 3.0, d(g, ink) { spikes(g, ink, 0, 1.4, 1.0, 10, '#9098a8', '#ffd84a', 0.3); g.fillStyle = ink('#b8bcc8'); circ(g, 0, 1.4, 1.05); g.fillStyle = ink('#d8a840'); poly(g, [[0, 2.0], [0.35, 1.2], [-0.35, 1.2]]); face(g, ink, 0, 1.35, 0.8, 'angry'); } },
  noro: { w: 2.2, h: 2.2, d(g, ink) { spikes(g, ink, 0, 1.0, 0.75, 7, '#2a5ab0', '#2a5ab0', 0.22); g.fillStyle = ink('#5aa8ff'); circ(g, 0, 1.0, 0.8); face(g, ink, 0, 1.0, 0.6, 'angry'); } },
  cancer: { w: 3.6, h: 3.4, d(g, ink) { g.fillStyle = ink('#b8304a'); circ(g, 0, 1.55, 1.45); for (const [x, y, r] of [[1.0, 2.3, 0.55], [-1.2, 2.0, 0.5], [0.9, 0.7, 0.5], [-0.6, 2.75, 0.45], [1.35, 1.4, 0.45]]) circ(g, x, y, r); g.fillStyle = ink('#8a1a32'); for (const [x, y, r] of [[1.0, 2.3, 0.3], [-1.2, 2.0, 0.25], [-0.6, 2.75, 0.2]]) circ(g, x, y, r); face(g, ink, -0.1, 1.5, 1, 'angry'); } },
  prion: { w: 3.6, h: 3.0, d(g, ink) { const pts = [[-1.4, 0.4], [-0.7, 1.2], [0, 0.4], [0.7, 1.2], [1.4, 0.4], [1.05, 1.9], [0.35, 2.6], [-0.35, 1.9], [-1.05, 2.6]]; for (let i = 0; i < pts.length - 1; i++) { g.fillStyle = ink(i % 2 ? '#a090c8' : '#8070b0'); const [a, b] = pts[i], [c, d] = pts[i + 1]; fillLimb(g, a, b, (a + c) / 2, (b + d) / 2, c, d, 0.5, 0.5, 6); } face(g, ink, 0, 1.55, 0.75, 'sleepy'); } },
  superflu: { w: 6.6, h: 7.2, d(g, ink) { spikes(g, ink, 0, 3.1, 2.5, 18, '#3aa098', '#ff4a7a', 0.7); g.fillStyle = ink('#5ad0c8'); circ(g, 0, 3.1, 2.55); g.fillStyle = ink('#8ae8e0'); ell(g, -0.9, 4.1, 0.9, 0.5, -0.4); g.fillStyle = ink('#ffd23a'); poly(g, [[-1.3, 5.4], [-1.3, 6.3], [-0.7, 5.85], [0, 6.6], [0.7, 5.85], [1.3, 6.3], [1.3, 5.4]]); face(g, ink, 0, 3.0, 2.0, 'angry'); } },
  biofilm: { w: 7.0, h: 4.8, d(g, ink) { g.fillStyle = ink('#6a9040'); g.beginPath(); g.moveTo(-3.4, 0); for (let i = 0; i <= 12; i++) { const x = -3.4 + i * 0.567, y = 2.6 + Math.sin(i * 1.3) * 0.5 + Math.sin(i * 0.4) * 1.2; g.lineTo(x, y); } g.lineTo(3.4, 0); g.closePath(); g.fill(); g.fillStyle = ink('#8ab85a'); ell(g, -1.2, 2.4, 1.2, 0.55); ell(g, 1.5, 2.0, 1.0, 0.5); dots(g, ink, 0, 1.8, 2.8, 1.2, 14, '#c98a52', 0.22, 13); face(g, ink, 0, 2.6, 1.8, 'angry'); } },
  queen: { w: 8.0, h: 5.0, d(g, ink) { for (let i = 5; i >= 0; i--) { g.fillStyle = ink(i % 2 ? '#e8a07a' : '#ffbe94'); circ(g, -2.6 + i * 1.2, 1.6 + Math.sin(i) * 0.3, 1.45 - i * 0.12); } g.fillStyle = ink('#ffd23a'); poly(g, [[-3.6, 2.9], [-3.6, 3.9], [-3.0, 3.4], [-2.6, 4.2], [-2.2, 3.4], [-1.6, 3.9], [-1.6, 2.9]]); face(g, ink, -2.6, 1.7, 1.3, 'angry'); } },
  latent: { w: 6.6, h: 6.6, d(g, ink) { spikes(g, ink, 0, 3.0, 2.4, 16, '#2a1a5a', '#b06aff', 0.7); g.fillStyle = ink('#3a2a6a'); circ(g, 0, 3.0, 2.45); g.fillStyle = ink('#ff3a5a'); for (const k of [-1, 1]) { g.save(); g.translate(k * 0.85, 3.2); g.rotate(k * 0.35); ell(g, 0, 0, 0.5, 0.2); g.restore(); } g.fillStyle = ink('#5a4a8a'); ell(g, -0.9, 4.2, 0.9, 0.45, -0.4); } },
  pandemia: { w: 7.4, h: 8.0, d(g, ink) { spikes(g, ink, 0, 3.4, 2.8, 22, '#5a1aa0', '#7a2aff', 0.8); g.fillStyle = ink('#d0305a'); circ(g, 0, 3.4, 2.85); dots(g, ink, 0, 3.4, 2.3, 2.3, 16, '#ffd23a', 0.2, 17); g.fillStyle = ink('#ffd23a'); poly(g, [[-1.6, 6.0], [-1.6, 7.2], [-0.9, 6.55], [-0.3, 7.6], [0.3, 6.55], [0.9, 7.6], [1.5, 6.55], [1.6, 7.2], [1.6, 6.0]]); face(g, ink, 0, 3.3, 2.1, 'angry'); } },
  // ---------------- 소품 ----------------
  atp: { w: 2.2, h: 2.4, d(g, ink) { g.fillStyle = ink('#e0a020'); poly(g, Array.from({ length: 6 }, (_, k) => { const a = k / 6 * Math.PI * 2 + Math.PI / 2; return [Math.cos(a) * 1.05, 1.15 + Math.sin(a) * 1.15]; })); g.fillStyle = ink('#ffd23a'); poly(g, Array.from({ length: 6 }, (_, k) => { const a = k / 6 * Math.PI * 2 + Math.PI / 2; return [Math.cos(a) * 0.82, 1.15 + Math.sin(a) * 0.9]; })); g.fillStyle = ink('#fff6b0'); ell(g, -0.25, 1.55, 0.3, 0.18, -0.4); g.save(); g.scale(1, -1); g.fillStyle = ink('#8a5a10', 'print'); g.font = 'bold 0.6px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ATP', 0, -1.05); g.restore(); } },
  pulse: { w: 2.4, h: 2.8, d(g, ink) { g.fillStyle = ink('#3a6ad0'); rr(g, -1.1, 0, 2.2, 0.9, 0.25); g.fillStyle = ink('#5a8ae8'); rr(g, -0.8, 0.8, 1.6, 0.4, 0.15); g.fillStyle = ink('#5ab8ff'); circ(g, 0, 1.85, 0.75); g.fillStyle = ink('#d8f6ff'); circ(g, -0.2, 2.05, 0.25); } },
  wallBlock: { w: 3.6, h: 2.6, d(g, ink) { g.fillStyle = ink('#8a7aa8'); rr(g, -1.7, 0, 3.4, 2.1, 0.2); g.fillStyle = ink('#a898c8'); rr(g, -1.75, 1.9, 3.5, 0.55, 0.15); g.fillStyle = ink('#7a6a98'); for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) rr(g, -1.55 + c * 1.05 + (r % 2) * 0.5 - 0.2, 0.15 + r * 0.85, 0.95, 0.7, 0.1); } },
  rbcProp: { w: 3.4, h: 1.8, d(g, ink) { g.fillStyle = ink('#d8404f'); ell(g, 0, 0.85, 1.65, 0.8); g.fillStyle = ink('#b8303f'); ell(g, 0, 0.95, 0.9, 0.35); g.fillStyle = ink('#f06a78'); ell(g, -0.7, 1.2, 0.4, 0.15, -0.2); } },
  vesselPillar: { w: 1.8, h: 7.0, d(g, ink) { g.fillStyle = ink('#ff8f9a'); rr(g, -0.75, 0, 1.5, 6.6, 0.3); g.fillStyle = ink('#ffb0b8'); rr(g, -0.9, 6.3, 1.8, 0.6, 0.2); g.fillStyle = ink('#e87080'); for (let y = 0.8; y < 6; y += 1.1) rr(g, -0.75, y, 1.5, 0.22, 0.1); } },
  plasmaBubble: { w: 2.2, h: 2.2, d(g, ink) { g.fillStyle = ink('#fff1b8'); circ(g, 0, 1.05, 1.0); g.fillStyle = ink('#fffbe4'); ell(g, -0.35, 1.4, 0.3, 0.2, -0.5); } },
  alveolus: { w: 4.0, h: 3.4, d(g, ink) { g.fillStyle = ink('#ff9fb8'); rr(g, -0.15, 0, 0.3, 1.4, 0.1); for (const [x, y, r] of [[-1.0, 1.9, 0.85], [0.9, 2.0, 0.85], [0, 2.6, 0.75], [-0.2, 1.4, 0.7], [1.3, 1.2, 0.55]]) { g.fillStyle = ink('#ffc4d6'); circ(g, x, y, r); } g.fillStyle = ink('#ffe0ea'); for (const [x, y] of [[-1.2, 2.2], [0.7, 2.3], [-0.2, 2.9]]) circ(g, x, y, 0.2); } },
  villus: { w: 1.8, h: 6.0, d(g, ink) { g.fillStyle = ink('#ffa0a8'); rr(g, -0.7, 0, 1.4, 5.8, 0.7); g.fillStyle = ink('#ffc0c6'); rr(g, -0.35, 1.0, 0.4, 4.0, 0.2); } },
  mushProp: { w: 3.2, h: 3.0, d(g, ink) { g.fillStyle = ink('#f4ecd8'); rr(g, -0.4, 0, 0.8, 1.8, 0.3); g.fillStyle = ink('#ff6a5a'); g.beginPath(); g.ellipse(0, 1.7, 1.5, 1.2, 0, 0, Math.PI); g.fill(); g.fillStyle = ink('#ffffff', 'print'); for (const [x, y] of [[-0.7, 2.2], [0.2, 2.6], [0.8, 2.1], [-0.1, 2.0]]) circ(g, x, y, 0.16); } },
  lymphLight: { w: 1.6, h: 4.4, glow: true, d(g, ink) { g.fillStyle = ink('#5a6aa8'); rr(g, -0.12, 0, 0.24, 3.4, 0.08); g.fillStyle = ink('#9fe8ff'); circ(g, 0, 3.6, 0.65); g.fillStyle = ink('#e8fbff'); circ(g, -0.15, 3.75, 0.2); } },
  neuron: { w: 3.8, h: 3.8, d(g, ink) { g.fillStyle = ink('#d0b0ff'); for (const a of [0.5, 1.3, 2.1, 2.8]) fillLimb(g, 0, 1.6, Math.cos(a) * 1.0, 1.6 + Math.sin(a) * 1.0, Math.cos(a) * 1.8, 1.6 + Math.sin(a) * 1.9, 0.3, 0.1, 8); rr(g, -0.12, 0, 0.24, 1.4, 0.08); g.fillStyle = ink('#b48ae8'); circ(g, 0, 1.6, 0.9); g.fillStyle = ink('#8a5ad0'); circ(g, 0.1, 1.65, 0.35); } },
  cloud: { w: 3.6, h: 2.0, d(g, ink) { g.fillStyle = ink('#8a9ad8'); for (const [x, y, r] of [[-1.1, 0.7, 0.7], [0, 1.0, 0.95], [1.1, 0.7, 0.7], [0.5, 0.45, 0.5], [-0.5, 0.45, 0.5]]) circ(g, x, y, r); g.fillStyle = ink('#aab8ec'); ell(g, -0.2, 1.3, 0.6, 0.25); } },
  // 투사체·효과(작은 조각)
  granule: { w: 0.9, h: 0.9, small: true, d(g, ink) { g.fillStyle = ink('#ff8ab4'); circ(g, 0, 0.45, 0.42); g.fillStyle = ink('#ffd0e0'); circ(g, -0.1, 0.55, 0.12); } },
  antibody: { w: 1.1, h: 1.1, small: true, d(g, ink) { g.fillStyle = ink('#ffd84a'); Y(g, 0, 0.05, 1.5, 0); } },
  pierce: { w: 1.6, h: 0.7, small: true, d(g, ink) { g.fillStyle = ink('#ff8a3a'); poly(g, [[-0.75, 0.25], [0.45, 0.2], [0.78, 0.35], [0.45, 0.5], [-0.75, 0.45]]); } },
  toxinShot: { w: 0.9, h: 1.0, small: true, d(g, ink) { g.fillStyle = ink('#5aff6a'); g.beginPath(); g.moveTo(0, 0.95); g.quadraticCurveTo(0.4, 0.4, 0.3, 0.25); g.arc(0, 0.3, 0.3, 0, Math.PI); g.quadraticCurveTo(-0.4, 0.4, 0, 0.95); g.fill(); } },
  bit: { w: 0.6, h: 0.6, small: true, plain: true, d(g, ink) { g.fillStyle = ink('#ffffff'); poly(g, [[-0.28, 0.05], [0.25, 0.0], [0.3, 0.5], [-0.22, 0.55]]); } },
};
export const SCALE = 0.25;   // 카드 단위 → 보드 단위

/** 프리팹 정의(Baker). quality: 'high' | 'mid' | 'low' */
export function defineAll(baker, paper, quality = 'high', contact = '#5a2a3a') {
  const low = quality === 'low';
  for (const [k, D] of Object.entries(DRAW)) {
    baker.define(k, () => {
      const [pts, paint] = P2.drawnPiece(D.d, { w: D.w * 1.22, h: D.h * 1.14, res: D.small ? 60 : 40, finish: !D.small, name: k });
      const card = makeCard(pts, {
        paint: D.plain ? (P) => P.fill('#ffffff') : paint, paper, thickness: D.small ? 0.05 : 0.08, edgeWidth: D.small ? 0.03 : 0.06,
        pxPerUnit: (D.small ? 40 : 52) * (low ? 0.7 : 1), seed: k.length * 7 + 3, back: false, effects: low ? 0 : 1,
        contact: D.small ? null : { amount: 0.13, height: 0.45, color: contact }, folds: ['bottom'],
      });
      const g = new THREE.Group(); g.add(card);
      if (D.glow) card.material[0].emissive && card.material[0].emissive.set('#9fe8ff');
      return { segs: [{ obj: g, hinge: { at: [0, 0, 0], axis: 'x' } }], double: true, shadow: !D.small || k === 'bit' ? true : false, glowColor: '#9fe8ff' };
    });
  }
}
