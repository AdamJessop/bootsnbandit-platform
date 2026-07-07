"use client";

import { useState } from "react";
import { Link as LinkIcon } from "lucide-react";
import { Field } from "@/components/site";
import {
  addMoodboardRef,
  MAX_MOODBOARD_REFS,
  moodboardRefLabel,
} from "./logic";
import styles from "./enquire.module.css";

/**
 * Shared mood-board reference capture (Enquire wizard + Inkling board): paste
 * an image/page URL, validated + deduped up to MAX_MOODBOARD_REFS, rendered as
 * removable tiles. Real URLs go into the enquiry `moodboard[]` payload — a
 * full upload backend is deliberately out of scope.
 */
export function MoodboardRefs({
  refs,
  onChange,
  idPrefix = "moodref",
}: {
  refs: string[];
  onChange: (refs: string[]) => void;
  /** Unique input-id prefix when two boards render on one page. */
  idPrefix?: string;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function add() {
    const result = addMoodboardRef(refs, value);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onChange(result.refs);
    setValue("");
    setError(null);
  }

  return (
    <div>
      <Field
        label={`Reference links (up to ${MAX_MOODBOARD_REFS})`}
        htmlFor={`${idPrefix}-url`}
        hint="Paste a link to an image or page — Instagram, Pinterest, anywhere."
      >
        <div className="row gap-3">
          <input
            id={`${idPrefix}-url`}
            className="input"
            type="url"
            inputMode="url"
            placeholder="https://…"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
          />
          <button
            type="button"
            className="btn btn-ghost"
            onClick={add}
            disabled={refs.length >= MAX_MOODBOARD_REFS}
          >
            <LinkIcon className="ic" /> Add
          </button>
        </div>
      </Field>
      {error && <p className={styles.error}>{error}</p>}
      {refs.length === 0 ? (
        <p className={styles.moodEmpty}>No references yet — optional.</p>
      ) : (
        <div className={styles.moodGrid}>
          {refs.map((r) => (
            <div key={r} className={styles.moodTile}>
              <a
                href={r}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  width: "100%",
                  height: "100%",
                  display: "grid",
                  placeItems: "center",
                  color: "var(--text-muted)",
                  fontSize: 12,
                  padding: 8,
                  wordBreak: "break-all",
                  textAlign: "center",
                }}
              >
                {moodboardRefLabel(r)}
              </a>
              <button
                type="button"
                className={styles.moodRemove}
                aria-label={`Remove reference ${moodboardRefLabel(r)}`}
                onClick={() => onChange(refs.filter((x) => x !== r))}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
