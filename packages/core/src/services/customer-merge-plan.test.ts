import { describe, expect, it } from "vitest";
import {
  contactKeys,
  mergedFields,
  planCustomerMerges,
  type MergeCandidate,
} from "./customer-merge";

const at = (iso: string) => new Date(iso);

function row(over: Partial<MergeCandidate> & { id: string }): MergeCandidate {
  return {
    createdAt: at("2026-01-01T00:00:00Z"),
    name: "Someone",
    email: null,
    phone: null,
    notes: null,
    tags: [],
    marketingConsent: false,
    loyaltyStamps: 0,
    loyaltyTier: 0,
    ...over,
  };
}

describe("contactKeys", () => {
  it("keys on normalised values", () => {
    const { keys, normalised } = contactKeys({
      email: " Amy@Example.COM ",
      phone: "07700 900123",
    });
    expect(normalised).toEqual({
      email: "amy@example.com",
      phone: "+447700900123",
    });
    expect(keys).toEqual(["email:amy@example.com", "phone:+447700900123"]);
  });

  it("falls back to a raw key for an unparseable phone so it still de-dupes", () => {
    const { keys, normalised } = contactKeys({
      email: null,
      phone: " 07700 900123 / 07700 900124 ",
    });
    expect(normalised.phone).toBeNull();
    expect(keys).toEqual(["phone-raw:07700900123/07700900124"]);
  });

  it("gives placeholders no key at all — they identify nobody", () => {
    for (const phone of ["n/a", "N/A", "0", "TBC", "-", "12 345"]) {
      expect(contactKeys({ email: null, phone }).keys).toEqual([]);
    }
  });

  it("has no keys when there is nothing to match on", () => {
    expect(contactKeys({ email: "nonsense", phone: "  " }).keys).toEqual([]);
  });
});

