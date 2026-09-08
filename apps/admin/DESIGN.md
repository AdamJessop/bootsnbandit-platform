---
name: Boots 'n' Bandit Studio (staff back-of-house)
description: The heritage crimson / gold / teal palette on warm black, used quietly and densely for staff who are reading and deciding between clients.
colors:
  crimson: "#c92f4d"
  crimson-deep: "#9c1f38"
  crimson-press: "#7d1830"
  gold: "#cfa05a"
  gold-soft: "#e7cf95"
  teal: "#36b0a8"
  teal-deep: "#1f807a"
  ink: "#0b0a09"
  bg-base: "#080706"
  bg-default: "#0d0c0a"
  bg-card: "#141210"
  bg-raised: "#161310"
  bg-overlay: "#1f1b16"
  bg-elevated: "#272118"
  text-primary: "#fbf7f0"
  text-secondary: "#ddd6ca"
  text-muted: "#9b9384"
  text-disabled: "#5e574a"
  border-subtle: "#1c1813"
  border-default: "#2a241d"
  border-strong: "#3d352a"
  on-crimson: "#ffffff"
  on-gold: "#1a1308"
typography:
  display:
    fontFamily: "Pirata One, Termina, serif"
    fontSize: "clamp(24px, 4vw, 38px)"
    fontWeight: 700
    lineHeight: 1.04
    letterSpacing: "0.005em"
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: 1.4
  body:
    fontFamily: "Tahoma, Geneva, Verdana, -apple-system, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
  body-small:
    fontFamily: "Tahoma, Geneva, Verdana, -apple-system, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.16em"
  nav:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    letterSpacing: "0.025em"
  caption:
    fontFamily: "Tahoma, Geneva, Verdana, -apple-system, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  pill: "9999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "8": "32px"
  "10": "40px"
  "16": "64px"
components:
  button-primary:
    backgroundColor: "{colors.crimson}"
    textColor: "{colors.on-crimson}"
    rounded: "{rounded.lg}"
    padding: "0 10px"
    height: "32px"
    typography: "{typography.body-small}"
  button-outline:
    backgroundColor: "{colors.bg-default}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.lg}"
    padding: "0 10px"
    height: "32px"
  button-ghost:
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.lg}"
    padding: "0 10px"
    height: "32px"
  button-destructive:
    textColor: "{colors.crimson}"
    rounded: "{rounded.lg}"
    padding: "0 10px"
    height: "32px"
  input:
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: "4px 10px"
    height: "32px"
  badge-default:
    backgroundColor: "{colors.crimson}"
    textColor: "{colors.on-crimson}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
    height: "20px"
  badge-secondary:
    backgroundColor: "{colors.bg-raised}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
    height: "20px"
  badge-outline:
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
    height: "20px"
  card:
    backgroundColor: "{colors.bg-card}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.lg}"
    padding: "16px"
  section-label:
    textColor: "{colors.gold}"
    typography: "{typography.label}"
  fact-label:
    textColor: "{colors.text-muted}"
    typography: "{typography.label}"
  nav-item-active:
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
    typography: "{typography.nav}"
---

# Design System: Boots 'n' Bandit Studio (staff back-of-house)

This file records the admin PWA at `apps/admin` as built. It does not describe the public site in `apps/web`, whose heritage world is defined by `design-src/`; the admin borrows that world's tokens and turns the volume down.

## Overview

**Creative North Star: "The Back Room of the Studio"**

The public site is the shopfront: chrome-filled blackletter, ornament, gradient washes. The admin is the room behind it, where the same crimson, gold, and teal live on the same warm black but are used to read and decide, not to sell. Density is high and steady: 14px body copy in Tahoma, 32px controls, 20px pill badges, tables and threads with 8px rhythm. Colour is spent sparingly and always means something: crimson is the one primary action and the one urgent state, gold is the studio's own voice (section heads, the owner's crown, an attention note), and teal is what the studio sent out.

Composition follows one of two patterns. Detail records (customer, staff member, content editors) are an 1100px column with a right rail. The enquiry thread, the most recent surface, is a single 760px-measure reading column governed by a segmented control (Conversation, Brief, Actions) with the reply composer docked to the viewport bottom, so staff on a phone between clients see one thing at a time and always have the reply in reach. The shell is a 240px sidebar at 1024px and above, and a 64px top bar plus 64px bottom nav below that.

