import { describe, expect, it } from "vitest";
import { currentBooking, loadDeskArtists, nextBooking } from "./data";

describe("front-desk data module", () => {
  it("re-exports the pure board helpers", () => {
    expect(typeof currentBooking).toBe("function");
    expect(typeof nextBooking).toBe("function");
  });

  it("exposes the server loader", () => {
    expect(typeof loadDeskArtists).toBe("function");
  });
});
