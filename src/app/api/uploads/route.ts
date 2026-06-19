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

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/svg+xml": "svg",
};

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

    const ext = EXT_BY_MIME[file.type];
    if (!ext) {
      return jsonError(415, `Unsupported image type: ${file.type || "unknown"}`);
    }

    const bytes = Buffer.from(await file.arrayBuffer());
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
