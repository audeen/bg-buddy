import { BggBlockedError, type BggSearchItem } from "@/lib/bgg";
import { bggClient } from "@/lib/bgg/client";

export type BggSearchResult =
  | {
      status: "found";
      query: string;
      bggId: number;
      name: string;
      year: number | null;
      isExpansion: boolean;
    }
  | { status: "candidates"; query: string; items: BggSearchItem[] }
  | { status: "notFound"; query: string }
  | { status: "error"; message: string };

const DEFAULT_LIMIT = 20;

/** Maps raw BGG search hits into a structured lookup result. Exported for tests. */
export function parseBggSearchResponse(
  items: BggSearchItem[],
  query: string,
  limit = DEFAULT_LIMIT,
): BggSearchResult {
  const trimmed = items.slice(0, limit);

  if (trimmed.length === 0) {
    return { status: "notFound", query };
  }

  if (trimmed.length === 1) {
    const only = trimmed[0];
    return {
      status: "found",
      query,
      bggId: only.bggId,
      name: only.name,
      year: only.year,
      isExpansion: only.isExpansion,
    };
  }

  return { status: "candidates", query, items: trimmed };
}

export async function lookupBggByName(rawQuery: string): Promise<BggSearchResult> {
  const query = rawQuery.trim();
  if (query.length < 2) {
    return { status: "error", message: "Suchbegriff zu kurz (mindestens 2 Zeichen)." };
  }

  try {
    const items = await bggClient.searchByName(query);
    return parseBggSearchResponse(items, query);
  } catch (err) {
    if (err instanceof BggBlockedError) {
      return { status: "error", message: err.message };
    }
    const message =
      err instanceof Error ? err.message : "BGG-Suche fehlgeschlagen.";
    return { status: "error", message };
  }
}
