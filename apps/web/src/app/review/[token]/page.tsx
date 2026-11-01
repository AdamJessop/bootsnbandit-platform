import type { Metadata } from "next";
import { prisma } from "@bnb/core/db";
import { ReviewForm } from "./ReviewForm";

/**
 * Public review-capture page (`/review/[token]`). The token is minted by the
 * review-request flow and stored on a `Review` row. We validate it server-side
 * and either render the star/text form (pending) or a friendly already-done /
 * not-found message. Submission posts to /api/reviews.
 */

export const dynamic = "force-dynamic";

/** Personal, single-use links: never indexed. */
export const metadata: Metadata = {
  title: "Leave a review · Boots 'n' Bandit",
  robots: { index: false, follow: false },
};

interface LoadedReview {
  state: "pending" | "done" | "invalid";
  artistName?: string;
}

async function loadReview(token: string): Promise<LoadedReview> {
  try {
    const review = await prisma.review.findUnique({
      where: { token },
      include: { booking: { include: { artist: true } } },
    });
    if (!review) return { state: "invalid" };
    if (review.status === "submitted" || review.status === "published") {
      return { state: "done" };
    }
    return {
      state: "pending",
      artistName: review.booking?.artist?.name ?? undefined,
    };
  } catch {
    // Before the DB adapter is wired in dev, fall back to rendering the form so
    // the route is reachable; the API will reject an unknown token.
    return { state: "pending" };
  }
}

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const { state, artistName } = await loadReview(token);

  return (
    <>
      <header className="page-head">
        <div className="wrap">
          <span className="eyebrow">Leave a review</span>
          <h1 className="display">Kind words</h1>
        </div>
      </header>
      <section className="section">
        <div className="wrap wrap-narrow">
          {state === "invalid" && (
            <div className="card card-pad">
              <h2 className="display">Link not found</h2>
              <p className="lead">
                This review link isn&rsquo;t valid. If you&rsquo;d still like to
                leave a review, get in touch and we&rsquo;ll send a fresh one.
              </p>
            </div>
          )}
          {state === "done" && (
            <div className="card card-pad">
              <h2 className="display">Already received</h2>
              <p className="lead">
                Thanks — we&rsquo;ve already got your review on file.
              </p>
            </div>
          )}
          {state === "pending" && (
            <ReviewForm token={token} artistName={artistName} />
          )}
        </div>
      </section>
    </>
  );
}
