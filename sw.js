// Service Worker für Imagiclique: Offline-Betrieb und Annahme geteilter Fotos (Web Share Target).
const VERSION = 'v5';
const SHELL_CACHE = 'imagiclique-shell-' + VERSION;
const CDN_CACHE = 'imagiclique-cdn';
const SHARED_CACHE = 'imagiclique-shared';   // muss zu index.html passen
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'vendor/mp4-muxer.min.js', 'vendor/josefin-sans-latin-700-normal.woff2', 'marke/zauber-auf-dunkel.png', 'marke/zauber-auf-hell.png'];
const CDN_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL_CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) {
      if (k.startsWith('imagiclique-shell-') && k !== SHELL_CACHE) await caches.delete(k);
    }
    await self.clients.claim();
  })());
});

// Android „Teilen → Imagiclique“: Fotos zwischenspeichern, dann die App öffnen.
async function receiveShare(request) {
  try {
    const form = await request.formData();
    await caches.delete(SHARED_CACHE);
    const cache = await caches.open(SHARED_CACHE);
    let i = 0;
    for (const f of form.getAll('photos')) {
      if (!(f instanceof File)) continue;
      await cache.put(`shared/${i++}`, new Response(f, { headers: { 'Content-Type': f.type || 'image/jpeg' } }));
    }
    const text = [form.get('title'), form.get('text')].filter(v => typeof v === 'string' && v.trim()).join('\n');
    if (text) await cache.put('shared/meta', new Response(JSON.stringify({ text }), { headers: { 'Content-Type': 'application/json' } }));
  } catch (err) { /* App trotzdem öffnen */ }
  return Response.redirect('./?shared=1', 303);
}

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);

  if (req.method === 'POST' && url.origin === location.origin && url.pathname.endsWith('/share-target')) {
    e.respondWith(receiveShare(req));
    return;
  }
  if (req.method !== 'GET') return;

  // Eigene Dateien: erst Netz (immer aktueller Stand), ohne Netz aus dem Cache.
  if (url.origin === location.origin) {
    e.respondWith((async () => {
      const cache = await caches.open(SHELL_CACHE);
      try {
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      } catch (err) {
        return (await cache.match(req, { ignoreSearch: true })) || (await cache.match('index.html')) || Response.error();
      }
    })());
    return;
  }

  // Schriften und exifr: erst Cache, sonst Netz.
  if (CDN_HOSTS.includes(url.hostname)) {
    e.respondWith((async () => {
      const cache = await caches.open(CDN_CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
      return res;
    })());
  }
});
