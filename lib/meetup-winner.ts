import type { RankEntry } from "@/lib/types/ranking";

/** Top combined-ranking entry for a player count (pickCount + duel wins). */
export function winnerFromCombined(
  combined: RankEntry[] | undefined,
): RankEntry | null {
  if (!combined || combined.length === 0) return null;
  const sorted = [...combined].sort(
    (a, b) => b.points - a.points || a.name.localeCompare(b.name, "de"),
  );
  const top = sorted[0];
  if (top.points <= 0) return null;
  return top;
}
