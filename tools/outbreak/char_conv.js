// FBX 캐릭터 → three.js JSON (실행: npm i three@0.128.0 후 node char_conv.js 출력경로)
global.THREE = require('three'); const fs = require('fs'), vm = require('vm');
global.self = global; global.window = global;
global.document = { createElementNS: () => ({ addEventListener(){}, removeEventListener(){}, style: {} }), createElement: () => ({ getContext: () => null, style: {} }) };
for (const f of ['libs/fflate.min.js', 'curves/NURBSUtils.js', 'curves/NURBSCurve.js', 'loaders/FBXLoader.js']) vm.runInThisContext(fs.readFileSync('node_modules/three/examples/js/' + f, 'utf8'));
const S = '/tmp/claude-0/-home-user-test-mod/97c24a57-7ac8-5d65-afbb-e7e2c529deb0/scratchpad/kenney/';
const L = new THREE.FBXLoader(); L.manager.setURLModifier(() => 'data:,');
const buf = b => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
const out = process.argv[2];
const packs = ['kenney_animated-characters-survivors', 'kenney_animated-characters-retro', 'kenney_animated-characters-protagonists'];
const hashes = packs.map(p => { const m = L.parse(buf(fs.readFileSync(S + p + '/Model/characterMedium.fbx')), ''); let g; m.traverse(o => { if (o.isSkinnedMesh) g = o.geometry; }); return g.attributes.position.count + ':' + g.attributes.position.array.slice(0, 6).join(','); });
console.log(hashes);
const m = L.parse(buf(fs.readFileSync(S + packs[0] + '/Model/characterMedium.fbx')), '');
let sk; m.traverse(o => { if (o.isSkinnedMesh) sk = o; });
sk.geometry.deleteAttribute('color');
sk.material = new THREE.MeshLambertMaterial({ name: 'skin' });
const clips = [];
for (const a of ['idle', 'run', 'jump']) {
  const o = L.parse(buf(fs.readFileSync(S + packs[0] + '/Animations/' + a + '.fbx')), '');
  const c = o.animations[0]; c.name = a;
  c.tracks = c.tracks.filter(t => t.name.endsWith('.quaternion') || t.name === 'Hips.position' || t.name === 'HipsCtrl.position');
  for (const t of c.tracks) { t.times = Float32Array.from(t.times, v => Math.round(v * 1000) / 1000); t.values = Float32Array.from(t.values, v => Math.round(v * 10000) / 10000); }
  c.optimize(); clips.push(c);
}
m.animations = clips;
const box = new THREE.Box3().setFromObject(m); console.log('box', box.min, box.max);
const j = m.toJSON();
const s = JSON.stringify(j, (k, v) => typeof v === 'number' ? Math.round(v * 10000) / 10000 : v);
fs.writeFileSync(out, s); console.log('bytes', s.length, 'tracks', clips.map(c => c.tracks.length));
