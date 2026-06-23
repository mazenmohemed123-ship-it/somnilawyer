// Somni Lawyer — Service Worker
// Ensures users always get the latest version of the app
const CACHE = 'somnilawyer-v1';
const APP_SHELL = ['/', '/index.html', '/manifest.json', '/icons/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Never cache external API calls (Firebase, etc.)
  if (url.origin !== self.location.origin) return;

  // Network-first for HTML and manifest (always get latest)
  if (req.mode === 'navigate' || req.url.endsWith('.html') || req.url.endsWith('manifest.json')) {
    event.respondWith(
      fetch(req).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Network-first for everything else (cache as fallback for offline)
  event.respondWith(
    fetch(req).then((res) => {
      if (!res || res.status !== 200 || res.type === 'error') {
        return caches.match(req);
      }
      const copy = res.clone();
      caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(req))
  );
});
