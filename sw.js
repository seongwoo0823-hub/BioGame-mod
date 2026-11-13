/* BIO ARCADE 서비스 워커: 처음 접속할 때 전체 게임을 저장해 두고, 이후에는 오프라인에서도 실행. */
const VERSION = 'biogame-hub-v84-raidart';
const FONT_CACHE = 'bio-arcade-fonts';
const CORE = [
  './', './index.html', './manifest.webmanifest',
  './games/bio-beat.html', './games/bio-kart.html',
  './games/vessel-canyon.html', './games/biotro.html', './games/cell-bound.html',
  './games/cell-brawl.html', './games/only-up.html', './games/bio-strike.html', './ilog.js', './goal.js', './icons.js', './rank.js', './net.js', './lyric-audio.js', './games/cell-frontier.html', './games/bio-tower.html', './games/codon-glass.html', './games/bio-pyramid.html', './games/bio-pyramid/tw.css', './games/cell-expedition.html', './games/cell-expedition/tw.css', './games/cell-raid.html', './games/cell-raid/engine.js', './games/cell-raid/data.js', './games/cell-raid/world.js', './games/cell-raid/art.js', './games/cell-raid/game.js', './games/cell-raid/ui.js', './games/codon-glass/tw.css', './vendor/matter.min.js', './games/helix.html', './games/helix/js/audio.js', './games/helix/js/data.js', './games/helix/js/engine.js', './games/helix/js/world.js', './games/helix/js/game.js', './games/helix/js/weapons.js', './games/helix/js/foes2.js', './games/helix/js/run.js', './games/helix/js/ui.js',
  './assets/bio-beat.jpg', './assets/bio-kart.jpg',
  './assets/vessel-canyon.jpg', './assets/biotro.jpg', './assets/cell-bound.jpg',
  './assets/cell-brawl.jpg', './assets/only-up.jpg', './assets/bio-strike.jpg', './assets/helix.jpg', './assets/cell-frontier.jpg', './assets/bio-tower.jpg', './assets/codon-glass.jpg', './assets/bio-pyramid.jpg', './assets/cell-expedition.jpg', './assets/cell-raid.jpg', './icons/icon-online-192.png', './icons/icon-online-512.png', './icons/icon-lan-192.png', './icons/icon-wifi-192.png',
  './icons/icon-v2-192.png', './icons/icon-v2-512.png', './icons/icon-v2-maskable-512.png',
  './icons/apple-touch-icon-v2.png', './icons/favicon-v2-32.png',
  './vendor/three.min.js', './vendor/peerjs.min.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE.map(u => new Request(u, {cache: 'reload'})))));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== FONT_CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONT_CACHE).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      try { const res = await fetch(req); if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }
      catch (err) { return Response.error(); }
    }));
    return;
  }
  if (url.origin !== location.origin) return;
  // 교실 서버의 실시간 주소(서버 상태·방 목록·방 만들기 등)는 절대 저장본을 쓰지 않음
  if (url.pathname.includes('/__') || url.pathname.startsWith('/api/') || url.pathname === '/health' || url.pathname === '/ping' || url.pathname === '/hello') return;

  // manifest 및 아이콘 파일은 항상 네트워크 우선(Network-First)으로 최신 아이콘 보장
  if (url.pathname.endsWith('.webmanifest') || url.pathname.includes('/icons/')) {
    e.respondWith(caches.open(VERSION).then(async c => {
      try {
        const res = await fetch(req, {cache: 'reload'});
        if (res && res.ok) c.put(req, res.clone());
        return res;
      } catch (_) {
        return (await c.match(req, {ignoreSearch: true})) || Response.error();
      }
    }));
    return;
  }

  // 게임 페이지·스크립트는 네트워크 우선: 고친 버전이 다음 새로고침에 바로 적용되도록 (오프라인이면 저장본)
  if (req.mode === 'navigate' || /\.(html|js)$/.test(url.pathname)) {
    e.respondWith(caches.open(VERSION).then(async c => {
      try { const res = await fetch(req, {cache: 'no-cache'}); if (res && res.ok) c.put(req, res.clone()); return res; }
      catch (_) { return (await c.match(req, {ignoreSearch: true})) || (req.mode === 'navigate' ? (await c.match('./index.html')) : null) || Response.error(); }
    }));
    return;
  }

  e.respondWith(caches.open(VERSION).then(async c => {
    const hit = await c.match(req, {ignoreSearch: true});
    const net = fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    const res = await net;
    if (res) return res;
    if (req.mode === 'navigate') return (await c.match('./index.html')) || Response.error();
    return Response.error();
  }));
});
