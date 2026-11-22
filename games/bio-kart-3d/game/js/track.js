// Themes (5 concepts) + track definitions (4 per theme) + procedural builder (road, curbs, walls, scenery, sky objects)
import * as THREE from 'three';
import { load, radiusOf } from './assets.js';

// ------------------------------------------------------------------------------------------------ themes
export const THEMES = {
  garden: {
    name: '세포 정원', en: 'CELL GARDEN', icon: '🌿', color: '#5ad65a',
    ground: 0x86d39c, groundKind: 'grass', road: 0x30323f, fog: 0xbfe0ff, fogNear: 150, fogFar: 600,
    sky: { kind: 'clouds', cols: ['#1f5cf0', '#5fa2ff', '#bfe0ff'] }, sun: 0xfff1dc, sunI: 2.6, hemi: [0xd6eaff, 0x5a6a50, 1.35], exposure: 1.05,
    wall: [0xffc81a, 0xf4f1e8], neon: [0x40e8ff, 0xff5ae0], hill: 1.6, particles: 'pollen', bpm: 148,
    props: ['E22_Mushroom_House', 'E04_Mushroom_Giant', 'E05_GlowMushroom_Cluster', 'E24_Giant_Flower', 'E25_Ladybug_Rock', 'E26_Chloroplast_Tree', 'E01_Coral_Branch',
            'E11_Rock_Cluster', 'E13_Pollen_Spores', 'E19_Moss_Ground_Tile', 'E07_Neuron_Tree', 'E15_Giant_Leaf_Platform', 'T13_Tire_Stack', 'E24_Giant_Flower', 'E26_Chloroplast_Tree'],
    landmarks: ['E16_Giant_Cell_Dome', 'E09_Floating_Island_Waterfall', 'E08_Mitochondria_Island', 'E10_Volcano', 'E26_Chloroplast_Tree', 'E24_Giant_Flower'],
    skyObjs: [['S01_Cloud_Voxel', 16, 45, 110, 3, 7], ['S02_Sun_Cell', 1, 150, 150, 11, 11, 'sun'], ['S05_HotAir_Balloon_Cell', 3, 40, 80, 2.5, 3.5, 'drift'],
              ['S06_Bacteria_Blimp', 1, 60, 70, 4, 4, 'drift'], ['S04_Floating_Chloroplast', 2, 55, 90, 4, 6]],
  },
  vessel: {
    name: '혈관 속 세계', en: 'BLOOD STREAM', icon: '🩸', color: '#ff4d6a',
    ground: 0xd9707a, groundKind: 'flesh', road: 0x3a2430, fog: 0xffb0bc, fogNear: 120, fogFar: 520,
    sky: { kind: 'veins', cols: ['#4a0a22', '#c43a5e', '#ffc4cf'] }, sun: 0xffe2e2, sunI: 2.3, hemi: [0xffd0da, 0x6a2030, 1.3], exposure: 1.05,
    wall: [0xe8323c, 0xf4f1e8], neon: [0xff5a7a, 0xffd23a], hill: 2.4, particles: 'rbc', bpm: 152, tunnels: true,
    props: ['E21_Blood_Stream_Cells', 'E35_Platelet_Cluster', 'E37_Capillary_Column', 'E18_Bacteria_Colony', 'E14_Bubble_Cluster', 'E20_Sea_Anemone',
            'E17_Giant_Virus', 'T08_Membrane_Wall', 'E13_Pollen_Spores', 'T13_Tire_Stack', 'E35_Platelet_Cluster'],
    landmarks: ['E36_Heart_Valve_Gate', 'E17_Giant_Virus', 'E16_Giant_Cell_Dome', 'T09_Bone_Bridge', 'E37_Capillary_Column', 'E36_Heart_Valve_Gate'],
    skyObjs: [['S11_RBC_Swarm', 7, 40, 100, 2, 3.5], ['S12_Vessel_Ring', 5, 70, 120, 3, 4.5], ['S03_Sky_DNA_Helix', 2, 30, 50, 3, 4]],
  },
  lab: {
    name: '바이오 연구소', en: 'BIO LAB', icon: '🧪', color: '#4d8dff',
    ground: 0xc4cde8, groundKind: 'tiles', road: 0x343a4f, fog: 0xdfe6ff, fogNear: 150, fogFar: 600,
    sky: { kind: 'grid', cols: ['#2b3a8f', '#8fa6ff', '#f0f3ff'] }, sun: 0xffffff, sunI: 2.5, hemi: [0xe6ecff, 0x5a6080, 1.4], exposure: 1.05,
    wall: [0x2f7dff, 0xf4f1e8], neon: [0x40e8ff, 0x7dff5a], hill: 0.9, particles: 'sparkle', bpm: 150,
    props: ['L02_Erlenmeyer_Tower', 'L03_TestTube_Rack_Giant', 'L05_Beaker_Bubbling', 'L06_Pipette_Giant', 'L07_Lab_Crate', 'L08_Centrifuge', 'L09_Bunsen_Burner',
            'L10_Robot_Arm', 'L11_DNA_Monitor', 'L12_Pipe_Network', 'G12_Physics_Block', 'E12_Crystal_Cluster', 'T13_Tire_Stack'],
    landmarks: ['L01_Microscope_Giant', 'L04_Petri_Dish_Platform', 'L01_Microscope_Giant', 'E16_Giant_Cell_Dome', 'L02_Erlenmeyer_Tower', 'L10_Robot_Arm'],
    skyObjs: [['S03_Sky_DNA_Helix', 3, 30, 60, 3, 5], ['S06_Bacteria_Blimp', 2, 55, 75, 4, 5, 'drift'], ['S01_Cloud_Voxel', 9, 60, 120, 3, 6]],
  },
  sea: {
    name: '심해 플랑크톤', en: 'DEEP SEA', icon: '🪼', color: '#2ec4d6',
    ground: 0xd8c79a, groundKind: 'sand', road: 0x24364a, fog: 0x3aa6c8, fogNear: 90, fogFar: 430,
    sky: { kind: 'underwater', cols: ['#06204a', '#1677a8', '#5fd6e8'] }, sun: 0xc8f4ff, sunI: 2.1, hemi: [0x9fe8ff, 0x2a4a5a, 1.45], exposure: 1.1,
    wall: [0x28c8d8, 0xf4f1e8], neon: [0x40e8ff, 0xffe14a], hill: 2.0, particles: 'bubbles', bpm: 140,
    props: ['E01_Coral_Branch', 'E02_Coral_Brain', 'E03_Coral_Fan', 'E06_Kelp_Forest', 'E20_Sea_Anemone', 'E27_Hydrothermal_Vent', 'E28_Starfish', 'E29_Radiolarian',
            'E30_Ammonite_Shell', 'E31_Copepod', 'E14_Bubble_Cluster', 'E11_Rock_Cluster', 'E06_Kelp_Forest', 'E01_Coral_Branch'],
    landmarks: ['E27_Hydrothermal_Vent', 'E30_Ammonite_Shell', 'E16_Giant_Cell_Dome', 'E27_Hydrothermal_Vent', 'E02_Coral_Brain', 'E29_Radiolarian'],
    skyObjs: [['S10_Jellyfish_Giant', 9, 18, 60, 1.5, 3.5, 'bob'], ['E31_Copepod', 6, 15, 40, 1.5, 2.5, 'drift'], ['E14_Bubble_Cluster', 8, 10, 50, 2, 4, 'rise']],
  },
  neuron: {
    name: '뉴런 우주', en: 'NEURON COSMOS', icon: '🧠', color: '#a070ff',
    ground: 0x2a2150, groundKind: 'cosmos', road: 0x1b1a30, fog: 0x2a1f5a, fogNear: 130, fogFar: 560,
    sky: { kind: 'space', cols: ['#05031a', '#2a1660', '#7a4ac8'] }, sun: 0xb8c4ff, sunI: 1.7, hemi: [0x9aa4ff, 0x2a1840, 1.05], exposure: 1.2,
    wall: [0xa070ff, 0x40e8ff], neon: [0x40e8ff, 0xff5ae0], hill: 2.2, particles: 'stars', bpm: 156,
    props: ['E07_Neuron_Tree', 'E32_Synapse_Tower', 'E34_Glow_Crystal_Neuron', 'E12_Crystal_Cluster', 'E05_GlowMushroom_Cluster', 'E13_Pollen_Spores', 'E34_Glow_Crystal_Neuron', 'E07_Neuron_Tree'],
    landmarks: ['E33_Axon_Arch', 'E32_Synapse_Tower', 'E16_Giant_Cell_Dome', 'E33_Axon_Arch', 'E34_Glow_Crystal_Neuron', 'E32_Synapse_Tower'],
    skyObjs: [['S07_Brain_Planet', 1, 120, 120, 12, 12, 'planet'], ['S09_Moon_Cell', 1, 110, 110, 8, 8, 'sun'], ['S08_Star_Neuron', 12, 50, 140, 2, 5],
              ['S03_Sky_DNA_Helix', 1, 40, 40, 5, 5]],
  },
};
export const THEME_ORDER = ['garden', 'vessel', 'lab', 'sea', 'neuron'];

