import Papa from "papaparse";
import { XMLParser } from "fast-xml-parser";
import { stripBggHtml } from "@/lib/bgg/html";
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
  barcode: string | null;
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
      barcode: (row.barcode || "").trim() || null,
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
  /** Parsed from thing XML when available (single-game add / enrichment). */
  name?: string | null;
  year?: number | null;
  minPlayers?: number | null;
  maxPlayers?: number | null;
  playingTime?: number | null;
  minPlaytime?: number | null;
  maxPlaytime?: number | null;
  weight?: number | null;
  bggRating?: number | null;
  rank?: number | null;
  isExpansion?: boolean;
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

function attrValue(node: unknown): string | null {
  if (node == null) return null;
  if (typeof node === "object" && node !== null && "value" in node) {
    const v = (node as { value?: string }).value;
    return v != null ? String(v).trim() : null;
  }
  const s = String(node).trim();
  return s || null;
}

function primaryName(item: Record<string, unknown>): string | null {
  const names = asArray(item.name as Record<string, string>[] | undefined);
  const primary = names.find((n) => n.type === "primary") ?? names[0];
  return primary?.value?.trim() || null;
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
    const itemType = String(item.type ?? "").toLowerCase();

    const ratings = (item.statistics as Record<string, unknown> | undefined)
      ?.ratings as Record<string, unknown> | undefined;
    const rankEntries = asArray(
      ratings?.rank as Record<string, string>[] | undefined,
    );
    const boardgameRank =
      rankEntries.find((r) => r.name === "boardgame") ?? rankEntries[0];

    return {
      id: toInt(item.id as string) ?? 0,
      name: primaryName(item),
      year: toInt(attrValue(item.yearpublished)),
      minPlayers: toInt(attrValue(item.minplayers)),
      maxPlayers: toInt(attrValue(item.maxplayers)),
      playingTime: toInt(attrValue(item.playingtime)),
      minPlaytime: toInt(attrValue(item.minplaytime)),
      maxPlaytime: toInt(attrValue(item.maxplaytime)),
      weight: toFloat(attrValue(ratings?.averageweight)),
      bggRating: toFloat(attrValue(ratings?.average)),
      rank: toInt(boardgameRank?.value),
      isExpansion: itemType.includes("expansion"),
      description: stripBggHtml(item.description),
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
        "Prüfe, ob der BGG_TOKEN gültig ist: Registriere eine Application unter " +
        "https://boardgamegeek.com/applications, erzeuge einen Token und setze " +
        "ihn als Umgebungsvariable BGG_TOKEN (lokal in .env, auf Vercel als " +
        "Environment Variable).",
    );
    this.name = "BggBlockedError";
  }
}

export class BggTokenMissingError extends Error {
  constructor() {
    super(
      "BGG_TOKEN ist nicht gesetzt. Die BGG-XML-API verlangt einen API-Token: " +
        "Registriere eine Application unter https://boardgamegeek.com/applications, " +
        "erzeuge einen Token und setze ihn als Umgebungsvariable BGG_TOKEN " +
        "(lokal in .env, auf Vercel als Environment Variable).",
    );
    this.name = "BggTokenMissingError";
  }
}

const BGG_USER_AGENT = "BG-Buddy/0.1 (registrierte BGG-Application)";

if (process.env.NODE_ENV !== "production" && !process.env.BGG_TOKEN?.trim()) {
  console.warn(
    "[bgg] BGG_TOKEN ist nicht gesetzt – BGG-Anfragen (Suche, Enrichment, " +
      "Import) werden fehlschlagen. Token unter " +
      "https://boardgamegeek.com/applications erzeugen und in .env eintragen.",
  );
}

function buildHeaders(): Record<string, string> {
  const token = process.env.BGG_TOKEN?.trim();
  if (!token) {
    throw new BggTokenMissingError();
  }
  return {
    "User-Agent": BGG_USER_AGENT,
    Accept: "application/xml,text/xml,*/*;q=0.9",
    "Accept-Language": "de,en;q=0.8",
    // BGG requires "Bearer <token>" (space, no colon) since 2025.
    Authorization: `Bearer ${token}`,
  };
}

