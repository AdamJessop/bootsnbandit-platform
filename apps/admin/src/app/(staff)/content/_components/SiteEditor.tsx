"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * Site settings editor (J8). Plain server-action form for studio details,
 * hours, ticker lines (one per row), socials, enquiries toggle and visual
 * direction.
 */

export interface SiteEditorValues {
  studioName: string;
  addressLine: string | null;
  city: string | null;
  county: string | null;
  postcode: string | null;
  hoursText: string | null;
  phone: string | null;
  email: string | null;
  licensingText: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  tickerLines: string[];
  enquiriesOpen: boolean;
  visualDirection: string;
}

const TEXT_FIELDS: { name: keyof SiteEditorValues; label: string }[] = [
  { name: "studioName", label: "Studio name" },
  { name: "addressLine", label: "Address" },
  { name: "city", label: "City" },
  { name: "county", label: "County" },
  { name: "postcode", label: "Postcode" },
  { name: "phone", label: "Phone" },
  { name: "email", label: "Email" },
  { name: "facebookUrl", label: "Facebook URL" },
  { name: "instagramUrl", label: "Instagram URL" },
];

export function SiteEditor({
  values,
  action,
}: {
  values: SiteEditorValues;
  action: (fd: FormData) => Promise<void>;
}) {
  return (
    <form action={action} className="max-w-2xl space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        {TEXT_FIELDS.map((f) => (
          <div key={f.name}>
            <Label htmlFor={f.name} className="mb-1.5 block">
              {f.label}
            </Label>
            <Input
              id={f.name}
              name={f.name}
              defaultValue={(values[f.name] as string | null) ?? ""}
            />
          </div>
        ))}
      </div>

      <div>
        <Label htmlFor="hoursText" className="mb-1.5 block">
          Opening hours
        </Label>
        <Textarea
          id="hoursText"
          name="hoursText"
          rows={3}
          defaultValue={values.hoursText ?? ""}
        />
      </div>

      <div>
        <Label htmlFor="licensingText" className="mb-1.5 block">
          Licensing text
        </Label>
        <Input
          id="licensingText"
          name="licensingText"
          defaultValue={values.licensingText ?? ""}
        />
      </div>

      <div>
        <Label htmlFor="tickerText" className="mb-1.5 block">
          Ticker lines (one per row)
        </Label>
        <Textarea
          id="tickerText"
          name="tickerText"
          rows={4}
          defaultValue={values.tickerLines.join("\n")}
        />
      </div>

      <div>
        <Label htmlFor="visualDirection" className="mb-1.5 block">
          Visual direction
        </Label>
        <select
          id="visualDirection"
          name="visualDirection"
          defaultValue={values.visualDirection}
          className="h-10 w-full max-w-xs rounded-md border border-border-default bg-bg-raised px-3 text-sm text-text-primary"
        >
          <option value="heritage">Heritage</option>
          <option value="noir">Noir</option>
          <option value="grit">Grit</option>
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm text-text-secondary">
        <input
          type="checkbox"
          name="enquiriesOpen"
          defaultChecked={values.enquiriesOpen}
          className="h-5 w-5 rounded border-border-strong"
        />
        Enquiries open
      </label>

      <Button type="submit">Save site settings</Button>
    </form>
  );
}
