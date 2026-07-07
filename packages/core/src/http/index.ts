import { z, ZodError } from "zod";
import { BookingConflictError } from "@bnb/core/services/bookings";
import { FlashUnavailableError } from "@bnb/core/services/flash";
import { SessionCompletionError } from "@bnb/core/services/sessions";

/**
 * Shared API route helpers: typed JSON parsing with zod and a single
 * error → HTTP Response mapper so every route handler stays terse.
 */

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function jsonError(status: number, error: string): Response {
  return json({ error }, status);
}

/** Thrown by routes to short-circuit with a specific status. */
export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** Parse + validate a JSON request body. Throws ZodError on mismatch. */
export async function parseBody<T>(
  req: Request,
  schema: z.ZodType<T>,
): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    raw = undefined;
  }
  return schema.parse(raw);
}

/** Parse + validate URL search params (string-keyed). */
export function parseQuery<T>(url: string, schema: z.ZodType<T>): T {
  const params = new URL(url).searchParams;
  const obj: Record<string, string> = {};
  for (const [k, v] of params) obj[k] = v;
  return schema.parse(obj);
}

function isNextRedirect(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "digest" in err &&
    typeof (err as { digest?: unknown }).digest === "string" &&
    (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

/** Map any thrown value to an HTTP error Response. Re-throws Next redirects. */
export function handleApiError(err: unknown): Response {
  // Let Next.js redirect() bubble (requireRole may redirect unauthenticated).
  if (isNextRedirect(err)) throw err;

  if (err instanceof ZodError) {
    return json({ error: "Invalid request", issues: err.issues }, 400);
  }
  if (err instanceof ApiError) {
    return jsonError(err.status, err.message);
  }
  if (err instanceof BookingConflictError) {
    return jsonError(409, err.message);
  }
  if (err instanceof FlashUnavailableError) {
    return jsonError(409, err.message);
  }
  if (err instanceof SessionCompletionError) {
    return jsonError(409, err.message);
  }

  const message = err instanceof Error ? err.message : String(err);
  // Auth contract surfaces (unimplemented / unauthorized) → 401.
  if (/requireRole|getCurrentUser|unauthor/i.test(message)) {
    return jsonError(401, "Unauthorized");
  }
  return jsonError(500, "Internal Server Error");
}
