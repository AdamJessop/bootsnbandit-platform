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
import { createId } from "../src/lib/db/ids";
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
  role: string;
  styles: string[];
  hue: string;
  tag: string;
  books: "open" | "limited" | "closed";
  exp: string;
  rating: number;
  pieces: number;
  bio: string;
  rateText: string;
  hourlyPence: number | null;
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
    role: "Co-owner",
    styles: ["Fine-line", "Realism"],
    hue: "crimson",
    tag: "Fine-line, florals & black-and-grey",
    books: "open",
    exp: "14 yrs",
    rating: 4.9,
    pieces: 62,
    bio: "Sarah co-founded the studio in 2016. She moves easily between delicate fine-line florals and detailed black-and-grey — snakes, daggers, ornamental work and the odd Vegas skyline. She'll talk you through every step.",
    rateText: "£90/hr · day rate £550",
    hourlyPence: 9000,
    dayRatePence: 55000,
    insta: "@sarah.bnb",
    pic: "https://i.pravatar.cc/480?img=5",
    specials: ["Fine-line", "Floral", "Black & grey"],
    sortOrder: 0,
  },
  {
    slug: "cal",
    name: "Calum",
    role: "Co-owner",
    styles: ["Realism", "Lettering"],
    hue: "ink",
    tag: "Black & grey realism & chicano",
    books: "limited",
    exp: "16 yrs",
    rating: 5.0,
    pieces: 78,
    bio: "The other half of the shop. Calum lives in black-and-grey realism and chicano — portraits, statues, script and money-and-cards sleeves. Calm chair-side manner, brutal detail.",
    rateText: "£95/hr · day rate £600",
    hourlyPence: 9500,
    dayRatePence: 60000,
    insta: "@calum.bnb",
    pic: "https://i.pravatar.cc/480?img=12",
    specials: ["Realism", "Chicano", "Portraits"],
    sortOrder: 1,
  },
  {
    slug: "marnie",
    name: "Amy",
    role: "Resident artist",
    styles: ["Fine-line", "Dotwork & Geometric"],
    hue: "teal",
    tag: "Fine-line, botanical & dotwork",
    books: "open",
    exp: "7 yrs",
    rating: 4.8,
    pieces: 41,
    bio: "Delicate single-needle work, botanicals and fine geometric pieces. Amy loves a dainty first tattoo and will make sure you feel right at home.",
    rateText: "£70/hr · day rate £420",
    hourlyPence: 7000,
    dayRatePence: 42000,
    insta: "@amy.bnb",
    pic: "https://i.pravatar.cc/480?img=9",
    specials: ["First tattoos", "Botanical", "Fine-line"],
    sortOrder: 2,
  },
  {
    slug: "rhodri",
    name: "Alisha",
    role: "Resident artist",
    styles: ["Colour", "Realism"],
    hue: "rust",
    tag: "Colour, realism & neo-traditional",
    books: "limited",
    exp: "11 yrs",
    rating: 4.9,
    pieces: 53,
    bio: "The shop all-rounder — vivid colour peacocks and Disney, black-and-grey portraits and owls, neo-trad animals and the odd Japanese koi. If you can dream it, Alisha can ink it.",
    rateText: "£85/hr · day rate £520",
    hourlyPence: 8500,
    dayRatePence: 52000,
    insta: "@alisha.bnb",
    pic: "https://i.pravatar.cc/480?img=47",
    specials: ["Colour", "Realism", "Neo-traditional"],
    sortOrder: 3,
  },
  {
    slug: "effie",
    name: "Olivia",
    role: "Resident artist",
    styles: ["Realism", "Colour"],
    hue: "plum",
    tag: "Black & grey realism & portraits",
    books: "open",
    exp: "5 yrs",
    rating: 4.7,
    pieces: 34,
    bio: "Olivia loves a realistic portrait — pets, characters and hand pieces in crisp black-and-grey, plus the occasional pop of colour. Warm, patient and great with nervous first-timers.",
    rateText: "£70/hr · day rate £400",
    hourlyPence: 7000,
    dayRatePence: 40000,
    insta: "@olivia.bnb",
    pic: "https://i.pravatar.cc/480?img=45",
    specials: ["Portraits", "Realism", "Pet portraits"],
    sortOrder: 4,
  },
  {
    slug: "joss",
    name: "Holly",
    role: "Resident artist",
    styles: ["Realism", "Dotwork & Geometric"],
    hue: "gold",
    tag: "Realism & geometric sleeves",
    books: "open",
    exp: "9 yrs",
    rating: 4.8,
    pieces: 47,
    bio: "Holly blends black-and-grey realism with sacred-geometry and dotwork — think a roaring tiger framed by honeycomb and mandala. Big, bold, cohesive sleeves are her happy place.",
    rateText: "£75/hr · day rate £450",
    hourlyPence: 7500,
    dayRatePence: 45000,
    insta: "@holly.bnb",
    pic: "https://i.pravatar.cc/480?img=32",
    specials: ["Realism", "Geometric", "Sleeves"],
    sortOrder: 5,
  },
  {
    slug: "priya",
    name: "Tom",
    role: "Apprentice",
    styles: ["Fine-line", "Dotwork & Geometric"],
    hue: "steel",
    tag: "Linework & small pieces · learning fast",
    books: "open",
    exp: "1 yr",
    rating: 4.7,
    pieces: 23,
    bio: "Our apprentice, mentored day-to-day by Sarah and Calum. Tom takes on smaller linework, fine-line and dotwork pieces at a friendly apprentice rate — a lovely first-tattoo choice.",
    rateText: "£45/hr · supervised",
    hourlyPence: 4500,
    dayRatePence: null,
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

const CHAIRS = ["Chair 1", "Chair 2", "Chair 3", "Chair 4"];

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

  // Artists (upsert by slug)
  for (const a of ARTISTS) {
    await sql`
      INSERT INTO "Artist" (
        "id", "slug", "name", "role", "tag", "bio", "styles", "specials", "hue",
        "rateText", "hourlyPence", "dayRatePence", "insta", "headshot",
        "experience", "rating", "pieces", "booksStatus", "sortOrder", "updatedAt"
      ) VALUES (
        ${createId()}, ${a.slug}, ${a.name}, ${a.role}, ${a.tag}, ${a.bio},
        ${a.styles}, ${a.specials}, ${a.hue}, ${a.rateText}, ${a.hourlyPence},
        ${a.dayRatePence}, ${a.insta}, ${a.pic}, ${a.exp}, ${a.rating},
        ${a.pieces}, ${a.books}::"BooksStatus", ${a.sortOrder}, now()
      )
      ON CONFLICT ("slug") DO UPDATE SET
        "name" = EXCLUDED."name", "role" = EXCLUDED."role", "tag" = EXCLUDED."tag",
        "bio" = EXCLUDED."bio", "styles" = EXCLUDED."styles", "specials" = EXCLUDED."specials",
        "hue" = EXCLUDED."hue", "rateText" = EXCLUDED."rateText",
        "hourlyPence" = EXCLUDED."hourlyPence", "dayRatePence" = EXCLUDED."dayRatePence",
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

  // Chairs
  for (let i = 0; i < CHAIRS.length; i++) {
    await sql`
      INSERT INTO "Chair" ("id", "name", "sortOrder", "updatedAt")
      VALUES (${createId()}, ${CHAIRS[i]}, ${i}, now())
      ON CONFLICT ("name") DO UPDATE SET "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = now()
    `;
  }

  // Demo OWNER user + link to Sarah; an ARTIST user linked to Calum.
  await sql`
    INSERT INTO "User" ("id", "email", "role", "displayName", "active", "updatedAt")
    VALUES (${createId()}, 'adamjjessop@gmail.com', 'OWNER'::"Role", 'Adam (Owner)', true, now())
    ON CONFLICT ("email") DO UPDATE SET "role" = EXCLUDED."role", "displayName" = EXCLUDED."displayName", "updatedAt" = now()
  `;
  await sql`
    INSERT INTO "User" ("id", "email", "role", "displayName", "active", "updatedAt")
    VALUES (${createId()}, 'calum@bootsnbandit.co.uk', 'ARTIST'::"Role", 'Calum', true, now())
    ON CONFLICT ("email") DO UPDATE SET "role" = EXCLUDED."role", "displayName" = EXCLUDED."displayName", "updatedAt" = now()
  `;
  const ownerRows = await sql<
    { id: string }[]
  >`SELECT "id" FROM "User" WHERE "email" = 'adamjjessop@gmail.com'`;
  const calRows = await sql<
    { id: string }[]
  >`SELECT "id" FROM "User" WHERE "email" = 'calum@bootsnbandit.co.uk'`;
  const ownerId = ownerRows[0]?.id;
  const calUserId = calRows[0]?.id;
  // Link owner -> Sarah (co-owner), artist user -> Calum.
  if (ownerId) {
    await sql`UPDATE "Artist" SET "userId" = ${ownerId} WHERE "slug" = 'sarah'`;
  }
  if (calUserId) {
    await sql`UPDATE "Artist" SET "userId" = ${calUserId} WHERE "slug" = 'cal'`;
  }

  // A calendar feed token per linked artist (auto-created at enrolment in P4;
  // seed one for each linked artist so iCal work has data).
  for (const slug of ["sarah", "cal"]) {
    const aid = artistIdBySlug.get(slug);
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
    "Chair",
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
