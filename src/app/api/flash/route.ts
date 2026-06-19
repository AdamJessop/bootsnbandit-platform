import { z } from "zod";
import { claimFlash } from "@/lib/services/flash";
import { handleApiError, json, parseBody } from "../_lib/http";

/**
 * POST /api/flash — public flash claim. Unauthenticated.
 * Decrements availability and creates an Enquiry (source=flash).
 */

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
    const input = await parseBody(req, schema);
    const result = await claimFlash(input);
    return json(result, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
