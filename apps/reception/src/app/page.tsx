import { requireRole } from "@bnb/core/auth";
import {
  kioskPinConfigured,
  loadReceptionBoard,
} from "@bnb/core/services/reception";
import { KioskApp } from "@/components/kiosk/KioskApp";
import {
  artistShowcaseAction,
  checkoutAction,
  customerCheckinAction,
  toggleStaffAction,
  verifyStaffPinAction,
  walkInAction,
} from "./actions";

export const dynamic = "force-dynamic";

/**
 * Front-desk kiosk home. Requires a signed-in staff user (the tablet is
 * signed in once with a passkey); the board is server-loaded and the client
 * shell keeps it live with a 30s refresh loop. Whether a staff PIN is set
 * picks the staff gate's mode (PIN pad vs hold-to-unlock).
 */
export default async function ReceptionPage() {
  await requireRole();
  const [board, pinConfigured] = await Promise.all([
    loadReceptionBoard(),
    kioskPinConfigured(),
  ]);

  return (
    <KioskApp
      board={board}
      pinConfigured={pinConfigured}
      actions={{
        toggleStaff: toggleStaffAction,
        customerCheckin: customerCheckinAction,
        walkIn: walkInAction,
        checkout: checkoutAction,
        artistShowcase: artistShowcaseAction,
        verifyStaffPin: verifyStaffPinAction,
      }}
    />
  );
}
