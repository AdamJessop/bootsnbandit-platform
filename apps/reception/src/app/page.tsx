import { requireRole } from "@bnb/core/auth";
import { loadReceptionBoard } from "@bnb/core/services/reception";
import { KioskApp } from "@/components/kiosk/KioskApp";
import {
  artistShowcaseAction,
  checkoutAction,
  customerCheckinAction,
  toggleStaffAction,
  walkInAction,
} from "./actions";

export const dynamic = "force-dynamic";

/**
 * Front-desk kiosk home. Requires a signed-in staff user (the tablet is
 * signed in once with a passkey); the board is server-loaded and the client
 * shell keeps it live with a 30s refresh loop.
 */
export default async function ReceptionPage() {
  await requireRole();
  const board = await loadReceptionBoard();

  return (
    <KioskApp
      board={board}
      actions={{
        toggleStaff: toggleStaffAction,
        customerCheckin: customerCheckinAction,
        walkIn: walkInAction,
        checkout: checkoutAction,
        artistShowcase: artistShowcaseAction,
      }}
    />
  );
}
