import {
  fetchThingBatch,
  searchBggGames,
  type BggSearchItem,
  type ThingDetails,
} from "@/lib/bgg";

/**
 * Schmale Zugriffsschicht auf die offizielle BGG-XML-API.
 *
 * Alle Anfragen laufen serverseitig mit dem App-Token (BGG_TOKEN)
 * und werden in lib/bgg.ts global gedrosselt.
 */
export interface BggClient {
  /** Details über die XML-"thing"-API (max. ~20 IDs, benötigt BGG_TOKEN). */
  getThings(ids: number[]): Promise<ThingDetails[]>;
  /** Namenssuche über die XML-"search"-API (benötigt BGG_TOKEN). */
  searchByName(
    query: string,
    options?: { types?: string[]; limit?: number },
  ): Promise<BggSearchItem[]>;
}

export const bggClient: BggClient = {
  getThings: fetchThingBatch,
  searchByName: searchBggGames,
};

export type { BggSearchItem, ThingDetails };
