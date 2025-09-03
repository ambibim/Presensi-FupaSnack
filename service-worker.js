// service-worker.js
// Cache shell & offline support for FUPA Snack PWA

const CACHE_NAME = 'fupa-snack-shell-v1';
const OFFLINE_URLS = [
  '/', 
  '/index.html',
  '/karyawan.html',
  '/admin.html',
  '/app.js',
  '/manifest.webmanifest',
  '/service-worker.js'
];

// On install: cache core files
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(OFFLINE_URLS))
      .then(() => self.skipWaiting())
  );
});

// On activate: clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch handler: cache-first for shell, network fallback for others
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // Serve from cache for shell resources
  if (OFFLINE_URLS.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then(cached =>
        cached || fetch(request).then(networkResponse => {
          caches.open(CACHE_NAME).then(cache => cache.put(request, networkResponse.clone()));
          return networkResponse;
        })
      )
    );
    return;
  }

  // For navigation requests (HTML), fallback to offline shell
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // For other requests, try network first, then cache
  event.respondWith(
    fetch(request)
      .then(response => response)
      .catch(() => caches.match(request))
  );
});