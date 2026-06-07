import type { Prisma } from "@prisma/client";

export type TimeBucket = "short" | "medium" | "long" | "epic";
export type WeightLevel = "leicht" | "mittel" | "schwer" | "experte";
export type GameSort = "name" | "rating-desc" | "rating-asc";
export type RatingBlock = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export type GameFilterKind =
  | "q"
  | "players"
  | "time"
  | "genre"
  | "mechanic"
  | "playerRange"
  | "playtime"
  | "weight"
  | "rating"
  | "best"
  | "exp";

export interface GameFilter {
  kind: GameFilterKind;
  value: string;
}

export interface GameFilters {
  q: string;
  players: number | null;
  time: TimeBucket | null;
  genre: string;
  mechanic: string;
  playerRange: string | null;
  playtime: string | null;
  weight: WeightLevel | null;
  rating: RatingBlock | null;
  best: number | null;
  includeExpansions: boolean;
}

export type GameFilterSearchParams = Record<string, string | string[] | undefined>;

const TIME_BUCKETS: Record<TimeBucket, { min: number; max: number }> = {
  short: { min: 0, max: 30 },
  medium: { min: 31, max: 60 },
  long: { min: 61, max: 120 },
  epic: { min: 121, max: 9999 },
};

const WEIGHT_LEVELS: WeightLevel[] = ["leicht", "mittel", "schwer", "experte"];

function paramValue(sp: GameFilterSearchParams, key: string): string {
  const raw = sp[key];
  if (Array.isArray(raw)) return (raw[0] ?? "").trim();
  return (raw ?? "").trim();
}

function parseTimeBucket(value: string): TimeBucket | null {
  if (value === "short" || value === "medium" || value === "long" || value === "epic") {
    return value;
  }
  return null;
}

function parseWeightLevel(value: string): WeightLevel | null {
  const lower = value.toLowerCase();
  return WEIGHT_LEVELS.includes(lower as WeightLevel) ? (lower as WeightLevel) : null;
}

function parseGameSortValue(value: string): GameSort {
  if (value === "rating-desc" || value === "rating-asc") return value;
  return "name";
}

export function ratingBlockFromValue(rating: number): RatingBlock {
  const block = Math.floor(rating);
  return Math.min(10, Math.max(1, block)) as RatingBlock;
}

function parseRatingBlock(value: string): RatingBlock | null {
  const parsed = parseFloat(value);
  if (!Number.isFinite(parsed)) return null;
  return ratingBlockFromValue(parsed);
}

export function ratingBlockWhere(block: RatingBlock): Prisma.GameWhereInput {
  if (block >= 10) {
    return { bggRating: { gte: 10 } };
  }
  return { bggRating: { gte: block, lt: block + 1 } };
}

export function ratingBlockLabel(block: RatingBlock): string {
  return block >= 10 ? "★ 10" : `★ ${block}+`;
}

export function parseGameSort(sp: GameFilterSearchParams): GameSort {
  return parseGameSortValue(paramValue(sp, "sort"));
}

export function parseGameFilters(sp: GameFilterSearchParams): GameFilters {
  const playersRaw = paramValue(sp, "players");
  const playersParsed = playersRaw ? parseInt(playersRaw, 10) : NaN;
  const bestRaw = paramValue(sp, "best");
  const bestParsed = bestRaw ? parseInt(bestRaw, 10) : NaN;
  const ratingRaw = paramValue(sp, "rating");

  return {
    q: paramValue(sp, "q"),
    players: Number.isFinite(playersParsed) ? playersParsed : null,
    time: parseTimeBucket(paramValue(sp, "time")),
    genre: paramValue(sp, "genre"),
    mechanic: paramValue(sp, "mechanic"),
    playerRange: paramValue(sp, "playerRange") || null,
    playtime: paramValue(sp, "playtime") || null,
    weight: parseWeightLevel(paramValue(sp, "weight")),
    rating: ratingRaw ? parseRatingBlock(ratingRaw) : null,
    best: Number.isFinite(bestParsed) ? bestParsed : null,
    includeExpansions: paramValue(sp, "exp") === "1",
  };
}

