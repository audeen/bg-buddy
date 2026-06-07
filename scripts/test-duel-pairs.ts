import {
  allPairs,
  assignGroupPairs,
  buildDuellPlan,
  buildUserPointsMap,
  pairCount,
  participantIdsFromPicks,
} from "../lib/duel-pairs";
import { buildCopelandForCount } from "../lib/copeland";
import { FULL_THRESHOLD } from "../lib/vote-limits";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

// FULL: 6 games = 15 pairs
const pool6 = [1, 2, 3, 4, 5, 6];
assert(pairCount(6) === 15, "6 games = 15 pairs");
assert(pairCount(6) === FULL_THRESHOLD, "threshold at 6 games");

const planFull = buildDuellPlan({
  poolGameIds: pool6,
  pickCounts: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1 },
  userPoints: { u1: { 1: 1, 2: 1, 3: 1 } },
  userId: "u1",
  participantIds: ["u1", "u2"],
  meetupId: "m1",
});
assert(planFull.phase === "FULL", "phase FULL");
assert(planFull.myPairs.length === 15, "user gets all 15 pairs");

// GROUP: 12 games, 4 users, full assignment
const pool12 = Array.from({ length: 12 }, (_, i) => i + 1);
const picks = [
  { userId: "a", gameId: 1, points: 3 },
  { userId: "b", gameId: 2, points: 2 },
  { userId: "b", gameId: 3, points: 1 },
  { userId: "c", gameId: 4, points: 1 },
  { userId: "d", gameId: 5, points: 1 },
];
const participants = participantIdsFromPicks(picks);
const userPoints = buildUserPointsMap(picks);
const pairs = allPairs(pool12);
assert(pairs.length === 66, "12 games = 66 pairs");

const assignments = assignGroupPairs(pairs, participants, userPoints);
const assignedTotal = Object.values(assignments).reduce(
  (s, arr) => s + arr.length,
  0,
);
assert(assignedTotal === 66, "all 66 pairs assigned once");
const keys = new Set<string>();
for (const list of Object.values(assignments)) {
  for (const p of list) {
    const k = `${Math.min(p.a, p.b)}:${Math.max(p.a, p.b)}`;
    assert(!keys.has(k), `duplicate pair ${k}`);
    keys.add(k);
  }
}

// Azul fan (3 on game 1) gets fewer game-1 pairs than others
const aPairs = assignments["a"] ?? [];
const aWith1 = aPairs.filter((p) => p.a === 1 || p.b === 1).length;
const bWith1 = (assignments["b"] ?? []).filter(
  (p) => p.a === 1 || p.b === 1,
).length;
assert(
  aWith1 <= bWith1,
  `min-stake: user a should not get more game-1 pairs than b (a=${aWith1}, b=${bWith1})`,
);

// Copeland FULL majority
const copeland = buildCopelandForCount(
  [
    { gameId: 1, opponentGameId: 2, userId: "u1", playerCount: 4 },
    { gameId: 1, opponentGameId: 2, userId: "u2", playerCount: 4 },
    { gameId: 2, opponentGameId: 1, userId: "u3", playerCount: 4 },
  ],
  4,
  "FULL",
  15,
);
assert(copeland.winsByGame[1] === 1, "majority picks game 1");
assert(copeland.decidedPairs === 1, "one pair decided");

console.log("test-duel-pairs: OK");
