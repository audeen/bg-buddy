import Papa from "papaparse";
import { XMLParser } from "fast-xml-parser";
import { parseExpandsGameIdsFromBggXmlLinks } from "@/lib/expansion-links";

export interface ParsedGame {
  id: number;
  name: string;
  year: number | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  playingTime: number | null;
  minPlaytime: number | null;
  maxPlaytime: number | null;
  weight: number | null;
  bggRating: number | null;
  rank: number | null;
  ageRange: string | null;
  languageDependence: string | null;
  isExpansion: boolean;
  bestPlayerCounts: number[];
  recommendedPlayerCounts: number[];
}

function toInt(value: string | undefined | null): number | null {
  if (value == null || value === "") return null;
  const n = parseInt(String(value).trim(), 10);
  return Number.isFinite(n) ? n : null;
}

function toFloat(value: string | undefined | null): number | null {
  if (value == null || value === "") return null;
  const n = parseFloat(String(value).trim());
  return Number.isFinite(n) ? n : null;
}

/** Parses "3,4,5,6,7" (BGG poll values) into a sorted unique number array. */
export function parsePlayerCounts(value: string | undefined | null): number[] {
  if (!value) return [];
  const counts = String(value)
    .split(",")
    .map((token) => {
      const match = token.match(/\d+/);
      return match ? parseInt(match[0], 10) : NaN;
    })
    .filter((n) => Number.isFinite(n) && n > 0);
  return Array.from(new Set(counts)).sort((a, b) => a - b);
}

/** Parses a BGG collection CSV export into normalized game records. */
export function parseCollectionCsv(csvText: string): ParsedGame[] {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  const games: ParsedGame[] = [];
  const seen = new Set<number>();

  for (const row of result.data) {
    const id = toInt(row.objectid);
    if (id == null || seen.has(id)) continue;
    const name = (row.objectname || row.originalname || "").trim();
    if (!name) continue;
    seen.add(id);

    const itemType = (row.itemtype || "").trim().toLowerCase();

    games.push({
      id,
      name,
      year: toInt(row.yearpublished) ?? toInt(row.year),
      minPlayers: toInt(row.minplayers),
      maxPlayers: toInt(row.maxplayers),
      playingTime: toInt(row.playingtime),
      minPlaytime: toInt(row.minplaytime),
      maxPlaytime: toInt(row.maxplaytime),
      weight: toFloat(row.avgweight),
      bggRating: toFloat(row.average),
      rank: toInt(row.rank),
      ageRange: (row.bggrecagerange || "").trim() || null,
      languageDependence: (row.bgglanguagedependence || "").trim() || null,
      isExpansion: itemType === "expansion",
      bestPlayerCounts: parsePlayerCounts(row.bggbestplayers),
      recommendedPlayerCounts: parsePlayerCounts(row.bggrecplayers),
    });
  }

  return games;
}

export interface ThingDetails {
  id: number;
  /** English description (source language from BGG/Geekdo). */
  description: string | null;
  image: string | null;
  thumbnail: string | null;
  /** English category labels. */
  categories: string[];
  /** English mechanic labels. */
  mechanics: string[];
  /** Base game BGG ids (expansion items only). */
  expandsGameIds?: number[];
  descriptionDe?: string | null;
  categoriesDe?: string[];
  mechanicsDe?: string[];
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  textNodeName: "_text",
});

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function cleanDescription(raw: unknown): string | null {
  if (raw == null) return null;
  let text = String(raw);
  // BGG sends literal HTML entities for newlines and tags.
  text = text
    .replace(/&#10;/g, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text || null;
}

/** Parses the XML returned by the BGG "thing" endpoint into ThingDetails. */
export function parseThingXml(xml: string): ThingDetails[] {
  const parsed = xmlParser.parse(xml);
  const items = asArray(parsed?.items?.item);

  return items.map((item: Record<string, unknown>): ThingDetails => {
    const links = asArray(item.link as Record<string, string>[] | undefined);
    const categories = links
      .filter((l) => l.type === "boardgamecategory")
      .map((l) => l.value)
      .filter(Boolean);
    const mechanics = links
      .filter((l) => l.type === "boardgamemechanic")
      .map((l) => l.value)
      .filter(Boolean);

    const expandsGameIds = parseExpandsGameIdsFromBggXmlLinks(links);

    return {
      id: toInt(item.id as string) ?? 0,
      description: cleanDescription(item.description),
      image: (item.image as string) ?? null,
      thumbnail: (item.thumbnail as string) ?? null,
      categories,
      mechanics,
      ...(expandsGameIds.length > 0 ? { expandsGameIds } : {}),
    };
  });
}

export class BggBlockedError extends Error {
  constructor(public status: number) {
    super(
      `BoardGameGeek hat die Anfrage abgelehnt (HTTP ${status}). ` +
        "Die XML-API verlangt seit 2025 einen API-Token. " +
        "Registriere eine Application unter https://boardgamegeek.com/applications, " +
        "erzeuge einen Token und setze ihn als Umgebungsvariable BGG_TOKEN " +
        "(lokal in .env, auf Vercel als Environment Variable).",
    );
    this.name = "BggBlockedError";
  }
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Accept: "application/xml,text/xml,*/*;q=0.9",
    "Accept-Language": "de,en;q=0.8",
  };
  const token = process.env.BGG_TOKEN?.trim();
  if (token) {
    // BGG requires "Bearer <token>" (space, no colon) since 2025.
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Fetches details for up to ~20 game ids from the BGG "thing" XML API.
 * Returns description, cover image, categories (genre) and mechanics.
 *
 * Requires the BGG_TOKEN env var (see https://boardgamegeek.com/applications).
 */
export async function fetchThingBatch(ids: number[]): Promise<ThingDetails[]> {
  if (ids.length === 0) return [];
  // Domain MUST be boardgamegeek.com WITHOUT a leading "www" for the token to work.
  const url = `https://boardgamegeek.com/xmlapi2/thing?id=${ids.join(",")}&stats=1`;
  const headers = buildHeaders();

  let attempt = 0;
  let xml = "";
  while (attempt < 5) {
    const res = await fetch(url, { headers, cache: "no-store" });
    if (res.status === 200) {
      xml = await res.text();
      break;
    }
    // 401/403 = missing/invalid token -> retrying won't help
    if (res.status === 401 || res.status === 403) {
      throw new BggBlockedError(res.status);
    }
    // 202 = queued, anything else transient -> wait and retry
    attempt += 1;
    await new Promise((r) => setTimeout(r, 1500 * attempt));
  }
  if (!xml) throw new Error("BGG thing API did not return data");

  return parseThingXml(xml);
}

/** Splits an array into chunks of the given size. */
export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

export {
  loadEnrichmentCache,
  enrichmentCacheEntryCount,
  thingDetailsToDbFields,
  localizedEnrichmentFields,
  hasEnrichmentContent,
  normalizeCacheEntry,
  serializeEnrichmentCache,
  enrichmentCachePath,
  ENRICHMENT_CACHE_FILE,
} from "@/lib/enrichment-cache";
