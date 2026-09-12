// v2 — more resilient than v1:
// - caches each shell file individually (one failed file no longer kills the whole cache)
// - on offline navigation, always falls back to the cached index.html (the app shell),
//   even if the exact requested URL wasn't cached
// - leaves every non-same-origin request (CDN, model downloads) completely alone

const CACHE_NAME = 'audio-notes-shell-v2';
const SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.all(SHELL_FILES.map(async (file) => {
        try {
          const res = await fetch(file, { cache: 'reload' });
          if (res && res.ok) await cache.put(file, res);
        } catch (err) {
          // ignore a single failed file — don't let it block caching the rest
        }
      }));
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return; // let CDN/model requests pass straight through

  // page navigations (opening/reloading the app) always fall back to the cached
  // app shell if the exact URL isn't found — this is what fixes the browser's
  // native "you're offline" page showing up instead of our app
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match(event.request)
        .then((cached) => cached || caches.match('./index.html'))
        .then((resp) => resp || fetch(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
