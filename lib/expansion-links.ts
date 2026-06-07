/** Base game BGG ids from geekdo links.expandsboardgame (expansion items). */
export function parseExpandsGameIdsFromGeekdoLinks(
  links:
    | Record<string, { objectid?: string | number }[] | undefined>
    | undefined,
): number[] {
  const arr = links?.expandsboardgame;
  if (!Array.isArray(arr)) return [];
  const ids = arr
    .map((x) => parseInt(String(x.objectid), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  return [...new Set(ids)].sort((a, b) => a - b);
}

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
