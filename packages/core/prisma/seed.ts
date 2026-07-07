/**
 * Boots 'n' Bandit — database seed (Phase 2: Data Layer).
 *
 * Idempotent: every upsert keys off a natural unique column (slug / name /
 * email / order / token) and uses `ON CONFLICT ... DO UPDATE`, so re-running
 * the seed converges to the same state without duplicating rows.
 *
 * Content is the canonical seed data from `design-src/data.jsx` and the
 * aftercare / loyalty / studio facts from `design-src/COMPOSITION-NOTES.md`.
 *
 * NOTE: this script talks to Postgres via the `postgres` (porsager) driver
 * rather than the Prisma client. Prisma 7's runtime client needs a driver
 * adapter (`@prisma/adapter-pg`) which is not yet in package.json this wave;
 * porsager `postgres` is already installed, so the seed runs today with zero
 * new dependencies against the schema produced by `prisma migrate`.
 */
import { createId } from "../src/db/ids";
import postgres from "postgres";

const url = (process.env.DATABASE_URL ?? "").replace(/\?.*$/, "");
if (!url) {
  throw new Error("DATABASE_URL is not set (load .env before seeding)");
}
const sql = postgres(url, { onnotice: () => {} });

// ---------------------------------------------------------------------------
// Canonical seed content (from design-src/data.jsx + COMPOSITION-NOTES.md)
// ---------------------------------------------------------------------------

type ArtistSeed = {
  slug: string;
  name: string;
  /** Title within the studio (was free-text `role`). */
  status: "CO_OWNER" | "RESIDENT" | "APPRENTICE";
  /** Linked User login email (every artist is a User, 1:1). */
  email: string;
  /** Access role on the linked User. */
  accessRole: "OWNER" | "ARTIST";
  styles: string[];
  hue: string;
  tag: string;
  books: "open" | "limited" | "closed";
  exp: string;
  rating: number;
  pieces: number;
  bio: string;
  hourlyRatePence: number | null;
  dayRatePence: number | null;
  insta: string;
  pic: string;
  specials: string[];
  sortOrder: number;
};

