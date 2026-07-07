"use client";

/**
 * Enquiry inbox (BACKOFHOUSE-IA E1/E2): status tabs (new/replied/converted/
 * closed), a list of leads, and a detail dialog to reply (email), assign an
 * artist, or convert → booking. Server actions do the work; this island wires
 * the UI + toasts.
 */
import { useMemo, useState, useTransition } from "react";
import type { EnquirySource, EnquiryStatus } from "@prisma/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Toaster } from "@/components/ui/sonner";
import { formatPence } from "@/components/admin/money";
import { enquiryStatusLabel, formatDateTime } from "../_shared/labels";
import {
  countByStatus,
  distinctStyles,
  filterEnquiries,
  type ThreadEntry,
} from "./enquiry-helpers";
import { MoodboardSection, ThreadSection } from "./EnquiryDetailSections";
import {
  assignEnquiry,
  closeEnquiry,
  convertEnquiry,
  replyToEnquiry,
} from "./actions";

export interface EnquiryItem {
  id: string;
  contactName: string;
  contactEmail: string | null;
  style: string | null;
  placement: string | null;
  size: string | null;
  budgetPence: number | null;
  description: string | null;
  moodboard: string[];
  status: EnquiryStatus;
  source: EnquirySource;
  preferredArtistId: string | null;
  createdAtISO: string;
  /** Past messages on the customer's timeline (newest first). */
  thread: ThreadEntry[];
}

export interface ArtistOption {
  id: string;
  name: string;
}

const ALL = "__all__";

const STATUS_ORDER: EnquiryStatus[] = ["new", "replied", "converted", "closed"];

export function EnquiryInbox({
  items,
  artists,
  canConvert,
}: {
  items: EnquiryItem[];
  artists: ArtistOption[];
  canConvert: boolean;
}) {
  const [tab, setTab] = useState<EnquiryStatus>("new");
  const [artistFilter, setArtistFilter] = useState(ALL);
  const [styleFilter, setStyleFilter] = useState(ALL);
  const counts = useMemo(() => countByStatus(items), [items]);
  const styles = useMemo(() => distinctStyles(items), [items]);
  // Let the closed filter triggers render labels, never the raw "__all__"
  // sentinel or an artist cuid.
  const artistFilterItems = useMemo(
    () => [
      { value: ALL, label: "All artists" },
      ...artists.map((a) => ({ value: a.id, label: a.name })),
    ],
    [artists],
  );
  const styleFilterItems = useMemo(
    () => [
      { value: ALL, label: "All styles" },
      ...styles.map((s) => ({ value: s, label: s })),
    ],
    [styles],
  );
  const visible = filterEnquiries(
    items.filter((i) => i.status === tab),
    {
      artistId: artistFilter === ALL ? null : artistFilter,
      style: styleFilter === ALL ? null : styleFilter,
    },
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as EnquiryStatus)}>
          <TabsList>
            {STATUS_ORDER.map((s) => (
              <TabsTrigger key={s} value={s}>
                {enquiryStatusLabel(s)}
                <span className="ml-1.5 tabular-nums text-text-muted">
                  {counts[s]}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Select
          items={artistFilterItems}
          value={artistFilter}
          onValueChange={(v) => setArtistFilter(v ?? ALL)}
        >
          <SelectTrigger className="w-40" aria-label="Filter by artist">
            <SelectValue placeholder="All artists" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All artists</SelectItem>
            {artists.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          items={styleFilterItems}
          value={styleFilter}
          onValueChange={(v) => setStyleFilter(v ?? ALL)}
        >
          <SelectTrigger className="w-40" aria-label="Filter by style">
            <SelectValue placeholder="All styles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All styles</SelectItem>
            {styles.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-lg border border-border-default bg-bg-card p-8 text-center text-sm text-text-muted">
          No {enquiryStatusLabel(tab).toLowerCase()} enquiries.
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((item) => (
            <li key={item.id}>
              <EnquiryRow
                item={item}
                artists={artists}
                canConvert={canConvert}
              />
            </li>
          ))}
        </ul>
      )}
      <Toaster position="top-center" />
    </div>
  );
}

