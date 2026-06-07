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
  assert(!("error" in result), `tap chain failed at ${expected}`);
  assert(
    result.gamePoints === expected,
    `tap chain: expected ${expected}, got ${result.gamePoints}`,
  );
  pts = result.nextPoints;
}

pts = { [key]: 1, [pointsKey(99, playerCount)]: 2 };
let fullBudget = applyPickTap(pts, gameId, playerCount);
assert(!("error" in fullBudget), "full budget tap should succeed");
assert(
  fullBudget.gamePoints === 0,
  `full budget: expected 0, got ${fullBudget.gamePoints}`,
);

pts = { [key]: 1 };
let freeBudget = applyPickTap(pts, gameId, playerCount);
assert(!("error" in freeBudget), "free budget tap should succeed");
assert(
  freeBudget.gamePoints === 2,
  `free budget: expected 2, got ${freeBudget.gamePoints}`,
);

console.log("test-pick-points: ok");
