import { prisma } from "@/lib/prisma";

/** BGG ids of base games that have at least one owned expansion in the collection. */
export async function loadBaseGameIdsWithOwnedExpansions(): Promise<Set<number>> {
  const expansions = await prisma.game.findMany({
    where: { isExpansion: true, expandsGameIds: { isEmpty: false } },
    select: { expandsGameIds: true },
  });
  return new Set(expansions.flatMap((e) => e.expandsGameIds));
}
