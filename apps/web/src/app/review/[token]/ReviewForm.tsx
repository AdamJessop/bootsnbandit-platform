"use client";

import { useState } from "react";
import { Check, Star } from "lucide-react";
import { Field } from "@/components/site";
import { buildReviewPayload, isReviewValid } from "../logic";
import styles from "../../enquire/enquire.module.css";

export function ReviewForm({
  token,
  artistName,
}: {
  token: string;
  artistName?: string;
}) {
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit() {
    if (!isReviewValid({ rating, body })) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildReviewPayload(token, { rating, body })),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(
          data.error ?? "We couldn't save your review. Please try again.",
        );
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className={styles.successWrap}>
        <div className={styles.orb}>
          <Check />
        </div>
        <h1 className="display">Thank you</h1>
        <p className="lead">
          Your review means the world to us
          {artistName ? ` and ${artistName}` : ""}.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <h2 className={styles.panelTitle}>How was your experience?</h2>
      <p className={styles.panelSub}>
        {artistName
          ? `Tell us about your time with ${artistName}.`
          : "Tell us about your time at the studio."}
      </p>

      <Field label="Your rating">
        <div className={styles.starPick} role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} star${n === 1 ? "" : "s"}`}
              className={`${styles.starBtn} ${n <= rating ? styles.on : ""}`}
              onClick={() => setRating(n)}
            >
              <Star fill={n <= rating ? "currentColor" : "none"} />
            </button>
          ))}
        </div>
      </Field>

      <Field label="Your review (optional)" htmlFor="review-body">
        <textarea
          id="review-body"
          className="textarea"
          rows={5}
          placeholder="What did you love? How did the piece heal?"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </Field>

      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.nav}>
        <span />
        <button
          type="button"
          className="btn"
          onClick={submit}
          disabled={!isReviewValid({ rating, body }) || submitting}
        >
          {submitting ? "Saving…" : "Submit review"}
        </button>
      </div>
    </div>
  );
}
