# Public Site — Page Composition Guide (from imported prototype JSX)

> Durable reference for rebuilding the public `(site)` as Next.js Server Components. Visual language = `styles.css` + `styles-pages.css` (already on disk). Content = `data.jsx`. This file captures the **section composition, microcopy, and component usage** of each page so the rebuild is faithful. Shared components (port to React): `SectionHead{eyebrow,title,sub,action,center}`, `BooksBadge{status}`, `Stars{value}`, `ArtistAvatar{artist,size}`, `ArtistCard{artist}`, `GalleryTile{item,onOpen}`, `StatTile{num,label,tone}`, `Modal{open,onClose,wide}`, `BodyMap{active,onPick}` (8 zones: Upper arm/Forearm/Chest/Ribs/Thigh/Calf/Shoulder/Back), `Plate` (procedural placeholder; props seed/hue/src/ratio/face/photo/paper for flash), `Filigree`, `Mark`, `Icon` (→ lucide), `ornDot()` (4-point star eyebrow dot).

## Nav / shell (app.jsx)
Sticky nav (`.nav`, blur, 72px) + optional crimson `.ticker` (34px, marquee). Brand = logo img + "Boots 'n' Bandit / TATTOO STUDIO". Links: Home, Artists, Gallery, **Inkling** (AI_BRAND), Enquire, Flash, Aftercare, Studio. Actions: Bandit Pass (award icon) + "Make an enquiry" btn + burger (mobile). `data-direction` heritage|grit|noir on root. Footer: 4 cols (brand+socials, Explore, Visit, Studio address Tue–Sat 10–6). Ticker lines in data.jsx.

## Home (`home`)
1. **HomeHero** — `.hero` full-bleed: ribbon "Books open · now taking Summer 2026" (pulse dot); `h1.display.chrome` "Boots 'n' Bandit"; `Filigree`; sub copy (Worksop, seven resident artists, "proper brew"); CTAs: "Make an enquiry" → book, "Find my artist with Inkling" → ai; meta row: map-pin "67 Newcastle Avenue, Worksop" · star "4.9 from 380+ reviews" · shield-check "Fully licensed studio"; scroll chevron.
2. **HomeStats** (`.stat-strip`) — StatTile: 7 Resident artists (crimson) · 10+ Years in Worksop (gold) · 4.9 Average rating (teal) · 12k+ Pieces & counting.
3. **AIteaser** (Inkling) — eyebrow Inkling; "Not sure where to start?"; two rows: **Style Matcher** (compass) "Answer a few questions, get matched to the right artist" → ai{tab:'match'}; **Mood Board** (image) "Gather inspiration from the web and our work into one board" → ai{tab:'mood'}. Art: Plate with orbiting style chips (Fine-line/Blackwork/Japanese/Colour) + sparkles core. NOTE per decision: matcher = deterministic formula; mood board = capture only.
4. **HomeArtists** — SectionHead "The crew / Meet the artists" + "All artists" action; grid of first 4 ArtistCard (fade-up stagger 60ms).
5. **HomeGallery** (bg-base) — "Fresh ink / Recent work" + "Full gallery"; `.gallery-masonry` first 8 GalleryTile → gallery{open:id}.
6. **HomeFlash** — `.flash-band`: eyebrow crimson "Flash drop · this weekend"; "Claim a one-off design"; "See all flash"; row of 3 flash-mini (paper Plate, title, price·size, "{left} of {total} left"/"Claimed").
7. **HomePassport** — `.passport-band`: mini Bandit Pass card (Mark, "BANDIT PASS", "A. Collector", 8 stamp cells 4 filled, "Level 2 · Outlaw  4/8"); copy "Loyalty, reimagined / The Bandit Pass" — stamp per piece, perks: priority flash claims, birthday discounts, free small tattoo when card full; "View your pass" (gold) → passport.
8. **HomeReviews** (bg-base) — "Kind words / What people say" center; 3 review cards (5 stars, quote, ArtistAvatar + name "with {artist}"). Sample reviews: Hannah M./Marnie (fine-line first tattoo), Dec R./Cal (blackwork half-sleeve), Priya K./Sarah (colour).
9. **CTABand** — "Ready when you are / Let's make something you'll wear forever."; "Free 15-minute consultations, every week."; CTAs enquiry + "Find the studio".

