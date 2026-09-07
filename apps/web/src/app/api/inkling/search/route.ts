import { z } from "zod";
import { searchInspiration } from "@bnb/core/services/image-search";
import { handleApiError, json, jsonError, parseBody } from "@bnb/core/http";
import { clientIp, createRateLimiter } from "@/lib/rate-limit";

/**
 * POST /api/inkling/search — public inspiration search for the mood-board
 * builder. Unauthenticated, rate-limited per IP; the provider key never
 * leaves the server. Degrades to studio-only results when no provider is set.
 */

const limiter = createRateLimiter({ limit: 20, windowMs: 60_000 });

const schema = z.object({
  styles: z.array(z.string().trim().min(1).max(40)).max(3).default([]),
  colour: z.enum(["bw", "colour", "either"]).nullish(),
  description: z.string().trim().max(300).default(""),
  start: z.coerce.number().int().min(1).max(91).default(1),
});

export async function POST(req: Request): Promise<Response> {
  try {
    if (!limiter.hit(clientIp(req))) {
      return jsonError(429, "Too many searches — please try again in a minute.");
    }
    const input = await parseBody(req, schema);
    if (input.styles.length === 0 && input.description.length < 3) {
      return jsonError(400, "Pick a style or describe your idea first.");
    }
    const result = await searchInspiration({
      styles: input.styles,
      colour: input.colour ?? null,
      description: input.description,
      start: input.start,
    });
    return json(result);
  } catch (err) {
    return handleApiError(err);
  }
}
