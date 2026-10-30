/* BIO ARCADE 서비스 워커: 처음 접속할 때 전체 게임을 저장해 두고, 이후에는 오프라인에서도 실행. */
const VERSION = 'biogame-hub-v12-il-assets';
const FONT_CACHE = 'bio-arcade-fonts';
const CORE = [
  './', './index.html', './manifest.webmanifest',
  './games/bio-beat.html', './games/immune-strike.html', './games/bio-kart.html',
  './games/vessel-canyon.html', './games/biotro.html', './games/cell-bound.html',
  './games/cell-pinball.html', './games/cell-brawl.html', './games/only-up.html', './games/bio-strike.html', './games/infection-lord.html',
  './games/il-assets/meta.js', './games/il-assets/art.webp', './games/il-assets/boss.webp', './games/il-assets/fam.webp', './games/il-assets/hero_alchemist.webp', './games/il-assets/hero_guardian.webp', './games/il-assets/hero_mancer.webp', './games/il-assets/hero_swordsman.webp', './games/il-assets/icons.webp', './games/il-assets/mon.webp', './games/il-assets/npc.webp', './games/il-assets/props.webp', './games/il-assets/vfx.webp',
  './assets/bio-beat.jpg', './assets/immune-strike.jpg', './assets/bio-kart.jpg',
  './assets/vessel-canyon.jpg', './assets/biotro.jpg', './assets/cell-bound.jpg',
  './assets/cell-pinball.jpg', './assets/cell-brawl.jpg', './assets/only-up.jpg', './assets/bio-strike.jpg', './assets/infection-lord.jpg',
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
