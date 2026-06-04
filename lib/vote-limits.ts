export const MAX_PICKS_PER_COUNT = 3;
export const MAX_TINDER_WINS_PER_GAME = 3;
export const MAX_EXPOSURE_PER_GAME = 3;
export const MIN_TINDER_ROUNDS_BEFORE_PICK = 5;
export const MAX_TINDER_ROUNDS_PER_COUNT = 12;

export function maxTinderRoundsForPool(eligibleCount: number): number {
  return Math.min(
    MAX_TINDER_ROUNDS_PER_COUNT,
    Math.max(6, eligibleCount),
  );
}
