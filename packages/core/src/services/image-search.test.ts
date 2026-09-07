import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildInspirationQuery,
  clearInspirationCache,
  findStudioMatches,
  googleCseProvider,
  providerFromEnv,
  searchInspiration,
  type ImageSearchProvider,
} from "./image-search";
import { closeTestDb, dbReachable, testDb, uid } from "./testdb";

describe("buildInspirationQuery", () => {
  it("joins description, styles, colour and appends tattoo", () => {
    expect(
      buildInspirationQuery({
        description: "  Peony   wrapping the forearm ",
        styles: ["Fine-line", "Dotwork & Geometric"],
        colour: "bw",
      }),
    ).toBe(
      "peony wrapping the forearm fine-line dotwork and geometric black and grey tattoo",
    );
  });
  it("does not double up tattoo, handles empty brief, caps length", () => {
    expect(
      buildInspirationQuery({
        description: "snake tattoo",
        styles: [],
        colour: null,
      }),
    ).toBe("snake tattoo");
    expect(
      buildInspirationQuery({ description: "", styles: [], colour: "colour" }),
    ).toBe("colour tattoo");
    const long = buildInspirationQuery({
      description: "x".repeat(500),
      styles: [],
      colour: null,
    });
    expect(long.length).toBeLessThanOrEqual(200);
  });
});

