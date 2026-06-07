import { MAX_POINTS_PER_GAME } from "@/lib/vote-limits";

/** Next point value after tapping a game card in the pick UI. */
export function nextPickPoints(current: number, budgetLeft: number): number {
  if (current === 0) return budgetLeft > 0 ? 1 : 0;
  if (budgetLeft > 0 && current < MAX_POINTS_PER_GAME) return current + 1;
  return 0;
}
