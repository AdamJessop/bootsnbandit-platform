import { afterEach, describe, expect, it, vi } from "vitest";
import { applyUploadedUrl, uploadImage } from "./ImageUploader";

/**
 * Logic tests for the ImageUploader: the value-merge helper (single vs multi)
 * and the upload helper that POSTs to /api/uploads.
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
      json: async () => ({ url: "/uploads/x.png" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const file = new File([new Uint8Array([1])], "x.png", {
      type: "image/png",
    });
    const url = await uploadImage(file);
    expect(url).toBe("/uploads/x.png");
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
});
