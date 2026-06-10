/** Base game BGG ids from BGG thing XML inbound boardgameexpansion links. */
export function parseExpandsGameIdsFromBggXmlLinks(
  links: Record<string, string>[],
): number[] {
  const ids = links
    .filter((l) => l.type === "boardgameexpansion" && l.inbound === "true")
    .map((l) => parseInt(String(l.id), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  return [...new Set(ids)].sort((a, b) => a - b);
}
