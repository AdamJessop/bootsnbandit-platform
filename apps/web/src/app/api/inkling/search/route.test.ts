import { beforeEach, describe, expect, it, vi } from "vitest";

const searchInspiration = vi.hoisted(() =>
  vi.fn(async (input: Record<string, unknown>) => ({
    query: "q", studio: [], web: [], nextStart: null, providerConfigured: false, webError: false, input,
  })),
);
vi.mock("@bnb/core/services/image-search", () => ({ searchInspiration }));

const { POST } = await import("./route");

let ip = 0;
function post(body: unknown, pinnedIp?: string) {
  return POST(
    new Request("http://x/api/inkling/search", {
      method: "POST",
      headers: { "x-forwarded-for": pinnedIp ?? `10.1.${++ip}.1`, "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => searchInspiration.mockClear());

describe("POST /api/inkling/search", () => {
  it("runs the search with a normalised brief", async () => {
    const res = await post({ styles: ["Fine-line"], colour: "bw", description: "peony", start: 11 });
    expect(res.status).toBe(200);
    expect(searchInspiration).toHaveBeenCalledWith({ styles: ["Fine-line"], colour: "bw", description: "peony", start: 11 });
  });
  it("400s when there is neither a style nor a description", async () => {
    expect((await post({ description: "  " })).status).toBe(400);
    expect((await post({ styles: [], description: "ab" })).status).toBe(400);
  });
  it("400s on bad shapes", async () => {
    expect((await post({ styles: ["a", "b", "c", "d"], description: "peony" })).status).toBe(400);
    expect((await post({ description: "peony", start: 200 })).status).toBe(400);
  });
  it("429s after 20 hits from one IP", async () => {
    for (let i = 0; i < 20; i++) await post({ description: "peony" }, "9.9.9.9");
    expect((await post({ description: "peony" }, "9.9.9.9")).status).toBe(429);
  });
});
