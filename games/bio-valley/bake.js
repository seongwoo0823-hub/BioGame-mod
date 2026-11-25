// 바이오 밸리: 종이 조각(카드)을 한 장의 아틀라스로 굽고, 같은 조각을 인스턴스로 많이 세운다.
// 한 프리팹 = 세그먼트 여러 개(각자 접힘선이 있음) + 공용 재질 2개(인쇄면·종이 옆면).
// 세운 조각은 접힘선을 따라 일어서고(겹침 반동) 쓰러진다. 그림자·조명은 paperMaterial 그대로.
import * as THREE from 'three';
import { paperMaterial } from './lib/paperkit-3d.js';

const tmpM = new THREE.Matrix4(), tmpM2 = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpV = new THREE.Vector3(), tmpS = new THREE.Vector3();
const Y = new THREE.Vector3(0, 1, 0);

export class Baker {
  constructor(renderer, paper, { maxAtlas = 4096 } = {}) {
    this.renderer = renderer; this.paper = paper; this.maxAtlas = maxAtlas;
    this.prefabs = new Map();
    this.root = new THREE.Group(); this.root.name = 'stamps';
    this.handles = new Set();     // 움직이는(일어서는/쓰러지는/돌아보는) 인스턴스
    this.facing = new Set();      // 카메라를 보는 카드
    this.camYaw = 0;
    this.time = 0;
    // 면 재질의 종이결(노멀맵)은 원래 카드 좌표(uv1)로 반복
    this.nrm1 = paper.normalMap.clone(); this.nrm1.channel = 1; this.nrm1.needsUpdate = true;
  }

  /** key: 이름, build(): { segs: [{ obj, hinge: { at:[x,y,z], axis:'x'|'z', flat }, delay }], face, radius } */
  define(key, build) { if (!this.prefabs.has(key)) this.prefabs.set(key, { key, build, baked: null }); return key; }
  has(key) { return this.prefabs.has(key); }
  isBaked(key) { const p = this.prefabs.get(key); return !!(p && p.baked); }

