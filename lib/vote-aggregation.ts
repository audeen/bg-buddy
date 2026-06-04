import type { RankEntry } from "@/components/Ranking";

type VoteRow = {
  playerCount: number;
  gameId: number;
  userId: string;
  points: number;
  mode: "PICK" | "TINDER";
  game: {
    id: number;
    name: string;
    thumbnail: string | null;
    image: string | null;
  };
};

export function buildRankingByCount(
  votes: VoteRow[],
  mode?: "PICK" | "TINDER",
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

  const out: Record<number, PickListPlayer[]> = {};
  for (const [pc, users] of byCount) {
    out[pc] = Array.from(users.entries())
      .map(([userId, { userName, games }]) => ({
        userId,
        userName,
        games: games.sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.userName.localeCompare(b.userName));
  }
  return out;
}

export function playerCountsFromVotes(
  expected: number,
  votes: { playerCount: number }[],
): number[] {
  const keys = new Set([expected, ...votes.map((v) => v.playerCount)]);
  return Array.from(keys).sort((a, b) => a - b);
}