Confirmed rejections: no chrome-gradient display fills (the `.display.chrome` utility exists but the admin never applies it), no radial background washes beyond the body's faint 50%-opacity crimson/teal haze, no photography or ornament in the shell. The build's review screenshots use synthetic gradient placeholders where customer images would appear; those are not studio work and not a visual convention.

**Key Characteristics:**
- Warm-black layering (five surface steps, all within a 4% lightness band) instead of shadows
- One display face (Pirata One) used only for page titles, at 24 to 38px
- An 11px bold uppercase Inter label at 0.16em tracking, gold for section heads and muted for facts
- Crimson used once per screen for the primary action, plus the unread badge and urgent statuses
- Teal marks outbound messages; dashed borders mark internal notes; gold marks attention and the unverified sender
- 44px minimum targets, crimson focus rings, reduced motion honoured

## Colors

Three saturated brand hues on a warm-black surface ramp, each with a fixed meaning.

### Primary
- **Bandit Crimson** (`crimson`): the shadcn `--primary`, `--ring`, `--destructive`, and `--sidebar-primary`. The one filled button per view ("Send reply", "Create consult"), the `default` badge (New enquiry, Unassigned, Confirmed booking), the unread count pill in the nav, the active bottom-nav item, text selection at 13% alpha, and the keyboard focus ring. Also the destructive voice at 10 to 20% alpha behind crimson text ("Close enquiry", Cancelled, Customer replied). The build makes no visual distinction between "most important" and "dangerous"; both are crimson, and the label carries the difference.
- **Crimson Deep / Press** (`crimson-deep`, `crimson-press`): chart series 4 and reserved darker steps. Hover on the primary button is crimson at 80% alpha, not a token step.

### Secondary
- **Studio Gold** (`gold`): shadcn `--accent`. Section heads on the enquiry Brief and summary rail, the owner crown beside owner-only nav items, the OWNER role pill (gold text on 10% gold with a 40% gold border), the "View customer" link (hover to `gold-soft`), the "Unverified sender" badge, the "Pick an artist first" and "channel unavailable" hints, and the count chip on the active segment (gold on 20% gold). Gold is the studio speaking; it never fills a button.
- **Gold Soft** (`gold-soft`): hover state of gold text links only.

### Tertiary
- **Bandit Teal** (`teal`): outbound messages in the enquiry thread (10% teal fill, 40% teal border), chart series 3, and hover on timeline entry links. Teal means "we sent this"; nothing else claims it.
- **Teal Deep** (`teal-deep`): chart series 5.

### Neutral
- **Warm black ramp**: `bg-base` for the shell (sidebar, bottom nav, segmented control track, sticky bars at 95% alpha with backdrop blur), `bg-default` for the page and the top bar (90% alpha, blurred), `bg-card` for thread bubbles, timeline entries, chart figures and the shadcn Card, `bg-raised` for the search well, secondary buttons, the muted layer and hover fills, `bg-overlay` for popovers, sheets, dialogs and toasts, `bg-elevated` for the active segment and timeline dots. Each step is roughly one border-width lighter; layering is how depth is read.
- **Text**: `text-primary` for headings, names and values; `text-secondary` for body and the shadcn foreground; `text-muted` for hints, timestamps, fact labels and inactive nav; `text-disabled` for "Not given" and empty states.
- **Borders**: `border-default` is the universal 1px hairline (shell dividers, bubbles, inputs, rails, the calendar grid); `border-strong` is the scrollbar thumb and hover-border on attachment tiles; `border-subtle` exists but is barely used in the admin.
- **On-colour**: white on crimson; near-black `on-gold` for the shadcn accent foreground (select item focus).

### Named Rules
**The One Crimson Rule.** Each view gets one filled crimson button. Everything else that wants attention gets a crimson badge, a crimson-tinted destructive button, or nothing.

**The Sent-Is-Teal Rule.** Teal is only ever the studio's outbound message. Do not use it for success, links, or decoration; the timeline link hover is the single exception already in the build and should not spread.