const ARTISTS: ArtistSeed[] = [
  {
    slug: "sarah",
    name: "Sarah",
    status: "CO_OWNER",
    email: "adamjjessop@gmail.com",
    accessRole: "OWNER",
    styles: ["Fine-line", "Realism"],
    hue: "crimson",
    tag: "Fine-line, florals & black-and-grey",
    books: "open",
    exp: "14 yrs",
    rating: 4.9,
    pieces: 62,
    bio: "Sarah co-founded the studio in 2016. She moves easily between delicate fine-line florals and detailed black-and-grey — snakes, daggers, ornamental work and the odd Vegas skyline. She'll talk you through every step.",
    hourlyRatePence: 9000,
    dayRatePence: 55000,
    insta: "@sarah.bnb",
    pic: "https://i.pravatar.cc/480?img=5",
    specials: ["Fine-line", "Floral", "Black & grey"],
    sortOrder: 0,
  },
  {
    slug: "cal",
    name: "Calum",
    status: "CO_OWNER",
    email: "calum@bootsnbandit.co.uk",
    accessRole: "OWNER",
    styles: ["Realism", "Lettering"],
    hue: "ink",
    tag: "Black & grey realism & chicano",
    books: "limited",
    exp: "16 yrs",
    rating: 5.0,
    pieces: 78,
    bio: "The other half of the shop. Calum lives in black-and-grey realism and chicano — portraits, statues, script and money-and-cards sleeves. Calm chair-side manner, brutal detail.",
    hourlyRatePence: 9500,
    dayRatePence: 60000,
    insta: "@calum.bnb",
    pic: "https://i.pravatar.cc/480?img=12",
    specials: ["Realism", "Chicano", "Portraits"],
    sortOrder: 1,
  },
  {
    slug: "marnie",
    name: "Amy",
    status: "RESIDENT",
    email: "amy@bootsnbandit.co.uk",
    accessRole: "ARTIST",
    styles: ["Fine-line", "Dotwork & Geometric"],
    hue: "teal",
    tag: "Fine-line, botanical & dotwork",
    books: "open",
    exp: "7 yrs",
    rating: 4.8,
    pieces: 41,
    bio: "Delicate single-needle work, botanicals and fine geometric pieces. Amy loves a dainty first tattoo and will make sure you feel right at home.",
    hourlyRatePence: 7000,
    dayRatePence: 42000,
    insta: "@amy.bnb",
    pic: "https://i.pravatar.cc/480?img=9",
    specials: ["First tattoos", "Botanical", "Fine-line"],
    sortOrder: 2,
  },
  {
    slug: "rhodri",
    name: "Alisha",
    status: "RESIDENT",
    email: "alisha@bootsnbandit.co.uk",
    accessRole: "ARTIST",
    styles: ["Colour", "Realism"],
    hue: "rust",
    tag: "Colour, realism & neo-traditional",
    books: "limited",
    exp: "11 yrs",
    rating: 4.9,
    pieces: 53,
    bio: "The shop all-rounder — vivid colour peacocks and Disney, black-and-grey portraits and owls, neo-trad animals and the odd Japanese koi. If you can dream it, Alisha can ink it.",
    hourlyRatePence: 8500,
    dayRatePence: 52000,
    insta: "@alisha.bnb",
    pic: "https://i.pravatar.cc/480?img=47",
    specials: ["Colour", "Realism", "Neo-traditional"],
    sortOrder: 3,
  },
  {
    slug: "effie",
    name: "Olivia",
    status: "RESIDENT",
    email: "olivia@bootsnbandit.co.uk",
    accessRole: "ARTIST",
    styles: ["Realism", "Colour"],
    hue: "plum",
    tag: "Black & grey realism & portraits",
    books: "open",
    exp: "5 yrs",
    rating: 4.7,
    pieces: 34,
    bio: "Olivia loves a realistic portrait — pets, characters and hand pieces in crisp black-and-grey, plus the occasional pop of colour. Warm, patient and great with nervous first-timers.",
    hourlyRatePence: 7000,
    dayRatePence: 40000,
    insta: "@olivia.bnb",
    pic: "https://i.pravatar.cc/480?img=45",
    specials: ["Portraits", "Realism", "Pet portraits"],
    sortOrder: 4,
  },
  {
    slug: "joss",
    name: "Holly",
    status: "RESIDENT",
    email: "holly@bootsnbandit.co.uk",
    accessRole: "ARTIST",
    styles: ["Realism", "Dotwork & Geometric"],
    hue: "gold",
    tag: "Realism & geometric sleeves",
    books: "open",
    exp: "9 yrs",
    rating: 4.8,
    pieces: 47,
    bio: "Holly blends black-and-grey realism with sacred-geometry and dotwork — think a roaring tiger framed by honeycomb and mandala. Big, bold, cohesive sleeves are her happy place.",
    hourlyRatePence: 7500,
    dayRatePence: 45000,
    insta: "@holly.bnb",
    pic: "https://i.pravatar.cc/480?img=32",
    specials: ["Realism", "Geometric", "Sleeves"],
    sortOrder: 5,
  },
  {
    slug: "priya",
    name: "Tom",
    status: "APPRENTICE",
    email: "tom@bootsnbandit.co.uk",
    accessRole: "ARTIST",
    styles: ["Fine-line", "Dotwork & Geometric"],
    hue: "steel",
    tag: "Linework & small pieces · learning fast",
    books: "open",
    exp: "1 yr",
    rating: 4.7,
    pieces: 23,
    bio: "Our apprentice, mentored day-to-day by Sarah and Calum. Tom takes on smaller linework, fine-line and dotwork pieces at a friendly apprentice rate — a lovely first-tattoo choice.",
    hourlyRatePence: 4500,
    dayRatePence: 27000,
    insta: "@tom.bnb",
    pic: "https://i.pravatar.cc/480?img=14",
    specials: ["First tattoos", "Small pieces", "Linework"],
    sortOrder: 6,
  },
];

const STYLES = [
  "Blackwork",
  "Neo-traditional",
  "Fine-line",
  "Japanese",
  "Realism",
  "Colour",
  "Dotwork & Geometric",
  "Lettering",
  "Anime & New-school",
];

