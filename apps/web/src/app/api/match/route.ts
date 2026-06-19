import { z } from "zod";
import { prisma } from "@bnb/core/db";
import {
  matchArtists,
  toMatchArtist,
  type MatchAnswers,
} from "@bnb/core/services/match";
import { handleApiError, json, parseBody } from "@bnb/core/http";

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
        styles: { select: { name: true } },
        specials: true,
        booksStatus: true,
      },
    });

    const results = matchArtists(
      answers,
      artists.map(toMatchArtist),
      input.limit ?? 4,
    );
    return json({ results });
  } catch (err) {
    return handleApiError(err);
  }
}
