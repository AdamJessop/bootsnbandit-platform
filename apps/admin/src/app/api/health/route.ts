/**
 * /api/health — container liveness probe. Deliberately touches NOTHING
 * (no database, no imports): a DB outage must degrade requests, not
 * restart-loop the app container.
 */
export const dynamic = "force-dynamic";

export function GET(): Response {
  return Response.json({ ok: true });
}
