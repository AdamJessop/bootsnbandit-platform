import type { InklingArtist } from "../InklingTabs";
import { COLOUR_OPTIONS, type BuilderState } from "./logic";
import styles from "../../enquire/enquire.module.css";

export function BoardSummary({ state, artists }: { state: BuilderState; artists: InklingArtist[] }) {
  const artist = artists.find((a) => a.id === state.artistId);
  const colour = COLOUR_OPTIONS.find((c) => c.value === state.colour)?.label;
  const n = state.items.length;
  return (
    <aside className={styles.aside}>
      <strong>Your board</strong>
      <dl>
        <dt>Images</dt>
        <dd>{n === 0 ? "None yet" : `${n} image${n === 1 ? "" : "s"}`}</dd>
        {state.styles.length > 0 && (<><dt>Styles</dt><dd>{state.styles.join(", ")}</dd></>)}
        {colour && (<><dt>Colour</dt><dd>{colour}</dd></>)}
        {state.description.trim() && (<><dt>Idea</dt><dd>{state.description.trim()}</dd></>)}
        {state.placement && (<><dt>Placement</dt><dd>{state.placement}</dd></>)}
        {state.size && (<><dt>Size</dt><dd>{state.size}</dd></>)}
        {state.budget.trim() && (<><dt>Budget</dt><dd>£{state.budget.trim()}</dd></>)}
        <dt>Artist</dt>
        <dd>{artist ? artist.name : "No preference"}</dd>
      </dl>
    </aside>
  );
}