type GallerySeed = {
  n: number;
  artist: string;
  style: string;
  title: string;
  hue: string;
  placement: string;
  big?: boolean;
};
const GALLERY: GallerySeed[] = [
  {
    n: 1,
    artist: "sarah",
    style: "Fine-line",
    title: "Ornamental snake & dagger",
    hue: "crimson",
    placement: "Calf",
    big: true,
  },
  {
    n: 2,
    artist: "sarah",
    style: "Colour",
    title: "Red ink floral sleeve",
    hue: "crimson",
    placement: "Full sleeve",
  },
  {
    n: 3,
    artist: "joss",
    style: "Realism",
    title: "Tiger & geometric sleeve",
    hue: "ink",
    placement: "Sleeve",
    big: true,
  },
  {
    n: 4,
    artist: "sarah",
    style: "Realism",
    title: "Vegas & Colosseum panels",
    hue: "steel",
    placement: "Upper arm",
  },
  {
    n: 5,
    artist: "sarah",
    style: "Realism",
    title: "Chicano girl & cards",
    hue: "ink",
    placement: "Thigh",
  },
  {
    n: 6,
    artist: "effie",
    style: "Realism",
    title: "Davy Jones hand piece",
    hue: "steel",
    placement: "Hand",
  },
  {
    n: 7,
    artist: "rhodri",
    style: "Realism",
    title: "Pennywise portrait",
    hue: "ink",
    placement: "Upper arm",
  },
  {
    n: 8,
    artist: "cal",
    style: "Lettering",
    title: "No Risk No Reward chicano",
    hue: "steel",
    placement: "Forearm",
  },
  {
    n: 9,
    artist: "rhodri",
    style: "Colour",
    title: "Peacock & peony",
    hue: "teal",
    placement: "Calf",
    big: true,
  },
  {
    n: 10,
    artist: "cal",
    style: "Realism",
    title: "Spartan & wing",
    hue: "ink",
    placement: "Forearm",
  },
  {
    n: 11,
    artist: "rhodri",
    style: "Neo-traditional",
    title: "Neo-trad deer",
    hue: "rust",
    placement: "Forearm",
  },
  {
    n: 12,
    artist: "effie",
    style: "Realism",
    title: "Staffy portrait",
    hue: "steel",
    placement: "Thigh",
  },
  {
    n: 13,
    artist: "rhodri",
    style: "Colour",
    title: "Maleficent",
    hue: "plum",
    placement: "Thigh",
  },
  {
    n: 14,
    artist: "rhodri",
    style: "Blackwork",
    title: "Horned skull & dagger",
    hue: "ink",
    placement: "Forearm",
  },
  {
    n: 15,
    artist: "cal",
    style: "Realism",
    title: "Davy Jones portrait",
    hue: "ink",
    placement: "Thigh",
    big: true,
  },
  {
    n: 16,
    artist: "marnie",
    style: "Fine-line",
    title: "Flowers & sword",
    hue: "teal",
    placement: "Shin",
  },
  {
    n: 17,
    artist: "rhodri",
    style: "Realism",
    title: "Barn owl & moon",
    hue: "ink",
    placement: "Upper arm",
  },
  {
    n: 18,
    artist: "sarah",
    style: "Fine-line",
    title: "Dragon & peony",
    hue: "crimson",
    placement: "Forearm",
    big: true,
  },
  {
    n: 19,
    artist: "marnie",
    style: "Fine-line",
    title: "Ornate sword",
    hue: "teal",
    placement: "Thigh",
  },
  {
    n: 20,
    artist: "marnie",
    style: "Colour",
    title: "Orange blossom & jasmine",
    hue: "gold",
    placement: "Chest",
  },
  {
    n: 21,
    artist: "sarah",
    style: "Fine-line",
    title: "Floral hand & wrist",
    hue: "crimson",
    placement: "Hand",
  },
  {
    n: 22,
    artist: "rhodri",
    style: "Japanese",
    title: "Koi & lotus",
    hue: "rust",
    placement: "Forearm",
    big: true,
  },
  {
    n: 23,
    artist: "rhodri",
    style: "Fine-line",
    title: "Bee & ornamental filigree",
    hue: "gold",
    placement: "Forearm",
  },
  {
    n: 24,
    artist: "marnie",
    style: "Fine-line",
    title: "Sun & moon",
    hue: "teal",
    placement: "Shin",
  },
  {
    n: 25,
    artist: "sarah",
    style: "Fine-line",
    title: "Peony shoulder cap",
    hue: "crimson",
    placement: "Shoulder",
  },
  {
    n: 26,
    artist: "sarah",
    style: "Fine-line",
    title: "Lily & blossom arm wrap",
    hue: "crimson",
    placement: "Forearm",
  },
];

