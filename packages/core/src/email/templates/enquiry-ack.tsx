import * as React from "react";
import { Section, Text } from "@react-email/components";
import { EmailLayout, greetingName, heading, paragraph } from "./layout";
import { colors } from "./theme";

export interface EnquiryAckProps {
  customerName?: string;
  artistName?: string;
  subjectIdea?: string;
}

const quote: React.CSSProperties = {
  borderLeft: `3px solid ${colors.gold}`,
  backgroundColor: colors.bg,
  borderRadius: "6px",
  padding: "12px 16px",
  margin: "0 0 18px",
  color: colors.ink,
  fontSize: "15px",
  fontStyle: "italic",
};

export function EnquiryAckEmail(props: EnquiryAckProps) {
  const { customerName, artistName, subjectIdea } = props;
  return (
    <EmailLayout
      preview="We've got your enquiry — we'll be in touch shortly"
      eyebrow="Enquiry received"
    >
      <Text style={heading}>
        {`Thanks for getting in touch${greetingName(customerName)}.`}
      </Text>
      <Text style={paragraph}>
        {/* One whole sentence per branch: splicing a name into the middle of
            shared copy is how this once read "a message is on its way to
            Calum will get back to you soon". */}
        {artistName
          ? `Your enquiry is with ${artistName}, who'll get back to you soon — usually within a couple of working days.`
          : "Your enquiry is with the studio — we'll match you with the right artist and get back to you soon, usually within a couple of working days."}
      </Text>
      {subjectIdea ? (
        <Section>
          <Text
            style={{
              margin: "0 0 6px",
              fontSize: "11px",
              letterSpacing: "1px",
              textTransform: "uppercase",
              color: colors.muted,
            }}
          >
            Your idea
          </Text>
          <Text style={quote}>“{subjectIdea}”</Text>
        </Section>
      ) : null}
      <Text style={paragraph}>
        No deposit needed to enquire — we&apos;ll talk through your idea,
        placement and a free 15-minute consultation first. Reply any time if
        you&apos;d like to add to your brief.
      </Text>
    </EmailLayout>
  );
}
