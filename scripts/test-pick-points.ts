import {
  applyPickTap,
  nextPickPoints,
  pointsKey,
} from "../lib/pick-points";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function eq(current: number, budgetLeft: number, expected: number) {
  const got = nextPickPoints(current, budgetLeft);
  assert(
    got === expected,
    `nextPickPoints(${current}, ${budgetLeft}) = ${got}, expected ${expected}`,
  );
}

eq(0, 3, 1);
eq(0, 1, 1);
eq(0, 0, 0);

eq(1, 2, 2);
eq(1, 1, 2);
eq(1, 0, 0);

eq(2, 1, 3);
eq(2, 0, 0);

eq(3, 1, 0);
eq(3, 0, 0);

const gameId = 42;
const playerCount = 4;
const key = pointsKey(gameId, playerCount);

let pts: Record<string, number> = {};
const chain = [1, 2, 3, 0];
for (const expected of chain) {
  const result = applyPickTap(pts, gameId, playerCount);
  if ("error" in result) {
    throw new Error(`tap chain failed at ${expected}: ${result.error}`);
  }
  assert(
    result.gamePoints === expected,
    `tap chain: expected ${expected}, got ${result.gamePoints}`,
  );
  pts = result.nextPoints;
}

pts = { [key]: 1, [pointsKey(99, playerCount)]: 2 };
const fullBudget = applyPickTap(pts, gameId, playerCount);
if ("error" in fullBudget) {
  throw new Error(`full budget tap should succeed: ${fullBudget.error}`);
}
assert(
  fullBudget.gamePoints === 0,
  `full budget: expected 0, got ${fullBudget.gamePoints}`,
);

pts = { [key]: 1 };
const freeBudget = applyPickTap(pts, gameId, playerCount);
if ("error" in freeBudget) {
  throw new Error(`free budget tap should succeed: ${freeBudget.error}`);
}
assert(
  freeBudget.gamePoints === 2,
  `free budget: expected 2, got ${freeBudget.gamePoints}`,
);

function tapTwice(
  start: Record<string, number>,
  gid: number,
  pc: number,
): number {
  let state = start;
  for (let i = 0; i < 2; i++) {
    const result = applyPickTap(state, gid, pc);
    if ("error" in result) {
      throw new Error(`two-tap chain failed on tap ${i + 1}: ${result.error}`);
    }
    state = result.nextPoints;
  }
  return state[pointsKey(gid, pc)] ?? 0;
}

assert(
  tapTwice({}, gameId, playerCount) === 2,
  "two taps from 0 should land at 2, not 3",
);

const oneTapFrom1 = applyPickTap({ [key]: 1 }, gameId, playerCount);
if ("error" in oneTapFrom1) {
  throw new Error(`one tap from 1 should succeed: ${oneTapFrom1.error}`);
}
assert(
  oneTapFrom1.gamePoints === 2,
  `one tap from 1 should land at 2, got ${oneTapFrom1.gamePoints}`,
);

console.log("test-pick-points: ok");
