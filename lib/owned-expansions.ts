import { prisma } from "@/lib/prisma";
import type { GameCardGame } from "@/components/GameCard";

export const gameCardSelect = {
  id: true,
  name: true,
  year: true,
  description: true,
  thumbnail: true,
  image: true,
  minPlayers: true,
  maxPlayers: true,
  minPlaytime: true,
  maxPlaytime: true,
  playingTime: true,
  weight: true,
  bggRating: true,
  ageRange: true,
  isExpansion: true,
  categories: true,
  mechanics: true,
  bestPlayerCounts: true,
  recommendedPlayerCounts: true,
} as const;

type ExpansionRow = GameCardGame & { expandsGameIds: number[] };

/** Builds baseGameId → owned expansions (sorted by name). Pure — for tests. */
export function buildOwnedExpansionsByBaseGame(
  expansions: ExpansionRow[],
): Map<number, GameCardGame[]> {
  const map = new Map<number, GameCardGame[]>();

  for (const expansion of expansions) {
    const { expandsGameIds, ...game } = expansion;
    for (const baseId of expandsGameIds) {
      const list = map.get(baseId) ?? [];
      list.push({ ...game, isExpansion: true });
      map.set(baseId, list);
    }
  }

  for (const [baseId, list] of map) {
    map.set(
      baseId,
      [...list].sort((a, b) => a.name.localeCompare(b.name, "de")),
    );
  }

  return map;
}

/** Serializes the map for client components (JSON-safe keys). */
export function serializeExpansionsByBaseId(
  map: Map<number, GameCardGame[]>,
): Record<string, GameCardGame[]> {
  const out: Record<string, GameCardGame[]> = {};
  for (const [baseId, expansions] of map) {
    out[String(baseId)] = expansions;
  }
  return out;
}

/** Owned expansions grouped by base game BGG id. */
export async function loadOwnedExpansionsByBaseGame(): Promise<
  Map<number, GameCardGame[]>
> {
  const expansions = await loadOwnedExpansionRows();
  return buildOwnedExpansionsByBaseGame(expansions);
}

export const expansionPlayerCountSelect = {
  minPlayers: true,
  maxPlayers: true,
  expandsGameIds: true,
  bestPlayerCounts: true,
} as const;

export type OwnedExpansionPlayerRow = {
  minPlayers: number | null;
  maxPlayers: number | null;
  expandsGameIds: number[];
  bestPlayerCounts: number[];
};

export async function loadOwnedExpansionRows(): Promise<
  (ExpansionRow & OwnedExpansionPlayerRow)[]
> {
  return prisma.game.findMany({
    where: { isExpansion: true, expandsGameIds: { isEmpty: false } },
    select: { ...gameCardSelect, ...expansionPlayerCountSelect },
  });
}
