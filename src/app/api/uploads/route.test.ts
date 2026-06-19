import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests for the owner-gated upload route. Auth + filesystem are mocked so the
 * validation logic (auth gate, file presence, size, mime type) is exercised
 * without writing to disk or needing a DB.
 */

const requireRole = vi.fn();
const writeFile = vi.fn();
const mkdir = vi.fn();

vi.mock("@/lib/auth", () => ({
  requireRole: (...args: unknown[]) => requireRole(...args),
}));

vi.mock("node:fs/promises", () => ({
  writeFile: (...args: unknown[]) => writeFile(...args),
  mkdir: (...args: unknown[]) => mkdir(...args),
}));

async function importRoute() {
  return import("./route");
}

function formRequest(file: File | null): Request {
  const fd = new FormData();
  if (file) fd.set("file", file);
  return new Request("http://localhost/api/uploads", {
    method: "POST",
    body: fd,
  });
}

describe("POST /api/uploads", () => {
  beforeEach(() => {
    requireRole.mockReset();
    writeFile.mockReset();
    mkdir.mockReset();
    requireRole.mockResolvedValue({ id: "u1", role: "OWNER" });
    writeFile.mockResolvedValue(undefined);
    mkdir.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("requires the OWNER role", async () => {
    const { POST } = await importRoute();
    const png = new File([new Uint8Array([1, 2, 3])], "a.png", {
      type: "image/png",
    });
    await POST(formRequest(png));
    expect(requireRole).toHaveBeenCalledWith("OWNER");
  });

  it("rejects a request with no file (400)", async () => {
    const { POST } = await importRoute();
    const res = await POST(formRequest(null));
    expect(res.status).toBe(400);
  });

  it("rejects an unsupported mime type (415)", async () => {
    const { POST } = await importRoute();
    const bad = new File([new Uint8Array([1])], "a.txt", {
      type: "text/plain",
    });
    const res = await POST(formRequest(bad));
    expect(res.status).toBe(415);
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("rejects an empty file (400)", async () => {
    const { POST } = await importRoute();
    const empty = new File([], "a.png", { type: "image/png" });
    const res = await POST(formRequest(empty));
    expect(res.status).toBe(400);
  });

  it("writes a png and returns a public /uploads URL (201)", async () => {
    const { POST } = await importRoute();
    const png = new File([new Uint8Array([1, 2, 3, 4])], "a.png", {
      type: "image/png",
    });
    const res = await POST(formRequest(png));
    expect(res.status).toBe(201);
    const body = (await res.json()) as { url: string };
    expect(body.url).toMatch(/^\/uploads\/\d+-[0-9a-f]+\.png$/);
    expect(writeFile).toHaveBeenCalledOnce();
  });

  it("maps jpeg to a .jpg extension", async () => {
    const { POST } = await importRoute();
    const jpg = new File([new Uint8Array([1, 2])], "a.jpg", {
      type: "image/jpeg",
    });
    const res = await POST(formRequest(jpg));
    const body = (await res.json()) as { url: string };
    expect(body.url).toMatch(/\.jpg$/);
  });
});
