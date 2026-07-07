import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests for the owner-gated upload route. Auth + filesystem are mocked so the
 * validation logic (auth gate, file presence, size, mime type) is exercised
 * without writing to disk or needing a DB.
 */

const requireRole = vi.fn();
const writeFile = vi.fn();
const mkdir = vi.fn();

vi.mock("@bnb/core/auth", () => ({
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

// Real magic-number headers so the byte-sniffing validator accepts them.
const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
]);
const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

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
    const png = new File([PNG_BYTES], "a.png", {
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
    const png = new File([PNG_BYTES], "a.png", {
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
    const jpg = new File([JPEG_BYTES], "a.jpg", {
      type: "image/jpeg",
    });
    const res = await POST(formRequest(jpg));
    const body = (await res.json()) as { url: string };
    expect(body.url).toMatch(/\.jpg$/);
  });

  it("rejects an SVG upload (stored-XSS vector) with 415", async () => {
    const { POST } = await importRoute();
    const svg = new File(
      [
        '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
      ],
      "x.svg",
      { type: "image/svg+xml" },
    );
    const res = await POST(formRequest(svg));
    expect(res.status).toBe(415);
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("rejects an SVG payload spoofing image/png content-type (415)", async () => {
    const { POST } = await importRoute();
    // Client lies: claims PNG but the bytes are an SVG/HTML document.
    const spoof = new File(
      [
        '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
      ],
      "evil.png",
      { type: "image/png" },
    );
    const res = await POST(formRequest(spoof));
    expect(res.status).toBe(415);
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("rejects a PNG whose bytes are not actually a PNG (415)", async () => {
    const { POST } = await importRoute();
    const fake = new File([new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])], "a.png", {
      type: "image/png",
    });
    const res = await POST(formRequest(fake));
    expect(res.status).toBe(415);
    expect(writeFile).not.toHaveBeenCalled();
  });
});