function playtimeOverlapWhere(min: number, max: number): Prisma.GameWhereInput {
  return {
    OR: [
      { playingTime: { gte: min, lte: max } },
      { minPlaytime: { gte: min, lte: max } },
      { maxPlaytime: { gte: min, lte: max } },
      {
        AND: [{ minPlaytime: { lte: max } }, { maxPlaytime: { gte: min } }],
      },
    ],
  };
}

function parseRange(value: string): { min: number; max: number } | null {
  const match = value.match(/^(\d+)(?:-(\d+))?$/);
  if (!match) return null;
  const min = parseInt(match[1], 10);
  const max = match[2] ? parseInt(match[2], 10) : min;
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return { min: Math.min(min, max), max: Math.max(min, max) };
}

function exactPlaytimeWhere(value: string): Prisma.GameWhereInput | null {
  const range = parseRange(value);
  if (!range) return null;

  if (range.min === range.max) {
    const single = range.min;
    return {
      OR: [
        { playingTime: single },
        { AND: [{ minPlaytime: single }, { maxPlaytime: single }] },
        {
          AND: [
            { minPlaytime: null },
            { maxPlaytime: null },
            { playingTime: single },
          ],
        },
      ],
    };
  }

  return {
    AND: [{ minPlaytime: range.min }, { maxPlaytime: range.max }],
  };
}

function weightLevelWhere(level: WeightLevel): Prisma.GameWhereInput {
  switch (level) {
    case "leicht":
      return { weight: { gt: 0, lt: 2 } };
    case "mittel":
      return { weight: { gte: 2, lt: 3 } };
    case "schwer":
      return { weight: { gte: 3, lt: 4 } };
    case "experte":
      return { weight: { gte: 4 } };
  }
}

export function buildGameOrderBy(sort: GameSort): Prisma.GameOrderByWithRelationInput[] {
  switch (sort) {
    case "rating-desc":
      return [{ bggRating: { sort: "desc", nulls: "last" } }, { name: "asc" }];
    case "rating-asc":
      return [{ bggRating: { sort: "asc", nulls: "last" } }, { name: "asc" }];
    default:
      return [{ name: "asc" }];
  }
}

export function buildGameWhere(filters: GameFilters): Prisma.GameWhereInput {
  const clauses: Prisma.GameWhereInput[] = [];

  if (!filters.includeExpansions) {
    clauses.push({ isExpansion: false });
  }
  if (filters.q) {
    clauses.push({ name: { contains: filters.q, mode: "insensitive" } });
  }
  if (filters.genre) {
    clauses.push({ categories: { has: filters.genre } });
  }
  if (filters.mechanic) {
    clauses.push({ mechanics: { has: filters.mechanic } });
  }
  if (filters.players != null) {
    clauses.push({
      AND: [
        { minPlayers: { lte: filters.players } },
        { maxPlayers: { gte: filters.players } },
      ],
    });
  }
  if (filters.time) {
    const bucket = TIME_BUCKETS[filters.time];
    clauses.push(playtimeOverlapWhere(bucket.min, bucket.max));
  }
  if (filters.playerRange) {
    const range = parseRange(filters.playerRange);
    if (range) {
      clauses.push({ minPlayers: range.min, maxPlayers: range.max });
    }
  }
  if (filters.playtime) {
    const playtimeClause = exactPlaytimeWhere(filters.playtime);
    if (playtimeClause) clauses.push(playtimeClause);
  }
  if (filters.weight) {
    clauses.push(weightLevelWhere(filters.weight));
  }
  if (filters.rating != null) {
    clauses.push(ratingBlockWhere(filters.rating));
  }
  if (filters.best != null) {
    clauses.push({ bestPlayerCounts: { has: filters.best } });
  }

  if (clauses.length === 0) return {};
  if (clauses.length === 1) return clauses[0];
  return { AND: clauses };
}

