// 바이오 알 도둑: 카툰 3D 모델. 기본 도형을 이어 붙여 한 덩어리 지오메트리(색은 꼭짓점 색)로 굽고,
// 바깥쪽으로 부풀린 검은 뒷면(인버티드 헐)으로 외곽선을 그린다. 그림자는 3단 툰 셰이딩.
import * as THREE from 'three';

const C = new THREE.Color(), V = new THREE.Vector3(), N3 = new THREE.Matrix3();
let GRAD = null;
export function gradTex() {
  if (GRAD) return GRAD;
  const d = new Uint8Array([90, 90, 90, 255, 170, 170, 170, 255, 235, 235, 235, 255, 255, 255, 255, 255]);
  GRAD = new THREE.DataTexture(d, 4, 1, THREE.RGBAFormat); GRAD.minFilter = GRAD.magFilter = THREE.NearestFilter; GRAD.needsUpdate = true;
  return GRAD;
}
const MATS = {};
export function toon(key = 'vc', o = {}) {
  if (MATS[key]) return MATS[key];
  const m = new THREE.MeshToonMaterial({ vertexColors: o.vc !== false, color: o.color || '#ffffff', gradientMap: gradTex() });
  if (o.emissive) { m.emissive.set(o.emissive); m.emissiveIntensity = o.ei ?? 0.5; }
  if (o.transparent) { m.transparent = true; m.opacity = o.opacity ?? 0.5; m.depthWrite = false; }
  if (o.map) m.map = o.map;
  return (MATS[key] = m);
}
export const OUTLINE = new THREE.MeshBasicMaterial({ color: '#2a1a28', side: THREE.BackSide });

// 기본 도형(재사용)
const G = {
  sph: new THREE.SphereGeometry(1, 18, 12), sphLo: new THREE.SphereGeometry(1, 10, 7), box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 14), cone: new THREE.ConeGeometry(1, 1, 14), cap: new THREE.CapsuleGeometry(0.5, 1, 6, 12),
  tor: new THREE.TorusGeometry(1, 0.25, 8, 20), ico: new THREE.IcosahedronGeometry(1, 0), dode: new THREE.DodecahedronGeometry(1, 0),
};
for (const k in G) if (G[k].index) G[k] = G[k].toNonIndexed();

/** 부품을 모아 한 지오메트리로 굽는 도구 */
export class Kit {
  constructor(o = {}) { this.parts = []; this.colMap = o.colMap || ((c) => c); this.outlineW = o.outline ?? 0.035; }
  add(geo, color, { p = [0, 0, 0], s = [1, 1, 1], r = [0, 0, 0], outline = true, role = 'main' } = {}) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), new THREE.Vector3(...(typeof s === 'number' ? [s, s, s] : s)));
    this.parts.push({ geo: typeof geo === 'string' ? G[geo] : geo, color: this.colMap(color, role), m, outline });
    return this;
  }
  sph(c, p, s, o = {}) { return this.add('sph', c, { p, s, ...o }); }
  // 눈 한 쌍(+z 방향): 흰자 · 눈동자 · 반짝임
  eyes(p, gap, size, o = {}) {
    const [x, y, z] = p, dir = o.side ? 1 : 0;
    for (const k of [-1, 1]) {
      const ex = dir ? x : x + k * gap, ez = dir ? z + k * gap : z;
      this.add('sph', '#ffffff', { p: [ex, y, ez], s: size, role: 'eye' });
      const fx = dir ? k * size * 0.55 : 0, fz = dir ? 0 : size * 0.55;
      this.add('sph', o.pupil || '#1a1420', { p: [ex + fx + (dir ? 0 : 0), y + size * 0.05, ez + fz], s: size * 0.58, outline: false, role: 'pupil' });
      this.add('sph', '#ffffff', { p: [ex + fx * 1.3 + size * 0.15, y + size * 0.3, ez + fz * 1.3 + size * 0.1], s: size * 0.2, outline: false, role: 'eye' });
    }
    return this;
  }
  cheeks(p, gap, size = 0.08) { for (const k of [-1, 1]) this.add('sph', '#ff8aa0', { p: [p[0] + k * gap, p[1], p[2]], s: [size, size * 0.6, size * 0.4], outline: false, role: 'cheek' }); return this; }
  build(o = {}) {
    let n = 0, no = 0;
    for (const q of this.parts) { n += q.geo.attributes.position.count; if (q.outline) no += q.geo.attributes.position.count; }
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3), opos = new Float32Array(no * 3);
    let i = 0, j = 0;
    const hueShift = o.chimera;
    for (const q of this.parts) {
      const P = q.geo.attributes.position, Nn = q.geo.attributes.normal;
      N3.getNormalMatrix(q.m);
      C.set(q.color);
      for (let k = 0; k < P.count; k++) {
        V.fromBufferAttribute(P, k).applyMatrix4(q.m); const px = V.x, py = V.y, pz = V.z;
        pos[i * 3] = px; pos[i * 3 + 1] = py; pos[i * 3 + 2] = pz;
        V.fromBufferAttribute(Nn, k).applyMatrix3(N3).normalize(); nor[i * 3] = V.x; nor[i * 3 + 1] = V.y; nor[i * 3 + 2] = V.z;
        let cc = C;
        if (hueShift && px < 0) { const h = {}; C.getHSL(h); cc = new THREE.Color().setHSL((h.h + 0.45) % 1, h.s, h.l); }
        col[i * 3] = cc.r; col[i * 3 + 1] = cc.g; col[i * 3 + 2] = cc.b;
        if (q.outline) { opos[j * 3] = px + V.x * this.outlineW; opos[j * 3 + 1] = py + V.y * this.outlineW; opos[j * 3 + 2] = pz + V.z * this.outlineW; j++; }
        i++;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeBoundingSphere();
    let og = null;
    if (no) { og = new THREE.BufferGeometry(); og.setAttribute('position', new THREE.BufferAttribute(opos, 3)); og.computeBoundingSphere(); }
    return { geo, og };
  }
}
/** 굽힌 지오메트리 → 메쉬(+외곽선) */
export function meshOf(b, mat = toon(), shadow = true) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(b.geo, mat); m.castShadow = shadow; m.receiveShadow = false; g.add(m);
  if (b.og) { const o = new THREE.Mesh(b.og, OUTLINE); g.add(o); }
  g.userData.body = m;
  return g;
}

