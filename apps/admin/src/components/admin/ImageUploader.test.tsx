import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  applyUploadedUrl,
  ImageUploader,
  uploadErrorMessage,
  uploadImage,
} from "./ImageUploader";

/**
 * Logic tests for the ImageUploader: the value-merge helper (single vs multi),
 * the upload helper that POSTs to /api/uploads and its error messages.
 */

describe("applyUploadedUrl", () => {
  it("replaces the value in single mode", () => {
    expect(applyUploadedUrl("old.png", "new.png", false)).toBe("new.png");
    expect(applyUploadedUrl(undefined, "new.png", false)).toBe("new.png");
  });

  it("appends to the array in multi mode", () => {
    expect(applyUploadedUrl(["a.png"], "b.png", true)).toEqual([
      "a.png",
      "b.png",
    ]);
    expect(applyUploadedUrl(undefined, "b.png", true)).toEqual(["b.png"]);
    expect(applyUploadedUrl("a.png", "b.png", true)).toEqual([
      "a.png",
      "b.png",
    ]);
  });
});

describe("uploadImage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs the file to /api/uploads and returns the url", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ url: "/media/clx123" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const file = new File([new Uint8Array([1])], "x.png", {
      type: "image/png",
    });
    const url = await uploadImage(file);
    expect(url).toBe("/media/clx123");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/uploads",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("throws with the server error message on failure", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "File too large (max 8MB)" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const file = new File([new Uint8Array([1])], "x.png", {
      type: "image/png",
    });
    await expect(uploadImage(file)).rejects.toThrow("File too large");
  });

  it("explains a proxy's 413 / 415 that has no JSON body", async () => {
    const file = new File([new Uint8Array([1])], "x.png", {
      type: "image/png",
    });
    for (const [status, text] of [
      [413, "too large"],
      [415, "supported image"],
    ] as const) {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status,
          json: async () => {
            throw new SyntaxError("Unexpected token <");
          },
        }),
      );
      await expect(uploadImage(file)).rejects.toThrow(text);
    }
  });
});

describe("uploadErrorMessage", () => {
  it("prefers the server's message, else explains the status", () => {
    expect(uploadErrorMessage(413, "File too large (max 8MB)")).toBe(
      "File too large (max 8MB)",
    );
    expect(uploadErrorMessage(413)).toBe("That image is too large (max 8MB).");
    expect(uploadErrorMessage(415, null)).toMatch(/supported image/);
    expect(uploadErrorMessage(401)).toMatch(/sign in again/);
    expect(uploadErrorMessage(500)).toBe("Upload failed (500)");
  });
});

describe("ImageUploader", () => {
  it("renders the idle drop zone (no spinner, enabled)", () => {
    const html = renderToStaticMarkup(
      <ImageUploader value="" onChange={() => {}} />,
    );
    expect(html).toContain("Upload image");
    expect(html).not.toContain("Uploading…");
    expect(html).not.toContain("disabled");
  });
});
