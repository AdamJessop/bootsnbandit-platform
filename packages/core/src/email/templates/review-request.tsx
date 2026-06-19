import * as React from "react";
import { Button, Text } from "@react-email/components";
import { EmailLayout, heading, paragraph } from "./layout";
import { appOrigin, colors } from "./theme";

export interface ReviewRequestProps {
  customerName?: string;
  artistName?: string;
  reviewToken?: string;
}

const button: React.CSSProperties = {
  backgroundColor: colors.gold,
  borderRadius: "8px",
  color: colors.ink,
  fontSize: "15px",
  fontWeight: 700,
  textDecoration: "none",
  textAlign: "center",
  display: "block",
  padding: "13px 20px",
  margin: "6px 0 20px",
};

export function ReviewRequestEmail(props: ReviewRequestProps) {
  const { customerName = "there", artistName, reviewToken } = props;
  const url = reviewToken
    ? `${appOrigin()}/review/${reviewToken}`
    : `${appOrigin()}/review`;
  return (
    <EmailLayout
      preview="How did we do? Leave a quick review"
      eyebrow="Your thoughts"
    >
      <Text style={heading}>How&apos;s the new piece, {customerName}?</Text>
      <Text style={paragraph}>
        We hope you&apos;re loving your tattoo
        {artistName ? ` from ${artistName}` : ""}. If you have a spare minute, a short
        review means the world to us — and helps other people find the studio.
      </Text>
      <Button href={url} style={button}>
        Leave a review
      </Button>
      <Text style={paragraph}>
        It only takes a moment, and your link is private to you. Thank you for choosing
        Boots &apos;n&apos; Bandit.
      </Text>
    </EmailLayout>
  );
}
