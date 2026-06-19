import { describe, expect, it } from "vitest";
import {
  draftToFormData,
  emptyDraft,
  fromRow,
  rateCell,
  type ArtistRow,
} from "./artist-draft";

const row: ArtistRow = {
  id: "a1",
  slug: "sarah",
  name: "Sarah",
  status: "CO_OWNER",
  email: "sarah@studio.test",
  accessRole: "OWNER",
  tag: null,
  bio: "Heritage",
  specials: ["Snakes", "Roses"],
  hourlyRatePence: 9000,
  dayRatePence: 60000,
  insta: "@sarah",
  headshot: null,
  hue: null,
  booksStatus: "open",
  sortOrder: 2,
  active: true,
  styleIds: ["s1", "s2"],
};

describe("artist-draft helpers", () => {
  it("fromRow maps pence to £ strings and joins specials", () => {
    const d = fromRow(row);
    expect(d.hourlyRatePounds).toBe("90");
    expect(d.dayRatePounds).toBe("600");
    expect(d.specials).toBe("Snakes, Roses");
    expect(d.styleIds).toEqual(["s1", "s2"]);
  });

  it("rateCell renders £ or an em dash", () => {
    expect(rateCell(9000)).toBe("£90");
    expect(rateCell(null)).toBe("—");
  });

  it("draftToFormData includes email + access role only on create", () => {
    const create = draftToFormData(fromRow(row), true);
    expect(create.get("email")).toBe("sarah@studio.test");
    expect(create.get("accessRole")).toBe("OWNER");
    expect(create.getAll("styleIds")).toEqual(["s1", "s2"]);

    const edit = draftToFormData(fromRow(row), false);
    expect(edit.get("email")).toBeNull();
    expect(edit.get("accessRole")).toBeNull();
    expect(edit.get("id")).toBe("a1");
  });

  it("emptyDraft defaults to RESIDENT + ARTIST + open", () => {
    const d = emptyDraft();
    expect(d.status).toBe("RESIDENT");
    expect(d.accessRole).toBe("ARTIST");
    expect(d.booksStatus).toBe("open");
  });
});
