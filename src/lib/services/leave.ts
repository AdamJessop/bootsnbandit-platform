import type { Leave, LeaveStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Leave / unavailability — declares days an artist is off (BACKOFHOUSE-IA H2).
 * Approved leave blocks new bookings (see bookings.checkConflict) and hides the
 * artist from the front-desk "in today" board.
 */

export interface CreateLeaveInput {
  artistId: string;
  startDate: Date;
  endDate: Date;
  reason?: string | null;
  status?: LeaveStatus;
}

export async function createLeave(input: CreateLeaveInput): Promise<Leave> {
  return prisma.leave.create({
    data: {
      artistId: input.artistId,
      startDate: input.startDate,
      endDate: input.endDate,
      reason: input.reason ?? null,
      status: input.status ?? "approved",
    },
  });
}

export interface ListLeaveInput {
  artistId?: string;
  status?: LeaveStatus;
  from?: Date;
  to?: Date;
}

export async function listLeave(input: ListLeaveInput = {}): Promise<Leave[]> {
  const { artistId, status, from, to } = input;
  return prisma.leave.findMany({
    where: {
      ...(artistId ? { artistId } : {}),
      ...(status ? { status } : {}),
      // Leave that overlaps the [from, to] window.
      ...(from ? { endDate: { gte: from } } : {}),
      ...(to ? { startDate: { lte: to } } : {}),
    },
    orderBy: { startDate: "asc" },
  });
}

export async function setLeaveStatus(
  id: string,
  status: LeaveStatus,
): Promise<Leave> {
  return prisma.leave.update({ where: { id }, data: { status } });
}

export async function deleteLeave(id: string): Promise<void> {
  await prisma.leave.delete({ where: { id } });
}
