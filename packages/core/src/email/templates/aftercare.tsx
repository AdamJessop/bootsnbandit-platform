import * as React from "react";
import { Button, Section, Text } from "@react-email/components";
import { EmailLayout, heading, paragraph } from "./layout";
import { colors, publicSiteOrigin } from "./theme";

export interface AftercareProps {
  customerName?: string;
}

/** The 5 ordered healing stages (mirrors design-src COMPOSITION-NOTES). */
const STAGES: { range: string; title: string; care: string; tone: string }[] = [
  {
    range: "Day 1–2",
    title: "Fresh & wrapped",
    care: "Keep the wrap on as advised. First wash with lukewarm water and fragrance-free soap; pat dry, never rub.",
    tone: colors.crimson,
  },
  {
    range: "Day 3–6",
    title: "Settling in",
    care: "Thin balm 2–3× a day. Loose clothing, short showers, no soaking.",
    tone: colors.gold,
  },
  {
    range: "Day 7–14",
    title: "The itchy peel",
    care: "Do NOT pick or scratch — tap if itchy and keep moisturising. Skip the gym sweat and tight straps.",
    tone: "#36b0a8",
  },
  {
    range: "Day 15–30",
    title: "Almost there",
    care: "Moisturise once a day. No pools, saunas or baths. A milky sheen is normal.",
    tone: "#7d8b4a",
  },
  {
    range: "Day 30+",
    title: "Healed",
    care: "SPF 30+ in the sun forever. Keep it moisturised, and book a free touch-up if it needs one.",
    tone: colors.gold,
  },
];

const stageBox: React.CSSProperties = {
  backgroundColor: colors.bg,
  borderRadius: "6px",
  padding: "12px 14px",
  margin: "0 0 10px",
};

const button: React.CSSProperties = {
  backgroundColor: colors.crimson,
  borderRadius: "8px",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: 700,
  textDecoration: "none",
  textAlign: "center",
  display: "block",
  padding: "13px 20px",
  margin: "4px 0 20px",
};

export function AftercareEmail(props: AftercareProps) {
  const { customerName = "there" } = props;
  // Customer-facing link → public web site, not the (admin) app origin.
  const url = `${publicSiteOrigin()}/aftercare`;
  return (
    <EmailLayout
      preview="Looking after your new tattoo — the 5 healing stages"
      eyebrow="Aftercare"
    >
      <Text style={heading}>Look after that new ink, {customerName}.</Text>
      <Text style={paragraph}>
        The next few weeks decide how your tattoo settles. Here&apos;s the short version
        of the five healing stages — the full guide, do&apos;s and don&apos;ts and a
        healing tracker live on our site.
      </Text>

      <Section>
        {STAGES.map((s, i) => (
          <div key={i} style={{ ...stageBox, borderLeft: `3px solid ${s.tone}` }}>
            <Text
              style={{
                margin: "0 0 2px",
                fontSize: "11px",
                letterSpacing: "1px",
                textTransform: "uppercase",
                color: colors.muted,
              }}
            >
              {s.range}
            </Text>
            <Text
              style={{
                margin: "0 0 4px",
                fontSize: "15px",
                fontWeight: 700,
                color: colors.ink,
              }}
            >
              {s.title}
            </Text>
            <Text style={{ margin: 0, fontSize: "13px", lineHeight: "20px", color: colors.body }}>
              {s.care}
            </Text>
          </div>
        ))}
      </Section>

      <Button href={url} style={button}>
        Read the full aftercare guide
      </Button>

      <Text style={paragraph}>
        Something not looking right? We offer free touch-ups within 3 months — just reply
        and we&apos;ll take a look.
      </Text>
    </EmailLayout>
  );
}
