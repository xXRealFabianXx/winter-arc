/* Winter Arc service worker: the app shell opens instantly (and in the gym basement without signal).
   Pages: network first (fresh version), cached copy if the network is slow or gone.
   Versioned files, images, fonts, three.js: served from cache, refreshed in the background.
   /api/* is never cached here: training data always comes live. */
const CACHE = "wa-shell-1";
const SHELL = ["/"];

self.addEventListener("install", (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {})); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

const cacheable = (u) =>
  (u.origin === self.location.origin && !u.pathname.startsWith("/api/")) ||
  u.hostname === "cdnjs.cloudflare.com" || u.hostname === "fonts.googleapis.com" || u.hostname === "fonts.gstatic.com";

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const u = new URL(req.url);
  if (!cacheable(u)) return;

  if (req.mode === "navigate") {
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      const net = fetch(req).then((r) => { if (r.ok) c.put("/", r.clone()); return r; });
      const timeout = new Promise((res) => setTimeout(res, 2500));
      try {
        const r = await Promise.race([net, timeout]);
        if (r) return r;
      } catch (_) {}
      const hit = await c.match("/");
      return hit || net;
    })());
    return;
  }

  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const hit = await c.match(req);
    const net = fetch(req).then((r) => { if (r && (r.ok || r.type === "opaque")) c.put(req, r.clone()); return r; });
    if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
    return net;
  })());
});
