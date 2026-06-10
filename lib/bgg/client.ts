import {
  fetchThingBatch,
  searchBggGames,
  type BggSearchItem,
  type ThingDetails,
} from "@/lib/bgg";
import { loadEnrichmentCache } from "@/lib/enrichment-cache";
import { geekitemApiUrl, parseGeekitemJson } from "@/lib/geekdo-item";

/**
 * Schmale Zugriffsschicht auf BoardGameGeek-Daten.
 *
 * Bündelt die aktuellen Quellen (XML-API, Geekdo-JSON-Scrape, lokaler
 * Enrichment-Cache) hinter einer austauschbaren Schnittstelle — die
 * kommende offizielle BGG-API muss nur diese Methoden implementieren.
 */
export interface BggClient {
  /** Details über die XML-"thing"-API (max. ~20 IDs, benötigt BGG_TOKEN). */
  getThings(ids: number[]): Promise<ThingDetails[]>;
  /** Namenssuche über die XML-"search"-API (benötigt BGG_TOKEN). */
  searchByName(
    query: string,
    options?: { types?: string[]; limit?: number },
  ): Promise<BggSearchItem[]>;
  /** Einzelnes Spiel über den Geekdo-JSON-Endpoint (ohne Token). */
  getThingFromGeekdo(id: number): Promise<ThingDetails | null>;
  /** Lokal gecachte Details aus `data/bgg-enrichment.json`. */
  getCachedThings(): Map<number, ThingDetails>;
}

export const bggClient: BggClient = {
  getThings: fetchThingBatch,
  searchByName: searchBggGames,

  async getThingFromGeekdo(id) {
    try {
      const res = await fetch(geekitemApiUrl(id), { cache: "no-store" });
      if (!res.ok) return null;
      const json = await res.json();
      return parseGeekitemJson(json, id);
    } catch {
      return null;
    }
  },

  getCachedThings: loadEnrichmentCache,
};

export type { BggSearchItem, ThingDetails };
