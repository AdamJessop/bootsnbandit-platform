import { describe, it, expect } from "vitest";
import { artistStatusLabel, ARTIST_STATUS_OPTIONS } from "./artist-status";

describe("artist-status", () => {
  it("maps each status to its display label", () => {
    expect(artistStatusLabel("CO_OWNER")).toBe("Co-owner");
    expect(artistStatusLabel("RESIDENT")).toBe("Resident Artist");
    expect(artistStatusLabel("APPRENTICE")).toBe("Apprentice");
  });
  it("exposes 3 select options", () => {
    expect(ARTIST_STATUS_OPTIONS.map((o) => o.value)).toEqual([
      "CO_OWNER",
      "RESIDENT",
      "APPRENTICE",
    ]);
  });
});
