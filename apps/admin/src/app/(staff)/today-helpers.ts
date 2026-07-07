/**
 * Pure derivations for the Today dashboard alerts (BACKOFHOUSE-IA B1'):
 * the 7-day unconfirmed-bookings window and the owner alert list built from
 * server-side counts. Framework-free so they unit-test in the node env.
 */

export interface DateWindow {
  from: Date;
  to: Date;
}

/** Window for "pending bookings starting soon": now → now + 7 days. */
export function pendingSoonWindow(now: Date = new Date()): DateWindow {
  return {
    from: now,
    to: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
  };
}

export interface OwnerAlertCounts {
  newEnquiries: number;
  pendingSoon: number;
  overdueFollowUps: number;
}

export interface OwnerAlert {
  href: string;
  text: string;
}

/** Build the owner alert list — one entry per non-zero count, pluralised. */
export function buildOwnerAlerts(counts: OwnerAlertCounts): OwnerAlert[] {
  const alerts: OwnerAlert[] = [];
  if (counts.newEnquiries > 0) {
    alerts.push({
      href: "/enquiries",
      text: `${counts.newEnquiries} new ${
        counts.newEnquiries === 1 ? "enquiry" : "enquiries"
      } awaiting reply`,
    });
  }
  if (counts.pendingSoon > 0) {
    alerts.push({
      href: "/bookings",
      text: `${counts.pendingSoon} unconfirmed booking${
        counts.pendingSoon === 1 ? "" : "s"
      } starting within 7 days`,
    });
  }
  if (counts.overdueFollowUps > 0) {
    alerts.push({
      href: "/sessions",
      text: `${counts.overdueFollowUps} overdue review follow-up${
        counts.overdueFollowUps === 1 ? "" : "s"
      }`,
    });
  }
  return alerts;
}
