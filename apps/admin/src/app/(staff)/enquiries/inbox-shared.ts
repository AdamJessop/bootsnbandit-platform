"use client";

/**
 * Shared vocabulary for the enquiry inbox islands: the row payload the server
 * page builds, the tab/badge constants, and the one toast-and-transition
 * wrapper every action button uses. Lives apart from the components so
 * EnquiryInbox → EnquiryList → EnquiryMeta can all import it without a cycle.
 */
import { useTransition } from "react";
import { toast } from "sonner";
import type {
  EnquiryChannel,
  EnquirySource,
  EnquiryStatus,
} from "@prisma/client";
import type { MoodboardData } from "@bnb/core/services/moodboard-data";
import type { ComposerChannel, ReplyChannelOption } from "./enquiry-helpers";
import type { ThreadItem } from "./EnquiryThread";

export interface EnquiryItem {
  id: string;
  contactName: string;
  contactEmail: string | null;
  subject: string | null;
  style: string | null;
  placement: string | null;
  size: string | null;
  budgetPence: number | null;
  description: string | null;
  moodboard: string[];
  moodboardData: MoodboardData | null;
  status: EnquiryStatus;
  source: EnquirySource;
  channel: EnquiryChannel;
  preferredArtistId: string | null;
  /** Resolved name for the preferred artist, or null when unassigned. */
  preferredArtistName: string | null;
  createdAtISO: string;
  /** Newest message on the thread, or null when nothing has landed yet. */
  lastMessageAtISO: string | null;
  /** Customer traffic this viewer has not caught up on. */
  unread: boolean;
  /** The full message thread, oldest first. */
  thread: ThreadItem[];
  /** Every reply channel with its availability, computed server-side. */
  replyOptions: ReplyChannelOption[];
  /** Which one the composer opens on. */
  defaultReplyChannel: ComposerChannel;
}

export interface ArtistOption {
  id: string;
  name: string;
}

export const ALL = "__all__";

export const STATUS_ORDER: EnquiryStatus[] = [
  "new",
  "customer_replied",
  "replied",
  "converted",
  "closed",
];

/**
 * How a row badges the enquiry. The channel supersedes the older source for
 * display — an emailed lead still records source `web` — so the row shows the
 * channel while the dropdown filters on source.
 */
export const CHANNEL_BADGE: Record<EnquiryChannel, string> = {
  web: "Web",
  flash: "Flash",
  inkling: "Mood board",
  email: "Email",
  messenger: "Messenger",
  instagram: "Instagram",
};

export const SOURCE_FILTER_ITEMS = [
  { value: ALL, label: "All sources" },
  { value: "inkling", label: "Mood boards" },
  { value: "web", label: "Web" },
  { value: "flash", label: "Flash" },
];

/**
 * Run a server action inside a transition, toast whatever it says, and call
 * `onSuccess` only when it worked. Every action button in the inbox goes
 * through this so a failed action can never look like a success.
 */
export function useAction() {
  const [pending, start] = useTransition();
  const run = (
    fn: () => Promise<{ ok: boolean; message?: string }>,
    opts: { onSuccess?: () => void } = {},
  ) => {
    start(async () => {
      const res = await fn();
      toast[res.ok ? "success" : "error"](res.message ?? "");
      if (res.ok) opts.onSuccess?.();
    });
  };
  return { pending, run };
}
