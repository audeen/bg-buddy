import type { RankEntry } from "@/lib/types/ranking";
import { buildCopelandForCount } from "@/lib/copeland";
import { type DuelFrozenData, pairCount } from "@/lib/duel-pairs";
import {
  buildGameTieMetaMap,
  type DuelTieBreakContext,
} from "@/lib/duel-tiebreaker";
import { buildPickCounts, poolGameIds } from "@/lib/pick-pool";
import { resolveCoverSrc } from "@/lib/cover-image";
import { FULL_THRESHOLD } from "@/lib/vote-limits";

type VoteRow = {
  playerCount: number;
  gameId: number;
  opponentGameId?: number | null;
  userId: string;
  points: number;
  mode: string;
  game: {
    id: number;
    name: string;
    thumbnail: string | null;
    image: string | null;
    coverUrl?: string | null;
    bestPlayerCounts?: number[];
    rank?: number | null;
    bggRating?: number | null;
  };
};

export function buildRankingByCount(
  votes: VoteRow[],
  mode?: "PICK" | "DUEL",
): Record<number, RankEntry[]> {
  const filtered = mode ? votes.filter((v) => v.mode === mode) : votes;
  const byCount = new Map<
    number,
    Map<number, { entry: RankEntry; voters: Set<string> }>
  >();

  for (const v of filtered) {
    if (!byCount.has(v.playerCount)) byCount.set(v.playerCount, new Map());
    const games = byCount.get(v.playerCount)!;
    if (!games.has(v.gameId)) {
      games.set(v.gameId, {
        entry: {
          id: v.game.id,
          name: v.game.name,
          thumbnail: resolveCoverSrc(v.game),
          points: 0,
          voters: 0,
        },
        voters: new Set(),
      });
    }
    const g = games.get(v.gameId)!;
    g.entry.points += v.points;
    g.voters.add(v.userId);
  }

  const rankingByCount: Record<number, RankEntry[]> = {};
  for (const [pc, games] of byCount) {
    rankingByCount[pc] = Array.from(games.values())
      .map(({ entry, voters }) => ({ ...entry, voters: voters.size }))
      .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  }
  return rankingByCount;
}

export function buildDuelCopelandByCount(
  votes: VoteRow[],
  meetupId?: string,
  frozen?: DuelFrozenData | null,
): Record<number, RankEntry[]> {
  const picksByCount = new Map<number, { gameId: number; points: number }[]>();
  for (const v of votes) {
    if (v.mode !== "PICK") continue;
    if (!picksByCount.has(v.playerCount)) picksByCount.set(v.playerCount, []);
    picksByCount.get(v.playerCount)!.push({
      gameId: v.gameId,
      points: v.points,
    });
  }

  const duelVotes = votes
    .filter((v) => v.mode === "DUEL")
    .map((v) => ({
      gameId: v.gameId,
      opponentGameId: v.opponentGameId ?? null,
      userId: v.userId,
      playerCount: v.playerCount,
    }));

  const gameMeta = new Map<
    number,
    {
      name: string;
      thumbnail: string | null;
      bestPlayerCounts: number[];
      rank: number | null;
      bggRating: number | null;
    }
  >();
  for (const v of votes) {
    gameMeta.set(v.gameId, {
      name: v.game.name,
      thumbnail: resolveCoverSrc(v.game),
      bestPlayerCounts: v.game.bestPlayerCounts ?? [],
      rank: v.game.rank ?? null,
      bggRating: v.game.bggRating ?? null,
    });
  }

  const playerCounts = new Set([
    ...picksByCount.keys(),
    ...duelVotes.map((v) => v.playerCount),
  ]);

  const out: Record<number, RankEntry[]> = {};

  for (const pc of playerCounts) {
    const pickCounts = buildPickCounts(picksByCount.get(pc) ?? []);
    const pool = poolGameIds(pickCounts);
    const totalPairs = pairCount(pool.length);
    const phase = totalPairs <= FULL_THRESHOLD ? "FULL" : "GROUP";
    const tieBreak: DuelTieBreakContext | undefined =
      meetupId && phase === "FULL"
        ? {
            meetupId,
            expectedPlayerCount: pc,
            pickCounts,
            games: buildGameTieMetaMap(
              [...gameMeta.entries()]
                .filter(([id]) => pool.includes(id))
                .map(([id, meta]) => ({
                  id,
                  bestPlayerCounts: meta.bestPlayerCounts,
                  rank: meta.rank,
                  bggRating: meta.bggRating,
                })),
            ),
          }
        : undefined;
    const autoPairs =
      phase === "GROUP" && frozen?.playerCount === pc
        ? frozen.autoPairs
        : undefined;
    const { winsByGame } = buildCopelandForCount(duelVotes, pc, phase, totalPairs, {
      ...(tieBreak ? { tieBreak } : {}),
      ...(autoPairs && autoPairs.length > 0 ? { autoPairs, meetupId } : {}),
    });

    const entries: RankEntry[] = [];
    for (const [gameId, wins] of Object.entries(winsByGame)) {
      const id = Number(gameId);
      const meta = gameMeta.get(id);
      if (!meta || wins <= 0) continue;
      entries.push({
        id,
        name: meta.name,
        thumbnail: meta.thumbnail,
        points: wins,
        voters: 0,
        duelWins: wins,
      });
    }
    out[pc] = entries.sort(
      (a, b) => b.points - a.points || a.name.localeCompare(b.name),
    );
  }

  return out;
}