**The Gold Voice Rule.** Gold is text and hairlines (section heads, crown, hints, the unverified-sender badge). Gold never fills a control.

## Typography

**Display Font:** Pirata One (with Termina, serif fallback), loaded as `--font-pirata`
**Body Font:** Tahoma (with Geneva, Verdana, system sans fallback)
**Label/Nav Font:** Inter standing in for the licensed Termina (`--font-termina`), always uppercase and tracked
**Mono:** ui-monospace / JetBrains Mono, used only via `tabular-nums` on times, counts and money

**Character:** A blackletter title over a plain, slightly old-fashioned system body, disciplined by small tracked grotesk labels. The blackletter is rationed to the page title; everything below it is quiet.

### Hierarchy
- **Display** (700, `clamp(24px, 4vw, 38px)`, 1.04, balanced wrap): the page `h1` only, via the `.display` utility: customer name, enquiry contact name, list page titles. Never inside cards, drawers or rails.
- **Title** (500, 15px): decision-row and step titles ("Who's taking it"), Card titles (16px `font-heading`), thread author names (14px, `text-primary`).
- **Body** (400, 16px, 1.6 on `body`; 14 to 15px in practice): messages and briefs at 15px with `leading-relaxed`, most UI text at 14px, description measure capped at 65ch.
- **Label** (700, 11px, 0.16em, uppercase, Inter): the admin's section-head and fact-label convention. Gold (`section-label`) for headings on the Brief and rail ("At a glance", "Contact", "The idea"); muted (`fact-label`) for `dt` fact keys (Style, Placement, Size, Budget). An older, looser variant (12px, `tracking-wide`, muted, not bold) still heads customer-page sections and chart figcaptions; new surfaces should use the 11px / 0.16em form.
- **Nav** (500 to 700, 13px sidebar / 10px bottom nav, uppercase, `tracking-wide`, Inter): every nav label, the role pill, sheet and drawer titles, the segmented control (10px at 0.06em on phones, 12px at 0.12em from 640px).
- **Caption** (400, 12px): hints under composer selects, timestamps, unavailable-channel reasons; 11px for thread meta rows and calendar hour marks.

### Named Rules
**The One Blackletter Rule.** Pirata One appears once per page, as the `h1`. If a second element needs weight, it gets 15px/500 Inter-less body or a gold 11px label, never the display face.

**The Tracked Label Rule.** Anything uppercase is Inter, bold or medium, and tracked (0.16em for section and fact labels, `tracking-wide` for nav). Uppercase Tahoma does not exist in this world.

## Layout

The shell is fixed chrome around a scrolling content well. At 1024px and above a 240px sidebar sits at the left (`bg-base`, right hairline) with a 64px top bar spanning the remainder; content is padded `pt-16 pl-60`. Below 1024px the sidebar disappears, the top bar spans the viewport, and a 64px bottom nav (`bg-base` at 95% with blur, top hairline) holds four pinned sections plus "More", which opens a bottom Sheet with a three-column grid of the rest. Content gains `pb-20` so nothing hides under the nav.

Two page compositions are in use:

1. **Detail page with rail.** `max-w-[1100px]`, `px-6` to `px-7`, `py-10`; back link, display `h1`, badge row, then a `lg:grid-cols-[1fr_22rem]` split (customer page) with the timeline in the main column and summary cards in the rail. Content editors and studio pages use the same 1100px frame without a rail.
2. **Reading column with segmented control and docked composer.** `max-w-[1100px]`, `px-5`/`sm:px-6`, `pt-8 pb-6`; at `lg` a `[minmax(0,1fr)_17.5rem]` grid with a 40px gap and a sticky (`top-24`) 280px summary rail with a left hairline and `pl-6`. The main column carries the back link, display title, badge row, then a sticky bar at `top-16` (`bg-base` 95%, blur) holding the segmented control and, once the title scrolls out, a compact name plus status. The composer is `sticky bottom-16` on phones (above the nav) and `bottom-0` at `lg`, with a top hairline and its own `bg-base` ground; the thread reserves the dock's measured height so the newest message lands above it.

