"use client";

import { Field } from "@/components/site";
import type { BuilderState, Set } from "./logic";
import styles from "../../enquire/enquire.module.css";

export function SendStep({ state, set }: { state: BuilderState; set: Set }) {
  return (
    <div>
      <h2 className={styles.panelTitle}>Send it to the studio</h2>
      <p className={styles.panelSub}>We&rsquo;ll review your board and the right artist will get back to you. No deposit, no payment.</p>
      <Field label="Name" htmlFor="mb-name">
        <input id="mb-name" className="input" autoComplete="name" value={state.name} onChange={(e) => set({ name: e.target.value })} />
      </Field>
      <Field label="Email" htmlFor="mb-email" hint="We'll send a confirmation here.">
        <input id="mb-email" className="input" type="email" autoComplete="email" value={state.email} onChange={(e) => set({ email: e.target.value })} />
      </Field>
      <Field label="Phone" htmlFor="mb-phone" hint="Email or phone — at least one, please.">
        <input id="mb-phone" className="input" inputMode="tel" autoComplete="tel" value={state.phone} onChange={(e) => set({ phone: e.target.value })} />
      </Field>
    </div>
  );
}
