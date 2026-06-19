import { z } from "zod";
import { prisma } from "@/lib/db";
import { matchArtists, type MatchAnswers } from "@/lib/services/match";
import { handleApiError, json, parseBody } from "../_lib/http";

/**
 * POST /api/match — public Inkling Style Matcher.
 * Unauthenticated. Scores the seeded artists against the answer set and
 * returns the ranked top matches.
 */

const schema = z.object({
  vibe: z.enum(["trad", "fine", "dark", "play", "real", "geo"]).nullish(),
  subject: z
    .enum(["animal", "floral", "portrait", "words", "pattern", "anime", "unsure"])
    .nullish(),
  colour: z.enum(["bw", "bold", "touch"]).nullish(),
  placement: z.string().nullish(),
  exp: z.enum(["first", "few", "heavy"]).nullish(),
  limit: z.coerce.number().int().min(1).max(7).optional(),
});

export async function POST(req: Request): Promise<Response> {
  try {
    const input = await parseBody(req, schema);
    const answers: MatchAnswers = {
      vibe: input.vibe,
      subject: input.subject,
      colour: input.colour,
      placement: input.placement,
      exp: input.exp,
    };

    const artists = await prisma.artist.findMany({
      where: { active: true },
      select: {
        id: true,
        slug: true,
        name: true,
        styles: true,
        specials: true,
        booksStatus: true,
      },
    });

    const results = matchArtists(answers, artists, input.limit ?? 4);
    return json({ results });
  } catch (err) {
    return handleApiError(err);
  }
}
