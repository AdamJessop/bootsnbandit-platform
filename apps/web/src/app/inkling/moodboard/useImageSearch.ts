"use client";

import { useCallback, useState } from "react";
import type { InspirationResponse, StudioImageResult, WebImageResult } from "@bnb/core/services/image-search";

export interface SearchRequest {
  styles: string[];
  colour: "bw" | "colour" | "either" | null;
  description: string;
  start: number;
}

export interface ImageSearchState {
  status: "idle" | "loading" | "done" | "error";
  error: string | null;
  query: string | null;
  studio: StudioImageResult[];
  web: WebImageResult[];
  nextStart: number | null;
  providerConfigured: boolean;
  webError: boolean;
}

export interface ImageSearch extends ImageSearchState {
  run(req: SearchRequest): Promise<void>;
  more(req: SearchRequest): Promise<void>;
}

const initial: ImageSearchState = {
  status: "idle", error: null, query: null, studio: [], web: [], nextStart: null,
  providerConfigured: true, webError: false,
};

async function post(req: SearchRequest): Promise<InspirationResponse> {
  const res = await fetch("/api/inkling/search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "Couldn't search right now. Please try again.");
  }
  return (await res.json()) as InspirationResponse;
}

export function useImageSearch(): ImageSearch {
  const [state, setState] = useState<ImageSearchState>(initial);

  const run = useCallback(async (req: SearchRequest) => {
    setState((s) => ({ ...s, status: "loading", error: null }));
    try {
      const r = await post({ ...req, start: 1 });
      setState({ status: "done", error: null, query: r.query, studio: r.studio, web: r.web,
        nextStart: r.nextStart, providerConfigured: r.providerConfigured, webError: r.webError });
    } catch (err) {
      setState((s) => ({ ...s, status: "error", error: err instanceof Error ? err.message : "Please try again." }));
    }
  }, []);

  const more = useCallback(async (req: SearchRequest) => {
    setState((s) => ({ ...s, status: "loading", error: null }));
    try {
      const r = await post(req);
      setState((s) => ({ ...s, status: "done", web: [...s.web, ...r.web], nextStart: r.nextStart, webError: r.webError }));
    } catch (err) {
      setState((s) => ({ ...s, status: "error", error: err instanceof Error ? err.message : "Please try again." }));
    }
  }, []);

  return { ...state, run, more };
}
