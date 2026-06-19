"use client";

import Link from "next/link";
import { useState } from "react";
import {
  buildMatchPayload,
  emptyQuiz,
  MATCH_QUESTIONS,
  quizComplete,
  type MatchResultLike,
  type QuizState,
} from "./logic";
import styles from "../enquire/enquire.module.css";

/** Shape returned by POST /api/match (subset we render). */
interface ApiMatchResult {
  artist: { id: string; name: string; slug?: string | null };
  pct: number;
  matchedStyles: string[];
  bestFit: boolean;
  rank: number;
}

export function StyleMatcher() {
  const [quiz, setQuiz] = useState<QuizState>(emptyQuiz());
  const [results, setResults] = useState<ApiMatchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function answer(key: string, value: string) {
    setQuiz((q) => ({ ...q, [key]: value }));
  }

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildMatchPayload(quiz)),
      });
      if (!res.ok) throw new Error("Couldn't run the matcher. Please retry.");
      const data = (await res.json()) as { results: ApiMatchResult[] };
      setResults(data.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Please retry.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setQuiz(emptyQuiz());
    setResults(null);
    setError(null);
  }

  if (results) {
    return (
      <div>
        <h2 className={styles.panelTitle}>Your matches</h2>
        <p className={styles.panelSub}>
          Ranked by how well their work fits your answers.
        </p>
        <div className={styles.matchGrid}>
          {results.map((r) => (
            <MatchCard key={r.artist.id} result={r} quiz={quiz} />
          ))}
        </div>
        <div className={styles.nav}>
          <button type="button" className="btn btn-ghost" onClick={reset}>
            Start over
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <h2 className={styles.panelTitle}>Style Matcher</h2>
      <p className={styles.panelSub}>
        Answer a few questions and we&rsquo;ll rank the artists whose work fits
        best. Deterministic — no AI.
      </p>
      {MATCH_QUESTIONS.map((q) => (
        <div key={q.key} style={{ marginBottom: 20 }}>
          <p style={{ fontWeight: 600, marginBottom: 8 }}>{q.prompt}</p>
          <div className={styles.chipRow}>
            {q.options.map((opt) => {
              const on = quiz[q.key] === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={`${styles.choice} ${on ? styles.on : ""}`}
                  style={{ width: "auto" }}
                  onClick={() => answer(q.key, opt.value)}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.nav}>
        <span />
        <button
          type="button"
          className="btn"
          onClick={run}
          disabled={!quizComplete(quiz) || loading}
        >
          {loading ? "Matching…" : "Match me"}
        </button>
      </div>
    </div>
  );
}

function MatchCard({
  result,
  quiz,
}: {
  result: ApiMatchResult;
  quiz: QuizState;
}) {
  const enquireHref = enquireUrl(result.artist.id, result.matchedStyles);
  const profileHref = result.artist.slug
    ? `/artists/${result.artist.slug}`
    : "/artists";
  const matchResult: MatchResultLike = {
    artist: result.artist,
    pct: result.pct,
    matchedStyles: result.matchedStyles,
    bestFit: result.bestFit,
  };
  void quiz; // match data is carried by the enquire seed; kept for parity
  void matchResult;

  return (
    <div className={`${styles.matchCard} ${result.bestFit ? styles.best : ""}`}>
      {result.bestFit && <span className={styles.bestTag}>Best fit</span>}
      <div className={styles.pct}>{result.pct}%</div>
      <strong>{result.artist.name}</strong>
      {result.matchedStyles.length > 0 && (
        <p className="meta">Strong in {result.matchedStyles.join(", ")}</p>
      )}
      <div className={styles.matchActions}>
        <Link href={enquireHref} className="btn btn-sm">
          Enquire
        </Link>
        <Link href={profileHref} className="btn btn-sm btn-ghost">
          Profile
        </Link>
      </div>
    </div>
  );
}

function enquireUrl(artistId: string, matchedStyles: string[]): string {
  const params = new URLSearchParams({ artist: artistId });
  if (matchedStyles.length) params.set("styles", matchedStyles.join(","));
  return `/enquire?${params.toString()}`;
}
