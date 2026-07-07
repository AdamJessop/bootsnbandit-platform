import * as React from "react";
import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { colors, studio } from "./theme";

export interface LayoutProps {
  preview: string;
  /** Small uppercase kicker shown above the heading (e.g. "Booking confirmed"). */
  eyebrow?: string;
  children: React.ReactNode;
}

const main: React.CSSProperties = {
  backgroundColor: colors.bg,
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  margin: 0,
  padding: "24px 0",
  color: colors.body,
};

const container: React.CSSProperties = {
  backgroundColor: colors.card,
  borderRadius: "10px",
  border: `1px solid ${colors.border}`,
  maxWidth: "560px",
  margin: "0 auto",
  overflow: "hidden",
};

const header: React.CSSProperties = {
  backgroundColor: colors.ink,
  padding: "26px 32px 22px",
  borderBottom: `3px solid ${colors.crimson}`,
};

const brand: React.CSSProperties = {
  color: "#fbf7f0",
  fontSize: "22px",
  fontWeight: 700,
  letterSpacing: "0.5px",
  margin: 0,
};

const brandSub: React.CSSProperties = {
  color: colors.gold,
  fontSize: "11px",
  letterSpacing: "3px",
  textTransform: "uppercase",
  margin: "4px 0 0",
};

const content: React.CSSProperties = { padding: "28px 32px 8px" };

const eyebrowStyle: React.CSSProperties = {
  color: colors.crimson,
  fontSize: "12px",
  fontWeight: 700,
  letterSpacing: "2px",
  textTransform: "uppercase",
  margin: "0 0 8px",
};

const footer: React.CSSProperties = { padding: "8px 32px 26px" };

const footerText: React.CSSProperties = {
  color: colors.muted,
  fontSize: "12px",
  lineHeight: "18px",
  margin: "4px 0 0",
};

/** Shared shell: branded header + body + studio-facts footer. */
export function EmailLayout({ preview, eyebrow, children }: LayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Text style={brand}>{studio.name}</Text>
            <Text style={brandSub}>{studio.tagline}</Text>
          </Section>
          <Section style={content}>
            {eyebrow ? <Text style={eyebrowStyle}>{eyebrow}</Text> : null}
            {children}
          </Section>
          <Hr style={{ borderColor: colors.border, margin: "8px 32px" }} />
          <Section style={footer}>
            <Text style={{ ...footerText, color: colors.ink, fontWeight: 700 }}>
              {studio.name} · {studio.tagline}
            </Text>
            <Text style={footerText}>{studio.address}</Text>
            <Text style={footerText}>
              {studio.hours} · closed Sun &amp; Mon
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

/** Reusable body paragraph. */
export const paragraph: React.CSSProperties = {
  color: colors.body,
  fontSize: "15px",
  lineHeight: "23px",
  margin: "0 0 14px",
};

export const heading: React.CSSProperties = {
  color: colors.ink,
  fontSize: "21px",
  fontWeight: 700,
  lineHeight: "28px",
  margin: "0 0 14px",
};
