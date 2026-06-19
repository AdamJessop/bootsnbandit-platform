import { describe, expect, it } from "vitest";
import { resolveActiveArtist, type ArtistLite } from "./data";
import type { SessionUser } from "@/lib/auth";

const artists: ArtistLite[] = [
  {
    id: "a1",
    name: "Boots",
    hue: null,
    booksStatus: "open",
    hourlyRatePence: 9000,
    dayRatePence: 55000,
  },
  {
    id: "a2",
    name: "Bandit",
    hue: null,
    booksStatus: "open",
    hourlyRatePence: null,
    dayRatePence: null,
  },
];

const owner: SessionUser = {
  id: "u1",
  email: "o@x.com",
  role: "OWNER",
  displayName: "Owner",
  artistId: null,
};
const artist: SessionUser = {
  id: "u2",
  email: "a@x.com",
  role: "ARTIST",
  displayName: "Artist",
  artistId: "a2",
};

describe("resolveActiveArtist", () => {
  it("owner honours a valid requested artist", () => {
    expect(resolveActiveArtist(owner, artists, "a2")).toBe("a2");
  });

  it("owner falls back to the first artist when request is invalid", () => {
    expect(resolveActiveArtist(owner, artists, "nope")).toBe("a1");
    expect(resolveActiveArtist(owner, artists)).toBe("a1");
  });

  it("artist is pinned to their own artistId regardless of request", () => {
    expect(resolveActiveArtist(artist, artists, "a1")).toBe("a2");
  });
});
