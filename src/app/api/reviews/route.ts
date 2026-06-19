import { z } from "zod";
import { prisma } from "@bnb/core/db";
import { ApiError, handleApiError, json, parseBody } from "@bnb/core/http";

/**
 * POST /api/reviews — public review capture from `/review/[token]`.
 * Unauthenticated. The `token` must map to an existing (pending) Review row
 * that was seeded by the review-request flow; we record the rating/body and
 * flip its status to `submitted`. Logic lives inline (no service edit, per the
 * Phase-8 ownership lane).
 */

const schema = z.object({
  token: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  body: z.string().max(4000).nullish(),
});

export async function POST(req: Request): Promise<Response> {
  try {
    const input = await parseBody(req, schema);

    const review = await prisma.review.findUnique({
      where: { token: input.token },
    });
    if (!review) {
      throw new ApiError(404, "Review not found");
    }
    if (review.status === "submitted" || review.status === "published") {
      throw new ApiError(409, "This review has already been submitted");
    }

    const body = input.body?.trim();
    const updated = await prisma.review.update({
      where: { id: review.id },
      data: {
        rating: input.rating,
        body: body && body.length ? body : null,
        status: "submitted",
        submittedAt: new Date(),
      },
    });

    return json({ review: { id: updated.id, status: updated.status } }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
