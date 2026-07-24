/**
 * Regression tests for the kiosk service worker's fetch routing
 * (public/sw.js — a classic SW script with no exports, so we evaluate it in
 * a mocked service-worker global scope and dispatch synthetic fetch events).
 *
 * The bug these guard against: the SW served stale-while-revalidate for EVERY
 * same-origin GET, including Next.js RSC data fetches (router.refresh()), so
 * the board was always one mutation behind — staff check-in needed two taps
 * and checked-in customers vanished from the home board.
 */
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const source = readFileSync(
  path.join(__dirname, "..", "public", "sw.js"),
  "utf8",
);

const ORIGIN = "https://reception.example.com";

type Listener = (event: unknown) => void;

function loadWorker() {
  const listeners: Record<string, Listener> = {};
  const scope = {
    location: new URL(ORIGIN),
    addEventListener: (type: string, fn: Listener) => {
      listeners[type] = fn;
    },
    skipWaiting: () => {},
    clients: { claim: () => {} },
  };
  const caches = {
    open: vi.fn(async () => ({ addAll: async () => {}, put: async () => {} })),
    match: vi.fn(async () => undefined),
    keys: vi.fn(async () => []),
  };
  const fetchMock = vi.fn(async () => new Response("net", { status: 200 }));
  // Evaluating our own repo's sw.js source — no untrusted input involved.
  new Function("self", "caches", "fetch", source)(scope, caches, fetchMock);
  return { listeners };
}

function fireFetch(
  listeners: Record<string, Listener>,
  opts: { method?: string; url: string; mode?: string; destination?: string },
): boolean {
  let responded = false;
  listeners.fetch({
    request: {
      method: opts.method ?? "GET",
      url: opts.url,
      mode: opts.mode ?? "cors",
      destination: opts.destination ?? "",
      clone: () => ({}),
    },
    respondWith: () => {
      responded = true;
    },
    waitUntil: () => {},
  });
  return responded;
}

describe("kiosk service worker fetch routing", () => {
  it("never intercepts RSC data fetches (GET, destination '') — always network", () => {
    const { listeners } = loadWorker();
    expect(fireFetch(listeners, { url: `${ORIGIN}/?_rsc=abc123` })).toBe(false);
  });

  it("never intercepts API or non-GET requests", () => {
    const { listeners } = loadWorker();
    expect(fireFetch(listeners, { url: `${ORIGIN}/api/health` })).toBe(false);
    expect(fireFetch(listeners, { method: "POST", url: `${ORIGIN}/` })).toBe(
      false,
    );
  });

  it("handles navigations (network-first shell)", () => {
    const { listeners } = loadWorker();
    expect(
      fireFetch(listeners, {
        url: `${ORIGIN}/`,
        mode: "navigate",
        destination: "document",
      }),
    ).toBe(true);
  });

  it("serves immutable static assets stale-while-revalidate", () => {
    const { listeners } = loadWorker();
    expect(
      fireFetch(listeners, {
        url: `${ORIGIN}/_next/static/chunks/main.js`,
        destination: "script",
      }),
    ).toBe(true);
    expect(
      fireFetch(listeners, { url: `${ORIGIN}/bb-logo.png`, destination: "image" }),
    ).toBe(true);
  });
});
