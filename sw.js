/* Offline támogatás: az app maga mindig elérhető, a térképcsempék a már megnézett területekre */
const VERSION = 'v2';
const SHELL = `bpwc-shell-${VERSION}`;
const RUNTIME = `bpwc-runtime-${VERSION}`;
const TILES = `bpwc-tiles-${VERSION}`;
const MAX_TILES = 600;

const SHELL_FILES = [
  './', './index.html', './style.css', './app.js', './data.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/apple-touch-icon.png', './icons/favicon-32.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.endsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function trimTiles() {
  const c = await caches.open(TILES);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - MAX_TILES; i++) await c.delete(keys[i]);
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Saját fájlok: hálózat először (hogy a frissítés azonnal látszódjon), offline a gyorsítótárból
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(SHELL).then((c) => c.put(req, copy)); return res; })
        .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  // Térképcsempék: gyorsítótár először
  if (url.hostname.endsWith('basemaps.cartocdn.com')) {
    e.respondWith(
      caches.open(TILES).then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        c.put(req, res.clone()).then(trimTiles);
        return res;
      }).catch(() => new Response('', { status: 504 }))
    );
    return;
  }

  // Leaflet (unpkg): gyorsítótár, háttérben frissítve
  if (url.hostname === 'unpkg.com') {
    e.respondWith(
      caches.open(RUNTIME).then(async (c) => {
        const hit = await c.match(req);
        const net = fetch(req).then((res) => { c.put(req, res.clone()); return res; }).catch(() => hit);
        return hit || net;
      })
    );
  }
});
