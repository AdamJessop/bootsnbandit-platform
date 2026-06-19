import { Mark } from "@/components/site";
import styles from "./passport.module.css";

/**
 * The Bandit Pass loyalty card — a Mark-stamped 8-cell card with holder name,
 * tier label and the filled/empty stamp split. Pure presentational; rendered
 * on both the home passport band and the passport marketing page.
 */
export function PassportCard({
  holder,
  level,
  filled,
  total,
  since,
}: {
  holder: string;
  level: string;
  filled: number;
  total: number;
  since?: string;
}) {
  return (
    <div className={styles.card}>
      <div className={styles.cardTop}>
        <b>BANDIT PASS</b>
        <Mark className={styles.mark} />
      </div>
      <div>
        <div className={styles.holder}>{holder}</div>
        {since && <span className={styles.since}>Member since {since}</span>}
      </div>
      <div className={styles.stamps}>
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={`${styles.stamp}${i < filled ? ` ${styles.filled}` : ""}`}
            aria-hidden
          >
            {i < filled ? <Mark /> : null}
          </span>
        ))}
      </div>
      <span className={styles.level}>
        {level} · {filled}/{total}
      </span>
    </div>
  );
}
