import type { Customer } from "@prisma/client";
import { prisma } from "@bnb/core/db";
import { sendEmail } from "@bnb/core/email";
import {
  mintSetPasswordToken,
  SET_PASSWORD_TOKEN_TTL_DAYS,
} from "./customer-auth";
import {
  DuplicateContactError,
  isUniqueViolation,
  normaliseEmail,
  normalisePhone,
} from "./contact-identity";

/**
 * Customer onboarding orchestration: create the Customer (with DOB), mint a
 * 30-day set-password token and send the welcome email pointing at the PUBLIC
 * site's activation page. Also the reissue path used when an expired link is
 * followed. `sendEmail` never throws, so onboarding can't fail the caller.
 */

export interface CreateCustomerWithWelcomeInput {
  name: string;
  email: string;
  dob?: Date | null;
  phone?: string | null;
  /** Public site origin the set-password link must point at. */
  siteOrigin: string;
}

async function sendWelcome(
  customer: Pick<Customer, "id" | "name">,
  email: string,
  siteOrigin: string,
): Promise<string> {
  const token = await mintSetPasswordToken(customer.id);
  const expiresAt = new Date(
    Date.now() + SET_PASSWORD_TOKEN_TTL_DAYS * 24 * 3600 * 1000,
  ).toISOString();
  await sendEmail({
    to: email,
    type: "welcome",
    customerId: customer.id,
    data: {
      customerName: customer.name,
      setPasswordUrl: `${siteOrigin}/account/set-password?token=${token}`,
      expiresAt,
    },
  });
  return token;
}

/** Create a customer and send them the activation (welcome) email. */
export async function createCustomerWithWelcome(
  input: CreateCustomerWithWelcomeInput,
): Promise<Customer> {
  let customer: Customer;
  try {
    customer = await prisma.customer.create({
      data: {
        name: input.name,
        email: normaliseEmail(input.email),
        phone: normalisePhone(input.phone),
        dob: input.dob ?? null,
      },
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new DuplicateContactError(
        "A customer with that email or phone already exists — search for them instead.",
      );
    }
    throw err;
  }
  await sendWelcome(customer, input.email, input.siteOrigin);
  return customer;
}

/**
 * Mint a fresh set-password token and re-send the welcome email (expired-link
 * reissue). Returns the new token, or null when the customer is unknown or has
 * no email address.
 */
export async function resendSetPasswordLink(
  customerId: string,
  siteOrigin: string,
): Promise<string | null> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
  });
  if (!customer?.email) return null;
  return sendWelcome(customer, customer.email, siteOrigin);
}
