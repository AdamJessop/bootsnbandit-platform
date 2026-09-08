/**
 * The email channel, in two halves:
 *
 *   email-parse.ts    inbound  — Resend event → ParsedInboundEmail
 *   email-outbound.ts outbound — enquiry → a studio reply
 *
 * This file stays as the barrel every Phase-2 caller already imports
 * (`@bnb/core/services/channels/email`), so the split cost no call sites.
 */
export * from "./email-parse";
export * from "./email-outbound";
