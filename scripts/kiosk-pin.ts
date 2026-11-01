/**
 * Set (or clear) the front-desk kiosk's studio-wide staff PIN.
 * Usage: npm run kiosk:pin 4821     (4–6 digits)
 *        npm run kiosk:pin -- --clear
 *
 * The PIN gates staff actions on the shared reception tablet (staff check-in,
 * walk-ins, today's sessions, checkout, signing the tablet out, and the "ID
 * checked" step of customer check-in). It is stored scrypt-hashed on the
 * SiteSettings row. With no PIN set the kiosk falls back to a 2-second
 * press-and-hold gate. There is no admin UI for this yet.
 */
import { prisma } from "@bnb/core/db";
import { setKioskPin } from "@bnb/core/services/reception";

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Usage: npm run kiosk:pin <4–6 digits> | -- --clear");
    process.exit(1);
  }
  if (arg === "--clear") {
    await setKioskPin(null);
    console.log("Kiosk PIN cleared — the kiosk now uses hold-to-unlock.");
  } else {
    await setKioskPin(arg);
    console.log("Kiosk PIN set. Reload the reception tablet to pick it up.");
  }
  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