// ---------------------------------------------------------------------------------------------------------------
// 생물 28종(+z 쪽이 얼굴). 키 약 1. 돌연변이는 색 바꾸기(colMap)·크기·발광으로
// ---------------------------------------------------------------------------------------------------------------
function mutMap(mut) {
  const w = new THREE.Color('#fff8f4'), dark = new THREE.Color('#2a2430'), g = new THREE.Color('#7aff9a');
  return (hex, role) => {
    if (mut === 'none' || mut === 'giant' || mut === 'chimera' || role === 'eye' || role === 'cheek') return hex;
    const c = new THREE.Color(hex);
    if (mut === 'albino') return role === 'pupil' ? '#e0405a' : '#' + c.lerp(w, 0.82).getHexString();
    if (mut === 'melan') return role === 'pupil' ? '#ffd84a' : '#' + c.lerp(dark, 0.72).getHexString();
    if (mut === 'gfp') return role === 'pupil' ? '#0a3a1a' : '#' + c.lerp(g, 0.55).getHexString();
    return hex;
  };
}
const PET_CACHE = new Map();
export function petGeo(id, mut = 'none') {
  const key = id + ':' + mut;
  if (PET_CACHE.has(key)) return PET_CACHE.get(key);
  const k = new Kit({ colMap: mutMap(mut) });
  (PETDEF[id] || PETDEF.tadpole)(k);
  const b = k.build({ chimera: mut === 'chimera' });
  PET_CACHE.set(key, b);
  return b;
}
export function petMesh(id, mut = 'none') {
  const mat = mut === 'gfp' ? toon('gfp', { emissive: '#3aff6a', ei: 0.45 }) : mut === 'chimera' ? toon('chim', { emissive: '#ff5aff', ei: 0.12 }) : toon();
  const g = meshOf(petGeo(id, mut), mat);
  if (mut === 'giant') g.scale.setScalar(1.45);
  return g;
}
const leg = (k, c, x, z, h = 0.18, r = 0.07) => k.add('cap', c, { p: [x, h / 2, z], s: [r * 2, h, r * 2] });
export const PETDEF = {
  tadpole(k) { k.sph('#4a7a3a', [0, 0.32, 0.05], [0.3, 0.28, 0.32]); k.add('sph', '#5a8a48', { p: [0, 0.3, -0.35], s: [0.08, 0.12, 0.32] }); k.add('sph', '#7aa860', { p: [0, 0.3, -0.62], s: [0.03, 0.14, 0.18] }); k.eyes([0, 0.4, 0.24], 0.12, 0.09); k.cheeks([0, 0.3, 0.3], 0.18, 0.05); },
  frog(k) { k.sph('#5ac85a', [0, 0.3, 0], [0.38, 0.3, 0.34]); k.sph('#c8f0a0', [0, 0.24, 0.14], [0.28, 0.2, 0.24]); for (const s of [-1, 1]) { k.sph('#5ac85a', [s * 0.22, 0.56, 0.12], 0.13); k.sph('#4aa84a', [s * 0.32, 0.1, 0.1], [0.12, 0.08, 0.18]); k.sph('#ffb84a', [s * 0.36, 0.06, 0.24], 0.05); } k.eyes([0, 0.6, 0.2], 0.22, 0.08); k.add('tor', '#2a6a2a', { p: [0, 0.3, 0.28], s: [0.1, 0.04, 0.04], r: [0, 0, 0], outline: false }); },
  newt(k) { k.add('cap', '#f07a3a', { p: [0, 0.2, 0], s: [0.28, 0.6, 0.26], r: [Math.PI / 2, 0, 0] }); k.sph('#f07a3a', [0, 0.24, 0.32], [0.2, 0.15, 0.2]); k.add('cone', '#e0602a', { p: [0, 0.2, -0.5], s: [0.08, 0.4, 0.06], r: [-Math.PI / 2, 0, 0] }); for (const [x, z] of [[-0.15, 0.15], [0.15, 0.15], [-0.15, -0.15], [0.15, -0.15]]) leg(k, '#e0602a', x * 1.3, z, 0.12, 0.05); for (let i = 0; i < 4; i++) k.sph('#2a2a2a', [(i % 2 ? 0.07 : -0.07), 0.33, 0.15 - i * 0.12], 0.04, { outline: false }); k.eyes([0, 0.33, 0.44], 0.1, 0.06); },
  axolotl(k) { k.add('cap', '#ffb0c8', { p: [0, 0.26, -0.05], s: [0.36, 0.55, 0.32], r: [Math.PI / 2, 0, 0] }); k.sph('#ffb0c8', [0, 0.32, 0.3], [0.3, 0.24, 0.24]); for (const s of [-1, 1]) for (let i = 0; i < 3; i++) k.add('cap', '#ff5a8a', { p: [s * 0.3, 0.42 + (i - 1) * 0.08, 0.22], s: [0.05, 0.18, 0.05], r: [0, 0, s * (1.2 + (i - 1) * 0.35)] }); k.add('sph', '#ffc8d8', { p: [0, 0.3, -0.5], s: [0.04, 0.16, 0.24] }); for (const [x, z] of [[-0.18, 0.15], [0.18, 0.15], [-0.18, -0.2], [0.18, -0.2]]) leg(k, '#ff9ab8', x, z, 0.12, 0.05); k.eyes([0, 0.36, 0.5], 0.16, 0.055); k.cheeks([0, 0.28, 0.52], 0.2, 0.05); },
  chick(k) { k.sph('#ffe04a', [0, 0.3, 0], [0.3, 0.28, 0.28]); k.sph('#ffe04a', [0, 0.6, 0.05], 0.22); k.add('cone', '#ff9a2a', { p: [0, 0.58, 0.28], s: [0.07, 0.12, 0.07], r: [Math.PI / 2, 0, 0] }); for (const s of [-1, 1]) k.sph('#ffd02a', [s * 0.28, 0.32, 0], [0.06, 0.14, 0.16]); k.add('cone', '#ffe04a', { p: [0, 0.84, 0.02], s: [0.05, 0.12, 0.05] }); leg(k, '#ff9a2a', -0.1, 0, 0.1, 0.03); leg(k, '#ff9a2a', 0.1, 0, 0.1, 0.03); k.eyes([0, 0.66, 0.2], 0.1, 0.05); k.cheeks([0, 0.56, 0.22], 0.15, 0.04); },
  penguin(k) { k.sph('#2a3040', [0, 0.42, 0], [0.32, 0.42, 0.3]); k.sph('#ffffff', [0, 0.38, 0.12], [0.24, 0.34, 0.22]); k.sph('#ffb84a', [0, 0.62, 0.2], [0.14, 0.06, 0.06], { outline: false }); k.add('cone', '#ff8a2a', { p: [0, 0.6, 0.32], s: [0.05, 0.12, 0.05], r: [Math.PI / 2, 0, 0] }); for (const s of [-1, 1]) { k.sph('#2a3040', [s * 0.32, 0.4, 0], [0.06, 0.22, 0.12], { r: [0, 0, s * 0.3] }); k.sph('#ff9a2a', [s * 0.1, 0.03, 0.08], [0.09, 0.03, 0.12]); } k.eyes([0, 0.7, 0.22], 0.1, 0.05); },
  flamingo(k) { k.sph('#ff8ab0', [0, 0.62, 0], [0.26, 0.2, 0.32]); k.add('cap', '#ff8ab0', { p: [0, 0.92, 0.2], s: [0.08, 0.45, 0.08], r: [0.3, 0, 0] }); k.sph('#ff8ab0', [0, 1.16, 0.28], 0.12); k.add('cap', '#2a2a2a', { p: [0, 1.1, 0.42], s: [0.05, 0.14, 0.05], r: [1.9, 0, 0] }); leg(k, '#ff6a9a', 0.05, 0, 0.5, 0.025); k.add('cap', '#ff6a9a', { p: [-0.06, 0.38, -0.02], s: [0.05, 0.3, 0.05], r: [0.9, 0, 0] }); k.sph('#ff6a9a', [0, 0.66, -0.28], [0.2, 0.1, 0.12]); k.eyes([0, 1.2, 0.36], 0.08, 0.035); },
  peacock(k) { for (let i = 0; i < 9; i++) { const a = (i / 8 - 0.5) * 2.2; k.add('sph', i % 2 ? '#2a8a7a' : '#3aa8d8', { p: [Math.sin(a) * 0.5, 0.5 + Math.cos(a) * 0.4, -0.22], s: [0.12, 0.38, 0.03], r: [0, 0, -a] }); k.sph('#ffd84a', [Math.sin(a) * 0.78, 0.5 + Math.cos(a) * 0.62, -0.2], 0.06, { outline: false }); } k.sph('#2a6ad8', [0, 0.4, 0], [0.22, 0.26, 0.24]); k.sph('#2a6ad8', [0, 0.72, 0.1], 0.14); for (let i = -1; i <= 1; i++) k.sph('#3ac8f0', [i * 0.05, 0.92, 0.08], 0.03); k.add('cone', '#d8b04a', { p: [0, 0.7, 0.26], s: [0.04, 0.09, 0.04], r: [Math.PI / 2, 0, 0] }); leg(k, '#a08a6a', -0.08, 0, 0.18, 0.03); leg(k, '#a08a6a', 0.08, 0, 0.18, 0.03); k.eyes([0, 0.76, 0.2], 0.07, 0.04); },
  turtle(k) { k.sph('#5aa86a', [0, 0.28, -0.02], [0.42, 0.24, 0.48]); for (let i = 0; i < 5; i++) k.add('sph', '#3a7a4a', { p: [((i % 3) - 1) * 0.2, 0.44, (Math.floor(i / 3) - 0.3) * 0.28], s: [0.11, 0.05, 0.11], outline: false }); k.sph('#c8e0a0', [0, 0.14, 0], [0.4, 0.08, 0.44]); k.sph('#9ad08a', [0, 0.26, 0.5], [0.16, 0.14, 0.16]); for (const [x, z] of [[-0.38, 0.28], [0.38, 0.28], [-0.32, -0.32], [0.32, -0.32]]) k.sph('#9ad08a', [x, 0.12, z], [0.14, 0.05, 0.1]); k.eyes([0, 0.32, 0.6], 0.08, 0.045); },
  chameleon(k) { k.sph('#6ad84a', [0, 0.36, 0], [0.24, 0.28, 0.36]); k.add('cone', '#5ac83a', { p: [0, 0.6, 0.18], s: [0.12, 0.2, 0.18], r: [-0.5, 0, 0] }); k.add('tor', '#4ab82a', { p: [0, 0.3, -0.42], s: [0.14, 0.14, 0.2], r: [0, Math.PI / 2, 0] }); k.sph('#ffd84a', [0, 0.4, 0], [0.25, 0.06, 0.3], { outline: false }); for (const [x, z] of [[-0.18, 0.14], [0.18, 0.14], [-0.18, -0.16], [0.18, -0.16]]) leg(k, '#4ab82a', x, z, 0.2, 0.04); for (const s of [-1, 1]) { k.sph('#6ad84a', [s * 0.17, 0.46, 0.22], 0.1); } k.eyes([0, 0.46, 0.22], 0.17, 0.06, { side: false }); },
  iguana(k) { k.add('cap', '#5aa060', { p: [0, 0.26, -0.05], s: [0.3, 0.6, 0.3], r: [Math.PI / 2, 0, 0] }); k.sph('#5aa060', [0, 0.32, 0.36], [0.17, 0.16, 0.2]); for (let i = 0; i < 6; i++) k.add('cone', '#3a7a40', { p: [0, 0.44 - Math.abs(i - 2) * 0.01, 0.32 - i * 0.14], s: [0.03, 0.1, 0.05] }); k.add('cone', '#5aa060', { p: [0, 0.22, -0.6], s: [0.07, 0.5, 0.07], r: [-Math.PI / 2, 0, 0] }); k.sph('#ffb04a', [0, 0.2, 0.42], [0.06, 0.08, 0.05], { outline: false }); for (const [x, z] of [[-0.18, 0.18], [0.18, 0.18], [-0.18, -0.18], [0.18, -0.18]]) leg(k, '#4a9050', x, z, 0.16, 0.05); k.eyes([0, 0.4, 0.48], 0.1, 0.05); },
  komodo(k) { k.add('cap', '#8a7a5a', { p: [0, 0.3, -0.05], s: [0.42, 0.75, 0.38], r: [Math.PI / 2, 0, 0] }); k.sph('#8a7a5a', [0, 0.34, 0.45], [0.22, 0.17, 0.26]); k.add('cone', '#7a6a4a', { p: [0, 0.24, -0.72], s: [0.1, 0.6, 0.1], r: [-Math.PI / 2, 0, 0] }); k.add('cap', '#ff5a6a', { p: [0, 0.28, 0.72], s: [0.03, 0.14, 0.03], r: [Math.PI / 2, 0, 0], outline: false }); for (const [x, z] of [[-0.24, 0.22], [0.24, 0.22], [-0.24, -0.25], [0.24, -0.25]]) leg(k, '#7a6a4a', x, z, 0.2, 0.07); k.eyes([0, 0.42, 0.6], 0.12, 0.05); },
  salmon(k) { k.sph('#f08a6a', [0, 0.36, 0], [0.18, 0.24, 0.48]); k.sph('#ffd0c0', [0, 0.28, 0.02], [0.15, 0.14, 0.44], { outline: false }); k.add('cone', '#d86a4a', { p: [0, 0.36, -0.56], s: [0.04, 0.3, 0.22], r: [Math.PI / 2, 0, 0] }); k.add('cone', '#d86a4a', { p: [0, 0.58, 0], s: [0.03, 0.14, 0.14] }); k.add('cyl', '#606a7a', { p: [0, 0.06, 0], s: [0.12, 0.12, 0.12] }); for (let i = 0; i < 5; i++) k.sph('#2a2a3a', [0.13, 0.45, 0.2 - i * 0.1], 0.025, { outline: false }); k.eyes([0, 0.42, 0.36], 0.14, 0.05, { side: true }); },
  seahorse(k) { k.add('tor', '#ffb84a', { p: [0, 0.22, -0.05], s: [0.12, 0.12, 0.18], r: [0, Math.PI / 2, 0] }); k.add('cap', '#ffb84a', { p: [0, 0.5, 0], s: [0.24, 0.4, 0.26] }); k.sph('#ffc86a', [0, 0.82, 0.04], [0.15, 0.14, 0.16]); k.add('cyl', '#ffb84a', { p: [0, 0.82, 0.24], s: [0.05, 0.22, 0.05], r: [Math.PI / 2, 0, 0] }); k.sph('#ffe0a0', [0, 0.48, 0.1], [0.14, 0.24, 0.1], { outline: false }); for (let i = 0; i < 3; i++) k.add('cone', '#e0902a', { p: [0, 0.98 - i * 0.12, -0.12], s: [0.03, 0.08, 0.04], r: [-1.2, 0, 0] }); k.add('cyl', '#5a8aa0', { p: [0, 0.05, 0], s: [0.1, 0.1, 0.1] }); k.eyes([0, 0.88, 0.04], 0.13, 0.05, { side: true }); },
  puffer(k) { k.sph('#f2d06a', [0, 0.45, 0], 0.4); k.sph('#fff0c0', [0, 0.36, 0.08], [0.32, 0.26, 0.32], { outline: false }); for (let i = 0; i < 18; i++) { const t = Math.acos(1 - 2 * (i + 0.5) / 18), ph = i * 2.4; const d = [Math.sin(t) * Math.cos(ph), Math.cos(t), Math.sin(t) * Math.sin(ph)]; k.add('cone', '#c8a04a', { p: [d[0] * 0.42, 0.45 + d[1] * 0.42, d[2] * 0.42], s: [0.04, 0.12, 0.04], r: [Math.atan2(Math.hypot(d[0], d[2]), d[1]) * (d[2] >= 0 ? 1 : -1), 0, -Math.atan2(d[0], Math.abs(d[2]) + 1e-3) * 0.6] }); } k.add('cone', '#e0b04a', { p: [0, 0.45, -0.45], s: [0.04, 0.16, 0.16], r: [Math.PI / 2, 0, 0] }); k.eyes([0, 0.55, 0.32], 0.15, 0.08); k.add('tor', '#c86a4a', { p: [0, 0.38, 0.39], s: [0.05, 0.05, 0.05], outline: false }); },
  coelacanth(k) { k.sph('#3a5a8a', [0, 0.4, 0], [0.24, 0.3, 0.55]); for (let i = 0; i < 10; i++) k.sph('#e8e8f0', [(i % 2 ? 0.2 : -0.2), 0.42 + ((i % 3) - 1) * 0.12, 0.3 - Math.floor(i / 2) * 0.13], 0.04, { outline: false }); for (const [x, y, z] of [[0.24, 0.28, 0.15], [-0.24, 0.28, 0.15], [0.2, 0.2, -0.2], [-0.2, 0.2, -0.2]]) k.add('sph', '#2a4a7a', { p: [x, y, z], s: [0.04, 0.14, 0.1] }); k.add('cone', '#2a4a7a', { p: [0, 0.4, -0.66], s: [0.05, 0.32, 0.26], r: [Math.PI / 2, 0, 0] }); k.add('cyl', '#6a6a7a', { p: [0, 0.06, 0], s: [0.12, 0.12, 0.12] }); k.eyes([0, 0.48, 0.38], 0.18, 0.06, { side: true }); },
  platypus(k) { k.sph('#8a5a3a', [0, 0.3, 0], [0.32, 0.26, 0.42]); k.sph('#8a5a3a', [0, 0.36, 0.34], [0.22, 0.2, 0.2]); k.add('sph', '#3a3a4a', { p: [0, 0.32, 0.58], s: [0.18, 0.05, 0.16] }); k.add('sph', '#7a4a2a', { p: [0, 0.22, -0.48], s: [0.22, 0.04, 0.18] }); for (const [x, z] of [[-0.24, 0.22], [0.24, 0.22], [-0.24, -0.2], [0.24, -0.2]]) k.sph('#3a3a4a', [x, 0.06, z], [0.09, 0.03, 0.09]); k.eyes([0, 0.46, 0.46], 0.12, 0.045); },
  echidna(k) { k.sph('#6a4a3a', [0, 0.3, 0], [0.38, 0.28, 0.4]); for (let i = 0; i < 26; i++) { const t = Math.acos(1 - (i + 0.5) / 26), ph = i * 2.4; const d = [Math.sin(t) * Math.cos(ph), Math.cos(t), Math.sin(t) * Math.sin(ph)]; if (d[2] > 0.6) continue; k.add('cone', i % 3 ? '#f2e8d0' : '#2a2a2a', { p: [d[0] * 0.36, 0.32 + d[1] * 0.26, d[2] * 0.38], s: [0.03, 0.18, 0.03], r: [Math.atan2(d[2], d[1]), 0, -Math.atan2(d[0], d[1])] }); } k.add('cap', '#5a3a2a', { p: [0, 0.24, 0.48], s: [0.06, 0.2, 0.06], r: [1.3, 0, 0] }); k.eyes([0, 0.34, 0.36], 0.1, 0.04); },
  kiwi(k) { k.sph('#8a6a4a', [0, 0.36, 0], [0.32, 0.3, 0.34]); k.sph('#9a7a5a', [0, 0.52, 0.22], 0.16); k.add('cap', '#e0c8a0', { p: [0, 0.42, 0.52], s: [0.04, 0.34, 0.04], r: [1.7, 0, 0] }); leg(k, '#e0b080', -0.1, 0.05, 0.12, 0.03); leg(k, '#e0b080', 0.1, 0.05, 0.12, 0.03); k.eyes([0, 0.58, 0.32], 0.09, 0.035); },
  cassowary(k) { k.sph('#2a2a3a', [0, 0.6, 0], [0.32, 0.32, 0.36]); k.add('cap', '#3a7ad8', { p: [0, 0.98, 0.14], s: [0.1, 0.3, 0.1] }); k.sph('#3a8ae0', [0, 1.18, 0.18], 0.11); k.add('cone', '#c8904a', { p: [0, 1.36, 0.16], s: [0.07, 0.18, 0.1] }); k.sph('#e83a4a', [0, 0.94, 0.24], [0.05, 0.1, 0.04], { outline: false }); k.add('cone', '#e0c040', { p: [0, 1.15, 0.32], s: [0.035, 0.1, 0.035], r: [Math.PI / 2, 0, 0] }); leg(k, '#8a8a6a', -0.12, 0, 0.35, 0.05); leg(k, '#8a8a6a', 0.12, 0, 0.35, 0.05); k.eyes([0, 1.22, 0.25], 0.07, 0.035); },
  raptor(k) { k.sph('#6aa85a', [0, 0.5, 0], [0.24, 0.24, 0.34]); k.sph('#6aa85a', [0, 0.78, 0.26], [0.17, 0.16, 0.22]); k.add('cone', '#6aa85a', { p: [0, 0.5, -0.5], s: [0.08, 0.5, 0.08], r: [-Math.PI / 2 - 0.2, 0, 0] }); for (let i = 0; i < 5; i++) k.add('sph', '#c84a3a', { p: [0, 0.74 - i * 0.04, 0.2 - i * 0.16], s: [0.03, 0.08, 0.06], outline: false }); for (const s of [-1, 1]) { leg(k, '#5a904a', s * 0.12, 0, 0.28, 0.06); k.add('cap', '#5a904a', { p: [s * 0.18, 0.5, 0.25], s: [0.04, 0.14, 0.04], r: [0.8, 0, 0] }); } k.add('sph', '#ffffff', { p: [0, 0.7, 0.46], s: [0.12, 0.03, 0.03], outline: false }); k.eyes([0, 0.86, 0.38], 0.1, 0.05); },
  trike(k) { k.sph('#d8a05a', [0, 0.36, -0.05], [0.36, 0.3, 0.46]); k.sph('#d8a05a', [0, 0.42, 0.38], [0.24, 0.22, 0.22]); k.add('cyl', '#f0c88a', { p: [0, 0.58, 0.26], s: [0.42, 0.05, 0.42], r: [-1.1, 0, 0] }); for (const [x, y] of [[-0.12, 0.6], [0.12, 0.6], [0, 0.4]]) k.add('cone', '#fff4e0', { p: [x, y, 0.56], s: [0.04, y > 0.5 ? 0.22 : 0.12, 0.04], r: [1.1, 0, 0] }); for (const [x, z] of [[-0.22, 0.2], [0.22, 0.2], [-0.22, -0.25], [0.22, -0.25]]) leg(k, '#c8904a', x, z, 0.16, 0.08); k.add('cone', '#d8a05a', { p: [0, 0.3, -0.56], s: [0.08, 0.3, 0.08], r: [-Math.PI / 2, 0, 0] }); k.eyes([0, 0.5, 0.52], 0.12, 0.05); },
  ptera(k) { k.sph('#c86a5a', [0, 0.6, 0], [0.16, 0.18, 0.26]); for (const s of [-1, 1]) k.add('cone', '#e08a6a', { p: [s * 0.46, 0.62, 0], s: [0.24, 0.62, 0.04], r: [0, 0, s * Math.PI / 2] }); k.sph('#c86a5a', [0, 0.82, 0.2], [0.12, 0.12, 0.14]); k.add('cone', '#d8a04a', { p: [0, 0.82, 0.44], s: [0.05, 0.3, 0.05], r: [Math.PI / 2, 0, 0] }); k.add('cone', '#a84a3a', { p: [0, 0.9, -0.1], s: [0.04, 0.32, 0.05], r: [-1.9, 0, 0] }); leg(k, '#a85a4a', -0.06, 0, 0.42, 0.025); leg(k, '#a85a4a', 0.06, 0, 0.42, 0.025); k.eyes([0, 0.88, 0.28], 0.08, 0.04); },
  trex(k) { k.sph('#4a9a6a', [0, 0.56, -0.05], [0.3, 0.32, 0.36]); k.sph('#4a9a6a', [0, 0.92, 0.22], [0.26, 0.22, 0.28]); k.sph('#c8e8b0', [0, 0.5, 0.18], [0.2, 0.24, 0.16], { outline: false }); k.add('box', '#ffffff', { p: [0, 0.82, 0.48], s: [0.3, 0.04, 0.04], outline: false }); k.add('cone', '#4a9a6a', { p: [0, 0.5, -0.56], s: [0.12, 0.55, 0.12], r: [-Math.PI / 2 - 0.15, 0, 0] }); for (const s of [-1, 1]) { leg(k, '#3a8a5a', s * 0.16, 0, 0.3, 0.09); k.add('cap', '#3a8a5a', { p: [s * 0.22, 0.6, 0.28], s: [0.04, 0.1, 0.04], r: [1.0, 0, 0] }); } k.eyes([0, 1.02, 0.4], 0.12, 0.06); k.cheeks([0, 0.9, 0.46], 0.18, 0.05); },
  jelly(k) { k.add('sph', '#7af0e0', { p: [0, 0.75, 0], s: [0.36, 0.28, 0.36] }); k.sph('#c8fff6', [0, 0.82, 0], [0.22, 0.14, 0.22], { outline: false }); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; k.add('cap', i % 2 ? '#5ad8c8' : '#9af0e8', { p: [Math.cos(a) * 0.22, 0.38, Math.sin(a) * 0.22], s: [0.04, 0.5, 0.04], r: [Math.sin(a) * 0.2, 0, -Math.cos(a) * 0.2] }); } k.eyes([0, 0.72, 0.32], 0.12, 0.05); k.cheeks([0, 0.64, 0.33], 0.18, 0.04); },
  tardi(k) { k.add('cap', '#d8b8a0', { p: [0, 0.38, 0], s: [0.5, 0.5, 0.48], r: [Math.PI / 2, 0, 0] }); for (let i = 0; i < 3; i++) k.add('tor', '#c8a890', { p: [0, 0.38, 0.25 - i * 0.25], s: [0.24, 0.24, 0.24], outline: false }); k.sph('#e0c4ae', [0, 0.42, 0.42], [0.2, 0.18, 0.16]); k.add('tor', '#a87a6a', { p: [0, 0.38, 0.56], s: [0.05, 0.05, 0.05], outline: false }); for (let i = 0; i < 4; i++) for (const s of [-1, 1]) leg(k, '#c8a890', s * 0.2, 0.3 - i * 0.2, 0.14, 0.06); k.eyes([0, 0.5, 0.5], 0.09, 0.04); },
  amoeba(k) { k.sph('#9ae86a', [0, 0.36, 0], [0.42, 0.32, 0.42]); for (const [x, z, s] of [[0.42, 0.1, 0.18], [-0.38, 0.2, 0.16], [0.1, -0.42, 0.17], [-0.2, -0.3, 0.13]]) k.sph('#8ad85a', [x, 0.22, z], [s, s * 0.8, s]); k.sph('#5a9a3a', [0.08, 0.44, -0.1], 0.13, { outline: false }); k.add('sph', '#ffd84a', { p: [0, 0.82, 0.05], s: [0.22, 0.06, 0.22] }); for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; k.add('cone', '#ffd84a', { p: [Math.cos(a) * 0.16, 0.92, 0.05 + Math.sin(a) * 0.16], s: [0.05, 0.14, 0.05] }); } k.eyes([0, 0.48, 0.36], 0.14, 0.06); k.cheeks([0, 0.38, 0.38], 0.22, 0.05); },
  dnadragon(k) { k.sph('#7a5ae8', [0, 0.56, 0], [0.3, 0.3, 0.38]); k.sph('#7a5ae8', [0, 0.92, 0.26], [0.22, 0.2, 0.24]); for (const s of [-1, 1]) { k.add('cone', '#ff5a8a', { p: [s * 0.4, 0.86, -0.05], s: [0.2, 0.5, 0.04], r: [0, 0, s * 1.3] }); k.add('cone', '#ffd84a', { p: [s * 0.1, 1.14, 0.2], s: [0.04, 0.16, 0.04], r: [0, 0, -s * 0.3] }); leg(k, '#6a4ad8', s * 0.16, 0, 0.26, 0.08); } for (let i = 0; i < 8; i++) { const t = i / 8; k.sph(i % 2 ? '#ff5a8a' : '#5a8aff', [Math.sin(t * Math.PI * 2) * 0.12, 0.5 - t * 0.3, -0.4 - t * 0.5], 0.07); k.sph(i % 2 ? '#5a8aff' : '#ff5a8a', [-Math.sin(t * Math.PI * 2) * 0.12, 0.5 - t * 0.3, -0.4 - t * 0.5], 0.07); } k.sph('#e8e0ff', [0, 0.5, 0.2], [0.2, 0.22, 0.14], { outline: false }); k.eyes([0, 1.0, 0.44], 0.11, 0.06); },
};

