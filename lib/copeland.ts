import {
  type DuelPhase,
  pairKey,
  parsePairKey,
} from "@/lib/duel-pairs";

export type DuelVoteRow = {
  gameId: number;
  opponentGameId: number | null;
  userId: string;
  playerCount: number;
};

export type CopelandResult = {
  winsByGame: Record<number, number>;
  decidedPairs: number;
  totalPairs: number;
  tiedPairs: number;
};

function tallyPairVotes(
  votes: { winnerId: number; userId: string }[],
): { winnerId: number | null; tied: boolean } {
  if (votes.length === 0) return { winnerId: null, tied: false };
  const counts = new Map<number, number>();
  for (const v of votes) {
    counts.set(v.winnerId, (counts.get(v.winnerId) ?? 0) + 1);
  }
  let bestId: number | null = null;
  let bestCount = 0;
  let tied = false;
  for (const [id, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      bestId = id;
      tied = false;
    } else if (count === bestCount) {
      tied = true;
    }
  }
  if (tied) return { winnerId: null, tied: true };
  return { winnerId: bestId, tied: false };
}

export function buildCopelandForCount(
  votes: DuelVoteRow[],
  playerCount: number,
  phase: DuelPhase,
  totalPairs: number,
): CopelandResult {
  const filtered = votes.filter(
    (v) =>
      v.playerCount === playerCount &&
      v.opponentGameId != null &&
      v.opponentGameId !== v.gameId,
  );

  const byPair = new Map<string, { winnerId: number; userId: string }[]>();
  for (const v of filtered) {
    const key = pairKey(v.gameId, v.opponentGameId!);
    const winnerId = v.gameId;
    if (!byPair.has(key)) byPair.set(key, []);
    byPair.get(key)!.push({ winnerId, userId: v.userId });
  }

  const winsByGame: Record<number, number> = {};
  let decidedPairs = 0;
  let tiedPairs = 0;

  for (const [, pairVotes] of byPair) {
    if (phase === "GROUP") {
      const v = pairVotes[0];
      if (!v) continue;
      decidedPairs++;
      winsByGame[v.winnerId] = (winsByGame[v.winnerId] ?? 0) + 1;
      continue;
    }

    const { winnerId, tied } = tallyPairVotes(pairVotes);
    if (tied) {
      tiedPairs++;
      continue;
    }
    if (winnerId != null) {
      decidedPairs++;
      winsByGame[winnerId] = (winsByGame[winnerId] ?? 0) + 1;
    }
  }

  return {
    winsByGame,
    decidedPairs,
    totalPairs,
    tiedPairs,
  };
}

export function countDecidedPairs(
  votes: DuelVoteRow[],
  playerCount: number,
): number {
  const keys = new Set<string>();
  for (const v of votes) {
    if (v.playerCount !== playerCount || v.opponentGameId == null) continue;
    keys.add(pairKey(v.gameId, v.opponentGameId));
  }
  return keys.size;
}

export function completedPairKeysForUser(
  votes: DuelVoteRow[],
  userId: string,
  playerCount: number,
): Set<string> {
  const keys = new Set<string>();
  for (const v of votes) {
    if (
      v.userId !== userId ||
      v.playerCount !== playerCount ||
      v.opponentGameId == null
    ) {
      continue;
    }
    keys.add(pairKey(v.gameId, v.opponentGameId));
  }
  return keys;
}

export function normalizeDuelVote(
  winnerId: number,
  opponentId: number,
): { winnerId: number; loserId: number; pairKey: string } {
  return {
    winnerId,
    loserId: opponentId,
    pairKey: pairKey(winnerId, opponentId),
  };
}

export { parsePairKey };
