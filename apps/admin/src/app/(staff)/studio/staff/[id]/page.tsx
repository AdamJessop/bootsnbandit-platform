import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@bnb/core/auth";
import { prisma } from "@bnb/core/db";
import {
  ProfileEditor,
  type ProfileEditorValues,
} from "../../../profile/_components/ProfileEditor";
import { saveArtistProfile } from "../../../profile/_lib/actions";

/**
 * Studio › Staff › Edit profile. Owner-only editor for any staff member's
 * artist profile — same ProfileEditor as the self view, plus the owner-only
 * status (title) select. The route param is the **User** id (the staff list is
 * user-centric); we resolve the linked Artist and 404 when there isn't one.
 */
export const dynamic = "force-dynamic";

export default async function StaffProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("OWNER");
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      artist: { include: { styles: { select: { id: true } } } },
    },
  });
  if (!user?.artist) notFound();
  const artist = user.artist;

  const styles = await prisma.tattooStyle.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });

  const values: ProfileEditorValues = {
    status: artist.status,
    bio: artist.bio,
    insta: artist.insta,
    headshot: artist.headshot,
    hourlyRatePence: artist.hourlyRatePence,
    dayRatePence: artist.dayRatePence,
    selectedStyleIds: artist.styles.map((s) => s.id),
    specials: artist.specials,
  };

  const action = saveArtistProfile.bind(null, artist.id);

  return (
    <main className="mx-auto max-w-[1100px] px-7 py-10">
      <Link
        href="/studio/staff"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> Staff &amp; users
      </Link>
      <p className="kicker mb-2">Edit profile</p>
      <h1 className="display text-[clamp(24px,4vw,36px)] text-text-primary">
        {user.displayName}
      </h1>
      <p className="mt-2 mb-8 text-text-muted">{user.email}</p>

      <section>
        <h2 className="mb-4 font-termina text-sm font-bold uppercase tracking-wide text-text-primary">
          Profile &amp; portfolio
        </h2>
        <ProfileEditor
          values={values}
          styles={styles}
          action={action}
          statusEditable
        />
      </section>
    </main>
  );
}
