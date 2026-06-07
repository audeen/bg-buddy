import type { Prisma } from "@prisma/client";
import {
  completedPairKeysForUser,
  type DuelVoteRow,
} from "@/lib/copeland";
import type { DuelTieBreakContext } from "@/lib/duel-tiebreaker";
import { buildPickCounts } from "@/lib/pick-pool";
import { FULL_THRESHOLD, MAX_PICK_POINTS } from "@/lib/vote-limits";

export type DuelPickRow = { userId: string; gameId: number; points: number };

export type DuelPair = { a: number; b: number };

export type DuelPhase = "FULL" | "GROUP";

export type DuelFrozenData = {
  playerCount: number;
  phase: DuelPhase;
  poolGameIds: number[];
  pickCounts: Record<number, number>;
  participantIds: string[];
  assignments?: Record<string, DuelPair[]>;
};

export function pairCount(n: number): number {
  return (n * (n - 1)) / 2;
}

export function pairKey(a: number, b: number): string {
  const min = Math.min(a, b);
  const max = Math.max(a, b);
  return `${min}:${max}`;
}

export function parsePairKey(key: string): DuelPair {
  const [a, b] = key.split(":").map(Number);
  return { a, b };
}

export function allPairs(gameIds: number[]): DuelPair[] {
  const sorted = [...gameIds].sort((x, y) => x - y);
  const pairs: DuelPair[] = [];
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      pairs.push({ a: sorted[i], b: sorted[j] });
    }
  }
  return pairs;
}

export function pairWeight(
  pair: DuelPair,
  pickCounts: Record<number, number>,
): number {
  return (pickCounts[pair.a] ?? 0) + (pickCounts[pair.b] ?? 0);
}

export function userStake(
  userId: string,
  pair: DuelPair,
  userPoints: Record<string, Record<number, number>>,
): number {
  const pts = userPoints[userId];
  if (!pts) return 0;
  return (pts[pair.a] ?? 0) + (pts[pair.b] ?? 0);
}

function sortPairs(
  pairs: DuelPair[],
  pickCounts: Record<number, number>,
): DuelPair[] {
  return [...pairs].sort((p1, p2) => {
    const w1 = pairWeight(p1, pickCounts);
    const w2 = pairWeight(p2, pickCounts);
    if (w2 !== w1) return w2 - w1;
    return pairKey(p1.a, p1.b).localeCompare(pairKey(p2.a, p2.b));
  });
}

export function assignGroupPairs(
  pairs: DuelPair[],
  participantIds: string[],
  userPoints: Record<string, Record<number, number>>,
): Record<string, DuelPair[]> {
  const sortedParticipants = [...participantIds].sort();
  const assignments: Record<string, DuelPair[]> = {};
  for (const id of sortedParticipants) {
    assignments[id] = [];
  }
  if (sortedParticipants.length === 0) return assignments;

  for (const pair of pairs) {
    const loads = sortedParticipants.map((id) => assignments[id].length);
    const minLoad = Math.min(...loads);
    const candidates = sortedParticipants.filter(
      (id) => assignments[id].length === minLoad,
    );
    let chosen = candidates[0];
    let minStake = userStake(chosen, pair, userPoints);
    for (const id of candidates.slice(1)) {
      const stake = userStake(id, pair, userPoints);
      if (stake < minStake || (stake === minStake && id < chosen)) {
        minStake = stake;
        chosen = id;
      }
    }
    assignments[chosen].push(pair);
  }
  return assignments;
}

