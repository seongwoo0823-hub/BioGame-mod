/* 바이오 킹덤 · 핵심: 에셋 불러오기, 그림 그리기 도우미, 소리, 저장 */
(function () {
  'use strict';
  const BK = window.BK = { img: {}, atlas: null, heroImg: {}, faceImg: {} };
  const A = 'bio-kingdom/a/';
  BK.A = A;
  const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.decoding = 'async'; i.onload = () => res(i); i.onerror = () => rej(new Error(src)); i.src = src; });
  BK.loadImg = loadImg;
  BK.load = async function (onProg) {
    const list = ['tiles', 'folk', 'bgel', 'icons', 'ranks'];
    let n = 0; const tot = list.length + 2;
    BK.atlas = await (await fetch(A + 'atlas.json')).json(); onProg && onProg(++n / tot);
    await Promise.all(list.map(k => loadImg(A + k + '.webp').then(i => { BK.img[k] = i; onProg && onProg(++n / tot); })));
    BK.iconCSS();
  };
  // 영웅 시트·얼굴은 필요할 때 받음
  BK.hero = id => { if (!BK.heroImg[id]) { const i = new Image(); i.src = A + 'h/' + id + '.webp'; BK.heroImg[id] = i; } return BK.heroImg[id]; };
  BK.face = id => A + 'h/' + id + '_face.webp';
  BK.bg = {}; BK.bgImg = n => { if (!BK.bg[n]) { const i = new Image(); i.src = A + 'bg/' + n + '.webp'; BK.bg[n] = i; } return BK.bg[n]; };
  // 아틀라스 그림 그리기: key = 'tiles' 등, name = 이름. 원래 칸 기준 (x, y)에 (ox, oy) 보정
  BK.draw = function (g, key, name, x, y, s, alpha) {
    const e = BK.atlas[key][name]; if (!e) return false;
    s = s || 1; if (alpha != null) g.globalAlpha = alpha;
    g.drawImage(BK.img[key], e[0], e[1], e[2], e[3], x + (e[4] || 0) * s, y + (e[5] || 0) * s, e[2] * s, e[3] * s);
    if (alpha != null) g.globalAlpha = 1;
    return true;
  };
  BK.has = (key, name) => !!(BK.atlas[key] && BK.atlas[key][name]);
  // 영웅 프레임: 시트 160칸, 줄 = idle 0 · walk 1 · run 2 · eat(공격) 3 · dance(스킬) 4 · 좋아요(승리) 5 · 싫어요(피격) 6
  BK.ANIM = { idle: 0, walk: 1, run: 2, atk: 3, skill: 4, win: 5, hurt: 6 };
  BK.drawHero = function (g, id, anim, t, x, y, s, flip, alpha) {
    const im = BK.hero(id); if (!im.complete || !im.naturalWidth) return;
    const row = BK.ANIM[anim] || 0, f = Math.floor(t) % 8, C = 160;
    g.save(); g.translate(x, y); if (flip) g.scale(-1, 1); if (alpha != null) g.globalAlpha = alpha;
    g.drawImage(im, f * C, row * C, C, C, -C / 2 * s, -C * 0.86 * s, C * s, C * s); g.restore();
  };
  // 아이콘: CSS 클래스 .ic-이름 (아이콘 아틀라스 64칸)
  BK.iconCSS = function () {
    const at = BK.atlas.icons, W = BK.img.icons.width, H = BK.img.icons.height; let css = '';
    for (const n in at) { const e = at[n]; css += `.ic-${n}{background-position:${-e[0] / 64 * 100}% 0;background-position:calc(${-e[0]}px * var(--s)) calc(${-e[1]}px * var(--s))}`; }
    const st = document.createElement('style'); st.textContent = `.ic{display:inline-block;--s:.5;width:calc(64px * var(--s));height:calc(64px * var(--s));background-image:url(${A}icons.webp);background-size:calc(${W}px * var(--s)) calc(${H}px * var(--s));background-repeat:no-repeat;vertical-align:middle}` + css;
    document.head.appendChild(st);
  };
  BK.ic = (n, s, extra) => `<i class="ic ic-${n}" style="--s:${s || 0.5};${extra || ''}"></i>`;
  // 계급장 그림 (dataURL 캐시)
  const RK = {};
  BK.rank = function (name) {
    if (RK[name]) return RK[name]; const e = BK.atlas.ranks[name]; if (!e) return '';
    const c = document.createElement('canvas'); c.width = e[2]; c.height = e[3]; c.getContext('2d').drawImage(BK.img.ranks, e[0], e[1], e[2], e[3], 0, 0, e[2], e[3]);
    return RK[name] = c.toDataURL();
  };

  // ---------- 소리 ----------
  let AC = null, MG = null; const BUF = {}, PEND = {};
  BK.vol = 0.7;
  function ac() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); MG = AC.createGain(); MG.gain.value = BK.vol; MG.connect(AC.destination); } catch (e) { } } if (AC && AC.state === 'suspended') AC.resume(); return AC; }
  BK.unlock = ac;
  function getBuf(k) {
    if (BUF[k] || PEND[k]) return; const a = ac(); if (!a) return;
    PEND[k] = fetch(A + 's/' + k + '.mp3').then(r => r.arrayBuffer()).then(b => new Promise((res, rej) => a.decodeAudioData(b, res, rej))).then(d => { BUF[k] = d; }).catch(() => { });
  }
  BK.preloadSnd = ks => ks.forEach(getBuf);
  BK.snd = function (k, vol, rate) {
    if (BK.muted) return; const a = ac(); if (!a) return; if (!BUF[k]) { getBuf(k); return; }
    const s = a.createBufferSource(); s.buffer = BUF[k]; s.playbackRate.value = rate || 1; const g = a.createGain(); g.gain.value = vol == null ? 1 : vol; s.connect(g); g.connect(MG); s.start();
  };
  // 배경 음악 (합성): 밝은 왕국 · 긴장되는 전투
  let musT = null, musStep = 0, musMode = null;
  const SCALE = { town: [0, 4, 7, 9, 12, 9, 7, 4], battle: [0, 3, 7, 10, 12, 10, 7, 3] };
  BK.music = function (mode) {
    if (musMode === mode) return; musMode = mode; clearInterval(musT); if (!mode || BK.muted || BK.noMusic) return;
    const base = mode === 'battle' ? 196 : 262, sc = SCALE[mode], bpm = mode === 'battle' ? 150 : 108;
    musT = setInterval(() => {
      const a = AC; if (!a || a.state !== 'running' || BK.muted) return; const t = a.currentTime;
      const note = (st, dur, type, v, oct) => { const o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.value = base * Math.pow(2, (st + (oct || 0) * 12) / 12); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(MG); o.start(t); o.stop(t + dur + 0.05); };
      const i = musStep % 8; note(sc[i], 0.25, 'triangle', 0.04);
      if (i % 4 === 0) note(sc[(musStep >> 3) % 2 ? 3 : 0], 0.5, 'sine', 0.05, -1);
      if (mode === 'battle' && i % 2 === 1) note(sc[(i + 2) % 8], 0.12, 'square', 0.012, 1);
      musStep++;
    }, 60000 / bpm / 2);
  };

  // ---------- 저장 ----------
  const KEY = 'bioKingdomSave';
  BK.saveState = function () { try { BK.S.t = Date.now(); localStorage.setItem(KEY, JSON.stringify(BK.S)); } catch (e) { } };
  BK.loadState = function () { try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); return s && s.v === 1 ? s : null; } catch (e) { return null; } };
  BK.fmt = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? (n / 1e3).toFixed(1) + 'K' : String(Math.floor(n));
  BK.fmtT = s => { s = Math.max(0, Math.ceil(s)); const m = Math.floor(s / 60), r = s % 60; return m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : m ? `${m}분 ${r}초` : `${r}초`; };
  BK.clamp = (v, a, b) => v < a ? a : v > b ? b : v;
})();
