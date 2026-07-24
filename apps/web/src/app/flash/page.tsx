import type { Metadata } from "next";
import Link from "next/link";
import { Flame } from "lucide-react";
import { ornDot, Plate, ArtistAvatar } from "@/components/site";
import { getFlash } from "../_data";
import { formatPence } from "../_format";
import { groupByDeadline, flashStock, nextDropDeadline } from "./logic";
import styles from "./flash.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Flash Drops · Boots 'n' Bandit",
  description:
    "One-off flash designs, dropped every Friday at 6pm. Claim a piece before it's gone — a quick, affordable way to get tattooed.",
};

export default async function FlashPage() {
  const flash = await getFlash();
  const groups = groupByDeadline(flash);
  const nextDeadline = nextDropDeadline(flash);

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
          {nextDeadline && (
            <div className={styles.countdown}>
              <Flame className={styles.countdownIc} aria-hidden />
              <div className={styles.countdownBody}>
                <b>Next drop closes {nextDeadline}</b>
                <small>New flash every Friday at 6pm.</small>
              </div>
            </div>
          )}

          {groups.map((group) => (
            <div key={group.deadline} className={styles.group}>
              <div className={styles.groupHead}>
                <h2 className={styles.groupTitle}>
                  Live until {group.deadline}
                </h2>
                <span className={styles.groupCount}>
                  {group.items.length} available
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
                          {gone ? "All claimed" : `${left} of ${f.total} left`}
                        </span>
                        <Plate
                          paper
                          src={f.image ?? undefined}
                          ratio="1/1"
                          className="flash-card-art"
                        />
                      </div>
                      <div className="flash-card-body">
                        <span className="flash-title-sm">{f.title}</span>
                        <span className={styles.flashPrice}>
                          {formatPence(f.pricePence)}
                        </span>
                        <div className={styles.flashMeta}>
                          <ArtistAvatar
                            artist={{ name: f.artistName ?? "Artist" }}
                            size="sm"
                          />
                          <span>
                            {f.artistName} · {f.size}
                          </span>
                        </div>
                        {gone ? (
                          <button type="button" className="btn btn-sm" disabled>
                            All claimed
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
          ))}

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
