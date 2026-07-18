const APP_VERSION = '0.9.0';
const CACHE_NAME = `ocularmp4-app-v${APP_VERSION}`;
const RUNTIME_CACHE = `ocularmp4-runtime-v${APP_VERSION}`;

// Static assets to precache on install
const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.svg',
  '/logo-mark.svg',
  '/og.png',
  '/icon-192.svg',
  '/icon-512.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // Skip non-GET requests
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // 1. Cache-First strategy for FFmpeg WebAssembly files (CDN files)
  const isFFmpegCDN = url.hostname === 'unpkg.com' && url.pathname.includes('@ffmpeg');
  
  if (isFFmpegCDN) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (networkResponse.status === 200 || networkResponse.status === 0) {
            const cacheCopy = networkResponse.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, cacheCopy);
            });
          }
          return networkResponse;
        }).catch(() => {
          // Silent offline fallback
          return new Response('Offline resource not available', { status: 503 });
        });
      })
    );
    return;
  }

  // 2. Stale-While-Revalidate for local assets and standard pages
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request).then((networkResponse) => {
        // Only cache successful GET responses
        if (networkResponse.status === 200 && !url.pathname.startsWith('/api/')) {
          const cacheCopy = networkResponse.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(request, cacheCopy);
          });
        }
        return networkResponse;
      }).catch((err) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        throw err;
      });

      return cachedResponse || fetchPromise;
    }).catch(() => {
      // Fallback for navigation mode when totally offline
      if (request.mode === 'navigate') {
        return caches.match('/');
      }
    })
  );
});
