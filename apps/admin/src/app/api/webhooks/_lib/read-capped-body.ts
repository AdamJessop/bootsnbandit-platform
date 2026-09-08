/**
 * The raw request body for an UNAUTHENTICATED webhook route, capped.
 *
 * Shared by the Resend and Meta endpoints because the rule is the same for
 * both and it must not drift: whoever POSTs here has not proved anything yet,
 * so nothing may be buffered without a limit.
 *
 * Deliberately NOT `req.text()`: that buffers whatever the caller sends before
 * anything — signature verification included — has had a chance to reject it,
 * so an unsigned request could pin memory at will. Reading the stream by hand
 * lets the read be abandoned the instant the running total crosses the cap.
 *
 * The bytes are decoded exactly once, as UTF-8, and that string is what the
 * signature is checked against: re-serialising would change the bytes and
 * break the HMAC.
 */

/**
 * Both routes' cap. Checked twice by their callers — against the (spoofable)
 * `content-length` header before touching the body at all, and against the
 * actual bytes as they stream in, since a caller can omit or lie about the
 * header. The second check is what makes the cap real.
 */
export const MAX_WEBHOOK_BODY_BYTES = 1_048_576;

/** The decoded body, or null when it exceeds the cap. */
export async function readCappedBody(
  req: Request,
  maxBytes: number = MAX_WEBHOOK_BODY_BYTES,
): Promise<string | null> {
  if (!req.body) return "";

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8").decode(bytes);
}
