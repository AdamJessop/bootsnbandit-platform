import { AlertTriangle, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, formatDay } from "../../_shared/labels";
import type { ConsentRecord } from "./consent-records";

/**
 * Read-only list of the consent forms this customer signed on the front-desk
 * kiosk: when, which form version, every answer (flagged ones highlighted),
 * the medical note, DOB, who checked their photo ID, and the signature.
 * Nothing here is editable — a signed form is a licensing record. Rows arrive
 * already scoped to the viewer (see consent-records.ts).
 */
export function ConsentForms({ records }: { records: ConsentRecord[] }) {
  if (records.length === 0) {
    return (
      <p className="text-sm text-text-muted">
        No consent forms signed on the kiosk yet.
      </p>
    );
  }
  return (
    <ul className="space-y-4">
      {records.map((r) => (
        <li
          key={r.id}
          className="rounded-lg border border-border-default bg-bg-card p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-medium text-text-primary">
                Signed {formatDateTime(r.signedAt)}
              </p>
              <p className="text-sm text-text-muted">
                {r.bookingType === "consult" ? "Consultation" : "Session"} with{" "}
                {r.artistName} · {formatDay(r.bookingStart)} · form v{r.version}
              </p>
            </div>
            {r.flagged ? (
              <Badge variant="destructive">
                <AlertTriangle className="size-3" /> Flagged
              </Badge>
            ) : (
              <Badge variant="outline">
                <ShieldCheck className="size-3" /> Clear
              </Badge>
            )}
          </div>

          <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            <div>
              <dt className="inline text-text-muted">Printed name: </dt>
              <dd className="inline text-text-primary">
                {r.printedName ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="inline text-text-muted">Date of birth: </dt>
              <dd className="inline text-text-primary">
                {r.dob ? formatDay(`${r.dob}T12:00:00`) : "—"}
              </dd>
            </div>
            <div>
              <dt className="inline text-text-muted">ID checked by: </dt>
              <dd className="inline text-text-primary">
                {r.idCheckedBy
                  ? `${r.idCheckedBy}${r.idCheckedAt ? ` · ${formatDateTime(r.idCheckedAt)}` : ""}`
                  : "Not recorded"}
              </dd>
            </div>
            <div>
              <dt className="inline text-text-muted">Portfolio photos: </dt>
              <dd className="inline text-text-primary">
                {r.photoConsent == null
                  ? "Not asked"
                  : r.photoConsent
                    ? "Happy to be photographed"
                    : "No photos"}
              </dd>
            </div>
          </dl>

          <ol className="mt-3 divide-y divide-border-default rounded-md border border-border-default text-sm">
            {r.answers.map((a) => (
              <li
                key={a.id}
                data-flagged={a.flagged || undefined}
                className={
                  "flex items-start justify-between gap-3 px-3 py-2 " +
                  (a.flagged ? "bg-bb-gold/10" : "")
                }
              >
                <span
                  className={
                    a.flagged ? "text-text-primary" : "text-text-secondary"
                  }
                >
                  {a.flagged && (
                    <AlertTriangle
                      className="mr-1.5 inline size-3.5 text-bb-gold"
                      aria-label="Needs a word"
                    />
                  )}
                  {a.q}
                </span>
                <span
                  className={
                    "shrink-0 font-medium " +
                    (a.flagged ? "text-bb-gold" : "text-text-primary")
                  }
                >
                  {a.answer}
                </span>
              </li>
            ))}
          </ol>

          {r.medicalNotes && (
            <p className="mt-3 text-sm">
              <span className="text-text-muted">Anything else: </span>
              <span className="text-text-primary">{r.medicalNotes}</span>
            </p>
          )}

          <div className="mt-3">
            <p className="mb-1 text-xs uppercase tracking-wide text-text-muted">
              Signature
            </p>
            {/* New signatures are black ink on white. Forms from the old pad
                were light ink on transparent, so they get a dark backing. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={r.signature}
              alt={`Signature of ${r.printedName ?? "the customer"}`}
              className={
                "h-24 max-w-full rounded border border-border-default object-contain p-1 " +
                (r.lightInkSignature ? "bg-bg-base" : "bg-white")
              }
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
