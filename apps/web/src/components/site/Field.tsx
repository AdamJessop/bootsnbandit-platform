/**
 * Labelled form field wrapper (heritage `.field`). Pairs a label with any
 * control passed as children. `htmlFor`/`id` wiring is left to the caller.
 */
export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && <span className="meta">{hint}</span>}
    </div>
  );
}
