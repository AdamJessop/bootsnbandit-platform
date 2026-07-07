import * as React from "react";
import { Text } from "@react-email/components";
import { EmailLayout, heading, paragraph } from "./layout";
import { colors } from "./theme";

export interface ReminderProps {
  customerName?: string;
  artistName?: string;
  date?: string;
}

export function ReminderEmail(props: ReminderProps) {
  const { customerName = "there", artistName, date } = props;
  return (
    <EmailLayout
      preview={`A quick reminder about your tattoo session${date ? ` — ${date}` : ""}`}
      eyebrow="Session reminder"
    >
      <Text style={heading}>See you soon, {customerName}.</Text>
      <Text style={paragraph}>
        Just a friendly nudge about your upcoming session
        {artistName ? ` with ${artistName}` : ""}
        {date ? (
          <>
            {" "}
            on <strong style={{ color: colors.crimson }}>{date}</strong>
          </>
        ) : null}
        .
      </Text>
      <Text style={paragraph}>
        A good night&apos;s sleep, a proper meal beforehand and plenty of water
        make a world of difference. Avoid alcohol the night before, and skip the
        suncream on the area on the day.
      </Text>
      <Text style={paragraph}>
        If anything&apos;s changed and you need to move things around, just
        reply to this email and we&apos;ll sort it.
      </Text>
    </EmailLayout>
  );
}