  bake(key) {
    const pf = this.prefabs.get(key);
    if (!pf) throw new Error('prefab ' + key);
    if (pf.baked) return pf.baked;
    const tb = performance.now();
    const spec = pf.build();
    const segs = spec.segs || [{ obj: spec.obj }];
    // 1) 인쇄 캔버스 모으기
    const prints = new Map();   // canvas -> { canvas, glow, w, h }
    const meshesPerSeg = segs.map((s) => {
      s.obj.updateMatrixWorld(true);
      const inv = new THREE.Matrix4().copy(s.obj.matrixWorld).invert(), list = [];
      s.obj.traverse((o) => {
        if (!o.isMesh) return;
        const rel = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) if (m.map && m.map.image && m.map.image !== this.paper.map.image && !prints.has(m.map.image)) {
          prints.set(m.map.image, { canvas: m.map.image, glow: m.emissiveMap ? m.emissiveMap.image : null, w: m.map.image.width, h: m.map.image.height });
        }
        list.push({ mesh: o, rel, mats });
      });
      return list;
    });
    // 2) 선반 방식으로 아틀라스에 배치
    const items = [...prints.values()].sort((a, b) => b.h - a.h), pad = 4;
    let area = 0; for (const it of items) area += (it.w + pad * 2) * (it.h + pad * 2);
    let AW = 256; while (AW * AW < area * 1.25 && AW < this.maxAtlas) AW *= 2;
    let scale = 1, placed = false;
    for (let tries = 0; tries < 8 && !placed; tries++) {
      let x = 0, y = 0, rowH = 0; placed = true;
      for (const it of items) {
        const w = Math.ceil(it.w * scale) + pad * 2, h = Math.ceil(it.h * scale) + pad * 2;
        if (x + w > AW) { x = 0; y += rowH; rowH = 0; }
        it.ax = x + pad; it.ay = y + pad; it.aw = w - pad * 2; it.ah = h - pad * 2;
        x += w; rowH = Math.max(rowH, h);
        if (y + rowH > AW) { placed = false; break; }
      }
      if (!placed) { if (AW < this.maxAtlas) AW *= 2; else scale *= 0.85; }
    }
    let AH = 0; for (const it of items) AH = Math.max(AH, it.ay + it.ah + pad);
    AH = Math.max(16, Math.pow(2, Math.ceil(Math.log2(Math.max(16, AH)))));
    const atlas = document.createElement('canvas'); atlas.width = AW; atlas.height = AH;
    const ag = atlas.getContext('2d');
    let glowAtlas = null, gg = null;
    if (items.some((it) => it.glow)) { glowAtlas = document.createElement('canvas'); glowAtlas.width = AW; glowAtlas.height = AH; gg = glowAtlas.getContext('2d'); gg.fillStyle = '#000'; gg.fillRect(0, 0, AW, AH); }
    for (const it of items) {
      // 가장자리 번짐 방지: 테두리를 한 번 넓게 그린 뒤 원본
      ag.drawImage(it.canvas, it.ax - 2, it.ay - 2, it.aw + 4, it.ah + 4);
      ag.clearRect(it.ax, it.ay, it.aw, it.ah);
      ag.drawImage(it.canvas, it.ax, it.ay, it.aw, it.ah);
      if (it.glow && gg) gg.drawImage(it.glow, it.ax, it.ay, it.aw, it.ah);
    }
    const tex = new THREE.CanvasTexture(atlas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    const faceMat = paperMaterial({ map: tex, normalMap: this.nrm1, normalScale: 0.7, vertexColors: true });
    if (glowAtlas) { const e = new THREE.CanvasTexture(glowAtlas); e.colorSpace = THREE.SRGBColorSpace; faceMat.emissiveMap = e; faceMat.emissive.set(spec.glowColor || '#ffc45a'); faceMat.emissiveIntensity = 0.35; }
    const sideMat = paperMaterial({ map: this.paper.map, normalMap: this.paper.normalMap, normalScale: 0.25, vertexColors: true });
    if (spec.double) { faceMat.side = THREE.DoubleSide; sideMat.side = THREE.DoubleSide; }
    if (spec.alphaTest) faceMat.alphaTest = spec.alphaTest;
    // 3) 세그먼트마다 지오메트리 하나(그룹 0 = 인쇄면, 1 = 옆면)
    const nm = new THREE.Matrix3(), col = new THREE.Color();
    const geos = meshesPerSeg.map((list) => {
      const F = { p: [], n: [], uv: [], uv1: [], c: [] }, S = { p: [], n: [], uv: [], uv1: [], c: [] };
      for (const { mesh, rel, mats } of list) {
        const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
        const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
        nm.getNormalMatrix(rel);
        const groups = g.groups.length ? g.groups : [{ start: 0, count: pos.count, materialIndex: 0 }];
        for (const gr of groups) {
          const m = mats[gr.materialIndex] || mats[0];
          const print = m.map && prints.get(m.map.image);
          const T = print ? F : S;
          if (!print && spec.noSides) continue;
          col.copy(m.color);
          const rep = m.map ? m.map.repeat : null, off = m.map ? m.map.offset : null;
          for (let i = gr.start; i < gr.start + gr.count; i++) {
            tmpV.fromBufferAttribute(pos, i).applyMatrix4(rel); T.p.push(tmpV.x, tmpV.y, tmpV.z);
            tmpV.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize(); T.n.push(tmpV.x, tmpV.y, tmpV.z);
            const u = uv ? uv.getX(i) : 0, v = uv ? uv.getY(i) : 0;
            T.uv1.push(u, v);
            if (print) {
              let tu = u * rep.x + off.x, tv = v * rep.y + off.y;
              tu = Math.min(1, Math.max(0, tu)); tv = Math.min(1, Math.max(0, tv));
              T.uv.push((print.ax + tu * print.aw) / AW, 1 - (print.ay + (1 - tv) * print.ah) / AH);
            } else T.uv.push(u, v);
            T.c.push(col.r, col.g, col.b);
          }
        }
      }
      const geo = new THREE.BufferGeometry();
      const cat = (k) => new Float32Array(F[k].concat(S[k]));
      geo.setAttribute('position', new THREE.BufferAttribute(cat('p'), 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(cat('n'), 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(cat('uv'), 2));
      geo.setAttribute('uv1', new THREE.BufferAttribute(cat('uv1'), 2));
      geo.setAttribute('color', new THREE.BufferAttribute(cat('c'), 3));
      geo.addGroup(0, F.p.length / 3, 0); geo.addGroup(F.p.length / 3, S.p.length / 3, 1);
      geo.computeBoundingSphere();
      return geo;
    });
    // 원본 카드 정리(인쇄 캔버스는 아틀라스로 옮겼으니 GPU 쪽만 버림)
    for (const list of meshesPerSeg) for (const { mesh, mats } of list) { mesh.geometry.dispose(); for (const m of mats) { if (m.map && m.map !== this.paper.map) m.map.dispose(); if (m.emissiveMap) m.emissiveMap.dispose(); m.dispose(); } }
    const segsOut = segs.map((s, i) => {
      const h = s.hinge || { at: [0, 0, 0], axis: 'x', flat: -Math.PI / 2 + 0.02 };
      const im = new THREE.InstancedMesh(geos[i], [faceMat, sideMat], 8);
      im.count = 0; im.castShadow = spec.shadow !== false; im.receiveShadow = true; im.frustumCulled = false;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.root.add(im);
      return { im, at: new THREE.Vector3(...(h.at || [0, 0, 0])), axis: h.axis === 'z' ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0), flat: h.flat ?? (-Math.PI / 2 + 0.02), delay: s.delay || 0, slots: [] };
    });
    (this.stats || (this.stats = {}))[key] = Math.round(performance.now() - tb);
    pf.baked = { segs: segsOut, faceMat, sideMat, face: !!spec.face, radius: spec.radius || 3, atlas, glow: !!glowAtlas, key };
    return pf.baked;
  }

  /** 인스턴스 하나 세우기. opts: x, z, yaw, s(크기), y, rise(true: 접힌 채 시작해 일어섬), delay */
  add(key, { x = 0, z = 0, y = 0, yaw = 0, s = 1, rise = false, delay = 0, tint = null, data = null } = {}) {
    const b = this.bake(key);
    const h = { b, x, y, z, yaw, s, p: rise ? 0 : 1, v: 0, state: rise ? 'rise' : 'idle', t: -delay, slots: [], data, tint, faceYaw: b.face ? this.camYaw : 0, alive: true };
    for (const seg of b.segs) {
      const im = this.ensureCap(seg, seg.im.count + 1);
      const slot = im.count++;
      seg.slots[slot] = h; h.slots.push(slot);
      if (tint || im.instanceColor) im.setColorAt(slot, tint ? new THREE.Color(tint) : new THREE.Color(1, 1, 1));
    }
    this.write(h);
    if (rise) this.handles.add(h);
    if (b.face) this.facing.add(h);
    return h;
  }
  ensureCap(seg, n) {
    let im = seg.im;
    if (n <= im.instanceMatrix.count) return im;
    let cap = im.instanceMatrix.count; while (cap < n) cap *= 2;
    const nim = new THREE.InstancedMesh(im.geometry, im.material, cap);
    nim.count = im.count; nim.castShadow = im.castShadow; nim.receiveShadow = true; nim.frustumCulled = false;
    nim.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    nim.instanceMatrix.array.set(im.instanceMatrix.array.subarray(0, im.count * 16));
    if (im.instanceColor) { nim.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3); nim.instanceColor.array.set(im.instanceColor.array.subarray(0, im.count * 3)); }
    this.root.remove(im); this.root.add(nim); im.dispose();
    seg.im = nim;
    return nim;
  }
  setTint(h, color) {
    h.tint = color;
    h.b.segs.forEach((seg, i) => { seg.im.setColorAt(h.slots[i], new THREE.Color(color || '#ffffff')); seg.im.instanceColor.needsUpdate = true; });
  }
  /** 접어서 치우기(anim=false: 바로) */
  remove(h, anim = true, onDone = null) {
    if (!h || !h.alive) return;
    if (anim) { h.state = 'fall'; h.v = 0; h.onDone = onDone; this.handles.add(h); return; }
    this.kill(h); if (onDone) onDone();
  }
  kill(h) {
    if (!h.alive) return; h.alive = false;
    h.b.segs.forEach((seg, i) => {
      const im = seg.im, slot = h.slots[i], last = im.count - 1;
      if (slot !== last) {
        const other = seg.slots[last];
        im.instanceMatrix.array.copyWithin(slot * 16, last * 16, last * 16 + 16);
        if (im.instanceColor) im.instanceColor.array.copyWithin(slot * 3, last * 3, last * 3 + 3);
        seg.slots[slot] = other; other.slots[i] = slot;
      }
      seg.slots.length = last; im.count = last;
      im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
    });
    this.handles.delete(h); this.facing.delete(h);
  }
  /** 위치 옮기기(사람·차) */
  move(h, x, z, yaw, y = h.y) { h.x = x; h.z = z; h.y = y; if (yaw != null) h.yaw = yaw; this.write(h); }

