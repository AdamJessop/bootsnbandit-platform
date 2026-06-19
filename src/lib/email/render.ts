import * as React from "react";
import { render } from "@react-email/components";
import type { EmailType } from "./index";
import { ConfirmationEmail } from "./templates/confirmation";
import { ReminderEmail } from "./templates/reminder";
import { ReceiptEmail, type ReceiptLineItem } from "./templates/receipt";
import { AftercareEmail } from "./templates/aftercare";
import { ReviewRequestEmail } from "./templates/review-request";
import { EnquiryAckEmail } from "./templates/enquiry-ack";
import { LoyaltyRewardEmail } from "./templates/loyalty-reward";

export interface RenderedEmail {
  subject: string;
  html: string;
}

type Data = Record<string, unknown>;

function str(data: Data, key: string): string | undefined {
  const v = data[key];
  return typeof v === "string" ? v : undefined;
}

function num(data: Data, key: string): number | undefined {
  const v = data[key];
  return typeof v === "number" ? v : undefined;
}

function lineItems(data: Data): ReceiptLineItem[] {
  const v = data.lineItems;
  if (!Array.isArray(v)) return [];
  return v
    .filter(
      (li): li is { label: string; amountPence: number } =>
        !!li &&
        typeof (li as { label?: unknown }).label === "string" &&
        typeof (li as { amountPence?: unknown }).amountPence === "number",
    )
    .map((li) => ({ label: li.label, amountPence: li.amountPence }));
}

/** Builds the React element + subject line for a given email type. */
function buildElement(type: EmailType, data: Data): { subject: string; element: React.ReactElement } {
  switch (type) {
    case "confirmation":
      return {
        subject: "Your booking is confirmed — Boots 'n' Bandit",
        element: React.createElement(ConfirmationEmail, {
          customerName: str(data, "customerName"),
          artistName: str(data, "artistName"),
          date: str(data, "date"),
          placement: str(data, "placement"),
        }),
      };
    case "reminder":
      return {
        subject: "A reminder about your tattoo session — Boots 'n' Bandit",
        element: React.createElement(ReminderEmail, {
          customerName: str(data, "customerName"),
          artistName: str(data, "artistName"),
          date: str(data, "date"),
        }),
      };
    case "receipt":
      return {
        subject: "Your receipt — Boots 'n' Bandit",
        element: React.createElement(ReceiptEmail, {
          customerName: str(data, "customerName"),
          amountPence: num(data, "amountPence"),
          bankRef: str(data, "bankRef"),
          lineItems: lineItems(data),
        }),
      };
    case "aftercare":
      return {
        subject: "Looking after your new tattoo — Boots 'n' Bandit",
        element: React.createElement(AftercareEmail, {
          customerName: str(data, "customerName"),
        }),
      };
    case "review_request":
      return {
        subject: "How did we do? Leave a quick review — Boots 'n' Bandit",
        element: React.createElement(ReviewRequestEmail, {
          customerName: str(data, "customerName"),
          artistName: str(data, "artistName"),
          reviewToken: str(data, "reviewToken"),
        }),
      };
    case "enquiry_ack":
      return {
        subject: "We've got your enquiry — Boots 'n' Bandit",
        element: React.createElement(EnquiryAckEmail, {
          customerName: str(data, "customerName"),
          artistName: str(data, "artistName"),
          subjectIdea: str(data, "subjectIdea"),
        }),
      };
    case "loyalty_reward":
      return {
        subject: "You've unlocked a Bandit Pass reward — Boots 'n' Bandit",
        element: React.createElement(LoyaltyRewardEmail, {
          customerName: str(data, "customerName"),
          rewardLabel: str(data, "rewardLabel"),
          stamps: num(data, "stamps"),
          tierLabel: str(data, "tierLabel"),
        }),
      };
    default: {
      // Exhaustiveness guard.
      const _never: never = type;
      throw new Error(`Unknown email type: ${String(_never)}`);
    }
  }
}

/** Renders the template for `type` to HTML and returns the subject + html. */
export async function renderEmail(type: EmailType, data: Data = {}): Promise<RenderedEmail> {
  const { subject, element } = buildElement(type, data);
  const html = await render(element);
  return { subject, html };
}
