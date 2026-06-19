"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import styles from "./aftercare.module.css";

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

/**
 * Client island: an accessible FAQ accordion. The first item is open by
 * default; clicking a question toggles it (single-open behaviour).
 */
export function FaqAccordion({ faqs }: { faqs: FaqItem[] }) {
  const [openId, setOpenId] = useState<string | null>(faqs[0]?.id ?? null);

  return (
    <div className={styles.faqList}>
      {faqs.map((f) => {
        const isOpen = openId === f.id;
        return (
          <div
            key={f.id}
            className={`${styles.faqItem}${isOpen ? ` ${styles.open}` : ""}`}
          >
            <button
              type="button"
              className={styles.faqQ}
              aria-expanded={isOpen}
              onClick={() => setOpenId(isOpen ? null : f.id)}
            >
              <span>{f.question}</span>
              <ChevronDown className="ic" aria-hidden />
            </button>
            {isOpen && <div className={styles.faqA}>{f.answer}</div>}
          </div>
        );
      })}
    </div>
  );
}
