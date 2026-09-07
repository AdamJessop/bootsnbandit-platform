import { prisma } from "@bnb/core/db";
import { normaliseEmail, normalisePhone } from "./contact-identity";

/**
 * One-off (but idempotent) consolidation of duplicate customer records, run by
 * `scripts/merge-duplicate-customers.ts` BEFORE the migration that makes
 * `Customer.email` / `Customer.phone` unique.
 *
 * Duplicates are found by normalised email or phone and chained transitively
 * (A~B by phone, B~C by email → one group), because merging only pairwise
 * would leave a second duplicate behind and the unique index would still fail.
 * The oldest record survives; everything else is re-pointed at it and deleted.
 *
 * Deleting rows is irreversible, so every column of a duplicate is either
 * carried onto the survivor (stamps, tier, tags, consent, password hash, dob)
 * or written into its notes (the duplicate's own name, email and phone).
 */

export interface MergeCandidate {
  id: string;
  createdAt: Date;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  tags: string[];
  marketingConsent: boolean;
  loyaltyStamps: number;
  loyaltyTier: number;
  /**
   * Optional so callers that only want the grouping (and the planner's own
   * tests) need not select them; when absent the merged output leaves the
   * survivor's stored value alone rather than nulling it.
   */
  passwordHash?: string | null;
  dob?: Date | null;
}

export interface NormalisedContact {
  email: string | null;
  phone: string | null;
}

/**
 * Match keys for one row. An unparseable phone still gets a `phone-raw:` key
 * so obvious duplicates ("12 345" twice) collapse even though the value can
 * never reach E.164.
 */
export function contactKeys(row: { email: string | null; phone: string | null }): {
  keys: string[];
  normalised: NormalisedContact;
} {
  const email = normaliseEmail(row.email);
  const phone = normalisePhone(row.phone);
  const keys: string[] = [];
  if (email) keys.push(`email:${email}`);
  if (phone) keys.push(`phone:${phone}`);
  else {
    const raw = row.phone?.replace(/\s+/g, "") ?? "";
    if (raw) keys.push(`phone-raw:${raw}`);
  }
  return { keys, normalised: { email, phone } };
}

export interface MergeGroup {
  keepId: string;
  mergeIds: string[];
  keys: string[];
}

/** Oldest first, then lowest id — deterministic survivor choice. */
function olderFirst(a: MergeCandidate, b: MergeCandidate): number {
  const d = a.createdAt.getTime() - b.createdAt.getTime();
  return d !== 0 ? d : a.id.localeCompare(b.id);
}

/** Union-find over contact keys so chained duplicates end in one group. */
export function planCustomerMerges(rows: MergeCandidate[]): MergeGroup[] {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r) !== undefined && parent.get(r) !== r) {
      r = parent.get(r) as string;
    }
    parent.set(x, r);
    return r;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(rb, ra);
  };

  const keysById = new Map<string, string[]>();
  const ownerByKey = new Map<string, string>();
  for (const row of rows) {
    parent.set(row.id, parent.get(row.id) ?? row.id);
    const { keys } = contactKeys(row);
    keysById.set(row.id, keys);
    for (const key of keys) {
      const owner = ownerByKey.get(key);
      if (owner) union(owner, row.id);
      else ownerByKey.set(key, row.id);
    }
  }

  const byRoot = new Map<string, MergeCandidate[]>();
  for (const row of rows) {
    if ((keysById.get(row.id) ?? []).length === 0) continue;
    const root = find(row.id);
    const list = byRoot.get(root) ?? [];
    list.push(row);
    byRoot.set(root, list);
  }

  const groups: MergeGroup[] = [];
  for (const members of byRoot.values()) {
    if (members.length < 2) continue;
    const sorted = [...members].sort(olderFirst);
    const [keep, ...dupes] = sorted;
    const keys = new Set<string>();
    for (const m of sorted) for (const k of keysById.get(m.id) ?? []) keys.add(k);
    groups.push({
      keepId: keep.id,
      mergeIds: dupes.map((d) => d.id),
      keys: [...keys].sort(),
    });
  }
  return groups.sort((a, b) => a.keepId.localeCompare(b.keepId));
}

