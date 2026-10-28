// Service worker do Capelota: deixa o app abrir sem internet.
// Os dados do banco compartilhado têm cache próprio do Firebase; aqui só guardamos a "casca" do app.
const VERSION = 'capelota-v30';
const SHELL = [
  './', './index.html', './style.css', './app.js', './store.js', './calc.js', './live.js', './caixa.js', './firebase-config.js',
  './manifest.webmanifest', './icons/logo-256.png', './icons/logo-512.png', './icons/icon-192.png', './icons/favicon-64.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

const CACHEABLE_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'www.gstatic.com', 'cdnjs.cloudflare.com'];

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const same = url.origin === self.location.origin;
  if (!same && !CACHEABLE_HOSTS.includes(url.hostname)) return; // Firestore, Auth etc. passam direto
  if (!same && url.hostname === 'www.gstatic.com' && !url.pathname.startsWith('/firebasejs/')) return;
  if (same) {
    // arquivos do app: sempre tenta a versão mais nova; sem internet, usa a guardada
    e.respondWith(caches.open(VERSION).then(async cache => {
      try {
        const res = await fetch(req, { cache: 'no-cache' });
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      } catch (err) {
        return (await cache.match(req, { ignoreSearch: true })) || Response.error();
      }
    }));
    return;
  }
  // fontes e SDK do Firebase: cache primeiro
  e.respondWith(caches.open(VERSION).then(async cache => {
    const cached = await cache.match(req);
    if (cached) return cached;
    const res = await fetch(req);
    if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
    return res;
  }));
});
