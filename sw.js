const CACHE = 'olas-pwa-v2';
const CORE = [
  './', './index.html', './css/style.css', './js/data.js', './js/main.js',
  './fonts.css', './vendor/maplibre-gl.js', './vendor/maplibre-gl.css',
  './logo.webp', './manifest.webmanifest',
  './icons/icon-any-192.png', './icons/icon-any-512.png',
  './icons/icon-maskable-192.png', './icons/icon-maskable-512.png',
  './fonts/rP2Wp2ywxg089UriCZaSExdy3sGt9zz86GPwyKy58Q.woff2',
  './fonts/rP2Wp2ywxg089UriCZaSExdy3sGt9zz86GPwyKK58VXh.woff2',
  './fonts/rP2Hp2ywxg089UriCZOIHQ.woff2',
  './fonts/rP2Hp2ywxg089UriCZ2IHSeH.woff2',
  './fonts/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKeiunDZbtPY_Q.woff2',
  './fonts/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKeiunDXbtM.woff2',
  './fonts/nuFRD-vYSZviVYUb_rj3ij__anPXDTnCjmHKM4nYO7KN_naUXt_A-W2r.woff2',
  './fonts/nuFRD-vYSZviVYUb_rj3ij__anPXDTnCjmHKM4nYO7KN_naUXtHA-Q.woff2'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || req.headers.has('range') || /\.(mp4|webm)$/i.test(url.pathname)) return;
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).then(response => {
      if (response.ok) caches.open(CACHE).then(cache => cache.put(req, response.clone()));
      return response;
    }).catch(async () => (await caches.match(req)) || (await caches.match('./')) || caches.match('./index.html')));
    return;
  }
  event.respondWith(caches.match(req, { ignoreSearch: true }).then(cached => cached || fetch(req).then(response => {
    if (response.ok && response.type === 'basic') caches.open(CACHE).then(cache => cache.put(req, response.clone()));
    return response;
  })));
});
