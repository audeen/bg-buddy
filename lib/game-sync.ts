import type { Prisma } from "@prisma/client";
import type { ParsedGame } from "@/lib/bgg";

export type ConflictResolution = "keepManual" | "overwriteAll";

export type SyncFieldName =
  | "name"
  | "year"
  | "minPlayers"
  | "maxPlayers"
  | "playingTime"
  | "minPlaytime"
  | "maxPlaytime"
  | "weight"
  | "bggRating"
  | "rank"
  | "ageRange"
  | "languageDependence"
  | "isExpansion"
  | "bestPlayerCounts"
  | "recommendedPlayerCounts"
  | "description"
  | "image"
  | "thumbnail"
  | "categories"
  | "mechanics"
  | "expandsGameIds"
  | "enriched";

export const CSV_SYNC_FIELDS: SyncFieldName[] = [
  "name",
  "year",
  "minPlayers",
  "maxPlayers",
  "playingTime",
  "minPlaytime",
  "maxPlaytime",
  "weight",
  "bggRating",
  "rank",
  "ageRange",
  "languageDependence",
  "isExpansion",
  "bestPlayerCounts",
  "recommendedPlayerCounts",
];

export const ENRICHMENT_SYNC_FIELDS: SyncFieldName[] = [
  "description",
  "image",
  "thumbnail",
  "categories",
  "mechanics",
  "expandsGameIds",
  "enriched",
];

export type FieldConflict = {
  field: SyncFieldName;
  current: unknown;
  incoming: unknown;
};

export type GameSyncConflict = {
  gameId: number;
  name: string;
  conflicts: FieldConflict[];
};

function serializeValue(value: unknown): string {
  if (value == null) return "";
  if (Array.isArray(value)) {
    return JSON.stringify([...value].sort((a, b) => String(a).localeCompare(String(b))));
  }
  return JSON.stringify(value);
}

export function valuesDiffer(current: unknown, incoming: unknown): boolean {
  return serializeValue(current) !== serializeValue(incoming);
}

export function parsedGameToCsvFields(g: ParsedGame): Partial<Record<SyncFieldName, unknown>> {
  return {
    name: g.name,
    year: g.year,
    minPlayers: g.minPlayers,
    maxPlayers: g.maxPlayers,
    playingTime: g.playingTime,
    minPlaytime: g.minPlaytime,
    maxPlaytime: g.maxPlaytime,
    weight: g.weight,
    bggRating: g.bggRating,
    rank: g.rank,
    ageRange: g.ageRange,
    languageDependence: g.languageDependence,
    isExpansion: g.isExpansion,
    bestPlayerCounts: g.bestPlayerCounts,
    recommendedPlayerCounts: g.recommendedPlayerCounts,
  };
}

export type GameSyncRecord = Partial<Record<SyncFieldName, unknown>> & {
  manuallyEditedFields: string[];
};

export function diffGameFields(
  existing: GameSyncRecord,
  incoming: Partial<Record<SyncFieldName, unknown>>,
  fields: SyncFieldName[],
): FieldConflict[] {
  const conflicts: FieldConflict[] = [];
  const manual = new Set(existing.manuallyEditedFields);

  for (const field of fields) {
    if (!(field in incoming)) continue;
    const incomingVal = incoming[field];
    const currentVal = existing[field];
    if (!manual.has(field)) continue;
    if (!valuesDiffer(currentVal, incomingVal)) continue;
    conflicts.push({ field, current: currentVal, incoming: incomingVal });
  }

  return conflicts;
}

export function buildResolvableUpdate(
  existing: GameSyncRecord,
  incoming: Partial<Record<SyncFieldName, unknown>>,
  fields: SyncFieldName[],
  resolution: ConflictResolution,
): {
  data: Prisma.GameUpdateInput;
  clearedManualFields: SyncFieldName[];
} {
  const data: Prisma.GameUpdateInput = {};
  const clearedManualFields: SyncFieldName[] = [];
  const manual = new Set(existing.manuallyEditedFields);

  for (const field of fields) {
    if (!(field in incoming)) continue;
    const incomingVal = incoming[field];
    const currentVal = existing[field];
    const isManual = manual.has(field);
    const differs = valuesDiffer(currentVal, incomingVal);

    if (isManual && differs && resolution === "keepManual") {
      continue;
    }

    if (isManual && differs && resolution === "overwriteAll") {
      clearedManualFields.push(field);
    }

    (data as Record<string, unknown>)[field] = incomingVal;
  }

  if (clearedManualFields.length > 0) {
    const nextManual = existing.manuallyEditedFields.filter(
      (f) => !clearedManualFields.includes(f as SyncFieldName),
    );
    data.manuallyEditedFields = nextManual;
  }

  return { data, clearedManualFields };
}

export function formatFieldValue(value: unknown): string {
  if (value == null) return "—";
  if (Array.isArray(value)) {
    if (value.length === 0) return "(leer)";
    return value.join(", ");
  }
  if (typeof value === "boolean") return value ? "Ja" : "Nein";
  if (typeof value === "string" && value.length > 80) {
    return `${value.slice(0, 80)}…`;
  }
  return String(value);
}

export const SYNC_FIELD_LABELS: Record<SyncFieldName, string> = {
  name: "Name",
  year: "Jahr",
  minPlayers: "Min. Spieler",
  maxPlayers: "Max. Spieler",
  playingTime: "Spielzeit",
  minPlaytime: "Min. Spielzeit",
  maxPlaytime: "Max. Spielzeit",
  weight: "Gewicht",
  bggRating: "BGG-Rating",
  rank: "Rang",
  ageRange: "Alter",
  languageDependence: "Sprachabhängigkeit",
  isExpansion: "Erweiterung",
  bestPlayerCounts: "Beste Spielerzahl",
  recommendedPlayerCounts: "Empfohlene Spielerzahl",
  description: "Beschreibung",
  image: "Cover-Bild",
  thumbnail: "Thumbnail",
  categories: "Kategorien",
  mechanics: "Mechaniken",
  expandsGameIds: "Erweitert Spiele",
  enriched: "Angereichert",
};
