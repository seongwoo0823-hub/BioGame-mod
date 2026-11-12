#!/usr/bin/env node
/* 바이오 카트 '서버 권위' 방식 성능 측정
 * 이 컴퓨터(교실 서버)가 바이오 카트 방을 몇 개까지 직접 계산할 수 있는지 잰다.
 *   node server/bench-kart.js           (약 1~2분)
 *   node server/bench-kart.js --quick   (짧게)
 * 게임 화면(그래픽)은 쓰지 않고 games/bio-kart.html 의 계산 코드만 불러와 돌린다.
 * 방 하나 = 카트 8대(모두 AI: 사람 입력보다 계산이 무거워 보수적인 값),
 * 1초에 60번 계산 + 25번 상태 전송(JSON) + 입력 받기(초당 30번 × 8명)를 실제와 같은 형식으로 흉내 낸다.
 * 네트워크로 실제 보내지는 않으므로 순수 CPU·메모리 한계다. */
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path'), os = require('os');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

const HTML = path.join(__dirname, '..', 'games', 'bio-kart.html');
const HZ = 60, DT = 1 / HZ, SNAP_EVERY = 0.04, INPUT_EVERY = 1 / 30;

function loadSim() {
  const html = fs.readFileSync(HTML, 'utf8');
  const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const main = blocks.reduce((a, b) => (b.length > a.length ? b : a));
  // DOM·THREE·오디오 자리에 넣는 '무엇이든 받아 주는' 가짜 객체
  const any = new Proxy(function () {}, {
    get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : k === 'length' ? 0 : k === Symbol.iterator ? function* () {} : any),
    apply: () => any, construct: () => any, set: () => true, has: () => true,
  });
  const ctx = {
    console: { log() {}, warn() {}, error() {}, info() {} }, Math, JSON, Date, Array, Object, Map, Set, Promise,
    Float32Array, Float64Array, Uint8Array, Int8Array, Uint16Array, Uint32Array, Int32Array,
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {}, requestAnimationFrame: () => 0,
    performance: { now: () => performance.now() }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    navigator: any, location: { protocol: 'http:', search: '', hash: '', href: '' }, document: any, THREE: any,
    AudioContext: any, Image: any, ICONS: any, addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }),
    innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1, fetch: () => new Promise(() => {}),
  };
  ctx.window = ctx.globalThis = ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(main + '\n;globalThis.__K={makeRace,stepRace,MAPS,getTrack};', ctx, { filename: 'bio-kart-sim.js' });
  return ctx.__K;
}

// 방장이 실제로 보내는 상태 패킷과 같은 모양 (bio-kart.html 의 tick 참고)
function packState(R) {
  return JSON.stringify({
    type: 'state', st: R.state, ct: +R.countT.toFixed(2), t: +R.t.toFixed(2), clk: +R.clock.toFixed(2), ft: R.firstT,
    k: R.karts.map(k => [+k.x.toFixed(1), +k.y.toFixed(1), +k.ang.toFixed(3), +k.mvAng.toFixed(3), +k.spd.toFixed(1),
      k.drifting ? 1 : 0, k.driftDir, +k.boostT.toFixed(2), +k.boostMul.toFixed(2), +k.spinT.toFixed(2), +k.stunT.toFixed(2),
      +k.shieldT.toFixed(2), +k.invT.toFixed(2), +k.revT.toFixed(2), +k.slowT.toFixed(2), +k.cloudT.toFixed(2), +k.gauge.toFixed(2),
      k.items.slice(), +k.dist.toFixed(1), +k.prog.toFixed(1), k.seg, +k.lat.toFixed(1), k.lapsDone, k.finished ? 1 : 0,
      +k.finishT.toFixed(2), k.rank, +k.exG.toFixed(3), +k.exT.toFixed(2), k.exShield, +(k.exMax || 1).toFixed(2)]),
    bx: R.boxes.map(b => (b.act ? 1 : 0)),
    gi: R.gi.map(g => [g.type, Math.round(g.x), Math.round(g.y), g.r]),
    pj: R.proj.map(p => [p.type, Math.round(p.x), Math.round(p.y), +(p.ang || 0).toFixed(2), Math.round(p.alt || 0), p.tgt ? p.tgt.i : -1]),
    ev: R.ev.splice(0).map(e => [e.t, e.k ? e.k.i : -1]),
  });
}
const INPUT_MSG = JSON.stringify({ type: 'input', slot: 3, seq: 1234, up: true, down: false, left: false, right: true, drift: false, touch: false, use: false, swap: false, t: 123456.7 });

