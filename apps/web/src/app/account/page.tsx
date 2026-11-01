import { redirect } from "next/navigation";
import { getCustomerSession } from "@/lib/customer-auth";

/**
 * `/account` has no page of its own: signed-in customers go to their Bandit
 * Pass (the account home), everyone else to sign-in.
 */

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await getCustomerSession();
  redirect(session ? "/passport" : "/account/sign-in");
}