// ------------------------------------------------------------------------------------------------ tracks (5 x 4)
const T = (theme, id, name, en, diff, desc, extra) => Object.assign({ theme, id, name, en, diff, laps: 3, width: 16, desc }, extra);
export const TRACKS = [
  T('garden', 'cell_garden', '세포 정원 서킷', 'CELL GARDEN', 1, '버섯 마을과 산호 숲을 지나는 입문 코스. 점프대 1개, 부스터 패드 3개.', {
    pts: [[0, -120], [60, -125], [110, -100], [130, -50], [110, 0], [70, 15], [60, 50], [90, 90], [70, 130], [10, 140], [-50, 120], [-70, 70], [-110, 40], [-120, -20], [-90, -80], [-50, -115]],
    hills: [{ a: 1.6, f: 2, p: 0.3 }], ramps: [{ at: 0.56, len: 10, h: 1.7 }], pads: [[0.1, 0], [0.38, -3], [0.78, 3]], bounce: [[0.3, 5]], slime: [[0.62, -4]], tunnels: [] }),
  T('garden', 'pollen_hills', '꽃가루 언덕길', 'POLLEN HILLS', 1, '거대 꽃 사이 완만한 언덕을 달리는 쉬운 코스.', { seed: 11, cx: 1 }),
  T('garden', 'chloro_forest', '엽록체 숲 드리프트', 'CHLORO FOREST', 2, '엽록체 나무 숲의 연속 S자 커브. 드리프트 연습에 딱!', { seed: 12, cx: 2 }),
  T('garden', 'ladybug_village', '무당벌레 마을 일주', 'LADYBUG VILLAGE', 3, '점프대 2개와 헤어핀이 섞인 마을 일주 코스.', { seed: 13, cx: 3 }),

  T('vessel', 'vessel_highway', '혈관 하이웨이', 'VESSEL HIGHWAY', 2, '적혈구가 흐르는 고속 혈관 코스. 긴 터널과 언덕, 슬립스트림 승부!', {
    pts: [[-140, -150], [0, -170], [120, -150], [170, -80], [150, 0], [80, 20], [40, 70], [80, 120], [160, 140], [150, 200], [40, 210], [-80, 190], [-150, 120], [-120, 40], [-170, -40], [-180, -110]],
    hills: [{ a: 2.6, f: 3, p: 0.0 }, { a: 1.0, f: 5, p: 1.2 }], ramps: [{ at: 0.82, len: 11, h: 1.9 }], pads: [[0.05, 0], [0.3, 3], [0.55, -3], [0.75, 0]], bounce: [],
    slime: [[0.45, 3], [0.9, -3]], tunnels: [[0.14, 0.24], [0.6, 0.68]] }),
  T('vessel', 'valve_speedway', '심장 판막 스피드웨이', 'VALVE SPEEDWAY', 1, '심장 판막 게이트를 통과하는 넓은 고속 코스.', { seed: 21, cx: 1 }),
  T('vessel', 'capillary_maze', '모세혈관 미로', 'CAPILLARY MAZE', 3, '좁은 모세혈관을 굽이굽이 — 터널 속 급커브 주의!', { seed: 22, cx: 3, width: 15 }),
  T('vessel', 'rbc_rapids', '적혈구 급류', 'RBC RAPIDS', 2, '혈류를 타고 오르내리는 롤러코스터 언덕 코스.', { seed: 23, cx: 2 }),

  T('lab', 'bio_lab', '바이오 랩 익스프레스', 'BIO LAB EXPRESS', 3, '거대 실험 기구 사이를 누비는 테크니컬 코스. 급커브와 점프대 2개.', {
    width: 15, pts: [[0, -90], [70, -90], [100, -60], [80, -25], [30, -20], [20, 20], [70, 30], [100, 70], [70, 110], [0, 110], [-40, 80], [-20, 40], [-70, 20], [-100, -30], [-80, -80], [-40, -95]],
    hills: [{ a: 0.8, f: 2, p: 2.0 }], ramps: [{ at: 0.33, len: 9, h: 1.6 }, { at: 0.72, len: 9, h: 1.6 }], pads: [[0.06, 0], [0.5, 2], [0.9, -2]], bounce: [[0.18, -4]], slime: [[0.62, 3]], tunnels: [] }),
  T('lab', 'centrifuge_circuit', '원심분리기 서킷', 'CENTRIFUGE', 1, '빙글빙글 큰 원을 그리는 고속 서킷.', { seed: 31, cx: 1 }),
  T('lab', 'petri_sprint', '페트리 접시 스프린트', 'PETRI SPRINT', 2, '페트리 접시 플랫폼 옆 짧고 빠른 스프린트.', { seed: 32, cx: 2, scale: 0.85 }),
  T('lab', 'robot_factory', '로봇팔 공장 질주', 'ROBOT FACTORY', 3, '로봇팔이 늘어선 공장 라인. 물리 블록 다수!', { seed: 33, cx: 3 }),

  T('sea', 'plankton_reef', '플랑크톤 산호초', 'PLANKTON REEF', 1, '해파리가 떠다니는 산호초 사이 입문 코스.', { seed: 41, cx: 1 }),
  T('sea', 'vent_canyon', '열수구 협곡', 'VENT CANYON', 2, '뜨거운 열수구 사이 언덕과 점프대.', { seed: 42, cx: 2 }),
  T('sea', 'jelly_lagoon', '해파리 라군', 'JELLY LAGOON', 2, '트램펄린이 많은 통통 튀는 라군 코스.', { seed: 43, cx: 2, bounceN: 3 }),
  T('sea', 'ammonite_spiral', '암모나이트 나선', 'AMMONITE SPIRAL', 3, '나선처럼 휘감기는 고난도 해저 코스.', { seed: 44, cx: 3 }),

  T('neuron', 'synapse_starroad', '시냅스 스타로드', 'SYNAPSE STARROAD', 1, '별빛 뉴런 아래 넓게 뻗은 우주 도로.', { seed: 51, cx: 1 }),
  T('neuron', 'axon_galaxy', '축삭 은하 고속도로', 'AXON GALAXY', 2, '축삭 아치를 지나는 초고속 은하 코스.', { seed: 52, cx: 2, scale: 1.15 }),
  T('neuron', 'brain_orbit', '브레인 행성 궤도', 'BRAIN ORBIT', 3, '브레인 행성 궤도를 도는 급커브 연속 코스.', { seed: 53, cx: 3 }),
  T('neuron', 'crystal_cave', '신경 결정 동굴', 'CRYSTAL CAVE', 3, '빛나는 결정 사이를 누비는 최고 난도 코스.', { seed: 54, cx: 3, width: 15 }),
];