let mapCursor = 0;
function newRoom(K) {
  const map = mapCursor++ % K.MAPS.length;
  const R = K.makeRace({ map, mode: 'item', ci: map % 15, ki: (map * 7) % 15, diff: 1, autoPlayer: true });
  R.countT = 0.01;
  return { R, snapAcc: Math.random() * SNAP_EVERY, inAcc: Math.random() * INPUT_EVERY, bytes: 0, snaps: 0 };
}
function stepRoom(K, room) {
  const R = room.R;
  K.stepRace(R, {}, DT);
  room.inAcc += DT;
  while (room.inAcc >= INPUT_EVERY) { room.inAcc -= INPUT_EVERY; for (let i = 0; i < 7; i++) JSON.parse(INPUT_MSG); }
  room.snapAcc += DT;
  if (room.snapAcc >= SNAP_EVERY) {
    room.snapAcc -= SNAP_EVERY;
    const s = packState(R);
    room.bytes += s.length; room.snaps++;
    for (let i = 0; i < 7; i++) Buffer.from(s); // 7명에게 보낼 프레임 만들기
  } else if (R.ev.length > 200) R.ev.length = 0;
  if (R.state === 'done') { const n = newRoom(K); room.R = n.R; }
}

module.exports = { loadSim, newRoom, stepRoom };

/* ---------- 일꾼(worker): 맡은 방들을 실제 시간에 맞춰 1초에 60번 계산 ---------- */
if (!isMainThread) {
  const K = loadSim();
  mapCursor = workerData.seed;
  const rooms = [];
  for (let i = 0; i < workerData.rooms; i++) rooms.push(newRoom(K));
  for (const r of rooms) for (let i = 0; i < 60; i++) stepRoom(K, r); // 예열
  const memMB = process.memoryUsage().heapUsed / 1048576;
  const t0 = performance.now(), dur = workerData.sec * 1000;
  let next = t0, ticks = 0, late = 0, busy = 0, worst = 0, bytes = 0, snaps = 0;
  const loop = () => {
    const now = performance.now();
    if (now - t0 >= dur) {
      for (const r of rooms) { bytes += r.bytes; snaps += r.snaps; }
      parentPort.postMessage({ ticks, late, busy, wall: now - t0, worst, memMB, bytes, snaps });
      return;
    }
    if (now >= next) {
      const a = performance.now();
      for (const r of rooms) stepRoom(K, r);
      const b = performance.now(), cost = b - a;
      busy += cost; ticks++; if (cost > worst) worst = cost;
      if (b - next > 1000 / HZ) late++; // 한 틱 이상 밀림 = 화면에서 끊김으로 느껴짐
      next += 1000 / HZ;
      if (b - next > 200) next = b; // 크게 밀리면 따라잡기 포기
    }
    const wait = next - performance.now();
    if (wait > 2) setTimeout(loop, wait - 1.5); else setImmediate(loop);
  };
  loop();
  return;
}

/* ---------- 본 프로그램 ---------- */
if (require.main !== module) return;
const QUICK = process.argv.includes('--quick');
const cores = (os.availableParallelism ? os.availableParallelism() : os.cpus().length);
const cpuName = (os.cpus()[0] || {}).model || '?';
const runWorkers = (workers, roomsEach, sec) => Promise.all(Array.from({ length: workers }, (_, w) => new Promise((res, rej) => {
  const wk = new Worker(__filename, { workerData: { rooms: roomsEach, sec, seed: w * 5 } });
  wk.once('message', res); wk.once('error', rej);
})));

