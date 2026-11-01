import * as React from "react";
import { Column, Hr, Row, Section, Text } from "@react-email/components";
import { EmailLayout, greetingName, heading, paragraph } from "./layout";
import { colors, formatGBP } from "./theme";

export interface ReceiptLineItem {
  label: string;
  amountPence: number;
}

export interface ReceiptProps {
  customerName?: string;
  amountPence?: number;
  bankRef?: string;
  lineItems?: ReceiptLineItem[];
}

const cellLabel: React.CSSProperties = {
  color: colors.body,
  fontSize: "14px",
  margin: "0",
  padding: "6px 0",
};

const cellAmount: React.CSSProperties = {
  ...cellLabel,
  textAlign: "right",
  fontWeight: 600,
  color: colors.ink,
};

const refBox: React.CSSProperties = {
  backgroundColor: colors.bg,
  border: `1px dashed ${colors.gold}`,
  borderRadius: "6px",
  padding: "12px 16px",
  margin: "0 0 18px",
};

export function ReceiptEmail(props: ReceiptProps) {
  const { customerName, amountPence = 0, bankRef, lineItems = [] } = props;
  return (
    <EmailLayout
      preview={`Your receipt — ${formatGBP(amountPence)}`}
      eyebrow="Payment received"
    >
      <Text style={heading}>{`Thanks${greetingName(customerName)}.`}</Text>
      <Text style={paragraph}>
        We&apos;ve recorded your payment of{" "}
        <strong style={{ color: colors.crimson }}>
          {formatGBP(amountPence)}
        </strong>
        . Here&apos;s your receipt for the records.
      </Text>

      {lineItems.length > 0 ? (
        <Section style={{ margin: "0 0 16px" }}>
          {lineItems.map((item, i) => (
            <Row key={i}>
              <Column>
                <Text style={cellLabel}>{item.label}</Text>
              </Column>
              <Column>
                <Text style={cellAmount}>{formatGBP(item.amountPence)}</Text>
              </Column>
            </Row>
          ))}
          <Hr style={{ borderColor: colors.border, margin: "6px 0" }} />
          <Row>
            <Column>
              <Text
                style={{ ...cellLabel, fontWeight: 700, color: colors.ink }}
              >
                Total
              </Text>
            </Column>
            <Column>
              <Text
                style={{
                  ...cellAmount,
                  color: colors.crimson,
                  fontSize: "16px",
                }}
              >
                {formatGBP(amountPence)}
              </Text>
            </Column>
          </Row>
        </Section>
      ) : null}

      {bankRef ? (
        <Section style={refBox}>
          <Text style={{ ...paragraph, margin: 0, fontSize: "13px" }}>
            Bank transfer reference:{" "}
            <strong style={{ color: colors.ink }}>{bankRef}</strong>
          </Text>
        </Section>
      ) : null}

      <Text style={paragraph}>
        Payments are by bank transfer — no card surcharges, ever. Keep this
        email for your records, or reply if anything looks off.
      </Text>
    </EmailLayout>
  );
}
