/* 감염 도시 · 감염자(좀비) */
(function () {
  'use strict';
  const OB = window.OB, TAU = Math.PI * 2;
  const Z = OB.Z = [];
  const POOL = [];
  const ACTIVE_R = 62, DRAW_R = 44; let MAX_DRAW = 48;
  const TYPES = {
    walker: { hp: 60, spd: 0.85, dmg: [6, 11], name: '감염자' },
    runner: { hp: 45, spd: 2.9, dmg: [5, 9], name: '빠른 감염자' },
    brute: { hp: 150, spd: 0.7, dmg: [10, 16], name: '변이 감염자', scale: 1.18 }
  };
  OB.ZTYPES = TYPES;
  OB.spawnZombie = function (x, z, type, o) {
    const T = TYPES[type || 'walker'];
    const zz = Object.assign({ x, z, ry: Math.random() * TAU, hp: T.hp, max: T.hp, type: type || 'walker', T, state: 'idle', tx: x, tz: z, wT: Math.random() * 5, atkT: 0, downT: 0, deadT: 0, C: null, pT: Math.random() * 0.3, seenT: -99, stuck: 0, skin: OBA.SKINS.zombie[Math.floor(Math.random() * 4)], lean: Math.random(), bangT: 0, hitT: 0, vis: 0 }, o || {});
    Z.push(zz); return zz;
  };
  // 처음 배치: 구역마다 밀도가 다름
  OB.populate = function (R, day) {
    const W = OB.W, N = OBW.N, CS = OBW.CS;
    const dens = (i, j) => {
      const g = W.ground[j * N + i]; if (W.solidC[j * N + i] || g === OBW.GR.water || g === OBW.GR.deep) return 0;
      if (g === OBW.GR.sewer) return 0.075; if (g === OBW.GR.cave) return 0.06; if (g === OBW.GR.ulab) return 0.07;
      if (i >= OBW.CN || j >= OBW.CN) return 0;
      if (i >= 33 && i <= 60 && j >= 33 && j <= 60) return 0.11;   // 시내
      if (W.bld[j * N + i] >= 0) return 0.06;
      if (g === OBW.GR.road || g === OBW.GR.walk) return 0.05;
      if (i < 12 || j < 12 || j > 88) return 0.012;
      return 0.03;
    };
    const home = W.home;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      if (Math.abs(i - (home.i0 + 2)) < 9 && Math.abs(j - (home.j0 + 2)) < 9) continue;   // 시작 집 근처는 비움
      if (R() < dens(i, j)) { const r = R(); OB.spawnZombie((i + R()) * CS, (j + R()) * CS, r < 0.05 ? 'brute' : r < 0.11 ? 'runner' : 'walker'); }
    }
  };
  // ---------- 모습 ----------
  function getChar(zz) {
    let C = POOL.find(c => !c.used && c.skin === zz.skin) || null;
    if (!C) { C = OBA.char(zz.skin); C.used = false; POOL.push(C); OB.scene.add(C.root); }
    C.used = true; C.root.visible = true; C.root.scale.setScalar(zz.T.scale || 1);
    C.obj.rotation.set(0, 0, 0); C.cur = null; OB.setAnim(C, 'run', 0); C.act.run.time = Math.random();
    setFade(C, 1);
    return C;
  }
  function freeChar(zz) { if (!zz.C) return; zz.C.used = false; zz.C.root.visible = false; zz.C = null; }
  function setFade(C, a) {
    const m = C.mesh.material; if (C.fade === a) return; C.fade = a;
    if (a < 1) { if (!C.ownMat) { C.mesh.material = C.ownMat = m.clone(); } C.mesh.material.transparent = true; C.mesh.material.opacity = a; }
    else if (C.ownMat) { C.mesh.material.opacity = 1; C.mesh.material.transparent = false; }
  }
  // 좀비 포즈: 팔을 앞으로, 고개를 기울임
  function zombiePose(zz, t) {
    const C = zz.C, b = C.bones, add = OB.addRot;
    const at = zz.atkT > 0 ? Math.sin(Math.min(1, zz.atkT / 0.7) * Math.PI) : 0;
    add(b.LeftArm, 1.3 + at * 0.45 + Math.sin(t * 2.1 + zz.lean) * 0.1, 0, 0);
    add(b.RightArm, 0, 0, 1.25 + at * 0.45 + Math.sin(t * 1.9) * 0.1);
    add(b.Spine, 0.18 + at * 0.35, 0, 0); add(b.Head, 0.1, 0, 0.25 * Math.sin(zz.lean * 6) + Math.sin(t * 1.3 + zz.lean * 4) * 0.12);
  }
  // ---------- 매 프레임 ----------
  let flowT = 0;
  OB.updateZombies = function (dt, t) {
    MAX_DRAW = OB.lowGfx ? 26 : 48;
    const P = OB.P, W = OB.W; if (!P) return;
    flowT -= dt; if (flowT <= 0) { OB.buildFlow(P.x, P.z, 34); flowT = 0.5; }
    const night = OB.isDark(), sightR = (night ? (P.flash ? 13 : 7.5) : 17) * (P.sneak ? 0.55 : 1) * (P.inside >= 0 && night && !P.flash ? 0.7 : 1);
    // 그릴 좀비 고르기 (가까운 순)
    const near = [];
    for (const zz of Z) { zz.d = Math.hypot(zz.x - P.x, zz.z - P.z); }
    let drawn = 0;
    const hash = {};
    for (const zz of Z) {
      if (zz.state === 'gone') continue;
      const active = zz.d < ACTIVE_R;
      if (!active) { if (zz.C) freeChar(zz); continue; }
      // 서로 밀어내기용 칸
      const hk = (zz.x >> 1) + ',' + (zz.z >> 1); (hash[hk] = hash[hk] || []).push(zz);
      thinkMove(zz, dt, t, sightR);
    }
    // 겹침 풀기
    for (const k in hash) { const L = hash[k]; for (let a = 0; a < L.length; a++) for (let b = a + 1; b < L.length; b++) { const A = L[a], B = L[b]; if (A.state === 'dead' || B.state === 'dead') continue; const dx = B.x - A.x, dz = B.z - A.z, d = Math.hypot(dx, dz); if (d < 0.6 && d > 1e-4) { const k2 = (0.6 - d) / d * 0.5; A.x -= dx * k2; A.z -= dz * k2; B.x += dx * k2; B.z += dz * k2; } } }
    // 그리기
    const vis = Z.filter(zz => zz.state !== 'gone' && zz.d < DRAW_R).sort((a, b) => a.d - b.d);
    const show = new Set(vis.slice(0, MAX_DRAW));
    for (const zz of Z) {
      if (!show.has(zz)) { if (zz.C) freeChar(zz); continue; }
      // 플레이어가 볼 수 있는가 (좀보이드처럼 시야 밖은 흐리게)
      zz.visT = (zz.visT || 0) - dt;
      if (zz.visT <= 0) { zz.visT = 0.2 + Math.random() * 0.1; zz.seen = zz.d < 2.5 || OB.los(P.x, P.z, zz.x, zz.z, 'see'); }
      const target = zz.seen ? 1 : 0; zz.vis += (target - zz.vis) * Math.min(1, dt * 6);
      if (zz.vis < 0.03 && !zz.C) continue;
      if (!zz.C) zz.C = getChar(zz);
      drawZ(zz, dt, t);
    }
    // 시체 정리
    for (let i = Z.length - 1; i >= 0; i--) { const zz = Z[i]; if (zz.state === 'dead' && t - zz.deadT > 40) { freeChar(zz); Z.splice(i, 1); } }
  };
  function thinkMove(zz, dt, t, sightR) {
    const P = OB.P;
    if (zz.state === 'dead') return;
    if (zz.downT > 0) { zz.downT -= dt; if (zz.downT <= 0) { zz.state = 'chase'; zz.upT = 0.6; } return; }
    if (zz.upT > 0) { zz.upT -= dt; return; }
    if (zz.hitT > 0) { zz.hitT -= dt; }
    // 감지 (나눠서)
    zz.pT -= dt;
    if (zz.pT <= 0 && !P.dead) {
      zz.pT = 0.25 + Math.random() * 0.15;
      const face = Math.abs(OB.angDiff(zz.ry, Math.atan2(P.x - zz.x, P.z - zz.z))) < 1.2;
      if (zz.d < sightR && (face || zz.d < 3.2 || zz.state === 'chase') && OB.los(zz.x, zz.z, P.x, P.z, 'see')) {
        if (zz.state !== 'chase') { zz.groanT = 0; OB.sfx && OB.sfx('groan', zz.d); }
        zz.state = 'chase'; zz.tx = P.x; zz.tz = P.z; zz.seenT = t;
      } else {
        for (const n of OB.noises) { if (n.t > 0.6) continue; const d = Math.hypot(n.x - zz.x, n.z - zz.z); if (d < n.r) { if (zz.state !== 'chase' || t - zz.seenT > 3) { zz.state = 'search'; zz.tx = n.x + (Math.random() - .5) * 3; zz.tz = n.z + (Math.random() - .5) * 3; } } }
        if (zz.state === 'chase' && t - zz.seenT > 12) { zz.state = 'search'; }
      }
    }
    let spd = zz.T.spd * (OB.isDark() ? 1.15 : 1), mx = 0, mz = 0, want = null;
    if (zz.state === 'chase' && !P.dead) {
      const direct = t - zz.seenT < 0.6;
      if (direct) want = [P.x, P.z];
      else { const f = OB.flowDir(zz.x, zz.z); if (f) want = [f.x, f.z]; else want = [zz.tx, zz.tz]; }
      if (zz.type === 'walker' && zz.d < 6) spd *= 1.25;   // 가까우면 조금 빨라짐
    } else if (zz.state === 'search') {
      want = [zz.tx, zz.tz]; if (Math.hypot(zz.tx - zz.x, zz.tz - zz.z) < 1) { zz.state = 'wander'; zz.wT = 4; }
      spd *= 0.85;
    } else {
      zz.wT -= dt;
      if (zz.wT <= 0) { zz.wT = 4 + Math.random() * 8; if (Math.random() < 0.5) { zz.state = 'wander'; zz.tx = zz.x + (Math.random() - .5) * 10; zz.tz = zz.z + (Math.random() - .5) * 10; } else zz.state = 'idle'; }
      if (zz.state === 'wander') { want = [zz.tx, zz.tz]; spd *= 0.45; if (Math.hypot(zz.tx - zz.x, zz.tz - zz.z) < 0.6) zz.state = 'idle'; }
    }
    // 공격
    if (zz.atkT > 0) {
      zz.atkT += dt;
      if (zz.atkT > 0.7 && !zz.atkDone) { zz.atkDone = true; if (zz.d < 1.25 && !P.dead && Math.abs(OB.angDiff(zz.ry, Math.atan2(P.x - zz.x, P.z - zz.z))) < 1.3) OB.hurtPlayer(zz); }
      if (zz.atkT > 1.25) zz.atkT = 0;
      return;
    }
    if (zz.state === 'chase' && zz.d < 0.95 && !P.dead && t - zz.seenT < 0.6) { zz.atkT = 0.001; zz.atkDone = false; zz.ry = Math.atan2(P.x - zz.x, P.z - zz.z); return; }
    if (!want) { zz.moving = false; return; }
    const dx = want[0] - zz.x, dz = want[1] - zz.z, L = Math.hypot(dx, dz);
    if (L < 0.05) { zz.moving = false; return; }
    const ty = Math.atan2(dx, dz); zz.ry += OB.angDiff(zz.ry, ty) * Math.min(1, dt * 5);
    mx = Math.sin(zz.ry) * spd * dt; mz = Math.cos(zz.ry) * spd * dt;
    if (zz.hitT > 0) { mx *= 0.2; mz *= 0.2; }
    if (zz.vaultT > 0) { zz.vaultT -= dt; mx *= 0.35; mz *= 0.35; }
    const ox = zz.x, oz = zz.z;
    OB.move(zz, mx, mz, 0.3, 'z');
    { const [ci, cj] = OB.cellOf(ox, oz), [ni, nj] = OB.cellOf(zz.x, zz.z); let key = null;
      if (ni !== ci) key = 'W,' + Math.max(ci, ni) + ',' + cj; else if (nj !== cj) key = 'N,' + ci + ',' + Math.max(cj, nj);
      const o = key && OB.W.eRef[key]; if (o && o.broken && !OB.W.doors.includes(o) && !(zz.vaultT > 0)) zz.vaultT = 0.9; }
    const got = Math.hypot(zz.x - ox, zz.z - oz);
    zz.moving = got > spd * dt * 0.2;
    // 막혔다: 앞에 문·창문이 있으면 두드리거나 깸
    if (got < spd * dt * 0.35 && (zz.state === 'chase' || zz.state === 'search')) {
      zz.stuck += dt;
      if (zz.stuck > 0.5) {
        const e = blockerAhead(zz);
        if (e) {
          zz.bangT -= dt;
          if (zz.bangT <= 0) {
            zz.bangT = 1.1; zz.bangA = 0.7; OB.noise(zz.x, zz.z, 9, 'bang'); OB.sfx && OB.sfx('bang', zz.d);
            if (e.kind === 'door') { if (e.o.bar > 0) { e.o.barHp = (e.o.barHp == null ? 50 : e.o.barHp) - 8; if (e.o.barHp <= 0) { OB.removeBarricade(e.o); } } else { e.o.hp -= 9; if (e.o.hp <= 0) OB.breakDoor(e.o); } }
            else if (e.kind === 'window') { if (e.o.bar > 0) { e.o.barHp = (e.o.barHp == null ? 50 : e.o.barHp) - 8; if (e.o.barHp <= 0) OB.removeBarricade(e.o); } else if (!e.o.broken) { e.o.hp -= 12; if (e.o.hp <= 0) OB.breakWindow(e.o); } }
          }
          zz.atkT = 0;
        } else if (zz.stuck > 2.5) { zz.stuck = 0; zz.tx = zz.x + (Math.random() - .5) * 6; zz.tz = zz.z + (Math.random() - .5) * 6; if (zz.state !== 'chase') zz.state = 'wander'; }
      }
    } else zz.stuck = 0;
  }
  function blockerAhead(zz) {
    const CS = OBW.CS, fx = zz.x + Math.sin(zz.ry) * 0.7, fz = zz.z + Math.cos(zz.ry) * 0.7;
    const [i, j] = OB.cellOf(zz.x, zz.z), [ni, nj] = OB.cellOf(fx, fz);
    let key = null;
    if (ni !== i) key = 'W,' + Math.max(i, ni) + ',' + j; else if (nj !== j) key = 'N,' + i + ',' + Math.max(j, nj);
    if (!key) return null;
    const o = OB.W.eRef[key]; if (!o) return null;
    const isDoor = OB.W.doors.includes(o);
    if (isDoor && !o.broken && (!o.open || o.bar > 0)) return { kind: 'door', o };
    if (!isDoor && (!o.broken || o.bar > 0)) return { kind: 'window', o };
    return null;
  }
  // ---------- 그리기 ----------
  function drawZ(zz, dt, t) {
    const C = zz.C; C.root.position.set(zz.x, 0, zz.z); C.root.rotation.y = zz.ry;
    setFade(C, Math.max(0.0, Math.min(1, zz.vis)));
    C.root.visible = zz.vis > 0.03;
    if (zz.state === 'dead') {
      const k = Math.min(1, (t - zz.deadT) * 2.2); C.obj.rotation.x = -k * Math.PI / 2; C.obj.position.y = k * 0.25 / OBA.CH_SCALE * 0;
      C.update(0); return;
    }
    if (zz.downT > 0) { C.obj.rotation.x = -Math.PI / 2 * Math.min(1, (2.6 - zz.downT) * 4); OB.setAnim(C, 'idle'); C.update(dt); return; }
    C.obj.rotation.x = 0; C.obj.position.y = 0;
    if (zz.upT > 0) { const k = zz.upT / 0.6; OB.setAnim(C, 'idle'); C.update(dt); C.obj.rotation.x = -Math.PI / 2 * k * k; const b = C.bones; OB.addRot(b.LeftArm, 1.0 * k, 0, 0); OB.addRot(b.RightArm, 0, 0, 1.0 * k); return; }
    const run = zz.type === 'runner' && zz.state === 'chase';
    OB.setAnim(C, run ? 'run' : (zz.moving ? 'run' : 'idle'), 0.25);
    C.act.run.timeScale = run ? 1.05 : 0.42 + zz.T.spd * 0.12;
    C.update(dt);
    if (!run) zombiePose(zz, t);
    const b = C.bones;
    if (zz.bangA > 0) {   // 문·창문 두드리기: 두 팔을 들어 내리침
      zz.bangA -= dt; const k = 1 - zz.bangA / 0.7, up = k < 0.45 ? k / 0.45 : Math.max(0, 1 - (k - 0.45) / 0.2);
      OB.addRot(b.LeftArm, 1.3 * up, 0, 0); OB.addRot(b.RightArm, 0, 0, 1.3 * up); OB.addRot(b.Spine, -0.15 * up + (k > 0.45 && k < 0.7 ? 0.35 : 0), 0, 0);
    }
    if (zz.vaultT > 0) {  // 깨진 창문 넘어오기
      const k = 1 - zz.vaultT / 0.9, l = Math.sin(k * Math.PI); C.obj.position.y = 0.5 * l;
      OB.addRot(b.Spine, 0.6 * l, 0, 0); OB.addRot(b.LeftUpLeg, -1.0 * l, 0, 0); OB.addRot(b.RightUpLeg, -0.6 * l, 0, 0); OB.addRot(b.LeftLeg, 1.2 * l, 0, 0);
    }
    if (zz.hitT > 0) OB.addRot(C.bones.Spine, -0.4 * zz.hitT / 0.3, 0, 0);
  }
  // ---------- 피해 ----------
  OB.hurtZombie = function (zz, dmg, kd, fromX, fromZ) {
    if (zz.state === 'dead') return false;
    zz.hp -= dmg; zz.hitT = 0.3; zz.state = 'chase'; zz.seenT = OB.t;
    const a = Math.atan2(zz.x - fromX, zz.z - fromZ); OB.move(zz, Math.sin(a) * 0.35, Math.cos(a) * 0.35, 0.3, 'z');
    OB.blood && OB.blood(zz.x, zz.z);
    if (zz.hp <= 0) {
      zz.state = 'dead'; zz.deadT = OB.t; zz.downT = 0; OB.P.kills++; OB.onKill && OB.onKill(zz); return true;
    }
    if (Math.random() < kd) zz.downT = 2.6;
    return false;
  };
  OB.zombiesNear = (x, z, r) => Z.filter(zz => zz.state !== 'dead' && zz.state !== 'gone' && Math.hypot(zz.x - x, zz.z - z) < r);
  // 밤마다 새 무리: 지도 가장자리에서 도시로
  OB.horde = function (n) {
    const CS = OBW.CS, N = OBW.N;
    for (let k = 0; k < n; k++) {
      const side = Math.floor(Math.random() * 3); let x, z;
      if (side === 0) { x = (14 + Math.random() * 70) * CS; z = 2 * CS; } else if (side === 1) { x = 1 * CS; z = (14 + Math.random() * 70) * CS; } else { x = (14 + Math.random() * 70) * CS; z = 86 * CS; }
      const zz = OB.spawnZombie(x, z, Math.random() < 0.15 ? 'runner' : 'walker'); zz.state = 'search'; zz.tx = (30 + Math.random() * 36) * CS; zz.tz = (30 + Math.random() * 36) * CS;
    }
  };
})();
