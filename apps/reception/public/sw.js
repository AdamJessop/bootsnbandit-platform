/* Boots 'n' Bandit Front Desk — service worker (PWA app shell, offline read views).
 *
 * Strategy:
 *  - Precache a minimal offline shell on install.
 *  - Navigations (HTML): network-first, falling back to the last-cached page,
 *    then to the offline shell — so read views work offline.
 *  - Immutable static assets ONLY (scripts, styles, images, fonts):
 *    stale-while-revalidate.
 *  - EVERYTHING else — API, non-GET, and crucially Next.js RSC data fetches
 *    (router.refresh() payloads, destination "") — goes straight to the
 *    network. Caching RSC payloads made every board refresh one mutation
 *    stale: staff toggles needed a second tap and check-ins vanished from
 *    the home board until the next refresh cycle.
 */

const VERSION = "bnb-reception-v2";
const SHELL_CACHE = `${VERSION}-shell`;
const RUNTIME_CACHE = `${VERSION}-runtime`;
const OFFLINE_URL = "/";
const PRECACHE = ["/", "/manifest.webmanifest", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => !k.startsWith(VERSION))
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isApi(url) {
  return url.pathname.startsWith("/api/");
}

/** True only for immutable static assets that are safe to serve stale. */
function isStaticAsset(request, url) {
  if (url.pathname.startsWith("/_next/static/")) return true;
  return ["script", "style", "image", "font"].includes(request.destination);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET; never cache API or write requests.
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (isApi(url)) return;

  // HTML navigations: network-first with cache + offline-shell fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || (await caches.match(OFFLINE_URL));
        }),
    );
    return;
  }

  // Anything that isn't an immutable static asset (e.g. RSC data fetches,
  // which arrive as GET with destination "") must always hit the network —
  // stale board data here breaks kiosk state after mutations.
  if (!isStaticAsset(request, url)) return;

  // Static assets: stale-while-revalidate.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches
              .open(RUNTIME_CACHE)
              .then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