(async () => {
  console.log('바이오 카트 서버 계산 성능 측정');
  console.log(`CPU: ${cpuName.trim()} · 코어(스레드) ${cores}개 · 메모리 ${(os.totalmem() / 1073741824).toFixed(1)}GB · Node ${process.version}`);

  // 1) 맵별 계산 비용 (한 줄로, 실제 시간 무시하고 최대 속도로)
  const K = loadSim();
  const per = [];
  let tb = 0;
  for (let m = 0; m < K.MAPS.length; m++) {
    const a = performance.now(); K.getTrack(m); tb += performance.now() - a;
  }
  console.log(`\n[1] 맵 20개 트랙 계산 데이터 만들기: 합계 ${tb.toFixed(0)}ms (처음 한 번만)`);
  const SIM_SEC = QUICK ? 30 : 90;
  for (let m = 0; m < K.MAPS.length; m++) {
    mapCursor = m; const room = newRoom(K);
    for (let i = 0; i < 120; i++) stepRoom(K, room); // 예열
    const times = [];
    for (let i = 0; i < SIM_SEC * HZ; i++) { const a = performance.now(); stepRoom(K, room); times.push(performance.now() - a); }
    times.sort((x, y) => x - y);
    const avg = times.reduce((s, x) => s + x, 0) / times.length;
    per.push({ m, name: K.MAPS[m].name, avg, p99: times[Math.floor(times.length * 0.99)], max: times[times.length - 1], bps: room.bytes / Math.max(1, room.snaps) * 25 });
  }
  const avgAll = per.reduce((s, p) => s + p.avg, 0) / per.length;
  const heavy = per.reduce((a, b) => (b.avg > a.avg ? b : a));
  console.log(`[2] 방 1개(카트 8대) 한 번 계산 + 전송 준비: 평균 ${avgAll.toFixed(3)}ms (가장 무거운 맵 '${heavy.name}' ${heavy.avg.toFixed(3)}ms, 상위1% ${heavy.p99.toFixed(3)}ms)`);
  const roomCoreShare = avgAll * HZ / 1000;
  console.log(`    → 방 1개가 코어 1개의 ${(roomCoreShare * 100).toFixed(2)}%를 씀 · 이론상 코어 1개당 약 ${Math.floor(1 / roomCoreShare)}개 방`);
  const bpsAvg = per.reduce((s, p) => s + p.bps, 0) / per.length;
  console.log(`    → 상태 전송량: 방 1개가 참가자 1명에게 초당 약 ${(bpsAvg / 1024).toFixed(1)}KB (8명이면 ${(bpsAvg * 7 / 1024).toFixed(0)}KB/s)`);

  // 2) 실제 시간 부하: 일꾼 여러 개에 방을 나눠 1초 60번 계산이 밀리지 않는지
  const workers = Math.max(1, cores - 1); // 한 코어는 중계·웹서버 몫으로 남김
  const sec = QUICK ? 6 : 15;
  const plan = [];
  for (const total of [8, 16, 32, 64, 128, 256, 384, 512]) plan.push(total);
  console.log(`\n[3] 실제 시간 부하 시험 (일꾼 ${workers}개, 단계마다 ${sec}초)`);
  console.log('    방 수 | 학생 수 | CPU 사용(일꾼 평균) | 밀린 틱 | 최악 틱 | 메모리(일꾼당) | 판정');
  let best = 0;
  for (const total of plan) {
    const each = Math.ceil(total / workers);
    const res = await runWorkers(workers, each, sec);
    const busy = res.reduce((s, r) => s + r.busy / r.wall, 0) / res.length;
    const ticks = res.reduce((s, r) => s + r.ticks, 0), late = res.reduce((s, r) => s + r.late, 0);
    const worst = Math.max(...res.map(r => r.worst)), mem = res.reduce((s, r) => s + r.memMB, 0) / res.length;
    const lateP = late / Math.max(1, ticks) * 100;
    const ok = busy < 0.6 && lateP < 0.5;
    const warn = !ok && busy < 0.85 && lateP < 2;
    if (ok) best = each * workers;
    console.log(`    ${String(each * workers).padStart(5)} | ${String(each * workers * 8).padStart(6)} | ${(busy * 100).toFixed(1).padStart(16)}% | ${lateP.toFixed(2).padStart(6)}% | ${worst.toFixed(1).padStart(5)}ms | ${mem.toFixed(0).padStart(11)}MB | ${ok ? '여유' : warn ? '빠듯' : '한계 넘음'}`);
    if (!ok && !warn) break;
  }
  console.log(`\n결론: 이 컴퓨터는 바이오 카트 방을 약 ${best}개(학생 ${best * 8}명)까지 여유 있게 직접 계산할 수 있어요.`);
  console.log('(여유 = CPU 60% 미만, 밀린 틱 0.5% 미만. 학교 와이파이 속도는 따로 확인 필요)');
})();
