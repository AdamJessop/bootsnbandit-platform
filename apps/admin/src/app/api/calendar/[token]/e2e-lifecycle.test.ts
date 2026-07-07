import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addDays } from "date-fns";
import {
  closeTestDb,
  dbReachable,
  testDb,
  uid,
} from "@bnb/core/services/testdb";
import { createEnquiry } from "@bnb/core/services/enquiries";
import { createBooking, updateBooking } from "@bnb/core/services/bookings";
import { completeSession } from "@bnb/core/services/sessions";
import { runReviewRequests } from "@bnb/core/cron/review-requests";
import { GET as calendarGet } from "@/app/api/calendar/[token]/route";

/**
 * End-to-end happy-path verification against the real DB (skips when Postgres
 * is unreachable). Drives the full relationship lifecycle:
 *
 *   enquiry → convert to booking → confirm → complete session
 *     (asserts receipt + aftercare MessageLog)
 *   → run the review-request cron (asserts Review + review_request MessageLog)
 *   → submit the review
 *   → the per-artist iCal feed lists the booking.
 */

const db = () => testDb();

describe("P12 e2e lifecycle (DB)", () => {
  const cleanup = {
    reviews: [] as string[],
    sessions: [] as string[],
    bookings: [] as string[],
    enquiries: [] as string[],
    customers: [] as string[],
    messages: [] as string[],
    feeds: [] as string[],
  };

  let skip = false;
  let artistId = "";
  let feedToken = "";

  beforeAll(async () => {
    if (!(await dbReachable())) {
      skip = true;
      return;
    }
    const artist = await db().artist.findFirstOrThrow();
    artistId = artist.id;
    // Ensure the artist has an active calendar feed (auto-created at enrolment
    // in real life; create-or-reuse here so the test is self-contained).
    const existing = await db().calendarFeed.findUnique({
      where: { artistId },
    });
    if (existing) {
      feedToken = existing.token;
      if (!existing.active) {
        await db().calendarFeed.update({
          where: { artistId },
          data: { active: true },
        });
      }
    } else {
      feedToken = `feed-${uid()}`;
      const feed = await db().calendarFeed.create({
        data: { artistId, token: feedToken, active: true },
      });
      cleanup.feeds.push(feed.id);
    }
  });

  afterAll(async () => {
    if (cleanup.reviews.length)
      await db().review.deleteMany({ where: { id: { in: cleanup.reviews } } });
    if (cleanup.messages.length)
      await db().messageLog.deleteMany({
        where: { id: { in: cleanup.messages } },
      });
    if (cleanup.sessions.length)
      await db().session.deleteMany({
        where: { id: { in: cleanup.sessions } },
      });
    if (cleanup.bookings.length)
      await db().booking.deleteMany({
        where: { id: { in: cleanup.bookings } },
      });
    if (cleanup.enquiries.length)
      await db().enquiry.deleteMany({
        where: { id: { in: cleanup.enquiries } },
      });
    if (cleanup.customers.length)
      await db().customer.deleteMany({
        where: { id: { in: cleanup.customers } },
      });
    if (cleanup.feeds.length)
      await db().calendarFeed.deleteMany({
        where: { id: { in: cleanup.feeds } },
      });
    await closeTestDb();
  });

  it("runs the full enquiry→booking→session→review→iCal path", async () => {
    if (skip) return;

    const email = `lifecycle-${uid()}@example.test`;

    // 1. Enquiry (creates a Customer + enquiry_ack MessageLog).
    const enquiry = await createEnquiry({
      contactName: "Ada Lifecycle",
      contactEmail: email,
      preferredArtistId: artistId,
      style: "Traditional",
      placement: "Forearm",
      source: "web",
    });
    cleanup.enquiries.push(enquiry.id);
    const customerId = enquiry.customerId!;
    expect(customerId).toBeTruthy();
    cleanup.customers.push(customerId);

    // 2. Convert → booking (pending), well in the future to avoid conflicts.
    const start = addDays(new Date(), 30);
    const end = new Date(start.getTime() + 2 * 3600_000);
    const booking = await createBooking({
      customerId,
      artistId,
      enquiryId: enquiry.id,
      type: "session",
      placement: "Forearm",
      start,
      end,
      durationMin: 120,
      status: "pending",
    });
    cleanup.bookings.push(booking.id);

    // 3. Confirm the booking.
    const confirmed = await updateBooking(booking.id, { status: "confirmed" });
    expect(confirmed.status).toBe("confirmed");

    // 4. Complete the session → receipt + aftercare emails.
    const { session } = await completeSession({
      bookingId: booking.id,
      amountChargedPence: 18000,
      bankRef: "TXN-E2E",
    });
    cleanup.sessions.push(session.id);

    const afterComplete = await db().messageLog.findMany({
      where: { relatedBookingId: booking.id },
    });
    cleanup.messages.push(...afterComplete.map((m) => m.id));
    const completeTypes = afterComplete.map((m) => m.type).sort();
    expect(completeTypes).toContain("receipt");
    expect(completeTypes).toContain("aftercare");

    // 5. Review-request cron (run with `now` past the T+4d schedule).
    const summary = await runReviewRequests(addDays(new Date(), 5));
    expect(summary.sent).toBeGreaterThanOrEqual(1);

    const review = await db().review.findFirstOrThrow({
      where: { bookingId: booking.id },
    });
    cleanup.reviews.push(review.id);
    expect(review.status).toBe("pending");
    expect(review.token).toBeTruthy();

    const reviewLogs = await db().messageLog.findMany({
      where: { relatedBookingId: booking.id, type: "review_request" },
    });
    cleanup.messages.push(...reviewLogs.map((m) => m.id));
    expect(reviewLogs.length).toBe(1);

    // 5b. Cron is idempotent — a second run sends nothing new for this booking.
    const before = await db().review.count({
      where: { bookingId: booking.id },
    });
    await runReviewRequests(addDays(new Date(), 5));
    const after = await db().review.count({ where: { bookingId: booking.id } });
    expect(after).toBe(before);

    // 6. Submit the review.
    const submitted = await db().review.update({
      where: { id: review.id },
      data: { status: "submitted", rating: 5, submittedAt: new Date() },
    });
    expect(submitted.status).toBe("submitted");

    // 7. The iCal feed lists the booking.
    const res = await calendarGet(
      new Request(`http://x/api/calendar/${feedToken}.ics`),
      { params: Promise.resolve({ token: `${feedToken}.ics` }) },
    );
    expect(res.status).toBe(200);
    const ics = await res.text();
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("Ada");
  });
});
