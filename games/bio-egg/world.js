// 바이오 알 도둑: 섬(땅·물·길), 서식지 소품, 둥지·받침대, 중앙 광장 기계, 기지 6곳의 배치와 모델
import * as THREE from 'three';
import { Kit, meshOf, toon, propGeo, OUTLINE } from './models.js';
import { EGGS } from './data.js';

export const ISLAND = 76, PLAZA = 13, BASE_R = 62;
export const ZONES = [            // 바깥(흔함) → 안(희귀). r0~r1 고리
  { r0: 45, r1: 53, col: '#9ad86a', name: '개구리 들판' },
  { r0: 35, r1: 45, col: '#78c8a4', name: '맹그로브 습지' },
  { r0: 24.5, r1: 35, col: '#e4bc7c', name: '화석 사막' },
  { r0: 14, r1: 24.5, col: '#b8a6ea', name: '유전자 수정 정원' },
];
export const zoneAt = (r) => { for (let i = 0; i < ZONES.length; i++) if (r >= ZONES[i].r0 && r < ZONES[i].r1) return i; return -1; };
// 점프 레벨 → 최고 높이
export const GRAV = 30;
export const jumpV = (lv) => 9.5 + lv * 1.15;
export const jumpH = (lv) => jumpV(lv) ** 2 / (2 * GRAV);
export const pillarH = (need) => (need ? jumpH(need) - 0.25 : 0);

const rng = (s) => () => (s = (s * 16807) % 2147483647) / 2147483647;

/** 기지 i의 중심·방향(로컬 +z가 섬 중심 쪽) */
export function baseFrame(i) {
  const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
  const x = Math.cos(a) * BASE_R, z = Math.sin(a) * BASE_R;
  const yaw = Math.atan2(-x, -z); // 로컬 +z → 중심
  return { a, x, z, yaw, cos: Math.cos(yaw), sin: Math.sin(yaw) };
}
export const toWorld = (f, lx, lz) => [f.x + lx * f.cos + lz * f.sin, f.z - lx * f.sin + lz * f.cos];
export const toLocal = (f, wx, wz) => { const dx = wx - f.x, dz = wz - f.z; return [dx * f.cos - dz * f.sin, dx * f.sin + dz * f.cos]; };
// 기지 안 배치(로컬 좌표)
export const BASE_W = 9.5, BASE_D = 8.5;
export const slotPos = (k) => { const c = k % 6, r = Math.floor(k / 6); return [(c - 2.5) * 2.05, -6.6 + r * 1.95]; };
export const incuPos = (k) => [-7.9, -6.5 + k * 2.05];
export const PAD = [7.6, 4.6], LOCKPAD = [7.6, 0.6], TRAY = [7.6, -4.2];

