const VERSION = 'argos-one-v4'
const STATIC_CACHE = `${VERSION}-static`
const STATIC_ASSETS = [
  '/manifest.webmanifest',
  '/argos-ui/app.js',
  '/argos-ui/assets/brand/argos-one-logo-yellow.svg',
  '/icons/argos-one-app-icon.svg',
  '/icons/argos-one-192.png',
  '/icons/argos-one-512.png',
  '/icons/argos-one-maskable.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key)))).then(() => self.clients.claim()))
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request))
    return
  }
  if (url.pathname === '/argos-ui/app.js') {
    event.respondWith(fetch(request).then((response) => {
      const copy = response.clone()
      caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy))
      return response
    }).catch(() => caches.match(request)))
    return
  }
  if (url.pathname.startsWith('/argos-ui/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      const copy = response.clone()
      caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy))
      return response
    })))
  }
})
