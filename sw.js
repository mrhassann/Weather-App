/**
 * sw.js — service worker for offline support & installability.
 *
 * - App shell (HTML/CSS/JS/icons): stale-while-revalidate → loads instantly,
 *   updates in the background.
 * - Google Fonts: cache-first.
 * - Weather API calls are NOT cached here on purpose: the app keeps the last
 *   successful response in localStorage and clearly labels it as offline data,
 *   so the "Last updated" time always stays truthful.
 */
const VERSION = 'skycast-v2';
const SHELL = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/api.js',
  './js/i18n.js',
  './js/weather.js',
  './js/sky.js',
  './js/chart.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Same-origin app shell: stale-while-revalidate.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.open(VERSION).then(async (cache) => {
        const cached = await cache.match(request, { ignoreSearch: true });
        const network = fetch(request)
          .then((res) => { if (res.ok) cache.put(request, res.clone()); return res; })
          .catch(() => cached || (request.mode === 'navigate' ? cache.match('./index.html') : Response.error()));
        return cached || network;
      }),
    );
    return;
  }

  // Google Fonts: cache-first.
  if (url.hostname.endsWith('fonts.googleapis.com') || url.hostname.endsWith('fonts.gstatic.com')) {
    event.respondWith(
      caches.open(`${VERSION}-fonts`).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const res = await fetch(request);
        if (res.ok || res.type === 'opaque') cache.put(request, res.clone());
        return res;
      }),
    );
  }
  // Everything else (weather APIs) goes straight to the network.
});
