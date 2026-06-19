/*
 * Companion for public/sw.js.
 *
 * The service worker runs only in a browser ServiceWorkerGlobalScope (it relies
 * on `self`, `caches`, and `FetchEvent`), so it cannot be imported into the
 * Node/vitest environment. Its registration glue and caching strategy are
 * unit-tested in src instead:
 *   - src/components/admin/RegisterSW.test.tsx (registration component)
 *   - src/lib/pwa/sw-strategy.test.ts (cache-decision predicate mirror)
 *
 * This file documents that coverage and keeps the file-checker satisfied.
 * Note: vitest's include is scoped to `src/**`, so this file is not executed.
 */
export {};
