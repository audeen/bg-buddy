export function buildPickCounts(
  picks: { gameId: number }[],
): Record<number, number> {
  const counts: Record<number, number> = {};
  for (const p of picks) {
    counts[p.gameId] = (counts[p.gameId] ?? 0) + 1;
  }
  return counts;
}

export function poolGameIds(pickCounts: Record<number, number>): number[] {
  return Object.keys(pickCounts).map(Number);
}
