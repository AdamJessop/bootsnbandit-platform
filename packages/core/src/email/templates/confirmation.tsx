import * as React from "react";
import { Section, Text } from "@react-email/components";
import { EmailLayout, heading, paragraph } from "./layout";
import { colors } from "./theme";

export interface ConfirmationProps {
  customerName?: string;
  artistName?: string;
  date?: string;
  placement?: string;
}

const row: React.CSSProperties = {
  borderLeft: `3px solid ${colors.crimson}`,
  backgroundColor: colors.bg,
  borderRadius: "6px",
  padding: "14px 16px",
  margin: "0 0 18px",
};

const label: React.CSSProperties = {
  color: colors.muted,
  fontSize: "11px",
  letterSpacing: "1px",
  textTransform: "uppercase",
  margin: "0 0 2px",
};

const value: React.CSSProperties = {
  color: colors.ink,
  fontSize: "15px",
  fontWeight: 600,
  margin: "0 0 10px",
};

export function ConfirmationEmail(props: ConfirmationProps) {
  const { customerName = "there", artistName, date, placement } = props;
  return (
    <EmailLayout
      preview={`Your booking with ${artistName ?? "Boots 'n' Bandit"} is confirmed`}
      eyebrow="Booking confirmed"
    >
      <Text style={heading}>You&apos;re booked in, {customerName}.</Text>
      <Text style={paragraph}>
        Brilliant — your session is locked in. Here are the details:
      </Text>
      <Section style={row}>
        {artistName ? (
          <>
            <Text style={label}>Artist</Text>
            <Text style={value}>{artistName}</Text>
          </>
        ) : null}
        {date ? (
          <>
            <Text style={label}>When</Text>
            <Text style={value}>{date}</Text>
          </>
        ) : null}
        {placement ? (
          <>
            <Text style={label}>Placement</Text>
            <Text style={{ ...value, margin: 0 }}>{placement}</Text>
          </>
        ) : null}
      </Section>
      <Text style={paragraph}>
        Please come well-fed and hydrated, and wear something comfy that gives easy
        access to the area. Need to rearrange? Just reply to this email.
      </Text>
      <Text style={paragraph}>See you soon — the Boots &apos;n&apos; Bandit crew.</Text>
    </EmailLayout>
  );
}
