import * as React from "react";
import { Button, Section, Text } from "@react-email/components";
import { EmailLayout, heading, paragraph } from "./layout";
import { colors } from "./theme";

export interface StaffInviteProps {
  inviteeName?: string;
  /** The redeem URL (e.g. `${origin}/sign-in?invite=<token>`). */
  url?: string;
  role?: string;
  /** ISO date string for when the invite expires. */
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

export function StaffInviteEmail(props: StaffInviteProps) {
  const { inviteeName = "there", url, role, expiresAt } = props;
  const expiry = formatExpiry(expiresAt);
  const roleLabel =
    role && role.toLowerCase() === "owner" ? "an owner" : "an artist";
  return (
    <EmailLayout
      preview="You've been invited to the Boots 'n' Bandit studio"
      eyebrow="Studio invite"
    >
      <Text style={heading}>Welcome aboard, {inviteeName}.</Text>
      <Text style={paragraph}>
        You&apos;ve been invited to join the Boots &apos;n&apos; Bandit studio
        team{role ? ` as ${roleLabel}` : ""}. Set up your account by enrolling a
        passkey on your device — no passwords, ever.
      </Text>
      {url ? (
        <Button href={url} style={button}>
          Accept invite &amp; add passkey
        </Button>
      ) : null}
      <Section style={meta}>
        <Text style={{ ...paragraph, margin: 0, fontSize: "13px" }}>
          This invite is personal to you
          {expiry ? ` and expires on ${expiry}` : ""}. If you didn&apos;t expect
          it, you can ignore this email.
        </Text>
      </Section>
      <Text style={paragraph}>
        See you in the studio — the Boots &apos;n&apos; Bandit crew.
      </Text>
    </EmailLayout>
  );
}
