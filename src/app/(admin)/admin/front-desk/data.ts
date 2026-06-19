import { prisma } from "@bnb/core/db";
import { listBookings } from "@bnb/core/services/bookings";
import type { DeskArtist } from "./desk-board";

export {
  currentBooking,
  nextBooking,
  type DeskArtist,
  type DeskBooking,
} from "./desk-board";

/**
 * Front-desk server loader (BACKOFHOUSE-IA D). Pure board helpers/types live in
 * ./desk-board (client-safe) and are re-exported here; this module owns the
 * prisma-backed query and must only be imported by server components.
 */

function todayWindow(): { from: Date; to: Date } {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date();
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

/** Every artist with today's bookings + a leave flag, for the in-studio board. */
export async function loadDeskArtists(): Promise<DeskArtist[]> {
  const { from, to } = todayWindow();
  const [artists, leaves, customers] = await Promise.all([
    prisma.artist.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
    prisma.leave.findMany({
      where: {
        status: "approved",
        startDate: { lte: to },
        endDate: { gte: from },
      },
      select: { artistId: true },
    }),
    prisma.customer.findMany({ select: { id: true, name: true } }),
  ]);
  const onLeave = new Set(leaves.map((l) => l.artistId));
  const nameById = new Map(customers.map((c) => [c.id, c.name]));

  const result: DeskArtist[] = [];
  for (const a of artists) {
    const bookings = await listBookings({ artistId: a.id, from, to });
    result.push({
      id: a.id,
      name: a.name,
      onLeave: onLeave.has(a.id),
      bookings: bookings
        .filter((b) => b.status !== "cancelled")
        .map((b) => ({
          id: b.id,
          start: b.start.toISOString(),
          end: b.end.toISOString(),
          type: b.type,
          status: b.status,
          customerName: nameById.get(b.customerId) ?? "Walk-in",
        })),
    });
  }
  return result;
}
