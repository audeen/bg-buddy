import {
  allPairs,
  assignGroupPairs,
  buildDuelFrozenSnapshot,
  buildDuellPlan,
  buildUserPointsMap,
  countFullyVotedPairs,
  duelParticipantIds,
  getDuelProgressForCount,
  pairKey,
  parseDuelFrozenData,
  type DuelPickRow,
} from "../lib/duel-pairs";
import { buildCopelandForCount } from "../lib/copeland";
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
const { assignments, autoPairs } = assignGroupPairs(
  allPairs(pool8),
  participants,
  userPoints,
);
const assignedTotal = Object.values(assignments).reduce(
  (sum, list) => sum + list.length,
  0,
);
assert(
  assignedTotal + autoPairs.length === 28,
  "all 28 pairs accounted for (assigned + auto)",
);

// Neutrality: nobody may judge a pair containing one of their own picks.
for (const userId of participants) {
  const ownGames = new Set(Object.keys(userPoints[userId] ?? {}).map(Number));
  for (const p of assignments[userId] ?? []) {
    assert(
      !ownGames.has(p.a) && !ownGames.has(p.b),
      `user ${userId} must not judge own pair ${pairKey(p.a, p.b)}`,
    );
  }
}

// Conflict pair: games 1 and 4 are each picked by two users such that every
// participant is biased -> (1,4) cannot have a neutral judge -> auto.
assert(
  autoPairs.some((p) => pairKey(p.a, p.b) === pairKey(1, 4)),
  "pair (1,4) has no neutral judge and is auto-resolved",
);
// Every auto pair must genuinely have no neutral judge.
for (const p of autoPairs) {
  const neutral = participants.filter(
    (id) => (userPoints[id]?.[p.a] ?? 0) + (userPoints[id]?.[p.b] ?? 0) === 0,
  );
  assert(
    neutral.length === 0,
    `auto pair ${pairKey(p.a, p.b)} should have no neutral judge`,
  );
}

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
  assert(plan.myPairs.length >= 1, `user ${userId} gets at least one pair`);
}

const frozen = buildDuelFrozenSnapshot({
  playerCount: 4,
  picks,
  poolGameIds: pool8,
});
assert(frozen.phase === "GROUP", "frozen snapshot is GROUP");
assert(frozen.assignments != null, "frozen has assignments");
assert(
  (frozen.autoPairs?.length ?? 0) === autoPairs.length,
  "frozen snapshot keeps the auto pairs",
);

const frozenParsed = parseDuelFrozenData(
  frozen as unknown as import("@prisma/client").Prisma.JsonValue,
  4,
);
assert(frozenParsed != null, "round-trip parse frozen");
assert(
  (frozenParsed?.autoPairs?.length ?? 0) === (frozen.autoPairs?.length ?? 0),
  "auto pairs survive JSON round-trip",
);

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

const autoCount = frozen.autoPairs?.length ?? 0;
const oneUserVotes = votesForUser("u1", frozen.assignments!["u1"] ?? []);
const partial = getDuelProgressForCount(pool8, oneUserVotes, 4, {
  picks,
  meetupId: "m-group",
  frozen,
});
assert(!partial.duelComplete, "one user alone does not complete");
assert(
  partial.decidedPairs ===
    (frozen.assignments!["u1"]?.length ?? 0) + autoCount,
  "partial matrix count matches one user assignment + auto pairs",
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
  countFullyVotedPairs(oneUserVotes, ctx) ===
    frozen.assignments!["u1"].length + autoCount,
  "countFullyVotedPairs counts frozen assignments + auto pairs",
);

// Auto pairs are decided by deterministic chance in Copeland.
const autoSeedMeetup = "m-group";
const copelandAuto = buildCopelandForCount([], 4, "GROUP", 28, {
  autoPairs,
  meetupId: autoSeedMeetup,
});
assert(
  copelandAuto.decidedPairs === autoPairs.length,
  "every auto pair is decided by chance",
);
const totalAutoWins = Object.values(copelandAuto.winsByGame).reduce(
  (s, w) => s + w,
  0,
);
assert(totalAutoWins === autoPairs.length, "each auto pair yields one winner");
// Deterministic: identical seed -> identical outcome.
const copelandAuto2 = buildCopelandForCount([], 4, "GROUP", 28, {
  autoPairs,
  meetupId: autoSeedMeetup,
});
for (const p of autoPairs) {
  assert(
    (copelandAuto.winsByGame[p.a] ?? 0) === (copelandAuto2.winsByGame[p.a] ?? 0),
    "auto resolution is deterministic across runs",
  );
}

// A real vote on an auto pair beats the chance fallback (no double count).
const [confictPair] = autoPairs;
if (confictPair) {
  const withVote = buildCopelandForCount(
    [
      {
        gameId: confictPair.a,
        opponentGameId: confictPair.b,
        userId: "x",
        playerCount: 4,
      },
    ],
    4,
    "GROUP",
    28,
    { autoPairs, meetupId: autoSeedMeetup },
  );
  assert(
    withVote.decidedPairs === autoPairs.length,
    "a real vote replaces the chance fallback without double counting",
  );
  assert(
    (withVote.winsByGame[confictPair.a] ?? 0) >= 1,
    "the real vote winner is credited",
  );
}

console.log("test-group-duels: OK");