export function shufflePairs(pairs: DuelPair[], seed: string): DuelPair[] {
  const out = [...pairs];
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  for (let i = out.length - 1; i > 0; i--) {
    h = (h * 1664525 + 1013904223) >>> 0;
    const j = h % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function buildDuelFrozenSnapshot(opts: {
  playerCount: number;
  picks: DuelPickRow[];
  poolGameIds: number[];
}): DuelFrozenData {
  const pickCounts = buildPickCounts(opts.picks);
  const userPoints = buildUserPointsMap(opts.picks);
  const participantIds = duelParticipantIds(opts.picks);
  const totalPairs = pairCount(opts.poolGameIds.length);
  const phase = duelPhaseForPairCount(totalPairs);
  const sortedPairs = sortPairs(allPairs(opts.poolGameIds), pickCounts);

  const snapshot: DuelFrozenData = {
    playerCount: opts.playerCount,
    phase,
    poolGameIds: [...opts.poolGameIds],
    pickCounts,
    participantIds,
  };

  if (phase === "GROUP") {
    snapshot.assignments = assignGroupPairs(
      sortedPairs,
      participantIds,
      userPoints,
    );
  }

  return snapshot;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseAssignments(
  raw: unknown,
): Record<string, DuelPair[]> | undefined {
  if (!isRecord(raw)) return undefined;
  const out: Record<string, DuelPair[]> = {};
  for (const [userId, pairs] of Object.entries(raw)) {
    if (!Array.isArray(pairs)) continue;
    const parsed: DuelPair[] = [];
    for (const item of pairs) {
      if (!isRecord(item)) continue;
      const a = Number(item.a);
      const b = Number(item.b);
      if (Number.isFinite(a) && Number.isFinite(b) && a !== b) {
        parsed.push({ a, b });
      }
    }
    out[userId] = parsed;
  }
  return out;
}

export function parseDuelFrozenData(
  raw: Prisma.JsonValue | null | undefined,
  playerCount: number,
): DuelFrozenData | null {
  if (!isRecord(raw)) return null;
  if (Number(raw.playerCount) !== playerCount) return null;

  const poolGameIds = Array.isArray(raw.poolGameIds)
    ? raw.poolGameIds.map(Number).filter((n) => Number.isFinite(n))
    : [];
  if (poolGameIds.length < 2) return null;

  const phase = raw.phase === "GROUP" ? "GROUP" : "FULL";
  const participantIds = Array.isArray(raw.participantIds)
    ? raw.participantIds.filter((id): id is string => typeof id === "string")
    : [];

  const pickCounts: Record<number, number> = {};
  if (isRecord(raw.pickCounts)) {
    for (const [key, value] of Object.entries(raw.pickCounts)) {
      const gameId = Number(key);
      const count = Number(value);
      if (Number.isFinite(gameId) && Number.isFinite(count)) {
        pickCounts[gameId] = count;
      }
    }
  }

  return {
    playerCount,
    phase,
    poolGameIds,
    pickCounts,
    participantIds,
    assignments: parseAssignments(raw.assignments),
  };
}

export function duelFrozenToJson(
  data: DuelFrozenData,
): Prisma.InputJsonValue {
  return data as unknown as Prisma.InputJsonValue;
}

export type DuellPlan = {
  phase: DuelPhase;
  totalPairs: number;
  myPairs: DuelPair[];
  myTotal: number;
};

export type DuelProgress = {
  phase: DuelPhase;
  totalPairs: number;
  decidedPairs: number;
  duelComplete: boolean;
  finishedParticipants: number;
  totalParticipants: number;
};

export function duelPhaseForPairCount(totalPairs: number): DuelPhase {
  return totalPairs <= FULL_THRESHOLD ? "FULL" : "GROUP";
}

export type DuelProgressOptions = {
  tieBreak?: DuelTieBreakContext;
  picks?: DuelPickRow[];
  meetupId?: string;
  frozen?: DuelFrozenData | null;
};

type ParticipationContext = {
  poolGameIds: number[];
  picks: DuelPickRow[];
  meetupId: string;
  playerCount: number;
  frozen?: DuelFrozenData | null;
};

function effectivePool(ctx: ParticipationContext): number[] {
  return ctx.frozen?.poolGameIds ?? ctx.poolGameIds;
}

/** Users with full ★ pick budget who must finish their duel queue. */
export function duelParticipantIds(picks: DuelPickRow[]): string[] {
  const totals = new Map<string, number>();
  for (const p of picks) {
    totals.set(p.userId, (totals.get(p.userId) ?? 0) + p.points);
  }
  return [...totals.entries()]
    .filter(([, sum]) => sum === MAX_PICK_POINTS)
    .map(([id]) => id)
    .sort();
}

function myPairsForUser(
  ctx: ParticipationContext,
  userId: string,
): DuelPair[] {
  const pool = effectivePool(ctx);
  const totalPairs = pairCount(pool.length);
  const phase = ctx.frozen?.phase ?? duelPhaseForPairCount(totalPairs);

  if (ctx.frozen) {
    if (phase === "FULL") {
      const pairs = sortPairs(allPairs(pool), ctx.frozen.pickCounts);
      return shufflePairs(pairs, `${ctx.meetupId}:${userId}`);
    }
    return shufflePairs(
      ctx.frozen.assignments?.[userId] ?? [],
      `${ctx.meetupId}:${userId}`,
    );
  }

  const pickCounts = buildPickCounts(ctx.picks);
  const userPoints = buildUserPointsMap(ctx.picks);
  const participantIds = duelParticipantIds(ctx.picks);
  const plan = buildDuellPlan({
    poolGameIds: pool,
    pickCounts,
    userPoints,
    userId,
    participantIds,
    meetupId: ctx.meetupId,
  });
  return plan.myPairs;
}

export function countFinishedParticipants(
  duelVotes: DuelVoteRow[],
  ctx: ParticipationContext,
): { finished: number; total: number } {
  const participantIds =
    ctx.frozen?.participantIds ?? duelParticipantIds(ctx.picks);
  if (participantIds.length === 0) {
    return { finished: 0, total: 0 };
  }

  let finished = 0;
  for (const userId of participantIds) {
    const myPairs = myPairsForUser(ctx, userId);
    const completed = completedPairKeysForUser(
      duelVotes,
      userId,
      ctx.playerCount,
    );
    if (myPairs.every((p) => completed.has(pairKey(p.a, p.b)))) {
      finished += 1;
    }
  }

  return { finished, total: participantIds.length };
}

export function allParticipantsFinishedDuels(
  duelVotes: DuelVoteRow[],
  ctx: ParticipationContext,
): boolean {
  const { finished, total } = countFinishedParticipants(duelVotes, ctx);
  return total > 0 && finished >= total;
}

/** Pairs where every required participant has cast their duel vote. */
export function countFullyVotedPairs(
  duelVotes: DuelVoteRow[],
  ctx: ParticipationContext,
): number {
  const participantIds =
    ctx.frozen?.participantIds ?? duelParticipantIds(ctx.picks);
  if (participantIds.length === 0) return 0;

  const pool = effectivePool(ctx);
  const totalPairs = pairCount(pool.length);
  const phase = ctx.frozen?.phase ?? duelPhaseForPairCount(totalPairs);

  if (phase === "FULL") {
    const pairs = allPairs(pool);
    let count = 0;
    for (const pair of pairs) {
      const key = pairKey(pair.a, pair.b);
      const voterIds = new Set(
        duelVotes
          .filter(
            (v) =>
              v.playerCount === ctx.playerCount &&
              v.opponentGameId != null &&
              pairKey(v.gameId, v.opponentGameId) === key,
          )
          .map((v) => v.userId),
      );
      if (participantIds.every((id) => voterIds.has(id))) count++;
    }
    return count;
  }

  const assignments = ctx.frozen?.assignments;
  if (assignments) {
    let count = 0;
    for (const userId of participantIds) {
      const completed = completedPairKeysForUser(
        duelVotes,
        userId,
        ctx.playerCount,
      );
      for (const pair of assignments[userId] ?? []) {
        if (completed.has(pairKey(pair.a, pair.b))) count++;
      }
    }
    return count;
  }

  const userPoints = buildUserPointsMap(ctx.picks);
  const liveAssignments = assignGroupPairs(
    allPairs(pool),
    participantIds,
    userPoints,
  );

  let count = 0;
  for (const userId of participantIds) {
    const completed = completedPairKeysForUser(
      duelVotes,
      userId,
      ctx.playerCount,
    );
    for (const pair of liveAssignments[userId] ?? []) {
      if (completed.has(pairKey(pair.a, pair.b))) count++;
    }
  }
  return count;
}

export function getDuelProgressForCount(
  poolGameIds: number[],
  duelVotes: DuelVoteRow[],
  playerCount: number,
  options?: DuelProgressOptions,
): DuelProgress {
  const poolSize = (options?.frozen?.poolGameIds ?? poolGameIds).length;
  const totalPairs = pairCount(poolSize);
  if (poolSize < 2) {
    return {
      phase: "FULL",
      totalPairs: 0,
      decidedPairs: 0,
      duelComplete: true,
      finishedParticipants: 0,
      totalParticipants: 0,
    };
  }
  const phase =
    options?.frozen?.phase ?? duelPhaseForPairCount(totalPairs);

  const participation: ParticipationContext | undefined =
    options?.picks && options?.meetupId
      ? {
          poolGameIds,
          picks: options.picks,
          meetupId: options.meetupId,
          playerCount,
          frozen: options.frozen,
        }
      : undefined;

  if (participation) {
    const decidedPairs = countFullyVotedPairs(duelVotes, participation);
    const allFinished = allParticipantsFinishedDuels(duelVotes, participation);
    const { finished, total } = countFinishedParticipants(
      duelVotes,
      participation,
    );
    const duelComplete =
      phase === "GROUP"
        ? allFinished && decidedPairs >= totalPairs
        : allFinished;

    return {
      phase,
      totalPairs,
      decidedPairs,
      duelComplete,
      finishedParticipants: finished,
      totalParticipants: total,
    };
  }

  return {
    phase,
    totalPairs,
    decidedPairs: 0,
    duelComplete: false,
    finishedParticipants: 0,
    totalParticipants: 0,
  };
}

export function buildUserPointsMap(
  picks: { userId: string; gameId: number; points: number }[],
): Record<string, Record<number, number>> {
  const out: Record<string, Record<number, number>> = {};
  for (const p of picks) {
    if (!out[p.userId]) out[p.userId] = {};
    out[p.userId][p.gameId] = p.points;
  }
  return out;
}

export function participantIdsFromPicks(
  picks: { userId: string; points: number }[],
): string[] {
  const totals = new Map<string, number>();
  for (const p of picks) {
    totals.set(p.userId, (totals.get(p.userId) ?? 0) + p.points);
  }
  return [...totals.entries()]
    .filter(([, sum]) => sum > 0)
    .map(([id]) => id)
    .sort();
}

export function buildDuellPlan(opts: {
  poolGameIds: number[];
  pickCounts: Record<number, number>;
  userPoints: Record<string, Record<number, number>>;
  userId: string;
  participantIds: string[];
  meetupId: string;
  frozen?: DuelFrozenData | null;
}): DuellPlan {
  const {
    poolGameIds,
    pickCounts,
    userPoints,
    userId,
    participantIds,
    meetupId,
    frozen,
  } = opts;

  const pool = frozen?.poolGameIds ?? poolGameIds;
  const counts = frozen?.pickCounts ?? pickCounts;
  const roster = frozen?.participantIds ?? participantIds;
  const pairs = allPairs(pool);
  const totalPairs = pairs.length;
  const sortedForWeight = sortPairs(pairs, counts);
  const phase = frozen?.phase ?? duelPhaseForPairCount(totalPairs);

  if (phase === "FULL") {
    const myPairs = shufflePairs(sortedForWeight, `${meetupId}:${userId}`);
    return {
      phase: "FULL",
      totalPairs,
      myPairs,
      myTotal: myPairs.length,
    };
  }

  const assignments =
    frozen?.assignments ??
    assignGroupPairs(sortedForWeight, roster, userPoints);
  const myPairs = shufflePairs(
    assignments[userId] ?? [],
    `${meetupId}:${userId}`,
  );

  return {
    phase: "GROUP",
    totalPairs,
    myPairs,
    myTotal: myPairs.length,
  };
}

export function isPairInList(pair: DuelPair, list: DuelPair[]): boolean {
  const key = pairKey(pair.a, pair.b);
  return list.some((p) => pairKey(p.a, p.b) === key);
}
