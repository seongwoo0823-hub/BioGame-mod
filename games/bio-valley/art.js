// 바이오 밸리: 종이 조각 인쇄(그림) + 조립. 모든 조각은 카드 두께가 있는 판지이고, 그림은 겹겹이 붙인 종이 콜라주.
// 좌표: 카드 안에서 x 오른쪽, y 위, 접는 선은 y = 0. 조립된 프리팹은 바닥 y = 0, 정면 +z.
import * as THREE from 'three';
import { makeCard, crossCard } from './lib/paperkit-3d.js';
import * as P2 from './lib/paperkit-2d.js';

const { shape, shade, mix, rgba, toRGB, fillLeaf, fillLimb, motif, scallopTiles, rng } = P2;
export const TILE = 6;          // 타일 한 칸 = 6 단위
export const PERSON_H = 2.6;    // 사람 키

// ---------------------------------------------------------------------------------------------------------------
// 공용 도구
// ---------------------------------------------------------------------------------------------------------------
const lum = (c) => { const [r, g, b] = toRGB(c); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };
function baseSheet(P, c, k = 0.1, ang = 0.6, felt = 1) { P.gradient(shade(c, k), shade(c, -k), ang); if (felt) P.felt(felt); }
function inner(P, c, a = 0.3, blur = 10) { P.innerShade(shade(c, -0.62), { alpha: a, blurPx: blur }); }
const ell = (g, x, y, rx, ry, a = 0) => { g.beginPath(); g.ellipse(x, y, Math.max(1e-4, rx), Math.max(1e-4, ry), a, 0, Math.PI * 2); g.fill(); };
const rr = (g, x, y, w, h, r) => { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2)); else g.rect(x, y, w, h); g.fill(); };
const poly = (g, pts) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); };
const circ = (g, x, y, r) => ell(g, x, y, r, r);
function thin(pts, n) { if (pts.length <= n) return pts; const out = [], k = pts.length / n; for (let i = 0; i < n; i++) out.push(pts[Math.floor(i * k)]); return out; }