## Artists (`artists`) — list + detail (param `artist`)
- **ArtistsList**: page-head eyebrow "The crew" + h1 "Our artists" + lead; filter chips: Everyone / Books open / Limited slots / Waitlist (filters on `books`); `.artist-grid.wide` of ArtistCard (fade-up 50ms).
- **ArtistDetail**: `.artist-hero` (Plate bg + veil); breadcrumb "All artists"; portrait Plate (face, 3/4) + copy: kicker "{role} · {exp} experience", h1 name, lead tag, BooksBadge + Stars + "{pieces} pieces", bio; CTAs: if books≠closed "Enquire with {first}" → book{artist}, else "Join the waitlist" → book{artist,wait}; "Is this my artist?" → ai{tab:'match'}. Meta strip: Specialisms (tag-crimson), Styles (tag-gold), Rates (`daily`), Find them (`insta` gold). Portfolio: SectionHead "Work by {first}" + masonry of that artist's GALLERY items (empty → "Portfolio coming soon."). CTABand.

## Gallery (`gallery`) — filterable + lightbox (params artist/open)
- page-head "The wall / Gallery" + lead. Filters: Style chips (All + STYLES), Artist chips (All + ARTISTS first names, gold variant). Count "{n} pieces". `.gallery-masonry` of GalleryTile. Empty state (Mark + "No pieces match…" + Reset).
- **GalleryLightbox** (Modal wide): Plate art + side: kicker style, title, ArtistAvatar+name/role, meta Placement/Style, copy "Like this piece? …we never copy another person's tattoo."; CTAs "Enquire about this style" → book{artist,styles:[style],subject:title}, "View {first}'s profile"; prev/next nav (wraps within filtered set).

## Flash (`flash`) — claim + placement (param open)
- page-head crimson eyebrow "Flash drops" / "Claim a one-off" + lead; `.flash-countdown` (flame) "Next drop closes Saturday 7 June / New flash every Friday at 6pm". Group FLASH by `deadline` → `.flash-group` ("Live until {deadline}", "{n} available"); `.flash-grid` (4-col) of flash-card: paper Plate + stock badge ("{left} of {total} left"/"All claimed", low if ≤1), title, price (gold), ArtistAvatar+name+size, claim btn (disabled if gone/claimed). Note card: "Want something custom instead?… Make an enquiry →".
- **ClaimModal** (wide): stage place → Plate(paper) + BodyMap placement pick + price row + "Claim this design" (disabled until placement) → stage done: check orb, "{title} is yours", "Held for 24 hours on your {placement}. Make an enquiry with {first} to lock it in.", CTAs "Enquire to claim" → book{artist,subject:title} / "Keep browsing". (Real app: claim → creates Enquiry source=flash, decrements availability.)

## Still to fetch from design project (lower priority, fetch when building P7/P8):
`pages-book.jsx` (Enquire form + body map + artist/style/placement/budget + mood board), `pages-ai.jsx` (Inkling: Style Matcher questionnaire + Mood Board), `pages-aftercare.jsx` (aftercare stages + FAQ accordion), `pages-studio.jsx` (location/hours/map/vouchers), `pages-passport.jsx` (Bandit Pass detail/tiers), `moodboard.jsx`. These can be pulled in-session via DesignSync get_file → persisted → python extract (cheap) when their phase starts.

---

# Algorithms, flows & seed content (from book/ai/aftercare/studio/passport JSX)

## Inkling Style Matcher — deterministic scoring (port to P8 `lib/services/match.ts`)
5 questions → ranked artists. Question option→style maps:
- **VIBES** (weight ×3): trad→[Neo-traditional,Lettering]; fine→[Fine-line,Dotwork & Geometric]; dark→[Blackwork,Japanese]; play→[Anime & New-school,Colour]; real→[Realism,Colour]; geo→[Dotwork & Geometric,Blackwork].
- **SUBJECTS** (×2): animal→[Neo-traditional,Realism,Japanese]; floral→[Fine-line,Neo-traditional,Colour]; portrait→[Realism]; words→[Lettering]; pattern→[Dotwork & Geometric,Blackwork]; anime→[Anime & New-school]; unsure→[].
- **COLOURS** (×1.5): bw(Black & grey)→[Blackwork,Realism,Dotwork & Geometric,Fine-line,Lettering]; bold→[Colour,Neo-traditional,Anime & New-school,Japanese]; touch→[Neo-traditional,Japanese,Colour].
- **placement** (PLACEMENTS list) and **exp** (first/few/heavy) also collected.