function EnquiryRow({
  item,
  artists,
  canConvert,
}: {
  item: EnquiryItem;
  artists: ArtistOption[];
  canConvert: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [reply, setReply] = useState("");
  const [artistId, setArtistId] = useState(item.preferredArtistId ?? "");
  const [startISO, setStartISO] = useState("");
  const [durationMin, setDurationMin] = useState("60");
  // Lets the closed assign-select trigger render the artist's name, not the cuid.
  const artistItems = useMemo(
    () => artists.map((a) => ({ value: a.id, label: a.name })),
    [artists],
  );

  function run(fn: () => Promise<{ ok: boolean; message?: string }>) {
    start(async () => {
      const res = await fn();
      toast[res.ok ? "success" : "error"](res.message ?? "");
      if (res.ok) setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="w-full rounded-lg border border-border-default bg-bg-card px-5 py-4 text-left transition-colors hover:border-border-strong">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-medium text-text-primary">
            {item.contactName}
          </span>
          <span className="flex items-center gap-2">
            <Badge variant="outline" className="capitalize">
              {item.source}
            </Badge>
            <span className="text-xs text-text-muted">
              {formatDateTime(item.createdAtISO)}
            </span>
          </span>
        </div>
        <p className="mt-1 line-clamp-1 text-sm text-text-muted">
          {[item.style, item.placement, item.size]
            .filter(Boolean)
            .join(" · ") || "No brief"}
          {item.budgetPence != null
            ? ` · budget ${formatPence(item.budgetPence)}`
            : ""}
        </p>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-text-primary">
            {item.contactName}
          </DialogTitle>
          <DialogDescription>
            {item.contactEmail ?? "No email"} ·{" "}
            {enquiryStatusLabel(item.status)}
          </DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Field label="Style" value={item.style} />
          <Field label="Placement" value={item.placement} />
          <Field label="Size" value={item.size} />
          <Field
            label="Budget"
            value={
              item.budgetPence != null ? formatPence(item.budgetPence) : null
            }
          />
        </dl>
        {item.description && (
          <p className="rounded-md border border-border-default bg-bg-base p-3 text-sm text-text-secondary">
            {item.description}
          </p>
        )}

        <MoodboardSection urls={item.moodboard} />
        <ThreadSection thread={item.thread} />

        {/* Assign */}
        <section className="space-y-2">
          <Label>Assign artist</Label>
          <div className="flex gap-2">
            <Select
              items={artistItems}
              value={artistId}
              onValueChange={(v) => setArtistId(v ?? "")}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Choose artist" />
              </SelectTrigger>
              <SelectContent>
                {artists.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              disabled={pending || !artistId}
              onClick={() => run(() => assignEnquiry(item.id, artistId))}
            >
              Assign
            </Button>
          </div>
        </section>

        {/* Reply */}
        <section className="space-y-2">
          <Label htmlFor={`reply-${item.id}`}>Reply (emails customer)</Label>
          <Textarea
            id={`reply-${item.id}`}
            rows={3}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Thanks for getting in touch…"
          />
          <Button
            disabled={pending || !reply.trim()}
            onClick={() =>
              run(() => replyToEnquiry(item.id, { message: reply }))
            }
          >
            Send reply
          </Button>
        </section>

        {/* Convert */}
        {canConvert && (
          <section className="space-y-2 rounded-md border border-border-default p-3">
            <Label>Convert → booking</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="datetime-local"
                aria-label="Start"
                onChange={(e) =>
                  setStartISO(
                    e.target.value
                      ? new Date(e.target.value).toISOString()
                      : "",
                  )
                }
              />
              <Input
                type="number"
                aria-label="Duration (minutes)"
                value={durationMin}
                min={15}
                step={15}
                onChange={(e) => setDurationMin(e.target.value)}
              />
            </div>
            <Button
              disabled={pending || !startISO || !artistId}
              onClick={() =>
                run(() =>
                  convertEnquiry(item.id, {
                    artistId,
                    startISO,
                    durationMin: Number(durationMin),
                    type: "consult",
                  }),
                )
              }
            >
              Create consult
            </Button>
          </section>
        )}

        {item.status !== "closed" && (
          <Button
            variant="ghost"
            className="text-destructive"
            disabled={pending}
            onClick={() => run(() => closeEnquiry(item.id))}
          >
            Close enquiry
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-text-muted">
        {label}
      </dt>
      <dd className="text-text-secondary">{value || "—"}</dd>
    </div>
  );
}
