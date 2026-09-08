import { describe, expect, it } from "vitest";
import * as barrel from "./email";
import {
  isEmailReceivedEvent,
  isOwnDomain,
  parseResendInbound,
  resendInboundDeps,
  MAX_INLINE_TOTAL_BYTES,
} from "./email-parse";
import {
  ENQUIRY_EMAIL_CONTEXT_SELECT,
  loadEnquiryEmailContext,
  sendEnquiryEmail,
  toEnquiryEmailContext,
} from "./email-outbound";

/**
 * `channels/email.ts` is a barrel, not a module: every Phase-2 caller
 * (email-inbound.ts, the admin actions, the Channels panel, this package's own
 * suites) imports from it, so the split is only safe while it re-exports the
 * exact same bindings the two halves define.
 */
describe("channels/email barrel", () => {
  it("re-exports the inbound half unchanged", () => {
    expect(barrel.isEmailReceivedEvent).toBe(isEmailReceivedEvent);
    expect(barrel.parseResendInbound).toBe(parseResendInbound);
    expect(barrel.resendInboundDeps).toBe(resendInboundDeps);
    expect(barrel.isOwnDomain).toBe(isOwnDomain);
    expect(barrel.MAX_INLINE_TOTAL_BYTES).toBe(MAX_INLINE_TOTAL_BYTES);
  });

  it("re-exports the outbound half unchanged", () => {
    expect(barrel.loadEnquiryEmailContext).toBe(loadEnquiryEmailContext);
    expect(barrel.sendEnquiryEmail).toBe(sendEnquiryEmail);
    expect(barrel.toEnquiryEmailContext).toBe(toEnquiryEmailContext);
    expect(barrel.ENQUIRY_EMAIL_CONTEXT_SELECT).toBe(
      ENQUIRY_EMAIL_CONTEXT_SELECT,
    );
  });
});
