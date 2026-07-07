"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { Field } from "@/components/site";
import { buildStudioContactPayload, isStudioContactValid } from "./logic";

/**
 * Studio "Get in touch" client island. Posts a lightweight enquiry (the
 * message prefixed "Studio contact:") to /api/enquiries with success/error
 * states. When the CMS enquiriesOpen toggle is off the form is replaced by a
 * books-closed notice (the API rejects with 403 as the backstop).
 */
export function ContactForm({ enquiriesOpen }: { enquiriesOpen: boolean }) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!enquiriesOpen) {
    return (
      <div className="card card-pad">
        <p className="muted" style={{ margin: 0 }}>
          Our books are closed at the moment, so the contact form is taking a
          breather. Follow us on socials for the next books opening.
        </p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="card card-pad" role="status">
        <p className="row gap-3" style={{ margin: 0 }}>
          <Check className="ic gold" />
          <span>
            <b>Message sent.</b> Thanks {name.split(" ")[0] || "—"}, we&rsquo;ll
            get back to you soon.
          </span>
        </p>
      </div>
    );
  }

  const input = { name, contact, message };
  const valid = isStudioContactValid(input);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildStudioContactPayload(input)),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(
          data.error ?? "Something went wrong — please try again.",
        );
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <Field label="Your name" htmlFor="contact-name">
        <input
          id="contact-name"
          className="input"
          name="name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <Field label="Email or phone" htmlFor="contact-contact">
        <input
          id="contact-contact"
          className="input"
          name="contact"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
        />
      </Field>
      <Field label="Message" htmlFor="contact-message">
        <textarea
          id="contact-message"
          className="textarea"
          name="message"
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </Field>
      {error && (
        <p
          className="meta"
          role="alert"
          style={{ color: "var(--crimson, #c92f4d)" }}
        >
          {error}
        </p>
      )}
      <div className="row gap-3" style={{ flexWrap: "wrap" }}>
        <button type="submit" className="btn" disabled={!valid || submitting}>
          {submitting ? "Sending…" : "Send message"}
        </button>
        <Link href="/enquire" className="btn btn-ghost">
          Or make a full enquiry
        </Link>
      </div>
    </form>
  );
}
