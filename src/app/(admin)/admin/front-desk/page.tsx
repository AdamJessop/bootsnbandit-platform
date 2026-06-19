import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { FrontDeskClient } from "./FrontDeskClient";
import { loadDeskArtists } from "./data";
import { loadCustomerOptions } from "../calendar/data";

/**
 * Front Desk screen (BACKOFHOUSE-IA D). Server component: loads the in-studio
 * board (every artist + today's bookings + leave flag) and the customer
 * directory, then renders the client board with presence toggles, an inline
 * artist calendar and quick-add. Walk-in friendly — any staff member can use it.
 */

export const dynamic = "force-dynamic";

export default async function FrontDeskPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const [artists, customers] = await Promise.all([
    loadDeskArtists(),
    loadCustomerOptions(),
  ]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <main className="mx-auto max-w-[1200px] px-4 py-6 sm:px-7">
      <p className="kicker mb-2">In studio</p>
      <h1 className="display mb-6 text-[clamp(22px,4vw,32px)] text-text-primary">
        Front Desk
      </h1>
      <FrontDeskClient
        artists={artists}
        customers={customers}
        todayISO={today.toISOString()}
      />
    </main>
  );
}