  write(h) {
    const b = h.b, yaw = b.face ? h.faceYaw + (h.yaw || 0) : h.yaw;
    tmpQ.setFromAxisAngle(Y, yaw);
    tmpM.compose(tmpV.set(h.x, h.y, h.z), tmpQ, tmpS.set(h.flip ? -h.s : h.s, h.s, h.s));
    b.segs.forEach((seg, i) => {
      const slot = h.slots[i];
      const p = h.state === 'idle' ? 1 : this.segP(h, seg);
      const ang = seg.flat * (1 - p) + (h.segAng ? h.segAng[i] || 0 : (h.rock || 0) * (i === 0 ? 1 : 0));
      if (ang !== 0) {
        // 접힘선(at, axis)을 중심으로 회전
        tmpM2.makeTranslation(seg.at.x, seg.at.y, seg.at.z);
        tmpM2.multiply(new THREE.Matrix4().makeRotationAxis(seg.axis, ang));
        tmpM2.multiply(new THREE.Matrix4().makeTranslation(-seg.at.x, -seg.at.y, -seg.at.z));
        tmpM2.premultiply(tmpM);
        seg.im.setMatrixAt(slot, tmpM2);
      } else seg.im.setMatrixAt(slot, tmpM);
      seg.im.instanceMatrix.needsUpdate = true;
    });
  }
  // 세그먼트별 진행도: 앞 세그먼트가 먼저(접힐 땐 반대 순서)
  segP(h, seg) {
    const d = seg.delay;
    if (h.state === 'rise') return riseCurve(h.t - d);
    if (h.state === 'fall') return 1 - fallCurve(h.t - (h.b.segs.length > 1 ? (h.b.segs[h.b.segs.length - 1].delay - d) : 0));
    return 1;
  }