type FlashSeed = {
  key: string;
  title: string;
  artist: string;
  hue: string;
  size: string;
  pricePence: number;
  total: number;
  claimed: number;
  deadline: string;
  sortOrder: number;
};
const FLASH: FlashSeed[] = [
  {
    key: "f1",
    title: "Pearl Shell",
    artist: "marnie",
    hue: "teal",
    size: "~11cm",
    pricePence: 13000,
    total: 3,
    claimed: 1,
    deadline: "Sat 7 Jun",
    sortOrder: 0,
  },
  {
    key: "f2",
    title: "Tribal Turtle",
    artist: "joss",
    hue: "ink",
    size: "~10cm",
    pricePence: 14000,
    total: 3,
    claimed: 2,
    deadline: "Sat 7 Jun",
    sortOrder: 1,
  },
  {
    key: "f3",
    title: "Motel Key",
    artist: "marnie",
    hue: "gold",
    size: "~9cm",
    pricePence: 11000,
    total: 4,
    claimed: 1,
    deadline: "Sat 7 Jun",
    sortOrder: 2,
  },
  {
    key: "f4",
    title: "Cat-Eye Shades",
    artist: "effie",
    hue: "ink",
    size: "~8cm",
    pricePence: 10000,
    total: 4,
    claimed: 0,
    deadline: "Sun 8 Jun",
    sortOrder: 3,
  },
  {
    key: "f5",
    title: "Heart Koi",
    artist: "rhodri",
    hue: "crimson",
    size: "~14cm",
    pricePence: 17000,
    total: 2,
    claimed: 1,
    deadline: "Sun 8 Jun",
    sortOrder: 4,
  },
  {
    key: "f6",
    title: "Hibiscus Ray",
    artist: "sarah",
    hue: "gold",
    size: "~12cm",
    pricePence: 15000,
    total: 3,
    claimed: 0,
    deadline: "Sun 8 Jun",
    sortOrder: 5,
  },
  {
    key: "f7",
    title: "Hibiscus Shark",
    artist: "joss",
    hue: "ink",
    size: "~13cm",
    pricePence: 16000,
    total: 2,
    claimed: 1,
    deadline: "Sat 14 Jun",
    sortOrder: 6,
  },
  {
    key: "f8",
    title: "Beach Sunset",
    artist: "sarah",
    hue: "gold",
    size: "~9cm",
    pricePence: 12000,
    total: 4,
    claimed: 2,
    deadline: "Sat 14 Jun",
    sortOrder: 7,
  },
  {
    key: "f9",
    title: "Blossom Whale",
    artist: "rhodri",
    hue: "crimson",
    size: "~16cm",
    pricePence: 20000,
    total: 2,
    claimed: 1,
    deadline: "Sat 14 Jun",
    sortOrder: 8,
  },
];

const FAQS = [
  {
    q: "Do I need to pay anything to enquire?",
    a: "No — making an enquiry and your 15-minute consultation are completely free, with no obligation. If you decide to go ahead, your artist may arrange a small deposit to secure your appointment, and it always comes off your final price.",
  },
  {
    q: "How old do I have to be?",
    a: "18 and over, no exceptions, even with parental consent — it is UK law. Please bring photo ID (passport or driving licence) to your first appointment.",
  },
  {
    q: "Does it hurt?",
    a: "Honestly, a bit — but most people find it far more manageable than they feared. Ribs and feet are spicier than forearms. We go at your pace, with breaks whenever you need them.",
  },
  {
    q: "How should I prepare?",
    a: "Eat a proper meal, stay hydrated, get a good sleep and avoid alcohol the night before. Wear comfy clothes that give easy access to the area being tattooed.",
  },
  {
    q: "Can you cover an old tattoo?",
    a: "Often, yes. Make an enquiry for a cover-up and add a clear photo to your mood board. Calum and Alisha specialise in cover-ups and will tell you honestly what is possible.",
  },
  {
    q: "Do you take walk-ins?",
    a: "When an artist has a gap, yes — make an enquiry to see the latest availability, or follow us on Facebook for same-day openings.",
  },
  {
    q: "Is the studio clean and licensed?",
    a: "Fully licensed by Bassetlaw District Council. Single-use needles, hospital-grade sterilisation, and every artist holds a current bloodborne-pathogens certificate.",
  },
];

