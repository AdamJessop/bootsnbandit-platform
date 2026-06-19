import { describe, it, expect } from "vitest";
import { BOOKS_STATUS, booksLabel, type BooksStatus } from "./books";

describe("booksLabel", () => {
  it("maps each status to its heritage label", () => {
    expect(booksLabel("open")).toBe("Books open");
    expect(booksLabel("limited")).toBe("Limited slots");
    expect(booksLabel("closed")).toBe("Waitlist only");
  });

  it("exposes the canonical status list in priority order", () => {
    expect(BOOKS_STATUS).toEqual(["open", "limited", "closed"]);
  });

  it("falls back gracefully for unknown values", () => {
    expect(booksLabel("nope" as BooksStatus)).toBe("Waitlist only");
  });
});
