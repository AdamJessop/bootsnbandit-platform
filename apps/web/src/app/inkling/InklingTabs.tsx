"use client";

import { useState } from "react";
import { StyleMatcher } from "./StyleMatcher";
import { MoodBoardBuilder } from "./moodboard/MoodBoardBuilder";
import styles from "../enquire/enquire.module.css";

export interface InklingArtist {
  id: string;
  name: string;
  role: string;
  slug: string;
  booksStatus: "open" | "limited" | "closed";
}

type Tab = "match" | "mood";

export function InklingTabs({
  initialTab = "match",
  artists,
  styleOptions,
}: {
  initialTab?: Tab;
  artists: InklingArtist[];
  styleOptions: string[];
}) {
  const [tab, setTab] = useState<Tab>(initialTab);

  return (
    <div>
      <div className={styles.tabs} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "match"}
          className={`${styles.tab} ${tab === "match" ? styles.on : ""}`}
          onClick={() => setTab("match")}
        >
          Style Matcher
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "mood"}
          className={`${styles.tab} ${tab === "mood" ? styles.on : ""}`}
          onClick={() => setTab("mood")}
        >
          Mood Board
        </button>
      </div>

      {tab === "match" ? (
        <StyleMatcher />
      ) : (
        <MoodBoardBuilder artists={artists} styleOptions={styleOptions} />
      )}
    </div>
  );
}
