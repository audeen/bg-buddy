const PODIUM_ROW_HEIGHT_PX = 68;
const REST_ROW_HEIGHT_PX = 56;
const ROW_GAP_PX = 8;

export function estimateRankingRowHeight(rank: number): number {
  return rank <= 3 ? PODIUM_ROW_HEIGHT_PX : REST_ROW_HEIGHT_PX;
}

export function estimateRankingListHeight(entryCount: number): number {
  if (entryCount <= 0) return 0;

  let height = 0;
  for (let rank = 1; rank <= entryCount; rank += 1) {
    height += estimateRankingRowHeight(rank);
    if (rank < entryCount) height += ROW_GAP_PX;
  }
  return height;
}