List pages use `max-w-[1000px]`. Spacing follows the 4px scale: 8px between thread bubbles and badge gaps, 12px inside sections, 16 to 24px card padding (`p-4` to `p-6`), 24px between rail blocks, 32px between Brief sections, 40px page padding. Thread bubbles are capped at `min(85%, 68ch)`; inbound sits left, outbound right, internal notes full width and centred.

Breakpoints in force: 640px (`sm`, segmented control grows its type and shows icons; padding steps up), 1024px (`lg`, sidebar and rail appear, bottom nav leaves). Target widths from the product floor: 375, 768, 1024, 1440.

## Elevation & Depth

Depth is tonal. Surfaces step up the warm-black ramp (`bg-base` → `bg-default` → `bg-card` → `bg-raised` → `bg-overlay` → `bg-elevated`) and are separated by 1px `border-default` hairlines; shadows are almost absent at rest. The shadcn overlays (dialog, sheet, popover, select menu) use a 1px `ring-foreground/10` and the library's `shadow-md`/`shadow-lg`, and the active segment carries a single `0 1px 2px rgba(0,0,0,0.5)` to lift it off its track. The shell's sticky bars use 90 to 95% alpha with `backdrop-blur` so content scrolling beneath them is felt but not read.

### Shadow Vocabulary
- **segment-lift** (`box-shadow: 0 1px 2px rgba(0,0,0,0.5)`): the selected tab in a segmented control. Nothing else at rest.
- **overlay** (`shadow-md` on select menus, `shadow-lg` on sheets, plus `ring-1 ring-foreground/10`): floating surfaces only.
- **Defined but unused in the admin**: `--shadow-sm/md/lg/xl` on 55% black and the `--glow-crimson/gold/teal` rings. They belong to the public site's world; do not reach for the glows on staff surfaces.

### Named Rules
**The Hairline-Not-Shadow Rule.** Separate surfaces with a 1px `border-default` and a one-step tonal change. A shadow means the element is floating (menu, sheet, dialog) or is the selected segment.

## Shapes

Softly rounded, never pill-shaped except for badges. The base radius is 10px (`--radius: 0.625rem`), from which the scale derives: 6px for small nested tiles and timeline dots' containers, 8px (`rounded-md`) for nav items, attachment thumbs, select items and the segment buttons, 10px (`rounded-lg`) for buttons, inputs, textareas, thread bubbles, cards, the calendar frame and the segmented control track, 14px (`rounded-xl`) for the shadcn Card and Dialog. Badges, the unread count, the role pill, the segment count chip and timeline dots are fully round.

Borders are 1px hairlines in `border-default`. The dashed hairline is reserved for two meanings: an internal note bubble and an unavailable attachment slot. Images are `object-cover` inside square (`aspect-square`) tiles with an 8px radius and a hairline. The calendar renders closed time as a 45° crimson hatch at 12% alpha over `bg-card`.

## Components

Restrained and quiet. Controls are 32px tall by default and grown to 44px (`min-h-11`) wherever a finger is expected; nothing has a gradient, a glow or an offset shadow.

### Buttons
- **Shape:** gently rounded (10px), 32px tall, 10px horizontal padding, 14px/500 text; `min-h-11` on phone-facing actions. Pressing nudges the button down 1px.
- **Primary:** crimson fill with white text; hover to crimson at 80% alpha. One per view.
- **Outline:** `border-default` hairline on transparent (input at 30% alpha), hover to the muted fill. Used for "Assign" and the second-rank actions.
- **Ghost:** no fill, hover to the muted fill. Close buttons and icon-only actions (`size-8`, `size-7` for `icon-sm`).
- **Destructive:** crimson text on crimson at 10 to 20% alpha, hover to 20 to 30%. "Close enquiry", cancel actions.
- **Focus:** `border-ring` plus a 3px crimson ring at 50% alpha (`focus-visible:ring-3 ring-ring/50`). Disabled: 50% opacity, no pointer.