// ---------------------------------------------------------------------------------------------------------------
// 알 · 사람 · 경비 · 기지 · 소품
// ---------------------------------------------------------------------------------------------------------------
const EGG_CACHE = new Map();
export function eggGeo(E) {
  if (EGG_CACHE.has(E.id)) return EGG_CACHE.get(E.id);
  const k = new Kit({ outline: 0.03 });
  if (E.roe) { for (let i = 0; i < 9; i++) { const a = i * 2.4, rr = 0.1 + (i % 3) * 0.06; k.sph(i % 2 ? E.col : E.col2, [Math.cos(a) * rr, 0.16 + Math.floor(i / 3) * 0.14, Math.sin(a) * rr], 0.12); } k.sph('#c04a1a', [0.04, 0.3, 0.12], 0.04, { outline: false }); }
  else {
    k.add('sph', E.col, { p: [0, 0.3, 0], s: [0.24, 0.32, 0.24] });
    if (E.jelly) { k.add('sph', E.col2, { p: [0, 0.3, 0], s: [0.28, 0.34, 0.28], outline: false }); k.sph('#1a3a1a', [0, 0.3, 0.06], 0.08, { outline: false }); }
    const r = (s => () => (s = (s * 9301 + 49297) % 233280) / 233280)(E.tier * 7 + 3);
    for (let i = 0; i < 9 && !E.jelly; i++) { const t = r() * Math.PI, ph = r() * Math.PI * 2, d = [Math.sin(t) * Math.cos(ph) * 0.24, 0.3 + Math.cos(t) * 0.31, Math.sin(t) * Math.sin(ph) * 0.24]; k.add('sph', E.spots, { p: [d[0] * 1.01, d[1], d[2] * 1.01], s: [0.04 + r() * 0.03, 0.04, 0.04 + r() * 0.03], outline: false }); }
    if (E.cracks) for (let i = 0; i < 4; i++) k.add('box', '#3a2a1a', { p: [Math.sin(i * 1.6) * 0.24, 0.28 + i * 0.06, Math.cos(i * 1.6) * 0.24], s: [0.02, 0.12, 0.02], r: [0, i * 1.6, 0.6], outline: false });
    if (E.glow) for (let i = 0; i < 6; i++) { const t = i / 6; k.sph(i % 2 ? '#ff5a8a' : '#5a8aff', [Math.sin(t * 6.28) * 0.25, 0.08 + t * 0.48, Math.cos(t * 6.28) * 0.25], 0.035, { outline: false }); }
  }
  const b = k.build(); EGG_CACHE.set(E.id, b); return b;
}
export function eggMesh(E) {
  const mat = E.glow ? toon('eggglow', { emissive: '#3ad8ff', ei: 0.35 }) : toon();
  return meshOf(eggGeo(E), mat);
}

