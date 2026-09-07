import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@bnb/core/auth", () => ({ requireRole: vi.fn() }));
const getAttachment = vi.hoisted(() => vi.fn());
vi.mock("@bnb/core/services/assets", () => ({ getAttachment }));

const { requireRole } = await import("@bnb/core/auth");
const { GET } = await import("./route");

const call = (id: string) =>
  GET(new Request(`http://admin.test/api/attachments/${id}`), {
    params: Promise.resolve({ id }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireRole).mockResolvedValue({
    id: "u1",
    email: "o@x",
    role: "OWNER",
    displayName: "Owner",
  } as never);
});

describe("GET /api/attachments/[id]", () => {
  it("requires a signed-in staff user", async () => {
    getAttachment.mockResolvedValue({
      id: "a1",
      mime: "image/png",
      size: 3,
      filename: null,
      url: null,
      hasBytes: true,
      bytes: new Uint8Array([1, 2, 3]),
    });
    await call("a1");
    expect(requireRole).toHaveBeenCalled();
  });

  it("streams inline bytes with the stored mime and immutable caching", async () => {
    getAttachment.mockResolvedValue({
      id: "a1",
      mime: "image/png",
      size: 3,
      filename: "ref.png",
      url: null,
      hasBytes: true,
      bytes: new Uint8Array([1, 2, 3]),
    });
    const res = await call("a1");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toContain("immutable");
    expect(res.headers.get("cache-control")).toContain("private");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-disposition")).toContain("ref.png");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(
      new Uint8Array([1, 2, 3]),
    );
  });

  it("404s for an unknown id and for a link-only attachment", async () => {
    getAttachment.mockResolvedValueOnce(null);
    expect((await call("nope")).status).toBe(404);
    getAttachment.mockResolvedValueOnce({
      id: "a2",
      mime: "application/pdf",
      size: 0,
      filename: "brief.pdf",
      url: "https://files.test/brief.pdf",
      hasBytes: false,
      bytes: null,
    });
    expect((await call("a2")).status).toBe(404);
  });
});