describe("googleCseProvider", () => {
  const payload = {
    items: [
      {
        title: "Peony",
        link: "https://img.test/a.jpg",
        image: {
          thumbnailLink: "https://t.test/a.jpg",
          contextLink: "https://page.test/a",
          width: 800,
          height: 1200,
        },
      },
      { title: "No image block", link: "https://img.test/b.jpg" },
    ],
    queries: { nextPage: [{ startIndex: 11 }] },
  };
  it("calls the CSE endpoint with image search params and maps results", async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify(payload), { status: 200 }),
    );
    const p = googleCseProvider({
      key: "K",
      cx: "CX",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const page = await p.search("peony tattoo", 1);
    const url = new URL((fetchImpl.mock.calls[0] as unknown as [string])[0]);
    expect(url.searchParams.get("searchType")).toBe("image");
    expect(url.searchParams.get("safe")).toBe("active");
    expect(url.searchParams.get("q")).toBe("peony tattoo");
    expect(url.searchParams.get("start")).toBe("1");
    expect(page.results).toEqual([
      {
        url: "https://img.test/a.jpg",
        thumbUrl: "https://t.test/a.jpg",
        sourceUrl: "https://page.test/a",
        title: "Peony",
        width: 800,
        height: 1200,
      },
      {
        url: "https://img.test/b.jpg",
        thumbUrl: null,
        sourceUrl: null,
        title: "No image block",
        width: null,
        height: null,
      },
    ]);
    expect(page.nextStart).toBe(11);
  });
  it("throws a clean error on non-200 without leaking the key", async () => {
    const fetchImpl = vi.fn(async () => new Response("quota", { status: 429 }));
    const p = googleCseProvider({
      key: "SECRET",
      cx: "CX",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await expect(p.search("x", 1)).rejects.toThrow(/429/);
    await expect(p.search("x", 1)).rejects.not.toThrow(/SECRET/);
  });
  it("providerFromEnv is null unless both vars are set", () => {
    expect(providerFromEnv({} as NodeJS.ProcessEnv)).toBeNull();
    expect(
      providerFromEnv({ GOOGLE_CSE_KEY: "k" } as NodeJS.ProcessEnv),
    ).toBeNull();
    expect(
      providerFromEnv({
        GOOGLE_CSE_KEY: "k",
        GOOGLE_CSE_CX: "c",
      } as NodeJS.ProcessEnv)?.name,
    ).toBe("google-cse");
  });
});

describe("searchInspiration", () => {
  const studio = vi.fn(async () => []);
  beforeEach(() => {
    clearInspirationCache();
    studio.mockClear();
  });

  it("returns studio + web, caches the web page by query+start", async () => {
    const search = vi.fn(async () => ({
      results: [
        {
          url: "https://i/1.jpg",
          thumbUrl: null,
          sourceUrl: null,
          title: null,
          width: null,
          height: null,
        },
      ],
      nextStart: 11,
    }));
    const provider: ImageSearchProvider = { name: "stub", search };
    const brief = {
      description: "peony",
      styles: ["Fine-line"],
      colour: null as null,
    };
    const a = await searchInspiration(brief, { provider, findStudio: studio });
    const b = await searchInspiration(brief, { provider, findStudio: studio });
    expect(a.web).toHaveLength(1);
    expect(a.providerConfigured).toBe(true);
    expect(a.nextStart).toBe(11);
    expect(search).toHaveBeenCalledTimes(1);
    expect(b.web).toEqual(a.web);
    expect(studio).toHaveBeenCalledTimes(2); // studio is never cached
  });
  it("only queries the studio gallery on the first page", async () => {
    const provider: ImageSearchProvider = {
      name: "stub",
      search: async () => ({ results: [], nextStart: null }),
    };
    await searchInspiration(
      { description: "peony", styles: [], colour: null, start: 11 },
      { provider, findStudio: studio },
    );
    expect(studio).not.toHaveBeenCalled();
  });
  it("degrades when the provider is missing or throws", async () => {
    const none = await searchInspiration(
      { description: "peony", styles: [], colour: null },
      { provider: null, findStudio: studio },
    );
    expect(none).toMatchObject({
      web: [],
      providerConfigured: false,
      webError: false,
      nextStart: null,
    });
    const bad: ImageSearchProvider = {
      name: "bad",
      search: async () => {
        throw new Error("boom");
      },
    };
    const err = await searchInspiration(
      { description: "peony", styles: [], colour: null },
      { provider: bad, findStudio: studio },
    );
    expect(err).toMatchObject({
      web: [],
      providerConfigured: true,
      webError: true,
    });
  });
  it("expires cache entries after the TTL", async () => {
    let t = 0;
    const search = vi.fn(async () => ({ results: [], nextStart: null }));
    const provider: ImageSearchProvider = { name: "stub", search };
    const brief = { description: "ttl", styles: [], colour: null as null };
    await searchInspiration(brief, {
      provider,
      findStudio: studio,
      now: () => t,
    });
    t = 11 * 60_000;
    await searchInspiration(brief, {
      provider,
      findStudio: studio,
      now: () => t,
    });
    expect(search).toHaveBeenCalledTimes(2);
  });
});

describe("findStudioMatches (DB)", () => {
  const ids: string[] = [];
  afterAll(async () => {
    if ((await dbReachable()) && ids.length)
      await testDb().galleryItem.deleteMany({ where: { id: { in: ids } } });
    await closeTestDb();
  });
  it("returns imaged items for the chosen styles, description keyword hits first", async () => {
    if (!(await dbReachable())) return;
    const tag = uid("mb");
    const mk = async (title: string, style: string, image: string | null) => {
      const r = await testDb().galleryItem.create({
        data: { title: `${title} ${tag}`, style, image, sortOrder: 9000 },
      });
      ids.push(r.id);
      return r;
    };
    const peony = await mk(
      "Peony sleeve",
      "Fine-line",
      "https://img.test/peony.jpg",
    );
    const snake = await mk("Snake", "Fine-line", "https://img.test/snake.jpg");
    await mk("No image", "Fine-line", null);
    await mk("Other style", "Realism", "https://img.test/real.jpg");
    const res = await findStudioMatches(
      { description: `peony ${tag}`, styles: ["Fine-line"], colour: null },
      50,
    );
    const got = res.filter((r) => r.title.includes(tag));
    expect(got.map((r) => r.galleryItemId)).toEqual([peony.id, snake.id]);
    expect(got[0].sourceUrl).toBe("/gallery");
  });
});
