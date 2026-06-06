import { FULL_THRESHOLD } from "@/lib/vote-limits";

export type DuelPair = { a: number; b: number };

export type DuelPhase = "FULL" | "GROUP";

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

export type DuellPlan = {
  phase: DuelPhase;
  totalPairs: number;
  myPairs: DuelPair[];
  myTotal: number;
  phaseLabel: string;
  helpText: string;
};

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
}): DuellPlan {
  const { poolGameIds, pickCounts, userPoints, userId, participantIds, meetupId } =
    opts;
  const pairs = allPairs(poolGameIds);
  const totalPairs = pairs.length;
  const sortedForWeight = sortPairs(pairs, pickCounts);

  if (totalPairs <= FULL_THRESHOLD) {
    const myPairs = shufflePairs(sortedForWeight, `${meetupId}:${userId}`);
    return {
      phase: "FULL",
      totalPairs,
      myPairs,
      myTotal: myPairs.length,
      phaseLabel: `Vollständig: alle ${totalPairs} Paare`,
      helpText:
        "Jeder vergleicht jedes Spiel mit jedem anderen. Mehrheit pro Paar zählt.",
    };
  }

  const assignments = assignGroupPairs(
    sortedForWeight,
    participantIds,
    userPoints,
  );
  const myPairs = shufflePairs(
    assignments[userId] ?? [],
    `${meetupId}:${userId}`,
  );
  const myTotal = myPairs.length;

  return {
    phase: "GROUP",
    totalPairs,
    myPairs,
    myTotal,
    phaseLabel: `Gruppe: ${myTotal} deine von ${totalPairs}`,
    helpText:
      "Du entscheidest vor allem fremde Paare. Deine stark nominierten Spiele vergleichen die anderen.",
  };
}

export function isPairInList(pair: DuelPair, list: DuelPair[]): boolean {
  const key = pairKey(pair.a, pair.b);
  return list.some((p) => pairKey(p.a, p.b) === key);
}