const AFTERCARE = [
  {
    order: 0,
    title: "Day 1–2 · Fresh & wrapped",
    hue: "crimson",
    body: "Care: keep the wrap on as your artist advised; first wash with lukewarm water and fragrance-free soap; pat dry, never rub. How it feels: tender, warm and a little swollen; some plasma weeping is normal.",
  },
  {
    order: 1,
    title: "Day 3–6 · Settling in",
    hue: "gold",
    body: "Care: apply a thin layer of balm 2–3 times a day; wear loose clothing; keep showers short and avoid soaking. How it feels: tightness as it dries out; the tattoo may look a little duller.",
  },
  {
    order: 2,
    title: "Day 7–14 · The itchy peel",
    hue: "teal",
    body: "Care: do NOT pick or scratch; tap if it itches and keep moisturising; skip the gym sweat and tight straps. How it feels: flaky, itchy and scabby as the colour settles.",
  },
  {
    order: 3,
    title: "Day 15–30 · Almost there",
    hue: "moss",
    body: "Care: moisturise once a day; no pools, saunas or baths; a milky sheen over the tattoo is normal. How it feels: the surface is healed while the deeper layers finish.",
  },
  {
    order: 4,
    title: "Day 30+ · Healed",
    hue: "gold",
    body: "Care: SPF 30+ in the sun forever; keep moisturising; book a free touch-up if you need one. How it feels: fully healed.",
  },
];

const LOYALTY_PERKS = [
  {
    stamps: 2,
    title: "Birthday treat",
    desc: "10% off in your birthday month.",
  },
  {
    stamps: 4,
    title: "Early flash access",
    desc: "Claim flash 24h before the public drop.",
  },
  {
    stamps: 6,
    title: "Priority booking",
    desc: "Skip the waitlist on open books.",
  },
  {
    stamps: 8,
    title: "Free small tattoo",
    desc: "A palm-size piece on the house.",
  },
];

const TICKER_LINES = [
  "Now taking enquiries · Summer 2026",
  "Flash drop this Saturday",
  "Free 15-min consultations",
  "Sarah & Marnie · books open",
  "Walk-ins when the chairs are free",
  "Worksop, Nottinghamshire",
];