/** 연구원(플레이어·봇): 몸통+머리 한 덩어리, 팔다리는 따로 움직임 */
export function personMesh(coat, opts = {}) {
  const root = new THREE.Group();
  const kb = new Kit({ outline: 0.035 });
  kb.add('cap', coat, { p: [0, 0.82, 0], s: [0.5, 0.42, 0.42] });            // 실험 가운
  kb.add('cap', '#f4f2ec', { p: [0, 0.86, 0.06], s: [0.3, 0.32, 0.34], outline: false });
  kb.sph('#f2c8a0', [0, 1.38, 0], 0.3);                                     // 머리
  kb.add('sph', opts.hair || '#4a3020', { p: [0, 1.5, -0.04], s: [0.32, 0.22, 0.3] });
  kb.add('cyl', '#3a3a4a', { p: [0, 1.42, 0.02], s: [0.31, 0.05, 0.31], outline: false }); // 고글 끈
  for (const s of [-1, 1]) { kb.add('cyl', '#7af0ff', { p: [s * 0.12, 1.42, 0.27], s: [0.09, 0.05, 0.09], r: [Math.PI / 2, 0, 0] }); }
  kb.eyes([0, 1.32, 0.26], 0.1, 0.05); kb.cheeks([0, 1.24, 0.27], 0.17, 0.045);
  kb.add('box', '#5a4a3a', { p: [0, 0.9, -0.27], s: [0.32, 0.36, 0.16] });   // 가방
  kb.add('box', coat, { p: [0, 0.98, -0.36], s: [0.22, 0.12, 0.02], outline: false });
  const body = meshOf(kb.build()); root.add(body);
  const limb = (c, len, w) => { const k = new Kit({ outline: 0.03 }); k.add('cap', c, { p: [0, -len / 2, 0], s: [w, len, w] }); return meshOf(k.build()); };
  const arms = [-1, 1].map((s) => { const a = limb(coat, 0.42, 0.14); a.position.set(s * 0.3, 1.0, 0); root.add(a); return a; });
  const legs = [-1, 1].map((s) => { const l = limb('#3a3a5a', 0.42, 0.17); l.position.set(s * 0.12, 0.5, 0); root.add(l); return l; });
  root.userData = { body, arms, legs, carry: new THREE.Group() };
  root.userData.carry.position.set(0, 1.85, 0); root.add(root.userData.carry);
  return root;
}
/** 경비 세포: 헬멧 쓴 백혈구 */
let GUARD = null;
export function guardMesh() {
  if (!GUARD) {
    const k = new Kit({ outline: 0.04 });
    k.sph('#f2f4ff', [0, 0.7, 0], [0.55, 0.6, 0.55]);
    for (const [x, y, z] of [[0.5, 0.5, 0.2], [-0.5, 0.6, 0.1], [0.3, 1.1, -0.3], [-0.2, 0.3, 0.45]]) k.sph('#e4e8ff', [x, y, z], 0.18);
    k.add('sph', '#ef5a5a', { p: [0, 1.12, 0], s: [0.5, 0.3, 0.5] }); k.add('cyl', '#c83a3a', { p: [0, 1.0, 0], s: [0.56, 0.06, 0.56] });
    k.add('box', '#ffffff', { p: [0, 1.25, 0.36], s: [0.16, 0.16, 0.04], outline: false }); k.add('box', '#ef5a5a', { p: [0, 1.25, 0.38], s: [0.04, 0.12, 0.02], outline: false }); k.add('box', '#ef5a5a', { p: [0, 1.25, 0.38], s: [0.12, 0.04, 0.02], outline: false });
    k.eyes([0, 0.82, 0.48], 0.17, 0.08); for (const s of [-1, 1]) k.add('box', '#1a1420', { p: [s * 0.17, 0.98, 0.5], s: [0.16, 0.04, 0.03], r: [0, 0, s * 0.35], outline: false });
    k.add('cap', '#5a8aff', { p: [0.55, 0.7, 0.2], s: [0.08, 0.5, 0.08], r: [0.3, 0, -0.4] });
    GUARD = k.build();
  }
  return meshOf(GUARD);
}
// 공용 소품 지오메트리(인스턴스로 많이 세움)
export function propGeo(kind, seed = 1) {
  const r = (s => () => (s = (s * 9301 + 49297) % 233280) / 233280)(seed * 17 + kind.length);
  const k = new Kit({ outline: 0.06 });
  switch (kind) {
    case 'mushroom': { const h = 1.6 + r() * 1.4, c = ['#ef5a5a', '#f0a030', '#a46ae8', '#4f8fe0'][Math.floor(r() * 4)]; k.add('cyl', '#f6eedc', { p: [0, h / 2, 0], s: [0.22, h, 0.22] }); k.add('sph', c, { p: [0, h, 0], s: [0.9, 0.5, 0.9] }); for (let i = 0; i < 6; i++) { const a = r() * 6.28, d = 0.3 + r() * 0.5; k.add('sph', '#ffffff', { p: [Math.cos(a) * d, h + 0.32 - d * 0.25, Math.sin(a) * d], s: [0.12, 0.05, 0.12], outline: false }); } break; }
    case 'fern': for (let i = 0; i < 7; i++) { const a = i / 7 * 6.28; k.add('cone', i % 2 ? '#4aa85a' : '#5ac86a', { p: [Math.cos(a) * 0.35, 0.5, Math.sin(a) * 0.35], s: [0.18, 1.1, 0.06], r: [Math.sin(a) * 0.6, a, -Math.cos(a) * 0.6] }); } break;
    case 'rock': k.add('dode', ['#9a9aa8', '#8a8478', '#a8a090'][Math.floor(r() * 3)], { p: [0, 0.4, 0], s: [0.8 + r() * 0.5, 0.6 + r() * 0.4, 0.7 + r() * 0.4], r: [r(), r(), r()] }); break;
    case 'reed': for (let i = 0; i < 7; i++) { const a = r() * 6.28, d = r() * 0.45, h = 1.1 + r() * 0.9, tx = Math.cos(a) * d, tz = Math.sin(a) * d, lean = [tx * 0.25, 0, -tz * 0.25]; k.add('cyl', '#5aa84a', { p: [tx, h / 2, tz], s: [0.05, h, 0.05], r: lean, outline: false }); if (i % 2 === 0) k.add('cap', '#8a5a3a', { p: [tx + Math.sin(lean[2]) * -h * 0.5, h - 0.1, tz], s: [0.14, 0.32, 0.14] }); else k.add('cone', '#6ac05a', { p: [tx, h * 0.45, tz], s: [0.12, h * 0.9, 0.04], r: [lean[0] * 2, a, lean[2] * 2] }); } k.add('cyl', '#4a8a5a', { p: [0, 0.03, 0], s: [0.7, 0.06, 0.7], outline: false }); break;
    case 'lily': k.add('cyl', '#5ab8a8', { p: [0, 0.03, 0], s: [1.1, 0.04, 1.1], outline: false }); for (let i = 0; i < 3; i++) { const a = r() * 6.28, d = 0.2 + r() * 0.5; k.add('cyl', '#5ac86a', { p: [Math.cos(a) * d, 0.08, Math.sin(a) * d], s: [0.35, 0.04, 0.35] }); } k.sph('#ff9ab8', [0.1, 0.18, 0.1], [0.14, 0.1, 0.14]); break;
    case 'crystal': for (let i = 0; i < 4; i++) { const a = r() * 6.28, h = 0.8 + r(); k.add('cone', i % 2 ? '#7af0e0' : '#a0c8ff', { p: [Math.cos(a) * 0.2, h / 2, Math.sin(a) * 0.2], s: [0.2, h, 0.2], r: [Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3] }); } break;
    case 'tree': { const h = 2.2 + r() * 1.5; k.add('cyl', '#8a5a3a', { p: [0, h / 2, 0], s: [0.25, h, 0.25] }); for (let i = 0; i < 4; i++) k.sph(i % 2 ? '#5ab85a' : '#6ad06a', [(r() - 0.5) * 0.8, h + (r() - 0.3) * 0.6, (r() - 0.5) * 0.8], 0.75 + r() * 0.3); break; }
    case 'nest': for (let i = 0; i < 10; i++) { const a = i / 10 * 6.28; k.add('cap', i % 2 ? '#a8784a' : '#8a5a3a', { p: [Math.cos(a) * 0.42, 0.12, Math.sin(a) * 0.42], s: [0.1, 0.5, 0.1], r: [Math.PI / 2, a, 0], outline: false }); } k.add('cyl', '#c8a070', { p: [0, 0.05, 0], s: [0.42, 0.1, 0.42] }); break;
    case 'pillar': { const h = 1; k.add('cyl', '#b8a0d8', { p: [0, h / 2, 0], s: [1, h, 1] }); k.add('cyl', '#d0c0f0', { p: [0, h - 0.04, 0], s: [1.08, 0.08, 1.08] }); break; }
  }
  return k.build();
}
