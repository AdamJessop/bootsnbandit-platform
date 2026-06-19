import { z } from "zod";
import { requireRole } from "@/lib/auth";
import {
  createEnquiry,
  listEnquiries,
  type CreateEnquiryInput,
} from "@/lib/services/enquiries";
import { handleApiError, json, parseBody, parseQuery } from "../_lib/http";

/**
 * /api/enquiries
 *  - POST: public lead capture (Enquire form / Inkling). Unauthenticated.
 *  - GET:  admin enquiry inbox. Requires a signed-in staff user.
 */

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
    const input = await parseBody(req, createSchema);
    const enquiry = await createEnquiry(
      input as unknown as CreateEnquiryInput,
    );
    return json({ enquiry }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}

const listSchema = z.object({
  status: z.enum(["new", "replied", "converted", "closed"]).optional(),
  source: z.enum(["web", "flash", "inkling"]).optional(),
  preferredArtistId: z.string().optional(),
  take: z.coerce.number().int().min(1).max(200).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

export async function GET(req: Request): Promise<Response> {
  try {
    await requireRole();
    const query = parseQuery(req.url, listSchema);
    const enquiries = await listEnquiries(query);
    return json({ enquiries });
  } catch (err) {
    return handleApiError(err);
  }
}
