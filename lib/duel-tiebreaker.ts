export type GameTieMeta = {
  bestPlayerCounts: number[];
  rank: number | null;
  bggRating: number | null;
};

export type DuelTieBreakContext = {
  pickCounts: Record<number, number>;
  expectedPlayerCount: number;
  games: Record<number, GameTieMeta>;
  meetupId: string;
};

function isBestAtCount(meta: GameTieMeta, playerCount: number): boolean {
  return meta.bestPlayerCounts.includes(playerCount);
}

function deterministicPick(gameA: number, gameB: number, seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h % 2 === 0 ? gameA : gameB;
}

/** Tie-breaker cascade when duel votes are tied (FULL phase). */
export function breakDuelTie(
  gameA: number,
  gameB: number,
  pairKeyStr: string,
  ctx: DuelTieBreakContext,
): number {
  const picksA = ctx.pickCounts[gameA] ?? 0;
  const picksB = ctx.pickCounts[gameB] ?? 0;
  if (picksA > picksB) return gameA;
  if (picksB > picksA) return gameB;

  const metaA = ctx.games[gameA];
  const metaB = ctx.games[gameB];
  const bestA = metaA ? isBestAtCount(metaA, ctx.expectedPlayerCount) : false;
  const bestB = metaB ? isBestAtCount(metaB, ctx.expectedPlayerCount) : false;
  if (bestA && !bestB) return gameA;
  if (bestB && !bestA) return gameB;

  const ratingA = metaA?.bggRating;
  const ratingB = metaB?.bggRating;
  const hasRatingA = ratingA != null && Number.isFinite(ratingA);
  const hasRatingB = ratingB != null && Number.isFinite(ratingB);
  if (hasRatingA && hasRatingB && ratingA !== ratingB) {
    return ratingA! > ratingB! ? gameA : gameB;
  }
  if (hasRatingA && !hasRatingB) return gameA;
  if (hasRatingB && !hasRatingA) return gameB;

  const rankA = metaA?.rank;
  const rankB = metaB?.rank;
  const hasRankA = rankA != null && rankA > 0;
  const hasRankB = rankB != null && rankB > 0;
  if (hasRankA && hasRankB && rankA !== rankB) {
    return rankA! < rankB! ? gameA : gameB;
  }
  if (hasRankA && !hasRankB) return gameA;
  if (hasRankB && !hasRankA) return gameB;

  const seed = `${ctx.meetupId}:${pairKeyStr}`;
  return deterministicPick(gameA, gameB, seed);
}

export function buildGameTieMetaMap(
  games: {
    id: number;
    bestPlayerCounts: number[];
    rank: number | null;
    bggRating: number | null;
  }[],
): Record<number, GameTieMeta> {
  const out: Record<number, GameTieMeta> = {};
  for (const g of games) {
    out[g.id] = {
      bestPlayerCounts: g.bestPlayerCounts,
      rank: g.rank,
      bggRating: g.bggRating,
    };
  }
  return out;
}
