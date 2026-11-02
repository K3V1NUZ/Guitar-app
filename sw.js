/* Fretbook service worker — precache everything, serve cache-first, refresh in background. */
const VERSION = 'fretbook-v3';
const ASSETS = [
  './', 'index.html', 'manifest.webmanifest', 'css/styles.css',
  'js/theory.js', 'js/voicings.js', 'js/audio.js', 'js/ui.js', 'js/render.js', 'js/app.js',
  'js/views/home.js', 'js/views/library.js', 'js/views/identify.js', 'js/views/scales.js', 'js/views/scaleid.js',
  'js/views/harmonize.js', 'js/views/chordscales.js', 'js/views/circle.js', 'js/views/fretboard.js',
  'js/views/progressions.js', 'js/views/tuner.js', 'js/views/metronome.js', 'js/views/transpose.js', 'js/views/ear.js',
  'assets/fonts/geist-latin-wght-normal.woff2', 'assets/fonts/geist-mono-latin-wght-normal.woff2',
  'assets/icons/icon.svg', 'assets/icons/icon-192.png', 'assets/icons/icon-512.png', 'assets/icons/icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const hit = await cache.match(req, { ignoreSearch: true });
      const net = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
      if (hit) { e.waitUntil(net); return hit; }
      const res = await net;
      if (res) return res;
      if (req.mode === 'navigate') return cache.match('index.html');
      return new Response('', { status: 504 });
    })
  );
});
