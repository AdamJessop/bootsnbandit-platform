import { describe, expect, it } from "vitest";
import { normaliseEmail, normalisePhone } from "./contact-identity";

describe("normaliseEmail", () => {
  it("trims and lowercases a valid address", () => {
    expect(normaliseEmail("  Amy.Jones@Example.COM ")).toBe(
      "amy.jones@example.com",
    );
  });

  it("returns null for blank / missing / malformed values", () => {
    expect(normaliseEmail(null)).toBeNull();
    expect(normaliseEmail(undefined)).toBeNull();
    expect(normaliseEmail("   ")).toBeNull();
    expect(normaliseEmail("not-an-email")).toBeNull();
    expect(normaliseEmail("a@b")).toBeNull();
    expect(normaliseEmail("two words@example.com")).toBeNull();
  });

  it("keeps plus-addressing and dots (they are distinct mailboxes)", () => {
    expect(normaliseEmail("amy+ink@example.com")).toBe("amy+ink@example.com");
  });
});

describe("normalisePhone", () => {
  it("converts UK national formats to E.164", () => {
    expect(normalisePhone("07700 900123")).toBe("+447700900123");
    expect(normalisePhone("07700900123")).toBe("+447700900123");
    expect(normalisePhone("+44 7700 900123")).toBe("+447700900123");
    expect(normalisePhone("(020) 7946 0958")).toBe("+442079460958");
  });

  it("keeps an explicit international number in its own country", () => {
    expect(normalisePhone("+1 415 555 2671")).toBe("+14155552671");
  });

  it("returns null for blank / missing / unparseable values", () => {
    expect(normalisePhone(null)).toBeNull();
    expect(normalisePhone(undefined)).toBeNull();
    expect(normalisePhone("  ")).toBeNull();
    expect(normalisePhone("call me")).toBeNull();
    expect(normalisePhone("12345")).toBeNull();
  });
});
