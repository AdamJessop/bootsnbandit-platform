// Boots 'n' Bandit admin PWA service worker — Phase 1 stub.
// Phase 3 finalizes the offline app-shell caching strategy (see the
// sw-strategy module that relocates into apps/admin). For now this is a no-op
// pass-through worker so registration succeeds and the app is installable.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Network passthrough (no caching yet).
});
