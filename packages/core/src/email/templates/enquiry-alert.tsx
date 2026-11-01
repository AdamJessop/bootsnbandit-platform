import * as React from "react";
import { Button, Section, Text } from "@react-email/components";
import { EmailLayout, heading, paragraph } from "./layout";
import { colors } from "./theme";

/**
 * Staff-facing: tells the owners a brand-new enquiry has landed. Sent to their
 * personal addresses (never the studio's own domain, which would thread it
 * straight back into the inbox), so it carries just enough to triage from a
 * phone and a button into the admin thread.
 */
export interface EnquiryAlertProps {
  customerName?: string;
  /** Human channel label, e.g. "Web form", "Instagram". */
  channelLabel?: string;
  artistName?: string;
  /** One-line summary of what they asked for. */
  summary?: string;
  /** Absolute admin URL of the enquiry. */
  enquiryUrl?: string;
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

const details: React.CSSProperties = {
  borderLeft: `3px solid ${colors.gold}`,
  backgroundColor: colors.bg,
  borderRadius: "6px",
  padding: "12px 16px",
  margin: "0 0 18px",
};

const label: React.CSSProperties = {
  margin: "0 0 2px",
  fontSize: "11px",
  letterSpacing: "1px",
  textTransform: "uppercase",
  color: colors.muted,
};

const value: React.CSSProperties = {
  margin: "0 0 10px",
  fontSize: "15px",
  color: colors.ink,
};

export function EnquiryAlertEmail(props: EnquiryAlertProps) {
  const {
    customerName = "Someone",
    channelLabel,
    artistName,
    summary,
    enquiryUrl,
  } = props;
  return (
    <EmailLayout
      preview={`New enquiry from ${customerName}${summary ? ` — ${summary}` : ""}`}
      eyebrow="New enquiry"
    >
      <Text style={heading}>{`${customerName} has sent an enquiry.`}</Text>
      <Section style={details}>
        {channelLabel ? (
          <>
            <Text style={label}>Came in via</Text>
            <Text style={value}>{channelLabel}</Text>
          </>
        ) : null}
        <Text style={label}>Preferred artist</Text>
        <Text style={value}>{artistName ?? "No preference"}</Text>
        {summary ? (
          <>
            <Text style={label}>What they&apos;re after</Text>
            <Text style={{ ...value, margin: 0 }}>{summary}</Text>
          </>
        ) : null}
      </Section>
      {enquiryUrl ? (
        <Button href={enquiryUrl} style={button}>
          Open the enquiry
        </Button>
      ) : null}
      <Text style={{ ...paragraph, fontSize: "13px", color: colors.muted }}>
        Reply from the enquiry inbox rather than this email, so the customer
        gets it on their thread.
      </Text>
    </EmailLayout>
  );
}
