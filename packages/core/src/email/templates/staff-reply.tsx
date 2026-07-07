import * as React from "react";
import { Text } from "@react-email/components";
import { EmailLayout, heading, paragraph } from "./layout";

export interface StaffReplyProps {
  customerName?: string;
  body: string;
  subject?: string;
}

/**
 * A free-form message written by a staff member (e.g. replying to an enquiry
 * from the admin app), wrapped in the studio brand shell. The body is rendered
 * as plain paragraphs — blank lines separate paragraphs, single line breaks
 * are preserved within a paragraph.
 */
export function StaffReplyEmail(props: StaffReplyProps) {
  const { customerName, body, subject } = props;
  const paragraphs = body
    .split(/\r?\n\r?\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  return (
    <EmailLayout
      preview={subject ?? "A message from Boots 'n' Bandit"}
      eyebrow="From the studio"
    >
      {customerName ? <Text style={heading}>Hi {customerName},</Text> : null}
      {paragraphs.map((p, i) => (
        <Text key={i} style={paragraph}>
          {p.split(/\r?\n/).map((line, j, lines) => (
            <React.Fragment key={j}>
              {line}
              {j < lines.length - 1 ? <br /> : null}
            </React.Fragment>
          ))}
        </Text>
      ))}
      <Text style={paragraph}>— the Boots &apos;n&apos; Bandit crew</Text>
    </EmailLayout>
  );
}