// ------------------------------------------------------------------------------------------------ layout generator
export function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function sampleCurve(pts, step) {
  const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], 0, p[1])), true, 'centripetal');
  const L = curve.getLength(), n = Math.round(L / step), out = [];
  for (let i = 0; i < n; i++) { const p = curve.getPointAt(i / n), t = curve.getTangentAt(i / n); out.push({ x: p.x, z: p.z, tx: t.x, tz: t.z }); }
  return { curve, L, n, out };
}
function layoutOk(pts, W) {
  const step = 3, { L, n, out } = sampleCurve(pts, step);
  if (L < 760 || L > 1600) return false;
  for (let i = 0; i < n; i++) {
    const a = out[(i - 2 + n) % n], b = out[(i + 2) % n];
    const k = Math.abs(Math.atan2(a.tx * b.tz - a.tz * b.tx, a.tx * b.tx + a.tz * b.tz)) / (4 * step);
    if (k > 0.068) return false;
  }
  const gap = Math.ceil(60 / step), min2 = (W + 12) ** 2;
  for (let i = 0; i < n; i += 2) for (let j = i + gap; j < n; j += 2) {
    if (n - (j - i) < gap) continue;
    if ((out[i].x - out[j].x) ** 2 + (out[i].z - out[j].z) ** 2 < min2) return false;
  }
  return true;
}
const layoutCache = {};
export function genLayout(seed, cx = 2, W = 16, scale = 1) {
  const key = seed + '_' + cx + '_' + W + '_' + scale; if (layoutCache[key]) return layoutCache[key];
  let best = null;
  for (let tries = 0; tries < 900 && !best; tries++) {
    const r = rng(seed * 7919 + tries * 131);
    const n = 14 + Math.floor(r() * 6), R = (110 + r() * 45) * scale, sx = 0.75 + r() * 0.5, sz = 2 - sx;
    const H = [2, 3, 4, 5].map(k => ({ k, a: (k === 2 ? 0.13 : 0.06 + 0.06 * cx) * (0.45 + r() * 0.9) / (k > 3 ? 1.5 : 1), p: r() * 6.28 }));
    const rot = r() * 6.28, pts = [];
    for (let i = 0; i < n; i++) {
      const th = i / n * 2 * Math.PI + (r() - 0.5) * 0.12;
      let rr = 1; for (const h of H) rr += h.a * Math.sin(h.k * th + h.p);
      const x = R * rr * Math.cos(th) * sx, z = R * rr * Math.sin(th) * sz;
      pts.push([x * Math.cos(rot) - z * Math.sin(rot), x * Math.sin(rot) + z * Math.cos(rot)]);
    }
    if (layoutOk(pts, W)) best = pts;
  }
  return (layoutCache[key] = best || TRACKS[0].pts);
}