export interface MergedFields {
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  tags: string[];
  marketingConsent: boolean;
  loyaltyStamps: number;
  loyaltyTier: number;
  /**
   * `undefined` means "leave whatever is stored alone" (Prisma skips undefined
   * on update) — used when the survivor has none and no duplicate offers one,
   * or when the caller never selected the column.
   */
  passwordHash?: string | null;
  dob?: Date | null;
}

/** The survivor's own value, else the first duplicate that has one. */
function inherit<T>(
  own: T | null | undefined,
  dupes: MergeCandidate[],
  pick: (d: MergeCandidate) => T | null | undefined,
): T | undefined {
  if (own !== null && own !== undefined) return own;
  for (const d of dupes) {
    const value = pick(d);
    if (value !== null && value !== undefined) return value;
  }
  return undefined;
}

/**
 * Survivor's field values after absorbing its duplicates: stamps summed, tier
 * maxed, tags unioned, consent OR-ed, notes concatenated. A password hash or
 * date of birth only a duplicate held is inherited — never overwriting the
 * survivor's own.
 *
 * Contacts: the survivor keeps its own email/phone; where it has none it
 * inherits the oldest duplicate's (safe for the coming unique index — any
 * value a duplicate holds put it in this group, so no other survivor can hold
 * it, and without this a group merged by phone would end up with no email at
 * all and the next message from that address would create a fresh duplicate).
 * Every contact value that cannot go in the (now unique) columns — a second,
 * different address, or an email too malformed to normalise — is written into
 * the notes rather than dropped, so a merge never destroys a way of reaching
 * someone.
 */
export function mergedFields(
  keep: MergeCandidate,
  dupes: MergeCandidate[],
): MergedFields {
  const own = contactKeys(keep).normalised;
  const dupeContacts = dupes.map((d) => contactKeys(d).normalised);
  const kept: NormalisedContact = {
    // Junk that cannot normalise never enters the email column (duplicated
    // junk does not group, so it would break the unique index); an
    // unparseable phone can stay as typed, because identical raw numbers DO
    // group on their `phone-raw:` key and so collapse to one row here.
    email: own.email ?? dupeContacts.find((c) => c.email)?.email ?? null,
    phone:
      own.phone ??
      dupeContacts.find((c) => c.phone)?.phone ??
      [keep, ...dupes].map((r) => r.phone?.trim()).find((p) => p) ??
      null,
  };
  const tags = new Set(keep.tags);
  const noteParts: string[] = [];
  if (keep.notes?.trim()) noteParts.push(keep.notes.trim());
  const unusable = (row: MergeCandidate, n: NormalisedContact) =>
    [n.email ?? row.email?.trim(), n.phone ?? row.phone?.trim()].filter(
      (v): v is string => Boolean(v) && v !== kept.email && v !== kept.phone,
    );
  const ownExtras = unusable(keep, own);
  if (ownExtras.length) noteParts.push(`[unmatched contact] ${ownExtras.join(", ")}`);

  let stamps = keep.loyaltyStamps;
  let tier = keep.loyaltyTier;
  let consent = keep.marketingConsent;

  for (const [i, d] of dupes.entries()) {
    for (const t of d.tags) tags.add(t);
    stamps += d.loyaltyStamps;
    tier = Math.max(tier, d.loyaltyTier);
    consent = consent || d.marketingConsent;
    const extras = unusable(d, dupeContacts[i]);
    const body = d.notes?.trim();
    const bits: string[] = [];
    if (body) bits.push(body);
    if (extras.length) bits.push(`also known as ${extras.join(", ")}`);
    if (bits.length) noteParts.push(`[merged ${d.name}] ${bits.join(" — ")}`);
  }

  return {
    name: keep.name,
    email: kept.email,
    phone: kept.phone,
    notes: noteParts.length ? noteParts.join("\n") : null,
    tags: [...tags],
    marketingConsent: consent,
    loyaltyStamps: stamps,
    loyaltyTier: tier,
    passwordHash: inherit(keep.passwordHash, dupes, (d) => d.passwordHash),
    dob: inherit(keep.dob, dupes, (d) => d.dob),
  };
}

