import { buildCopelandForCount } from "../lib/copeland";
import { breakDuelTie, type DuelTieBreakContext } from "../lib/duel-tiebreaker";
import { getDuelProgressForCount } from "../lib/duel-pairs";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const baseCtx = (
  overrides: Partial<DuelTieBreakContext> = {},
): DuelTieBreakContext => ({
  meetupId: "m1",
  expectedPlayerCount: 2,
  pickCounts: {},
  games: {},
  ...overrides,
});

// 1. Higher pick count wins
assert(
  breakDuelTie(1, 2, "1:2", baseCtx({ pickCounts: { 1: 3, 2: 1 } })) === 1,
  "pick count tie-break",
);

// 2. BGG best at expected count
assert(
  breakDuelTie(
    1,
    2,
    "1:2",
    baseCtx({
      pickCounts: { 1: 1, 2: 1 },
      expectedPlayerCount: 4,
      games: {
        1: { bestPlayerCounts: [3], rank: null, bggRating: null },
        2: { bestPlayerCounts: [4], rank: null, bggRating: null },
      },
    }),
  ) === 2,
  "BGG best at expected count",
);

// 3. Higher bggRating wins
assert(
  breakDuelTie(
    1,
    2,
    "1:2",
    baseCtx({
      pickCounts: { 1: 1, 2: 1 },
      games: {
        1: { bestPlayerCounts: [], rank: null, bggRating: 7.5 },
        2: { bestPlayerCounts: [], rank: null, bggRating: 8.1 },
      },
    }),
  ) === 2,
  "bggRating tie-break",
);

// 4. rank fallback when ratings missing
assert(
  breakDuelTie(
    1,
    2,
    "1:2",
    baseCtx({
      pickCounts: { 1: 1, 2: 1 },
      games: {
        1: { bestPlayerCounts: [], rank: 100, bggRating: null },
        2: { bestPlayerCounts: [], rank: 42, bggRating: null },
      },
    }),
  ) === 2,
  "rank fallback",
);

// 5. deterministic random
const randomA = breakDuelTie(
  1,
  2,
  "1:2",
  baseCtx({
    pickCounts: { 1: 1, 2: 1 },
    games: {
      1: { bestPlayerCounts: [], rank: null, bggRating: null },
      2: { bestPlayerCounts: [], rank: null, bggRating: null },
    },
  }),
);
const randomB = breakDuelTie(
  1,
  2,
  "1:2",
  baseCtx({
    pickCounts: { 1: 1, 2: 1 },
    games: {
      1: { bestPlayerCounts: [], rank: null, bggRating: null },
      2: { bestPlayerCounts: [], rank: null, bggRating: null },
    },
  }),
);
assert(randomA === randomB, "deterministic random");
assert(randomA === 1 || randomA === 2, "random picks a valid game");

// 6. Majority without tie-breaker
const majority = buildCopelandForCount(
  [
    { gameId: 1, opponentGameId: 2, userId: "u1", playerCount: 4 },
    { gameId: 1, opponentGameId: 2, userId: "u2", playerCount: 4 },
    { gameId: 2, opponentGameId: 1, userId: "u3", playerCount: 4 },
  ],
  4,
  "FULL",
  15,
);
assert(majority.winsByGame[1] === 1, "majority without tie-break");
assert(majority.decidedPairs === 1, "one pair decided");

// 7. Integration: 2 users, 15 pairs, 5 splits → complete
const pool6 = [1, 2, 3, 4, 5, 6];
const tieBreak = baseCtx({
  pickCounts: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1 },
  games: Object.fromEntries(
    pool6.map((id) => [
      id,
      { bestPlayerCounts: [], rank: id * 10, bggRating: 7 + id * 0.1 },
    ]),
  ),
});

const duelVotes = [];
for (let a = 0; a < pool6.length; a++) {
  for (let b = a + 1; b < pool6.length; b++) {
    const gameA = pool6[a];
    const gameB = pool6[b];
    const split = (gameA + gameB) % 3 === 0;
    duelVotes.push({
      gameId: split ? gameA : gameB,
      opponentGameId: split ? gameB : gameA,
      userId: "u1",
      playerCount: 2,
    });
    duelVotes.push({
      gameId: split ? gameB : gameA,
      opponentGameId: split ? gameA : gameB,
      userId: "u2",
      playerCount: 2,
    });
  }
}

const fullPicks = [
  { userId: "u1", gameId: 1, points: 1 },
  { userId: "u1", gameId: 2, points: 1 },
  { userId: "u1", gameId: 3, points: 1 },
  { userId: "u2", gameId: 4, points: 1 },
  { userId: "u2", gameId: 5, points: 1 },
  { userId: "u2", gameId: 6, points: 1 },
];
const progress = getDuelProgressForCount(pool6, duelVotes, 2, {
  picks: fullPicks,
  meetupId: "m1",
  tieBreak,
});
assert(progress.duelComplete, "all participants finished");
assert(progress.decidedPairs === 15, "15 fully voted pairs");

// Partial participation must not complete early
const partialVotes = duelVotes.slice(0, 23);
const partialProgress = getDuelProgressForCount(pool6, partialVotes, 2, {
  picks: fullPicks,
  meetupId: "m1",
  tieBreak,
});
assert(!partialProgress.duelComplete, "partial votes do not complete duels");
assert(
  partialProgress.decidedPairs < 15,
  "not all pairs fully voted during partial play",
);

const copeland = buildCopelandForCount(duelVotes, 2, "FULL", 15, {
  tieBreak,
});
assert(copeland.decidedPairs === 15, "copeland decided all pairs");
assert(copeland.tiedPairs > 0, "some pairs were vote-tied");

console.log("test-duel-tiebreaker: OK");
