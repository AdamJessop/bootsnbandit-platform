import { describe, expect, it } from "vitest";
import { buildStudioContactPayload, isStudioContactValid } from "./logic";

describe("isStudioContactValid", () => {
  it("requires name, contact and message", () => {
    expect(
      isStudioContactValid({ name: "", contact: "a@b.co", message: "hi" }),
    ).toBe(false);
    expect(
      isStudioContactValid({ name: "Ada", contact: "", message: "hi" }),
    ).toBe(false);
    expect(
      isStudioContactValid({ name: "Ada", contact: "a@b.co", message: " " }),
    ).toBe(false);
    expect(
      isStudioContactValid({ name: "Ada", contact: "a@b.co", message: "hi" }),
    ).toBe(true);
  });

  it("accepts a phone number of at least 6 digits as the contact", () => {
    expect(
      isStudioContactValid({
        name: "Ada",
        contact: "07123 456789",
        message: "hi",
      }),
    ).toBe(true);
    expect(
      isStudioContactValid({ name: "Ada", contact: "123", message: "hi" }),
    ).toBe(false);
  });
});

describe("buildStudioContactPayload", () => {
  it("classifies an email contact and prefixes the description", () => {
    const p = buildStudioContactPayload({
      name: " Ada Lovelace ",
      contact: "ada@example.com",
      message: " Do you do cover-ups? ",
    });
    expect(p).toEqual({
      contactName: "Ada Lovelace",
      contactEmail: "ada@example.com",
      contactPhone: null,
      description: "Studio contact: Do you do cover-ups?",
      source: "web",
    });
  });

  it("classifies a phone contact", () => {
    const p = buildStudioContactPayload({
      name: "Sam",
      contact: "07123 456789",
      message: "Voucher question",
    });
    expect(p.contactEmail).toBeNull();
    expect(p.contactPhone).toBe("07123 456789");
    expect(p.description).toBe("Studio contact: Voucher question");
  });
});
