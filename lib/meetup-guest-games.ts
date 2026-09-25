import type { HostChoiceMode, Prisma } from "@prisma/client";

export function pickGamesWhere(meetupId: string): Prisma.GameWhereInput {
  return {
    isExpansion: false,
    OR: [
      { listedInCollection: true },
      { meetupGuestGames: { some: { meetupId } } },
    ],
  };
}

export function pickGamesWhereForMeetup(
  meetupId: string,
  hostChoiceMode: HostChoiceMode,
  hostChoiceGameIds: number[],
  excludedGameIds: number[] = [],
): Prisma.GameWhereInput {
  const base = pickGamesWhere(meetupId);
  const pool =
    hostChoiceMode !== "RESTRICT" || hostChoiceGameIds.length === 0
      ? base
      : {
          isExpansion: false as const,
          OR: [
            { id: { in: hostChoiceGameIds } },
            { meetupGuestGames: { some: { meetupId } } },
          ],
        };

  if (excludedGameIds.length === 0) return pool;
  return { AND: [pool, { id: { notIn: excludedGameIds } }] };
}

export const collectionGamesWhere: Prisma.GameWhereInput = {
  listedInCollection: true,
};
