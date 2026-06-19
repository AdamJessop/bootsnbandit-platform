import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createCustomer, listCustomers } from "@/lib/services/customers";
import { handleApiError, json, parseBody, parseQuery } from "../_lib/http";

/**
 * /api/customers (admin CRM). All methods require a signed-in staff user.
 */

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().nullish(),
  phone: z.string().nullish(),
  notes: z.string().nullish(),
  marketingConsent: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
});

export async function POST(req: Request): Promise<Response> {
  try {
    await requireRole();
    const input = await parseBody(req, createSchema);
    const customer = await createCustomer(input);
    return json({ customer }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}

const listSchema = z.object({
  search: z.string().optional(),
  take: z.coerce.number().int().min(1).max(200).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

export async function GET(req: Request): Promise<Response> {
  try {
    await requireRole();
    const query = parseQuery(req.url, listSchema);
    const customers = await listCustomers(query);
    return json({ customers });
  } catch (err) {
    return handleApiError(err);
  }
}
