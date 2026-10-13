// Service worker de Navicam: la app se puede instalar y abrir sin señal,
// pero con conexión SIEMPRE trae la última versión publicada (la red primero).
const CACHE = 'navicam-v1';
const LIBS = ['lib/xlsx.full.min.js', 'lib/jspdf.umd.min.js', 'lib/jspdf.plugin.autotable.min.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(['./', 'manifest.webmanifest', 'icons/icono-192.png', ...LIBS])).catch(() => {})); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request; const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;   // Google (datos) nunca pasa por acá
  if (url.pathname.endsWith('version.txt')) return;
  const esLib = LIBS.some(l => url.pathname.endsWith(l)) || url.pathname.includes('/icons/');
  if (esLib) {   // librerías fijas: primero la copia guardada
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => { const c = res.clone(); caches.open(CACHE).then(k => k.put(req, c)); return res; })));
    return;
  }
  // la app (index.html): primero la red, y si no hay señal la última copia
  e.respondWith(fetch(req, { cache: 'no-store' }).then(res => {
    if (res.ok) { const c = res.clone(); caches.open(CACHE).then(k => k.put(req.mode === 'navigate' ? './' : req, c)); }
    return res;
  }).catch(() => caches.match(req).then(r => r || caches.match('./'))));
});
