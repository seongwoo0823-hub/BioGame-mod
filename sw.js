/* BIO ARCADE 서비스 워커: 처음 접속할 때 전체 게임을 저장해 두고, 이후에는 오프라인에서도 실행.
   파일을 바꾸면 VERSION을 올려야 사용자 기기의 캐시가 새 버전으로 교체됩니다. */
const VERSION = 'bio-arcade-v8';
const FONT_CACHE = 'bio-arcade-fonts';
const CORE = [
  './', './index.html', './manifest.webmanifest',
  './games/bio-beat.html', './games/immune-strike.html', './games/bio-kart.html',
  './games/vessel-canyon.html', './games/biotro.html', './games/cell-bound.html',
  './games/cell-pinball.html', './games/cell-brawl.html', './games/only-up.html',
  './assets/bio-beat.jpg', './assets/immune-strike.jpg', './assets/bio-kart.jpg',
  './assets/vessel-canyon.jpg', './assets/biotro.jpg', './assets/cell-bound.jpg',
  './assets/cell-pinball.jpg', './assets/cell-brawl.jpg', './assets/only-up.jpg',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png', './icons/favicon-32.png',
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

  // 구글 폰트: 캐시 우선, 없으면 받아서 저장
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

  // 같은 사이트 파일: 캐시를 바로 보여주고 뒤에서 새 버전으로 갱신 (다음 실행 때 반영)
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
