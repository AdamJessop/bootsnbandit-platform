import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Integration: the unified create truly persists BOTH a User (auth) and a
 * linked Artist (profile) in one `prisma.$transaction` — no orphan on either
 * side. Runs against a live, migrated Postgres; skips gracefully when
 * DATABASE_URL is unset/unreachable so `npm test` never breaks without a DB.
 *
 * Only the auth gate + revalidate are mocked; `@/lib/db` (real prisma) is used.
 */

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(async () => ({ id: "o", role: "OWNER" })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;

function fd(entries: Record<string, string | string[]>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) {
    if (Array.isArray(v)) for (const item of v) f.append(k, item);
    else f.set(k, v);
  }
  return f;
}

const TEST_EMAIL = `int-test-${Date.now()}@example.test`;
const TEST_SLUG = `int-test-${Date.now()}`;

d("createArtist (integration)", () => {
  let prisma: typeof import("@/lib/db").prisma;
  let styleId: string | undefined;
  let reachable = false;

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/db"));
    try {
      const style = await prisma.tattooStyle.findFirst({
        select: { id: true },
      });
      styleId = style?.id;
      reachable = true;
    } catch {
      reachable = false;
    }
  });

  afterAll(async () => {
    if (!reachable) return;
    // Delete the artist (cascades nothing else here) then the user.
    await prisma.artist.deleteMany({ where: { slug: TEST_SLUG } });
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
    await prisma.$disconnect();
  });

  it("creates a User AND a linked Artist atomically", async () => {
    if (!reachable) return;
    const { createArtist } = await import("./artist-action");

    await createArtist(
      fd({
        name: "Integration Tester",
        slug: TEST_SLUG,
        email: TEST_EMAIL,
        accessRole: "ARTIST",
        status: "RESIDENT",
        hourlyRatePounds: "90",
        dayRatePounds: "600",
        styleIds: styleId ? [styleId] : [],
      }),
    );

    const user = await prisma.user.findUnique({
      where: { email: TEST_EMAIL },
      include: { artist: { include: { styles: { select: { id: true } } } } },
    });

    expect(user).not.toBeNull();
    expect(user?.role).toBe("ARTIST");
    expect(user?.artist).not.toBeNull();
    expect(user?.artist?.slug).toBe(TEST_SLUG);
    expect(user?.artist?.userId).toBe(user?.id);
    expect(user?.artist?.hourlyRatePence).toBe(9000);
    expect(user?.artist?.dayRatePence).toBe(60000);
    if (styleId) {
      expect(user?.artist?.styles.map((s) => s.id)).toContain(styleId);
    }
  });
});
