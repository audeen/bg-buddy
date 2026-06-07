import {
  allPairs,
  assignGroupPairs,
  buildDuelFrozenSnapshot,
  buildDuellPlan,
  buildUserPointsMap,
  countFullyVotedPairs,
  duelParticipantIds,
  getDuelProgressForCount,
  pairCount,
  parseDuelFrozenData,
  type DuelPickRow,
} from "../lib/duel-pairs";
import { MAX_PICK_POINTS } from "../lib/vote-limits";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const pool8 = [1, 2, 3, 4, 5, 6, 7, 8];
const users = ["u1", "u2", "u3", "u4"];

function fullPicksForPool(pool: number[]): DuelPickRow[] {
  const picks: DuelPickRow[] = [];
  let gameIdx = 0;
  for (const userId of users) {
    for (let i = 0; i < MAX_PICK_POINTS; i++) {
      picks.push({
        userId,
        gameId: pool[gameIdx % pool.length],
        points: 1,
      });
      gameIdx += 1;
    }
  }
  return picks;
}

const picks = fullPicksForPool(pool8);
const participants = duelParticipantIds(picks);
assert(participants.length === 4, "four duel participants");

const userPoints = buildUserPointsMap(picks);
const assignments = assignGroupPairs(
  allPairs(pool8),
  participants,
  userPoints,
);
const assignedTotal = Object.values(assignments).reduce(
  (sum, list) => sum + list.length,
  0,
);
assert(assignedTotal === 28, "all 28 pairs assigned once");

for (const userId of participants) {
  const plan = buildDuellPlan({
    poolGameIds: pool8,
    pickCounts: Object.fromEntries(pool8.map((id) => [id, 1])),
    userPoints,
    userId,
    participantIds: participants,
    meetupId: "m-group",
  });
  assert(plan.phase === "GROUP", "group phase for 8 games");
  assert(plan.myPairs.length >= 6, `user ${userId} gets a fair share`);
}

const frozen = buildDuelFrozenSnapshot({
  playerCount: 4,
  picks,
  poolGameIds: pool8,
});
assert(frozen.phase === "GROUP", "frozen snapshot is GROUP");
assert(frozen.assignments != null, "frozen has assignments");

const frozenParsed = parseDuelFrozenData(
  frozen as unknown as import("@prisma/client").Prisma.JsonValue,
  4,
);
assert(frozenParsed != null, "round-trip parse frozen");

// Snapshot stability: changed live picks must not alter frozen plan
const alteredPicks = [
  ...picks,
  { userId: "u1", gameId: 1, points: 1 },
];
const frozenPlanA = buildDuellPlan({
  poolGameIds: pool8,
  pickCounts: frozen.pickCounts,
  userPoints: buildUserPointsMap(picks),
  userId: "u1",
  participantIds: participants,
  meetupId: "m-group",
  frozen,
});
const frozenPlanB = buildDuellPlan({
  poolGameIds: pool8,
  pickCounts: Object.fromEntries(pool8.map((id) => [id, 99])),
  userPoints: buildUserPointsMap(alteredPicks),
  userId: "u1",
  participantIds: participants,
  meetupId: "m-group",
  frozen,
});
const keysA = frozenPlanA.myPairs
  .map((p) => `${Math.min(p.a, p.b)}:${Math.max(p.a, p.b)}`)
  .sort();
const keysB = frozenPlanB.myPairs
  .map((p) => `${Math.min(p.a, p.b)}:${Math.max(p.a, p.b)}`)
  .sort();
assert(
  keysA.length === keysB.length &&
    keysA.every((k, i) => k === keysB[i]),
  "frozen plan stable under pick drift",
);

function votesForUser(userId: string, pairs: { a: number; b: number }[]) {
  return pairs.map((p) => ({
    gameId: p.a,
    opponentGameId: p.b,
    userId,
    playerCount: 4,
  }));
}

const allVotes = participants.flatMap((userId) => {
  const pairs = frozen.assignments![userId] ?? [];
  return votesForUser(userId, pairs);
});

const complete = getDuelProgressForCount(pool8, allVotes, 4, {
  picks,
  meetupId: "m-group",
  frozen,
});
assert(complete.duelComplete, "all four finished fills matrix");
assert(complete.decidedPairs === 28, "28/28 matrix");
assert(complete.finishedParticipants === 4, "4/4 players done");

const oneUserVotes = votesForUser("u1", frozen.assignments!["u1"] ?? []);
const partial = getDuelProgressForCount(pool8, oneUserVotes, 4, {
  picks,
  meetupId: "m-group",
  frozen,
});
assert(!partial.duelComplete, "one user alone does not complete");
assert(
  partial.decidedPairs === (frozen.assignments!["u1"]?.length ?? 0),
  "partial matrix count matches one user assignment",
);
assert(partial.finishedParticipants === 1, "1/4 players done");

const ctx = {
  poolGameIds: pool8,
  picks,
  meetupId: "m-group",
  playerCount: 4,
  frozen,
};
assert(
  countFullyVotedPairs(oneUserVotes, ctx) === frozen.assignments!["u1"].length,
  "countFullyVotedPairs uses frozen assignments",
);

console.log("test-group-duels: OK");
