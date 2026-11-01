/**
 * Bring a freshly opened inline CMS form into view and put the cursor in its
 * first field. On a phone the form renders below the whole row table, so
 * without this tapping Edit looks like it did nothing. `preventScroll` on the
 * focus keeps the smooth scroll from being cut short by the browser's jump.
 */
export function focusFormStart(form: HTMLElement | null): void {
  if (!form) return;
  form.scrollIntoView({ behavior: "smooth", block: "start" });
  const first = form.querySelector<HTMLElement>(
    "input:not([type=hidden]):not(.sr-only), textarea, select",
  );
  first?.focus({ preventScroll: true });
}