// 작은 그림 아이콘(간판·로고): 카드 좌표에서 (x, y) 중심, 크기 s
export const ICON = {
  leaf(g, x, y, s, c) { g.fillStyle = c; fillLeaf(g, x - s * 0.42, y - s * 0.3, s * 0.95, 0.75, 0.42); },
  dna(g, x, y, s, c, c2) {
    g.lineWidth = s * 0.11; g.lineCap = 'round';
    for (let k = 0; k < 2; k++) {
      g.strokeStyle = k ? c2 : c; g.beginPath();
      for (let i = 0; i <= 20; i++) { const t = i / 20, yy = y - s * 0.5 + t * s, xx = x + Math.sin(t * Math.PI * 2 + k * Math.PI) * s * 0.28; i ? g.lineTo(xx, yy) : g.moveTo(xx, yy); }
      g.stroke();
    }
    g.lineWidth = s * 0.06; g.strokeStyle = c;
    for (let i = 1; i < 6; i++) { const t = i / 6, yy = y - s * 0.5 + t * s, a = Math.sin(t * Math.PI * 2) * s * 0.28; g.beginPath(); g.moveTo(x + a, yy); g.lineTo(x - a, yy); g.stroke(); }
  },
  cross(g, x, y, s, c) { g.fillStyle = c; rr(g, x - s * 0.15, y - s * 0.45, s * 0.3, s * 0.9, s * 0.05); rr(g, x - s * 0.45, y - s * 0.15, s * 0.9, s * 0.3, s * 0.05); },
  cup(g, x, y, s, c) { g.fillStyle = c; poly(g, [[x - s * 0.38, y + s * 0.2], [x + s * 0.3, y + s * 0.2], [x + s * 0.22, y - s * 0.35], [x - s * 0.3, y - s * 0.35]]); g.lineWidth = s * 0.1; g.strokeStyle = c; g.beginPath(); g.arc(x + s * 0.32, y - s * 0.05, s * 0.15, -1.4, 1.4); g.stroke(); g.lineWidth = s * 0.06; for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(x + i * s * 0.14, y + s * 0.28); g.quadraticCurveTo(x + i * s * 0.14 + s * 0.08, y + s * 0.4, x + i * s * 0.14, y + s * 0.52); g.stroke(); } },
  flask(g, x, y, s, c, c2) { g.fillStyle = c; poly(g, [[x - s * 0.1, y + s * 0.5], [x + s * 0.1, y + s * 0.5], [x + s * 0.1, y + s * 0.15], [x + s * 0.4, y - s * 0.45], [x - s * 0.4, y - s * 0.45], [x - s * 0.1, y + s * 0.15]]); g.fillStyle = c2; poly(g, [[x + s * 0.24, y - s * 0.15], [x + s * 0.36, y - s * 0.4], [x - s * 0.36, y - s * 0.4], [x - s * 0.24, y - s * 0.15]]); },
  microscope(g, x, y, s, c) { g.fillStyle = c; rr(g, x - s * 0.4, y - s * 0.5, s * 0.8, s * 0.12, s * 0.04); rr(g, x - s * 0.08, y - s * 0.45, s * 0.12, s * 0.5, s * 0.04); g.save(); g.translate(x + s * 0.05, y + s * 0.1); g.rotate(-0.5); rr(g, -s * 0.09, -s * 0.15, s * 0.18, s * 0.6, s * 0.06); g.restore(); rr(g, x - s * 0.3, y - s * 0.08, s * 0.5, s * 0.08, s * 0.03); },
  seed(g, x, y, s, c, c2) { g.fillStyle = c; ell(g, x, y - s * 0.1, s * 0.28, s * 0.36, 0.3); g.fillStyle = c2; fillLeaf(g, x, y + s * 0.15, s * 0.42, 1.0, 0.4); fillLeaf(g, x, y + s * 0.15, s * 0.36, 2.2, 0.4); },
  drop(g, x, y, s, c) { g.fillStyle = c; g.beginPath(); g.moveTo(x, y + s * 0.5); g.bezierCurveTo(x + s * 0.12, y + s * 0.2, x + s * 0.36, y, x + s * 0.36, y - s * 0.18); g.arc(x, y - s * 0.18, s * 0.36, 0, Math.PI, true); g.bezierCurveTo(x - s * 0.36, y, x - s * 0.12, y + s * 0.2, x, y + s * 0.5); g.fill(); },
  recycle(g, x, y, s, c) { g.strokeStyle = c; g.fillStyle = c; g.lineWidth = s * 0.13; g.lineCap = 'round'; for (let k = 0; k < 3; k++) { const a = k * 2.094 + 0.4; g.beginPath(); g.arc(x, y, s * 0.32, a, a + 1.5); g.stroke(); const ax = x + Math.cos(a + 1.5) * s * 0.32, ay = y + Math.sin(a + 1.5) * s * 0.32, t = a + 1.5 + Math.PI / 2; poly(g, [[ax + Math.cos(t) * s * 0.16, ay + Math.sin(t) * s * 0.16], [ax + Math.cos(t - 2.3) * s * 0.14, ay + Math.sin(t - 2.3) * s * 0.14], [ax + Math.cos(t + 2.3) * s * 0.14, ay + Math.sin(t + 2.3) * s * 0.14]]); } },
  mushroom(g, x, y, s, c, c2) { g.fillStyle = c2; rr(g, x - s * 0.1, y - s * 0.45, s * 0.2, s * 0.5, s * 0.08); g.fillStyle = c; g.beginPath(); g.ellipse(x, y + s * 0.02, s * 0.45, s * 0.36, 0, 0, Math.PI); g.fill(); },
  sun(g, x, y, s, c) { g.fillStyle = c; circ(g, x, y, s * 0.22); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; g.save(); g.translate(x + Math.cos(a) * s * 0.36, y + Math.sin(a) * s * 0.36); g.rotate(a); rr(g, -s * 0.09, -s * 0.04, s * 0.18, s * 0.08, s * 0.03); g.restore(); } },
  box(g, x, y, s, c, c2) { g.fillStyle = c; rr(g, x - s * 0.4, y - s * 0.35, s * 0.8, s * 0.6, s * 0.06); g.fillStyle = c2; rr(g, x - s * 0.06, y - s * 0.35, s * 0.12, s * 0.6, 0); rr(g, x - s * 0.4, y + s * 0.15, s * 0.8, s * 0.1, 0); },
  book(g, x, y, s, c, c2) { g.fillStyle = c; poly(g, [[x, y - s * 0.3], [x - s * 0.45, y - s * 0.2], [x - s * 0.45, y + s * 0.35], [x, y + s * 0.25]]); g.fillStyle = c2; poly(g, [[x, y - s * 0.3], [x + s * 0.45, y - s * 0.2], [x + s * 0.45, y + s * 0.35], [x, y + s * 0.25]]); },
  vial(g, x, y, s, c, c2) { g.save(); g.translate(x, y); g.rotate(-0.6); g.fillStyle = c; rr(g, -s * 0.12, -s * 0.45, s * 0.24, s * 0.75, s * 0.1); g.fillStyle = c2; rr(g, -s * 0.12, -s * 0.45, s * 0.24, s * 0.36, s * 0.1); g.fillStyle = c; rr(g, -s * 0.18, s * 0.28, s * 0.36, s * 0.1, s * 0.03); rr(g, -s * 0.03, s * 0.36, s * 0.06, s * 0.18, 0); g.restore(); },
  bottle(g, x, y, s, c, c2) { g.fillStyle = c; rr(g, x - s * 0.2, y - s * 0.5, s * 0.4, s * 0.72, s * 0.1); rr(g, x - s * 0.08, y + s * 0.18, s * 0.16, s * 0.2, s * 0.02); g.fillStyle = c2; fillLeaf(g, x - s * 0.1, y - s * 0.25, s * 0.28, 0.8, 0.45); },
  fuel(g, x, y, s, c, c2) { ICON.drop(g, x, y, s, c); g.fillStyle = c2; fillLeaf(g, x - s * 0.08, y - s * 0.28, s * 0.3, 0.9, 0.45); },
  tree(g, x, y, s, c, c2) { g.fillStyle = c2; rr(g, x - s * 0.06, y - s * 0.5, s * 0.12, s * 0.4, 0); g.fillStyle = c; circ(g, x, y + s * 0.05, s * 0.34); },
  heart(g, x, y, s, c) { g.fillStyle = c; g.beginPath(); g.moveTo(x, y - s * 0.38); g.bezierCurveTo(x - s * 0.6, y + s * 0.05, x - s * 0.25, y + s * 0.5, x, y + s * 0.2); g.bezierCurveTo(x + s * 0.25, y + s * 0.5, x + s * 0.6, y + s * 0.05, x, y - s * 0.38); g.fill(); },
  algae(g, x, y, s, c) { g.fillStyle = c; for (const [dx, dy, r] of [[0, 0, 0.2], [0.28, 0.12, 0.14], [-0.26, 0.16, 0.13], [0.12, -0.28, 0.12], [-0.2, -0.22, 0.1]]) circ(g, x + dx * s, y + dy * s, r * s); },
  gear(g, x, y, s, c) { g.fillStyle = c; for (let k = 0; k < 8; k++) { g.save(); g.translate(x, y); g.rotate(k * Math.PI / 4); rr(g, -s * 0.08, s * 0.24, s * 0.16, s * 0.18, s * 0.03); g.restore(); } circ(g, x, y, s * 0.3); },
};