// ------------------------------------------------------------------------------------------------ track
const tmp = new THREE.Vector3();
export class Track {
  constructor(def) {
    this.def = def; this.theme = THEMES[def.theme]; this.W = def.width;
    this.pts = def.pts || genLayout(def.seed, def.cx, def.width, def.scale || 1);
    const curve = new THREE.CatmullRomCurve3(this.pts.map(p => new THREE.Vector3(p[0], 0, p[1])), true, 'centripetal');
    this.L = curve.getLength();
    const n = Math.round(this.L / 2); this.N = n; this.step = this.L / n;
    this.samples = [];
    for (let i = 0; i < n; i++) {
      const s = i * this.step, p = curve.getPointAt(i / n), t = curve.getTangentAt(i / n);
      this.samples.push({ s, x: p.x, z: p.z, tx: t.x, tz: t.z, lx: t.z, lz: -t.x, y: 0, k: 0 });
    }
    for (let i = 0; i < n; i++) {               // signed curvature (+ = turning left)
      const a = this.samples[(i - 2 + n) % n], b = this.samples[(i + 2) % n];
      const ang = Math.atan2(a.tx * b.tz - a.tz * b.tx, a.tx * b.tx + a.tz * b.tz);
      this.samples[i].k = -ang / (4 * this.step);
    }
    this.feat = def.pts ? { hills: def.hills, ramps: def.ramps, pads: def.pads, bounce: def.bounce, slime: def.slime, tunnels: def.tunnels } : this.autoFeatures();
    for (const sm of this.samples) sm.y = this.elev(sm.s);
    this.group = new THREE.Group();
    this.dynamic = { items: [], pads: [], bounce: [], slime: [], blocks: [], spinners: [], lamps: [], sky: [] };
  }
  /** pick hills / ramps / pads / hazards for generated layouts: ramps and pads go on straights */
  autoFeatures() {
    const d = this.def, th = this.theme, r = rng(d.seed * 31 + 7), cx = d.cx;
    const curvAt = f => { let m = 0; for (let s = -14; s <= 26; s += 2) m = Math.max(m, Math.abs(this.samples[Math.floor(((f * this.L + s) / this.step + this.N) % this.N)].k)); return m; };
    let straights = [];
    for (const lim of [0.012, 0.02, 0.03]) { straights = []; for (let f = 0.04; f < 0.97; f += 0.01) if (curvAt(f) < lim) straights.push(+f.toFixed(2)); if (straights.length > 14) break; }
    const pick = (cnt, minGap, used) => { const out = []; const pool = [...straights].sort(() => r() - 0.5);
      for (const f of pool) { if (out.length >= cnt) break; if ([...out, ...used].every(u => Math.abs(u - f) > minGap && Math.abs(u - f) < 1 - minGap) && f > 0.06) out.push(f); } return out; };
    const ramps = pick(cx >= 3 ? 2 : cx === 2 ? 1 : 0 + (r() < 0.5 ? 1 : 0), 0.15, []).map(f => ({ at: f, len: 10, h: 1.5 + r() * 0.5 }));
    const pads = pick(3 + (cx > 1 ? 1 : 0), 0.08, ramps.map(x => x.at)).map(f => [f, Math.round((r() - 0.5) * 6)]);
    const used = [...ramps.map(x => x.at), ...pads.map(p => p[0])];
    const any = n => { const out = []; for (let i = 0; i < 60 && out.length < n; i++) { const f = 0.08 + r() * 0.86; if (used.every(u => Math.abs(u - f) > 0.05)) { out.push(f); used.push(f); } } return out; };
    const bounce = any(d.bounceN ?? (cx >= 2 ? 1 : 0)).map(f => [f, (r() < 0.5 ? -1 : 1) * 4.5]);
    const slime = any(cx).map(f => [f, (r() < 0.5 ? -1 : 1) * (2 + r() * 3)]);
    const hills = [{ a: th.hill * (0.6 + r() * 0.8), f: 2 + Math.floor(r() * 2), p: r() * 6 }, { a: th.hill * 0.35 * r(), f: 4 + Math.floor(r() * 3), p: r() * 6 }];
    const tunnels = [];
    if (th.tunnels) { const fs = pick(2, 0.2, []); for (const f of fs) tunnels.push([Math.max(0.02, f - 0.04), Math.min(0.98, f + 0.05)]); }
    return { hills, ramps, pads, bounce, slime, tunnels };
  }
  elev(s) {
    const d = this.feat, u = s / this.L; let y = 0;
    for (const h of d.hills) y += h.a * (1 + Math.sin(2 * Math.PI * h.f * u + h.p)) * 0.5;
    for (const r of d.ramps) { const dd = s - r.at * this.L; if (dd >= 0 && dd <= r.len) y += r.h * dd / r.len; }
    return y;
  }
  wrap(s) { return ((s % this.L) + this.L) % this.L; }
  at(s) {
    s = this.wrap(s); const f = s / this.step, i = Math.floor(f) % this.N, j = (i + 1) % this.N, t = f - Math.floor(f);
    const a = this.samples[i], b = this.samples[j];
    return { s, i, x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, y: this.elev(s), tx: a.tx, tz: a.tz, lx: a.lx, lz: a.lz, k: a.k };
  }
  place(s, lat, lift = 0) { const p = this.at(s); return { x: p.x + p.lx * lat, y: p.y + lift, z: p.z + p.lz * lat, yaw: Math.atan2(p.tx, p.tz), p }; }
  /** nearest point on centreline, searching around a hint index */
  nearest(x, z, hint = -1) {
    let best = 1e12, bi = 0;
    if (hint < 0) { for (let i = 0; i < this.N; i++) { const p = this.samples[i], d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < best) { best = d; bi = i; } } }
    else for (let d = -25; d <= 25; d++) { const i = (hint + d + this.N) % this.N, p = this.samples[i], dd = (p.x - x) ** 2 + (p.z - z) ** 2; if (dd < best) { best = dd; bi = i; } }
    const a = this.samples[bi], nx = this.samples[(bi + 1) % this.N];
    const sx = nx.x - a.x, sz = nx.z - a.z, sl = Math.hypot(sx, sz) || 1;
    let t = ((x - a.x) * sx + (z - a.z) * sz) / (sl * sl); t = Math.max(-1, Math.min(1, t));
    const s = this.wrap(a.s + t * this.step);
    const lat = (x - a.x) * a.lx + (z - a.z) * a.lz;
    return { i: bi, s, lat, lx: a.lx, lz: a.lz, tx: a.tx, tz: a.tz, k: a.k };
  }
  heightAt(s) { return this.elev(this.wrap(s)); }
  maxCurv(s, ahead) { let m = 0; for (let d = 0; d < ahead; d += 4) m = Math.max(m, Math.abs(this.at(s + d).k)); return m; }
  bounds() { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const p of this.samples) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); } return { x0, x1, z0, z1, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, R: Math.max(x1 - x0, z1 - z0) / 2 }; }

  // ---------------------------------------------------------------------------- geometry
  build(scene, groundTex) {
    const { W, samples, N } = this, th = this.theme;
    scene.add(this.group);
    const b = this.bounds();
    const ground = new THREE.Mesh(new THREE.CircleGeometry(900, 64), new THREE.MeshStandardMaterial({ color: th.ground, roughness: 1, map: groundTex || null }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(b.cx, -0.02, b.cz); ground.receiveShadow = true; this.group.add(ground);
    const road = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const p = samples[i % N];
      for (const lat of [-W / 2, W / 2]) road.push(p.x + p.lx * lat, p.y + 0.03, p.z + p.lz * lat);
      for (const lat of [-W / 2, W / 2]) road.push(p.x + p.lx * lat, -0.05, p.z + p.lz * lat);
      if (i < N) { const a = i * 4, b2 = a + 4; idx.push(a, b2, a + 1, a + 1, b2, b2 + 1, a + 2, b2 + 2, a, a, b2 + 2, b2, a + 1, b2 + 1, a + 3, a + 3, b2 + 1, b2 + 3); }
    }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(road, 3)); rg.setIndex(idx); rg.computeVertexNormals();
    const roadMesh = new THREE.Mesh(rg, new THREE.MeshStandardMaterial({ color: th.road, roughness: 0.6, metalness: 0.05, side: THREE.DoubleSide }));
    roadMesh.receiveShadow = true; this.group.add(roadMesh);
    for (const side of [-1, 1]) {
      const pos = [], col = [], c1 = new THREE.Color(th.wall[0]), c2 = new THREE.Color(0xffffff);
      for (let i = 0; i < N; i++) {
        const a = samples[i], b2 = samples[(i + 1) % N], c = (i >> 1) % 2 ? c1 : c2;
        const o0 = side * (W / 2 - 1.0), o1 = side * W / 2;
        const q = [[a, o0], [a, o1], [b2, o0], [b2, o1]].map(([p, o]) => [p.x + p.lx * o, p.y + 0.06, p.z + p.lz * o]);
        for (const k of [0, 2, 1, 1, 2, 3]) { pos.push(...q[k]); col.push(c.r, c.g, c.b); }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, side: THREE.DoubleSide })); m.receiveShadow = true; this.group.add(m);
      this.ribbon(side * (W / 2 - 1.25), side * (W / 2 - 1.05), 0.065, new THREE.MeshBasicMaterial({ color: side < 0 ? th.neon[0] : th.neon[1], side: THREE.DoubleSide }));
    }
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
    const dashN = Math.floor(this.L / 8), dash = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 0.02, 3), new THREE.MeshBasicMaterial({ color: 0xffffff }), dashN);
    for (let i = 0; i < dashN; i++) { const p = this.place(i * 8, 0, 0.05); q.setFromAxisAngle(up, p.yaw); m4.compose(tmp.set(p.x, p.y, p.z), q, one); dash.setMatrixAt(i, m4); }
    this.group.add(dash);
    { const c = document.createElement('canvas'); c.width = 16; c.height = 2; const g = c.getContext('2d');
      for (let x = 0; x < 16; x++) for (let y = 0; y < 2; y++) { g.fillStyle = (x + y) % 2 ? '#111' : '#fff'; g.fillRect(x, y, 1, 1); }
      const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter;
      const sl = new THREE.Mesh(new THREE.PlaneGeometry(W, 2), new THREE.MeshBasicMaterial({ map: t })); const p = this.place(0, 0, 0.07);
      sl.rotation.set(-Math.PI / 2, 0, p.yaw); sl.position.set(p.x, p.y, p.z); this.group.add(sl); }
    this.buildWalls();
  }
  ribbon(o0, o1, lift, mat) {
    const { samples, N } = this, pos = [], idx = [];
    for (let i = 0; i <= N; i++) { const p = samples[i % N]; pos.push(p.x + p.lx * o0, p.y + lift, p.z + p.lz * o0, p.x + p.lx * o1, p.y + lift, p.z + p.lz * o1); if (i < N) { const a = 2 * i; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); this.group.add(m); return m;
  }
  buildWalls() {
    const { W, L } = this, th = this.theme;
    this.chevrons = [];
    const step = 1.0, n = Math.floor(L / step) * 2;
    const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(0.95, 1.0, 0.7), new THREE.MeshStandardMaterial({ roughness: 0.45 }), n);
    inst.castShadow = inst.receiveShadow = true;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
    const c1 = new THREE.Color(th.wall[0]), c2 = new THREE.Color(th.wall[1]); let k = 0;
    for (let i = 0; i < n / 2; i++) {
      const s = i * step, kap = this.at(s).k;
      for (const side of [-1, 1]) {
        const outside = Math.abs(kap) > 0.022 && Math.sign(kap) === -side;
        if (outside && i % 6 === 0) this.chevrons.push({ s, side });
        if (outside) { m4.makeScale(0, 0, 0); inst.setMatrixAt(k, m4); inst.setColorAt(k++, c1); continue; }
        const p = this.place(s, side * (W / 2 + 0.45), 0.5); q.setFromAxisAngle(up, p.yaw);
        m4.compose(tmp.set(p.x, p.y, p.z), q, one); inst.setMatrixAt(k, m4); inst.setColorAt(k++, Math.floor(i / 3) % 2 ? c2 : c1);
      }
    }
    this.group.add(inst);
  }
  // ---------------------------------------------------------------------------- objects from the library
  async populate(mode) {
    const d = this.def, th = this.theme, F = this.feat, jobs = [], G = this.group, W = this.W;
    const put = async (id, x, y, z, yaw, s = 1, unique = false) => { const o = await load(id, unique); o.position.set(x, y, z); o.rotation.y = yaw; o.scale.setScalar(s); G.add(o); return o; };
    const P = (id, s, lat, lift = 0, yawOff = 0, sc = 1, unique = false) => { const p = this.place(s, lat, lift); return put(id, p.x, p.y, p.z, p.yaw + yawOff, sc, unique); };
    let seed = (d.seed || d.id.length * 977) * 13 + 17; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (const c of this.chevrons) jobs.push(P('T11_Chevron_Barrier', c.s + 3, c.side * (W / 2 + 0.45), 0, -Math.PI / 2, 1));
    jobs.push(P('T05_StartFinish_Gate', 0, 0, 0, 0, W / 9.6));
    jobs.push(P('T12_Start_Lights', 6, 0, 0, 0, W / 10.4 * 0.95, true).then(o => { o.traverse(m => { const r = /T12_Anim_Lamp_(\d)_(\d)/.exec(m.name); if (r && m.isMesh) this.dynamic.lamps.push({ m, col: +r[1], row: +r[2] }); }); }));
    for (const f of [0.3, 0.66]) jobs.push(P('T15_Banner_Arch', f * this.L, 0, 0, 0, W / 10.8));
    jobs.push(P('T06_Checkpoint_Ring', this.L * 0.5, 0, 0, 0, W / 9.6));
    if (d.theme === 'vessel' && !F.tunnels.length) jobs.push(P('E36_Heart_Valve_Gate', this.L * 0.15, 0, 0, Math.PI / 2, W / 13));
    if (d.theme === 'vessel') jobs.push(P('E36_Heart_Valve_Gate', this.L * 0.85, 0, 0, Math.PI / 2, W / 13));
    if (d.theme === 'neuron') jobs.push(P('E33_Axon_Arch', this.L * 0.42, 0, 0, Math.PI / 2, W / 17));
    for (const [a, b] of F.tunnels) for (let s = a * this.L; s < b * this.L; s += 10 * W / 9.2) jobs.push(P('T07_BloodVessel_Tunnel', s, 0, -0.03, Math.PI, W / 9.2));
    for (const [f, lat] of F.pads) { const p = this.place(f * this.L, lat); jobs.push(put('T04_Boost_Pad', p.x, p.y + 0.02, p.z, p.yaw + Math.PI, 1.5)); this.dynamic.pads.push({ s: f * this.L, lat, r: 2.4, len: 4.5 }); }
    for (const [f, lat] of F.bounce) { const p = this.place(f * this.L, lat); jobs.push(put('G04_Bounce_Membrane', p.x, p.y, p.z, 0, 1.2)); this.dynamic.bounce.push({ x: p.x, z: p.z, r: 1.9 }); }
    for (const [f, lat] of F.slime) { const p = this.place(f * this.L, lat); jobs.push(put('G07_Slime_Puddle', p.x, p.y + 0.02, p.z, 0, 1.6)); this.dynamic.slime.push({ x: p.x, z: p.z, r: 2.6 }); }
    if (mode === 'item') for (const f of [0.14, 0.4, 0.64, 0.87]) for (const lat of [-4.8, -1.6, 1.6, 4.8]) {
      const p = this.place(f * this.L, lat); jobs.push(put('G01_ItemBox_DNA', p.x, p.y + 0.4, p.z, 0, 1.25).then(o => this.dynamic.items.push({ obj: o, x: p.x, y: p.y, z: p.z, t: 0, ph: Math.random() * 6 })));
    }
    if (mode !== 'item') for (let i = 0; i < 28; i++) { const s = (i / 28 + 0.03) * this.L, p = this.place(s, Math.sin(i * 1.7) * 4); jobs.push(put('G02_ATP_Coin', p.x, p.y + 0.2, p.z, 0, 1.2).then(o => this.dynamic.items.push({ obj: o, x: p.x, y: p.y, z: p.z, t: 0, coin: true, ph: i }))); }
    for (const f of [0.22, 0.7]) for (let r = 0; r < 3; r++) for (let c = 0; c < 3 - r; c++) {
      const side = f < 0.5 ? 1 : -1, p = this.place(f * this.L, side * (W / 2 - 2.5) + (c - (2 - r) / 2) * 1.05 * side);
      jobs.push(put('G12_Physics_Block', p.x, p.y + r, p.z, p.yaw, 1).then(o => this.dynamic.blocks.push({ obj: o, p: o.position.clone(), v: new THREE.Vector3(), w: new THREE.Vector3(), sleep: true })));
    }
    for (let i = 0; i < 6; i++) { const s = (i + 0.5) / 6 * this.L; jobs.push(P('G06_Enzyme_Gear', s, (i % 2 ? 1 : -1) * (W / 2 + 6), 0, Math.PI / 2, 1.3).then(o => { const r = o.getObjectByName('G06_Rotor'); if (r) this.dynamic.spinners.push({ o: r, axis: 'y', sp: 1.5 }); })); }
    for (let i = 0; i < 24; i++) jobs.push(P(i % 3 ? 'G09_Pipette_Cone' : 'G08_Cell_Bumper', (i + 0.2) / 24 * this.L, (i % 2 ? 1 : -1) * (W / 2 + 2.4), 0, 0, 1.1));
    jobs.push(P('E23_Spectator_Stand', -20, -(W / 2 + 9), 0, Math.PI, 1.5), P('E23_Spectator_Stand', 20, W / 2 + 9, 0, 0, 1.5));
    // themed scenery near the track
    let placed = 0, tries = 0;
    while (placed < 100 && tries++ < 1100) {
      const id = th.props[placed % th.props.length], sc = 1.2 + rnd() * 1.8, rad = radiusOf(id) * sc;
      const s = rnd() * this.L, lat = (rnd() < 0.5 ? -1 : 1) * (W / 2 + 3 + rad + rnd() * 40);
      const p = this.place(s, lat); const nn = this.nearest(p.x, p.z);
      if (Math.abs(nn.lat) < W / 2 + 2 + rad) continue;
      jobs.push(put(id, p.x, 0, p.z, rnd() * 6.3, sc)); placed++;
    }
    // big landmarks: one in the infield, the rest outside the circuit
    const b = this.bounds();
    const lms = th.landmarks.map((id, i) => {
      if (i === 0) return [id, b.cx, b.cz, 2.4];
      const a = rnd() * 6.28, r = b.R + 50 + rnd() * 110; return [id, b.cx + Math.cos(a) * r, b.cz + Math.sin(a) * r, 2.5 + rnd() * 1.6];
    });
    for (const [id, x, z, sc] of lms) { const nn = this.nearest(x, z); if (Math.abs(nn.lat) > W / 2 + 4 + radiusOf(id) * sc) jobs.push(put(id, x, 0, z, rnd() * 6, sc)); }
    // sky objects (floating high above / far away)
    for (const [id, cnt, h0, h1, s0, s1, kind] of th.skyObjs) for (let i = 0; i < cnt; i++) {
      let x, z, y = h0 + rnd() * (h1 - h0), sc = s0 + rnd() * (s1 - s0);
      if (kind === 'sun' || kind === 'planet') { const a = kind === 'sun' ? 0.6 : 2.6; x = b.cx + Math.cos(a) * 520; z = b.cz + Math.sin(a) * 520; y = h0 + 60; }
      else { const a = rnd() * 6.28, r = kind === 'bob' || kind === 'rise' ? rnd() * (b.R + 120) : 60 + rnd() * (b.R + 260); x = b.cx + Math.cos(a) * r; z = b.cz + Math.sin(a) * r; }
      jobs.push(put(id, x, y, z, rnd() * 6.3, sc).then(o => { o.traverse(m => { if (m.isMesh) m.castShadow = false; });
        this.dynamic.sky.push({ o, kind: kind || 'float', y0: y, x0: x, z0: z, ph: rnd() * 6.28, cx: b.cx, cz: b.cz, r: Math.hypot(x - b.cx, z - b.cz), a: Math.atan2(z - b.cz, x - b.cx) }); }));
    }
    await Promise.all(jobs);
  }
  animateSky(t, dt) {
    for (const s of this.dynamic.sky) {
      const o = s.o;
      if (s.kind === 'drift') { s.a += dt * 0.015; o.position.set(s.cx + Math.cos(s.a) * s.r, s.y0 + Math.sin(t * 0.4 + s.ph) * 2, s.cz + Math.sin(s.a) * s.r); o.rotation.y = -s.a; }
      else if (s.kind === 'bob') { o.position.y = s.y0 + Math.sin(t * 0.6 + s.ph) * 4; o.rotation.y += dt * 0.1; o.scale.y = o.scale.x * (1 + Math.sin(t * 1.6 + s.ph) * 0.06); }
      else if (s.kind === 'rise') { o.position.y += dt * 2.5; if (o.position.y > s.y0 + 60) o.position.y = s.y0 - 20; }
      else if (s.kind === 'planet' || s.kind === 'sun') o.rotation.y += dt * 0.05;
      else { o.position.y = s.y0 + Math.sin(t * 0.3 + s.ph) * 1.5; o.rotation.y += dt * 0.03; }
    }
  }
  minimapPath() { return this.samples.filter((_, i) => i % 3 === 0).map(p => [p.x, p.z]); }
}
