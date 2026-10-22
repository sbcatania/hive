// Offline cache for the Hive app, so it launches instantly from the home screen and
// CPU / pass-and-play games work without a connection (the engine runs locally).
//
// - Build assets under /_next/static are content-hashed: cache first, forever.
// - Pages: the network if it answers within 450 ms, else the cached copy at once.
// - Other same-origin files (the WASM engine, icons, fonts) aren't hashed: serve the
//   cached copy straight away and refresh it in the background.
// Cross-origin requests (Supabase for online games and accounts) are never cached.

const CACHE = "hive-v1";
const SHELL = ["/", "/play", "/puzzles", "/learn", "/journal"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Pages: take the network if it answers quickly (so a fresh deploy shows up at once),
  // otherwise open the cached copy straight away and let the network refresh the cache
  // for next time. A home-screen launch never waits on a slow connection.
  if (req.mode === "navigate") {
    const network = fetch(req).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    });
    const cached = () => caches.match(req).then((hit) => hit || caches.match(req, { ignoreSearch: true })).then((hit) => hit || caches.match("/"));
    const late = new Promise((resolve) => setTimeout(resolve, 450)).then(cached);
    event.respondWith(
      Promise.race([network.catch(() => null), late]).then(async (res) => res || (await network.catch(() => null)) || (await cached()) || Response.error()),
    );
    event.waitUntil(network.catch(() => {}));
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
            return res;
          }),
      ),
    );
    return;
  }

  // Next's client-side navigation data (RSC payloads) must stay fresh.
  if (url.searchParams.has("_rsc") || req.headers.get("RSC")) return;

  event.respondWith(
    caches.match(req).then((hit) => {
      const fresh = fetch(req)
        .then((res) => {
          if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
          return res;
        })
        .catch(() => hit);
      return hit || fresh;
    }),
  );
});
