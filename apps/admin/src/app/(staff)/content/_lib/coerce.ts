/**
 * Field coercion for the content CMS server actions. Maps FormData (all string)
 * into typed prisma `data` payloads per a declarative spec. Pure + no
 * server-only imports so it is unit testable.
 */

import { humanise } from "./db-errors";
import { poundsToPence } from "./money";
import { parseLondonDateTime } from "./london-date";

/**
 * `pounds` reads a "£ pounds" string from the form ("45", "45.50") and stores
 * integer pence — the DB never sees a decimal. `date` reads "YYYY-MM-DD" or
 * "YYYY-MM-DD HH:MM" in studio (London) time; blank or unparseable → null.
 */
export type FieldKind =
  | "string"
  | "int"
  | "bool"
  | "stringArray"
  | "pounds"
  | "date";

export interface FieldSpec {
  name: string;
  kind: FieldKind;
  /** Empty string -> null instead of "" / 0. */
  nullable?: boolean;
  /**
   * Reject the save when blank. Defaults to true for non-nullable `string`
   * fields — a NOT NULL text column holding "" is never what the owner meant.
   */
  required?: boolean;
  /** Human name used in validation / duplicate messages (defaults from `name`). */
  label?: string;
}

export type CoercedValue = string | number | boolean | string[] | Date | null;

export function coerceFields(
  fd: FormData,
  spec: FieldSpec[],
): Record<string, CoercedValue> {
  const out: Record<string, CoercedValue> = {};
  for (const f of spec) {
    const raw = fd.get(f.name);
    const s = typeof raw === "string" ? raw : "";
    switch (f.kind) {
      case "string":
        out[f.name] = f.nullable && s.trim() === "" ? null : s.trim();
        break;
      case "int": {
        if (s.trim() === "") {
          out[f.name] = f.nullable ? null : 0;
        } else {
          const n = Number(s);
          out[f.name] = Number.isFinite(n)
            ? Math.trunc(n)
            : f.nullable
              ? null
              : 0;
        }
        break;
      }
      case "pounds": {
        const pence = poundsToPence(s);
        out[f.name] = pence ?? (f.nullable ? null : 0);
        break;
      }
      case "date":
        out[f.name] = parseLondonDateTime(s);
        break;
      case "bool":
        out[f.name] = s === "on" || s === "true";
        break;
      case "stringArray":
        out[f.name] = s
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean);
        break;
    }
  }
  return out;
}

/** Whether a spec field must be non-blank (explicit, else NOT NULL string). */
export function isRequired(f: FieldSpec): boolean {
  return f.required ?? (f.kind === "string" && !f.nullable);
}

export function fieldLabel(f: FieldSpec): string {
  return f.label ?? humanise(f.name);
}

/**
 * Server-side twin of the form's required check: the first required field the
 * coerced payload left blank, as a message ("Title is required."), or null.
 */
export function requiredError(
  data: Record<string, CoercedValue>,
  spec: FieldSpec[],
): string | null {
  for (const f of spec) {
    if (!isRequired(f)) continue;
    const v = data[f.name];
    if (v === null || v === undefined || v === "") {
      const label = fieldLabel(f);
      return `${label.charAt(0).toUpperCase()}${label.slice(1)} is required.`;
    }
  }
  return null;
}