export interface MergeReport {
  scanned: number;
  groups: number;
  merged: number;
  renormalised: number;
  dryRun: boolean;
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

/** Note text used when an unusable email has to leave the column. */
function parkedEmailNote(row: { notes: string | null }, email: string): string {
  const existing = row.notes?.trim();
  const line = `[unmatched email] ${email.trim()}`;
  return existing ? `${existing}\n${line}` : line;
}

/**
 * Merge every duplicate group, then re-normalise the contact details of every
 * remaining row. Each group is one transaction, so a failure mid-run leaves
 * the earlier groups merged and the rest untouched — safe to re-run.
 */
export async function mergeDuplicateCustomers(
  opts: { dryRun?: boolean; log?: (line: string) => void } = {},
): Promise<MergeReport> {
  const dryRun = opts.dryRun ?? false;
  const log = opts.log ?? ((line: string) => console.log(line));

  const rows = await prisma.customer.findMany({
    select: SELECT,
    orderBy: { createdAt: "asc" },
  });
  const groups = planCustomerMerges(rows);
  const byId = new Map(rows.map((r) => [r.id, r]));
  log(`Scanned ${rows.length} customers — ${groups.length} duplicate group(s).`);

  let merged = 0;
  for (const group of groups) {
    const keep = byId.get(group.keepId);
    const dupes = group.mergeIds
      .map((id) => byId.get(id))
      .filter((r): r is MergeCandidate => Boolean(r));
    if (!keep || dupes.length === 0) continue;
    const fields = mergedFields(keep, dupes);
    log(
      `${dryRun ? "[dry-run] " : ""}keep ${keep.id} (${keep.name}) ← ${dupes
        .map((d) => `${d.id} (${d.name})`)
        .join(", ")} [${group.keys.join(", ")}]`,
    );
    if (dryRun) {
      merged += dupes.length;
      continue;
    }
    const ids = dupes.map((d) => d.id);
    await prisma.$transaction([
      prisma.enquiry.updateMany({
        where: { customerId: { in: ids } },
        data: { customerId: keep.id },
      }),
      prisma.booking.updateMany({
        where: { customerId: { in: ids } },
        data: { customerId: keep.id },
      }),
      prisma.messageLog.updateMany({
        where: { customerId: { in: ids } },
        data: { customerId: keep.id },
      }),
      prisma.enquiryMessage.updateMany({
        where: { customerId: { in: ids } },
        data: { customerId: keep.id },
      }),
      prisma.review.updateMany({
        where: { customerId: { in: ids } },
        data: { customerId: keep.id },
      }),
      prisma.customerPasswordToken.updateMany({
        where: { customerId: { in: ids } },
        data: { customerId: keep.id },
      }),
      prisma.customerIdentity.updateMany({
        where: { customerId: { in: ids } },
        data: { customerId: keep.id },
      }),
      // Delete the duplicates BEFORE writing their email/phone onto the
      // survivor: while both rows exist, that value would transiently
      // collide with itself on the unique index the duplicates still hold.
      prisma.customer.deleteMany({ where: { id: { in: ids } } }),
      prisma.customer.update({ where: { id: keep.id }, data: fields }),
    ]);
    merged += dupes.length;
  }

  // Anything left with an un-normalised email/phone would still break the
  // unique index comparison later — fix it now. An email that cannot be
  // normalised at all ("no email, ring the shop") has to leave the column, so
  // it is parked in the notes first; an unparseable phone is left where it is,
  // since a raw phone string still indexes uniquely on its own.
  let renormalised = 0;
  const remaining = dryRun
    ? rows.filter((r) => !groups.some((g) => g.mergeIds.includes(r.id)))
    : await prisma.customer.findMany({ select: SELECT });
  for (const row of remaining) {
    const { normalised } = contactKeys(row);
    const emailChanged = (row.email ?? null) !== normalised.email;
    const phoneChanged =
      normalised.phone !== null && row.phone !== normalised.phone;
    if (!emailChanged && !phoneChanged) continue;
    renormalised += 1;
    if (dryRun) continue;
    const rawEmail = row.email?.trim() ?? "";
    const parkEmail = emailChanged && normalised.email === null && rawEmail !== "";
    await prisma.customer.update({
      where: { id: row.id },
      data: {
        ...(emailChanged ? { email: normalised.email } : {}),
        ...(phoneChanged ? { phone: normalised.phone } : {}),
        ...(parkEmail ? { notes: parkedEmailNote(row, rawEmail) } : {}),
      },
    });
  }
  log(
    `${dryRun ? "[dry-run] " : ""}Merged ${merged} duplicate row(s); re-normalised ${renormalised} row(s).`,
  );

  return { scanned: rows.length, groups: groups.length, merged, renormalised, dryRun };
}
