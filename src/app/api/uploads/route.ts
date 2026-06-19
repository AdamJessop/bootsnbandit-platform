import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { requireRole } from "@/lib/auth";
import { handleApiError, json, jsonError } from "../_lib/http";

/**
 * POST /api/uploads — owner-gated image upload for the content CMS
 * (gallery / flash / artist headshots). Dev storage: writes the file under
 * `public/uploads/` and returns its public URL. Pluggable: swap the write
 * sink for S3/Blob later without changing the ImageUploader contract.
 */

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024; // 8MB

// Raster formats only. SVG is intentionally excluded: it is an XML document
// that can carry <script>/onload handlers and become stored XSS when served
// inline, so we never accept it.
const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

/**
 * Sniff the real image format from the file's leading bytes (magic numbers).
 * We do NOT trust the client-supplied `file.type` — a request can claim
 * `image/png` while shipping an SVG/HTML payload. Returns the canonical MIME
 * type, or null if the header matches no allowed raster format.
 */
function sniffImageMime(buf: Buffer): string | null {
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return "image/png";
  }
  // JPEG: FF D8 FF
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  // GIF: "GIF87a" / "GIF89a"
  if (buf.length >= 6 && buf.subarray(0, 3).toString("latin1") === "GIF") {
    return "image/gif";
  }
  // RIFF container — WEBP has "RIFF"...."WEBP"
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString("latin1") === "RIFF" &&
    buf.subarray(8, 12).toString("latin1") === "WEBP"
  ) {
    return "image/webp";
  }
  // AVIF: ISO-BMFF box "ftyp" at offset 4 with an avif-family brand.
  if (
    buf.length >= 12 &&
    buf.subarray(4, 8).toString("latin1") === "ftyp" &&
    /avif|avis/.test(buf.subarray(8, 12).toString("latin1"))
  ) {
    return "image/avif";
  }
  return null;
}

export async function POST(req: Request): Promise<Response> {
  try {
    await requireRole("OWNER");

    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) {
      return jsonError(400, "No file provided");
    }
    if (file.size === 0) {
      return jsonError(400, "Empty file");
    }
    if (file.size > MAX_BYTES) {
      return jsonError(413, "File too large (max 8MB)");
    }

    // Reject obviously-unsupported client types early (cheap), but never trust
    // them: the authoritative check is the magic-number sniff below.
    if (!EXT_BY_MIME[file.type]) {
      return jsonError(415, `Unsupported image type: ${file.type || "unknown"}`);
    }

    const bytes = Buffer.from(await file.arrayBuffer());

    // Validate the actual file bytes. This blocks stored XSS via SVG/HTML
    // payloads and content-type spoofing (e.g. an SVG sent as image/png).
    const sniffed = sniffImageMime(bytes);
    if (!sniffed || sniffed !== file.type) {
      return jsonError(415, "File content does not match a supported image format");
    }
    const ext = EXT_BY_MIME[sniffed];

    const name = `${Date.now()}-${randomBytes(6).toString("hex")}.${ext}`;
    const dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), bytes);

    const url = `/uploads/${name}`;
    return json({ url }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
