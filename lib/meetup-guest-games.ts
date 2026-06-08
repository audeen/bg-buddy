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
): Prisma.GameWhereInput {
  const base = pickGamesWhere(meetupId);
  if (
    hostChoiceMode !== "RESTRICT" ||
    hostChoiceGameIds.length === 0
  ) {
    return base;
  }
  return {
    isExpansion: false,
    OR: [
      { id: { in: hostChoiceGameIds } },
      { meetupGuestGames: { some: { meetupId } } },
    ],
  };
}

export const collectionGamesWhere: Prisma.GameWhereInput = {
  listedInCollection: true,
};
