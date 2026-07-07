import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  CUSTOMER_COOKIE,
  decodeCustomerSession,
  type CustomerSessionPayload,
} from "@bnb/core/auth/customer-session";

/**
 * Customer session helpers for the public web app. Mirrors core's staff
 * cookie helpers but reads the CUSTOMER cookie (bb_customer_session,
 * host-only on this origin) — staff and customer sessions can never mix.
 */

/** Read + decode the customer session cookie; null when absent/invalid. */
export async function getCustomerSession(): Promise<CustomerSessionPayload | null> {
  const jar = await cookies();
  const raw = jar.get(CUSTOMER_COOKIE)?.value;
  if (!raw) return null;
  return decodeCustomerSession(raw);
}

/** Gate a page/action on a signed-in customer; bounces to sign-in otherwise. */
export async function requireCustomer(): Promise<CustomerSessionPayload> {
  const session = await getCustomerSession();
  if (!session) redirect("/account/sign-in");
  return session;
}