/** pickCount (Stimmen-Summe) + Copeland-Siege */
export function buildCombinedByCount(
  votes: VoteRow[],
  meetupId?: string,
  frozen?: DuelFrozenData | null,
): Record<number, RankEntry[]> {
  const picksByCount = new Map<number, Record<number, number>>();
  for (const v of votes) {
    if (v.mode !== "PICK") continue;
    if (!picksByCount.has(v.playerCount)) {
      picksByCount.set(v.playerCount, {});
    }
    const c = picksByCount.get(v.playerCount)!;
    c[v.gameId] = (c[v.gameId] ?? 0) + v.points;
  }

  const duelByCount = buildDuelCopelandByCount(votes, meetupId, frozen);

  const playerCounts = new Set([
    ...picksByCount.keys(),
    ...Object.keys(duelByCount).map(Number),
  ]);

  const out: Record<number, RankEntry[]> = {};

  const gameMeta = new Map<
    number,
    { name: string; thumbnail: string | null }
  >();
  for (const v of votes) {
    gameMeta.set(v.gameId, {
      name: v.game.name,
      thumbnail: resolveCoverSrc(v.game),
    });
  }

  for (const pc of playerCounts) {
    const pickCounts = picksByCount.get(pc) ?? {};
    const duelEntries = duelByCount[pc] ?? [];
    const duelMap = new Map(duelEntries.map((e) => [e.id, e]));

    const gameIds = new Set([
      ...Object.keys(pickCounts).map(Number),
      ...duelEntries.map((e) => e.id),
    ]);

    const entries: RankEntry[] = [];
    for (const gameId of gameIds) {
      const meta = gameMeta.get(gameId);
      if (!meta) continue;
      const pickCount = pickCounts[gameId] ?? 0;
      const duel = duelMap.get(gameId);
      const duelWins = duel?.points ?? 0;

      entries.push({
        id: gameId,
        name: meta.name,
        thumbnail: meta.thumbnail,
        points: pickCount + duelWins,
        voters: duel?.voters ?? 0,
        pickCount,
        duelWins,
      });
    }

    out[pc] = entries.sort(
      (a, b) => b.points - a.points || a.name.localeCompare(b.name),
    );
  }

  return out;
}

export function buildPickCountsByExpected(
  votes: VoteRow[],
  expected: number,
): Record<number, number> {
  return buildPickCounts(
    votes.filter((v) => v.mode === "PICK" && v.playerCount === expected),
  );
}

export function playerCountsFromVotes(
  expected: number,
  votes: { playerCount: number }[],
): number[] {
  const keys = new Set([expected, ...votes.map((v) => v.playerCount)]);
  return Array.from(keys).sort((a, b) => a - b);
}
