import { afterEach, describe, expect, it, vi } from "vitest";

const headerMap = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({
  headers: async () => ({ get: (k: string) => headerMap.get(k) ?? null }),
}));

const { isIndexable, siteIndexable, siteOrigin } =
  await import("./site-origin");

const env = { ...process.env };
afterEach(() => {
  process.env = { ...env };
  headerMap.clear();
});

describe("siteOrigin", () => {
  it("uses APP_ORIGIN without a trailing slash", () => {
    process.env.APP_ORIGIN = "https://staging.bootsnbandit.com/";
    expect(siteOrigin()).toBe("https://staging.bootsnbandit.com");
  });

  it("falls back to the local dev origin, never a guessed domain", () => {
    delete process.env.APP_ORIGIN;
    expect(siteOrigin()).toBe("http://localhost:3000");
  });
});

describe("isIndexable", () => {
  const prod = "https://bootsnbandit.com";

  it("is not indexable unless PRODUCTION_ORIGIN is set", () => {
    expect(isIndexable({ appOrigin: prod, productionOrigin: undefined })).toBe(
      false,
    );
    expect(isIndexable({ appOrigin: prod, productionOrigin: "" })).toBe(false);
  });

  it("is not indexable on staging, even sharing production's env", () => {
    expect(
      isIndexable({
        appOrigin: "https://staging.bootsnbandit.com",
        productionOrigin: prod,
      }),
    ).toBe(false);
  });

  it("is indexable on the production origin and host", () => {
    expect(
      isIndexable({
        appOrigin: prod,
        productionOrigin: `${prod}/`,
        requestHost: "bootsnbandit.com",
      }),
    ).toBe(true);
  });

  it("is not indexable when the request arrives on another host", () => {
    expect(
      isIndexable({
        appOrigin: prod,
        productionOrigin: prod,
        requestHost: "web-abc123.sslip.io",
      }),
    ).toBe(false);
  });
});

describe("siteIndexable", () => {
  it("reads the env and the forwarded host", async () => {
    process.env.APP_ORIGIN = "https://bootsnbandit.com";
    process.env.PRODUCTION_ORIGIN = "https://bootsnbandit.com";
    headerMap.set("x-forwarded-host", "bootsnbandit.com");
    expect(await siteIndexable()).toBe(true);
    headerMap.set("x-forwarded-host", "staging.bootsnbandit.com");
    expect(await siteIndexable()).toBe(false);
  });
});
