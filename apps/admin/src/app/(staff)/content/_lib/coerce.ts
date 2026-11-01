/**
 * Field coercion for the content CMS server actions. Maps FormData (all string)
 * into typed prisma `data` payloads per a declarative spec. Pure + no
 * server-only imports so it is unit testable.
 */

import { poundsToPence } from "./money";

/**
 * `pounds` reads a "£ pounds" string from the form ("45", "45.50") and stores
 * integer pence — the DB never sees a decimal.
 */
export type FieldKind = "string" | "int" | "bool" | "stringArray" | "pounds";

export interface FieldSpec {
  name: string;
  kind: FieldKind;
  /** Empty string -> null instead of "" / 0. */
  nullable?: boolean;
}

export type CoercedValue = string | number | boolean | string[] | null;

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
