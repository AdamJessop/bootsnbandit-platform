import { describe, expect, it } from "vitest";
import {
  normaliseStaffEmail,
  staffEmailProblem,
  studioMailDomains,
} from "./staff-email";

/**
 * Staff must be invited at an address they read. Mail to the studio's own
 * domain is routed into the enquiry inbox (and our own invite is dropped there
 * as a loop), so those addresses are refused with a sentence the owner can act
 * on.
 */

const ENV = {
  INBOUND_EMAIL_DOMAIN: "bootsnbandit.com",
  EMAIL_FROM: "Boots 'n' Bandit <studio@bootsnbandit.com>",
} as NodeJS.ProcessEnv;

describe("staffEmailProblem", () => {
  it("accepts a personal address", () => {
    expect(staffEmailProblem("calum@gmail.com", ENV)).toBeNull();
  });

  it("requires a plausible address", () => {
    expect(staffEmailProblem("", ENV)).toMatch(/required/);
    expect(staffEmailProblem("calum", ENV)).toMatch(/doesn't look like/);
    expect(staffEmailProblem("calum@localhost", ENV)).toMatch(
      /doesn't look like/,
    );
  });

  it("refuses the studio's own inbound domain with the owner-facing reason", () => {
    expect(staffEmailProblem("calum@bootsnbandit.com", ENV)).toBe(
      "Mail to @bootsnbandit.com goes to the enquiry inbox — invite their personal email.",
    );
  });

  it("refuses the brand domain when inbound mail is on a subdomain", () => {
    const env = {
      INBOUND_EMAIL_DOMAIN: "mail.bootsnbandit.com",
      EMAIL_FROM: "studio@other.example",
    } as NodeJS.ProcessEnv;
    expect(staffEmailProblem("calum@bootsnbandit.com", env)).toMatch(
      /enquiry inbox/,
    );
    expect(staffEmailProblem("x@mail.bootsnbandit.com", env)).toMatch(
      /enquiry inbox/,
    );
    expect(staffEmailProblem("calum@gmail.com", env)).toBeNull();
  });

  it("refuses the sending domain even with no inbound domain configured", () => {
    const env = { EMAIL_FROM: "studio@bootsnbandit.com" } as NodeJS.ProcessEnv;
    expect(staffEmailProblem("sarah@bootsnbandit.com", env)).toMatch(
      /enquiry inbox/,
    );
  });

  it("does not over-match a lookalike domain", () => {
    expect(staffEmailProblem("x@notbootsnbandit.com", ENV)).toBeNull();
  });
});

describe("studioMailDomains", () => {
  it("does not treat a bare TLD as the parent of an apex domain", () => {
    expect(studioMailDomains(ENV)).toEqual(["bootsnbandit.com"]);
  });
});

describe("normaliseStaffEmail", () => {
  it("trims and lowercases", () => {
    expect(normaliseStaffEmail("  Calum@Example.COM ")).toBe(
      "calum@example.com",
    );
  });
});
