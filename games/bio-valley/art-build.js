// 바이오 밸리: 건물·사람·차·생물 종이 모형
import * as THREE from 'three';
import * as P2 from './lib/paperkit-2d.js';
import { ICON, ell, rr, poly, circ, baseSheet, inner, TILE, PERSON_H } from './art.js';

const { shape, shade, mix, rgba, fillLeaf, motif, scallopTiles, rng } = P2;

export function createBuildArt(A, biome) {
  const S = biome.style, card = A.card, at = A.at;
  const ppu = A.buildPpu;

  // ------------------------------------------------------------------------------------------------------------
  // 벽 인쇄: 바탕 두 톤 → 재료(벽돌·판자·패널·유리) → 아래 띠 → 창문(틀·유리·턱) → 문 → 간판 → 안쪽 그늘
  // ------------------------------------------------------------------------------------------------------------
  function paintWall(o = {}) {
    const wall = o.wall || S.wall, mat = o.mat || S.mat;
    return (P) => {
      const { box, r, g } = P, W = box.w, H = o.h || box.h, x0 = box.x0;
      baseSheet(P, wall, 0.09, 0.5);
      // 재료
      if (mat === 'plank') P.layer((gg) => { const n = Math.max(3, Math.round(H / 0.55)); for (let i = 0; i < n; i++) { gg.fillStyle = [wall, shade(wall, -0.08), shade(wall, 0.07)][i % 3]; gg.fillRect(x0 - 1, i * H / n + 0.03, W + 2, H / n - 0.06); } }, wall, { lip: 0.6, shadow: 0.7, shade: 0.3, depth: 0.6 });
      else if (mat === 'brick') P.layer((gg) => { for (const col of [shade(wall, 0.14), shade(wall, -0.12)]) { gg.fillStyle = col; for (let i = 0; i < 9; i++) { const corner = r() < 0.7, x = corner ? (r() < 0.5 ? x0 + W * 0.08 * r() + 0.05 : box.x1 - W * 0.12 * r() - 0.3) : x0 + W * r(); const y = r() * H * (corner ? 1 : 0.3); rr(gg, x, y, 0.32 + r() * 0.15, 0.18, 0.04); } } }, wall, { lip: 0.6, depth: 0.5 });
      else if (mat === 'panel') P.marks('panel', { color: shade(wall, -0.3), alpha: 0.35, size: Math.min(1.2, H / 3), units: true, width: 1.4 });
      else if (mat === 'adobe') P.layer((gg) => { for (let i = 0; i < 8; i++) { gg.fillStyle = i % 2 ? shade(wall, 0.1) : shade(wall, -0.07); ell(gg, x0 + r() * W, r() * H, 0.25 + r() * 0.3, 0.12 + r() * 0.12); } }, wall, { lip: 0.5, shadow: 0.5, depth: 0.5 });
      else if (mat === 'log') P.layer((gg) => { const n = Math.max(3, Math.round(H / 0.5)); for (let i = 0; i < n; i++) { gg.fillStyle = [wall, shade(wall, -0.1), shade(wall, 0.06)][i % 3]; rr(gg, x0 - 0.2, i * H / n + 0.02, W + 0.4, H / n - 0.04, H / n * 0.5); } }, wall, { lip: 0.7, shadow: 0.8, depth: 0.6 });
      // 아래 띠
      P.layer((gg) => gg.fillRect(x0 - 1, -0.1, W + 2, Math.min(0.5, H * 0.09) + 0.1), o.plinth || S.plinth, { lip: 0.7, shadow: 0.8 });
      // 창문
      const storeys = o.storeys ?? Math.max(1, Math.floor(H / 2.4)), wins = o.windows ?? Math.max(1, Math.round(W / 2)), sh = H / storeys;
      const ww = Math.min(1.1, W / wins * 0.5), wh = Math.min(sh * 0.48, 1.3);
      const slots = [];
      for (let s = 0; s < storeys; s++) for (let i = 0; i < wins; i++) {
        const cx = x0 + (i + 0.5) * W / wins, cy = s * sh + sh * 0.52;
        if (o.door && s === 0 && Math.abs(cx - (o.doorX || 0)) < ww * 1.2) continue;
        slots.push([cx, cy]);
      }
      if (o.glass) {
        P.layer((gg) => { for (let s = 0; s < storeys; s++) gg.fillRect(x0 + W * 0.06, s * sh + sh * 0.2, W * 0.88, sh * 0.62); }, S.trim, { lip: 0.7 });
        P.layer((gg) => { for (let s = 0; s < storeys; s++) { const n = Math.max(2, Math.round(W / 1.2)); for (let i = 0; i < n; i++) gg.fillRect(x0 + W * 0.06 + 0.08 + i * (W * 0.88 - 0.08) / n, s * sh + sh * 0.2 + 0.08, (W * 0.88 - 0.08) / n - 0.08, sh * 0.62 - 0.16); } }, S.glass, { lip: 0.5, shadow: 0.6, depth: 0.6 });
        P.draw((gg) => { gg.strokeStyle = rgba('#ffffff', 0.45); gg.lineWidth = 0.08; for (let s = 0; s < storeys; s++) for (let i = 0; i < 3; i++) { const x = x0 + W * (0.15 + i * 0.3) + r() * 0.3, y = s * sh + sh * 0.3; gg.beginPath(); gg.moveTo(x, y); gg.lineTo(x + 0.35, y + sh * 0.35); gg.stroke(); } });
        P.glow((gg) => { gg.globalAlpha = 0.5; for (let s = 0; s < storeys; s++) gg.fillRect(x0 + W * 0.1, s * sh + sh * 0.25, W * 0.8, sh * 0.5); });
      } else if (slots.length) {
        const round = o.round ?? S.roundWindows;
        P.layer((gg) => { for (const [cx, cy] of slots) round ? rr(gg, cx - ww / 2 - 0.1, cy - wh / 2 - 0.1, ww + 0.2, wh + 0.2, ww * 0.5) : gg.fillRect(cx - ww / 2 - 0.1, cy - wh / 2 - 0.1, ww + 0.2, wh + 0.2); }, S.trim, { lip: 0.7 });
        P.layer((gg) => { for (const [cx, cy] of slots) { const lit = r() < 0.75; gg.fillStyle = lit ? S.window : shade(S.window, -0.45); round ? rr(gg, cx - ww / 2, cy - wh / 2, ww, wh, ww * 0.45) : gg.fillRect(cx - ww / 2, cy - wh / 2, ww, wh); } }, S.window, { lip: 0.4, shadow: 0.8, depth: 0.7 });
        P.draw((gg) => { gg.strokeStyle = S.trim; gg.lineWidth = 0.08; for (const [cx, cy] of slots) { gg.beginPath(); gg.moveTo(cx, cy - wh / 2); gg.lineTo(cx, cy + wh / 2 * (round ? 0.7 : 1)); gg.moveTo(cx - ww / 2, cy); gg.lineTo(cx + ww / 2, cy); gg.stroke(); } });
        P.glow((gg) => { for (const [cx, cy] of slots) gg.fillRect(cx - ww / 2 + 0.05, cy - wh / 2 + 0.05, ww - 0.1, wh - 0.1); });
        if (o.sills !== false) P.layer((gg) => { for (const [cx, cy] of slots) gg.fillRect(cx - ww / 2 - 0.18, cy - wh / 2 - 0.22, ww + 0.36, 0.14); }, shade(S.trim, 0.25), { lip: 0.8, depth: 0.5 });
        if (o.flowerbox ?? S.flowerbox) P.layer((gg) => { for (const [cx, cy] of slots) { if (cy > sh) continue; gg.fillStyle = S.accent; rr(gg, cx - ww / 2, cy - wh / 2 - 0.42, ww, 0.24, 0.05); for (let k = 0; k < 3; k++) { gg.fillStyle = k % 2 ? S.flower : S.flower2; circ(gg, cx - ww * 0.3 + k * ww * 0.3, cy - wh / 2 - 0.16, 0.12); } } }, S.accent, { lip: 0.6, depth: 0.5 });
      }
      // 문
      if (o.door) {
        const dx = o.doorX || 0, dw = o.doorW || 1.0, dh = Math.min(sh * 0.72, o.doorH || 1.8);
        P.layer((gg) => rr(gg, dx - dw / 2 - 0.1, 0, dw + 0.2, dh + 0.1, dw * 0.5), S.trim, { lip: 0.6 });
        P.layer((gg) => rr(gg, dx - dw / 2, 0, dw, dh, dw * 0.45), o.doorCol || S.door, { lip: 0.6, rim: 0.5, depth: 0.7 });
        P.draw((gg) => { gg.strokeStyle = shade(o.doorCol || S.door, -0.3); gg.lineWidth = 0.05; gg.beginPath(); gg.moveTo(dx, 0.05); gg.lineTo(dx, dh * 0.85); gg.stroke(); gg.fillStyle = '#e8c060'; circ(gg, dx + dw * 0.3, dh * 0.45, 0.06); });
      }
      // 간판·로고
      if (o.sign) {
        const [sx, sy, ss] = o.signAt || [0, H * 0.82, Math.min(1.6, W * 0.3)];
        P.layer((gg) => rr(gg, sx - ss * 0.62, sy - ss * 0.45, ss * 1.24, ss * 0.9, ss * 0.2), o.signBg || S.signBg, { lip: 0.8, rim: 0.6, depth: 0.8 });
        P.draw((gg) => ICON[o.sign](gg, sx, sy, ss * 0.72, o.signFg || S.accent, o.signFg2 || S.flower));
      }
      if (o.extra) o.extra(P);
      inner(P, wall, 0.22, 12);
    };
  }

  // 지붕 인쇄(경사면): 처마가 y = 0, 용마루가 위
  function paintRoof(o = {}) {
    const col = o.roof || S.roof, kind = o.kind || S.roofKind;
    return (P) => {
      const { box, r } = P;
      baseSheet(P, shade(col, -0.1), 0.08, 0.3);
      if (kind === 'metal') { P.layer((gg) => { const n = Math.round(box.w / 0.6); for (let i = 0; i < n; i++) { gg.fillStyle = i % 2 ? col : shade(col, -0.08); gg.fillRect(box.x0 + i * box.w / n + 0.03, box.y0 - 1, box.w / n - 0.06, box.h + 2); } }, col, { lip: 0.6, shadow: 0.6, depth: 0.5 }); }
      else if (kind === 'glass') { P.fill(S.glass); P.layer((gg) => { const n = Math.round(box.w / 1.1), m = Math.round(box.h / 1.1); for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) gg.fillRect(box.x0 + i * box.w / n + 0.07, box.y0 + j * box.h / m + 0.07, box.w / n - 0.14, box.h / m - 0.14); }, mix(S.glass, '#ffffff', 0.2), { lip: 0.6, shadow: 0.4, depth: 0.5 }); P.draw((gg) => { gg.fillStyle = rgba(o.plant || '#5f8f45', 0.55); for (let i = 0; i < 26; i++) fillLeaf(gg, box.x0 + r() * box.w, box.y0 + r() * box.h * 0.6, 0.5, Math.PI / 2 + (r() - 0.5), 0.35); }); }
      else scallopTiles(P, { x0: box.x0, x1: box.x1, y0: box.y0, y1: box.y1 }, { color: col, rows: Math.max(3, Math.round(box.h / 0.75)) });
      if (o.snow ?? S.snowRoof) P.layer((gg) => { const yb = box.y0 + box.h * 0.32; gg.beginPath(); gg.moveTo(box.x0 - 1, box.y1 + 1); gg.lineTo(box.x0 - 1, yb); const n = Math.round(box.w / 0.9); for (let i = 0; i < n; i++) { const xa = box.x0 + i * box.w / n; gg.quadraticCurveTo(xa + box.w / n / 2, yb - 0.45 - r() * 0.15, xa + box.w / n, yb); } gg.lineTo(box.x1 + 1, box.y1 + 1); gg.closePath(); gg.fill(); }, '#f4f6f8', { rim: 0.8, lip: 0.8, depth: 1 });
      inner(P, col, 0.2, 10);
    };
  }
  // 평지붕(뚜껑): 자갈·옥상정원·태양광
  function paintLid(o = {}) {
    return (P) => {
      const { box, r } = P, c = o.col || S.lid;
      baseSheet(P, c, 0.06, 0.4);
      P.marks('dot', { color: shade(c, -0.35), alpha: 0.4, size: 0.04, density: 0.6 });
      P.layer((gg) => { gg.lineWidth = 0.3; gg.strokeStyle = shade(c, 0.18); gg.strokeRect(box.x0 + 0.2, box.y0 + 0.2, box.w - 0.4, box.h - 0.4); }, shade(c, 0.18), { lip: 0.6, depth: 0.6 });
      if (o.garden) P.layer((gg) => { for (let i = 0; i < 7; i++) { gg.fillStyle = i % 2 ? '#7d9f55' : '#5f8a48'; ell(gg, box.x0 + 0.7 + r() * (box.w - 1.4), box.y0 + 0.7 + r() * (box.h - 1.4), 0.5, 0.4); } }, '#6f9a50', { lip: 0.6 });
      if (o.solar) P.layer((gg) => { const n = Math.max(1, Math.floor((box.w - 1) / 1.3)); for (let i = 0; i < n; i++) gg.fillRect(box.x0 + 0.6 + i * 1.3, box.y0 + box.h * 0.3, 1.1, box.h * 0.4); }, '#3f5f8f', { lip: 0.7 });
      if (o.vent) P.layer((gg) => { circ(gg, box.x1 - 1, box.y1 - 1, 0.45); circ(gg, box.x0 + 1.1, box.y1 - 1.1, 0.35); }, '#b8bcc0', { lip: 0.7, rim: 0.5 });
    };
  }

  // ------------------------------------------------------------------------------------------------------------
  // 조립 도구
  // ------------------------------------------------------------------------------------------------------------
  const FOLD_SIDES = ['bottom', 'left', 'right'];
  // 상자: 앞·뒤·좌·우 벽 + 지붕(gable/flat/shed/none). 정면 +z. seed 로 인쇄를 바꿈
  function box({ w, d, h, front, back, side, roof = 'gable', rh = null, roofPaint = null, lidPaint = null, over = 0.35, seed = 1, parapet = false, sideGable = true }) {
    const g = new THREE.Group(), t = 0.07;
    const R = rh ?? Math.min(2.4, d * 0.42);
    const gable = roof === 'gable';
    const mk = (W, Hh, paint, s, pent) => card(pent ? [[-W / 2, 0], [W / 2, 0], [W / 2, Hh], [0, Hh + R], [-W / 2, Hh]] : P2.shape.rect(W, Hh), paint, { seed: seed + s, folds: FOLD_SIDES });
    g.add(at(mk(w, h, front, 1, false), 0, 0, d / 2 - t / 2));
    g.add(at(mk(w, h, back || front, 2, false), 0, 0, -d / 2 + t / 2, Math.PI));
    const sp = side || front;
    g.add(at(mk(d - t, h, sp, 3, gable && sideGable), w / 2 - t / 2, 0, 0, Math.PI / 2));
    g.add(at(mk(d - t, h, sp, 4, gable && sideGable), -w / 2 + t / 2, 0, 0, -Math.PI / 2));
    if (gable) {
      const Sx = Math.hypot(d / 2, R), L = Sx + over, rp = roofPaint || paintRoof();
      for (const side2 of [1, -1]) {
        const pv = new THREE.Group(); pv.position.set(0, h + R, 0); pv.rotation.y = side2 > 0 ? 0 : Math.PI;
        // 카드: 처마 y=0, 용마루 y=L. 용마루가 회전축(pv)에 오도록 아래로 L, 기울임의 +y 는 용마루 쪽(위·뒤)
        const sl = card(P2.shape.rect(w + over * 2, L), rp, { seed: seed + 7 + side2, folds: ['top'] });
        sl.position.y = -L;
        const tilt = new THREE.Group(); tilt.add(sl);
        tilt.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, R, -d / 2).normalize());
        pv.add(tilt); g.add(pv);
      }
    } else if (roof === 'flat' || roof === 'lid') {
      const lid = card(P2.shape.rect(w, d).map(([x, y]) => [x, y - d / 2]), lidPaint || paintLid(), { seed: seed + 9, folds: [], contact: false });
      g.add(at(lid, 0, h, 0, 0, -Math.PI / 2));
      if (parapet) {
        const pp = paintWall({ wall: shade(S.wall, -0.06), mat: 'none', storeys: 0, windows: 0 });
        for (const [W2, x, z, ry] of [[w, 0, d / 2 - t * 1.5, 0], [w, 0, -d / 2 + t * 1.5, Math.PI], [d - 0.3, w / 2 - t * 1.5, 0, Math.PI / 2], [d - 0.3, -w / 2 + t * 1.5, 0, -Math.PI / 2]]) g.add(at(card(P2.shape.rect(W2, 0.5), pp, { seed: seed + 13, ppu: ppu * 0.6 }), x, h, z, ry));
      }
    } else if (roof === 'shed') {
      const Sx = Math.hypot(d, R), rp = roofPaint || paintRoof({ kind: 'metal' });
      const sl = card(P2.shape.rect(w + over * 2, Sx + over), rp, { seed: seed + 8, folds: [] });
      const tilt = new THREE.Group(); tilt.position.set(0, h, d / 2 + over * 0.5);
      tilt.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, R, -d).normalize());
      tilt.add(sl); g.add(tilt);
    }
    return g;
  }
  // 원통 탱크(n각): 옆면 인쇄 한 번을 모든 면이 공유
  function tank({ r = 1.2, h = 3, n = 10, paint, lid = 'cone', lidPaint = null, seed = 1, coneH = null }) {
    const g = new THREE.Group(), w = 2 * r * Math.sin(Math.PI / n) + 0.02, a0 = r * Math.cos(Math.PI / n);
    let first = null;
    for (let i = 0; i < n; i++) {
      const c = card(P2.shape.rect(w, h), paint, { seed, folds: FOLD_SIDES, materials: first ? first.material : null });
      if (!first) first = c;
      const a = i / n * Math.PI * 2;
      g.add(at(c, Math.sin(a) * a0, 0, Math.cos(a) * a0, a));
    }
    if (lid === 'cone') {
      const ch = coneH ?? r * 0.6, sl = Math.hypot(a0, ch), tri = [[-w / 2, 0], [w / 2, 0], [0, sl]];
      let f2 = null;
      for (let i = 0; i < n; i++) {
        const c = card(tri, lidPaint || paint, { seed: seed + 3, folds: ['bottom'], materials: f2 ? f2.material : null, contact: false });
        if (!f2) f2 = c;
        const a = i / n * Math.PI * 2, pv = new THREE.Group(); pv.position.set(Math.sin(a) * a0, h, Math.cos(a) * a0); pv.rotation.y = a;
        const tilt = new THREE.Group(); tilt.rotation.x = -Math.atan2(a0, ch); tilt.add(c); pv.add(tilt); g.add(pv);
      }
    } else if (lid === 'flat') {
      const pts = Array.from({ length: n }, (_, i) => { const a = (i + 0.5) / n * Math.PI * 2; return [Math.sin(a) * r, Math.cos(a) * r]; });
      const c = card(pts, lidPaint || paintLid({ col: shade(S.metal, 0.05) }), { seed: seed + 5, folds: [], contact: false });
      g.add(at(c, 0, h, 0, 0, -Math.PI / 2));
    } else if (lid === 'dome') g.add(at(dome({ r, paint: lidPaint || paint, seed: seed + 7 }), 0, h, 0));
    return g;
  }
  // 반구: 줄어드는 원통 세 층을 쌓은 계단 돔(종이 띠를 둘러 붙인 모양)
  function dome({ r = 2, paint, seed = 1 }) {
    const g = new THREE.Group();
    const tiers = [[1, 0.34], [0.8, 0.3], [0.52, 0.26]];
    let y = 0;
    tiers.forEach(([k, hk], i) => { g.add(at(tank({ r: r * k, h: r * hk, n: 12, paint, lid: i === tiers.length - 1 ? 'flat' : 'none', lidPaint: paintLid({ col: shade(S.metal, 0.08) }), seed: seed + i }), 0, y, 0)); y += r * hk; });
    return g;
  }
  // 굴뚝(작은 상자)
  function chimney(x, y, z, { w = 0.7, h = 1.4, col = S.chimney } = {}) {
    const p = paintWall({ wall: col, mat: 'brick', storeys: 0, windows: 0 });
    return at(box({ w, d: w, h, front: p, roof: 'lid', lidPaint: (P) => { P.fill(shade(col, -0.5)); }, seed: 91 }), x, y, z);
  }
  // 평평한 받침(마당·밭): 땅에 붙은 인쇄 카드
  function pad(w, d, paint, seed = 1) { const g = new THREE.Group(); g.add(at(card(P2.shape.rect(w, d).map(([x, y]) => [x, y - d / 2]), paint, { seed, folds: [], contact: false, t: 0.05, ppu: ppu * 0.7 }), 0, 0.04, 0, 0, -Math.PI / 2)); return g; }
  const padPaint = (c, kind = 'paving') => (P) => {
    const { box, r } = P; baseSheet(P, c, 0.05, 0.3);
    if (kind === 'paving') P.layer((gg) => { const n = Math.round(box.w / 0.9), m = Math.round(box.h / 0.9); for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { if (r() < 0.3) continue; gg.fillStyle = r() < 0.5 ? shade(c, 0.07) : shade(c, -0.06); rr(gg, box.x0 + i * box.w / n + 0.06, box.y0 + j * box.h / m + 0.06, box.w / n - 0.12, box.h / m - 0.12, 0.08); } }, c, { lip: 0.5, shadow: 0.5, depth: 0.5 });
    else if (kind === 'crops') { P.layer((gg) => { const rows = Math.round(box.h / 1.0); for (let j = 0; j < rows; j++) gg.fillRect(box.x0 + 0.3, box.y0 + j * box.h / rows + 0.25, box.w - 0.6, box.h / rows - 0.5); }, '#8a6a44', { lip: 0.5, depth: 0.5 }); P.layer((gg) => { const rows = Math.round(box.h / 1.0); for (let j = 0; j < rows; j++) for (let x = box.x0 + 0.6; x < box.x1 - 0.4; x += 0.7) { gg.fillStyle = (j + Math.round(x)) % 2 ? '#7fa65a' : '#5f8f45'; ell(gg, x, box.y0 + (j + 0.5) * box.h / rows, 0.3, 0.26); } }, '#6f9a50', { lip: 0.7, depth: 0.6 }); }
    else if (kind === 'pond') { P.layer((gg) => ell(gg, 0, 0, box.w * 0.42, box.h * 0.4), '#7fb3b0', { lip: 0.6, rim: 0.8 }); P.marks('wave', { color: '#e8f2ee', alpha: 0.6, size: 0.25, units: true, region: { x0: -box.w * 0.3, x1: box.w * 0.3, y0: -box.h * 0.25, y1: box.h * 0.25 } }); }
    else if (kind === 'algae') { P.layer((gg) => { for (const [x, y] of [[-box.w * 0.22, 0], [box.w * 0.22, 0]]) { gg.beginPath(); gg.ellipse(x, y, box.w * 0.2, box.h * 0.4, 0, 0, Math.PI * 2); gg.fill(); } }, '#5f9a52', { lip: 0.6, rim: 0.8 }); P.marks('dab', { color: '#9fd06a', alpha: 0.6, size: 0.3, units: true, density: 0.5 }); }
  };
  // 작은 소품 카드
  function propCard(kind, seed = 1) {
    const r = rng(seed * 13 + kind.length);
    if (kind === 'bench') {
      const pts = [[-1, 0], [-0.9, 0], [-0.9, 0.45], [0.9, 0.45], [0.9, 0], [1, 0], [1, 1.0], [-1, 1.0]];
      return card(pts, (P) => { baseSheet(P, '#9a6a3c', 0.1); P.layer((gg) => { for (let i = 0; i < 3; i++) gg.fillRect(-1, 0.48 + i * 0.18, 2, 0.13); }, '#b8844e', { lip: 0.7, depth: 0.5 }); inner(P, '#9a6a3c', 0.3, 6); }, { seed, ppu: 40 });
    }
    if (kind === 'lamp') {
      const pts = [[-0.12, 0], [0.12, 0], [0.12, 2.3], [0.4, 2.4], [0.3, 2.9], [-0.3, 2.9], [-0.4, 2.4], [-0.12, 2.3]];
      return card(pts, (P) => { baseSheet(P, '#3f4a4a', 0.1); P.layer((gg) => rr(gg, -0.25, 2.42, 0.5, 0.36, 0.1), '#f4d27a', { lip: 0.5 }); P.glow((gg) => rr(gg, -0.22, 2.45, 0.44, 0.3, 0.1)); }, { seed, ppu: 40 });
    }
    if (kind === 'flowerbed') {
      const pts = shape.mound(r, { w: 2, h: 0.8, lobes: 6, depth: 0.2, n: 40 });
      return card(pts, A.paintMeadow({ leaf: '#6f9a50', flowers: [S.flower, S.flower2, '#f2e3c0'] }), { seed, ppu: 40 });
    }
    if (kind === 'crate') {
      return card(P2.shape.rect(1.1, 1.0), (P) => { baseSheet(P, '#c09a62', 0.1); P.layer((gg) => { gg.fillRect(-0.55, 0.05, 1.1, 0.16); gg.fillRect(-0.55, 0.8, 1.1, 0.16); gg.fillRect(-0.55, 0.05, 0.16, 0.9); gg.fillRect(0.39, 0.05, 0.16, 0.9); }, '#9a7444', { lip: 0.7 }); P.draw((gg) => ICON.leaf(gg, 0, 0.5, 0.45, '#4f7a3a')); }, { seed, ppu: 40 });
    }
    if (kind === 'barrel') {
      return card(P2.shape.rect(0.9, 1.2), (P) => { baseSheet(P, '#4f8f7a', 0.12); P.layer((gg) => { gg.fillRect(-0.45, 0.2, 0.9, 0.12); gg.fillRect(-0.45, 0.88, 0.9, 0.12); }, '#c8c0a8', { lip: 0.7 }); P.draw((gg) => ICON.recycle(gg, 0, 0.6, 0.35, '#e8e0c8')); }, { seed, ppu: 40 });
    }
    if (kind === 'flag') {
      const pts = [[-0.06, 0], [0.06, 0], [0.06, 2.4], [1.3, 2.4], [1.1, 2.75], [1.3, 3.1], [0.06, 3.1], [0.06, 3.2], [-0.06, 3.2]];
      return card(pts, (P) => { baseSheet(P, '#8a8478', 0.1); P.layer([[0.06, 2.4], [1.3, 2.4], [1.1, 2.75], [1.3, 3.1], [0.06, 3.1]], S.accent, { lip: 0.7 }); P.draw((gg) => ICON.leaf(gg, 0.6, 2.75, 0.4, '#f2e3c0')); }, { seed, ppu: 40, back: false });
    }
    if (kind === 'tree') {
      const d = biome.trees[biome.parkTree], pts = A.broadleafPts(r, { w: 2.6, h: 3.8 });
      const colors = { leaf: d.leaf[0], trunk: d.trunk, accents: d.accents[0] };
      return A.cross(pts, A.paintBroadleaf(colors, { blossom: d.blossom, snow: d.snow, leaves: 16 }), { seed });
    }
    if (kind === 'bush') {
      const d = biome.bush, pts = shape.mound(r, { w: 1.8, h: 1.0, lobes: 5, depth: 0.16, n: 40 });
      return card(pts, A.paintBush({ leaf: d.leaf[0], inner: d.inner, grass: d.grass }, { flowers: d.flowers, berries: d.berries, snow: d.snow }), { seed, ppu: 40 });
    }
    throw new Error('prop ' + kind);
  }
  // 바닥 위 x,z 에 소품을 한 무더기(정면 +z 기준)
  const props = (list, seed = 1) => list.map(([k, x, z, ry = 0], i) => at(propCard(k, seed + i), x, 0, z, ry));

  // ------------------------------------------------------------------------------------------------------------
  // 건물 모델: n = 칸 수(정사각). 반환: { segs }
  // ------------------------------------------------------------------------------------------------------------
  const W1 = TILE * 0.78;
  function segs(main, extra = null, more = null) {
    const out = [{ obj: main, hinge: { at: [0, 0, main.userData.front ?? 2], axis: 'x' } }];
    if (extra) out.push({ obj: extra, hinge: { at: [0, 0, extra.userData.front ?? 3], axis: 'x' }, delay: 0.12 });
    if (more) out.push({ obj: more, hinge: { at: [0, 0, more.userData.front ?? 3], axis: 'x' }, delay: 0.22 });
    return { segs: out, radius: 4 };
  }

  const M = {
    // 연구원 숙소 1~3단계
    house(lv = 1, v = 0) {
      const w = W1 * (lv === 3 ? 1.0 : 0.92), d = W1 * 0.8, h = [0, 2.6, 4.6, 6.6][lv], seed = 10 + lv * 7 + v * 3;
      const wall = [S.wall, S.wall2, mix(S.wall, S.accent, 0.18)][v % 3];
      const flat = S.houseRoof === 'flat';
      const front = paintWall({ wall, door: true, doorX: -w * 0.18, windows: 2, storeys: lv });
      const side = paintWall({ wall, windows: 1, storeys: lv, h });
      const main = box({ w, d, h, front, side, back: side, roof: flat ? 'flat' : 'gable', rh: 1.8, lidPaint: paintLid({ garden: lv > 1 }), seed, parapet: flat });
      if (!flat || lv > 1) main.add(chimney(w * 0.28, h + (flat ? 0 : 0.6), -d * 0.1));
      main.userData.front = d / 2;
      const yard = new THREE.Group();
      for (const o of props(lv === 1 ? [['bush', w * 0.38, d / 2 + 0.7], ['flowerbed', -w * 0.42, d / 2 + 0.8]] : [['bush', w * 0.4, d / 2 + 0.7], ['lamp', -w * 0.45, d / 2 + 0.5], ['flowerbed', 0.2, d / 2 + 1.2]], seed)) yard.add(o);
      yard.userData.front = d / 2 + 1.4;
      return segs(main, yard);
    },
    apartment(v = 0) {
      const w = TILE * 1.6, d = TILE * 1.3, h = 10.5;
      const front = paintWall({ door: true, doorX: 0, doorW: 1.6, windows: 4, storeys: 4, wall: S.wall2, sign: 'leaf', signAt: [0, 2.3, 0.9] });
      const side = paintWall({ windows: 3, storeys: 4, wall: S.wall2 });
      const main = box({ w, d, h, front, side, back: side, roof: 'flat', lidPaint: paintLid({ garden: true, solar: true }), seed: 40, parapet: true });
      main.userData.front = d / 2;
      const yard = new THREE.Group(); for (const o of props([['tree', -w * 0.4, d / 2 + 1.2], ['bench', w * 0.25, d / 2 + 1.0], ['flowerbed', w * 0.45, d / 2 + 2.0], ['lamp', -w * 0.1, d / 2 + 1.6]], 41)) yard.add(o);
      yard.add(pad(w * 1.05, 3.4, padPaint(S.paving), 42)); yard.children[yard.children.length - 1].position.z = d / 2 + 1.6;
      yard.userData.front = d / 2 + 3.2;
      return segs(main, yard);
    },
    cafe() {
      const w = W1 * 0.9, d = W1 * 0.62, h = 2.8;
      const front = paintWall({ wall: S.cafe, door: true, doorX: w * 0.25, windows: 1, storeys: 1, glass: false, sign: 'cup', signAt: [-w * 0.12, h * 0.55, 1.0], signBg: '#f2e3c0', signFg: '#7a4a2a' });
      const side = paintWall({ wall: S.cafe, windows: 1, storeys: 1 });
      const main = box({ w, d, h, front, side, back: side, roof: 'gable', rh: 1.3, roofPaint: paintRoof({ roof: S.awning }), seed: 60 });
      main.userData.front = d / 2;
      // 줄무늬 차양 + 탁자
      const aw = card([[-w / 2, 0], [w / 2, 0], [w / 2, 0.9], ...Array.from({ length: 9 }, (_, i) => [w / 2 - (i + 0.5) * w / 9, 0.9 - (i % 2 ? 0 : 0.18)]), [-w / 2, 0.9]], (P) => { baseSheet(P, '#f2e3c0', 0.05); P.layer((gg) => { for (let i = 0; i < 9; i += 2) gg.fillRect(-w / 2 + i * w / 9, -0.1, w / 9, 1.1); }, S.awning, { lip: 0.6 }); }, { seed: 61, folds: ['top'] });
      const awg = new THREE.Group(); awg.position.set(0, h * 0.92, d / 2); awg.rotation.x = Math.PI * 0.62; aw.position.y = 0; awg.add(aw);
      const yard = new THREE.Group(); yard.add(awg);
      const table = card([[-0.5, 0], [-0.08, 0], [-0.08, 0.7], [-0.55, 0.7], [-0.55, 0.85], [0.55, 0.85], [0.55, 0.7], [0.08, 0.7], [0.08, 0], [0.5, 0], [0.5, 0.06], [-0.5, 0.06]], (P) => { baseSheet(P, '#f2e3c0', 0.06); P.layer((gg) => gg.fillRect(-0.6, 0.7, 1.2, 0.15), S.awning, { lip: 0.6 }); }, { seed: 62, ppu: 40 });
      yard.add(at(table, -w * 0.25, 0, d / 2 + 1.1)); yard.add(at(table.clone(), w * 0.3, 0, d / 2 + 1.5));
      yard.userData.front = d / 2 + 1.8;
      return segs(main, yard);
    },
    park() {
      const g = new THREE.Group();
      g.add(pad(TILE * 0.92, TILE * 0.92, padPaint(S.grassPad, 'pond'), 70));
      for (const o of props([['tree', -1.6, -1.4], ['bench', 1.2, 1.4, -0.3], ['flowerbed', -1.4, 1.6], ['bush', 1.8, -1.2], ['lamp', 0.2, -1.9]], 71)) g.add(o);
      g.userData.front = TILE / 2;
      return segs(g);
    },
    clinic() {
      const w = TILE * 1.5, d = TILE * 1.1, h = 5;
      const front = paintWall({ wall: '#eef0ea', door: true, doorX: 0, doorW: 1.6, windows: 4, storeys: 2, sign: 'cross', signAt: [0, 4.3, 1.1], signBg: '#ffffff', signFg: '#c8402e' });
      const side = paintWall({ wall: '#eef0ea', windows: 3, storeys: 2 });
      const main = box({ w, d, h, front, side, back: side, roof: 'flat', lidPaint: paintLid({ vent: true }), seed: 80, parapet: true });
      main.userData.front = d / 2;
      const yard = new THREE.Group(); for (const o of props([['bench', -w * 0.35, d / 2 + 1.2], ['flowerbed', w * 0.35, d / 2 + 1.2], ['tree', w * 0.45, d / 2 + 2.6], ['lamp', -w * 0.1, d / 2 + 2]], 81)) yard.add(o);
      yard.add(at(pad(w, 3.2, padPaint(S.paving), 82), 0, 0, d / 2 + 1.6));
      yard.userData.front = d / 2 + 3.2;
      return segs(main, yard);
    },
    school() {
      const w = TILE * 1.6, d = TILE * 0.9, h = 4.4;
      const front = paintWall({ wall: S.wall2, mat: 'brick', door: true, doorX: 0, doorW: 1.4, windows: 5, storeys: 2, sign: 'book', signAt: [0, 3.5, 0.9] });
      const side = paintWall({ wall: S.wall2, mat: 'brick', windows: 2, storeys: 2, h });
      const main = box({ w, d, h, front, side, back: side, roof: 'gable', rh: 1.6, seed: 90 });
      // 시계탑
      const tw = 1.6, th = 3.2, tower = box({ w: tw, d: tw, h: th, front: paintWall({ wall: S.wall, windows: 0, storeys: 0, extra: (P) => { P.layer((gg) => circ(gg, 0, th * 0.62, 0.55), '#f2e3c0', { lip: 0.7, rim: 0.6 }); P.draw((gg) => { gg.strokeStyle = '#3a291c'; gg.lineWidth = 0.08; gg.beginPath(); gg.moveTo(0, th * 0.62); gg.lineTo(0, th * 0.62 + 0.38); gg.moveTo(0, th * 0.62); gg.lineTo(0.28, th * 0.62); gg.stroke(); }); } }), roof: 'gable', rh: 1.1, seed: 91 });
      main.add(at(tower, 0, h + 0.4, d * 0.05));
      main.userData.front = d / 2;
      const yard = new THREE.Group(); for (const o of props([['flag', -w * 0.42, d / 2 + 1.0], ['tree', w * 0.42, d / 2 + 1.5], ['bench', w * 0.12, d / 2 + 1.6], ['flowerbed', -w * 0.15, d / 2 + 2.2]], 92)) yard.add(o);
      yard.add(at(pad(w, 3.4, padPaint(S.paving), 93), 0, 0, d / 2 + 1.7));
      yard.userData.front = d / 2 + 3.4;
      return segs(main, yard);
    },
    plaza() {
      const g = new THREE.Group();
      g.add(pad(TILE * 1.9, TILE * 1.9, padPaint(S.paving), 100));
      // DNA 나선 조형물: 기둥 + 사다리 가로대 12장이 비틀려 올라감
      const pole = card(P2.shape.rect(0.3, 6.4), (P) => { baseSheet(P, '#8a8478', 0.1); }, { seed: 101, ppu: 30 });
      g.add(pole);
      const rung = (k) => card(P2.shape.rect(2.4, 0.32).map(([x, y]) => [x, y - 0.16]), (P) => { P.fill('#f2e3c0'); P.layer((gg) => gg.fillRect(-1.3, -0.3, 1.25, 0.7), k % 2 ? S.accent : S.flower, { lip: 0.6 }); P.layer((gg) => gg.fillRect(0.05, -0.3, 1.25, 0.7), k % 2 ? '#e0a840' : '#4f7fae', { lip: 0.6 }); P.layer((gg) => { circ(gg, -1.15, 0, 0.26); circ(gg, 1.15, 0, 0.26); }, '#3f4a6a', { lip: 0.8 }); }, { seed: 102 + k, ppu: 34, folds: [] });
      for (let k = 0; k < 12; k++) { const rc = rung(k % 4); rc.position.set(0, 0.8 + k * 0.48, 0); rc.rotation.y = k * 0.52; g.add(rc); }
      for (const o of props([['bench', -3.6, 3.2, 0.4], ['bench', 3.6, 3.2, -0.4], ['tree', -4, -3.6], ['tree', 4, -3.4], ['flowerbed', 0, 4.3], ['lamp', -4.2, 0.6], ['lamp', 4.2, 0.6]], 110)) g.add(o);
      g.userData.front = TILE;
      return segs(g);
    },
    greenhouse() {
      const w = TILE * 1.5, d = TILE * 0.95, h = 2.6;
      const glassWall = paintWall({ wall: shade(S.glass, -0.05), mat: 'none', glass: true, storeys: 1, windows: 0, extra: (P) => { P.draw((gg) => { for (let i = 0; i < 18; i++) { gg.fillStyle = i % 2 ? rgba('#5f8f45', 0.75) : rgba('#7fa65a', 0.75); fillLeaf(gg, P.box.x0 + 0.4 + (i / 18) * (P.box.w - 0.8), 0.35, 1.0, Math.PI / 2 + (Math.random() - 0.5) * 0.6, 0.35); } gg.fillStyle = rgba('#d8503a', 0.8); for (let i = 0; i < 10; i++) circ(gg, P.box.x0 + 0.5 + (i / 10) * (P.box.w - 1), 0.9 + (i % 3) * 0.2, 0.1); }); } });
      const main = box({ w, d, h, front: glassWall, side: glassWall, back: glassWall, roof: 'gable', rh: 1.6, roofPaint: paintRoof({ kind: 'glass', snow: false }), seed: 120, over: 0.15 });
      main.userData.front = d / 2;
      const yard = new THREE.Group();
      yard.add(at(pad(w, 3.2, padPaint('#9a7a52', 'crops'), 121), 0, 0, d / 2 + 1.7));
      for (const o of props([['crate', -w * 0.42, d / 2 + 0.6], ['barrel', w * 0.45, d / 2 + 0.6]], 122)) yard.add(o);
      yard.userData.front = d / 2 + 3.3;
      return segs(main, yard);
    },
    mushroom() {
      const w = TILE * 1.3, d = TILE * 0.85, h = 2.8;
      const wall = paintWall({ wall: '#7a5a3e', mat: 'log', door: true, doorX: -w * 0.25, windows: 1, storeys: 1, sign: 'mushroom', signAt: [w * 0.18, 1.7, 1.1], signFg: '#c8402e', signFg2: '#f2e3c0', signBg: '#f2e3c0' });
      const side = paintWall({ wall: '#7a5a3e', mat: 'log', windows: 0, storeys: 1 });
      const main = box({ w, d, h, front: wall, side, back: side, roof: 'gable', rh: 1.7, roofPaint: paintRoof({ roof: '#5a6a3a' }), seed: 130 });
      main.userData.front = d / 2;
      const yard = new THREE.Group();
      const C = biome.colors.mushroom || { cap: '#c8402e', stem: '#f2e3c0', dot: '#fff4e0' };
      const r = rng(131);
      for (const [x, z, s] of [[-w * 0.4, d / 2 + 1.2, 1.1], [w * 0.38, d / 2 + 1.0, 0.9], [0.4, d / 2 + 2.2, 0.8]]) {
        const [pts, paint] = P2.drawnPiece((gg, ink) => { gg.fillStyle = ink(C.stem); rr(gg, -0.3 * s, 0, 0.6 * s, 1.3 * s, 0.2 * s); gg.fillStyle = ink(C.cap); gg.beginPath(); gg.ellipse(0, 1.25 * s, 1.0 * s, 0.85 * s, 0, 0, Math.PI); gg.fill(); gg.fillStyle = ink(C.dot, 'print'); for (let k = 0; k < 5; k++) circ(gg, (k - 2) * 0.35 * s, 1.55 * s + (k % 2) * 0.2 * s, 0.1 * s); }, { w: 2.2 * s, h: 2.2 * s, res: 34 });
        yard.add(at(card(pts, paint, { seed: 132 + Math.round(r() * 9) }), x, 0, z));
      }
      yard.userData.front = d / 2 + 2.4;
      return segs(main, yard);
    },
    forestry() {
      const w = TILE * 1.2, d = TILE * 0.7, h = 2.6;
      const wall = paintWall({ wall: '#8a6a44', mat: 'plank', door: true, doorX: w * 0.2, doorW: 1.5, windows: 1, storeys: 1, sign: 'tree', signAt: [-w * 0.2, 1.8, 1.0], signFg: '#4f7a3a', signFg2: '#6b4630' });
      const side = paintWall({ wall: '#8a6a44', mat: 'plank', windows: 0, storeys: 1 });
      const main = box({ w, d, h, front: wall, side, back: side, roof: 'shed', rh: 1.0, seed: 140 });
      main.userData.front = d / 2;
      const yard = new THREE.Group();
      const logs = card(shape.mound(rng(141), { w: 3.4, h: 1.6, lobes: 4, depth: 0.05, n: 30 }), (P) => { baseSheet(P, '#8a5a34', 0.1); P.layer((gg) => { for (let i = 0; i < 9; i++) { const x = -1.3 + (i % 4) * 0.85 + (Math.floor(i / 4) % 2) * 0.42, y = 0.3 + Math.floor(i / 4) * 0.5; ell(gg, x, y, 0.36, 0.3); } }, '#e8c890', { lip: 0.7, rim: 0.6 }); P.draw((gg) => { gg.strokeStyle = '#a07040'; gg.lineWidth = 0.04; for (let i = 0; i < 9; i++) { const x = -1.3 + (i % 4) * 0.85 + (Math.floor(i / 4) % 2) * 0.42, y = 0.3 + Math.floor(i / 4) * 0.5; gg.beginPath(); gg.ellipse(x, y, 0.15, 0.13, 0, 0, Math.PI * 2); gg.stroke(); } }); }, { seed: 142 });
      yard.add(at(logs, -w * 0.15, 0, d / 2 + 1.5));
      for (const o of props([['crate', w * 0.4, d / 2 + 1.0], ['bush', -w * 0.45, d / 2 + 0.8]], 143)) yard.add(o);
      yard.userData.front = d / 2 + 2.2;
      return segs(main, yard);
    },
    algae() {
      const n = 3, w = TILE * 2.5, d = TILE * 1.2, h = 3.2;
      const g = new THREE.Group();
      g.add(at(pad(TILE * 2.8, TILE * 2.8, padPaint(S.paving), 150), 0, 0, 0));
      // 광생물 반응기: 초록 관이 그려진 유리 판 여러 장
      const panel = (k) => card(P2.shape.rect(2.6, h), (P) => { P.fill('#dfe9e2'); P.layer((gg) => { for (let i = 0; i < 6; i++) rr(gg, -1.2 + i * 0.42, 0.3, 0.3, h - 0.6, 0.15); }, '#5f9a52', { lip: 0.6, depth: 0.6 }); P.marks('dot', { color: '#c8f0a0', alpha: 0.7, size: 0.08, units: true, density: 0.4 }); P.layer((gg) => { gg.fillRect(-1.3, 0, 2.6, 0.3); gg.fillRect(-1.3, h - 0.3, 2.6, 0.3); }, S.metal, { lip: 0.7 }); }, { seed: 151 + (k % 2), materials: null });
      for (let k = 0; k < 4; k++) g.add(at(panel(k), -w * 0.36 + k * w * 0.24, 0, -1.5, 0));
      g.add(at(tank({ r: 1.4, h: 3.6, paint: paintWall({ wall: S.metal, mat: 'panel', storeys: 0, windows: 0, extra: (P) => P.draw((gg) => ICON.algae(gg, 0, 2.2, 0.9, '#5f9a52')) }), lid: 'cone', seed: 152 }), w * 0.36, 0, 3.0));
      g.add(at(pad(5, 3, padPaint('#9a8a62', 'algae'), 153), -w * 0.18, 0, 3.4));
      g.userData.front = TILE * 1.4;
      return segs(g);
    },
    ferment() {
      const w = TILE * 1.1, d = TILE * 1.2, h = 3.4;
      const front = paintWall({ wall: S.factory, mat: 'panel', door: true, doorX: -w * 0.2, doorW: 1.4, windows: 2, storeys: 1, sign: 'flask', signAt: [w * 0.18, h * 0.62, 1.0] });
      const side = paintWall({ wall: S.factory, mat: 'panel', windows: 2, storeys: 1 });
      const main = box({ w, d, h, front, side, back: side, roof: 'gable', rh: 1.3, roofPaint: paintRoof({ kind: 'metal', roof: S.metalRoof }), seed: 160 });
      main.add(chimney(-w * 0.3, h + 0.4, -d * 0.2, { w: 0.8, h: 2.6, col: S.chimney }));
      main.position.x = -TILE * 0.38;
      main.userData.front = d / 2;
      const tanks = new THREE.Group();
      const tp = paintWall({ wall: S.metal, mat: 'panel', storeys: 0, windows: 0, extra: (P) => { P.layer((gg) => { gg.fillRect(P.box.x0 - 1, 1.0, P.box.w + 2, 0.14); gg.fillRect(P.box.x0 - 1, 2.6, P.box.w + 2, 0.14); }, shade(S.metal, -0.2), { lip: 0.6 }); } });
      tanks.add(at(tank({ r: 1.0, h: 4.0, paint: tp, lid: 'cone', seed: 161 }), TILE * 0.55, 0, -1.4));
      tanks.add(at(tank({ r: 1.0, h: 4.0, paint: tp, lid: 'cone', seed: 161 }), TILE * 0.55, 0, 1.4));
      tanks.userData.front = 2.4;
      return segs(main, tanks);
    },
    enzyme() {
      const w = TILE * 1.6, d = TILE * 1.1, h = 3.6;
      const front = paintWall({ wall: S.factory2, mat: 'brick', door: true, doorX: w * 0.25, doorW: 1.6, windows: 3, storeys: 1, sign: 'gear', signAt: [-w * 0.15, h * 0.7, 1.0], signFg: S.accent });
      const side = paintWall({ wall: S.factory2, mat: 'brick', windows: 2, storeys: 1 });
      const main = box({ w, d, h, front, side, back: side, roof: 'flat', lidPaint: paintLid({ vent: true }), seed: 170 });
      // 톱니 지붕 3개
      for (let k = 0; k < 3; k++) { const s = box({ w: w / 3 - 0.1, d: 1.6, h: 0.01, front: paintWall({ wall: S.glass, storeys: 0, windows: 0 }), roof: 'shed', rh: 1.2, roofPaint: paintRoof({ kind: 'metal', roof: S.metalRoof }), seed: 171 }); main.add(at(s, -w / 3 + k * w / 3, h, -d * 0.1)); }
      main.add(chimney(w * 0.35, h, -d * 0.3, { w: 0.7, h: 2.8, col: S.chimney }));
      main.userData.front = d / 2;
      const yard = new THREE.Group(); for (const o of props([['barrel', -w * 0.4, d / 2 + 0.8], ['barrel', -w * 0.3, d / 2 + 1.3], ['crate', w * 0.42, d / 2 + 0.9]], 172)) yard.add(o);
      yard.userData.front = d / 2 + 1.5;
      return segs(main, yard);
    },
    plastic() {
      const w = TILE * 2.4, d = TILE * 1.6, h = 4.4;
      const front = paintWall({ wall: S.factory, mat: 'panel', door: true, doorX: -w * 0.3, doorW: 2.2, doorH: 2.6, windows: 4, storeys: 1, sign: 'bottle', signAt: [w * 0.15, h * 0.68, 1.4] });
      const side = paintWall({ wall: S.factory, mat: 'panel', windows: 3, storeys: 1 });
      const main = box({ w, d, h, front, side, back: side, roof: 'flat', lidPaint: paintLid({ solar: true }), seed: 180 });
      for (let k = 0; k < 4; k++) { const s = box({ w: w / 4 - 0.1, d: 2.2, h: 0.01, front: paintWall({ wall: S.glass, storeys: 0, windows: 0 }), roof: 'shed', rh: 1.4, roofPaint: paintRoof({ kind: 'metal', roof: S.metalRoof }), seed: 181 }); main.add(at(s, -w * 3 / 8 + k * w / 4, h, -d * 0.15)); }
      main.add(chimney(w * 0.4, h, -d * 0.35, { w: 0.9, h: 3.6 }));
      main.position.z = -1.2; main.userData.front = d / 2 - 1.2;
      const yard = new THREE.Group(); for (const o of props([['crate', -w * 0.15, d / 2 + 0.6], ['crate', -w * 0.05, d / 2 + 0.9], ['crate', w * 0.3, d / 2 + 0.8], ['barrel', w * 0.42, d / 2 + 1.1]], 182)) yard.add(o);
      yard.userData.front = d / 2 + 1.4;
      return segs(main, yard);
    },
    biofuel() {
      const g = new THREE.Group();
      g.add(at(pad(TILE * 2.8, TILE * 2.8, padPaint(S.paving), 190), 0, 0, 0));
      const tp = paintWall({ wall: S.metal, mat: 'panel', storeys: 0, windows: 0, extra: (P) => { P.layer((gg) => gg.fillRect(P.box.x0 - 1, P.box.h * 0.45, P.box.w + 2, 0.5), S.accent, { lip: 0.6 }); P.draw((gg) => ICON.fuel(gg, 0, P.box.h * 0.7, 0.9, '#e0a840', '#4f7a3a')); } });
      g.add(at(tank({ r: 1.8, h: 3.4, paint: tp, lid: 'flat', seed: 191 }), -4.5, 0, -3));
      g.add(at(tank({ r: 1.8, h: 3.4, paint: tp, lid: 'flat', seed: 191 }), -4.5, 0, 2.2));
      const tower = tank({ r: 0.9, h: 8.5, n: 8, paint: paintWall({ wall: shade(S.metal, 0.05), mat: 'panel', storeys: 0, windows: 0, extra: (P) => { P.layer((gg) => { for (let y = 1.5; y < P.box.h; y += 1.8) gg.fillRect(P.box.x0 - 1, y, P.box.w + 2, 0.2); }, shade(S.metal, -0.25), { lip: 0.6 }); } }), lid: 'cone', seed: 192 });
      g.add(at(tower, 2.5, 0, -3.5));
      g.add(at(tank({ r: 0.7, h: 6.5, n: 8, paint: paintWall({ wall: S.metal, mat: 'panel', storeys: 0, windows: 0 }), lid: 'cone', seed: 193 }), 4.8, 0, -2));
      const office = box({ w: 4.6, d: 3.2, h: 2.8, front: paintWall({ wall: S.factory2, door: true, doorX: -1, windows: 2, storeys: 1 }), side: paintWall({ wall: S.factory2, windows: 1, storeys: 1 }), roof: 'flat', seed: 194 });
      g.add(at(office, 3.4, 0, 4.2));
      g.userData.front = TILE * 1.4;
      return segs(g);
    },
    genome() {
      const w = TILE * 1.5, d = TILE * 1.1, h = 5.2;
      const front = paintWall({ wall: S.lab, door: true, doorX: -w * 0.28, doorW: 1.4, glass: true, storeys: 2, sign: 'dna', signAt: [w * 0.22, h * 0.82, 1.2], signBg: '#ffffff', signFg: S.accent, signFg2: '#e0a840' });
      const side = paintWall({ wall: S.lab, windows: 3, storeys: 2 });
      const main = box({ w, d, h, front, side, back: side, roof: 'flat', lidPaint: paintLid({ solar: true, vent: true }), seed: 200, parapet: true });
      main.userData.front = d / 2;
      const yard = new THREE.Group(); for (const o of props([['tree', -w * 0.42, d / 2 + 1.4], ['bench', w * 0.2, d / 2 + 1.2], ['lamp', w * 0.45, d / 2 + 1.5]], 201)) yard.add(o);
      yard.add(at(pad(w, 3.0, padPaint(S.paving), 202), 0, 0, d / 2 + 1.5));
      yard.userData.front = d / 2 + 3.0;
      return segs(main, yard);
    },
    vaccine() {
      const w = TILE * 2.2, d = TILE * 1.4, h = 6.2;
      const front = paintWall({ wall: '#f2f2ec', door: true, doorX: 0, doorW: 2.0, glass: true, storeys: 2, sign: 'vial', signAt: [-w * 0.3, h * 0.84, 1.4], signBg: '#ffffff', signFg: '#4f8fc0', signFg2: '#c8402e' });
      const side = paintWall({ wall: '#f2f2ec', windows: 3, storeys: 2 });
      const main = box({ w, d, h, front, side, back: side, roof: 'flat', lidPaint: paintLid({ vent: true }), seed: 210, parapet: true });
      main.add(at(dome({ r: 2.2, paint: paintWall({ wall: '#dfe8ee', mat: 'panel', storeys: 0, windows: 0 }), seed: 211 }), w * 0.22, h, -d * 0.05));
      main.position.z = -1; main.userData.front = d / 2 - 1;
      const yard = new THREE.Group(); for (const o of props([['flag', -w * 0.45, d / 2 + 0.6], ['tree', w * 0.45, d / 2 + 1.0], ['flowerbed', w * 0.2, d / 2 + 1.4], ['lamp', -w * 0.2, d / 2 + 1.2]], 212)) yard.add(o);
      yard.userData.front = d / 2 + 1.6;
      return segs(main, yard);
    },
    seedbank() {
      const w = TILE * 1.5, d = TILE * 1.2, h = 3.0;
      const front = paintWall({ wall: S.vault, mat: 'panel', door: true, doorX: 0, doorW: 1.8, doorCol: '#8a9aa8', windows: 0, storeys: 1, sign: 'seed', signAt: [0, h * 0.78, 1.0], signFg: '#8a5a34', signFg2: '#5f8f45' });
      const side = paintWall({ wall: S.vault, mat: 'panel', windows: 0, storeys: 1 });
      const main = box({ w, d, h, front, side, back: side, roof: 'gable', rh: 2.2, roofPaint: paintRoof({ roof: S.vaultRoof }), seed: 220, over: 0.1 });
      main.userData.front = d / 2;
      const yard = new THREE.Group();
      const hill = card(shape.hill(rng(221), { w: w * 1.15, h: 1.4, bumps: 2, n: 40 }), A.paintHill({ ground: biome.drift.ground, mark: biome.drift.mark }, { marks: biome.drift.marks }), { seed: 222 });
      yard.add(at(hill, 0, 0, -d / 2 - 0.4));
      for (const o of props([['bush', -w * 0.42, d / 2 + 0.8], ['bush', w * 0.42, d / 2 + 0.8]], 223)) yard.add(o);
      yard.userData.front = d / 2 + 1;
      return segs(main, yard);
    },
    lab() {
      const w = TILE * 1.4, d = TILE * 1.1, h = 4.4;
      const front = paintWall({ wall: S.lab, door: true, doorX: w * 0.25, doorW: 1.3, windows: 3, storeys: 2, sign: 'microscope', signAt: [-w * 0.2, h * 0.82, 1.0], signBg: '#ffffff', signFg: '#3f5a7a' });
      const side = paintWall({ wall: S.lab, windows: 2, storeys: 2 });
      const main = box({ w, d, h, front, side, back: side, roof: 'flat', lidPaint: paintLid(), seed: 230, parapet: true });
      // 옥상 위 커다란 현미경(엇갈린 두 장)
      const mpts = shape.fromDrawing((gg) => { rr(gg, -1.0, 0, 2.0, 0.35, 0.1); rr(gg, -0.25, 0, 0.5, 1.6, 0.12); gg.save(); gg.translate(0.1, 1.6); gg.rotate(-0.45); rr(gg, -0.32, -0.6, 0.64, 2.6, 0.25); gg.restore(); rr(gg, -0.9, 0.9, 1.6, 0.25, 0.08); }, { w: 2.6, h: 4.0, res: 26 });
      const mic = A.cross(mpts, (P) => { baseSheet(P, '#3f5a7a', 0.12); P.layer((gg) => { gg.save(); gg.translate(0.1, 1.6); gg.rotate(-0.45); gg.fillRect(-0.32, 1.4, 0.64, 0.5); gg.restore(); }, '#e0a840', { lip: 0.7 }); P.layer((gg) => rr(gg, -1.0, 0, 2.0, 0.35, 0.1), '#2f3a4a', { lip: 0.6 }); inner(P, '#3f5a7a', 0.3, 8); }, { seed: 231, ppu: 30 });
      main.add(at(mic, -w * 0.15, h, -d * 0.1, 0.5));
      main.userData.front = d / 2;
      const yard = new THREE.Group(); for (const o of props([['flowerbed', -w * 0.4, d / 2 + 0.9], ['lamp', w * 0.42, d / 2 + 0.8], ['bench', -w * 0.05, d / 2 + 1.4]], 232)) yard.add(o);
      yard.userData.front = d / 2 + 1.6;
      return segs(main, yard);
    },
    waste() {
      const g = new THREE.Group();
      g.add(at(pad(TILE * 1.85, TILE * 1.85, padPaint(S.paving), 240), 0, 0, 0));
      const dp = paintWall({ wall: '#7a9a5a', mat: 'panel', storeys: 0, windows: 0, extra: (P) => P.draw((gg) => ICON.recycle(gg, 0, P.box.h * 0.5, 0.8, '#f2e3c0')) });
      g.add(at(tank({ r: 1.5, h: 1.6, paint: dp, lid: 'dome', lidPaint: paintWall({ wall: '#8aaa62', mat: 'none', storeys: 0, windows: 0 }), seed: 241 }), -2.6, 0, -2.4));
      g.add(at(tank({ r: 1.5, h: 1.6, paint: dp, lid: 'dome', lidPaint: paintWall({ wall: '#8aaa62', mat: 'none', storeys: 0, windows: 0 }), seed: 241 }), 2.4, 0, -2.6));
      const shed = box({ w: 5, d: 3, h: 2.6, front: paintWall({ wall: S.factory2, door: true, doorX: 1.2, doorW: 1.6, windows: 1, storeys: 1, sign: 'recycle', signAt: [-1.2, 1.7, 1.0], signFg: '#5f8f45' }), side: paintWall({ wall: S.factory2, windows: 0, storeys: 1 }), roof: 'shed', rh: 0.9, seed: 242 });
      g.add(at(shed, 0, 0, 2.6));
      for (const o of props([['barrel', -4.6, 2.6], ['barrel', -4.2, 3.6], ['barrel', 4.5, 3.4]], 243)) g.add(o);
      g.userData.front = TILE;
      return segs(g);
    },
    water() {
      const g = new THREE.Group();
      g.add(at(pad(TILE * 1.85, TILE * 1.85, padPaint(S.paving), 250), 0, 0, 0));
      g.add(at(pad(6, 4.4, padPaint('#c8d0c8', 'pond'), 251), -1.6, 0.02, 2.2));
      const tp = paintWall({ wall: '#cfe0e8', mat: 'panel', storeys: 0, windows: 0, extra: (P) => P.draw((gg) => ICON.drop(gg, 0, P.box.h * 0.55, 1.0, '#4f8fc0')) });
      g.add(at(tank({ r: 1.6, h: 3.2, paint: tp, lid: 'flat', seed: 252 }), 2.6, 0, -2.4));
      const shed = box({ w: 3.4, d: 2.6, h: 2.4, front: paintWall({ wall: S.lab, door: true, doorX: 0.6, windows: 1, storeys: 1 }), side: paintWall({ wall: S.lab, windows: 0, storeys: 1 }), roof: 'gable', rh: 1, seed: 253 });
      g.add(at(shed, -2.8, 0, -2.6));
      g.userData.front = TILE;
      return segs(g);
    },
    depot() {
      const w = TILE * 1.6, d = TILE * 1.1, h = 3.6;
      const front = paintWall({ wall: S.factory2, mat: 'panel', windows: 0, storeys: 1, sign: 'box', signAt: [w * 0.32, h * 0.72, 1.0], extra: (P) => { P.layer((gg) => { for (const x of [-w * 0.3, w * 0.02]) gg.fillRect(x - 1.1, 0, 2.2, 2.6); }, '#8a9298', { lip: 0.7 }); P.draw((gg) => { gg.strokeStyle = '#5a6268'; gg.lineWidth = 0.06; for (const x of [-w * 0.3, w * 0.02]) for (let y = 0.3; y < 2.6; y += 0.3) { gg.beginPath(); gg.moveTo(x - 1.05, y); gg.lineTo(x + 1.05, y); gg.stroke(); } }); } });
      const side = paintWall({ wall: S.factory2, mat: 'panel', windows: 1, storeys: 1 });
      const main = box({ w, d, h, front, side, back: side, roof: 'gable', rh: 1.2, roofPaint: paintRoof({ kind: 'metal', roof: S.metalRoof }), seed: 260 });
      main.userData.front = d / 2;
      const yard = new THREE.Group(); for (const o of props([['crate', -w * 0.42, d / 2 + 0.8], ['crate', -w * 0.34, d / 2 + 1.5], ['crate', w * 0.42, d / 2 + 1.0], ['barrel', w * 0.3, d / 2 + 1.6]], 261)) yard.add(o);
      yard.userData.front = d / 2 + 1.8;
      return segs(main, yard);
    },
    gate() {
      const g = new THREE.Group();
      const post = (x) => box({ w: 0.9, d: 0.9, h: 4.6, front: paintWall({ wall: S.wall2, mat: 'brick', storeys: 0, windows: 0 }), roof: 'gable', rh: 0.6, seed: 270 });
      g.add(at(post(), -2.8, 0, 0)); g.add(at(post(), 2.8, 0, 0));
      const banner = card([[-3.1, 0], [3.1, 0], [3.1, 1.3], [-3.1, 1.3]], (P) => { baseSheet(P, S.accent, 0.1); P.layer((gg) => rr(gg, -2.9, 0.15, 5.8, 1.0, 0.3), '#f2e3c0', { lip: 0.7 }); P.draw((gg) => { gg.save(); gg.scale(1, -1); gg.fillStyle = shade(S.accent, -0.3); gg.font = 'bold 0.62px sans-serif'; gg.textAlign = 'center'; gg.textBaseline = 'middle'; gg.fillText('BIO VALLEY', 0.25, -0.66); gg.restore(); ICON.leaf(gg, -2.35, 0.66, 0.6, S.accent); }); }, { seed: 271, folds: [], back: false });
      g.add(at(banner, 0, 3.4, 0.5));
      const back2 = banner.clone(); g.add(at(back2, 0, 3.4, -0.5, Math.PI));
      for (const o of props([['flowerbed', -4.0, 1.0], ['flowerbed', 4.0, 1.0]], 272)) g.add(o);
      g.userData.front = 1;
      return segs(g);
    },
    bench() { const g = new THREE.Group(); g.add(at(propCard('bench', 280), 0, 0, 0)); g.add(at(propCard('bench', 281), 0, 0, -0.05, Math.PI)); g.userData.front = 0.5; return segs(g); },
    lamp() { const g = new THREE.Group(); g.add(at(propCard('lamp', 290), 0, 0, 0)); g.add(at(propCard('lamp', 290), 0, 0, 0, Math.PI / 2)); g.userData.front = 0.3; return segs(g); },
    flowerbed() { const g = new THREE.Group(); for (const o of props([['flowerbed', -1, 0.6], ['flowerbed', 1, -0.4], ['flowerbed', -0.6, -1.4], ['bush', 1.4, 1.4]], 300)) g.add(o); g.userData.front = 2; return segs(g); },
  };

  return { M, box, tank, dome, pad, padPaint, propCard, paintWall, paintRoof, paintLid };
}

