"use client";

import { useRef, useState, useTransition } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shared admin image uploader for gallery / flash / artist headshots
 * (BACKOFHOUSE-IA J1/J2/J3). Uploads to the owner-gated `POST /api/uploads`
 * route, which stores under `public/uploads/` in dev and returns a public URL.
 * The `value`/`onChange` prop contract is the stable interface the CMS forms use.
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

/** POST a file to /api/uploads, returning the stored public URL. */
export async function uploadImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.set("file", file);
  const res = await fetch("/api/uploads", { method: "POST", body: fd });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(body?.error ?? `Upload failed (${res.status})`);
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
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const images = toList(value);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    try {
      let next: string | string[] = value ?? (multiple ? [] : "");
      const chosen = multiple ? Array.from(files) : [files[0]];
      for (const file of chosen) {
        const url = await uploadImage(file);
        next = applyUploadedUrl(next, url, multiple);
      }
      onChange(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
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
        className={cn(
          "grid w-full place-items-center gap-2 rounded-lg border border-dashed border-border-strong bg-bg-raised p-6 text-center text-sm text-text-muted transition-colors hover:border-bb-crimson/60 hover:text-text-secondary",
          pending && "opacity-70",
        )}
        aria-label={label}
      >
        {pending ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <ImagePlus className="h-5 w-5" />
        )}
        <span className="font-termina uppercase tracking-wide">{label}</span>
        <span className="text-xs">
          {accept.replace(/image\//g, "").replace(/,/g, " · ")}
          {multiple ? " · multiple" : ""}
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        onChange={(e) =>
          startTransition(() => {
            void handleFiles(e.target.files);
            e.target.value = "";
          })
        }
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
