import Link from "next/link";
import { AlertTriangle, Printer, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, formatDay } from "../../_shared/labels";
import type { ConsentRecord } from "./consent-records";

/** Where the paper-layout print view of a form lives. */
export function consentPrintHref(customerId: string, formId: string): string {
  return `/customers/${customerId}/consent/${formId}/print`;
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="inline text-text-muted">{label}: </dt>
      <dd className="inline text-text-primary">{value ?? "—"}</dd>
    </div>
  );
}

function SignatureImage({
  src,
  alt,
  lightInk = false,
}: {
  src: string;
  alt: string;
  lightInk?: boolean;
}) {
  return (
    // New signatures are black ink on white. Forms from the old pad were
    // light ink on transparent, so they get a dark backing.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={
        "h-24 max-w-full rounded border border-border-default object-contain p-1 " +
        (lightInk ? "bg-bg-base" : "bg-white")
      }
    />
  );
}

/**
 * Read-only list of the consent forms this customer signed on the front-desk
 * kiosk: when, which form version, every answer (flagged ones highlighted),
 * the further details, the client's details and — on the paper form (v3) —
 * the artist's half, the statements agreed and both signatures. Nothing here
 * is editable — a signed form is a licensing record. Each form links to its
 * print-friendly paper layout. Rows arrive already scoped to the viewer (see
 * consent-records.ts).
 */
export function ConsentForms({
  records,
  customerId,
}: {
  records: ConsentRecord[];
  customerId: string;
}) {
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
            <div className="flex items-center gap-2">
              {r.flagged ? (
                <Badge variant="destructive">
                  <AlertTriangle className="size-3" /> Flagged
                </Badge>
              ) : (
                <Badge variant="outline">
                  <ShieldCheck className="size-3" /> Clear
                </Badge>
              )}
              <Link
                href={consentPrintHref(customerId, r.id)}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border-default px-3 text-sm text-text-secondary hover:text-text-primary"
              >
                <Printer className="size-4" /> Print
              </Link>
            </div>
          </div>

          {r.paperForm ? (
            <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              <Fact label="Client name" value={r.printedName} />
              <Fact
                label="Date of birth"
                value={r.dob ? formatDay(`${r.dob}T12:00:00`) : null}
              />
              <Fact label="Address" value={r.address} />
              <Fact label="ID provided" value={r.idProvided} />
              <Fact label="Postcode" value={r.postcode} />
              <Fact label="Design/placement" value={r.designPlacement} />
              <Fact label="Telephone" value={r.phone} />
              <Fact label="Tattoo studio" value={r.studioName} />
              <Fact label="Email" value={r.email} />
              <Fact label="Artist" value={r.signingArtist ?? r.artistName} />
            </dl>
          ) : (
            <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              <Fact label="Printed name" value={r.printedName} />
              <Fact
                label="Date of birth"
                value={r.dob ? formatDay(`${r.dob}T12:00:00`) : null}
              />
              <Fact
                label="ID checked by"
                value={
                  r.idCheckedBy
                    ? `${r.idCheckedBy}${r.idCheckedAt ? ` · ${formatDateTime(r.idCheckedAt)}` : ""}`
                    : "Not recorded"
                }
              />
              <Fact
                label="Portfolio photos"
                value={
                  r.photoConsent == null
                    ? "Not asked"
                    : r.photoConsent
                      ? "Happy to be photographed"
                      : "No photos"
                }
              />
            </dl>
          )}

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
                  {a.explanation ? (
                    <>
                      <span className="font-medium">{a.q}</span>
                      <span className="italic text-text-muted">
                        {" "}
                        — {a.explanation}
                      </span>
                    </>
                  ) : (
                    a.q
                  )}
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
              <span className="text-text-muted">
                {r.paperForm ? "Further details: " : "Anything else: "}
              </span>
              <span className="text-text-primary">{r.medicalNotes}</span>
            </p>
          )}

          {r.paperForm && (
            <details className="mt-3 rounded-md border border-border-default px-3 py-2 text-sm">
              <summary className="cursor-pointer text-text-secondary">
                Client information and consent statements
                {r.agreed ? " · agreed" : ""}
              </summary>
              {r.clientInformation && (
                <p className="mt-2 text-text-secondary">
                  {r.clientInformation.intro}{" "}
                  <b className="text-text-primary">
                    {r.clientInformation.risks.join(", ")}.
                  </b>
                </p>
              )}
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-text-secondary">
                {r.statements.map((s) => (
                  <li key={s.id}>{s.text}</li>
                ))}
              </ul>
              {r.agreed && (
                <p className="mt-2 text-text-primary">✓ {r.agreeLabel}</p>
              )}
            </details>
          )}

          <div className="mt-3 flex flex-wrap gap-6">
            <div>
              <p className="mb-1 text-xs uppercase tracking-wide text-text-muted">
                {r.paperForm ? "Client signature" : "Signature"}
              </p>
              <SignatureImage
                src={r.signature}
                alt={`Signature of ${r.printedName ?? "the customer"}`}
                lightInk={r.lightInkSignature}
              />
              {r.paperForm && (
                <p className="mt-1 text-xs text-text-muted">
                  Date: {formatDay(r.signedAt)}
                </p>
              )}
            </div>
            {r.artistSignature && (
              <div>
                <p className="mb-1 text-xs uppercase tracking-wide text-text-muted">
                  Artist signature
                </p>
                <SignatureImage
                  src={r.artistSignature}
                  alt={`Signature of ${r.signingArtist ?? "the artist"}`}
                />
                <p className="mt-1 text-xs text-text-muted">
                  Date: {formatDay(r.artistSignedAt)}
                </p>
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
