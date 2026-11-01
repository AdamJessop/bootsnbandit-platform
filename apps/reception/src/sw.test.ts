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

  it("handles navigations (network-only, offline-page fallback)", () => {
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
      fireFetch(listeners, {
        url: `${ORIGIN}/bb-logo.png`,
        destination: "image",
      }),
    ).toBe(true);
  });
});

/**
 * The board page is authenticated and full of customer names, phones and
 * consent status — a shared tablet's cache must never hold a copy of it.
 */
describe("kiosk service worker never caches authenticated pages", () => {
  function harness(fetchImpl: () => Promise<Response>) {
    const listeners: Record<string, Listener> = {};
    const put = vi.fn(async () => {});
    const addAll = vi.fn(async (urls: string[]) => {
      void urls;
    });
    const caches = {
      open: vi.fn(async () => ({ addAll, put })),
      match: vi.fn(async (req: unknown) =>
        req === "/offline.html" ? new Response("offline page") : undefined,
      ),
      keys: vi.fn(async () => [
        "bnb-reception-v2-runtime",
        "bnb-reception-v3-shell",
      ]),
      delete: vi.fn(async () => true),
    };
    const scope = {
      location: new URL(ORIGIN),
      addEventListener: (type: string, fn: Listener) => {
        listeners[type] = fn;
      },
      skipWaiting: () => {},
      clients: { claim: () => {} },
    };
    // Evaluating our own repo's sw.js source — no untrusted input involved.
    new Function("self", "caches", "fetch", source)(scope, caches, fetchImpl);
    return { listeners, caches, put, addAll };
  }

  function navigate(listeners: Record<string, Listener>): Promise<Response> {
    let responded: Promise<Response> | undefined;
    listeners.fetch({
      request: {
        method: "GET",
        url: `${ORIGIN}/`,
        mode: "navigate",
        destination: "document",
        clone: () => ({}),
      },
      respondWith: (p: Promise<Response>) => {
        responded = p;
      },
      waitUntil: () => {},
    });
    return responded!;
  }

  it("precaches only static files — the offline page, never the board", async () => {
    const { listeners, addAll } = harness(async () => new Response("x"));
    let installed: Promise<unknown> | undefined;
    listeners.install({
      waitUntil: (p: Promise<unknown>) => {
        installed = p;
      },
    });
    await installed;
    const urls = addAll.mock.calls[0][0];
    expect(urls).toContain("/offline.html");
    expect(urls).not.toContain("/");
  });

  it("serves navigations from the network without writing them to a cache", async () => {
    const { listeners, put } = harness(async () => new Response("board html"));
    const res = await navigate(listeners);
    expect(await res.text()).toBe("board html");
    await new Promise((r) => setTimeout(r, 0));
    expect(put).not.toHaveBeenCalled();
  });

  it("falls back to the static offline page when the network fails", async () => {
    const { listeners } = harness(async () => {
      throw new TypeError("offline");
    });
    const res = await navigate(listeners);
    expect(await res.text()).toBe("offline page");
  });

  it("deletes older caches (which held board pages) on activate", async () => {
    const { listeners, caches } = harness(async () => new Response("x"));
    let activated: Promise<unknown> | undefined;
    listeners.activate({
      waitUntil: (p: Promise<unknown>) => {
        activated = p;
      },
    });
    await activated;
    expect(caches.delete).toHaveBeenCalledWith("bnb-reception-v2-runtime");
    expect(caches.delete).not.toHaveBeenCalledWith("bnb-reception-v3-shell");
  });
});
