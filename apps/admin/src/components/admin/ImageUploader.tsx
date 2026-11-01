"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { cn } from "@bnb/core/utils";
import { downscaleImage } from "./image-resize";

/**
 * Shared admin image uploader for gallery / flash / artist headshots
 * (BACKOFHOUSE-IA J1/J2/J3). Uploads to the owner-gated `POST /api/uploads`
 * route, which stores the bytes in Postgres and returns an origin-relative
 * `/media/[id]` URL that both the admin and web apps serve.
 * The `value`/`onChange` prop contract is the stable interface the CMS forms use.
 *
 * Big phone photos are downscaled in the browser first (see image-resize).
 * While a file is in flight the drop zone shows a spinner + "Uploading…" and
 * `onUploadingChange(true)` fires so the parent form can hold its Save button
 * — saving mid-upload would otherwise drop the new image.
 */

export interface ImageUploaderProps {
  /** Current image URL(s). String for single, array for multi. */
  value?: string | string[];
  onChange: (value: string | string[]) => void;
  /** Accept filter, e.g. "image/png,image/jpeg". */
  accept?: string;
  /** Allow selecting multiple images. */
  multiple?: boolean;
  /** Optional label for the drop zone. */
  label?: string;
  /** Fires true when an upload starts and false when it settles. */
  onUploadingChange?: (uploading: boolean) => void;
}

/** Merge a freshly-uploaded URL into the existing value (single replaces; multi appends). */
export function applyUploadedUrl(
  current: string | string[] | undefined,
  url: string,
  multiple: boolean,
): string | string[] {
  if (!multiple) return url;
  const list = Array.isArray(current) ? current : current ? [current] : [];
  return [...list, url];
}

/**
 * The message shown under the drop zone for a failed upload: the server's own
 * JSON `error` when it sent one, else a plain-English line for the status (a
 * proxy's 413 page has no JSON body).
 */
export function uploadErrorMessage(
  status: number,
  serverError?: string | null,
): string {
  if (serverError) return serverError;
  if (status === 413) return "That image is too large (max 8MB).";
  if (status === 415)
    return "That file isn't a supported image (JPG, PNG, WebP, AVIF).";
  if (status === 401 || status === 403)
    return "Your session has expired — sign in again to upload.";
  return `Upload failed (${status})`;
}

/** POST a file to /api/uploads, returning the stored public URL. */
export async function uploadImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.set("file", file);
  const res = await fetch("/api/uploads", { method: "POST", body: fd });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(uploadErrorMessage(res.status, body?.error));
  }
  const body = (await res.json()) as { url: string };
  return body.url;
}

function toList(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

export function ImageUploader({
  value,
  onChange,
  accept = "image/png,image/jpeg,image/webp,image/avif",
  multiple = false,
  label = "Upload image",
  onUploadingChange,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  // An upload can outlive the form (Cancel / switching rows mid-upload): its
  // late result must not land in whatever draft is open by then.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const images = toList(value);

  function setBusy(busy: boolean) {
    setUploading(busy);
    onUploadingChange?.(busy);
  }

  async function handleFiles(files: File[]) {
    if (files.length === 0) return;
    setError(null);
    setBusy(true);
    try {
      let next: string | string[] = value ?? (multiple ? [] : "");
      const chosen = multiple ? files : [files[0]];
      for (const file of chosen) {
        const url = await uploadImage(await downscaleImage(file));
        next = applyUploadedUrl(next, url, multiple);
      }
      if (mounted.current) onChange(next);
    } catch (err) {
      if (mounted.current) {
        setError(err instanceof Error ? err.message : "Upload failed");
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  function removeAt(index: number) {
    if (multiple) {
      onChange(images.filter((_, i) => i !== index));
    } else {
      onChange("");
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        aria-busy={uploading}
        className={cn(
          "grid w-full place-items-center gap-2 rounded-lg border border-dashed border-border-strong bg-bg-raised p-6 text-center text-sm text-text-muted transition-colors hover:border-bb-crimson/60 hover:text-text-secondary",
          uploading && "cursor-wait opacity-70",
        )}
        aria-label={label}
      >
        {uploading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <ImagePlus className="h-5 w-5" />
        )}
        <span className="font-termina uppercase tracking-wide">
          {uploading ? "Uploading…" : label}
        </span>
        <span className="text-xs">
          {uploading
            ? "Keep this page open until the preview appears"
            : `${accept.replace(/image\//g, "").replace(/,/g, " · ")}${multiple ? " · multiple" : ""}`}
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        onChange={(e) => {
          // Copy before clearing: resetting value empties the live FileList.
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          void handleFiles(files);
        }}
      />

      {error && (
        <p role="alert" className="text-xs text-bb-crimson">
          {error}
        </p>
      )}

      {images.length > 0 && (
        <ul className="flex flex-wrap gap-3">
          {images.map((src, i) => (
            <li key={`${src}-${i}`} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt=""
                className="h-20 w-20 rounded-md border border-border-default object-cover"
              />
              <button
                type="button"
                onClick={() => removeAt(i)}
                aria-label="Remove image"
                className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full border border-border-strong bg-bg-base text-text-secondary hover:text-bb-crimson"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
