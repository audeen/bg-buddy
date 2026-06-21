import Papa from "papaparse";
import { XMLParser } from "fast-xml-parser";
import { decodeBggText, stripBggHtml } from "@/lib/bgg/html";
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
  /** Community age recommendation, e.g. "10+" (suggested_playerage poll). */
  ageRange?: string | null;
  /** Winning option of the language_dependence poll, e.g. "No necessary in-game text". */
  languageDependence?: string | null;
  bestPlayerCounts?: number[];
  recommendedPlayerCounts?: number[];
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
  return decodeBggText(primary?.value);
}

type BggPollResult = { value?: string; numvotes?: string; level?: string };
type BggPollResults = {
  numplayers?: string;
  result?: BggPollResult | BggPollResult[];
};
type BggPoll = { name?: string; results?: BggPollResults | BggPollResults[] };

function findPoll(
  item: Record<string, unknown>,
  name: string,
): BggPoll | undefined {
  return asArray(item.poll as BggPoll[] | undefined).find(
    (p) => p.name === name,
  );
}

/** Flat result list of a poll without per-player-count grouping. */
function flatPollResults(poll: BggPoll | undefined): BggPollResult[] {
  return asArray(poll?.results).flatMap((r) => asArray(r.result));
}

function pollWinner(results: BggPollResult[]): BggPollResult | null {
  let winner: BggPollResult | null = null;
  let winnerVotes = 0;
  for (const r of results) {
    const votes = toInt(r.numvotes) ?? 0;
    if (votes > winnerVotes) {
      winnerVotes = votes;
      winner = r;
    }
  }
  return winner;
}

/**
 * Derives best/recommended player counts from the suggested_numplayers poll,
 * mirroring the BGG collection CSV columns (best counts are part of
 * recommended, "Not Recommended" winners are excluded).
 */
export function parseSuggestedPlayerCounts(item: Record<string, unknown>): {
  bestPlayerCounts: number[];
  recommendedPlayerCounts: number[];
} {
  const poll = findPoll(item, "suggested_numplayers");
  const best: number[] = [];
  const recommended: number[] = [];

  for (const entry of asArray(poll?.results)) {
    const raw = String(entry.numplayers ?? "");
    // Skip open-ended entries like "4+" (no concrete player count).
    if (!/^\d+$/.test(raw.trim())) continue;
    const count = toInt(raw);
    if (count == null || count <= 0) continue;

    let bestVotes = 0;
    let recVotes = 0;
    let notVotes = 0;
    for (const r of asArray(entry.result)) {
      const votes = toInt(r.numvotes) ?? 0;
      const value = (r.value ?? "").toLowerCase();
      if (value === "best") bestVotes = votes;
      else if (value === "recommended") recVotes = votes;
      else if (value === "not recommended") notVotes = votes;
    }

    if (bestVotes + recVotes + notVotes === 0) continue;
    if (notVotes > bestVotes && notVotes > recVotes) continue;

    recommended.push(count);
    if (bestVotes >= recVotes && bestVotes >= notVotes) {
      best.push(count);
    }
  }

  return {
    bestPlayerCounts: best.sort((a, b) => a - b),
    recommendedPlayerCounts: recommended.sort((a, b) => a - b),
  };
}

/**
 * Community age recommendation as "10+" (suggested_playerage poll winner),
 * falling back to the publisher minage. Matches the CSV bggrecagerange format.
 */
export function parseAgeRange(item: Record<string, unknown>): string | null {
  const winner = pollWinner(
    flatPollResults(findPoll(item, "suggested_playerage")),
  );
  const winnerAge = winner?.value?.match(/\d+/)?.[0];
  if (winnerAge) return `${winnerAge}+`;

  const minAge = toInt(attrValue(item.minage));
  return minAge != null && minAge > 0 ? `${minAge}+` : null;
}

/** Winning option text of the language_dependence poll (CSV format). */
export function parseLanguageDependence(
  item: Record<string, unknown>,
): string | null {
  const winner = pollWinner(
    flatPollResults(findPoll(item, "language_dependence")),
  );
  return winner?.value?.trim() || null;
}

