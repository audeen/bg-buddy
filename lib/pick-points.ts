import { MAX_PICK_POINTS, MAX_POINTS_PER_GAME } from "@/lib/vote-limits";

export function pointsKey(gameId: number, playerCount: number): string {
  return `${gameId}:${playerCount}`;
}

export function pointsForCount(
  points: Record<string, number>,
  playerCount: number,
): number {
  let sum = 0;
  for (const [key, val] of Object.entries(points)) {
    if (key.endsWith(`:${playerCount}`)) sum += val;
  }
  return sum;
}

/** Next point value after tapping a game card in the pick UI. */
export function nextPickPoints(current: number, budgetLeft: number): number {
  if (current === 0) return budgetLeft > 0 ? 1 : 0;
  if (budgetLeft > 0 && current < MAX_POINTS_PER_GAME) return current + 1;
  return 0;
}

export type ApplyPickTapResult =
  | { nextPoints: Record<string, number>; gamePoints: number }
  | { error: string };

/** Apply one pick tap to the current points map (immutable). */
export function applyPickTap(
  points: Record<string, number>,
  gameId: number,
  playerCount: number,
): ApplyPickTapResult {
  const key = pointsKey(gameId, playerCount);
  const current = points[key] ?? 0;
  const used = pointsForCount(points, playerCount);
  const budgetLeft = MAX_PICK_POINTS - used;
  const next = nextPickPoints(current, budgetLeft);
  if (next === current) {
    return { nextPoints: points, gamePoints: current };
  }

  const clamped = Math.max(0, Math.min(MAX_POINTS_PER_GAME, next));
  const newUsed = used - current + clamped;
  if (newUsed > MAX_PICK_POINTS) {
    return {
      error: `Maximal ${MAX_PICK_POINTS} Stimmen für diese Spieleranzahl.`,
    };
  }

  const copy = { ...points };
  if (clamped === 0) delete copy[key];
  else copy[key] = clamped;
  return { nextPoints: copy, gamePoints: clamped };
}
