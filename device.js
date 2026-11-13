/* BIO ARCADE 기기 맞춤 (모든 게임 공용)
 *  휴대폰 · 태블릿 · PC를 알아보고 화면과 3D 품질을 자동으로 맞춤
 *  - <html>에 dev-phone / dev-tablet / dev-pc, is-touch, is-portrait / is-landscape 클래스를 붙임 (화면을 돌리면 바로 바뀜)
 *  - CSS 변수 --app-h(실제 보이는 높이, 주소창 제외) · --vh(그 1%) · --dev-scale(UI 크기 배율)
 *  - three.js를 쓰는 게임: 렌더러 해상도(픽셀 비율)를 기기에 맞게 제한 → 휴대폰·태블릿에서 끊김 없이
 *  - 두 손가락/두 번 탭 확대로 화면이 커져 조작이 막히는 일, 길게 눌러 생기는 메뉴·글자 선택 막기
 *  - 화면이 꺼지거나 다른 앱으로 가면 Web Audio를 쉬게 해서 배터리 절약
 *  window.BioDevice = {type, touch, portrait, maxDpr, lowPower}
 */
(function () {
  'use strict';
  if (window.BioDevice) return;
  var ua = navigator.userAgent || '', mtp = navigator.maxTouchPoints || 0;
  var touch = ('ontouchstart' in window) || mtp > 0 || (window.matchMedia && matchMedia('(pointer: coarse)').matches);
  var iPadOS = /Macintosh/.test(ua) && mtp > 1;
  function classify() {
    var w = Math.min(screen.width || innerWidth, screen.height || innerHeight), W = Math.max(screen.width || innerWidth, screen.height || innerHeight);
    if (/iPad|Tablet|PlayBook|Silk/i.test(ua) || iPadOS || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return 'tablet';
    if (/iPhone|iPod|Android.*Mobile|Mobile|Windows Phone/i.test(ua)) return 'phone';
    if (touch && w < 600) return 'phone';
    if (touch && w < 1100 && W < 1500) return 'tablet';
    return 'pc';
  }
  var type = classify();
  var cores = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory || 4;
  var lowPower = type !== 'pc' && (cores <= 4 || mem <= 3);
  var maxDpr = type === 'phone' ? (lowPower ? 1.25 : 1.5) : type === 'tablet' ? (lowPower ? 1.25 : 1.6) : 2;
  var D = window.BioDevice = {type: type, touch: touch, portrait: innerHeight > innerWidth, maxDpr: maxDpr, lowPower: lowPower};
  var root = document.documentElement;
  function apply() {
    var vv = window.visualViewport, h = vv ? vv.height : innerHeight, w = vv ? vv.width : innerWidth;
    D.portrait = h > w;
    root.classList.remove('dev-phone', 'dev-tablet', 'dev-pc', 'is-portrait', 'is-landscape');
    root.classList.add('dev-' + type, D.portrait ? 'is-portrait' : 'is-landscape');
    root.classList.toggle('is-touch', !!touch);
    root.style.setProperty('--app-h', h + 'px');
    root.style.setProperty('--vh', (h / 100) + 'px');
    // 작은 화면일수록 UI를 조금 줄이고, 큰 태블릿·PC는 그대로
    var s = Math.max(0.78, Math.min(1, Math.min(w, h) / 600));
    root.style.setProperty('--dev-scale', s.toFixed(3));
  }
  apply();
  addEventListener('resize', apply);
  addEventListener('orientationchange', function () { setTimeout(apply, 250); });
  if (window.visualViewport) visualViewport.addEventListener('resize', apply);

  // three.js 렌더러 해상도 제한: THREE가 만들어지는 순간 가로채서 setPixelRatio를 감쌈
  function patchThree(T) {
    try {
      if (!T || !T.WebGLRenderer || T.WebGLRenderer.__bioPatched) return !!(T && T.WebGLRenderer);
      var proto = T.WebGLRenderer.prototype, orig = proto.setPixelRatio;
      if (orig) proto.setPixelRatio = function (r) { return orig.call(this, Math.min(r || 1, D.maxDpr)); };
      T.WebGLRenderer.__bioPatched = true;
      return true;
    } catch (e) { return true; }
  }
  if (window.THREE) patchThree(window.THREE);
  else {
    try {
      var held;
      Object.defineProperty(window, 'THREE', {configurable: true, enumerable: true,
        get: function () { return held; },
        set: function (v) { held = v; // three.min.js는 빈 객체를 먼저 넣고 채움 → 스크립트가 끝난 직후(마이크로태스크)에 감쌈
          if (!patchThree(v)) Promise.resolve().then(function () { patchThree(held); }); }});
    } catch (e) {}
  }

  // 확대·길게 누르기 막기 (입력칸은 그대로)
  var no = function (e) { if (e.cancelable) e.preventDefault(); };
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (t) { document.addEventListener(t, no, {passive: false}); });
  document.addEventListener('touchmove', function (e) { if (e.touches && e.touches.length > 1) no(e); }, {passive: false});
  var lastTouch = 0;
  document.addEventListener('touchend', function (e) {
    var t = e.target, now = Date.now();
    if (now - lastTouch < 320 && !(t.closest && t.closest('input,textarea,select,[contenteditable]'))) no(e);
    lastTouch = now;
  }, {passive: false});
  document.addEventListener('contextmenu', function (e) { var t = e.target; if (touch && !(t.closest && t.closest('input,textarea,a'))) e.preventDefault(); });

  // 공통 CSS: 실제 보이는 높이로 꽉 채우기, 글자 크기 자동 확대 끄기, 탭 강조색 없애기
  var css = document.createElement('style');
  css.textContent = 'html{-webkit-text-size-adjust:100%;text-size-adjust:100%;touch-action:manipulation}' +
    'html.is-touch body{-webkit-tap-highlight-color:transparent;-webkit-touch-callout:none}body{overflow-x:hidden}' +
    'html.is-touch button,html.is-touch [role=button]{min-height:32px}' +
    'html.is-touch input,html.is-touch textarea,html.is-touch select{font-size:max(16px,1em)}';
  (document.head || root).appendChild(css);

  // 가로 화면이 좋은 게임(<html data-prefer="landscape">): 휴대폰 세로일 때 닫을 수 있는 안내
  function orientHint() {
    if (root.getAttribute('data-prefer') !== 'landscape' || type !== 'phone' || !document.body) return;
    var el = document.getElementById('bio-orient');
    var show = D.portrait && !sessionStorage.getItem('bioOrientSeen');
    if (!show) { if (el) el.remove(); return; }
    if (el) return;
    el = document.createElement('div'); el.id = 'bio-orient';
    el.style.cssText = 'position:fixed;left:50%;top:max(10px,env(safe-area-inset-top));transform:translateX(-50%);z-index:2147483000;display:flex;gap:10px;align-items:center;padding:9px 12px 9px 16px;border-radius:999px;background:rgba(12,18,34,.86);color:#fff;font:700 13px/1.3 "Noto Sans KR",system-ui,sans-serif;border:1px solid rgba(255,255,255,.25);box-shadow:0 8px 24px rgba(0,0,0,.35);white-space:nowrap';
    el.innerHTML = '📱↻ 가로로 돌리면 더 크게 보여요 <button type="button" style="border:0;border-radius:999px;padding:5px 10px;background:rgba(255,255,255,.18);color:#fff;font:inherit">닫기</button>';
    el.querySelector('button').onclick = function () { try { sessionStorage.setItem('bioOrientSeen', '1'); } catch (e) {} el.remove(); };
    document.body.appendChild(el);
  }
  addEventListener('resize', function () { setTimeout(orientHint, 100); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', orientHint); else orientHint();

  // 다른 앱으로 가면 소리 쉬기 (각 게임의 AudioContext)
  var ACs = [];
  var AC = window.AudioContext || window.webkitAudioContext;
  if (AC && !AC.__bioWrapped) {
    var Wrapped = function () { var c = new (Function.prototype.bind.apply(AC, [null].concat([].slice.call(arguments))))(); ACs.push(c); return c; };
    Wrapped.prototype = AC.prototype; Wrapped.__bioWrapped = true;
    try { window.AudioContext = Wrapped; if (window.webkitAudioContext) window.webkitAudioContext = Wrapped; } catch (e) {}
  }
  var paused = [];
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { paused = ACs.filter(function (c) { return c.state === 'running'; }); paused.forEach(function (c) { try { c.suspend(); } catch (e) {} }); }
    else { paused.forEach(function (c) { try { c.resume(); } catch (e) {} }); paused = []; }
  });
})();