Scoring: build style-weight map from the three weighted maps. For each artist: `raw = sum(styleWeight[s] for s in artist.styles)`; `matched = artist.styles ∩ weightedStyles`; books bonus `open +1.2 / limited +0.4`; if `exp==='first'` and artist has special 'First tattoos' or style 'Fine-line' then `+1.5`. Sort desc by raw. `max = top.raw || 1`. Display `pct = round(clamp(38, 98, raw/max*92 + (i===0?6:0) - i*1.5))`. Show top 4 (rank 0 = "Best fit" gold tag, shows matched styles "Strong in X, Y"), each → Enquire / Profile. In real app the match result + answers should be stored on the created Enquiry (source=inkling).

## Enquiry flow (book) — 5 steps (port to P8 public Enquire)
Steps: **Artist** (pick one or "No preference — match me") → **Your idea** (styles up to 3 chips; subject textarea; placement select from PLACEMENTS; rough size: Small/Medium/Large/Not sure yet) → **Mood board** (capture references; embedded MoodBoard) → **Consultation** (general availability: Weekends only / Weekday evenings / Weekday daytimes / Flexible; optional day chips Mon–Sun; then pick a free **15-minute consult** slot from a month calendar — working days Tue–Sat, CONSULT_TIMES 10:00,10:45,11:30,13:15,14:00,15:30,16:15; day status open/limited/full) → **Details** (name, phone, email, notes; summary aside) → success ("Enquiry sent", consult TBC/confirmed, N references attached). No deposit, no payment. Creates Enquiry (+ optional consult Booking type=consult). Real app: availability/slots come from artist AvailabilityRule + existing Bookings + Leave.

## Aftercare healing stages — seed `AftercareStage` (5, ordered) + the emailed aftercare link content
0. **Day 1–2 · Fresh & wrapped** (crimson) — care: keep wrap on as advised; first wash lukewarm + fragrance-free soap; pat dry never rub. feel: tender, warm, swollen; plasma weeping normal.
1. **Day 3–6 · Settling in** (gold) — thin balm 2–3×/day; loose clothing; short showers, no soaking. feel: tightness as it dries; may look duller.
2. **Day 7–14 · The itchy peel** (teal) — do NOT pick/scratch; tap if itchy, keep moisturising; skip gym sweat & tight straps. feel: flaky, itchy, scabby; colour settling.
3. **Day 15–30 · Almost there** (moss) — moisturise once/day; no pools/saunas/baths; milky sheen normal. feel: surface healed, deeper layers finishing.
4. **Day 30+ · Healed** (gold) — SPF 30+ in sun forever; moisturise; book free touch-up if needed. feel: fully healed.
Aftercare page also has Do (wash gently/moisturise thinly/protect from sun) & Don't (no pick/scratch, no soaking 2–3wk, no tight clothing), a "something not right?" help card (free touch-ups within 3 months), and the FAQ accordion (FAQS from data.jsx). Healing tracker lets user enter "days since" → highlights stage.

## Bandit Pass loyalty — seed `LoyaltyConfig` + perks ladder (P11 config, P7 passport page)
Card = **8 stamps** (one per piece). Tier label e.g. "Level 2 · Outlaw". Perks ladder (unlock at N stamps):
- **2** — Birthday treat: 10% off in your birthday month.
- **4** — Early flash access: claim flash 24h before public drop.
- **6** — Priority booking: skip the waitlist on open books.
- **8** — Free small tattoo: a palm-size piece on the house.
Passport page shows: the card (Mark stamps, holder name, "since" year, X/8), next-reward progress, mini-stats (Pieces / Artists / £ Saved), perks ladder grid, and "Your collection" of past pieces (title, artist, date) + "your next piece" CTA.

## Studio page seed content (P7)
Est. 2016, Worksop. About: started with two friends/two machines above a barber's; now 7 artists on Newcastle Avenue. Founders section = the two Co-owners (Sarah & Cal) with bios. Values: Spotless & licensed (single-use needles, hospital-grade sterilisation, council-licensed); No daft questions; Always custom (never copy another's tattoo); Free touch-ups (within 3 months). Visit: 67 Newcastle Avenue, Worksop, S80 1LX; Tue–Sat 10am–6pm (closed Sun/Mon); phone 01909 000 000; Google Maps embed; Facebook link. Contact form (name, email/phone, message). Gift vouchers band (any amount, never expires).
