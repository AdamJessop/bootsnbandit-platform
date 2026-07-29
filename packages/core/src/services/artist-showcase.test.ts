import { afterAll, describe, expect, it } from "vitest";
import { loadArtistShowcase } from "./artist-showcase";
import { closeTestDb, dbReachable, testDb, uid } from "./testdb";

const db = () => testDb();

describe("loadArtistShowcase (DB)", () => {
  const galleryIds: string[] = [];
  const artistIds: string[] = [];
  const userIds: string[] = [];

  afterAll(async () => {
    if (await dbReachable()) {
      if (galleryIds.length)
        await db().galleryItem.deleteMany({
          where: { id: { in: galleryIds } },
        });
      if (artistIds.length)
        await db().artist.deleteMany({ where: { id: { in: artistIds } } });
      if (userIds.length)
        await db().user.deleteMany({ where: { id: { in: userIds } } });
    }
    await closeTestDb();
  });

  it("returns profile fields and only imaged gallery items in sortOrder", async () => {
    if (!(await dbReachable())) return;
    const artist = await db().artist.findFirstOrThrow({
      orderBy: { sortOrder: "asc" },
      include: { styles: { select: { name: true } } },
    });
    const mk = async (data: {
      image: string | null;
      sortOrder: number;
      featured?: boolean;
    }) => {
      const row = await db().galleryItem.create({
        data: {
          artistId: artist.id,
          title: `Showcase ${uid()}`,
          style: "Blackwork",
          placement: "Forearm",
          ...data,
        },
      });
      galleryIds.push(row.id);
      return row;
    };
    const second = await mk({ image: "https://img.test/b.jpg", sortOrder: 90 });
    const first = await mk({
      image: "https://img.test/a.jpg",
      sortOrder: 80,
      featured: true,
    });
    await mk({ image: null, sortOrder: 70 }); // hidden: no uploaded photo

    const showcase = await loadArtistShowcase(artist.id);

    expect(showcase).not.toBeNull();
    expect(showcase?.artist.id).toBe(artist.id);
    expect(showcase?.artist.name).toBe(artist.name);
    expect(showcase?.artist.status).toBe(artist.status);
    expect(showcase?.artist.bio).toBe(artist.bio);
    expect(showcase?.artist.styles).toEqual(artist.styles.map((s) => s.name));
    expect(showcase?.artist.specials).toEqual(artist.specials);
    expect(showcase?.artist.insta).toBe(artist.insta);
    expect(showcase?.artist.headshot).toBe(artist.headshot);

    const ours = showcase?.gallery.filter((g) => galleryIds.includes(g.id));
    expect(ours?.map((g) => g.id)).toEqual([first.id, second.id]);
    expect(ours?.[0]?.image).toBe("https://img.test/a.jpg");
    expect(ours?.[0]?.featured).toBe(true);
    expect(ours?.[0]?.style).toBe("Blackwork");
    expect(ours?.[0]?.placement).toBe("Forearm");
    expect(showcase?.gallery.every((g) => g.image !== null)).toBe(true);
  });

  it("returns null for an unknown artist id", async () => {
    if (!(await dbReachable())) return;
    expect(await loadArtistShowcase("nope-no-such-artist")).toBeNull();
  });

  it("returns null for an inactive artist", async () => {
    if (!(await dbReachable())) return;
    const tag = uid();
    const user = await db().user.create({
      data: { email: `showcase-${tag}@test.local`, displayName: "Gone" },
    });
    userIds.push(user.id);
    const artist = await db().artist.create({
      data: {
        slug: `gone-${tag}`,
        userId: user.id,
        name: "Gone Artist",
        active: false,
      },
    });
    artistIds.push(artist.id);

    expect(await loadArtistShowcase(artist.id)).toBeNull();
  });
});
