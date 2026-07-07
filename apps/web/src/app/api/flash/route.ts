import { z } from "zod";
import { claimFlash } from "@bnb/core/services/flash";
import { handleApiError, json, jsonError, parseBody } from "@bnb/core/http";
import { clientIp, createRateLimiter } from "@/lib/rate-limit";

/**
 * POST /api/flash — public flash claim. Unauthenticated, rate-limited per IP.
 * Decrements availability and creates an Enquiry (source=flash).
 */

const limiter = createRateLimiter({ limit: 10, windowMs: 60_000 });

const schema = z.object({
  flashId: z.string().min(1),
  contactName: z.string().min(1),
  contactEmail: z.string().email().nullish(),
  contactPhone: z.string().nullish(),
  placement: z.string().nullish(),
  marketingConsent: z.boolean().optional(),
});

export async function POST(req: Request): Promise<Response> {
  try {
    if (!limiter.hit(clientIp(req))) {
      return jsonError(
        429,
        "Too many requests — please try again in a minute.",
      );
    }
    const input = await parseBody(req, schema);
    const result = await claimFlash(input);
    return json(result, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
