/* CONTRACT (Phase 5 implements the body + templates; Phase 6 calls sendEmail).
   Keep this signature; add templates/clients in src/lib/email as needed. */
export type EmailType =
  | "confirmation" | "reminder" | "receipt" | "aftercare"
  | "review_request" | "enquiry_ack" | "loyalty_reward";
export interface SendEmailInput {
  to: string;
  type: EmailType;
  customerId?: string | null;
  relatedBookingId?: string | null;
  data: Record<string, unknown>;
}
export interface SendEmailResult { id: string; status: string }
/** Renders the template for `type`, sends via Resend (or logs in dev), and writes a MessageLog row. */
export async function sendEmail(_input: SendEmailInput): Promise<SendEmailResult> {
  throw new Error("email.sendEmail not implemented (Phase 5)");
}