/** Parses the XML returned by the BGG "thing" endpoint into ThingDetails. */
export function parseThingXml(xml: string): ThingDetails[] {
  const parsed = xmlParser.parse(xml);
  const items = asArray(parsed?.items?.item);

  return items.map((item: Record<string, unknown>): ThingDetails => {
    const links = asArray(item.link as Record<string, string>[] | undefined);
    const categories = links
      .filter((l) => l.type === "boardgamecategory")
      .map((l) => decodeBggText(l.value))
      .filter((v): v is string => v != null);
    const mechanics = links
      .filter((l) => l.type === "boardgamemechanic")
      .map((l) => decodeBggText(l.value))
      .filter((v): v is string => v != null);

    const expandsGameIds = parseExpandsGameIdsFromBggXmlLinks(links);
    const itemType = String(item.type ?? "").toLowerCase();

    const ratings = (item.statistics as Record<string, unknown> | undefined)
      ?.ratings as Record<string, unknown> | undefined;
    // Ranks live under statistics > ratings > ranks > rank in the BGG XML.
    const ranks = ratings?.ranks as Record<string, unknown> | undefined;
    const rankEntries = asArray(
      ranks?.rank as Record<string, string>[] | undefined,
    );
    const boardgameRank =
      rankEntries.find((r) => r.name === "boardgame") ?? rankEntries[0];

    const { bestPlayerCounts, recommendedPlayerCounts } =
      parseSuggestedPlayerCounts(item);

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
      ageRange: parseAgeRange(item),
      languageDependence: parseLanguageDependence(item),
      bestPlayerCounts,
      recommendedPlayerCounts,
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
export async function fetchThingBatch(
  ids: number[],
  options?: BggFetchOptions,
): Promise<ThingDetails[]> {
  if (ids.length === 0) return [];
  const url = `https://boardgamegeek.com/xmlapi2/thing?id=${ids.join(",")}&stats=1`;
  const xml = await fetchBggXml(url, options);
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

/** Optionen fuer BGG-XML-Requests. */
export type BggFetchOptions = {
  /**
   * Wenn gesetzt, wird der Next Data Cache (stale-while-revalidate) mit dieser
   * TTL in Sekunden genutzt, statt `no-store`. Gedacht fuer stabile, ueber
   * Serverless-Instanzen hinweg teilbare Daten (z. B. die Hotness), damit
   * kalte Instanzen BGG nicht erneut anfragen.
   */
  revalidate?: number;
};

type BggRequestInit = RequestInit & { next?: { revalidate?: number } };

async function fetchBggXml(
  url: string,
  options?: BggFetchOptions,
): Promise<string> {
  const headers = buildHeaders();
  const cacheInit: BggRequestInit =
    options?.revalidate != null
      ? { next: { revalidate: options.revalidate } }
      : { cache: "no-store" };
  return enqueueBggRequest(async () => {
    let attempt = 0;
    while (attempt < 5) {
      const res = await fetch(url, { headers, ...cacheInit });
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

export type BggHotItem = {
  bggId: number;
  rank: number;
  name: string;
  year: number | null;
  thumbnail: string | null;
};

/** Parses the XML returned by the BGG "hot" endpoint (Hotness list). */
export function parseHotXml(xml: string): BggHotItem[] {
  const parsed = xmlParser.parse(xml);
  const items = asArray(parsed?.items?.item);

  return items
    .map((item: Record<string, unknown>): BggHotItem | null => {
      const bggId = toInt(item.id as string);
      const rank = toInt(item.rank as string);
      const name = decodeBggText(attrValue(item.name));
      if (bggId == null || rank == null || !name) return null;

      return {
        bggId,
        rank,
        name,
        year: toInt(attrValue(item.yearpublished)),
        thumbnail: attrValue(item.thumbnail),
      };
    })
    .filter((item): item is BggHotItem => item != null)
    .sort((a, b) => a.rank - b.rank);
}

/**
 * Fetches the current BGG Hotness list (top 50 board games).
 * Requires BGG_TOKEN (see https://boardgamegeek.com/applications).
 */
export async function fetchHotGames(
  options?: BggFetchOptions,
): Promise<BggHotItem[]> {
  const url = "https://boardgamegeek.com/xmlapi2/hot?type=boardgame";
  const xml = await fetchBggXml(url, options);
  return parseHotXml(xml);
}

/** Splits an array into chunks of the given size. */
export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}
