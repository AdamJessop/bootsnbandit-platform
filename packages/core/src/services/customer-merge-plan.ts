import { normaliseEmail, normalisePhone } from "./contact-identity";

/**
 * The pure half of the duplicate-customer merge: how rows are grouped and what
 * the survivor's field values become. No database access lives here, so every
 * rule below is unit-testable without a Postgres. `./customer-merge` re-exports
 * all of it alongside the run that actually writes.
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

/** Fewest digits a raw phone string must have before it can identify a person. */
export const MIN_RAW_PHONE_DIGITS = 7;

/**
 * Match keys for one row. A phone that cannot reach E.164 still gets a
 * `phone-raw:` key so a real number typed oddly twice ("07700 900123 /
 * 07700 900124" in both rows) collapses — but only when it carries at least
 * {@link MIN_RAW_PHONE_DIGITS} digits. Placeholders like `n/a`, `0`, `TBC` or
 * `-` are typed by staff into many unrelated records and would otherwise merge
 * strangers into one customer; they contribute no key at all, and the write
 * pass moves them out of the column into the notes.
 */
export function contactKeys(row: {
  email: string | null;
  phone: string | null;
}): {
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
    const digits = raw.replace(/\D/g, "").length;
    if (digits >= MIN_RAW_PHONE_DIGITS) keys.push(`phone-raw:${raw}`);
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
    for (const m of sorted)
      for (const k of keysById.get(m.id) ?? []) keys.add(k);
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
 * different address, or a value too malformed to normalise — is written into
 * the notes rather than dropped, so a merge never destroys a way of reaching
 * someone.
 */
export interface MergedFieldsOptions {
  /**
   * Whether the caller actually writes `email`/`phone` back onto the survivor.
   *
   * Default true — the duplicate merge does, so a value that cannot live in
   * the (unique) columns is moved into the notes instead and nothing is lost.
   * `false` for a caller that leaves the survivor's contact columns alone
   * (the identity link): there, a placeholder phone is still exactly where it
   * always was, and an `[unmatched contact]` line about it would be a lie
   * stamped on the customer record forever. The `[merged …]` audit lines are
   * unaffected either way.
   */
  rewritesContactColumns?: boolean;
}

export function mergedFields(
  keep: MergeCandidate,
  dupes: MergeCandidate[],
  options: MergedFieldsOptions = {},
): MergedFields {
  const own = contactKeys(keep).normalised;
  const dupeContacts = dupes.map((d) => contactKeys(d).normalised);
  const kept: NormalisedContact = {
    // Only normalised values ever enter the columns: an unparseable one may be
    // shared verbatim with rows that did NOT group (a placeholder carries no
    // match key), and Task 5's unique indexes would reject the collision. The
    // raw text goes into the notes instead — nothing is lost, it is just no
    // longer a lookup key.
    email: own.email ?? dupeContacts.find((c) => c.email)?.email ?? null,
    phone: own.phone ?? dupeContacts.find((c) => c.phone)?.phone ?? null,
  };
  const tags = new Set(keep.tags);
  const noteParts: string[] = [];
  if (keep.notes?.trim()) noteParts.push(keep.notes.trim());
  const unusable = (row: MergeCandidate, n: NormalisedContact) =>
    [n.email ?? row.email?.trim(), n.phone ?? row.phone?.trim()].filter(
      (v): v is string => Boolean(v) && v !== kept.email && v !== kept.phone,
    );
  const ownExtras =
    options.rewritesContactColumns === false ? [] : unusable(keep, own);
  if (ownExtras.length)
    noteParts.push(`[unmatched contact] ${ownExtras.join(", ")}`);

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
    // Always name the absorbed record, even when it adds nothing else: the
    // row is about to be deleted and the note is the only trace that this
    // customer was ever also known by that name.
    noteParts.push(
      bits.length
        ? `[merged ${d.name}] ${bits.join(" — ")}`
        : `[merged ${d.name}]`,
    );
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
