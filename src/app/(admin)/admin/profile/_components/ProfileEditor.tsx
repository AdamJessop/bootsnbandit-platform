"use client";

import { useState } from "react";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * Own artist profile + portfolio editor (L1). The headshot uses the shared
 * ImageUploader; its value is mirrored into a hidden input so the server action
 * receives it in the FormData.
 */

export interface ProfileEditorValues {
  bio: string | null;
  rateText: string | null;
  insta: string | null;
  headshot: string | null;
  styles: string[];
  specials: string[];
}

export function ProfileEditor({
  values,
  action,
}: {
  values: ProfileEditorValues;
  action: (fd: FormData) => Promise<void>;
}) {
  const [headshot, setHeadshot] = useState(values.headshot ?? "");

  return (
    <form action={action} className="max-w-2xl space-y-5">
      <input type="hidden" name="headshot" value={headshot} />

      <div>
        <Label className="mb-1.5 block">Headshot</Label>
        <ImageUploader
          value={headshot}
          onChange={(v) => setHeadshot(Array.isArray(v) ? (v[0] ?? "") : v)}
          label="Upload headshot"
        />
      </div>

      <div>
        <Label htmlFor="bio" className="mb-1.5 block">
          Bio
        </Label>
        <Textarea id="bio" name="bio" rows={4} defaultValue={values.bio ?? ""} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="rateText" className="mb-1.5 block">
            Rate text
          </Label>
          <Input
            id="rateText"
            name="rateText"
            defaultValue={values.rateText ?? ""}
          />
        </div>
        <div>
          <Label htmlFor="insta" className="mb-1.5 block">
            Instagram
          </Label>
          <Input id="insta" name="insta" defaultValue={values.insta ?? ""} />
        </div>
      </div>

      <div>
        <Label htmlFor="styles" className="mb-1.5 block">
          Styles (comma separated)
        </Label>
        <Input
          id="styles"
          name="styles"
          defaultValue={values.styles.join(", ")}
        />
      </div>

      <div>
        <Label htmlFor="specials" className="mb-1.5 block">
          Specials (comma separated)
        </Label>
        <Input
          id="specials"
          name="specials"
          defaultValue={values.specials.join(", ")}
        />
      </div>

      <Button type="submit">Save profile</Button>
    </form>
  );
}
