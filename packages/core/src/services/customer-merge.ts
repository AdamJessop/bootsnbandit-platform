import { prisma } from "@bnb/core/db";
import {
  contactKeys,
  mergedFields,
  planCustomerMerges,
  type MergeCandidate,
  type MergedFields,
} from "./customer-merge-plan";

/**
 * One-off (but idempotent) consolidation of duplicate customer records, run by
 * `scripts/merge-duplicate-customers.ts` BEFORE the migration that makes
 * `Customer.email` / `Customer.phone` unique.
 *
 * Grouping and field-merging rules live in `./customer-merge-plan` (pure, fully
 * unit-tested) and are re-exported here, so `@bnb/core/services/customer-merge`
 * remains the single import for callers and the CLI.
 */
export * from "./customer-merge-plan";

export interface MergeReport {
  scanned: number;
  groups: number;
  merged: number;
  renormalised: number;
  /**
   * Writes that threw — a group transaction, or a single re-normalise update.
   * Whatever failed is left exactly as it was; the run continues and the CLI
   * exits non-zero so a failure cannot pass for a clean sweep.
   */
  failed: number;
  dryRun: boolean;
}

/** One planned group with the rows and the survivor's post-merge values. */
export interface PlannedMerge {
  keep: MergeCandidate;
  dupes: MergeCandidate[];
  fields: MergedFields;
  keys: string[];
}

export interface MergeOptions {
  /** Default true at the CLI; the service default stays false for callers. */
  dryRun?: boolean;
  log?: (line: string) => void;
  /**
   * Restrict the scan AND the re-normalise pass to these customer ids. The
   * CLI leaves it unset (whole table); tests set it to their own fixtures so a
   * run can never touch a row the test did not create.
   */
  onlyIds?: string[];
  /** Injectable for tests: applies one group's writes. */
  applyGroup?: (plan: PlannedMerge) => Promise<void>;
}

const SELECT = {
  id: true,
  createdAt: true,
  name: true,
  email: true,
  phone: true,
  notes: true,
  tags: true,
  marketingConsent: true,
  loyaltyStamps: true,
  loyaltyTier: true,
  passwordHash: true,
  dob: true,
} as const;

/** Append a "[unmatched …] value" line to a row's notes. */
function parkedNote(notes: string | null, lines: string[]): string {
  const existing = notes?.trim();
  const body = lines.join("\n");
  return existing ? `${existing}\n${body}` : body;
}

/**
 * The one group transaction: re-point every FK, delete, then write the
 * survivor. Exported so tests can drive the real thing around an injected
 * failure; production callers go through {@link mergeDuplicateCustomers}.
 */
export async function applyMergeGroup({ keep, dupes, fields }: PlannedMerge) {
  const ids = dupes.map((d) => d.id);
  const move = {
    where: { customerId: { in: ids } },
    data: { customerId: keep.id },
  };
  await prisma.$transaction([
    prisma.enquiry.updateMany(move),
    prisma.booking.updateMany(move),
    prisma.messageLog.updateMany(move),
    prisma.enquiryMessage.updateMany(move),
    prisma.review.updateMany(move),
    prisma.customerPasswordToken.updateMany(move),
    prisma.customerIdentity.updateMany(move),
    // Delete the duplicates BEFORE writing their email/phone onto the
    // survivor: while both rows still exist, that value would collide with
    // itself on `Customer.email`/`phone @unique` (Task 5) and abort the
    // transaction with P2002.
    prisma.customer.deleteMany({ where: { id: { in: ids } } }),
    prisma.customer.update({ where: { id: keep.id }, data: fields }),
  ]);
}

/** What the re-normalise pass would do to one row, or null when it is fine. */
function renormalisePlan(row: MergeCandidate): {
  data: { email?: string | null; phone?: string | null; notes?: string };
  reasons: string[];
} | null {
  const { normalised } = contactKeys(row);
  const rawEmail = row.email?.trim() ?? "";
  const rawPhone = row.phone?.trim() ?? "";
  const emailChanged = (row.email ?? null) !== normalised.email;
  const phoneChanged = (row.phone ?? null) !== normalised.phone;
  if (!emailChanged && !phoneChanged) return null;

  const reasons: string[] = [];
  const parked: string[] = [];
  if (emailChanged) {
    if (normalised.email)
      reasons.push(`email ${rawEmail} → ${normalised.email}`);
    else if (rawEmail) {
      reasons.push(
        `email ${rawEmail} is unusable — moves to notes, column cleared`,
      );
      parked.push(`[unmatched email] ${rawEmail}`);
    }
  }
  if (phoneChanged) {
    if (normalised.phone)
      reasons.push(`phone ${rawPhone} → ${normalised.phone}`);
    else if (rawPhone) {
      reasons.push(
        `phone ${rawPhone} is unusable — moves to notes, column cleared`,
      );
      parked.push(`[unmatched phone] ${rawPhone}`);
    }
  }
  return {
    data: {
      ...(emailChanged ? { email: normalised.email } : {}),
      ...(phoneChanged ? { phone: normalised.phone } : {}),
      ...(parked.length ? { notes: parkedNote(row.notes, parked) } : {}),
    },
    reasons,
  };
}

