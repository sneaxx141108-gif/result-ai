/* Result AI – Service Worker: App startet auch ohne Netz, Updates kommen beim ersten Öffnen an.
   Bei jeder App-Änderung SHELL hochzählen. */
const SHELL = 'ra-shell-v5';
const IMG = 'ra-img-v1'; // Vereinswappen (ESPN), bleiben gespeichert
const FILES = ['./', 'index.html', 'app.css', 'app.js', 'engine.js', 'manifest.webmanifest', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'];

// Beim Installieren am Browser-Zwischenspeicher vorbei laden, sonst landet evtl. noch eine alte Datei im Cache
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== IMG).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

async function staleWhileRevalidate(req) {
  const cache = await caches.open(SHELL);
  const hit = await cache.match(req, { ignoreSearch: true });
  const net = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => hit);
  return hit || net;
}

// Wappen: einmal laden, danach sofort aus dem Speicher (auch ohne Netz)
async function cacheFirst(req) {
  const cache = await caches.open(IMG);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname === 'a.espncdn.com') e.respondWith(cacheFirst(req));
  else if (url.origin === self.location.origin || /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) e.respondWith(staleWhileRevalidate(req));
});
