---
version: 1
slug: "src-app-staff-enquiries-id-page-tsx"
primary_target: "src/app/(staff)/enquiries/[id]/page.tsx"
related_targets: ["src/app/(staff)/enquiries/page.tsx"]
---

# Surface: admin enquiry thread page — `/enquiries/[id]`

Scope: the enquiry detail leaves the inbox Dialog and becomes its own route in the staff PWA. Visitor mode: **Operate**. Audience: owner and artists, on phones between clients and on the studio tablet/desktop. Job: read the thread and reply, AND triage (assign, convert to consult, close), with equal weight. Content: contact + identity chips, brief facts (style, placement, size, budget), description, Inkling mood board, attachments, full thread (inbound/outbound/internal), reply composer with explicit channel selector. Constraints kept verbatim from the incumbent: convert→consult inline form; internal notes as a composer channel; channel selector with unavailable reasons in plain sight; `?open=<id>` deep links redirect to the page. Inbox list stays at `/enquiries`; rows become links. Opening the page marks the thread read.

## Direction contract

THESIS: One reading column, one thing at a time. A segmented control (Conversation · Brief · Actions) replaces the stacked modal; it refuses the everything-at-once scroll and the mail-client split.

OWN-WORLD: The admin's warm-black heritage tokens, shadcn primitives, Termina-style uppercase labels in gold, crimson for the primary action, teal for outbound. Recognisable with content removed by the 760px measure, the docked composer, and the segmented pill.

STORY: Staff land on the conversation with the reply box already in reach; a flick shows the brief; a second flick shows the three decisions. They leave having replied, assigned, converted, or closed.

FIRST VIEWPORT: Back link, name as display heading, status pill + channel badge + assigned artist. Segmented control directly under. Thread fills the column, newest at the bottom; composer with channel selector docked to the viewport bottom. Desktop adds a 280px summary rail (contact chips, facts, mood board thumbs, "View customer") on the right.

FORM: One Thing at a Time, position 5 on my list; seed key f3b5f2c7. Signature interaction: segmented switch with view-transition slide; composer stays docked while the thread scrolls.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
