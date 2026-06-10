import { prisma } from "@/lib/prisma";
import { isPlayableAtCount } from "@/lib/effective-player-count";
import type { MandatoryExpansionFamily } from "@/lib/types/meetup";

export async function loadWinnerExpansionFamily(
  winnerGameId: number,
  playerCount: number,
): Promise<MandatoryExpansionFamily | null> {
  const [baseGame, expansions] = await Promise.all([
    prisma.game.findUnique({
      where: { id: winnerGameId, isExpansion: false },
      select: { id: true, name: true },
    }),
    prisma.game.findMany({
      where: {
        isExpansion: true,
        listedInCollection: true,
        expandsGameIds: { has: winnerGameId },
      },
      select: {
        id: true,
        name: true,
        minPlayers: true,
        maxPlayers: true,
      },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!baseGame) return null;

  const playable = expansions.filter((exp) =>
    isPlayableAtCount(exp.minPlayers, exp.maxPlayers, playerCount),
  );
  if (playable.length === 0) return null;

  return {
    baseGameId: baseGame.id,
    baseGameName: baseGame.name,
    expansions: playable.map((e) => ({ id: e.id, name: e.name })),
  };
}

export function mandatoryExpansionKeys(
  rows: { baseGameId: number; expansionGameId: number }[],
): string[] {
  return rows.map((r) => `${r.baseGameId}:${r.expansionGameId}`);
}

export function mandatoryExpansionKeysForWinner(
  rows: { baseGameId: number; expansionGameId: number }[],
  winnerGameId: number,
): string[] {
  return mandatoryExpansionKeys(
    rows.filter((r) => r.baseGameId === winnerGameId),
  );
}