// ---------------------------------------------------------------------------------------------------------------
// 사람(앞을 보는 카드, 좌우 뒤집기), 차(입체 상자), 생물·날씨 조각
// ---------------------------------------------------------------------------------------------------------------
export const PEOPLE = [
  { id: 'researcher', coat: '#f4f1e8', coat2: '#d8d4c8', pants: '#3f5f7a', skin: '#f2c9a0', hair: '#4a2e1c', hat: null, acc: '#4f9a96' },
  { id: 'farmer', coat: '#6f9a50', coat2: '#557a3c', pants: '#4a5a8a', skin: '#e8b88a', hair: '#6b3f26', hat: '#e8c060', acc: '#c8402e' },
  { id: 'worker', coat: '#e07a3a', coat2: '#c05a2a', pants: '#3a4a5a', skin: '#d8a070', hair: '#2a1c14', hat: '#f2c43a', acc: '#f2e3c0' },
  { id: 'office', coat: '#3f4f7a', coat2: '#2f3a5a', pants: '#2a2a3a', skin: '#f2d0b0', hair: '#1c1410', hat: null, acc: '#c8402e' },
  { id: 'kid', coat: '#d8503a', coat2: '#b03a2a', pants: '#4a6a9a', skin: '#f2c9a0', hair: '#6b3f26', hat: '#3f6fae', acc: '#f2e3c0', small: true },
  { id: 'elder', coat: '#9a7ac0', coat2: '#7a5aa0', pants: '#5a5048', skin: '#f0caa8', hair: '#d8d4cc', hat: null, acc: '#f2e3c0' },
];
export function personPrefab(A, k) {
  const p = PEOPLE[k], s = p.small ? 0.78 : 1, H = PERSON_H * s;
  const [pts, paint] = P2.drawnPiece((g, ink) => {
    const hx = 0, hr = 0.42 * s;
    g.fillStyle = ink(p.pants); rr(g, -0.32 * s, 0, 0.28 * s, 1.0 * s, 0.1 * s); rr(g, 0.04 * s, 0, 0.28 * s, 1.0 * s, 0.1 * s);
    g.fillStyle = ink('#3a2a20'); rr(g, -0.38 * s, 0, 0.36 * s, 0.16 * s, 0.06 * s); rr(g, 0.02 * s, 0, 0.36 * s, 0.16 * s, 0.06 * s);
    g.fillStyle = ink(p.coat); rr(g, -0.46 * s, 0.82 * s, 0.92 * s, 0.95 * s, 0.28 * s);
    g.fillStyle = ink(p.coat2); rr(g, -0.62 * s, 0.95 * s, 0.24 * s, 0.75 * s, 0.12 * s); rr(g, 0.38 * s, 0.95 * s, 0.24 * s, 0.75 * s, 0.12 * s);
    g.fillStyle = ink(p.skin); circ(g, hx, H - hr - 0.05 * s, hr); circ(g, -0.5 * s, 0.98 * s, 0.11 * s); circ(g, 0.5 * s, 0.98 * s, 0.11 * s);
    g.fillStyle = ink(p.hair); g.beginPath(); g.ellipse(hx, H - hr * 0.7, hr * 1.02, hr * 0.62, 0, 0, Math.PI); g.fill();
    if (p.hat) { g.fillStyle = ink(p.hat); g.beginPath(); g.ellipse(hx, H - hr * 0.55, hr * 1.35, hr * 0.22, 0, 0, Math.PI * 2); g.fill(); g.beginPath(); g.ellipse(hx, H - hr * 0.5, hr * 0.85, hr * 0.62, 0, 0, Math.PI); g.fill(); }
    g.fillStyle = ink('#2a1a10', 'print'); circ(g, hx - hr * 0.33, H - hr * 1.05, 0.055 * s); circ(g, hx + hr * 0.33, H - hr * 1.05, 0.055 * s);
    g.fillStyle = ink('#e88a7a', 'print'); circ(g, hx - hr * 0.55, H - hr * 1.3, 0.07 * s); circ(g, hx + hr * 0.55, H - hr * 1.3, 0.07 * s);
    g.fillStyle = ink(p.acc, 'print'); rr(g, -0.12 * s, 1.35 * s, 0.24 * s, 0.14 * s, 0.04 * s);
  }, { w: 1.5 * s, h: H + 0.1, res: 60, name: p.id });
  const c = A.card(pts, paint, { ppu: 56, seed: 400 + k, t: 0.05, edge: 0.04, contactH: 0.3 });
  return { segs: [{ obj: c, hinge: { at: [0, 0, 0], axis: 'x' } }], face: true, double: true, radius: 0.6 };
}
// 화물차: 앞이 +z
export function truckPrefab(A, B, kind = 0) {
  const g = new THREE.Group();
  const col = kind ? '#f2f0e8' : '#5f8f45', cab = kind ? '#4f8fc0' : '#e0a840';
  const cargo = B.box({ w: 2.0, d: 2.8, h: 1.9, front: B.paintWall({ wall: col, mat: 'panel', storeys: 0, windows: 0 }), side: B.paintWall({ wall: col, mat: 'panel', storeys: 0, windows: 0, sign: kind ? 'vial' : 'leaf', signAt: [0, 1.0, 0.9], signBg: '#f2e3c0', signFg: kind ? '#4f8fc0' : '#4f7a3a' }), roof: 'lid', seed: 500 + kind });
  g.add(A.at(cargo, 0, 0.45, -0.7));
  const front = B.paintWall({ wall: cab, storeys: 0, windows: 0, extra: (P) => { P.layer((gg) => rr(gg, -0.8, 0.75, 1.6, 0.6, 0.15), '#bfe0e8', { lip: 0.6 }); P.layer((gg) => { circ(gg, -0.65, 0.3, 0.14); circ(gg, 0.65, 0.3, 0.14); }, '#f8e8a0', { lip: 0.6 }); } });
  const cabin = B.box({ w: 1.9, d: 1.3, h: 1.5, front, side: B.paintWall({ wall: cab, storeys: 0, windows: 0, extra: (P) => P.layer((gg) => rr(gg, -0.4, 0.75, 0.8, 0.55, 0.12), '#bfe0e8', { lip: 0.6 }) }), back: B.paintWall({ wall: cab, storeys: 0, windows: 0 }), roof: 'lid', seed: 510 + kind });
  g.add(A.at(cabin, 0, 0.45, 1.4));
  const wheelPts = Array.from({ length: 14 }, (_, i) => { const a = i / 14 * Math.PI * 2; return [Math.cos(a) * 0.45, 0.45 + Math.sin(a) * 0.45]; });
  const wheel = (P) => { P.fill('#2f2a28'); P.layer((gg) => circ(gg, 0, 0.45, 0.2), '#b8b0a0', { lip: 0.6 }); };
  let wm = null;
  for (const [x, z] of [[1.02, 1.3], [-1.02, 1.3], [1.02, -1.4], [-1.02, -1.4]]) { const w = A.card(wheelPts, wheel, { seed: 520, materials: wm ? wm.material : null, folds: [], contact: false, ppu: 30 }); if (!wm) wm = w; g.add(A.at(w, x, 0, z, x > 0 ? Math.PI / 2 : -Math.PI / 2)); }
  return { segs: [{ obj: g, hinge: { at: [0, 0, 2], axis: 'x' } }], radius: 2 };
}
// 작은 생물(옆모습 카드, 좌우 뒤집기)
export function critterPrefab(A, kind) {
  const C = {
    squirrel: { body: '#b8642e', belly: '#f2d8b0', w: 1.4, h: 1.2 }, fox: { body: '#d8702e', belly: '#f6ecd8', w: 1.9, h: 1.3 },
    deer: { body: '#a8703e', belly: '#f2e3c8', w: 2.2, h: 2.2 }, rabbit: { body: '#f2f0ea', belly: '#ffffff', w: 1.2, h: 1.1 },
    hare: { body: '#a88a6a', belly: '#f2e3c8', w: 1.2, h: 1.1 }, lizard: { body: '#7a9a52', belly: '#c8d890', w: 1.6, h: 0.5 },
    sheep: { body: '#f4f0e6', belly: '#3a2e28', w: 1.8, h: 1.3 }, duck: { body: '#f2f0e8', belly: '#e0a840', w: 1.1, h: 1.0 },
  }[kind];
  const [pts, paint] = P2.drawnPiece((g, ink) => {
    const w = C.w, h = C.h;
    if (kind === 'lizard') { g.fillStyle = ink(C.body); ell(g, 0, 0.22, w * 0.32, 0.16); poly(g, [[-w * 0.3, 0.2], [-w * 0.5, 0.12], [-w * 0.3, 0.32]]); circ(g, w * 0.36, 0.26, 0.14); for (const x of [-0.25, 0.2]) rr(g, x, 0, 0.08, 0.22, 0.03); g.fillStyle = ink('#2a1a10', 'print'); circ(g, w * 0.4, 0.3, 0.035); return; }
    if (kind === 'duck') { g.fillStyle = ink(C.body); ell(g, 0, 0.4, 0.42, 0.3); circ(g, 0.32, 0.78, 0.2); g.fillStyle = ink(C.belly); poly(g, [[0.48, 0.8], [0.66, 0.74], [0.48, 0.7]]); rr(g, -0.08, 0, 0.06, 0.15, 0.02); rr(g, 0.08, 0, 0.06, 0.15, 0.02); g.fillStyle = ink('#2a1a10', 'print'); circ(g, 0.36, 0.84, 0.035); return; }
    g.fillStyle = ink(C.body);
    if (kind === 'squirrel' || kind === 'fox') { g.save(); g.translate(-w * 0.3, h * 0.45); g.rotate(kind === 'fox' ? -0.6 : 0.4); ell(g, 0, kind === 'fox' ? 0 : h * 0.15, w * 0.22, h * 0.3); g.restore(); }
    for (const x of [-w * 0.22, w * 0.16]) rr(g, x, 0, w * 0.08, h * (kind === 'deer' ? 0.5 : 0.3), w * 0.03);
    ell(g, 0, h * (kind === 'deer' ? 0.62 : 0.4), w * 0.32, h * (kind === 'deer' ? 0.16 : 0.22));
    circ(g, w * 0.34, h * (kind === 'deer' ? 0.85 : 0.62), h * (kind === 'deer' ? 0.14 : 0.18));
    if (kind === 'rabbit' || kind === 'hare') { ell(g, w * 0.3, h * 0.92, 0.07, 0.24, -0.2); ell(g, w * 0.4, h * 0.9, 0.07, 0.22, 0.25); }
    if (kind === 'deer') { g.fillStyle = ink('#6b4630'); g.lineWidth = 0.06; poly(g, [[w * 0.3, h * 0.95], [w * 0.22, h * 1.0], [w * 0.28, h * 0.96]]); rr(g, w * 0.28, h * 0.95, 0.05, 0.25, 0.02); rr(g, w * 0.38, h * 0.95, 0.05, 0.22, 0.02); }
    if (kind === 'fox') { g.fillStyle = ink(C.body); poly(g, [[w * 0.3, h * 0.72], [w * 0.28, h * 0.92], [w * 0.38, h * 0.76]]); poly(g, [[w * 0.36, h * 0.74], [w * 0.4, h * 0.94], [w * 0.46, h * 0.74]]); }
    g.fillStyle = ink(C.belly); ell(g, w * 0.05, h * (kind === 'deer' ? 0.56 : 0.32), w * 0.18, h * 0.1);
    g.fillStyle = ink('#2a1a10', 'print'); circ(g, w * 0.4, h * (kind === 'deer' ? 0.88 : 0.66), 0.045);
  }, { w: C.w * 1.1, h: C.h * 1.15, res: 50, name: kind });
  const c = A.card(pts, paint, { ppu: 50, seed: 600 + kind.length, t: 0.05, edge: 0.04, contactH: 0.2 });
  return { segs: [{ obj: c, hinge: { at: [0, 0, 0], axis: 'x' } }], face: true, double: true, radius: 0.8 };
}
// 날씨·생물 작은 조각(그림자 없음)
export function bitPrefab(A, kind) {
  const r = rng(700 + kind.length);
  let pts, paint;
  if (kind === 'leaf') { pts = Array.from({ length: 12 }, (_, i) => { const a = i / 12 * Math.PI * 2; return [Math.cos(a) * 0.32, 0.2 + Math.sin(a) * 0.18 * (1 - Math.abs(Math.cos(a)) * 0.3)]; }); paint = (P) => { P.fill(['#d8702e', '#c8402e', '#e0a33a'][0]); P.draw((g) => { g.strokeStyle = '#8a3a1a'; g.lineWidth = 0.03; g.beginPath(); g.moveTo(-0.28, 0.2); g.lineTo(0.28, 0.2); g.stroke(); }); }; }
  else if (kind === 'leaf2') { pts = Array.from({ length: 12 }, (_, i) => { const a = i / 12 * Math.PI * 2; return [Math.cos(a) * 0.3, 0.2 + Math.sin(a) * 0.17]; }); paint = (P) => P.fill('#e0a33a'); }
  else if (kind === 'snow') { pts = Array.from({ length: 12 }, (_, i) => { const a = i / 12 * Math.PI * 2, rr2 = i % 2 ? 0.12 : 0.26; return [Math.cos(a) * rr2, 0.26 + Math.sin(a) * rr2]; }); paint = (P) => P.fill('#f8fafc'); }
  else if (kind === 'petal') { pts = Array.from({ length: 10 }, (_, i) => { const a = i / 10 * Math.PI * 2; return [Math.cos(a) * 0.2, 0.15 + Math.sin(a) * 0.14 * (a < Math.PI ? 1 : 0.6)]; }); paint = (P) => P.fill('#f2b4c4'); }
  else if (kind === 'needle') { pts = Array.from({ length: 10 }, (_, i) => { const a = i / 10 * Math.PI * 2; return [Math.cos(a) * 0.34, 0.12 + Math.sin(a) * 0.08]; }); paint = (P) => P.fill('#9a7a3a'); }
  else if (kind === 'dust') { pts = Array.from({ length: 8 }, (_, i) => { const a = i / 8 * Math.PI * 2; return [Math.cos(a) * 0.14, 0.14 + Math.sin(a) * 0.12]; }); paint = (P) => P.fill('#e8d0a0'); }
  else if (kind === 'puff') { pts = shape.radial(r, { cx: 0, cy: 0.7, rx: 0.8, ry: 0.65, lobes: 6, depth: 0.2, n: 40 }); paint = (P) => { P.gradient('#fbf6ea', '#ddd4c4', 0.6); P.innerShade('#8a7a6a', { alpha: 0.3, blurPx: 6 }); }; }
  else if (kind === 'butterfly') { pts = shape.fromDrawing((g) => { ell(g, -0.25, 0.35, 0.24, 0.3, 0.4); ell(g, 0.25, 0.35, 0.24, 0.3, -0.4); rr(g, -0.04, 0.05, 0.08, 0.5, 0.04); }, { w: 1, h: 0.75, res: 60 }); paint = (P) => { P.fill('#e8a83a'); P.draw((g) => { g.fillStyle = '#3a2a1a'; rr(g, -0.04, 0.05, 0.08, 0.5, 0.04); g.fillStyle = '#f6ecd0'; circ(g, -0.3, 0.42, 0.06); circ(g, 0.3, 0.42, 0.06); }); }; }
  else if (kind === 'bird') { pts = [[-0.7, 0.5], [-0.35, 0.62], [0, 0.4], [0.35, 0.62], [0.7, 0.5], [0.35, 0.52], [0, 0.3], [-0.35, 0.52]]; paint = (P) => P.fill('#3a3430'); }
  const c = A.card(pts, paint, { ppu: 40, seed: 800 + kind.length, t: 0.03, edge: 0.02, contact: false, folds: [] });
  return { segs: [{ obj: c, hinge: { at: [0, 0, 0], axis: 'x' } }], face: false, double: true, shadow: kind === 'puff' || kind === 'bird', radius: 0.5 };
}
