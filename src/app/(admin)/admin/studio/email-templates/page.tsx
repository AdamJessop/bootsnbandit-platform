import { requireRole } from "@/lib/auth";
import { renderEmail } from "@/lib/email/render";
import type { EmailType } from "@/lib/email";

/**
 * Studio › Email templates (K3). Owner-only. Previews each transactional
 * template by rendering them with representative sample data.
 * Read-only preview — editing copy lives in the template source (P5).
 */
export const dynamic = "force-dynamic";

const SAMPLE: Record<EmailType, { label: string; data: Record<string, unknown> }> =
  {
    confirmation: {
      label: "Booking confirmation",
      data: {
        customerName: "Alex",
        artistName: "Sarah",
        date: "Sat 4 Jul, 1:00pm",
        placement: "Forearm",
      },
    },
    reminder: {
      label: "Reminder",
      data: { customerName: "Alex", artistName: "Sarah", date: "Sat 4 Jul" },
    },
    receipt: {
      label: "Receipt",
      data: {
        customerName: "Alex",
        amountPence: 18000,
        bankRef: "BNB-1042",
        lineItems: [{ label: "Half-day session", amountPence: 18000 }],
      },
    },
    aftercare: { label: "Aftercare", data: { customerName: "Alex" } },
    review_request: {
      label: "Review request",
      data: { customerName: "Alex", artistName: "Sarah", reviewToken: "demo" },
    },
    enquiry_ack: {
      label: "Enquiry acknowledgement",
      data: {
        customerName: "Alex",
        artistName: "Sarah",
        subjectIdea: "Snake & dagger",
      },
    },
    loyalty_reward: {
      label: "Loyalty reward",
      data: {
        customerName: "Alex",
        rewardLabel: "Free small tattoo",
        stamps: 8,
        tierLabel: "Bandit",
      },
    },
    staff_invite: {
      label: "Staff invite",
      data: {
        inviteeName: "Jordan",
        url: "http://localhost:3000/sign-in?invite=demo",
        role: "ARTIST",
        expiresAt: "2026-07-01T00:00:00.000Z",
      },
    },
  };

export default async function EmailTemplatesPage() {
  await requireRole("OWNER");
  const types = Object.keys(SAMPLE) as EmailType[];
  const previews = await Promise.all(
    types.map(async (type) => {
      const { subject, html } = await renderEmail(type, SAMPLE[type].data);
      return { type, subject, html, label: SAMPLE[type].label };
    }),
  );

  return (
    <main className="mx-auto max-w-[1100px] px-7 py-10">
      <p className="kicker mb-2">Studio</p>
      <h1 className="display text-[clamp(24px,4vw,36px)] text-text-primary">
        Email templates
      </h1>
      <p className="mt-2 mb-6 text-text-muted">
        Previews of the transactional templates with sample data.
      </p>
      <div className="space-y-8">
        {previews.map((p) => (
          <section key={p.type}>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="font-termina text-sm font-bold uppercase tracking-wide text-text-primary">
                {p.label}
              </h2>
              <span className="text-xs text-text-muted">{p.subject}</span>
            </div>
            <iframe
              title={`${p.label} preview`}
              srcDoc={p.html}
              className="h-[460px] w-full rounded-lg border border-border-default bg-white"
            />
          </section>
        ))}
      </div>
    </main>
  );
}