  setCamYaw(y) {
    this.camYaw = y;
    for (const h of this.facing) { h.faceYaw0 = h.faceYaw; h.turnT = 0; this.handles.add(h); h.turning = true; }
  }

  update(dt) {
    this.time += dt;
    for (const h of this.handles) {
      if (!h.alive) { this.handles.delete(h); continue; }
      let busy = false;
      if (h.turning) {
        h.turnT += dt / 0.45;
        const e = h.turnT >= 1 ? 1 : riseCurve(h.turnT * 0.9);
        let d = this.camYaw - h.faceYaw0; d = Math.atan2(Math.sin(d), Math.cos(d));
        h.faceYaw = h.faceYaw0 + d * Math.min(e, 1.1);
        if (h.turnT >= 1) { h.faceYaw = this.camYaw; h.turning = false; } else busy = true;
      }
      if (h.state === 'rise' || h.state === 'fall') {
        h.t += dt;
        const last = h.b.segs.reduce((m, s) => Math.max(m, s.delay), 0);
        if (h.state === 'rise' && h.t > last + 1.1) { h.state = 'idle'; if (h.onRise) h.onRise(); }
        else if (h.state === 'fall' && h.t > last + 0.6) { const cb = h.onDone; this.kill(h); if (cb) cb(); continue; }
        else busy = true;
      }
      if (h.anim) busy = h.anim(h, dt) || busy;
      this.write(h);
      if (!busy) this.handles.delete(h);
    }
  }
  dispose() {
    for (const p of this.prefabs.values()) {
      const b = p.baked; if (!b) continue;
      for (const s of b.segs) { s.im.geometry.dispose(); s.im.dispose(); }
      if (b.faceMat.map) b.faceMat.map.dispose(); if (b.faceMat.emissiveMap) b.faceMat.emissiveMap.dispose();
      b.faceMat.dispose(); b.sideMat.dispose();
    }
    this.prefabs.clear(); this.handles.clear(); this.facing.clear();
  }
  setGlow(v) { for (const p of this.prefabs.values()) if (p.baked && p.baked.glow) p.baked.faceMat.emissiveIntensity = v; }
}

// 종이 접힘 반동: 빠르게 일어나 12% 넘었다가 두세 번 떨고 1초 안에 멈춤
export function riseCurve(t) {
  if (t <= 0) return 0;
  const w = 14, z = 0.5, wd = w * Math.sqrt(1 - z * z);
  const e = 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + (z / Math.sqrt(1 - z * z)) * Math.sin(wd * t));
  return t > 1.2 ? 1 : e;
}
// 쓰러짐: 부드럽게 가속, 바닥에서 한 번 작게 튐
export function fallCurve(t) {
  if (t <= 0) return 0;
  const T = 0.38;
  if (t < T) { const k = t / T; return k * k; }
  const k = (t - T) / 0.16;
  return k < 1 ? 1 - 0.04 * Math.sin(k * Math.PI) : 1;
}
