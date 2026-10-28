// Service worker do Capelota: deixa o app abrir sem internet.
// Os dados do banco compartilhado têm cache próprio do Firebase; aqui só guardamos a "casca" do app.
const VERSION = 'capelota-v4';
const SHELL = [
  './', './index.html', './style.css', './app.js', './store.js', './calc.js', './firebase-config.js',
  './manifest.webmanifest', './icons/logo-256.png', './icons/logo-512.png', './icons/icon-192.png', './icons/favicon-64.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

const CACHEABLE_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'www.gstatic.com'];

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const same = url.origin === self.location.origin;
  if (!same && !CACHEABLE_HOSTS.includes(url.hostname)) return; // Firestore, Auth etc. passam direto
  if (!same && url.hostname === 'www.gstatic.com' && !url.pathname.startsWith('/firebasejs/')) return;
  // stale-while-revalidate: abre rápido com o que tem guardado e atualiza por trás
  e.respondWith(caches.open(VERSION).then(async cache => {
    const cached = await cache.match(req, { ignoreSearch: same });
    const net = fetch(req).then(res => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
      return res;
    }).catch(() => cached);
    return cached || net;
  }));
});
