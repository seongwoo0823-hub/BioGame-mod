// Asset manifest + GLB loading (models built by ../build_library.py)
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const LIB = '../library/';
export const byId = {};
export let manifest = null;
const loader = new GLTFLoader();
const cache = {};

export async function loadManifest() {
  manifest = await (await fetch(LIB + 'manifest.json', { cache: 'no-cache' })).json();
  manifest.assets.forEach(a => (byId[a.id] = a));
  return manifest;
}
export const list = cat => manifest.assets.filter(a => a.category === cat);
export const thumb = id => LIB + byId[id].thumb;
export const icon = id => LIB + 'icons/' + id + '.png';

function fetchScene(id) {
  if (!cache[id]) {
    cache[id] = new Promise((res, rej) => loader.load(LIB + byId[id].glb, g => {
      const cat = byId[id].category, casts = ['Karts', 'Characters', 'Pets', 'Balloons', 'Gameplay'].includes(cat);
      g.scene.traverse(o => {
        if (!o.isMesh) return;
        o.castShadow = casts; o.receiveShadow = true;
        const m = o.material;   // real-time transmission costs an extra scene pass -> cheap alpha glass in game
        if (m && m.transmission > 0) { m.transmission = 0; m.transparent = true; m.opacity = Math.min(m.opacity, 0.42); m.depthWrite = false; }
      });
      res(g.scene);
    }, undefined, rej));
  }
  return cache[id];
}
/** clone of a library asset; uniqueMaterials -> materials can be changed per instance */
export async function load(id, uniqueMaterials = false) {
  const src = await fetchScene(id);
  const c = src.clone(true);
  if (uniqueMaterials) c.traverse(o => { if (o.isMesh) o.material = o.material.clone(); });
  return c;
}
export const preload = ids => Promise.all([...new Set(ids)].map(fetchScene));

/** Blender (x,y,z) -> three (x, z, -y) */
export const b2t = a => new THREE.Vector3(a[0], a[2], -a[1]);
export function radiusOf(id) {
  const a = byId[id]; if (!a) return 2;
  return Math.max(a.bounds_max[0] - a.bounds_min[0], a.bounds_max[1] - a.bounds_min[1]) / 2;
}
