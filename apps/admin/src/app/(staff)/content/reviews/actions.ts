"use server";

import type { ReviewStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireRole } from "@bnb/core/auth";
import {
  isReviewModerationAction,
  moderateReview,
  type ReviewModerationAction,
} from "@bnb/core/services/reviews";

/**
 * Server action for Content › Reviews. Owner-only: deciding what the public
 * site says about the studio is an owner's call, like the rest of Content.
 * Revalidating the route sends the fresh list back with the action's own
 * response, so the optimistic move on screen settles onto server truth.
 */

export interface ReviewActionResult {
  ok: boolean;
  error?: string;
  /** Where the review actually is now (set on success and on a stale move). */
  status?: ReviewStatus;
}

export interface ModerateReviewInput {
  reviewId: string;
  action: ReviewModerationAction;
}

function revalidate(): void {
  revalidatePath("/content/reviews");
  revalidatePath("/content");
  revalidatePath("/");
}

export async function moderateReviewAction(
  input: ModerateReviewInput,
): Promise<ReviewActionResult> {
  try {
    const user = await requireRole();
    if (user.role !== "OWNER") {
      return { ok: false, error: "Only owners can moderate reviews." };
    }
    // Server actions are callable with arbitrary payloads — re-check at runtime.
    if (
      typeof input?.reviewId !== "string" ||
      !input.reviewId ||
      !isReviewModerationAction(input.action)
    ) {
      return { ok: false, error: "Invalid review action." };
    }
    const res = await moderateReview(input.reviewId, input.action);
    if (!res.ok) {
      revalidate();
      return {
        ok: false,
        status: res.status,
        error:
          res.reason === "not_found"
            ? "That review no longer exists."
            : "Someone else changed this review first — the list now shows where it is.",
      };
    }
    revalidate();
    return { ok: true, status: res.status };
  } catch (err) {
    return {
      ok: false,
      error: (err as Error).message || "Could not update the review.",
    };
  }
}
