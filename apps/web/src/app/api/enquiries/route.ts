import { z } from "zod";
import { prisma } from "@bnb/core/db";
import {
  createEnquiry,
  type CreateEnquiryInput,
} from "@bnb/core/services/enquiries";
import { handleApiError, json, jsonError, parseBody } from "@bnb/core/http";
import { clientIp, createRateLimiter } from "@/lib/rate-limit";

/**
 * POST /api/enquiries — public lead capture (Enquire form / Inkling / studio
 * contact). Unauthenticated; rate-limited per IP and gated on the CMS
 * `enquiriesOpen` toggle. The staff inbox lives on the admin origin only.
 */

const limiter = createRateLimiter({ limit: 5, windowMs: 60_000 });

const createSchema = z.object({
  contactName: z.string().min(1),
  contactEmail: z.string().email().nullish(),
  contactPhone: z.string().nullish(),
  preferredArtistId: z.string().nullish(),
  style: z.string().nullish(),
  placement: z.string().nullish(),
  size: z.string().nullish(),
  budgetPence: z.number().int().nonnegative().nullish(),
  description: z.string().nullish(),
  moodboard: z.array(z.string()).optional(),
  matchData: z.unknown().optional(),
  source: z.enum(["web", "flash", "inkling"]).optional(),
  marketingConsent: z.boolean().optional(),
});

export async function POST(req: Request): Promise<Response> {
  try {
    if (!limiter.hit(clientIp(req))) {
      return jsonError(429, "Too many enquiries — please try again in a minute.");
    }
    const settings = await prisma.siteSettings.findFirst({
      select: { enquiriesOpen: true },
    });
    if (settings && !settings.enquiriesOpen) {
      return jsonError(
        403,
        "Our books are closed at the moment — we're not taking new enquiries right now. Check back soon.",
      );
    }
    const input = await parseBody(req, createSchema);
    const enquiry = await createEnquiry(
      input as unknown as CreateEnquiryInput,
    );
    return json({ enquiry }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
