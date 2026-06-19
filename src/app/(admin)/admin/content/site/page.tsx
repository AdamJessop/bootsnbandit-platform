import { requireRole } from "@bnb/core/auth";
import { prisma } from "@bnb/core/db";
import { SiteEditor, type SiteEditorValues } from "../_components/SiteEditor";
import { saveSite } from "../_lib/site-action";

/** Site settings editor page (J8). Owner-only. */
export const dynamic = "force-dynamic";

export default async function SiteContentPage() {
  await requireRole("OWNER");
  const s = await prisma.siteSettings.findFirst({
    orderBy: { createdAt: "asc" },
  });

  const values: SiteEditorValues = {
    studioName: s?.studioName ?? "Boots 'n' Bandit",
    addressLine: s?.addressLine ?? null,
    city: s?.city ?? null,
    county: s?.county ?? null,
    postcode: s?.postcode ?? null,
    hoursText: s?.hoursText ?? null,
    phone: s?.phone ?? null,
    email: s?.email ?? null,
    licensingText: s?.licensingText ?? null,
    facebookUrl: s?.facebookUrl ?? null,
    instagramUrl: s?.instagramUrl ?? null,
    tickerLines: s?.tickerLines ?? [],
    enquiriesOpen: s?.enquiriesOpen ?? true,
    visualDirection: s?.visualDirection ?? "heritage",
  };

  return (
    <main className="mx-auto max-w-[1100px] px-7 py-10">
      <p className="kicker mb-2">Content</p>
      <h1 className="display text-[clamp(24px,4vw,36px)] text-text-primary">
        Site settings
      </h1>
      <p className="mt-2 mb-6 text-text-muted">
        Studio details, hours, ticker, socials and enquiries.
      </p>
      <SiteEditor values={values} action={saveSite} />
    </main>
  );
}