### Badges / Chips
- **Style:** 20px pill, 8px horizontal padding, 12px/500 text, transparent border.
- **Variants and meaning:** `default` (crimson fill, white) for New, Unassigned, Confirmed, Completed; `secondary` (`bg-raised`, `text-primary`) for Converted, the assigned artist, Pending; `outline` (hairline, foreground) for Replied, channel names, delivery status; `destructive` (crimson text on 10 to 20% crimson) for Customer replied, Closed, Cancelled, No-show. Badge variant is set by `enquiryStatusVariant` / `bookingStatusVariant`, never by hand.
- **Signal chips:** "Unverified sender" is an outline badge overridden to gold text and a 50% gold border, shown only on inbound mail whose MTA said no. The nav unread count is a crimson circle (min 20px) with 10px bold tabular white text, absent when zero.

### Cards / Containers
- **Corner Style:** 10px for hand-built panels (`rounded-lg`), 14px for the shadcn Card.
- **Background:** `bg-card` on `bg-default` / `bg-base`; the shadcn Card adds `ring-1 ring-foreground/10` instead of a border.
- **Shadow Strategy:** none at rest (see Elevation).
- **Border:** 1px `border-default`.
- **Internal Padding:** 16px (`p-4`, `px-4 py-3` for timeline entries), 20px for chart figures, 24px for empty states.

### Inputs / Fields
- **Style:** 10px radius, 1px `border-input` hairline, transparent fill (input at 30% alpha in dark), 32px tall, 10px horizontal padding, 16px text on touch (14px from `md`); textareas `min-h-16` and content-sized. Labels are 14px/500 `text-sm` above the control; the drawer's field labels use the muted 12px uppercase form.
- **Focus:** border turns crimson and a 3px crimson ring at 50% alpha appears.
- **Error / Disabled:** `aria-invalid` gives a crimson border and 20 to 40% crimson ring; disabled is 50% opacity on an 50 to 80% `input` fill. Inline errors are 12px crimson text; a failed save is a crimson-tinted panel (10% fill, 40% border, crimson text).
- **Select:** same trigger styling, `w-fit` by default, popover menu on `bg-overlay` with a 10% ring and `shadow-md`; items highlight in gold with `on-gold` text. Unavailable options stay listed at 50% opacity with the reason in their label.
- **Date/time:** no picker component exists. `datetime-local` is themed with `[color-scheme:dark]`, tabular numerals and `text-primary`; the native indicator is stretched invisibly over the right 40px and a muted `CalendarClock` glyph is drawn in its place.

### Navigation
- **Sidebar (≥1024px):** 240px, `bg-base`, 64px brand row (28px logo, Inter 14px bold "Boots 'n' Bandit"), items are 8px-radius rows, `px-3 py-2.5`, 18px lucide icon, Inter 13px/500 uppercase `tracking-wide`. Rest: `text-muted`; hover: `bg-raised` and `text-primary`; active: crimson at 15% fill with `text-primary`. Owner-only items carry a 14px gold `Crown`; Enquiries carries the crimson unread pill.
- **Top bar:** fixed 64px, `bg-default` at 90% with blur, bottom hairline; search well (hairline, `bg-raised`, muted placeholder), install prompt, the OWNER/ARTIST role pill (gold text on 10% gold, 40% gold border, 11px bold uppercase `tracking-wider`, crown for owners), and a 36px account button.
- **Bottom nav (<1024px):** fixed 64px, `bg-base` at 95% with blur, top hairline, equal columns each `min-h-[56px]` with a 20px icon over a 10px bold uppercase label; active is crimson text, rest muted. "More" opens a bottom Sheet whose grid tiles reuse the sidebar active/hover treatment.

### Segmented Control
The enquiry page's view switcher. A `bg-base` track with a hairline and 4px padding, 10px radius, three equal columns from 640px (the first column is 1.45× on phones to fit "Conversation"). Each tab is `min-h-11`, 8px radius, Inter bold uppercase (10px/0.06em on phones, 12px/0.12em from `sm`), with a hidden-on-phone 16px icon. Active: `bg-elevated`, `text-primary`, `segment-lift` shadow; rest: muted, hover to `bg-raised`. Optional count chip: 10px tabular pill, gold on 20% gold when active, muted on `bg-raised` otherwise. Colour changes over `--dur` (220ms). Panels enter with `animate-in fade-in slide-in-from-right-4` moving forward and `from-left-4` moving back, timed by `--dur` and `--ease-out`; the first paint does not move, and `motion-reduce:animate-none` plus the global reduced-motion clamp stop it.