// ---------------------------------------------------------------------------
// Seed routine (idempotent upserts)
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // Styles
  for (let i = 0; i < STYLES.length; i++) {
    await sql`
      INSERT INTO "TattooStyle" ("id", "name", "sortOrder", "updatedAt")
      VALUES (${createId()}, ${STYLES[i]}, ${i}, now())
      ON CONFLICT ("name") DO UPDATE SET "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = now()
    `;
  }

  // Users — one per artist, 1:1. Created BEFORE artists because Artist.userId is
  // required (NOT NULL). Keyed by email.
  for (const a of ARTISTS) {
    await sql`
      INSERT INTO "User" ("id", "email", "role", "displayName", "active", "updatedAt")
      VALUES (${createId()}, ${a.email}, ${a.accessRole}::"Role", ${a.name}, true, now())
      ON CONFLICT ("email") DO UPDATE SET
        "role" = EXCLUDED."role", "displayName" = EXCLUDED."displayName",
        "active" = true, "updatedAt" = now()
    `;
  }
  const userRows = await sql<
    { id: string; email: string }[]
  >`SELECT "id", "email" FROM "User"`;
  const userIdByEmail = new Map(userRows.map((r) => [r.email, r.id]));

  // Style id lookup (styles already seeded above) for the m-n connect.
  const styleRows = await sql<
    { id: string; name: string }[]
  >`SELECT "id", "name" FROM "TattooStyle"`;
  const styleIdByName = new Map(styleRows.map((r) => [r.name, r.id]));

  // Artists (upsert by slug). `status` replaces free-text role; numeric rates
  // only; styles are connected via the _ArtistToTattooStyle join below.
  for (const a of ARTISTS) {
    const userId = userIdByEmail.get(a.email);
    if (!userId)
      throw new Error(`Missing user for artist ${a.slug} (${a.email})`);
    await sql`
      INSERT INTO "Artist" (
        "id", "slug", "userId", "name", "status", "tag", "bio", "specials", "hue",
        "hourlyRatePence", "dayRatePence", "insta", "headshot",
        "experience", "rating", "pieces", "booksStatus", "sortOrder", "updatedAt"
      ) VALUES (
        ${createId()}, ${a.slug}, ${userId}, ${a.name}, ${a.status}::"ArtistStatus",
        ${a.tag}, ${a.bio}, ${a.specials}, ${a.hue}, ${a.hourlyRatePence},
        ${a.dayRatePence}, ${a.insta}, ${a.pic}, ${a.exp}, ${a.rating},
        ${a.pieces}, ${a.books}::"BooksStatus", ${a.sortOrder}, now()
      )
      ON CONFLICT ("slug") DO UPDATE SET
        "userId" = EXCLUDED."userId", "name" = EXCLUDED."name",
        "status" = EXCLUDED."status", "tag" = EXCLUDED."tag", "bio" = EXCLUDED."bio",
        "specials" = EXCLUDED."specials", "hue" = EXCLUDED."hue",
        "hourlyRatePence" = EXCLUDED."hourlyRatePence",
        "dayRatePence" = EXCLUDED."dayRatePence",
        "insta" = EXCLUDED."insta", "headshot" = EXCLUDED."headshot",
        "experience" = EXCLUDED."experience", "rating" = EXCLUDED."rating",
        "pieces" = EXCLUDED."pieces", "booksStatus" = EXCLUDED."booksStatus",
        "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = now()
    `;
  }

  const artistRows = await sql<
    { id: string; slug: string }[]
  >`SELECT "id", "slug" FROM "Artist"`;
  const artistIdBySlug = new Map(artistRows.map((r) => [r.slug, r.id]));

  // Connect each artist's styles by name via the implicit m-n join table.
  for (const a of ARTISTS) {
    const artistId = artistIdBySlug.get(a.slug);
    if (!artistId) continue;
    for (const styleName of a.styles) {
      const styleId = styleIdByName.get(styleName);
      if (!styleId) {
        throw new Error(`Unknown style "${styleName}" for artist ${a.slug}`);
      }
      await sql`
        INSERT INTO "_ArtistToTattooStyle" ("A", "B")
        VALUES (${artistId}, ${styleId})
        ON CONFLICT ("A", "B") DO NOTHING
      `;
    }
  }

  // Gallery (upsert by title — titles are unique in the seed set)
  for (const g of GALLERY) {
    const artistId = artistIdBySlug.get(g.artist) ?? null;
    await sql`
      INSERT INTO "GalleryItem" (
        "id", "artistId", "style", "title", "placement", "hue", "featured", "sortOrder", "updatedAt"
      ) VALUES (
        ${createId()}, ${artistId}, ${g.style}, ${g.title}, ${g.placement}, ${g.hue}, ${Boolean(g.big)}, ${g.n}, now()
      )
      ON CONFLICT ("title") DO UPDATE SET
        "artistId" = EXCLUDED."artistId", "style" = EXCLUDED."style",
        "placement" = EXCLUDED."placement", "hue" = EXCLUDED."hue",
        "featured" = EXCLUDED."featured", "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = now()
    `;
  }

  // Flash (upsert by title)
  for (const f of FLASH) {
    const artistId = artistIdBySlug.get(f.artist) ?? null;
    const status = f.claimed >= f.total ? "claimed" : "available";
    await sql`
      INSERT INTO "Flash" (
        "id", "artistId", "title", "hue", "sizeCm", "pricePence", "total", "claimed", "deadline", "status", "sortOrder", "updatedAt"
      ) VALUES (
        ${createId()}, ${artistId}, ${f.title}, ${f.hue}, ${f.size}, ${f.pricePence}, ${f.total}, ${f.claimed}, ${f.deadline}, ${status}::"FlashStatus", ${f.sortOrder}, now()
      )
      ON CONFLICT ("title") DO UPDATE SET
        "artistId" = EXCLUDED."artistId", "hue" = EXCLUDED."hue", "sizeCm" = EXCLUDED."sizeCm",
        "pricePence" = EXCLUDED."pricePence", "total" = EXCLUDED."total", "claimed" = EXCLUDED."claimed",
        "deadline" = EXCLUDED."deadline", "status" = EXCLUDED."status", "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = now()
    `;
  }

  // FAQs (upsert by question)
  for (let i = 0; i < FAQS.length; i++) {
    await sql`
      INSERT INTO "Faq" ("id", "question", "answer", "sortOrder", "updatedAt")
      VALUES (${createId()}, ${FAQS[i].q}, ${FAQS[i].a}, ${i}, now())
      ON CONFLICT ("question") DO UPDATE SET "answer" = EXCLUDED."answer", "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = now()
    `;
  }

  // Aftercare stages (upsert by order)
  for (const s of AFTERCARE) {
    await sql`
      INSERT INTO "AftercareStage" ("id", "order", "title", "body", "hue", "updatedAt")
      VALUES (${createId()}, ${s.order}, ${s.title}, ${s.body}, ${s.hue}, now())
      ON CONFLICT ("order") DO UPDATE SET "title" = EXCLUDED."title", "body" = EXCLUDED."body", "hue" = EXCLUDED."hue", "updatedAt" = now()
    `;
  }

  // Loyalty config (singleton, keyed by name)
  await sql`
    INSERT INTO "LoyaltyConfig" (
      "id", "name", "stampsPerVisit", "rewardThreshold", "rewardDesc", "expiryMonths", "perks", "messaging", "active", "updatedAt"
    ) VALUES (
      ${createId()}, 'Bandit Pass', 1, 8,
      'Free small tattoo — a palm-size piece on the house — when your 8-stamp card is full.',
      24, ${sql.json(LOYALTY_PERKS)},
      'One stamp per piece. Perks unlock at 2, 4, 6 and 8 stamps.', true, now()
    )
    ON CONFLICT ("name") DO UPDATE SET
      "stampsPerVisit" = EXCLUDED."stampsPerVisit", "rewardThreshold" = EXCLUDED."rewardThreshold",
      "rewardDesc" = EXCLUDED."rewardDesc", "expiryMonths" = EXCLUDED."expiryMonths",
      "perks" = EXCLUDED."perks", "messaging" = EXCLUDED."messaging", "updatedAt" = now()
  `;

  // Site settings (singleton, keyed by studioName)
  await sql`
    INSERT INTO "SiteSettings" (
      "id", "studioName", "addressLine", "city", "county", "postcode", "hoursText",
      "licensingText", "facebookUrl", "tickerLines", "enquiriesOpen", "visualDirection", "updatedAt"
    ) VALUES (
      ${createId()}, ${"Boots 'n' Bandit Tattoo Studio"}, '67 Newcastle Avenue', 'Worksop',
      'Nottinghamshire', 'S80 1LX', 'Tue–Sat 10am–6pm · Closed Sun & Mon',
      'Licensed by Bassetlaw District Council',
      'https://www.facebook.com/profile.php?id=61562021309387',
      ${TICKER_LINES}, true, 'heritage', now()
    )
    ON CONFLICT ("studioName") DO UPDATE SET
      "addressLine" = EXCLUDED."addressLine", "city" = EXCLUDED."city", "county" = EXCLUDED."county",
      "postcode" = EXCLUDED."postcode", "hoursText" = EXCLUDED."hoursText",
      "licensingText" = EXCLUDED."licensingText", "facebookUrl" = EXCLUDED."facebookUrl",
      "tickerLines" = EXCLUDED."tickerLines", "updatedAt" = now()
  `;

  // A calendar feed token per artist (auto-created at enrolment in P4; seed one
  // for every artist so iCal work has data for the whole crew).
  for (const a of ARTISTS) {
    const aid = artistIdBySlug.get(a.slug);
    if (!aid) continue;
    await sql`
      INSERT INTO "CalendarFeed" ("id", "artistId", "token", "updatedAt")
      VALUES (${createId()}, ${aid}, ${createId() + createId()}, now())
      ON CONFLICT ("artistId") DO NOTHING
    `;
  }

  // Report counts.
  const counts: Record<string, number> = {};
  for (const t of [
    "Artist",
    "GalleryItem",
    "Flash",
    "TattooStyle",
    "Faq",
    "AftercareStage",
    "LoyaltyConfig",
    "SiteSettings",
    "User",
    "CalendarFeed",
  ]) {
    const r = await sql.unsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM "${t}"`,
    );
    counts[t] = r[0].n;
  }
  console.log("Seed complete:", JSON.stringify(counts));
}

main()
  .then(() => sql.end())
  .catch(async (err) => {
    console.error("Seed failed:", err);
    await sql.end();
    process.exit(1);
  });
