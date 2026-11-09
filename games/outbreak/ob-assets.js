/* 감염 도시 · 에셋 로더
 *  m/index.json + m/<키트>.bin (tools/outbreak/convert.py가 만든 압축 모델)
 *  OBA.loadKit(k)          키트 하나 받기 (구역에 필요한 키트만)
 *  OBA.mesh(k, m, tint)    모델 하나 → THREE.Group (같은 모델은 형상 공유)
 *  new OBA.Batch()         여러 모델을 재질별로 한 덩어리로 합쳐 그리기 횟수를 줄임
 *  OBA.char(skin)          움직이는 사람/좀비 (스킨 12종)
 */
(function () {
  'use strict';
  const BASE = 'outbreak/';
  const OBA = window.OBA = { idx: null, kits: {}, geos: {}, mats: {}, tex: {}, ready: null };
  OBA.init = function () {
    if (!OBA.ready) OBA.ready = fetch(BASE + 'm/index.json').then(r => r.json()).then(j => { OBA.idx = j; });
    return OBA.ready;
  };
  OBA.has = (k, m) => !!(OBA.idx && OBA.idx[k] && OBA.idx[k].models[m]);
  OBA.info = (k, m) => OBA.idx[k].models[m];
  OBA.bb = (k, m) => OBA.idx[k].models[m].bb;
  OBA.list = (k, pre) => Object.keys(OBA.idx[k].models).filter(n => !pre || n.startsWith(pre));
  OBA.loadKit = function (k) {
    if (OBA.kits[k]) return OBA.kits[k].p;
    const K = OBA.kits[k] = { ok: false };
    K.p = fetch(BASE + 'm/' + k + '.bin').then(r => { if (!r.ok) throw new Error(k); return r.arrayBuffer(); }).then(buf => {
      const I = OBA.idx[k], s = I.sec;
      K.P = new Int16Array(buf, s[0], I.v * 3); K.N = new Int8Array(buf, s[1], I.v * 4); K.U = new Int16Array(buf, s[2], I.v * 2); K.I = new Uint16Array(buf, s[3], I.i);
      K.ok = true;
    });
    return K.p;
  };
  OBA.loadKits = ks => Promise.all(ks.map(OBA.loadKit));
  function texture(name, nearest) {
    if (OBA.tex[name]) return OBA.tex[name];
    const t = new THREE.TextureLoader().load(BASE + 'm/tex/' + name, () => { t.ready = true; });
    t.encoding = THREE.sRGBEncoding;
    if (nearest) { t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; }
    else { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; }
    return OBA.tex[name] = t;
  }
  OBA.texture = texture;
  // 키트 텍스처를 미리 받아 둠 (아이콘을 그리기 전에)
  OBA.preloadTex = function (ks) {
    return Promise.all(ks.flatMap(k => OBA.idx[k].tex.map(tn => new Promise(res => { const t = texture(tn, k !== 'urban'); if (t.ready || (t.image && t.image.complete)) return res(); const iv = setInterval(() => { if (t.ready || (t.image && t.image.complete && t.image.naturalWidth)) { clearInterval(iv); res(); } }, 50); setTimeout(() => { clearInterval(iv); res(); }, 8000); }))));
  };
  // 재질: 텍스처(키트 색지도) + 꼭짓점 색(기본색·물들이기). variant: '' 기본, 'cut' 벽 잘라 보기, 'ghost' 반투명
  OBA.CUT = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1.0);
  OBA.material = function (key, variant) {
    const id = key + '|' + (variant || '');
    if (OBA.mats[id]) return OBA.mats[id];
    let map = null;
    if (key !== '-') { const [k, ti] = key.split(':'); const tn = OBA.idx[k].tex[+ti]; map = texture(tn, k !== 'urban'); }
    const m = new THREE.MeshLambertMaterial({ map, vertexColors: true });
    if (variant === 'cut') { m.clippingPlanes = [OBA.CUT]; m.side = THREE.DoubleSide; }
    if (variant === 'ghost') { m.transparent = true; m.opacity = 0.16; m.depthWrite = false; }
    if (variant === 'glow') { m.emissive = new THREE.Color('#ffffff'); m.emissiveIntensity = 0.35; }
    return OBA.mats[id] = m;
  };
  // 모델 한 그룹을 실수 배열로 풀기 (캐시)
  OBA.used = {};
  function decode(k, m) {
    const id = k + '/' + m; OBA.used[id] = 1; if (OBA.geos[id]) return OBA.geos[id];
    const K = OBA.kits[k]; if (!K || !K.ok) throw new Error('kit not loaded: ' + k);
    const M = OBA.idx[k].models[m]; if (!M) throw new Error('no model ' + id);
    const out = [];
    for (const [ti, col, vo, vc, io, ic] of M.g) {
      const pos = new Float32Array(vc * 3), nrm = new Float32Array(vc * 3), uv = new Float32Array(vc * 2);
      for (let i = 0; i < vc; i++) {
        const a = (vo + i) * 3, b = (vo + i) * 4, c = (vo + i) * 2;
        pos[i * 3] = K.P[a] * M.q; pos[i * 3 + 1] = K.P[a + 1] * M.q; pos[i * 3 + 2] = K.P[a + 2] * M.q;
        nrm[i * 3] = K.N[b] / 127; nrm[i * 3 + 1] = K.N[b + 1] / 127; nrm[i * 3 + 2] = K.N[b + 2] / 127;
        uv[i * 2] = K.U[c] / 2048; uv[i * 2 + 1] = K.U[c + 1] / 2048;
      }
      const idx = K.I.slice(io, io + ic);
      const c3 = new THREE.Color(col);
      out.push({ key: ti < 0 ? '-' : k + ':' + ti, col: c3, pos, nrm, uv, idx, vc });
    }
    return OBA.geos[id] = out;
  }
  OBA.decode = decode;
  const GEO3 = {};
  function bufGeo(k, m, gi, tint) {
    const id = k + '/' + m + '/' + gi + '/' + (tint ? tint.getHexString() : '');
    if (GEO3[id]) return GEO3[id];
    const g = decode(k, m)[gi], G = new THREE.BufferGeometry();
    G.setAttribute('position', new THREE.BufferAttribute(g.pos, 3));
    G.setAttribute('normal', new THREE.BufferAttribute(g.nrm, 3));
    G.setAttribute('uv', new THREE.BufferAttribute(g.uv, 2));
    const col = new Float32Array(g.vc * 3), c = g.col.clone(); if (tint) c.multiply(tint);
    for (let i = 0; i < g.vc; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    G.setAttribute('color', new THREE.BufferAttribute(col, 3));
    G.setIndex(new THREE.BufferAttribute(g.idx, 1)); G.computeBoundingSphere();
    return GEO3[id] = G;
  }
  OBA.mesh = function (k, m, opt) {
    opt = opt || {};
    const grp = new THREE.Group(), gs = decode(k, m), tint = opt.tint ? new THREE.Color(opt.tint) : null;
    gs.forEach((g, i) => {
      const me = new THREE.Mesh(bufGeo(k, m, i, tint), opt.mat || OBA.material(g.key, opt.variant));
      me.castShadow = opt.shadow !== false; me.receiveShadow = !!opt.receive; grp.add(me);
    });
    grp.userData.model = k + '/' + m;
    return grp;
  };
  // ---------- 합치기 ----------
  const _v = new THREE.Vector3(), _n = new THREE.Vector3(), _m3 = new THREE.Matrix3();
  class Batch {
    constructor() { this.parts = {}; }
    add(k, m, mat4, tint) {
      const gs = decode(k, m); const tc = tint ? (tint.isColor ? tint : new THREE.Color(tint)) : null;
      for (const g of gs) { (this.parts[g.key] = this.parts[g.key] || []).push([g, mat4.clone(), tc]); }
    }
    get empty() { return !Object.keys(this.parts).length; }
    build(opt) {
      opt = opt || {}; const grp = new THREE.Group();
      for (const key in this.parts) {
        const L = this.parts[key]; let nv = 0, ni = 0;
        for (const [g] of L) { nv += g.vc; ni += g.idx.length; }
        const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), U = new Float32Array(nv * 2), C = new Uint8Array(nv * 3), I = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
        let vo = 0, io = 0;
        for (const [g, M, tc] of L) {
          _m3.getNormalMatrix(M); const c = g.col.clone(); if (tc) c.multiply(tc);
          const cr = Math.min(255, c.r * 255) | 0, cg = Math.min(255, c.g * 255) | 0, cb = Math.min(255, c.b * 255) | 0;
          const flip = M.determinant() < 0;
          for (let i = 0; i < g.vc; i++) {
            _v.set(g.pos[i * 3], g.pos[i * 3 + 1], g.pos[i * 3 + 2]).applyMatrix4(M);
            _n.set(g.nrm[i * 3], g.nrm[i * 3 + 1], g.nrm[i * 3 + 2]).applyMatrix3(_m3).normalize();
            const o = (vo + i) * 3; P[o] = _v.x; P[o + 1] = _v.y; P[o + 2] = _v.z; N[o] = _n.x; N[o + 1] = _n.y; N[o + 2] = _n.z;
            U[(vo + i) * 2] = g.uv[i * 2]; U[(vo + i) * 2 + 1] = g.uv[i * 2 + 1]; C[o] = cr; C[o + 1] = cg; C[o + 2] = cb;
          }
          const ix = g.idx;
          if (flip) for (let i = 0; i < ix.length; i += 3) { I[io + i] = ix[i] + vo; I[io + i + 1] = ix[i + 2] + vo; I[io + i + 2] = ix[i + 1] + vo; }
          else for (let i = 0; i < ix.length; i++) I[io + i] = ix[i] + vo;
          vo += g.vc; io += ix.length;
        }
        const G = new THREE.BufferGeometry();
        G.setAttribute('position', new THREE.BufferAttribute(P, 3)); G.setAttribute('normal', new THREE.BufferAttribute(N, 3));
        G.setAttribute('uv', new THREE.BufferAttribute(U, 2)); G.setAttribute('color', new THREE.BufferAttribute(C, 3, true));
        G.setIndex(new THREE.BufferAttribute(I, 1)); G.computeBoundingSphere(); G.computeBoundingBox();
        const me = new THREE.Mesh(G, OBA.material(key, opt.variant)); me.castShadow = opt.shadow !== false; me.receiveShadow = opt.receive !== false;
        me.userData.key = key; grp.add(me);
      }
      this.parts = {};
      return grp;
    }
  }
  OBA.Batch = Batch;
  // ---------- 캐릭터 ----------
  const SKINS = OBA.SKINS = {
    human: ['survivorMaleB', 'survivorFemaleA', 'humanMaleA', 'humanFemaleA', 'skaterMaleA', 'skaterFemaleA', 'criminalMaleA', 'cyborgFemaleA'],
    zombie: ['zombieA', 'zombieC', 'zombieMaleA', 'zombieFemaleA']
  };
  let CH = null;
  OBA.loadChar = function () {
    if (CH) return CH.p;
    CH = {};
    CH.p = fetch(BASE + 'char.json').then(r => r.json()).then(j => {
      const L = new THREE.ObjectLoader();
      CH.json = j; CH.L = L; CH.anims = L.parseAnimations(j.animations); CH.geos = L.parseGeometries(j.geometries, {});
      CH.clips = {}; for (const c of Object.values(CH.anims)) CH.clips[c.name] = c;
    });
    return CH.p;
  };
  const SKMAT = {};
  OBA.skinMat = function (skin) {
    if (SKMAT[skin]) return SKMAT[skin];
    const t = new THREE.TextureLoader().load(BASE + 'skins/' + skin + '.png'); t.encoding = THREE.sRGBEncoding; t.flipY = true;
    return SKMAT[skin] = new THREE.MeshLambertMaterial({ map: t, skinning: true });
  };
  OBA.CH_SCALE = 1.75 / 376.5;
  OBA.char = function (skin, opt) {
    const L = CH.L, j = CH.json;
    const mats = {}; for (const m of j.materials) mats[m.uuid] = OBA.skinMat(skin);
    const obj = L.parseObject(j.object, CH.geos, mats, {}, CH.anims);
    const sk = L.parseSkeletons(j.skeletons, obj); L.bindSkeletons(obj, sk);
    let mesh = null; obj.traverse(o => { if (o.isSkinnedMesh) { mesh = o; o.castShadow = true; o.frustumCulled = false; } });
    const root = new THREE.Group(); obj.scale.setScalar(OBA.CH_SCALE); root.add(obj);
    const bones = {}; mesh.skeleton.bones.forEach(b => { bones[b.name] = b; });
    // 덧붙여 돌리는 뼈들의 기본 자세 (동작에 그 뼈가 없으면 매 프레임 쌓이지 않도록 되돌림)
    const rest = {}; for (const n of ['Spine', 'Chest', 'Head', 'Neck', 'LeftArm', 'RightArm', 'LeftForeArm', 'RightForeArm']) if (bones[n]) rest[n] = bones[n].quaternion.clone();
    const mixer = new THREE.AnimationMixer(obj);
    const act = {}; for (const n in CH.clips) { act[n] = mixer.clipAction(CH.clips[n]); }
    const C = { root, obj, mesh, bones, mixer, act, skin, rest };
    C.update = dt => { for (const n in rest) bones[n].quaternion.copy(rest[n]); mixer.update(dt); };
    return C;
  };
})();
