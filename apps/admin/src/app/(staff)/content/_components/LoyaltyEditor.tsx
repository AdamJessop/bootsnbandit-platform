"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { perksToText, type LoyaltyPerk } from "../_lib/loyalty-form";

/**
 * Bandit Pass loyalty editor (J7). Plain server-action form: configures stamps
 * per visit, spend-per-stamp, reward threshold, expiry, perks ladder (one
 * `stamps | title | desc` per line) and customer messaging.
 */

export interface LoyaltyEditorValues {
  name: string;
  stampsPerVisit: number;
  spendPerStamp: number | null;
  rewardThreshold: number;
  rewardDesc: string | null;
  expiryMonths: number | null;
  messaging: string | null;
  perks: LoyaltyPerk[];
  active: boolean;
}

export function LoyaltyEditor({
  values,
  action,
}: {
  values: LoyaltyEditorValues;
  action: (fd: FormData) => Promise<void>;
}) {
  return (
    <form action={action} className="max-w-2xl space-y-5">
      <input type="hidden" name="name" value={values.name} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="stampsPerVisit" className="mb-1.5 block">
            Stamps per visit
          </Label>
          <Input
            id="stampsPerVisit"
            name="stampsPerVisit"
            type="number"
            defaultValue={values.stampsPerVisit}
          />
        </div>
        <div>
          <Label htmlFor="spendPerStamp" className="mb-1.5 block">
            Spend per stamp (pence)
          </Label>
          <Input
            id="spendPerStamp"
            name="spendPerStamp"
            type="number"
            defaultValue={values.spendPerStamp ?? ""}
          />
        </div>
        <div>
          <Label htmlFor="rewardThreshold" className="mb-1.5 block">
            Reward threshold (stamps)
          </Label>
          <Input
            id="rewardThreshold"
            name="rewardThreshold"
            type="number"
            defaultValue={values.rewardThreshold}
          />
        </div>
        <div>
          <Label htmlFor="expiryMonths" className="mb-1.5 block">
            Expiry (months)
          </Label>
          <Input
            id="expiryMonths"
            name="expiryMonths"
            type="number"
            defaultValue={values.expiryMonths ?? ""}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="rewardDesc" className="mb-1.5 block">
          Reward description
        </Label>
        <Input
          id="rewardDesc"
          name="rewardDesc"
          defaultValue={values.rewardDesc ?? ""}
        />
      </div>

      <div>
        <Label htmlFor="perksText" className="mb-1.5 block">
          Perks ladder (one per line: stamps | title | description)
        </Label>
        <Textarea
          id="perksText"
          name="perksText"
          rows={5}
          defaultValue={perksToText(values.perks)}
          placeholder={
            "2 | Birthday treat | A drink on us\n8 | Free small tattoo |"
          }
        />
      </div>

      <div>
        <Label htmlFor="messaging" className="mb-1.5 block">
          Customer messaging
        </Label>
        <Textarea
          id="messaging"
          name="messaging"
          rows={2}
          defaultValue={values.messaging ?? ""}
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-text-secondary">
        <input
          type="checkbox"
          name="active"
          defaultChecked={values.active}
          className="h-5 w-5 rounded border-border-strong"
        />
        Scheme active
      </label>

      <Button type="submit">Save loyalty scheme</Button>
    </form>
  );
}