export function filtersToSearchParams(
  filters: GameFilters,
  sort: GameSort = "name",
): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.players != null) params.set("players", String(filters.players));
  if (filters.time) params.set("time", filters.time);
  if (filters.genre) params.set("genre", filters.genre);
  if (filters.mechanic) params.set("mechanic", filters.mechanic);
  if (filters.playerRange) params.set("playerRange", filters.playerRange);
  if (filters.playtime) params.set("playtime", filters.playtime);
  if (filters.weight) params.set("weight", filters.weight);
  if (filters.rating != null) params.set("rating", String(filters.rating));
  if (filters.best != null) params.set("best", String(filters.best));
  if (filters.includeExpansions) params.set("exp", "1");
  if (sort !== "name") params.set("sort", sort);
  return params;
}

export function filterUrl(
  path: string,
  filters: GameFilters,
  sort: GameSort = "name",
): string {
  const params = filtersToSearchParams(filters, sort);
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export function hasActiveFilters(filters: GameFilters): boolean {
  return (
    filters.q !== "" ||
    filters.players != null ||
    filters.time != null ||
    filters.genre !== "" ||
    filters.mechanic !== "" ||
    filters.playerRange != null ||
    filters.playtime != null ||
    filters.weight != null ||
    filters.rating != null ||
    filters.best != null ||
    filters.includeExpansions
  );
}

export interface ActiveFilterLabel {
  kind: GameFilterKind;
  label: string;
}

export function activeFilterLabels(filters: GameFilters): ActiveFilterLabel[] {
  const labels: ActiveFilterLabel[] = [];
  if (filters.q) labels.push({ kind: "q", label: `Suche: „${filters.q}"` });
  if (filters.players != null) {
    labels.push({ kind: "players", label: `${filters.players} Spieler (spielbar)` });
  }
  if (filters.time) {
    const timeLabels: Record<TimeBucket, string> = {
      short: "Bis 30 Min",
      medium: "31–60 Min",
      long: "61–120 Min",
      epic: "120+ Min",
    };
    labels.push({ kind: "time", label: timeLabels[filters.time] });
  }
  if (filters.genre) labels.push({ kind: "genre", label: filters.genre });
  if (filters.mechanic) labels.push({ kind: "mechanic", label: filters.mechanic });
  if (filters.playerRange) {
    const range = parseRange(filters.playerRange);
    if (range) {
      labels.push({
        kind: "playerRange",
        label:
          range.min === range.max
            ? `${range.min} Spieler`
            : `${range.min}–${range.max} Spieler`,
      });
    }
  }
  if (filters.playtime) {
    const range = parseRange(filters.playtime);
    labels.push({
      kind: "playtime",
      label:
        range && range.min !== range.max
          ? `${range.min}–${range.max} Min`
          : `${filters.playtime} Min`,
    });
  }
  if (filters.weight) {
    const weightLabels: Record<WeightLevel, string> = {
      leicht: "Leicht",
      mittel: "Mittel",
      schwer: "Schwer",
      experte: "Experte",
    };
    labels.push({ kind: "weight", label: weightLabels[filters.weight] });
  }
  if (filters.rating != null) {
    labels.push({ kind: "rating", label: ratingBlockLabel(filters.rating) });
  }
  if (filters.best != null) {
    labels.push({ kind: "best", label: `Best · ${filters.best}P` });
  }
  if (filters.includeExpansions) {
    labels.push({ kind: "exp", label: "Mit Erweiterungen" });
  }
  return labels;
}

export function clearFilterKind(filters: GameFilters, kind: GameFilterKind): GameFilters {
  switch (kind) {
    case "q":
      return { ...filters, q: "" };
    case "players":
      return { ...filters, players: null };
    case "time":
      return { ...filters, time: null };
    case "genre":
      return { ...filters, genre: "" };
    case "mechanic":
      return { ...filters, mechanic: "" };
    case "playerRange":
      return { ...filters, playerRange: null };
    case "playtime":
      return { ...filters, playtime: null };
    case "weight":
      return { ...filters, weight: null };
    case "rating":
      return { ...filters, rating: null };
    case "best":
      return { ...filters, best: null };
    case "exp":
      return { ...filters, includeExpansions: false };
  }
}

export function applyGameFilter(filters: GameFilters, filter: GameFilter): GameFilters {
  const next = { ...filters };
  switch (filter.kind) {
    case "q":
      next.q = filter.value;
      break;
    case "players":
      next.players = parseInt(filter.value, 10);
      break;
    case "time":
      next.time = parseTimeBucket(filter.value);
      break;
    case "genre":
      next.genre = filter.value;
      break;
    case "mechanic":
      next.mechanic = filter.value;
      break;
    case "playerRange":
      next.playerRange = filter.value;
      break;
    case "playtime":
      next.playtime = filter.value;
      break;
    case "weight":
      next.weight = parseWeightLevel(filter.value);
      break;
    case "rating":
      next.rating = parseRatingBlock(filter.value);
      break;
    case "best":
      next.best = parseInt(filter.value, 10);
      break;
    case "exp":
      next.includeExpansions = filter.value === "1";
      break;
  }
  return next;
}

export function isFilterActive(filters: GameFilters, filter: GameFilter): boolean {
  switch (filter.kind) {
    case "q":
      return filters.q === filter.value;
    case "players":
      return filters.players === parseInt(filter.value, 10);
    case "time":
      return filters.time === parseTimeBucket(filter.value);
    case "genre":
      return filters.genre === filter.value;
    case "mechanic":
      return filters.mechanic === filter.value;
    case "playerRange":
      return filters.playerRange === filter.value;
    case "playtime":
      return filters.playtime === filter.value;
    case "weight":
      return filters.weight === parseWeightLevel(filter.value);
    case "rating": {
      const block = parseRatingBlock(filter.value);
      return block != null && filters.rating === block;
    }
    case "best":
      return filters.best === parseInt(filter.value, 10);
    case "exp":
      return filters.includeExpansions === (filter.value === "1");
  }
}

export function toggleGameFilter(filters: GameFilters, filter: GameFilter): GameFilters {
  if (isFilterActive(filters, filter)) {
    return clearFilterKind(filters, filter.kind);
  }
  return applyGameFilter(filters, filter);
}

export function weightLevelFromValue(weight: number): WeightLevel {
  if (weight < 2) return "leicht";
  if (weight < 3) return "mittel";
  if (weight < 4) return "schwer";
  return "experte";
}

export function playerRangeFilterValue(
  min: number | null,
  max: number | null,
): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null) {
    return min === max ? `${min}-${min}` : `${min}-${max}`;
  }
  const single = min ?? max;
  return single != null ? `${single}-${single}` : null;
}

