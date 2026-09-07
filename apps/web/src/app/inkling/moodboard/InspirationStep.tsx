"use client";

import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import { Check, ImagePlus, Link as LinkIcon, RefreshCw } from "lucide-react";
import type { StudioImageResult, WebImageResult } from "@bnb/core/services/image-search";
import {
  buildSearchRequest, hasItem, linkToItem, MAX_BOARD_ITEMS, parsePastedUrl, removeItem,
  studioResultToItem, toggleItem, uploadToItem, webResultToItem, type BoardItem, type BuilderState,
} from "./logic";
import { prepareImage } from "./image-prep";
import type { ImageSearch } from "./useImageSearch";
import enq from "../../enquire/enquire.module.css";
import css from "./moodboard.module.css";

type Set = (patch: Partial<BuilderState>) => void;

async function uploadFile(file: File): Promise<{ assetId: string; url: string }> {
  const prepared = await prepareImage(file);
  const fd = new FormData();
  fd.set("file", prepared);
  const res = await fetch("/api/inkling/uploads", { method: "POST", body: fd });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Upload failed (${res.status})`);
  }
  return (await res.json()) as { assetId: string; url: string };
}

export function InspirationStep({ state, set, search }: { state: BuilderState; set: Set; search: ImageSearch }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [link, setLink] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const ranFor = useRef<string | null>(null);

  // Run the search once per brief when the step mounts / the brief changes.
  const briefKey = JSON.stringify(buildSearchRequest(state));
  useEffect(() => {
    if (ranFor.current === briefKey) return;
    ranFor.current = briefKey;
    void search.run(buildSearchRequest(state));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [briefKey]);

  useEffect(() => {
    if (search.query && search.query !== state.query) set({ query: search.query });
  }, [search.query, state.query, set]);

  function toggle(item: BoardItem) {
    const r = toggleItem(state.items, item);
    if (!r.ok) return setError(r.error);
    setError(null);
    set({ items: r.items });
  }

  async function addFiles(files: Iterable<File>) {
    setBusy(true);
    setError(null);
    try {
      let items = state.items;
      for (const file of files) {
        if (!file.type.startsWith("image/")) continue;
        const up = await uploadFile(file);
        const r = toggleItem(items, uploadToItem(up, file.name));
        if (!r.ok) {
          setError(r.error);
          break;
        }
        items = r.items;
      }
      set({ items });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function addLink(raw: string): boolean {
    const url = parsePastedUrl(raw);
    if (!url) return false;
    toggle(linkToItem(url));
    setLink("");
    return true;
  }

  function onPaste(e: ClipboardEvent<HTMLDivElement>) {
    const files = Array.from(e.clipboardData.files ?? []);
    if (files.length) {
      e.preventDefault();
      void addFiles(files);
      return;
    }
    const text = e.clipboardData.getData("text");
    if (text && addLink(text)) e.preventDefault();
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setOver(false);
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length) void addFiles(files);
  }

  const loading = search.status === "loading";

  return (
    <div onPaste={onPaste}>
      <h2 className={enq.panelTitle}>Inspiration</h2>
      <p className={enq.panelSub}>
        Tap anything that feels right to add it to your board. Upload or paste your own too. References guide the look — we never copy another person&rsquo;s tattoo.
      </p>

      <div className={css.toolbar}>
        <span className={css.brief}>{search.query ? <>Searching for <b>{search.query}</b></> : "Building your search…"}</span>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => void search.run(buildSearchRequest(state))} disabled={loading}>
          <RefreshCw className="ic" /> Search again
        </button>
      </div>

      {search.error && <p className={enq.error}>{search.error}</p>}

      {search.studio.length > 0 && (
        <ResultGroup title="From our studio">
          {search.studio.map((r) => <ResultTile key={r.galleryItemId} item={studioResultToItem(r)} items={state.items} onToggle={toggle} />)}
        </ResultGroup>
      )}

      <ResultGroup title="From the web">
        {loading && search.web.length === 0 ? (
          Array.from({ length: 8 }, (_, i) => <div key={i} className={css.skeleton} aria-hidden />)
        ) : search.web.length > 0 ? (
          search.web.map((r) => <ResultTile key={r.url} item={webResultToItem(r)} items={state.items} onToggle={toggle} />)
        ) : null}
      </ResultGroup>
      {!search.providerConfigured && search.status !== "idle" && (
        <p className={css.hint}>Web search isn&rsquo;t available right now — upload or paste your own images below.</p>
      )}
      {search.providerConfigured && search.webError && (
        <p className={css.hint}>Web search is unavailable at the moment — you can still upload or paste images.</p>
      )}
      {search.providerConfigured && !loading && search.status === "done" && search.web.length === 0 && !search.webError && (
        <p className={css.hint}>No web results for that brief — try fewer words, or add your own images.</p>
      )}
      {search.nextStart && (
        <div className={css.loadMore}>
          <button type="button" className="btn btn-ghost" disabled={loading} onClick={() => void search.more(buildSearchRequest(state, search.nextStart ?? 1))}>
            {loading ? "Loading…" : "Load more"}
          </button>
        </div>
      )}

      <div
        className={`${css.dropZone} ${over ? css.over : ""}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        <ImagePlus className="ic" />
        <div>Drop images here, paste from your clipboard, or</div>
        <div className={css.dropActions}>
          <button type="button" className="btn btn-sm" disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? "Uploading…" : "Upload images"}
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
          multiple
          className={css.srOnly}
          aria-label="Upload images"
          onChange={(e) => { if (e.target.files) void addFiles(Array.from(e.target.files)); e.target.value = ""; }}
        />
        <div className={css.linkRow}>
          <input
            className="input"
            type="url"
            inputMode="url"
            placeholder="…or paste an image link https://"
            aria-label="Image link"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (!addLink(link)) setError("That doesn't look like a full http(s) link."); } }}
          />
          <button type="button" className="btn btn-ghost" onClick={() => { if (!addLink(link)) setError("That doesn't look like a full http(s) link."); }}>
            <LinkIcon className="ic" /> Add
          </button>
        </div>
      </div>
      {error && <p className={enq.error}>{error}</p>}

      <div className={css.tray}>
        <div className={css.trayHead}>
          <strong>Your board</strong>
          <span className={css.count}>{state.items.length} of {MAX_BOARD_ITEMS}</span>
        </div>
        {state.items.length === 0 ? (
          <p className={enq.moodEmpty}>Nothing on the board yet — tap an image above to add it.</p>
        ) : (
          <div className={css.trayGrid}>
            {state.items.map((i) => (
              <div key={i.key} className={css.trayTile}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={i.thumbUrl ?? i.url} alt={i.title ?? "Board image"} loading="lazy" />
                <button type="button" className={css.trayRemove} aria-label={`Remove ${i.title ?? "image"}`} onClick={() => set({ items: removeItem(state.items, i.key) })}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ResultGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={css.group}>
      <h3 className={css.groupTitle}>{title}</h3>
      <div className={css.grid}>{children}</div>
    </section>
  );
}

function ResultTile({ item, items, onToggle }: { item: BoardItem; items: BoardItem[]; onToggle: (i: BoardItem) => void }) {
  const on = hasItem(items, item.key);
  return (
    <button type="button" className={`${css.tile} ${on ? css.on : ""}`} aria-pressed={on} onClick={() => onToggle(item)} title={item.title ?? undefined}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.thumbUrl ?? item.url} alt={item.title ?? "Inspiration image"} loading="lazy" referrerPolicy="no-referrer" />
      {on && <span className={css.tileCheck}><Check size={14} /></span>}
      {item.title && <span className={css.tileCap}>{item.title}</span>}
    </button>
  );
}

export type { StudioImageResult, WebImageResult };