/** 땅: 극좌표 격자에 꼭짓점 색으로 구역·길을 칠함 */
function ground(scene) {
  const AS = 160, RS = 52, pos = [], col = [], idx = [];
  const c = new THREE.Color(), c2 = new THREE.Color(), path = new THREE.Color('#f2e2b8'), plaza = new THREE.Color('#f6eedf'), edge = new THREE.Color('#a8dc80');
  const baseA = [...Array(6)].map((_, i) => baseFrame(i).a);
  for (let ri = 0; ri <= RS; ri++) {
    const r = (ri / RS) ** 1.0 * ISLAND;
    for (let ai = 0; ai <= AS; ai++) {
      const a = (ai / AS) * Math.PI * 2;
      pos.push(Math.cos(a) * r, 0, Math.sin(a) * r);
      // 구역 색(경계는 살짝 섞음)
      if (r < PLAZA) c.copy(plaza);
      else if (r < PLAZA + 1.2) c.set('#e8d8b8');
      else if (r >= 53) c.copy(edge);
      else { const z = zoneAt(r); c.set(ZONES[Math.max(0, z)].col); const z2 = zoneAt(r + 1.6); if (z2 !== z && z2 >= 0) c.lerp(c2.set(ZONES[z2].col), 0.4); }
      // 기지로 가는 길 6개 + 광장 둘레 길
      if (r > PLAZA + 1 && r < BASE_R - 7) for (const ba of baseA) { let d = Math.abs(((a - ba + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * r; if (d < 1.6) { c.lerp(path, d < 1.15 ? 1 : 0.5); break; } }
      // 잔잔한 얼룩
      const n = Math.sin(a * 11 + r * 0.7) * Math.cos(r * 0.31 + a * 5);
      c.offsetHSL(0, 0, n * 0.025);
      col.push(c.r, c.g, c.b);
    }
  }
  for (let ri = 0; ri < RS; ri++) for (let ai = 0; ai < AS; ai++) { const a = ri * (AS + 1) + ai, b = a + AS + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshToonMaterial({ vertexColors: true })); m.receiveShadow = true; scene.add(m);
  // 섬 절벽 + 물
  const cliff = new THREE.Mesh(new THREE.CylinderGeometry(ISLAND, ISLAND - 3, 5, 96, 1, true), toon('cliff', { vc: false, color: '#d8b07a' })); cliff.position.y = -2.5; scene.add(cliff);
  const grassLip = new THREE.Mesh(new THREE.TorusGeometry(ISLAND, 0.35, 6, 96), toon('lip', { vc: false, color: '#7cc85a' })); grassLip.rotation.x = Math.PI / 2; grassLip.position.y = -0.05; scene.add(grassLip);
  const water = new THREE.Mesh(new THREE.CircleGeometry(600, 48), toon('water', { vc: false, color: '#5cc6e6' })); water.rotation.x = -Math.PI / 2; water.position.y = -1.6; scene.add(water);
  const foam = new THREE.Mesh(new THREE.RingGeometry(ISLAND - 1, ISLAND + 2.4, 96), new THREE.MeshBasicMaterial({ color: '#e8fbff', transparent: true, opacity: 0.75 })); foam.rotation.x = -Math.PI / 2; foam.position.y = -1.5; scene.add(foam);
  // 광장 둘레 연석
  const curb = new THREE.Mesh(new THREE.TorusGeometry(PLAZA, 0.22, 6, 80), toon('curb', { vc: false, color: '#fff8ea' })); curb.rotation.x = Math.PI / 2; curb.position.y = 0.08; scene.add(curb);
  return { foam };
}

/** 인스턴스 소품: 종류마다 변형 3개 */
function props(scene, colliders, avoid) {
  const R = rng(7);
  const plan = [
    { kind: 'tree', z: [-1], n: 70, col: 0.9 }, { kind: 'mushroom', z: [0, 1], n: 26, col: 0.55 }, { kind: 'fern', z: [0, 1, -1], n: 60 },
    { kind: 'rock', z: [2, 1], n: 34, col: 0.8 }, { kind: 'reed', z: [1], n: 30 }, { kind: 'lily', z: [1], n: 18 }, { kind: 'crystal', z: [3, 2], n: 30, col: 0.5 },
    { kind: 'tree', z: [0], n: 12, col: 0.9 },
  ];
  const groups = {};
  for (const p of plan) {
    for (let i = 0; i < p.n; i++) {
      const zi = p.z[Math.floor(R() * p.z.length)];
      let r, a, ok = false;
      for (let t = 0; t < 30 && !ok; t++) {
        a = R() * Math.PI * 2;
        r = zi === -1 ? 54 + R() * 19 : ZONES[zi].r0 + 1 + R() * (ZONES[zi].r1 - ZONES[zi].r0 - 2);
        const x = Math.cos(a) * r, z = Math.sin(a) * r; ok = !avoid(x, z, p.col ? 2.4 : 1.6);
      }
      if (!ok) continue;
      const x = Math.cos(a) * r, z = Math.sin(a) * r, v = Math.floor(R() * 3), key = p.kind + v;
      (groups[key] ||= { kind: p.kind, v, list: [] }).list.push({ x, z, s: 0.8 + R() * 0.45, ry: R() * 6.28 });
      if (p.col) colliders.push({ x, z, r: p.col * (0.8 + 0.2), h: 99 });
    }
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (const k in groups) {
    const G = groups[k], b = propGeo(G.kind, G.v + 1);
    const mesh = new THREE.InstancedMesh(b.geo, toon(), G.list.length), om = new THREE.InstancedMesh(b.og, OUTLINE, G.list.length);
    G.list.forEach((o, i) => { m4.compose(new THREE.Vector3(o.x, 0, o.z), q.setFromEuler(e.set(0, o.ry, 0)), new THREE.Vector3(o.s, o.s, o.s)); mesh.setMatrixAt(i, m4); om.setMatrixAt(i, m4); });
    mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh, om);
  }
}

/** 둥지: 구역마다 정해진 알 종류. 높은 알은 받침대 위 */
function nests(scene, colliders) {
  const R = rng(31), list = [];
  const plan = [
    { z: 0, eggs: ['amph', 'bird'], n: 12 }, { z: 1, eggs: ['rept', 'fish'], n: 10 },
    { z: 2, eggs: ['mono', 'dino'], n: 8 }, { z: 3, eggs: ['gene'], n: 5 },
  ];
  const baseA = [...Array(6)].map((_, i) => baseFrame(i).a);
  const pillarMat = toon();
  for (const p of plan) {
    const Z = ZONES[p.z];
    for (let i = 0; i < p.n; i++) {
      let a = (i / p.n) * Math.PI * 2 + p.z * 0.37 + (R() - 0.5) * 0.25;
      const r = (Z.r0 + Z.r1) / 2 + (R() - 0.5) * (Z.r1 - Z.r0 - 3.5);
      // 길 위는 피함
      for (const ba of baseA) { const d = (((a - ba + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * r; if (Math.abs(d) < 3) a += (d < 0 ? -1 : 1) * (3 - Math.abs(d)) / r; }
      const E = EGGS.find((e) => e.id === p.eggs[i % p.eggs.length]);
      const x = Math.cos(a) * r, z = Math.sin(a) * r, h = pillarH(E.jump || 0);
      const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
      if (h > 0) {
        const k = new Kit({ outline: 0.06 }), pc = ['#c8b4e8', '#d8c4a0', '#a8c8d8'][p.z % 3];
        k.add('cyl', pc, { p: [0, h / 2, 0], s: [1.5, h, 1.5] });
        k.add('cyl', '#ffffff', { p: [0, h - 0.06, 0], s: [1.62, 0.14, 1.62] });
        for (let s = 0; s < 4; s++) k.add('dode', pc, { p: [Math.cos(s * 1.7) * 1.45, 0.3 + s * 0.15, Math.sin(s * 1.7) * 1.45], s: 0.45 + R() * 0.3, r: [R(), R(), R()] });
        // 높이 표시 띠(필요 점프 레벨이 높을수록 많음)
        for (let s = 0; s < Math.ceil((E.jump || 0) / 2); s++) k.add('cyl', E.col, { p: [0, 0.6 + s * 0.45, 0], s: [1.52, 0.1, 1.52], outline: false });
        g.add(meshOf(k.build(), pillarMat));
        colliders.push({ x, z, r: 1.55, h, top: true });
      }
      const nest = meshOf(propGeo('nest', i + p.z * 20)); nest.position.y = h; g.add(nest);
      // 희귀 알 표시 빛기둥
      let beam = null;
      if (E.tier >= 3) {
        beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 9, 12, 1, true), new THREE.MeshBasicMaterial({ color: E.col, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }));
        beam.position.y = h + 4.6; g.add(beam);
      }
      list.push({ id: list.length, x, z, h, zone: p.z, egg: E.id, E, has: true, timer: 0, g, beam, eggMesh: null });
    }
  }
  return list;
}

/** 중앙 광장: 러닝 벨트 · 융합기 · 트레일 상점 · 판매대 · 환생 DNA 탑 */
function plaza(scene, colliders) {
  const M = [];
  const add = (id, a, rad, build, col) => {
    const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
    const g = meshOf(build()); g.position.set(x, 0, z); g.rotation.y = Math.atan2(-x, -z) + Math.PI; scene.add(g);
    if (col) colliders.push({ x, z, r: col, h: 99 });
    M.push({ id, x, z, g, r: col ? col + 1.8 : 3 });
  };
  // 러닝 벨트(밟고 달리면 속도 점수)
  add('belt', -Math.PI / 2, 8.2, () => {
    const k = new Kit({ outline: 0.05 });
    k.add('box', '#5a6a8a', { p: [0, 0.18, 0], s: [3.2, 0.36, 5] });
    k.add('box', '#2a3040', { p: [0, 0.38, 0], s: [2.6, 0.06, 4.6], outline: false });
    for (let i = 0; i < 9; i++) k.add('box', '#3a4258', { p: [0, 0.42, -2 + i * 0.5], s: [2.6, 0.02, 0.08], outline: false });
    for (const s of [-1, 1]) { k.add('cyl', '#e8eef8', { p: [s * 1.45, 0.95, 1.4], s: [0.08, 1.2, 0.08] }); k.add('cyl', '#e8eef8', { p: [s * 1.45, 1.55, 0.4], s: [0.08, 2.1, 0.08], r: [Math.PI / 2, 0, 0] }); }
    k.add('box', '#ff7a5a', { p: [0, 1.45, 2.1], s: [2.2, 1.1, 0.3] }); k.add('box', '#2a3a4a', { p: [0, 1.5, 1.94], s: [1.7, 0.7, 0.05], outline: false });
    k.add('box', '#7af0a0', { p: [0, 1.5, 1.9], s: [1.2, 0.12, 0.03], outline: false });
    return k.build();
  });
  // 융합기
  add('fuse', 0, 8.6, () => {
    const k = new Kit({ outline: 0.05 });
    k.add('cyl', '#6a5aa8', { p: [0, 0.4, 0], s: [1.9, 0.8, 1.9] }); k.add('sph', '#c8b8ff', { p: [0, 1.3, 0], s: [1.3, 1.1, 1.3] }); k.sph('#ffffff', [0.4, 1.8, 0.5], 0.25, { outline: false });
    for (let i = 0; i < 3; i++) { const a = i / 3 * 6.28; k.add('cyl', '#8a7ae0', { p: [Math.cos(a) * 1.9, 0.9, Math.sin(a) * 1.9], s: [0.45, 1.8, 0.45] }); k.add('sph', '#e8a0ff', { p: [Math.cos(a) * 1.9, 1.95, Math.sin(a) * 1.9], s: 0.42 }); k.add('cyl', '#b8a8f0', { p: [Math.cos(a) * 1.2, 1.5, Math.sin(a) * 1.2], s: [0.12, 1.4, 0.12], r: [Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2] }); }
    k.add('tor', '#ffd84a', { p: [0, 2.5, 0], s: 0.5, r: [Math.PI / 2, 0, 0] });
    return k.build();
  }, 2.3);
  // 트레일 상점(줄무늬 차양)
  add('trail', Math.PI / 2, 8.6, () => {
    const k = new Kit({ outline: 0.05 });
    k.add('box', '#f2e8d8', { p: [0, 0.55, 0], s: [3.4, 1.1, 1.6] }); k.add('box', '#5ac8e8', { p: [0, 1.12, 0.1], s: [3.5, 0.12, 1.8] });
    for (let i = 0; i < 6; i++) k.add('box', i % 2 ? '#ffffff' : '#ff6a8a', { p: [-1.45 + i * 0.58, 2.7, 0.55], s: [0.58, 0.14, 1.4], r: [-0.35, 0, 0] });
    for (const s of [-1, 1]) k.add('cyl', '#c8a070', { p: [s * 1.6, 1.8, 0.95], s: [0.08, 1.9, 0.08] });
    for (let i = 0; i < 5; i++) k.sph(['#bfe8ff', '#9fd86a', '#ffd84a', '#5afff0', '#ff5a8a'][i], [-1.2 + i * 0.6, 1.4, 0.4], 0.2);
    return k.build();
  }, 2);
  // 판매대
  add('sell', Math.PI, 8.6, () => {
    const k = new Kit({ outline: 0.05 });
    k.add('box', '#c89a5a', { p: [0, 0.55, 0], s: [3.2, 1.1, 1.5] }); k.add('box', '#e8c07a', { p: [0, 1.12, 0], s: [3.3, 0.12, 1.6] });
    k.add('box', '#3aa86a', { p: [0, 2.6, 0.2], s: [3.4, 0.3, 1.8] }); for (const s of [-1, 1]) k.add('cyl', '#8a6a3a', { p: [s * 1.5, 1.85, 0.8], s: [0.08, 1.6, 0.08] });
    k.add('cyl', '#ffd84a', { p: [0, 3.35, 0.2], s: [0.6, 0.12, 0.6], r: [Math.PI / 2, 0, 0] }); k.add('box', '#d8a020', { p: [0, 3.35, 0.28], s: [0.12, 0.5, 0.02], outline: false });
    for (let i = 0; i < 6; i++) k.add('cyl', '#ffd84a', { p: [-1 + (i % 3) * 0.3, 1.24 + Math.floor(i / 3) * 0.08, 0.2], s: [0.14, 0.06, 0.14] });
    return k.build();
  }, 2);
  // 환생 DNA 탑(가운데)
  add('rebirth', 0, 0, () => {
    const k = new Kit({ outline: 0.05 });
    k.add('cyl', '#f2ead8', { p: [0, 0.3, 0], s: [2.6, 0.6, 2.6] }); k.add('cyl', '#e0d4bc', { p: [0, 0.75, 0], s: [2, 0.3, 2] });
    for (let i = 0; i < 22; i++) { const t = i / 22, a = t * Math.PI * 4, y = 1.1 + t * 5;
      k.sph('#ff6a8a', [Math.cos(a) * 0.9, y, Math.sin(a) * 0.9], 0.24); k.sph('#5a8aff', [-Math.cos(a) * 0.9, y, -Math.sin(a) * 0.9], 0.24);
      if (i % 2 === 0) k.add('cyl', ['#ffd84a', '#7ae8a0'][i / 2 % 2], { p: [0, y, 0], s: [0.08, 1.8, 0.08], r: [Math.PI / 2, 0, -a + Math.PI / 2], outline: false }); }
    k.add('ico', '#ffe88a', { p: [0, 6.6, 0], s: 0.5 });
    return k.build();
  }, 2);
  return M;
}

/** 기지 하나: 바닥·우리 칸·부화기·돈 발판·잠금 버튼·간판·방어막 */
export function buildBase(scene, i, col, name) {
  const f = baseFrame(i), root = new THREE.Group();
  root.position.set(f.x, 0, f.z); root.rotation.y = f.yaw; scene.add(root);
  const k = new Kit({ outline: 0.05 });
  // 바닥판(테두리 = 주인 색)
  k.add('box', col, { p: [0, 0.06, 0], s: [BASE_W * 2 + 0.6, 0.12, BASE_D * 2 + 0.6], outline: false });
  k.add('box', '#fbf7ee', { p: [0, 0.1, 0], s: [BASE_W * 2 - 0.4, 0.12, BASE_D * 2 - 0.4], outline: false });
  // 뒤쪽 울타리
  for (let x = -BASE_W; x <= BASE_W + 0.01; x += 1.9) { k.add('cyl', '#ffffff', { p: [x, 0.6, -BASE_D], s: [0.12, 1.1, 0.12] }); }
  k.add('box', col, { p: [0, 0.95, -BASE_D], s: [BASE_W * 2, 0.16, 0.12] }); k.add('box', col, { p: [0, 0.5, -BASE_D], s: [BASE_W * 2, 0.12, 0.1] });
  // 간판 기둥
  for (const s of [-1, 1]) k.add('cyl', '#8a6a4a', { p: [s * 2.6, 1.6, -BASE_D - 0.3], s: [0.14, 3.2, 0.14] });
  k.add('box', col, { p: [0, 3, -BASE_D - 0.3], s: [6, 1.2, 0.25] });
  // 돈 발판 · 잠금 버튼 · 알 대기판
  k.add('cyl', '#e8b830', { p: [PAD[0], 0.14, PAD[1]], s: [1.5, 0.16, 1.5] }); k.add('cyl', '#ffd84a', { p: [PAD[0], 0.24, PAD[1]], s: [1.2, 0.06, 1.2], outline: false });
  k.add('cyl', '#5a6a8a', { p: [LOCKPAD[0], 0.14, LOCKPAD[1]], s: [1.3, 0.16, 1.3] }); k.add('cyl', '#3ac8ff', { p: [LOCKPAD[0], 0.26, LOCKPAD[1]], s: [0.85, 0.12, 0.85], outline: false });
  k.add('box', '#c8a070', { p: [TRAY[0], 0.2, TRAY[1]], s: [1.8, 0.3, 2.6] }); k.add('box', '#f6e0b0', { p: [TRAY[0], 0.36, TRAY[1]], s: [1.5, 0.05, 2.3], outline: false });
  root.add(meshOf(k.build(), toon(), false));
  root.children[0].userData.body.receiveShadow = true;
  // 우리 칸(36)
  const slotG = new THREE.CylinderGeometry(0.8, 0.85, 0.1, 18), slotM = toon('slot', { vc: false, color: '#e6efe0' }), slotOff = toon('slotoff', { vc: false, color: '#f0ece4' });
  const slots = [];
  for (let s = 0; s < 36; s++) { const [x, z] = slotPos(s); const m = new THREE.Mesh(slotG, slotOff); m.position.set(x, 0.17, z); m.receiveShadow = true; root.add(m); slots.push(m); }
  // 부화기 7대(잠긴 것은 숨김)
  const incs = [];
  for (let s = 0; s < 7; s++) {
    const kk = new Kit({ outline: 0.04 });
    kk.add('cyl', '#7a8aa8', { p: [0, 0.25, 0], s: [0.75, 0.5, 0.75] }); kk.add('cyl', '#ff8a5a', { p: [0, 0.52, 0], s: [0.62, 0.08, 0.62], outline: false });
    kk.add('tor', '#c8d4e8', { p: [0, 0.5, 0], s: [0.62, 0.62, 0.62], r: [Math.PI / 2, 0, 0] });
    const g = meshOf(kk.build()); const [x, z] = incuPos(s); g.position.set(x, 0, z); root.add(g);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshToonMaterial({ color: '#bfefff', transparent: true, opacity: 0.35, depthWrite: false }));
    dome.position.y = 0.55; g.add(dome);
    const hold = new THREE.Group(); hold.position.y = 0.56; g.add(hold);
    incs.push({ g, hold, egg: null, key: '' });
  }
  // 방어막
  const shield = new THREE.Mesh(new THREE.SphereGeometry(13.2, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#5ad8ff', transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }));
  shield.visible = false; root.add(shield);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(13.2, 0.12, 6, 64), new THREE.MeshBasicMaterial({ color: '#7ae8ff' })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.15; ring.visible = false; root.add(ring);
  const petHold = new THREE.Group(); root.add(petHold);
  const trayHold = new THREE.Group(); trayHold.position.set(TRAY[0], 0.4, TRAY[1]); root.add(trayHold);
  return { i, f, root, slots, incs, shield, ring, petHold, trayHold, petMeshes: new Map(), col, name };
}

export function buildWorld(scene) {
  const colliders = [];
  const g = ground(scene);
  const N = nests(scene, colliders);
  const M = plaza(scene, colliders);
  const avoid = (x, z, rad) => {
    const r = Math.hypot(x, z);
    if (r < PLAZA + 2) return true;
    for (let i = 0; i < 6; i++) { const f = baseFrame(i), [lx, lz] = toLocal(f, x, z); if (Math.abs(lx) < BASE_W + 3 && Math.abs(lz) < BASE_D + 4) return true; if (lz > 0 && Math.abs(lx) < 3 && Math.hypot(x - f.x, z - f.z) < 30) return true; }
    for (const a of [...Array(6)].map((_, i) => baseFrame(i).a)) { const d = Math.abs(((Math.atan2(z, x) - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * r; if (d < 2.4) return true; }
    for (const n of N) if (Math.hypot(n.x - x, n.z - z) < 3.2 + rad) return true;
    for (const c of colliders) if (Math.hypot(c.x - x, c.z - z) < c.r + rad) return true;
    return false;
  };
  props(scene, colliders, avoid);
  return { colliders, nests: N, machines: M, foam: g.foam };
}
