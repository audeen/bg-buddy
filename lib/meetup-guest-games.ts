import type { Prisma } from "@prisma/client";

export function pickGamesWhere(meetupId: string): Prisma.GameWhereInput {
  return {
    isExpansion: false,
    OR: [
      { listedInCollection: true },
      { meetupGuestGames: { some: { meetupId } } },
    ],
  };
}

export const collectionGamesWhere: Prisma.GameWhereInput = {
  listedInCollection: true,
};