### Thread Bubbles
`max-w-[min(85%,68ch)]`, 10px radius, `px-3 py-2`, 14px text. Inbound: `bg-card` with a hairline, left-aligned. Outbound: teal at 10% with a 40% teal border, right-aligned. Internal note: full width, `bg-base`, dashed hairline, muted text. A meta row at 11px muted carries the channel outline badge with its lucide glyph (Globe, Mail, MessageCircle, Camera, StickyNote), the author in `text-primary`, delivery status when not "sent", and a right-aligned timestamp. Image attachments are 80px square tiles; files are hairline chips on `bg-base` with underlined names.

### Fact List and Section Heads
`FactList` is a definition list in two columns (four at `sm` in the full Brief; two in the dense rail). Each `dt` is the muted 11px tracked label; each `dd` is 15px `text-primary` (or `text-disabled` "Not given"). Section heads on the Brief and rail are the same label in gold. This pairing, gold head over muted facts, is the admin's information-density signature.

### Decision Rows
`EnquiryActions` stacks steps separated by top hairlines, each a `sm:grid-cols-[11rem_1fr]` row: a 15px/500 title with a 14px muted hint on the left, controls on the right in a 12px stack. Rows are `py-6`; the first row has no rule and no top padding.

### Timeline
A left hairline with `pl-6`; each entry has a 24px round `bg-elevated` dot with a 14px coloured lucide glyph sitting 34px left of the content, and a `bg-card` hairline panel (`px-4 py-3`) holding a 14px/500 title, a muted tabular timestamp, and optional 12px uppercase meta.

### Data Table and Calendar
The table uses the shadcn Table inside a 12px stack with a search Input (16px leading icon) and an outline CSV button; numeric columns are right-aligned and tabular. The calendar is a `bg-base` hairline frame with a 56px hour gutter (11px tabular muted labels), 60px hour rows, 32px day headers, and closed time hatched in 12% crimson over `bg-card`.

### Toasts
Sonner mounted `top-center`, themed to `--popover` / `--popover-foreground` / `--border` with the 10px base radius, and lucide state icons.

## Do's and Don'ts

### Do:
- **Do** use `.display` for the page `h1` only, at `clamp(24px, 4vw, 38px)`, in `text-primary`.
- **Do** head sections with the 11px / 700 / uppercase / 0.16em Inter label in gold, and label facts with the same style in `text-muted`.
- **Do** pick badge variants through `enquiryStatusVariant` / `bookingStatusVariant`; a status colour is a lookup, not a choice.
- **Do** keep the reply composer docked (`sticky bottom-16`, `lg:bottom-0`) with its own `bg-base` ground and top hairline whenever a surface has a message thread.
- **Do** make anything a finger presses at least 44px tall (`min-h-11`); the 32px control default is for pointer-first table rows and toolbars.
- **Do** rely on `:focus-visible` (2px crimson outline, 2px offset, or the 3px 50% crimson ring on shadcn controls) and never remove it.
- **Do** time state changes with `--dur` (220ms) and `--ease-out`, and use `--dur-fast` (130ms) for colour-only hovers; keep `motion-reduce:animate-none` on any entering panel.
- **Do** keep depth tonal: one step up the warm-black ramp plus a `border-default` hairline.
- **Do** cap message and brief copy at 65 to 68ch.

### Don't:
- **Don't** fill a second button crimson on the same view; demote it to outline or ghost.
- **Don't** use teal for anything but outbound messages and chart series 3.
- **Don't** fill a control or surface with gold; gold is text, hairlines and low-alpha tints only.
- **Don't** apply the chrome gradient (`.display.chrome`), the `--glow-*` rings, or radial washes to admin surfaces; they belong to the public site.
- **Don't** put Pirata One anywhere below the page title, and don't set Tahoma in uppercase.
- **Don't** use a solid border for an internal note; the dashed hairline is what distinguishes staff-only text from the customer's thread.
- **Don't** build a modal for a detail record; details are routes (the enquiry thread left its Dialog for `/enquiries/[id]`), and Dialogs are for short confirmations.
- **Don't** describe the review screenshots' placeholder gradients as imagery conventions; real customer references render as `object-cover` square tiles with a hairline.
