// Spor Karabük — Service Worker (Vite build uyumlu)
const CACHE_NAME = 'spor-karabuk-v2';

// Kurulumda sadece ana sayfa ve ikonları cache'le
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(['/', '/icon.svg', '/manifest.json']).catch(() => {});
    })
  );
  self.skipWaiting();
});

// Eski cache'leri temizle
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first, başarısız olursa cache
self.addEventListener('fetch', (event) => {
  // Sadece GET isteklerini ve API dışı çağrıları handle et
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('/api/')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Başarılı cevabı cache'e ekle
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
