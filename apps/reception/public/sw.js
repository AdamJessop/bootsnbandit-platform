/* Boots 'n' Bandit Front Desk — service worker (PWA install + offline page).
 *
 * Strategy:
 *  - Precache a static offline page (no customer data) on install.
 *  - Navigations (HTML): network-only, falling back to the offline page when
 *    the network fails. The board HTML is NEVER cached: it is authenticated
 *    and carries customer names, phone numbers and consent status, and a
 *    shared tablet's cache must not keep a copy of it.
 *  - Immutable static assets ONLY (scripts, styles, images, fonts):
 *    stale-while-revalidate.
 *  - EVERYTHING else — API, non-GET, and crucially Next.js RSC data fetches
 *    (router.refresh() payloads, destination "") — goes straight to the
 *    network and is never cached. Caching RSC payloads made every board
 *    refresh one mutation stale, and they carry the same customer data as the
 *    page.
 */

const VERSION = "bnb-reception-v3";
const SHELL_CACHE = `${VERSION}-shell`;
const RUNTIME_CACHE = `${VERSION}-runtime`;
const OFFLINE_URL = "/offline.html";
const PRECACHE = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/bb-logo.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

// Activating a new version deletes every older cache — including v2's
// runtime cache, which held copies of the authenticated board page.
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

  // HTML navigations: network-only; the static offline page when it fails.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const offline = await caches.match(OFFLINE_URL);
        return offline || Response.error();
      }),
    );
    return;
  }

  // Anything that isn't an immutable static asset (e.g. RSC data fetches,
  // which arrive as GET with destination "") must always hit the network.
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
