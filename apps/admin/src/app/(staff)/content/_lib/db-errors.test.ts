import { describe, expect, it } from "vitest";
import {
  humanise,
  knownDbError,
  uniqueViolationFields,
  violates,
  withArticle,
} from "./db-errors";

describe("uniqueViolationFields", () => {
  it("reads the Prisma 7 driver-adapter constraint fields", () => {
    const err = {
      code: "P2002",
      meta: {
        driverAdapterError: {
          cause: {
            kind: "UniqueConstraintViolation",
            constraint: { fields: ['"title"'] },
          },
        },
      },
    };
    expect(uniqueViolationFields(err)).toEqual(["title"]);
  });

  it("reads a constraint index name and the legacy meta.target", () => {
    expect(
      uniqueViolationFields({
        code: "P2002",
        meta: {
          driverAdapterError: {
            cause: { constraint: { index: "AftercareStage_order_key" } },
          },
        },
      }),
    ).toEqual(["AftercareStage_order_key"]);
    expect(
      uniqueViolationFields({ code: "P2002", meta: { target: ["email"] } }),
    ).toEqual(["email"]);
  });

  it("returns [] for a P2002 without details and null for anything else", () => {
    expect(uniqueViolationFields({ code: "P2002" })).toEqual([]);
    expect(uniqueViolationFields({ code: "P2025" })).toBeNull();
    expect(uniqueViolationFields(new Error("boom"))).toBeNull();
    expect(uniqueViolationFields(null)).toBeNull();
  });
});

describe("violates", () => {
  it("matches plain column names and Model_field_key index names", () => {
    expect(violates(["title"], "title")).toBe(true);
    expect(violates(["AftercareStage_order_key"], "order")).toBe(true);
    expect(violates(["GalleryItem_title_key"], "style")).toBe(false);
  });
});

describe("knownDbError", () => {
  it("explains stale rows and linked records; ignores unknown errors", () => {
    expect(knownDbError({ code: "P2025" })).toMatch(/no longer exists/);
    expect(knownDbError({ code: "P2003" })).toMatch(/linked/);
    expect(knownDbError({ code: "P2002" })).toBeNull();
    expect(knownDbError(new Error("connection refused"))).toBeNull();
  });
});

describe("message helpers", () => {
  it("picks a/an and humanises camelCase field names", () => {
    expect(withArticle("gallery item")).toBe("A gallery item");
    expect(withArticle("entry")).toBe("An entry");
    expect(humanise("sortOrder")).toBe("sort order");
    expect(humanise("title")).toBe("title");
  });
});
