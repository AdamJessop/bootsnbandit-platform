"use client";

import { useState } from "react";
import { Check, ImagePlus } from "lucide-react";
import { Field } from "@/components/site";
import { buildInklingEnquiryPayload } from "./logic";
import type { InklingArtist } from "./InklingTabs";
import styles from "../enquire/enquire.module.css";

export function MoodBoard({ artists }: { artists: InklingArtist[] }) {
  const [refs, setRefs] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [artistId, setArtistId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function addRef() {
    setRefs((r) => [...r, `moodboard:${Date.now()}-${r.length}`]);
  }

  const canSend =
    name.trim().length > 0 &&
    (email.trim().length > 0 || phone.trim().length >= 6) &&
    refs.length > 0;

  async function send() {
    setSubmitting(true);
    setError(null);
    try {
      const payload = buildInklingEnquiryPayload({
        name,
        email,
        phone,
        note,
        moodboard: refs,
        artistId: artistId || null,
      });
      const res = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Couldn't send your board. Please retry.");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Please retry.");
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
        <h2 className="display">Board sent</h2>
        <p className="lead">
          {refs.length} reference{refs.length === 1 ? "" : "s"} on their way to
          the studio. We&rsquo;ll be in touch.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <h2 className={styles.panelTitle}>Mood Board</h2>
      <p className={styles.panelSub}>
        Gather inspiration into one board, then send it to the studio. We never
        copy another person&rsquo;s tattoo — references guide the look only.
      </p>
      <button type="button" className="btn btn-ghost" onClick={addRef}>
        <ImagePlus className="ic" /> Add a reference
      </button>
      {refs.length > 0 && (
        <div className={styles.moodGrid}>
          {refs.map((r, i) => (
            <div key={r} className={styles.moodTile}>
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  display: "grid",
                  placeItems: "center",
                  color: "var(--text-muted)",
                  fontSize: 12,
                }}
              >
                Ref {i + 1}
              </div>
              <button
                type="button"
                className={styles.moodRemove}
                aria-label="Remove reference"
                onClick={() => setRefs(refs.filter((_, j) => j !== i))}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <Field label="Send to" htmlFor="mb-artist">
          <select
            id="mb-artist"
            className="select"
            value={artistId}
            onChange={(e) => setArtistId(e.target.value)}
          >
            <option value="">No preference</option>
            {artists.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Name" htmlFor="mb-name">
          <input
            id="mb-name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Email" htmlFor="mb-email">
          <input
            id="mb-email"
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Phone" htmlFor="mb-phone">
          <input
            id="mb-phone"
            className="input"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </Field>
        <Field label="A note (optional)" htmlFor="mb-note">
          <textarea
            id="mb-note"
            className="textarea"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
      </div>

      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.nav}>
        <span />
        <button
          type="button"
          className="btn"
          onClick={send}
          disabled={!canSend || submitting}
        >
          {submitting ? "Sending…" : "Send to studio"}
        </button>
      </div>
    </div>
  );
}
