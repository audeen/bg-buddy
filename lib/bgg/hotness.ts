import { fetchHotGames, type BggHotItem, type ThingDetails } from "@/lib/bgg";
import { bggClient } from "@/lib/bgg/client";
import { deterministicIndex } from "@/lib/game-of-the-day";
import type { GameDetailData } from "@/lib/types/game";

export type HotnessSpotlight = {
  game: GameDetailData;
  rank: number;
};

/** Pool size for the daily pick: variety without leaving the actual "hot" zone. */
const HOTNESS_PICK_POOL_SIZE = 10;

/** Picks the hotness game of the day from the top of the list (date-seeded). */
export function pickHotnessItem(
  items: BggHotItem[],
  dateKey: string,
): BggHotItem | null {
  const pool = items.slice(0, HOTNESS_PICK_POOL_SIZE);
  if (pool.length === 0) return null;
  return pool[deterministicIndex(dateKey, pool.length)] ?? null;
}

/** Maps BGG thing details onto the shared card/modal data shape. */
export function thingDetailsToGameDetailData(
  details: ThingDetails,
  fallback: BggHotItem,
): GameDetailData {
  return {
    id: details.id,
    name: details.name ?? fallback.name,
    year: details.year ?? fallback.year,
    description: details.descriptionDe ?? details.description,
    image: details.image,
    thumbnail: details.thumbnail ?? fallback.thumbnail,
    minPlayers: details.minPlayers ?? null,
    maxPlayers: details.maxPlayers ?? null,
    minPlaytime: details.minPlaytime ?? null,
    maxPlaytime: details.maxPlaytime ?? null,
    playingTime: details.playingTime ?? null,
    weight: details.weight ?? null,
    bggRating: details.bggRating ?? null,
    ageRange: details.ageRange ?? null,
    isExpansion: details.isExpansion ?? false,
    categories: details.categories,
    mechanics: details.mechanics,
    bestPlayerCounts: details.bestPlayerCounts ?? [],
    recommendedPlayerCounts: details.recommendedPlayerCounts ?? [],
  };
}

const CACHE_TTL_MS = 60 * 60 * 1000;

type HotnessCache = {
  dateKey: string;
  fetchedAt: number;
  spotlight: HotnessSpotlight | null;
};

let cache: HotnessCache | null = null;
let pending: Promise<HotnessSpotlight | null> | null = null;

async function loadHotnessSpotlight(
  dateKey: string,
): Promise<HotnessSpotlight | null> {
  const hotItems = await fetchHotGames();
  const picked = pickHotnessItem(hotItems, dateKey);
  if (!picked) return null;

  const [details] = await bggClient.getThings([picked.bggId]);
  if (!details) return null;

  return {
    game: thingDetailsToGameDetailData(details, picked),
    rank: picked.rank,
  };
}

/**
 * Hotness-Spiel des Tages: stabil pro Datum, gecacht pro Server-Instanz
 * (TTL 1h), damit die force-dynamic Startseite nicht bei jedem Aufruf
 * zwei gedrosselte BGG-Requests auslöst. Bei Fehlern wird der letzte
 * Stand weiterverwendet bzw. null geliefert (Slide entfällt dann).
 */
export async function getHotnessSpotlight(
  dateKey: string,
): Promise<HotnessSpotlight | null> {
  const now = Date.now();
  if (
    cache &&
    cache.dateKey === dateKey &&
    now - cache.fetchedAt < CACHE_TTL_MS
  ) {
    return cache.spotlight;
  }

  pending ??= loadHotnessSpotlight(dateKey)
    .then((spotlight) => {
      cache = { dateKey, fetchedAt: Date.now(), spotlight };
      return spotlight;
    })
    .catch((error) => {
      console.warn("[bgg/hotness] Hotness konnte nicht geladen werden:", error);
      // Letzten Stand (ggf. stale) weiterverwenden und TTL verlängern,
      // damit nicht jeder Seitenaufruf erneut BGG anfragt.
      const stale = cache?.spotlight ?? null;
      cache = { dateKey, fetchedAt: Date.now(), spotlight: stale };
      return stale;
    })
    .finally(() => {
      pending = null;
    });

  return pending;
}
