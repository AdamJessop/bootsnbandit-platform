import { formatDateTime, formatDay } from "@/app/(staff)/_shared/labels";
import type { ConsentRecord } from "@/app/(staff)/customers/[id]/consent-records";

/**
 * Print CSS for the paper layout: A4, black on white whatever the app theme,
 * the toolbar hidden, and the second half (client information, consent
 * statements, signatures) starting on a fresh page as on the studio's paper
 * form. Scoped under `.cp` so it can't leak into the rest of the app.
 */
const PRINT_CSS = `
@page { size: A4; margin: 14mm; }
html, body { background: #fff !important; }
.cp { min-height: 100vh; background: #fff; color: #000; padding: 24px 16px 48px;
  font-family: "Times New Roman", Times, Georgia, serif; font-size: 14px; line-height: 1.45; }
.cp-bar { max-width: 210mm; margin: 0 auto 20px; display: flex; flex-wrap: wrap; gap: 12px;
  align-items: center; justify-content: space-between; font-family: system-ui, sans-serif; }
.cp-bar a { color: #333; text-decoration: underline; min-height: 44px; display: inline-flex; align-items: center; }
.cp-print-btn { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 18px;
  border-radius: 6px; border: 1px solid #000; background: #000; color: #fff; font: 600 14px system-ui, sans-serif; cursor: pointer; }
.cp-print-btn:focus-visible, .cp-bar a:focus-visible { outline: 3px solid #c92f4d; outline-offset: 2px; }
.cp-sheet { max-width: 210mm; margin: 0 auto; }
.cp h1 { font-size: 16px; font-weight: 700; text-decoration: underline; margin: 0 0 16px; letter-spacing: 0.02em; }
.cp h2 { font-size: 14px; font-weight: 700; text-decoration: underline; margin: 16px 0 4px; }
.cp table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
.cp th, .cp td { border: 1px solid #000; padding: 6px 8px; vertical-align: top; text-align: left; }
.cp-head th { background: #d9d9d9; width: 17%; white-space: nowrap; }
.cp-head td { width: 33%; overflow-wrap: anywhere; }
.cp-med thead th { background: #d9d9d9; }
.cp-med .yn { width: 56px; text-align: center; font-weight: 700; }
.cp-med td.yn { font-size: 16px; }
.cp-med .details { white-space: pre-wrap; margin-top: 4px; }
.cp-second { break-before: page; page-break-before: always; }
.cp-statements { margin: 4px 0 0; padding-left: 20px; }
.cp-statements li { margin-bottom: 4px; text-align: justify; }
.cp-agreed { margin: 10px 0 0; font-weight: 700; }
.cp-sigs { margin-top: 24px; display: grid; gap: 24px; break-inside: avoid; page-break-inside: avoid; }
.cp-sig-label { font-weight: 700; text-decoration: underline; margin: 0 0 6px; }
.cp-sig img { display: block; height: 90px; max-width: 320px; object-fit: contain; object-position: left; background: #fff; }
.cp-sig .dark { background: #333; }
.cp-sig .none { height: 90px; display: flex; align-items: center; font-style: italic; color: #444; }
.cp-foot { margin-top: 28px; padding-top: 8px; border-top: 1px solid #000; font-size: 11px; color: #222; }
@media screen { .cp-sheet { box-shadow: 0 0 0 1px #ccc; padding: 14mm; } }
@media screen and (max-width: 640px) { .cp-sheet { padding: 16px; } .cp-head th { white-space: normal; } }
@media print {
  .no-print { display: none !important; }
  .cp { padding: 0; min-height: 0; font-size: 11pt; }
  .cp-sheet { max-width: none; }
  .cp * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;

function Tick({ on }: { on: boolean }) {
  return on ? <span aria-label="ticked">✓</span> : null;
}

function Signature({
  label,
  src,
  alt,
  date,
  dark = false,
}: {
  label: string;
  src: string | null;
  alt: string;
  date: string | null;
  dark?: boolean;
}) {
  return (
    <div className="cp-sig">
      <p className="cp-sig-label">{label};</p>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className={dark ? "dark" : undefined} />
      ) : (
        <p className="none">Not signed</p>
      )}
      <p className="cp-sig-label">
        Date; <span style={{ fontWeight: 400 }}>{formatDay(date)}</span>
      </p>
    </div>
  );
}

/**
 * The signed form laid out like the studio's paper Client Consent Form: the
 * header table (client fields left, artist fields right), the medical table
 * with the Yes/No columns ticked, client information, the individual consent
 * statements and both signatures with dates. This is what the studio shows
 * the council on inspection. Older kiosk forms (v1/v2) print in the same
 * frame with what they recorded.
 */
export function ConsentPrintSheet({ record: r }: { record: ConsentRecord }) {
  const dash = (v: string | null | undefined) => v || "—";
  const dob = r.dob ? formatDay(`${r.dob}T12:00:00`) : null;
  const idProvided = r.paperForm
    ? r.idProvided
    : r.idCheckedBy
      ? `Checked by ${r.idCheckedBy}`
      : null;
  return (
    <article className="cp-sheet">
      <h1>CLIENT CONSENT FORM</h1>
      <table className="cp-head">
        <tbody>
          <tr>
            <th scope="row">Client Name:</th>
            <td>{dash(r.printedName)}</td>
            <th scope="row">D.O.B:</th>
            <td>{dash(dob)}</td>
          </tr>
          <tr>
            <th scope="row">Address:</th>
            <td style={{ whiteSpace: "pre-line" }}>{dash(r.address)}</td>
            <th scope="row">ID provided:</th>
            <td>{dash(idProvided)}</td>
          </tr>
          <tr>
            <th scope="row">Postcode:</th>
            <td>{dash(r.postcode)}</td>
            <th scope="row">Design/placement</th>
            <td>{dash(r.designPlacement)}</td>
          </tr>
          <tr>
            <th scope="row">Telephone:</th>
            <td>{dash(r.phone)}</td>
            <th scope="row">Tattoo Studio</th>
            <td>{r.studioName.toUpperCase()}</td>
          </tr>
          <tr>
            <th scope="row">Email:</th>
            <td>{dash(r.email)}</td>
            <th scope="row">Artist:</th>
            <td>{r.signingArtist ?? r.artistName}</td>
          </tr>
        </tbody>
      </table>

      <table className="cp-med">
        <thead>
          <tr>
            <th scope="col">
              {r.paperForm ? "Medical Condition" : "Question"}
            </th>
            <th scope="col" className="yn">
              Yes
            </th>
            <th scope="col" className="yn">
              No
            </th>
          </tr>
        </thead>
        <tbody>
          {r.answers.map((a) => (
            <tr key={a.id} data-answer={a.answer}>
              <td>
                <b>{a.q}</b>
                {a.explanation && (
                  <>
                    {" - "}
                    <i>{a.explanation}</i>
                  </>
                )}
              </td>
              <td className="yn">
                <Tick on={a.answer === "Yes"} />
              </td>
              <td className="yn">
                <Tick on={a.answer === "No"} />
              </td>
            </tr>
          ))}
          <tr>
            <td colSpan={3}>
              <b>{r.paperForm ? "Further details" : "Anything else"}</b>
              {r.furtherDetailsPrompt && (
                <>
                  {" - "}
                  <i>{r.furtherDetailsPrompt}</i>
                </>
              )}
              <div className="details">{r.medicalNotes || "None given"}</div>
            </td>
          </tr>
        </tbody>
      </table>

      <section className={r.paperForm ? "cp-second" : undefined}>
        {r.clientInformation && (
          <>
            <h2>CLIENT INFORMATION;</h2>
            <p style={{ margin: 0 }}>
              {r.clientInformation.intro}{" "}
              <b>{r.clientInformation.risks.join(", ")}.</b>
            </p>
          </>
        )}
        {r.statements.length > 0 && (
          <>
            <h2>INDIVIDUAL CONSENT;</h2>
            <ul className="cp-statements">
              {r.statements.map((s) => (
                <li key={s.id}>{s.text}</li>
              ))}
            </ul>
            <p className="cp-agreed">
              {r.agreed
                ? `☑ ${r.agreeLabel} — confirmed by the client on the kiosk before signing.`
                : "☐ The client's agreement to the statements was not recorded."}
            </p>
          </>
        )}

        <div className="cp-sigs">
          <Signature
            label="Client Signature"
            src={r.signature}
            alt={`Signature of ${r.printedName ?? "the client"}`}
            date={r.signedAt}
            dark={r.lightInkSignature}
          />
          {r.paperForm && (
            <Signature
              label="Artist Signature"
              src={r.artistSignature}
              alt={`Signature of ${r.signingArtist ?? "the artist"}`}
              date={r.artistSignedAt}
            />
          )}
        </div>
      </section>

      <p className="cp-foot">
        Signed on the Boots &rsquo;n&rsquo; Bandit front-desk kiosk on{" "}
        {formatDateTime(r.signedAt)} · consent form v{r.version}
        {r.flagged ? " · flagged for a word before the session" : ""} · record{" "}
        {r.id}
      </p>
    </article>
  );
}

/** The scoped print stylesheet, rendered once by the page. */
export function ConsentPrintStyles() {
  return <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />;
}
