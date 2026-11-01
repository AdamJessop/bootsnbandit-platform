import { requireRole } from "@bnb/core/auth";
import { prisma } from "@bnb/core/db";
import { listReviewsForModeration } from "@bnb/core/services/reviews";
import { ReviewModeration } from "./ReviewModeration";
import type { ReviewRow } from "./review-view";

/**
 * Content › Reviews. Owner-only. Customers write reviews from the link in the
 * review-request email; nothing reaches the public homepage until an owner
 * publishes it here. Hidden reviews are kept, so a decision can be undone.
 */
export const dynamic = "force-dynamic";

const DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/London",
});

export default async function ReviewsContentPage() {
  await requireRole("OWNER");
  const [reviews, requested] = await Promise.all([
    listReviewsForModeration(),
    prisma.review.count({ where: { status: "pending" } }),
  ]);

  const rows: ReviewRow[] = reviews.map((r) => ({
    id: r.id,
    status: r.status,
    rating: r.rating,
    body: r.body,
    customerName: r.customerName,
    artistName: r.artistName,
    submittedLabel: r.submittedAt ? DATE.format(r.submittedAt) : null,
  }));

  return (
    <main className="mx-auto max-w-[1100px] px-4 py-10 sm:px-7">
      <p className="kicker mb-2">Content</p>
      <h1 className="display text-[clamp(24px,4vw,36px)] text-text-primary">
        Reviews
      </h1>
      <p className="mt-2 mb-6 max-w-[65ch] text-text-muted">
        What customers wrote after their session. Only published reviews can
        appear on the homepage.
        {requested > 0
          ? ` ${requested} more ${requested === 1 ? "request is" : "requests are"} still waiting on the customer.`
          : ""}
      </p>
      <ReviewModeration reviews={rows} />
    </main>
  );
}