/**
 * Alle Nutzer teilen sich den App-Token und damit ein Rate-Limit.
 * Deshalb laufen alle XML-Requests seriell mit Mindestabstand durch
 * eine globale Queue (pro Server-Instanz).
 */
const MIN_REQUEST_INTERVAL_MS = 1500;
let requestChain: Promise<unknown> = Promise.resolve();
let lastRequestFinishedAt = 0;

function enqueueBggRequest<T>(task: () => Promise<T>): Promise<T> {
  const run = requestChain.then(async () => {
    const wait = lastRequestFinishedAt + MIN_REQUEST_INTERVAL_MS - Date.now();
    if (wait > 0) {
      await new Promise((r) => setTimeout(r, wait));
    }
    try {
      return await task();
    } finally {
      lastRequestFinishedAt = Date.now();
    }
  });
  requestChain = run.catch(() => {});
  return run;
}

function parseRetryAfterMs(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const date = Date.parse(header);
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  return null;
}

/**
 * Fetches details for up to ~20 game ids from the BGG "thing" XML API.
 * Returns description, cover image, categories (genre) and mechanics.
 *
 * Requires the BGG_TOKEN env var (see https://boardgamegeek.com/applications).
 */
export async function fetchThingBatch(ids: number[]): Promise<ThingDetails[]> {
  if (ids.length === 0) return [];
  const url = `https://boardgamegeek.com/xmlapi2/thing?id=${ids.join(",")}&stats=1`;
  const xml = await fetchBggXml(url);
  return parseThingXml(xml);
}

export type BggSearchItem = {
  bggId: number;
  name: string;
  year: number | null;
  isExpansion: boolean;
};

/** Parses the XML returned by the BGG "search" endpoint. */
export function parseSearchXml(xml: string): BggSearchItem[] {
  const parsed = xmlParser.parse(xml);
  const items = asArray(parsed?.items?.item);

  return items
    .map((item: Record<string, unknown>): BggSearchItem | null => {
      const bggId = toInt(item.id as string);
      const name = primaryName(item);
      if (bggId == null || !name) return null;

      const itemType = String(item.type ?? "").toLowerCase();
      return {
        bggId,
        name,
        year: toInt(attrValue(item.yearpublished)),
        isExpansion: itemType.includes("expansion"),
      };
    })
    .filter((item): item is BggSearchItem => item != null);
}

async function fetchBggXml(url: string): Promise<string> {
  const headers = buildHeaders();
  return enqueueBggRequest(async () => {
    let attempt = 0;
    while (attempt < 5) {
      const res = await fetch(url, { headers, cache: "no-store" });
      if (res.status === 200) {
        return res.text();
      }
      if (res.status === 401 || res.status === 403) {
        throw new BggBlockedError(res.status);
      }
      attempt += 1;
      const retryAfterMs =
        res.status === 429
          ? parseRetryAfterMs(res.headers.get("retry-after"))
          : null;
      const delay = retryAfterMs ?? 1500 * attempt;
      await new Promise((r) => setTimeout(r, delay));
    }
    throw new Error(`BGG XML API did not return data (${url})`);
  });
}

/**
 * Searches BGG by game name via the XML search API.
 * Requires BGG_TOKEN (see https://boardgamegeek.com/applications).
 */
export async function searchBggGames(
  query: string,
  options?: { types?: string[]; limit?: number },
): Promise<BggSearchItem[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const types = options?.types ?? ["boardgame", "boardgameexpansion"];
  const params = new URLSearchParams({
    query: trimmed,
    type: types.join(","),
  });
  const url = `https://boardgamegeek.com/xmlapi2/search?${params.toString()}`;
  const xml = await fetchBggXml(url);
  const items = parseSearchXml(xml);
  const limit = options?.limit ?? 20;
  return items.slice(0, limit);
}

/** Splits an array into chunks of the given size. */
export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}