// ---------------------------------------------------------------------------------------------------------------
// 아트 공장
// ---------------------------------------------------------------------------------------------------------------
export function createArt(paper, { quality = 'high', contact = '#5a3214', decorPpu = 34, buildPpu = 30 } = {}) {
  const eff = quality === 'low' ? 0 : 1;
  const lowQ = quality === 'low';
  const card = (pts, paint, o = {}) => makeCard(pts, {
    paint, paper, thickness: o.t ?? 0.07, edgeWidth: o.edge ?? 0.06, pxPerUnit: (o.ppu ?? buildPpu) * (lowQ ? 0.75 : 1), seed: o.seed ?? 1,
    back: o.back ?? false, folds: o.folds ?? ['bottom'], contact: o.contact === false ? null : { amount: 0.12, height: o.contactH ?? 0.5, color: contact },
    effects: eff, materials: o.materials || null, geomPts: o.geomPts || null, ...(o.rimLight ? { rimLight: o.rimLight } : {}),
  });
  const cross = (pts, paint, o = {}) => crossCard(pts, {
    paint, paper, thickness: o.t ?? 0.07, edgeWidth: o.edge ?? 0.06, pxPerUnit: (o.ppu ?? decorPpu) * (lowQ ? 0.75 : 1), seed: o.seed ?? 1,
    back: false, contact: { amount: 0.12, height: 0.6, color: contact }, effects: eff,
  });
  const at = (obj, x = 0, y = 0, z = 0, ry = 0, rx = 0) => { obj.position.set(x, y, z); obj.rotation.set(rx, ry, 0); return obj; };
  const grp = (...k) => { const g = new THREE.Group(); for (const o of k) if (o) g.add(o); return g; };
  const one = (obj, o = {}) => ({ segs: [{ obj, hinge: o.hinge }], face: !!o.face, radius: o.radius || 3, double: !!o.double, shadow: o.shadow, glowColor: o.glowColor });

  // =============================================================================================================
  // 자연
  // =============================================================================================================
  // 활엽수: 왕관 한 장 + 줄기·가지 한 장 + 굵은 잎 15~25장(대비되는 두 색) + 열매
  function paintBroadleaf(c, { trunkTop = 0.32, leaves = 20, limbs = 5, fruit = null, blossom = null, snow = null } = {}) {
    return (P) => {
      const { box, r } = P, leaf = c.leaf, [a1, a2] = c.accents;
      const cy0 = box.y0 + box.h * trunkTop, cx = (box.x0 + box.x1) / 2, rx = box.w / 2, ry = (box.y1 - cy0) / 2, cy = cy0 + ry;
      const T = box.w * 0.13;
      baseSheet(P, leaf, 0.12, 0.6);
      const tips = [], sx = cx + (r() - 0.5) * T * 0.3, sy = cy0 + ry * 0.3;
      P.layer((g) => {
        fillLimb(g, cx, box.y0 - box.h * 0.03, cx, (box.y0 + sy) / 2, sx, sy, T, T * 0.5);
        for (let i = 0; i <= limbs; i++) {
          const t = i / limbs - 0.5, a = t * 2.2 + (r() - 0.5) * 0.25, len = 0.74 + r() * 0.12;
          const ex = sx + Math.sin(a) * rx * len, ey = sy + Math.cos(a) * (cy + ry * 0.66 - sy) * len, mx = sx + (ex - sx) * 0.3, my = sy + (ey - sy) * 0.72;
          fillLimb(g, sx, sy, mx, my, ex, ey, T * 0.36, T * 0.1);
          tips.push([ex, ey, Math.atan2(ey - my, ex - mx)]);
        }
      }, c.trunk, { lip: 0.8 });
      const Lb = box.w * 0.15, placed = [];
      for (const [x, y, a] of tips) placed.push({ x, y, a: a + (r() - 0.5) * 0.4, L: Lb * (0.9 + r() * 0.25) });
      for (let guard = 0; placed.length < leaves && guard < 700; guard++) {
        const ang = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.86, x = cx + Math.cos(ang) * rx * d, y = cy + Math.sin(ang) * ry * d;
        if (Math.abs(x - cx) < T * 0.7 && y < sy + ry * 0.15) continue;
        if (placed.some((q) => Math.hypot(q.x - x, q.y - y) < Lb * 0.85)) continue;
        const a = Math.atan2(y - sy, x - sx) + (r() - 0.5) * 1.3;
        placed.push({ x: x - Math.cos(a) * Lb * 0.5, y: y - Math.sin(a) * Lb * 0.5, a, L: Lb * (0.85 + r() * 0.3) });
      }
      const tones = [a1, a2, shade(leaf, -0.28)], toneOf = (k) => (k % 10 < 6 ? 0 : k % 10 < 9 ? 1 : 2);
      if (!blossom) {
        P.layer((g) => { placed.forEach((q, i) => { g.fillStyle = tones[toneOf(i)]; fillLeaf(g, q.x, q.y, q.L, q.a); }); }, a1, { lip: 0.7, depth: 0.83 });
        P.draw((g) => { g.lineWidth = Lb * 0.035; g.lineCap = 'round'; placed.forEach((q, i) => { const cc = Math.cos(q.a), s = Math.sin(q.a); g.strokeStyle = rgba(shade(tones[toneOf(i)], -0.35), 0.5); g.beginPath(); g.moveTo(q.x + cc * q.L * 0.15, q.y + s * q.L * 0.15); g.lineTo(q.x + cc * q.L * 0.78, q.y + s * q.L * 0.78); g.stroke(); }); });
      } else {
        // 꽃나무: 잎 대신 다섯 잎 꽃송이(두 가지 분홍) + 몇 장의 연두 잎
        P.layer((g) => { placed.slice(0, Math.round(placed.length * 0.35)).forEach((q) => { g.fillStyle = blossom.leaf; fillLeaf(g, q.x, q.y, q.L * 0.8, q.a); }); }, blossom.leaf, { lip: 0.6, depth: 0.7 });
        P.layer((g) => { for (let i = 0; i < placed.length + 6; i++) { const q = placed[i % placed.length], rad = Lb * (0.32 + r() * 0.14); motif.flower(g, q.x + Math.cos(q.a) * q.L * 0.5 + (r() - 0.5) * Lb * 0.4, q.y + Math.sin(q.a) * q.L * 0.5, rad, i % 3 ? blossom.a : blossom.b, null); } }, blossom.a, { lip: 0.75, depth: 0.8 });
        P.draw((g) => { g.fillStyle = blossom.centre; for (let i = 0; i < placed.length; i++) { const q = placed[i]; circ(g, q.x + Math.cos(q.a) * q.L * 0.5, q.y + Math.sin(q.a) * q.L * 0.5, Lb * 0.06); } });
      }
      if (fruit) P.layer((g) => { for (let i = 0; i < 6; i++) { const q = placed[Math.floor(r() * placed.length)]; for (let k = 0; k < 3; k++) circ(g, q.x + (r() - 0.5) * Lb * 0.6, q.y + (r() - 0.5) * Lb * 0.6, box.w * 0.022); } }, fruit, { lip: 0.8, depth: 0.6 });
      if (snow) P.layer((g) => { g.fillStyle = snow; for (let i = 0; i < 7; i++) { const a = Math.PI * (0.15 + 0.7 * i / 6), x = cx + Math.cos(a) * rx * 0.82, y = cy + Math.sin(a) * ry * 0.86; ell(g, x, y, rx * 0.22, ry * 0.1, -Math.cos(a) * 0.4); } }, snow, { rim: 0.6, lip: 0.6, depth: 0.8 });
      inner(P, leaf, 0.3, 12);
    };
  }
  function broadleafPts(r, { w = 5, h = 7, trunkTop = 0.32, lobes = 7, depth = 0.14, narrow = 1 } = {}) {
    const ry = h * (1 - trunkTop) / 2, rx = w / 2 * narrow;
    return thin(shape.radial(r, { cx: 0, cy: h * trunkTop + ry, rx, ry, lobes, depth, n: 90, stalk: { w: w * 0.13, base: 0 } }), 40);
  }

  // 침엽수: 아래부터 겹친 층마다 가장자리, 바늘잎 선, 눈 덮개(선택)
  function pinePts(tiers, w, h) {
    const trunkH = h * 0.12, th = (h - trunkH) / tiers, R = [], L = [];
    for (let k = 0; k < tiers; k++) {
      const yb = trunkH + k * th, hw = w / 2 * (1 - k / tiers * 0.72), hw2 = hw * 0.42;
      R.push([hw, yb], [hw2, yb + th * 0.92]);
    }
    const right = [[w * 0.07, 0], [w * 0.07, trunkH], ...R, [0, h]];
    const left = right.slice(0, -1).reverse().map(([x, y]) => [-x, y]);
    return [...right, ...left];
  }
  function paintPine(c, { tiers = 4, snow = null } = {}) {
    return (P) => {
      const { box, r } = P, w = box.w, h = box.h, trunkH = h * 0.12, th = (h - trunkH) / tiers;
      const tones = [c.leaf, mix(c.leaf, '#c9c27a', 0.12)], pale = mix(c.leaf, '#f0eaa8', 0.6), dark = shade(c.leaf, -0.4);
      P.fill(shade(c.leaf, -0.18)); P.felt(1);
      P.layer((g) => g.fillRect(-w * 0.07, -0.1, w * 0.14, trunkH + th * 0.5), c.trunk, { lip: 0.6 });
      for (let k = 0; k < tiers; k++) {
        const yb = trunkH + k * th, hw = w / 2 * (1 - k / tiers * 0.72), top = k + 1 < tiers ? yb + th * 1.5 : h + 0.1;
        const n = Math.max(3, Math.round(hw * 2 / (w * 0.2))), sw = hw * 2.1 / n, dep = Math.min(sw * 0.3, h * 0.035);
        P.layer((g) => {
          g.beginPath(); g.moveTo(-hw * 1.05, yb + dep);
          for (let i = 0; i < n; i++) { const x0 = -hw * 1.05 + i * sw; g.quadraticCurveTo(x0 + sw / 2, yb - dep, x0 + sw, yb + dep); }
          g.lineTo(0, top); g.closePath(); g.fill();
        }, tones[k % 2], { rim: 1, lip: 0.7, depth: 1 });
        P.draw((g) => {
          for (const [col, m] of [[pale, 5], [dark, 3]]) { g.fillStyle = col; for (let i = 0; i < m; i++) { const u = (r() - 0.5) * 1.4; fillLeaf(g, u * hw * 0.8, yb + dep * 1.4 + r() * th * 0.45, th * (0.3 + r() * 0.12), -Math.PI / 2 + u * 0.55, 0.16); } }
        });
        if (snow) P.layer((g) => {   // 층 윗면의 눈: 둥근 덩어리 띠
          const yy = yb + th * 0.55, hw3 = hw * 0.72;
          g.beginPath(); g.moveTo(-hw3, yy);
          const m = Math.max(3, Math.round(hw3 * 2 / (w * 0.16)));
          for (let i = 0; i < m; i++) { const x0 = -hw3 + i * hw3 * 2 / m; g.quadraticCurveTo(x0 + hw3 / m, yy - th * 0.22, x0 + hw3 * 2 / m, yy); }
          g.lineTo(hw3 * 0.5, yy + th * 0.35); g.lineTo(-hw3 * 0.5, yy + th * 0.35); g.closePath(); g.fill();
        }, snow, { rim: 0.8, lip: 0.8, depth: 0.8 });
      }
      inner(P, c.leaf, 0.32, 10);
    };
  }

  // 덤불: 둥근 몸통 + 안쪽 띠 + 장식(열매·꽃) + 발치 풀
  function paintBush(c, { flowers = null, berries = null, snow = null, grass = true } = {}) {
    return (P) => {
      const { box, r, U } = P, cx = (box.x0 + box.x1) / 2;
      baseSheet(P, c.leaf, 0.12, 0.4);
      const m = shape.mound(r, { w: box.w * 0.72, h: box.h * 0.7, lobes: 5, depth: 0.12, n: 60 }).map(([x, y]) => [x + cx, y + box.y0]);
      P.layer(m, c.inner, { rim: 0.8, lip: 0.8 });
      if (berries) P.layer((g) => { for (let i = 0; i < 6; i++) motif.berries(g, cx + (r() - 0.5) * box.w * 0.7, box.y0 + box.h * (0.35 + r() * 0.45), U * 0.05, berries, r); }, berries, { lip: 0.7, depth: 0.6 });
      if (flowers) {
        const nf = Math.max(3, Math.round(box.w / U * 2.2)), fl = Array.from({ length: nf }, (_, i) => [cx + box.w * 0.78 * ((i + 0.5) / nf - 0.5) + (r() - 0.5) * U * 0.1, box.y0 + box.h * (0.4 + r() * 0.42), U * (0.11 + r() * 0.04), i % 2]);
        P.layer((g) => { for (const [x, y, rad, k] of fl) { g.fillStyle = k ? flowers[1] : flowers[0]; motif.flower(g, x, y, rad, null, null); } }, flowers[0], { lip: 0.6, depth: 0.75 });
        P.draw((g) => { g.fillStyle = flowers[2] || '#e0a33a'; for (const [x, y, rad] of fl) circ(g, x, y, rad * 0.3); });
      }
      if (snow) P.layer((g) => { g.fillStyle = snow; const mm = shape.mound(r, { w: box.w * 0.86, h: box.h * 0.3, lobes: 6, depth: 0.2, n: 40 }); poly(g, mm.map(([x, y]) => [x + cx, box.y1 - box.h * 0.3 + y])); }, snow, { rim: 0.8, lip: 0.8 });
      if (grass) P.layer((g) => { for (const [col, mN, sp] of [[shade(c.grass, -0.1), 5, 1.0], [shade(c.grass, 0.16), 3, 0.7]]) { g.fillStyle = col; for (let i = 0; i < mN; i++) { const u = (i + 0.5) / mN - 0.5; fillLeaf(g, cx + u * box.w * 0.8 * sp, box.y0 - box.h * 0.04, box.h * (0.26 + r() * 0.1), Math.PI / 2 - u * 1.2, 0.18); } } }, c.grass, { lip: 0.7, depth: 0.75 });
      inner(P, c.leaf, 0.3, 10);
    };
  }

  // 바위: 접힌 면 두 개 + 점무늬 + 덮개(이끼·눈·모래)
  function rockPts(r, w, h) {
    const n = 7, pts = [[w / 2, 0]];
    for (let i = 1; i < n; i++) { const a = i / n * Math.PI, k = 0.82 + r() * 0.22; pts.push([Math.cos(a) * w / 2 * k, Math.sin(a) * h * k * (0.85 + 0.15 * Math.sin(a))]); }
    pts.push([-w / 2, 0]);
    return pts;
  }
  function paintRock(c, { cap = null } = {}) {
    return (P) => {
      const { box, r } = P, s = c.stone;
      baseSheet(P, s, 0.14, 0.6, 1.3);
      const line = (x) => [[x, box.y1 + 1], [x + box.w * 0.12, box.y0 + box.h * 0.62], [x + box.w * 0.2, box.y0 + box.h * 0.34], [x + box.w * 0.32, box.y0 - 1]];
      const a0 = box.x0 + box.w * (0.34 + r() * 0.1), b0 = a0 + box.w * (0.15 + r() * 0.05);
      P.layer([...line(b0), [box.x1 + 1, box.y0 - 1], [box.x1 + 1, box.y1 + 1]], shade(s, -0.08), { lip: 0, shadow: 0, shade: 0.3, felt: 1.2 });
      P.layer([...line(a0), ...line(b0).reverse()], shade(s, -0.3), { lip: 0, shadow: 0.5, shade: 0.3, felt: 1.2 });
      P.marks('dot', { color: shade(s, -0.5), alpha: 0.45, size: 0.03, density: 0.5 });
      P.marks('dot', { color: shade(s, 0.45), alpha: 0.4, size: 0.025, density: 0.3 });
      if (cap) P.layer(shape.mound(r, { w: box.w * 0.7, h: box.h * 0.26, lobes: 6, depth: 0.25, n: 40 }).map(([x, y]) => [x + box.x0 + box.w * 0.42, box.y1 - box.h * 0.24 + y]), cap, { rim: 0.7 });
      inner(P, s, 0.32, 10);
    };
  }

  // 언덕·사구·눈더미: 위쪽 밝은 띠 + 아래 진한 띠 + 드문 무늬
  function paintHill(c, { marks = null, peaks = false, snowcap = null } = {}) {
    return (P) => {
      const { pts, box, U, r } = P, g0 = c.ground;
      P.gradient(shade(g0, 0.12), shade(g0, -0.15), 0); P.felt(1);
      P.layer((gg) => { gg.beginPath(); let first = true; for (const [x, y] of pts) { if (y < box.y0 + 1e-6) { first = true; continue; } if (first) { gg.moveTo(x, y); first = false; } else gg.lineTo(x, y); } gg.lineWidth = U * 0.14; gg.stroke(); }, shade(g0, 0.3), { lip: 0.8, shadow: 0.8, shade: 0 });
      P.layer((gg) => { gg.beginPath(); let first = true; for (const [x, y] of pts) { if (y < box.y0 + 1e-6) { first = true; continue; } const yy = y - U * 0.26; if (first) { gg.moveTo(x, yy); first = false; } else gg.lineTo(x, yy); } gg.lineTo(box.x1 + 1, box.y0 - 1); gg.lineTo(box.x0 - 1, box.y0 - 1); gg.closePath(); gg.fill(); }, g0, { lip: 0.6, shadow: 1, shade: 0.4 });
      if (snowcap) P.layer((gg) => { gg.beginPath(); let first = true; for (const [x, y] of pts) { if (y < box.y1 - box.h * 0.38) { if (!first) { gg.closePath(); gg.fill(); first = true; } continue; } if (first) { gg.beginPath(); gg.moveTo(x, y); first = false; } else gg.lineTo(x, y + (r() - 0.5) * U * 0.04); } if (!first) { gg.closePath(); gg.fill(); } }, snowcap, { rim: 0.8, lip: 0.8 });
      if (marks === 'trees') P.layer((gg) => { for (let i = 0; i < Math.round(box.w / U * 6); i++) { const x = box.x0 + r() * box.w, top = (P2.spanAt(pts.map(([a, b]) => [b, a]), x) || [0, box.h * 0.4])[1]; const y = box.y0 + r() * Math.max(0.1, top - box.y0 - U * 0.2); poly(gg, [[x - U * 0.07, y], [x + U * 0.07, y], [x, y + U * 0.22]]); } }, c.mark, { lip: 0.5, depth: 0.6 });
      else if (marks) P.marks('dot', { color: c.mark, alpha: 0.7, size: 0.05, density: 0.3 });
      inner(P, g0, 0.35, 16);
    };
  }

  // 버섯 무리(가을): 굵은 대 + 점무늬 갓
  function mushroomPiece(r, c) {
    const caps = [[0, 1.0, 0.75], [0.8, 0.62, 0.5], [-0.75, 0.5, 0.42]].map(([x, h, s]) => [x * 1.45, h * 1.45, s * 1.45]);
    return P2.drawnPiece((g, ink) => {
      g.fillStyle = ink(c.stem); rr(g, -1.4, 0, 2.8, 0.25, 0.1);
      for (const [x, h, s] of caps) { g.fillStyle = ink(c.stem); rr(g, x - s * 0.22, 0, s * 0.44, h, s * 0.15); }
      for (const [x, h, s] of caps) { g.fillStyle = ink(c.cap); g.beginPath(); g.ellipse(x, h, s * 0.8, s * 0.62, 0, 0, Math.PI); g.fill(); }
      for (const [x, h, s] of caps) { g.fillStyle = ink(c.dot, 'print'); for (let k = 0; k < 4; k++) circ(g, x + (k - 1.5) * s * 0.34, h + s * (0.22 + (k % 2) * 0.18), s * 0.09); }
    }, { w: 4.8, h: 2.9, res: 30, name: 'mushroom' });
  }

  // 선인장(사막): 팔 달린 기둥, 세로 골, 꽃
  function saguaroPts(r, h) {
    return shape.fromDrawing((g) => {
      rr(g, -0.6, 0, 1.2, h, 0.6);
      const ay = h * (0.35 + r() * 0.1), ah = h * 0.32;
      rr(g, -1.35, ay, 1.0, 0.55, 0.27); rr(g, -1.35, ay, 0.62, ah, 0.31);
      if (r() < 0.8) { const by = h * (0.48 + r() * 0.1); rr(g, 0.55, by, 0.8, 0.5, 0.25); rr(g, 0.85, by, 0.62, ah * 0.8, 0.31); }
    }, { w: 3.2, h: h + 0.2, res: 30 });
  }
  function paintCactus(c) {
    return (P) => {
      const { box, r } = P;
      baseSheet(P, c.leaf, 0.12, 0.6);
      P.marks('hatch', { color: shade(c.leaf, -0.35), alpha: 0.35, size: 0.07, angle: Math.PI / 2 });
      P.layer((g) => { g.lineWidth = box.w * 0.035; g.lineCap = 'round'; g.strokeStyle = shade(c.leaf, 0.22); for (let x = box.x0 + box.w * 0.18; x < box.x1; x += box.w * 0.16) { g.beginPath(); g.moveTo(x, box.y0 + 0.1); g.lineTo(x, box.y1 - 0.2); g.stroke(); } }, shade(c.leaf, 0.22), { lip: 0.6, depth: 0.5 });
      P.draw((g) => { g.fillStyle = rgba('#fff4d8', 0.85); for (let i = 0; i < 40; i++) circ(g, box.x0 + r() * box.w, box.y0 + r() * box.h, box.w * 0.008); });
      P.layer((g) => { for (let i = 0; i < 3; i++) motif.flower(g, (r() - 0.5) * 0.5, box.y1 - 0.25 - r() * 0.3, 0.2, i % 2 ? c.flower : c.flower2, null); }, c.flower, { lip: 0.7, depth: 0.6 });
      inner(P, c.leaf, 0.3, 10);
    };
  }

  // 야자수(사막 오아시스): 마디 줄기 + 부채꼴 잎
  function palmPts(r, h) {
    return shape.fromDrawing((g) => {
      g.beginPath(); g.moveTo(-0.28, 0); g.quadraticCurveTo(0.3, h * 0.5, 0.15, h * 0.82); g.lineTo(0.45, h * 0.82); g.quadraticCurveTo(0.6, h * 0.5, 0.28, 0); g.closePath(); g.fill();
      for (let k = 0; k < 7; k++) { const a = Math.PI * (0.05 + k * 0.15), L = h * (0.32 + r() * 0.06); g.fillStyle = '#000'; fillLeaf(g, 0.3, h * 0.83, L, a + Math.PI * 0.0 - (a > Math.PI / 2 ? 0.25 : -0.25) * 0.0, 0.26); }
      circ(g, 0.3, h * 0.84, 0.35);
    }, { w: h * 0.9, h: h * 1.2, res: 26 });
  }
  function paintPalm(c) {
    return (P) => {
      const { box, r } = P, h = box.h / 1.15;
      baseSheet(P, c.leaf, 0.1, 0.5);
      P.layer((g) => { g.beginPath(); g.moveTo(-0.28, -0.1); g.quadraticCurveTo(0.3, h * 0.5, 0.15, h * 0.84); g.lineTo(0.45, h * 0.84); g.quadraticCurveTo(0.6, h * 0.5, 0.28, -0.1); g.closePath(); g.fill(); }, c.trunk, { lip: 0.7 });
      P.draw((g) => { g.strokeStyle = shade(c.trunk, -0.35); g.lineWidth = 0.06; for (let y = 0.3; y < h * 0.8; y += 0.32) { g.beginPath(); g.moveTo(-0.1 + y * 0.05, y); g.lineTo(0.42 + y * 0.03, y + 0.06); g.stroke(); } });
      P.layer((g) => { for (let k = 0; k < 7; k++) { const a = Math.PI * (0.05 + k * 0.15), L = h * 0.33; g.fillStyle = k % 2 ? c.accents[0] : c.accents[1]; fillLeaf(g, 0.3, h * 0.83, L, a, 0.2); } }, c.accents[0], { lip: 0.8, depth: 0.9 });
      P.layer((g) => { for (let k = 0; k < 4; k++) circ(g, 0.15 + k * 0.12, h * 0.8 - (k % 2) * 0.12, 0.13); }, c.fruit, { lip: 0.7, depth: 0.6 });
      inner(P, c.leaf, 0.25, 10);
    };
  }

  // 꽃밭(봄): 낮은 둔덕 + 줄기 + 꽃
  function paintMeadow(c) {
    return (P) => {
      const { box, r, U } = P, cx = (box.x0 + box.x1) / 2;
      baseSheet(P, c.leaf, 0.1, 0.4);
      P.layer((g) => { g.fillStyle = shade(c.leaf, 0.15); for (let i = 0; i < 9; i++) { const u = (i + 0.5) / 9 - 0.5; fillLeaf(g, cx + u * box.w * 0.9, box.y0, box.h * (0.6 + r() * 0.3), Math.PI / 2 - u * 0.8, 0.14); } }, shade(c.leaf, 0.15), { lip: 0.6, depth: 0.6 });
      const fl = Array.from({ length: 7 }, (_, i) => [cx + box.w * 0.82 * ((i + 0.5) / 7 - 0.5), box.y0 + box.h * (0.55 + r() * 0.35), U * (0.16 + r() * 0.05), i % 3]);
      P.layer((g) => { for (const [x, y, rad, k] of fl) { g.fillStyle = c.flowers[k]; motif.flower(g, x, y, rad, null, null); } }, c.flowers[0], { lip: 0.7, depth: 0.75 });
      P.draw((g) => { g.fillStyle = '#e0a33a'; for (const [x, y, rad] of fl) circ(g, x, y, rad * 0.3); });
      inner(P, c.leaf, 0.25, 8);
    };
  }

  // 고사리(소나무 숲): 잎 갈래가 많은 부채
  function fernPts(r) { return thin(shape.radial(r, { cx: 0, cy: 0.2, rx: 2.1, ry: 1.5, lobes: 9, depth: 0.45, spiky: true, n: 120 }).filter(([, y]) => y >= 0).concat([[-1.2, 0], [1.2, 0]]).sort((a, b) => Math.atan2(a[1] - 0.01, a[0]) - Math.atan2(b[1] - 0.01, b[0])), 48); }
  function paintFern(c) {
    return (P) => {
      const { box, r } = P;
      baseSheet(P, c.leaf, 0.12, 0.4);
      P.layer((g) => { for (let k = 0; k < 7; k++) { const a = Math.PI * (0.12 + k * 0.127), L = box.h * (0.8 + r() * 0.2); g.save(); g.translate(0, 0); g.rotate(a - Math.PI / 2); g.fillStyle = k % 2 ? c.accents[0] : c.accents[1]; for (let i = 1; i < 6; i++) { fillLeaf(g, 0, L * i / 6, L * 0.24 * (1 - i / 8), 0.5, 0.3); fillLeaf(g, 0, L * i / 6, L * 0.24 * (1 - i / 8), Math.PI - 0.5, 0.3); } g.restore(); } }, c.accents[0], { lip: 0.6, depth: 0.7 });
      inner(P, c.leaf, 0.3, 8);
    };
  }

  // 그루터기·통나무
  function paintLog(c) {
    return (P) => {
      const { box } = P;
      baseSheet(P, c.trunk, 0.1, 0.6);
      P.marks('hatch', { color: shade(c.trunk, -0.35), alpha: 0.3, size: 0.08, angle: 0.05 });
      P.layer((g) => ell(g, box.x1 - box.h * 0.35, box.y0 + box.h * 0.5, box.h * 0.32, box.h * 0.42), c.ring, { lip: 0.8, rim: 0.6 });
      P.draw((g) => { g.strokeStyle = shade(c.ring, -0.3); g.lineWidth = 0.04; for (let k = 1; k < 4; k++) { g.beginPath(); g.ellipse(box.x1 - box.h * 0.35, box.y0 + box.h * 0.5, box.h * 0.08 * k, box.h * 0.1 * k, 0, 0, Math.PI * 2); g.stroke(); } });
      P.layer(shape.mound(P.r, { w: box.w * 0.5, h: box.h * 0.25, lobes: 5, depth: 0.25, n: 30 }).map(([x, y]) => [x + box.x0 + box.w * 0.35, y + box.y1 - box.h * 0.2]), c.moss, { rim: 0.6 });
      inner(P, c.trunk, 0.3, 8);
    };
  }

  /** 지형 장식 프리팹 정의. kind 이름과 변형 번호로 꺼내 쓴다. biome: biomes.js 의 정의 */
  function decorPrefab(biome, kind, v) {
    const r = rng(1000 + v * 97 + kind.length * 13 + biome.seed), C = biome.colors, s = 0.85 + r() * 0.3;
    switch (kind) {
      case 'broadleaf': case 'blossom': case 'maple': case 'birch': case 'snowtree': {
        const d = biome.trees[kind], w = d.w * s, h = d.h * s;
        const pts = broadleafPts(r, { w, h, trunkTop: d.trunkTop || 0.32, narrow: d.narrow || 1, lobes: d.lobes || 7 });
        const colors = { leaf: d.leaf[v % d.leaf.length], trunk: d.trunk, accents: d.accents[v % d.accents.length] };
        return one(cross(pts, paintBroadleaf(colors, { trunkTop: d.trunkTop || 0.32, fruit: d.fruit, blossom: d.blossom, snow: d.snow, leaves: d.leaves || 20 }), { seed: v + 3 }), { radius: w / 2 });
      }
      case 'pine': case 'fir': {
        const d = biome.trees[kind], w = d.w * s, h = d.h * s, tiers = d.tiers || 4;
        return one(cross(pinePts(tiers, w, h), paintPine({ leaf: d.leaf[v % d.leaf.length], trunk: d.trunk }, { tiers, snow: d.snow }), { seed: v + 5 }), { radius: w / 2 });
      }
      case 'saguaro': { const h = 7.5 * s; return one(cross(saguaroPts(r, h), paintCactus(C.cactus), { seed: v }), { radius: 1.4 }); }
      case 'palm': { const h = 7 * s; return one(cross(palmPts(r, h), paintPalm(C.palm), { seed: v }), { radius: 2.5 }); }
      case 'bush': {
        const w = 4.2 * s, h = 2.3 * s;
        const pts = shape.mound(r, { w, h, lobes: 6, depth: 0.16, n: 36 });
        const d = biome.bush;
        return one(card(pts, paintBush({ leaf: d.leaf[v % d.leaf.length], inner: d.inner, grass: d.grass }, { flowers: d.flowers, berries: d.berries, snow: d.snow }), { ppu: decorPpu, seed: v + 11 }), { face: true, radius: 1.4 });
      }
      case 'rock': {
        const w = 3.8 * s, h = 2.4 * s;
        return one(card(rockPts(r, w, h), paintRock({ stone: C.stone }, { cap: C.rockCap }), { ppu: decorPpu, seed: v + 21 }), { face: true, radius: 1.3 });
      }
      case 'mushroom': { const [pts, paint] = mushroomPiece(r, C.mushroom); return one(card(pts, paint, { ppu: decorPpu, seed: v + 31 }), { face: true, radius: 1.2 }); }
      case 'meadow': { const pts = shape.mound(r, { w: 3.6 * s, h: 1.5 * s, lobes: 7, depth: 0.2, n: 34 }); return one(card(pts, paintMeadow(C.meadow), { ppu: decorPpu, seed: v + 41 }), { face: true, radius: 1.2 }); }
      case 'fern': return one(card(fernPts(r), paintFern(C.fern), { ppu: decorPpu, seed: v + 51 }), { face: true, radius: 1.2 });
      case 'log': { const pts = P2.shape.rect(3.6 * s, 1.2 * s).map(([x, y]) => [x, y]); return one(card(pts, paintLog(C.log), { ppu: decorPpu, seed: v + 61 }), { face: true, radius: 1.3 }); }
      case 'agave': { const pts = thin(shape.radial(r, { cx: 0, cy: 0, rx: 2.0 * s, ry: 1.8 * s, lobes: 9, depth: 0.55, spiky: true, n: 140 }).filter(([, y]) => y >= -0.01).map(([x, y]) => [x, Math.max(0, y)]), 46); return one(card(pts, paintFern({ leaf: C.agave.leaf, accents: C.agave.accents }), { ppu: decorPpu, seed: v + 71 }), { face: true, radius: 1.2 }); }
      case 'barrel': { const pts = shape.mound(r, { w: 2.2 * s, h: 2.3 * s, lobes: 3, depth: 0.06, n: 40 }); return one(card(pts, paintCactus(C.cactus), { ppu: decorPpu, seed: v + 81 }), { face: true, radius: 0.8 }); }
      case 'drift': case 'dune': case 'hill': {
        // 겹친 언덕 3장(뒤가 진하고 높음)
        const d = biome.drift, g = new THREE.Group(), W = (kind === 'hill' ? 9 : 8) * s;
        for (let k = 0; k < 3; k++) {
          const pts = shape.hill(r, { w: W * (1 - k * 0.15), h: (1.9 - k * 0.45) * s, bumps: 2, n: 36 });
          const c = { ground: shade(d.ground, -0.12 + k * 0.1), mark: d.mark };
          g.add(at(card(pts, paintHill(c, { marks: d.marks }), { ppu: decorPpu * 0.8, seed: v * 7 + k }), (k - 1) * 0.5 * s, 0, k * 0.55));
        }
        return one(g, { face: true, radius: W / 2 });
      }
    }
    throw new Error('decor ' + kind);
  }

  /** 맵 바깥 배경 능선(크게 겹친 언덕·산) */
  function ridgePrefab(biome, v) {
    const r = rng(500 + v * 31 + biome.seed), d = biome.ridge, g = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const W = 46 - k * 6, H = (d.h - k * d.h * 0.22);
      let pts;
      if (d.peaks) {
        pts = [[-W / 2, 0]];
        const n = 4 + Math.floor(r() * 2);
        for (let i = 0; i <= n; i++) { const x = -W / 2 + (i + 0.5) * W / (n + 1); pts.push([x - W / (n + 1) * 0.35, H * (0.35 + r() * 0.2)], [x + (r() - 0.5) * 1.2, H * (0.75 + r() * 0.25)], [x + W / (n + 1) * 0.35, H * (0.4 + r() * 0.2)]); }
        pts.push([W / 2, 0]);
      } else if (d.mesa) {
        pts = [[-W / 2, 0], [-W * 0.42, H * 0.5], [-W * 0.3, H * 0.92], [-W * 0.05, H], [W * 0.02, H * 0.7], [W * 0.15, H * 0.72], [W * 0.25, H * 0.95], [W * 0.38, H * 0.9], [W * 0.47, H * 0.3], [W / 2, 0]];
      } else pts = shape.hill(r, { w: W, h: H, bumps: 3, n: 70 });
      const c = { ground: shade(d.ground, -0.14 + k * 0.1), mark: d.mark };
      g.add(at(card(pts, paintHill(c, { marks: d.marks, snowcap: d.snowcap }), { ppu: 10, seed: v * 5 + k, edge: 0.1, t: 0.12 }), (k - 1) * 3, 0, k * 2.4));
    }
    return one(g, { radius: 24 });
  }

  return { card, cross, at, grp, one, decorPrefab, ridgePrefab, paintBroadleaf, broadleafPts, paintPine, pinePts, paintBush, paintRock, rockPts, paintHill, paintMeadow, eff, lowQ, buildPpu, decorPpu };
}

export { ell, rr, poly, circ, thin, lum, baseSheet, inner };