describe("planCustomerMerges", () => {
  it("keeps the oldest record per duplicate email", () => {
    const groups = planCustomerMerges([
      row({
        id: "b",
        createdAt: at("2026-02-01T00:00:00Z"),
        email: "AMY@x.com",
      }),
      row({
        id: "a",
        createdAt: at("2026-01-01T00:00:00Z"),
        email: "amy@x.com",
      }),
      row({
        id: "c",
        createdAt: at("2026-03-01T00:00:00Z"),
        email: " amy@X.com ",
      }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].keepId).toBe("a");
    expect(groups[0].mergeIds.sort()).toEqual(["b", "c"]);
  });

  it("chains transitively: A~B by phone, B~C by email", () => {
    const groups = planCustomerMerges([
      row({
        id: "a",
        createdAt: at("2026-01-01T00:00:00Z"),
        phone: "07700 900123",
      }),
      row({
        id: "b",
        createdAt: at("2026-02-01T00:00:00Z"),
        phone: "+447700900123",
        email: "shared@x.com",
      }),
      row({
        id: "c",
        createdAt: at("2026-03-01T00:00:00Z"),
        email: "SHARED@x.com",
      }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].keepId).toBe("a");
    expect(groups[0].mergeIds.sort()).toEqual(["b", "c"]);
  });

  it("leaves singletons and contact-less rows alone, and is deterministic on ties", () => {
    expect(
      planCustomerMerges([
        row({ id: "a", email: "one@x.com" }),
        row({ id: "b", email: "two@x.com" }),
        row({ id: "c" }),
        row({ id: "d" }),
      ]),
    ).toEqual([]);
    const tied = planCustomerMerges([
      row({ id: "zz", email: "t@x.com" }),
      row({ id: "aa", email: "t@x.com" }),
    ]);
    expect(tied[0].keepId).toBe("aa"); // same createdAt → lowest id wins
  });

  it("does not merge strangers who share a placeholder phone, but does merge one number typed two ways", () => {
    expect(
      planCustomerMerges([
        row({ id: "a", phone: "n/a" }),
        row({ id: "b", phone: "n/a" }),
      ]),
    ).toEqual([]);
    const real = planCustomerMerges([
      row({
        id: "a",
        createdAt: at("2026-01-01T00:00:00Z"),
        phone: "0114 496 0000",
      }),
      row({
        id: "b",
        createdAt: at("2026-02-01T00:00:00Z"),
        phone: "0114-496-0000",
      }),
    ]);
    expect(real).toHaveLength(1);
    expect(real[0].keepId).toBe("a");
    expect(real[0].keys).toEqual(["phone:+441144960000"]);
  });

  it("never groups rows whose email and phone both normalise to nothing", () => {
    // Junk contact details are not an identity: "n/a" twice is two people until
    // a human says otherwise, and the raw values are left for Task 5's index.
    const groups = planCustomerMerges([
      row({ id: "a", email: "n/a", phone: null }),
      row({ id: "b", email: "n/a", phone: null }),
      row({ id: "c", email: "", phone: "" }),
    ]);
    expect(groups).toEqual([]);
  });

  it("still matches on phone when the email is unusable", () => {
    const groups = planCustomerMerges([
      row({
        id: "a",
        createdAt: at("2026-01-01T00:00:00Z"),
        email: "no email",
        phone: "07700 900124",
      }),
      row({
        id: "b",
        createdAt: at("2026-02-01T00:00:00Z"),
        email: null,
        phone: "+44 7700 900124",
      }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].keepId).toBe("a");
    expect(groups[0].mergeIds).toEqual(["b"]);
    expect(groups[0].keys).toEqual(["phone:+447700900124"]);
  });

  it("returns independent groups for independent duplicates, oldest kept in each", () => {
    const groups = planCustomerMerges([
      row({
        id: "a1",
        createdAt: at("2026-01-01T00:00:00Z"),
        email: "one@x.com",
      }),
      row({
        id: "a2",
        createdAt: at("2026-02-01T00:00:00Z"),
        email: "ONE@x.com",
      }),
      row({
        id: "b1",
        createdAt: at("2026-01-05T00:00:00Z"),
        phone: "07700 900126",
      }),
      row({
        id: "b2",
        createdAt: at("2026-02-05T00:00:00Z"),
        phone: "07700 900126",
      }),
      row({
        id: "b3",
        createdAt: at("2026-03-05T00:00:00Z"),
        phone: "+447700900126",
      }),
      row({ id: "solo", email: "solo@x.com" }),
    ]);
    expect(groups.map((g) => g.keepId).sort()).toEqual(["a1", "b1"]);
    const b = groups.find((g) => g.keepId === "b1");
    expect(b?.mergeIds.sort()).toEqual(["b2", "b3"]);
  });

  it("is a no-op on already-clean, already-normalised data", () => {
    expect(
      planCustomerMerges([
        row({ id: "a", email: "a@x.com", phone: "+447700900127" }),
        row({ id: "b", email: "b@x.com", phone: "+447700900128" }),
        row({ id: "c", email: "c@x.com" }),
      ]),
    ).toEqual([]);
  });
});

describe("mergedFields", () => {
  it("sums stamps, maxes tier, unions tags, ORs consent and keeps the survivor's contacts", () => {
    const keep = row({
      id: "a",
      name: "Amy",
      email: "AMY@x.com",
      phone: "07700 900123",
      notes: "Allergic to red",
      tags: ["vip"],
      loyaltyStamps: 3,
      loyaltyTier: 1,
    });
    const dupes = [
      row({
        id: "b",
        name: "Amy Jones",
        email: "amy.j@x.com",
        phone: null,
        notes: "Prefers mornings",
        tags: ["vip", "walk-in"],
        marketingConsent: true,
        loyaltyStamps: 4,
        loyaltyTier: 2,
      }),
    ];
    const out = mergedFields(keep, dupes);
    expect(out.email).toBe("amy@x.com");
    expect(out.phone).toBe("+447700900123");
    expect(out.loyaltyStamps).toBe(7);
    expect(out.loyaltyTier).toBe(2);
    expect(out.tags).toEqual(["vip", "walk-in"]);
    expect(out.marketingConsent).toBe(true);
    expect(out.notes).toContain("Allergic to red");
    expect(out.notes).toContain("Prefers mornings");
    // Contact details only the duplicate held are preserved in the notes.
    expect(out.notes).toContain("amy.j@x.com");
  });

  it("keeps the survivor's name and still records which record was absorbed", () => {
    const out = mergedFields(row({ id: "a", name: "Amy" }), [
      row({ id: "b", name: "Amy Jones" }),
    ]);
    expect(out.name).toBe("Amy");
    // The deleted row's own name is the only trace left of it.
    expect(out.notes).toBe("[merged Amy Jones]");
  });

  it("inherits the group's only email/phone when the survivor has none", () => {
    // Otherwise a phone-matched group would end up with no email in the column
    // and the next message from that address would create a fresh duplicate.
    const out = mergedFields(row({ id: "a", phone: "07700 900123" }), [
      row({ id: "b", phone: "+447700900123", email: "AMY@x.com" }),
      row({ id: "c", email: "amy@x.com" }),
    ]);
    expect(out.email).toBe("amy@x.com");
    expect(out.phone).toBe("+447700900123");
    // …and it is not also parroted back into the notes as an alias.
    expect(out.notes).not.toContain("also known as");
  });

  it("prefers the survivor's own address and parks the other in the notes", () => {
    const out = mergedFields(
      row({ id: "a", email: "keep@x.com", phone: "07700 900123" }),
      [row({ id: "b", email: "other@x.com", phone: "+447700900123" })],
    );
    expect(out.email).toBe("keep@x.com");
    expect(out.notes).toContain("other@x.com");
  });

  it("parks contact details that cannot go in a unique column", () => {
    const out = mergedFields(
      row({ id: "a", email: "no email", phone: "07700 900123" }),
      [row({ id: "b", phone: "+447700900123", name: "Dupe" })],
    );
    expect(out.email).toBeNull(); // junk never enters the unique column
    expect(out.notes).toContain("no email");
  });

  it("moves an unparseable phone out of the column and into the notes", () => {
    // It may be shared verbatim with rows that never grouped (a placeholder
    // carries no match key), so it cannot sit in a unique column.
    const out = mergedFields(
      row({ id: "a", email: "amy@x.com", phone: "n/a" }),
      [row({ id: "b", name: "Dupe", email: "AMY@x.com", phone: "n/a" })],
    );
    expect(out.phone).toBeNull();
    expect(out.notes).toContain("n/a");
  });

  it("inherits a password hash and date of birth only the duplicate held", () => {
    const out = mergedFields(row({ id: "a", passwordHash: null, dob: null }), [
      row({ id: "b", passwordHash: "hash-b", dob: at("1990-05-04T00:00:00Z") }),
      row({ id: "c", passwordHash: "hash-c" }),
    ]);
    expect(out.passwordHash).toBe("hash-b");
    expect(out.dob).toEqual(at("1990-05-04T00:00:00Z"));
  });

  it("never overwrites the survivor's own password hash or dob", () => {
    const out = mergedFields(
      row({ id: "a", passwordHash: "hash-a", dob: at("1985-01-02T00:00:00Z") }),
      [
        row({
          id: "b",
          passwordHash: "hash-b",
          dob: at("1990-05-04T00:00:00Z"),
        }),
      ],
    );
    expect(out.passwordHash).toBe("hash-a");
    expect(out.dob).toEqual(at("1985-01-02T00:00:00Z"));
  });

  it("leaves password hash / dob untouched when the caller did not select them", () => {
    const out = mergedFields(row({ id: "a" }), [row({ id: "b" })]);
    expect(out.passwordHash).toBeUndefined();
    expect(out.dob).toBeUndefined();
  });

  it("folds three duplicates into one survivor", () => {
    const out = mergedFields(
      row({
        id: "a",
        name: "Amy",
        phone: "07700 900123",
        loyaltyStamps: 1,
        tags: ["vip"],
      }),
      [
        row({
          id: "b",
          name: "A J",
          email: "a@x.com",
          loyaltyStamps: 2,
          loyaltyTier: 3,
        }),
        row({
          id: "c",
          name: "Amy J",
          email: "a2@x.com",
          loyaltyStamps: 4,
          tags: ["walk-in"],
        }),
      ],
    );
    expect(out.loyaltyStamps).toBe(7);
    expect(out.loyaltyTier).toBe(3);
    expect(out.tags.sort()).toEqual(["vip", "walk-in"]);
    // The oldest duplicate's address fills the survivor's empty column; the
    // second, different one is kept in the notes.
    expect(out.email).toBe("a@x.com");
    expect(out.notes).toContain("a2@x.com");
  });
});
