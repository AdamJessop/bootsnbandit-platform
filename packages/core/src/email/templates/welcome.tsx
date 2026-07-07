import * as React from "react";
import { Button, Section, Text } from "@react-email/components";
import { EmailLayout, heading, paragraph } from "./layout";
import { colors } from "./theme";

export interface WelcomeProps {
  customerName?: string;
  /** The activation URL (`${siteOrigin}/account/set-password?token=<token>`). */
  setPasswordUrl?: string;
  /** ISO date string for when the link expires. */
  expiresAt?: string;
}

const button: React.CSSProperties = {
  backgroundColor: colors.crimson,
  borderRadius: "8px",
  color: "#fbf7f0",
  fontSize: "15px",
  fontWeight: 700,
  textDecoration: "none",
  textAlign: "center",
  display: "block",
  padding: "13px 20px",
  margin: "6px 0 18px",
};

const meta: React.CSSProperties = {
  borderLeft: `3px solid ${colors.gold}`,
  backgroundColor: colors.bg,
  borderRadius: "6px",
  padding: "12px 16px",
  margin: "0 0 18px",
};

function formatExpiry(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function WelcomeEmail(props: WelcomeProps) {
  const { customerName = "there", setPasswordUrl, expiresAt } = props;
  const expiry = formatExpiry(expiresAt);
  return (
    <EmailLayout
      preview="Welcome to Boots 'n' Bandit — activate your Bandit Pass account"
      eyebrow="Welcome aboard"
    >
      <Text style={heading}>Welcome, {customerName}.</Text>
      <Text style={paragraph}>
        We&apos;ve set you up with a Boots &apos;n&apos; Bandit account. Pick a
        password and you can see your bookings, track your Bandit Pass stamps
        and manage everything in one place.
      </Text>
      {setPasswordUrl ? (
        <Button href={setPasswordUrl} style={button}>
          Choose your password
        </Button>
      ) : null}
      <Section style={meta}>
        <Text style={{ ...paragraph, margin: 0, fontSize: "13px" }}>
          This link is personal to you and valid for 30 days
          {expiry ? ` (until ${expiry})` : ""}. If it expires, just follow it
          anyway — we&apos;ll email you a fresh one.
        </Text>
      </Section>
      <Text style={paragraph}>
        See you in the studio — the Boots &apos;n&apos; Bandit crew.
      </Text>
    </EmailLayout>
  );
}
