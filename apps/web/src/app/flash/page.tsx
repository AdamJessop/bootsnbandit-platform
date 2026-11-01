import type { Metadata } from "next";
import Link from "next/link";
import { Flame } from "lucide-react";
import { ornDot, Plate, ArtistAvatar } from "@/components/site";
import { pageMetadata } from "@/lib/seo";
import { getFlash, getSiteSettings } from "../_data";
import { formatPence } from "../_format";
import {
  groupByEndsAt,
  flashStock,
  formatEndsAt,
  liveFlash,
  nextDropEnds,
} from "./logic";
import styles from "./flash.module.css";

export const dynamic = "force-dynamic";

const TITLE = "Flash Drops · Boots 'n' Bandit";
const DESCRIPTION =
  "One-off flash designs from the Boots 'n' Bandit crew in Worksop. Claim a piece before it's gone — a quick, affordable way to get tattooed.";

/** Shares the first live design's photo when there is one. */
export async function generateMetadata(): Promise<Metadata> {
  let image: { url: string; alt: string } | undefined;
  try {
    const first = liveFlash(await getFlash()).find((f) => f.image);
    if (first?.image) image = { url: first.image, alt: first.title };
  } catch {
    // DB away: fall back to the branded card.
  }
  return pageMetadata({
    title: TITLE,
    description: DESCRIPTION,
    path: "/flash",
    image,
  });
}

export default async function FlashPage() {
  const [all, settings] = await Promise.all([getFlash(), getSiteSettings()]);
  // Expired drops come off the wall; "Live until" only ever shows a future date.
  const flash = liveFlash(all);
  const groups = groupByEndsAt(flash);
  const nextEnds = nextDropEnds(flash);
  const claimsOpen = settings?.enquiriesOpen ?? true;

  return (
    <div className="page">
      <header className="page-head">
        <div className="wrap-wide">
          <span className="eyebrow crimson">
            {ornDot()}
            Flash drops
          </span>
          <h1 className="display chrome" style={{ margin: "10px 0 14px" }}>
            Claim a one-off
          </h1>
          <p className="lead" style={{ maxWidth: 640 }}>
            Pre-drawn designs, inked once and never again. A quick, affordable
            way to get something special — first come, first served.
          </p>
        </div>
      </header>

      <section className="section">
        <div className="wrap-wide">
          {!claimsOpen && (
            <div className={styles.countdown} role="status">
              <Flame className={styles.countdownIc} aria-hidden />
              <div className={styles.countdownBody}>
                <b>Books are closed — flash claims are paused</b>
                <small>
                  We&rsquo;re not taking new enquiries just now. Check back
                  soon.
                </small>
              </div>
            </div>
          )}
          {claimsOpen && nextEnds && (
            <div className={styles.countdown}>
              <Flame className={styles.countdownIc} aria-hidden />
              <div className={styles.countdownBody}>
                <b>Next drop closes {formatEndsAt(nextEnds)}</b>
                <small>
                  Claim before then — once it&rsquo;s gone, it&rsquo;s gone.
                </small>
              </div>
            </div>
          )}

          {groups.length === 0 && (
            <div className="card card-pad" style={{ textAlign: "center" }}>
              <p className="muted" style={{ margin: 0 }}>
                No flash on the wall right now — new designs land here as soon
                as they&rsquo;re drawn.
              </p>
            </div>
          )}

          {groups.map((group) => {
            const available = group.items.filter(
              (f) => !flashStock(f.total, f.claimed).gone,
            ).length;
            return (
              <div key={group.label ?? "open"} className={styles.group}>
                <div className={styles.groupHead}>
                  <h2 className={styles.groupTitle}>
                    {group.label ?? "On the wall now"}
                  </h2>
                  <span className={styles.groupCount}>
                    {available} available
                  </span>
                </div>
                <div className="flash-grid">
                  {group.items.map((f) => {
                    const { left, gone, low } = flashStock(f.total, f.claimed);
                    const stockClass = gone ? "out" : low ? "low" : "";
                    return (
                      <article
                        key={f.id}
                        className={`card flash-card${gone ? " gone" : ""}`}
                      >
                        <div className="flash-card-art">
                          <span className={`flash-stock ${stockClass}`}>
                            {gone
                              ? "All claimed"
                              : `${left} of ${f.total} left`}
                          </span>
                          <Plate
                            paper
                            src={f.image ?? undefined}
                            ratio="1/1"
                            className="flash-card-art"
                            alt={f.title}
                          />
                        </div>
                        <div className="flash-card-body">
                          <span className="flash-title-sm">{f.title}</span>
                          <span className={styles.flashPrice}>
                            {formatPence(f.pricePence)}
                          </span>
                          <div className={styles.flashMeta}>
                            {f.artistName && (
                              <ArtistAvatar
                                artist={{ name: f.artistName }}
                                size="sm"
                              />
                            )}
                            <span>
                              {[f.artistName, f.size]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </div>
                          {gone ? (
                            <button
                              type="button"
                              className="btn btn-sm"
                              disabled
                            >
                              All claimed
                            </button>
                          ) : !claimsOpen ? (
                            <button
                              type="button"
                              className="btn btn-sm"
                              disabled
                            >
                              Claims paused
                            </button>
                          ) : (
                            <Link
                              href={`/enquire?flash=${f.id}`}
                              className="btn btn-sm"
                            >
                              Claim
                            </Link>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div
            className="card card-pad"
            style={{ marginTop: 24, textAlign: "center" }}
          >
            <p className="muted" style={{ marginBottom: 12 }}>
              Want something custom instead? We&rsquo;ll draw a one-off just for
              you.
            </p>
            <Link href="/enquire" className="btn btn-sm btn-ghost">
              Make an enquiry &rarr;
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
