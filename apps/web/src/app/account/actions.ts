"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@bnb/core/db";
import {
  CUSTOMER_COOKIE,
  encodeCustomerSession,
} from "@bnb/core/auth/customer-session";
import {
  redeemSetPasswordToken,
  signInCustomer,
} from "@bnb/core/services/customer-auth";
import { resendSetPasswordLink } from "@bnb/core/services/customer-welcome";
import { createRateLimiter } from "@/lib/rate-limit";

/**
 * Server actions for the customer account area: sign-in, sign-out and the
 * set-password (activation) flow. Both credential-shaped actions share one
 * per-IP rate limiter (scoped keys) — the plan's Risk-table mitigation against
 * password guessing and Resend-quota burn from expired-link reissues.
 *
 * The session cookie is host-only (no Domain attribute) on the web origin and
 * distinct from the staff bb_admin_session cookie (P4 isolation).
 */

export interface AccountActionState {
  error: string | null;
  /** Set-password terminal states the form renders instead of the fields. */
  code?: "expired" | "invalid";
}

const SESSION_TTL_SECONDS = 30 * 24 * 3600;
const RATE_LIMIT_ERROR =
  "Too many attempts — please wait a minute and try again.";

const limiter = createRateLimiter({ limit: 5, windowMs: 60_000 });

/** Per-IP limiter key. Server actions have no Request, so read headers(). */
async function limiterKey(scope: string): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = fwd || h.get("x-real-ip")?.trim() || "unknown";
  return `${scope}:${ip}`;
}

/** Public origin of this app, used in re-issued set-password links. */
function siteOrigin(): string {
  return process.env.APP_ORIGIN ?? "http://localhost:3000";
}

async function setCustomerSessionCookie(payload: {
  sub: string;
  email: string;
  name: string;
}): Promise<void> {
  const token = await encodeCustomerSession(payload);
  const jar = await cookies();
  jar.set(CUSTOMER_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // No `domain` — host-only cookie, scoped to the web origin (P4).
    maxAge: SESSION_TTL_SECONDS,
  });
}

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/** Email + password sign-in. Success sets the session cookie → /passport. */
export async function signInAction(
  _prev: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Enter your email address and password." };
  }
  if (!limiter.hit(await limiterKey("sign-in"))) {
    return { error: RATE_LIMIT_ERROR };
  }
  const customer = await signInCustomer(
    parsed.data.email,
    parsed.data.password,
  );
  if (!customer) {
    // Generic on purpose — never reveal whether the email exists.
    return { error: "Email or password is incorrect." };
  }
  await setCustomerSessionCookie({
    sub: customer.id,
    email: parsed.data.email,
    name: customer.name,
  });
  redirect("/passport");
}

/** Clear the customer session cookie and land on the homepage. */
export async function signOutAction(): Promise<void> {
  const jar = await cookies();
  jar.delete(CUSTOMER_COOKIE);
  redirect("/");
}

const setPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
  confirm: z.string(),
});

/**
 * Redeem the emailed set-password token. Success signs the customer straight
 * in; an expired link re-issues a fresh email (the form renders the message).
 */
export async function setPasswordAction(
  _prev: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const parsed = setPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    return { error: "Your password needs at least 8 characters." };
  }
  if (parsed.data.password !== parsed.data.confirm) {
    return { error: "Those passwords don't match — try again." };
  }
  if (!limiter.hit(await limiterKey("set-password"))) {
    return { error: RATE_LIMIT_ERROR };
  }

  const result = await redeemSetPasswordToken(
    parsed.data.token,
    parsed.data.password,
  );
  if (result.ok) {
    const customer = await prisma.customer.findUnique({
      where: { id: result.customerId },
    });
    if (!customer) {
      // Password is set but the row vanished mid-flight — sign in normally.
      redirect("/account/sign-in");
    }
    await setCustomerSessionCookie({
      sub: customer.id,
      email: customer.email ?? "",
      name: customer.name,
    });
    redirect("/passport");
  }
  if (result.reason === "expired") {
    await resendSetPasswordLink(result.customerId, siteOrigin());
    return {
      code: "expired",
      error:
        "That link had expired — we've emailed you a fresh one (valid 30 days).",
    };
  }
  return {
    code: "invalid",
    error:
      "This link isn't valid. Check you used the newest email or contact the studio.",
  };
}
