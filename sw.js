// A robust service worker for caching resources for offline use.

const CACHE_NAME = 'ganhospro-cache-v12';
// Add core files to cache. As this is a single page app, index.html is the main entry point.
const urlsToCache = [
  '/',
  '/index.html',
  // '/style.css', // Removido: style.css não é mais usado
  '/manifest.json'
];

// Install event: open a cache and add the core assets to it.
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache and caching core assets');
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch event: Implement "cache, then network" (stale-while-revalidate) strategy.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  const requestURL = new URL(event.request.url);

  // Navigation requests: network first, then cache, then offline fallback
  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const networkResponse = await fetch(event.request);
        const cache = await caches.open(CACHE_NAME);
        cache.put(event.request, networkResponse.clone());
        return networkResponse;
      } catch (err) {
        const cacheMatch = await caches.match('/index.html');
        if (cacheMatch) return cacheMatch;
        // Minimal offline HTML fallback
        return new Response(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline</title><style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,sans-serif;background:#111;color:#eee;display:flex;align-items:center;justify-content:center;height:100vh;margin:0} .card{background:#1f2937;border:1px solid #374151;border-radius:12px;padding:24px;max-width:420px;text-align:center} h1{font-size:20px;margin:0 0 8px;color:#10b981} p{font-size:14px;color:#9ca3af;margin:0 0 12px} small{color:#6b7280}</style></head><body><div class="card"><h1>Você está offline</h1><p>Sem conexão no momento. Tente novamente mais tarde.</p><small>GanhosPro</small></div></body></html>`, { headers: { 'Content-Type': 'text/html' }, status: 200 });
      }
    })());
    return;
  }

  // Static assets: cache-first, then network update
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(event.request);
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        })
        .catch((err) => {
          console.warn(`Network request for ${event.request.url} failed.`, err);
        });
      return cachedResponse || fetchPromise;
    })
  );
});


// Activate event: clean up old caches.
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    (async () => {
      // Clean old caches
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhitelist.includes(cacheName)) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
      // Claim clients so the SW starts controlling pages immediately
      await self.clients.claim();
    })()
  );
});