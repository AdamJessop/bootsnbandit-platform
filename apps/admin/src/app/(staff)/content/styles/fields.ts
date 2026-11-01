import type { CrudField } from "../_components/CrudSection";
import type { FieldSpec } from "../_lib/coerce";

/**
 * Field config for the styles CMS, in its own module because Next.js page
 * files may only export route-level symbols (default, dynamic, metadata, …) —
 * exporting config from page.tsx fails the build's page type check.
 */

export const SPEC: FieldSpec[] = [
  { name: "name", kind: "string", label: "name" },
  { name: "sortOrder", kind: "int" },
  { name: "image", kind: "string", nullable: true },
];

export const FIELDS: CrudField[] = [
  { name: "name", label: "Style", type: "text", required: true },
  { name: "sortOrder", label: "Order", type: "number" },
  { name: "image", label: "Example image", type: "image", hideInTable: true },
];
