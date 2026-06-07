import { nextPickPoints } from "../lib/pick-points";

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

console.log("test-pick-points: ok");
