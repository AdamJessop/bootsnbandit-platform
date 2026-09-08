import { describe, expect, it } from "vitest";
import { configuredEmailFrom, DEFAULT_EMAIL_FROM } from "./constants";
import { emailFromDomain } from "@bnb/core/services/channels/email-format";

/**
 * The default From address was written out twice — in email/index.ts and in
 * channels/email-format.ts — so changing the studio address in one place
 * silently desynced the loop guard (`isOwnDomain`) from what we actually send.
 * One constant, one reader, both files import it.
 */
describe("configuredEmailFrom", () => {
  it("falls back to the single default when EMAIL_FROM is unset or blank", () => {
    expect(configuredEmailFrom({} as NodeJS.ProcessEnv)).toBe(
      DEFAULT_EMAIL_FROM,
    );
    expect(configuredEmailFrom({ EMAIL_FROM: "  " } as NodeJS.ProcessEnv)).toBe(
      DEFAULT_EMAIL_FROM,
    );
  });

  it("prefers a configured value", () => {
    expect(
      configuredEmailFrom({
        EMAIL_FROM: "Studio <hi@studio.test>",
      } as NodeJS.ProcessEnv),
    ).toBe("Studio <hi@studio.test>");
  });

  it("is the same default emailFromDomain derives its host from", () => {
    expect(emailFromDomain({} as NodeJS.ProcessEnv)).toBe(
      DEFAULT_EMAIL_FROM.slice(DEFAULT_EMAIL_FROM.lastIndexOf("@") + 1).replace(
        ">",
        "",
      ),
    );
  });
});
