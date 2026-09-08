/**
 * Pure email constants — no Prisma, no server-only, no Resend — so both the
 * sender (`email/index.ts`) and the pure header shaping
 * (`services/channels/email-format.ts`) can import the SAME default without a
 * cycle. Two copies of this string is how `isOwnDomain` drifts away from the
 * domain we actually send from, and a drifted loop guard threads our own
 * bounces as customer replies.
 */
export const DEFAULT_EMAIL_FROM = "Boots 'n' Bandit <hello@bootsnbandit.co.uk>";

/** `EMAIL_FROM` when it carries something, else the studio default. */
export function configuredEmailFrom(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return env.EMAIL_FROM?.trim() || DEFAULT_EMAIL_FROM;
}