export function playtimeFilterValue(
  min: number | null,
  max: number | null,
  fallback: number | null,
): string | null {
  if (min != null && max != null && min !== max) return `${min}-${max}`;
  const single = fallback ?? min ?? max;
  return single != null && single > 0 ? `${single}` : null;
}

export const TIME_BUCKET_OPTIONS: { value: TimeBucket; label: string }[] = [
  { value: "short", label: "Bis 30 Min" },
  { value: "medium", label: "31–60 Min" },
  { value: "long", label: "61–120 Min" },
  { value: "epic", label: "120+ Min" },
];

export const WEIGHT_LEVEL_OPTIONS: { value: WeightLevel; label: string }[] = [
  { value: "leicht", label: "Leicht" },
  { value: "mittel", label: "Mittel" },
  { value: "schwer", label: "Schwer" },
  { value: "experte", label: "Experte" },
];

export const RATING_TIER_OPTIONS: { value: RatingBlock; label: string }[] = [
  { value: 7, label: "★ 7+" },
  { value: 8, label: "★ 8+" },
  { value: 9, label: "★ 9+" },
];

export const SORT_OPTIONS: { value: GameSort; label: string }[] = [
  { value: "name", label: "Name A–Z" },
  { value: "rating-desc", label: "Rating ↓" },
  { value: "rating-asc", label: "Rating ↑" },
];
