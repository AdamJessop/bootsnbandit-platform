import * as React from "react";
import { Section, Text } from "@react-email/components";
import { EmailLayout, heading, paragraph } from "./layout";
import { colors } from "./theme";

export interface LoyaltyRewardProps {
  customerName?: string;
  rewardLabel?: string;
  stamps?: number;
  tierLabel?: string;
}

const rewardBox: React.CSSProperties = {
  backgroundColor: colors.ink,
  borderRadius: "10px",
  border: `1px solid ${colors.gold}`,
  padding: "20px 22px",
  margin: "0 0 18px",
  textAlign: "center",
};

export function LoyaltyRewardEmail(props: LoyaltyRewardProps) {
  const {
    customerName = "there",
    rewardLabel = "a Bandit Pass perk",
    stamps,
    tierLabel,
  } = props;
  const total = 8;
  return (
    <EmailLayout
      preview={`You've unlocked a reward: ${rewardLabel}`}
      eyebrow="Bandit Pass"
    >
      <Text style={heading}>Nice one, {customerName} — reward unlocked.</Text>
      <Section style={rewardBox}>
        <Text
          style={{
            color: colors.gold,
            fontSize: "11px",
            letterSpacing: "3px",
            textTransform: "uppercase",
            margin: "0 0 8px",
          }}
        >
          You&apos;ve earned
        </Text>
        <Text
          style={{
            color: "#fbf7f0",
            fontSize: "22px",
            fontWeight: 700,
            margin: 0,
          }}
        >
          {rewardLabel}
        </Text>
        {typeof stamps === "number" ? (
          <Text
            style={{ color: colors.gold, fontSize: "13px", margin: "10px 0 0" }}
          >
            {stamps} of {total} stamps{tierLabel ? ` · ${tierLabel}` : ""}
          </Text>
        ) : null}
      </Section>
      <Text style={paragraph}>
        Your Bandit Pass keeps stacking with every piece. Mention this reward
        next time you&apos;re in, or reply to this email and we&apos;ll get it
        sorted.
      </Text>
      <Text style={paragraph}>Thanks for being one of ours.</Text>
    </EmailLayout>
  );
}
