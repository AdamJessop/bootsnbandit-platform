"use client";

/**
 * Content › Reviews moderation island. Tabs by status (Awaiting / Published /
 * Hidden); each card shows who, which artist, the stars, the words and when.
 *
 * Optimistic but safe: a tap moves the card to its new tab at once via
 * useOptimistic, the OWNER-guarded server action does the real (conditional)
 * update, and the action's revalidation hands back the server's list. If the
 * server refuses — someone else moved it first, or it's gone — the optimistic
 * move simply unwinds and a toast says why. Taking a review off the site
 * (Unpublish / Hide) asks once more inline; no window.confirm.
 */
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, EyeOff, Undo2 } from "lucide-react";
import { cn } from "@bnb/core/utils";
import {
  moderationActionsFor,
  type ReviewModerationAction,
} from "@bnb/core/services/review-moderation";
import { Button } from "@/components/ui/button";
import { moderateReviewAction } from "./actions";
import {
  ACTION_DONE,
  ACTION_LABEL,
  CONFIRM_PROMPT,
  countByView,
  moveReview,
  REVIEW_VIEWS,
  stars,
  type ReviewMove,
  type ReviewRow,
  type ReviewView,
} from "./review-view";

const ACTION_ICON: Record<ReviewModerationAction, typeof Check> = {
  publish: Check,
  unpublish: Undo2,
  hide: EyeOff,
};

export function ReviewModeration({
  reviews,
  initialView = "submitted",
}: {
  reviews: ReviewRow[];
  initialView?: ReviewView;
}) {
  const [view, setView] = useState<ReviewView>(initialView);
  const [rows, applyMove] = useOptimistic(reviews, moveReview);
  const [, start] = useTransition();
  // The one card (and action) currently asking "are you sure?".
  const [armed, setArmed] = useState<ReviewMove | null>(null);

  const counts = countByView(rows);
  const visible = rows.filter((r) => r.status === view);

  function run(move: ReviewMove) {
    setArmed(null);
    start(async () => {
      applyMove(move);
      const res = await moderateReviewAction({
        reviewId: move.id,
        action: move.action,
      });
      if (res.ok) toast.success(ACTION_DONE[move.action]);
      else toast.error(res.error ?? "Could not update the review.");
    });
  }

  function onAction(move: ReviewMove) {
    if (CONFIRM_PROMPT[move.action]) setArmed(move);
    else run(move);
  }

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label="Reviews by status"
        className="grid grid-cols-3 gap-1 rounded-lg border border-border-default bg-bg-base p-1"
      >
        {REVIEW_VIEWS.map((v) => {
          const active = v.id === view;
          return (
            <button
              key={v.id}
              type="button"
              role="tab"
              id={`reviews-tab-${v.id}`}
              aria-selected={active}
              aria-controls="reviews-panel"
              onClick={() => {
                setView(v.id);
                setArmed(null);
              }}
              className={cn(
                "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-2 font-termina text-[11px] font-bold uppercase tracking-[0.1em] transition-colors duration-200",
                active
                  ? "bg-bg-elevated text-text-primary shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
                  : "text-text-muted hover:bg-bg-raised hover:text-text-secondary",
              )}
            >
              <span>{v.label}</span>
              <span
                className={cn(
                  "rounded-full px-1.5 py-px text-[10px] tabular-nums",
                  active && v.id === "submitted" && counts[v.id] > 0
                    ? "bg-bb-crimson text-white"
                    : active
                      ? "bg-bb-gold/20 text-bb-gold"
                      : "bg-bg-raised text-text-muted",
                )}
              >
                {counts[v.id]}
              </span>
            </button>
          );
        })}
      </div>

      <div
        id="reviews-panel"
        role="tabpanel"
        aria-labelledby={`reviews-tab-${view}`}
      >
        {visible.length === 0 ? (
          <p className="rounded-lg border border-border-default bg-bg-card p-5 text-sm text-text-muted">
            {view === "submitted"
              ? "Nothing waiting — every review has been dealt with."
              : view === "published"
                ? "No published reviews yet. Publish one from Awaiting and it can appear on the homepage."
                : "Nothing hidden."}
          </p>
        ) : (
          <ul className="space-y-3">
            {visible.map((r) => (
              <ReviewCard
                key={r.id}
                review={r}
                armed={armed?.id === r.id ? armed.action : null}
                onAction={(action) => onAction({ id: r.id, action })}
                onConfirm={(action) => run({ id: r.id, action })}
                onCancel={() => setArmed(null)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function ReviewCard({
  review,
  armed,
  onAction,
  onConfirm,
  onCancel,
}: {
  review: ReviewRow;
  armed: ReviewModerationAction | null;
  onAction: (action: ReviewModerationAction) => void;
  onConfirm: (action: ReviewModerationAction) => void;
  onCancel: () => void;
}) {
  const actions = moderationActionsFor(review.status);
  const body = review.body?.trim();
  return (
    <li className="rounded-lg border border-border-default bg-bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-medium text-text-primary">
          {review.customerName ?? "A customer"}
          {review.artistName ? (
            <span className="font-normal text-text-muted">
              {" "}
              · with {review.artistName}
            </span>
          ) : null}
        </p>
        <p className="text-sm tabular-nums text-text-muted">
          {review.submittedLabel ?? ""}
        </p>
      </div>
      {review.rating != null ? (
        <p
          className="mt-1 text-bb-gold"
          role="img"
          aria-label={`${review.rating} out of 5 stars`}
        >
          {stars(review.rating)}
        </p>
      ) : null}
      {body ? (
        <p className="mt-2 whitespace-pre-line text-text-secondary">{body}</p>
      ) : (
        <p className="mt-2 text-sm italic text-text-muted">
          Rating only, no written review — it won&apos;t show on the homepage,
          which only quotes written reviews.
        </p>
      )}

      {armed ? (
        <div
          role="alert"
          className="mt-4 flex flex-wrap items-center gap-2 rounded-md border border-bb-crimson/40 bg-bb-crimson/10 px-3 py-2"
        >
          <p className="min-w-0 flex-1 text-sm text-text-primary">
            {CONFIRM_PROMPT[armed]}
          </p>
          <div className="flex gap-2">
            <Button
              variant="destructive"
              className="min-h-11"
              onClick={() => onConfirm(armed)}
            >
              Yes, {ACTION_LABEL[armed].toLowerCase()}
            </Button>
            <Button variant="outline" className="min-h-11" onClick={onCancel}>
              Keep it
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          {actions.map((action) => {
            const Icon = ACTION_ICON[action];
            return (
              <Button
                key={action}
                variant={action === "publish" ? "default" : "outline"}
                className="min-h-11 gap-1.5"
                onClick={() => onAction(action)}
              >
                <Icon className="h-4 w-4" aria-hidden /> {ACTION_LABEL[action]}
              </Button>
            );
          })}
        </div>
      )}
    </li>
  );
}