/**
 * Merge every duplicate group, then re-normalise the contact details of every
 * remaining row. Each group is one transaction wrapped in its own try/catch:
 * a group that fails is reported and skipped, the rest of the run continues,
 * and nothing about the failed group has changed — safe to re-run.
 */
export async function mergeDuplicateCustomers(
  opts: MergeOptions = {},
): Promise<MergeReport> {
  const dryRun = opts.dryRun ?? false;
  const log = opts.log ?? ((line: string) => console.log(line));
  const applyGroup = opts.applyGroup ?? applyMergeGroup;
  const scope = opts.onlyIds ? { id: { in: opts.onlyIds } } : undefined;
  const tag = dryRun ? "[dry-run] " : "";

  const rows = await prisma.customer.findMany({
    where: scope,
    select: SELECT,
    orderBy: { createdAt: "asc" },
  });
  const groups = planCustomerMerges(rows);
  const byId = new Map(rows.map((r) => [r.id, r]));
  log(
    `Scanned ${rows.length} customers — ${groups.length} duplicate group(s).`,
  );

  let merged = 0;
  let failed = 0;
  const mergedIds = new Set<string>();
  const skipIds = new Set<string>();
  // In dry mode, evaluate the re-normalise pass against what each survivor
  // WOULD look like after its merge, so the reported count matches the real
  // run instead of double-counting rows the merge itself already fixes.
  const survivors = new Map<string, MergeCandidate>();

  for (const group of groups) {
    const keep = byId.get(group.keepId);
    const dupes = group.mergeIds
      .map((id) => byId.get(id))
      .filter((r): r is MergeCandidate => Boolean(r));
    if (!keep || dupes.length === 0) continue;
    const plan: PlannedMerge = {
      keep,
      dupes,
      fields: mergedFields(keep, dupes),
      keys: group.keys,
    };
    log(
      `${tag}keep ${keep.id} (${keep.name}) ← ${dupes
        .map((d) => `${d.id} (${d.name})`)
        .join(", ")} [${group.keys.join(", ")}]`,
    );
    if (dryRun) {
      merged += dupes.length;
      dupes.forEach((d) => mergedIds.add(d.id));
      survivors.set(keep.id, { ...keep, ...plan.fields });
      continue;
    }
    try {
      await applyGroup(plan);
      merged += dupes.length;
      dupes.forEach((d) => mergedIds.add(d.id));
    } catch (err) {
      failed += 1;
      // Leave the whole group alone, re-normalise pass included: its rows
      // still hold each other's values, so touching one now could only fail
      // again on the unique indexes.
      [keep, ...dupes].forEach((r) => skipIds.add(r.id));
      log(
        `FAILED group keep ${keep.id} ← ${dupes.map((d) => d.id).join(", ")} [${group.keys.join(
          ", ",
        )}]: ${err instanceof Error ? err.message : String(err)} — left untouched, re-run to retry.`,
      );
    }
  }

  // Anything left with an un-normalised email/phone would still break Task 5's
  // unique indexes — fix it now. A value that cannot be normalised at all
  // ("no email, ring the shop", "n/a") has to leave its column, so it is
  // parked in the notes first.
  let renormalised = 0;
  const remaining = dryRun
    ? rows
        .filter((r) => !mergedIds.has(r.id))
        .map((r) => survivors.get(r.id) ?? r)
    : await prisma.customer.findMany({ where: scope, select: SELECT });
  for (const row of remaining) {
    if (skipIds.has(row.id)) continue;
    const plan = renormalisePlan(row);
    if (!plan) continue;
    log(
      `${tag}re-normalise ${row.id} (${row.name}): ${plan.reasons.join("; ")}`,
    );
    if (dryRun) {
      renormalised += 1;
      continue;
    }
    try {
      await prisma.customer.update({ where: { id: row.id }, data: plan.data });
      renormalised += 1;
    } catch (err) {
      failed += 1;
      log(
        `FAILED re-normalise ${row.id} (${row.name}): ${
          err instanceof Error ? err.message : String(err)
        } — left untouched, re-run to retry.`,
      );
    }
  }
  log(
    `${tag}Merged ${merged} duplicate row(s); re-normalised ${renormalised} row(s)${
      failed ? `; ${failed} group(s) FAILED` : ""
    }.`,
  );

  return {
    scanned: rows.length,
    groups: groups.length,
    merged,
    renormalised,
    failed,
    dryRun,
  };
}
