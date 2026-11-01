import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requireRole = vi.fn();
const revalidatePath = vi.fn();
const userCreate = vi.fn();
const artistCreate = vi.fn();
const artistUpdate = vi.fn();
const artistDelete = vi.fn();
const transaction = vi.fn();

vi.mock("@bnb/core/auth", () => ({
  requireRole: (...a: unknown[]) => requireRole(...a),
}));
vi.mock("next/cache", () => ({
  revalidatePath: (...a: unknown[]) => revalidatePath(...a),
}));
vi.mock("@bnb/core/db", () => ({
  prisma: {
    artist: { update: artistUpdate, delete: artistDelete },
    $transaction: (...a: unknown[]) => transaction(...a),
  },
}));

function fd(entries: Record<string, string | string[]>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) {
    if (Array.isArray(v)) for (const item of v) f.append(k, item);
    else f.set(k, v);
  }
  return f;
}

describe("artist CMS actions", () => {
  beforeEach(() => {
    requireRole.mockReset().mockResolvedValue({ id: "o", role: "OWNER" });
    revalidatePath.mockReset();
    userCreate.mockReset().mockResolvedValue({ id: "u-new" });
    artistCreate.mockReset().mockResolvedValue({ id: "a-new" });
    artistUpdate.mockReset().mockResolvedValue({});
    artistDelete.mockReset().mockResolvedValue({});
    // $transaction runs the callback with a tx that exposes the same delegates.
    transaction
      .mockReset()
      .mockImplementation(async (cb: (tx: unknown) => unknown) =>
        cb({ user: { create: userCreate }, artist: { create: artistCreate } }),
      );
  });
  afterEach(() => vi.resetModules());

  it("createArtist creates a User AND a linked Artist atomically in one $transaction", async () => {
    const { createArtist } = await import("./artist-action");
    await createArtist(
      fd({
        name: "Cal",
        email: "cal@bootsnbandit.co.uk",
        accessRole: "OWNER",
        status: "CO_OWNER",
        hourlyRatePounds: "100",
        styleIds: ["s1", "s2"],
      }),
    );

    expect(requireRole).toHaveBeenCalledWith("OWNER");
    expect(transaction).toHaveBeenCalledOnce();

    // User half created with the access role.
    expect(userCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "cal@bootsnbandit.co.uk",
          role: "OWNER",
          displayName: "Cal",
        }),
      }),
    );

    // Artist half created, connected 1:1 to that user + the style relation.
    const arg = artistCreate.mock.calls[0][0] as {
      data: {
        name: string;
        status: string;
        hourlyRatePence: number;
        user: { connect: { id: string } };
        styles: { connect: { id: string }[] };
      };
    };
    expect(arg.data.name).toBe("Cal");
    expect(arg.data.status).toBe("CO_OWNER");
    expect(arg.data.hourlyRatePence).toBe(10000);
    expect(arg.data.user).toEqual({ connect: { id: "u-new" } });
    expect(arg.data.styles).toEqual({ connect: [{ id: "s1" }, { id: "s2" }] });
    expect(revalidatePath).toHaveBeenCalled();
  });

  it("createArtist derives a slug from the name when none is given", async () => {
    const { createArtist } = await import("./artist-action");
    await createArtist(fd({ name: "Jo Blogs", email: "jo@x.test" }));
    const arg = artistCreate.mock.calls[0][0] as { data: { slug: string } };
    expect(arg.data.slug).toBe("jo-blogs");
  });

  it("createArtist requires an email so no orphan artist is created", async () => {
    const { createArtist } = await import("./artist-action");
    expect(await createArtist(fd({ name: "NoEmail" }))).toEqual({
      ok: false,
      error: "Email is required to create the staff account.",
    });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("createArtist / updateArtist refuse a blank name", async () => {
    const { createArtist, updateArtist } = await import("./artist-action");
    expect(
      await createArtist(fd({ name: "  ", email: "x@example.com" })),
    ).toEqual({ ok: false, error: "Name is required." });
    expect(await updateArtist(fd({ id: "a1", name: "" }))).toEqual({
      ok: false,
      error: "Name is required.",
    });
    expect(transaction).not.toHaveBeenCalled();
    expect(artistUpdate).not.toHaveBeenCalled();
  });

  it("createArtist reports a taken email inline instead of throwing", async () => {
    userCreate.mockRejectedValue(
      Object.assign(new Error("Unique constraint failed"), {
        code: "P2002",
        meta: {
          driverAdapterError: { cause: { constraint: { fields: ["email"] } } },
        },
      }),
    );
    const { createArtist } = await import("./artist-action");
    expect(
      await createArtist(fd({ name: "Cal", email: "cal@example.com" })),
    ).toEqual({ ok: false, error: "Another user already has that email." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("updateArtist reports a taken slug inline", async () => {
    artistUpdate.mockRejectedValue(
      Object.assign(new Error("Unique constraint failed"), {
        code: "P2002",
        meta: { target: ["slug"] },
      }),
    );
    const { updateArtist } = await import("./artist-action");
    const res = await updateArtist(fd({ id: "a1", name: "Sarah" }));
    expect(res.ok).toBe(false);
    expect(!res.ok && res.error).toMatch(/already uses that slug/);
  });

  it("still throws unexpected errors to the error boundary", async () => {
    artistDelete.mockRejectedValue(new Error("connection refused"));
    const { deleteArtist } = await import("./artist-action");
    await expect(deleteArtist(fd({ id: "a1" }))).rejects.toThrow(
      "connection refused",
    );
  });

  it("updateArtist sets the style relation, status and numeric rates by id", async () => {
    const { updateArtist } = await import("./artist-action");
    await updateArtist(
      fd({
        id: "a1",
        name: "Sarah",
        status: "RESIDENT",
        hourlyRatePounds: "90",
        dayRatePounds: "600",
        styleIds: ["s3"],
      }),
    );
    expect(artistUpdate).toHaveBeenCalledWith({
      where: { id: "a1" },
      data: expect.objectContaining({
        name: "Sarah",
        status: "RESIDENT",
        hourlyRatePence: 9000,
        dayRatePence: 60000,
        styles: { set: [{ id: "s3" }] },
      }),
    });
  });

  it("deleteArtist removes the artist row", async () => {
    const { deleteArtist } = await import("./artist-action");
    expect(await deleteArtist(fd({ id: "a1" }))).toEqual({ ok: true });
    expect(artistDelete).toHaveBeenCalledWith({ where: { id: "a1" } });
  });
});
