import type { RankEntry } from "@/components/Ranking";
import { buildPickCounts } from "@/lib/pick-pool";

type VoteRow = {
  playerCount: number;
  gameId: number;
  userId: string;
  points: number;
  mode: "PICK" | "DUEL";
  game: {
    id: number;
    name: string;
    thumbnail: string | null;
    image: string | null;
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
          thumbnail: v.game.thumbnail ?? v.game.image,
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

/** pickCount (group) + duel wins per game */
export function buildCombinedByCount(
  votes: VoteRow[],
): Record<number, RankEntry[]> {
  const picksByCount = new Map<number, Record<number, number>>();
  for (const v of votes) {
    if (v.mode !== "PICK") continue;
    if (!picksByCount.has(v.playerCount)) {
      picksByCount.set(v.playerCount, {});
    }
    const c = picksByCount.get(v.playerCount)!;
    c[v.gameId] = (c[v.gameId] ?? 0) + 1;
  }

  const duelByCount = buildRankingByCount(votes, "DUEL");

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
      thumbnail: v.game.thumbnail ?? v.game.image,
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

export type PickListGame = {
  id: number;
  name: string;
  thumbnail: string | null;
};

export type PickListPlayer = {
  userId: string;
  userName: string;
  games: PickListGame[];
};

export function buildPicksByCount(
  votes: (VoteRow & { user: { name: string } })[],
): Record<number, PickListPlayer[]> {
  const byCount = new Map<
    number,
    Map<string, { userName: string; games: PickListGame[] }>
  >();

  for (const v of votes) {
    if (v.mode !== "PICK") continue;
    if (!byCount.has(v.playerCount)) byCount.set(v.playerCount, new Map());
    const users = byCount.get(v.playerCount)!;
    if (!users.has(v.userId)) {
      users.set(v.userId, { userName: v.user.name, games: [] });
    }
    const u = users.get(v.userId)!;
    if (u.games.some((g) => g.id === v.gameId)) continue;
    u.games.push({
      id: v.game.id,
      name: v.game.name,
      thumbnail: v.game.thumbnail ?? v.game.image,
    });
  }

  const result: Record<number, PickListPlayer[]> = {};
  for (const [pc, users] of byCount) {
    result[pc] = Array.from(users.entries())
      .map(([userId, { userName, games }]) => ({
        userId,
        userName,
        games: games.sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.userName.localeCompare(b.userName));
  }
  return result;
}

export function playerCountsFromVotes(
  expected: number,
  votes: { playerCount: number }[],
): number[] {
  const keys = new Set([expected, ...votes.map((v) => v.playerCount)]);
  return Array.from(keys).sort((a, b) => a - b);
}
