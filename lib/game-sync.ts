import type { Prisma } from "@prisma/client";
import type { ParsedGame } from "@/lib/bgg";

export type ConflictResolution = "keepManual" | "overwriteAll";
export type FieldChoice = "keep" | "overwrite";

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

/** Fields that only apply when isExpansion is true. */
export const EXPANSION_DEPENDENT_FIELDS: SyncFieldName[] = [
  "expandsGameIds",
  "description",
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

export type FieldResolutionMap = Record<
  number,
  Partial<Record<SyncFieldName, FieldChoice>>
>;

export function fieldChoiceKey(gameId: number, field: SyncFieldName): string {
  return `${gameId}:${field}`;
}

export function defaultChoicesFromConflicts(
  conflicts: GameSyncConflict[],
): Record<string, FieldChoice> {
  const choices: Record<string, FieldChoice> = {};
  for (const game of conflicts) {
    for (const c of game.conflicts) {
      choices[fieldChoiceKey(game.gameId, c.field)] = "keep";
    }
  }
  return choices;
}

export function choicesToFieldResolutionMap(
  conflicts: GameSyncConflict[],
  choices: Record<string, FieldChoice>,
  autoChoices: Record<string, FieldChoice> = {},
): FieldResolutionMap {
  const map: FieldResolutionMap = {};
  const merged = { ...choices, ...autoChoices };

  for (const game of conflicts) {
    for (const c of game.conflicts) {
      const key = fieldChoiceKey(game.gameId, c.field);
      const choice = merged[key] ?? "keep";
      if (!map[game.gameId]) map[game.gameId] = {};
      map[game.gameId]![c.field] = choice;
    }
  }

  for (const [key, choice] of Object.entries(autoChoices)) {
    const [gameIdRaw, field] = key.split(":");
    const gameId = parseInt(gameIdRaw, 10);
    if (!Number.isFinite(gameId) || !field) continue;
    if (!map[gameId]) map[gameId] = {};
    map[gameId]![field as SyncFieldName] = choice;
  }

  return map;
}

export function parseFieldResolutionMap(raw: unknown): FieldResolutionMap | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const map: FieldResolutionMap = {};
  for (const [gameIdKey, fields] of Object.entries(raw as Record<string, unknown>)) {
    const gameId = parseInt(gameIdKey, 10);
    if (!Number.isFinite(gameId) || fields == null || typeof fields !== "object") {
      continue;
    }
    const entry: Partial<Record<SyncFieldName, FieldChoice>> = {};
    for (const [field, choice] of Object.entries(fields as Record<string, unknown>)) {
      if (choice === "keep" || choice === "overwrite") {
        entry[field as SyncFieldName] = choice;
      }
    }
    if (Object.keys(entry).length > 0) map[gameId] = entry;
  }
  return Object.keys(map).length > 0 ? map : null;
}

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

export function effectiveIsExpansion(
  game: GameSyncConflict,
  choices: Record<string, FieldChoice>,
): boolean {
  const expansionConflict = game.conflicts.find((c) => c.field === "isExpansion");
  if (!expansionConflict) {
    return true;
  }
  const key = fieldChoiceKey(game.gameId, "isExpansion");
  const choice = choices[key] ?? "keep";
  if (choice === "keep") {
    return expansionConflict.current === true;
  }
  return expansionConflict.incoming === true;
}

export function applyExpansionCascade(
  conflicts: GameSyncConflict[],
  choices: Record<string, FieldChoice>,
): {
  visible: GameSyncConflict[];
  autoChoices: Record<string, FieldChoice>;
  cascadedCount: number;
} {
  const autoChoices: Record<string, FieldChoice> = {};
  let cascadedCount = 0;

  const visible = conflicts
    .map((game) => {
      if (effectiveIsExpansion(game, choices)) {
        return game;
      }

      const filtered = game.conflicts.filter((c) => {
        if (c.field === "isExpansion") return true;
        if (!EXPANSION_DEPENDENT_FIELDS.includes(c.field)) return true;

        autoChoices[fieldChoiceKey(game.gameId, c.field)] = "keep";
        cascadedCount += 1;
        return false;
      });

      return { ...game, conflicts: filtered };
    })
    .filter((g) => g.conflicts.length > 0);

  return { visible, autoChoices, cascadedCount };
}

/** Merge UI choices (incl. cascade) into a field resolution map for apply. */
export function buildFieldResolutionsFromChoices(
  conflicts: GameSyncConflict[],
  choices: Record<string, FieldChoice>,
): FieldResolutionMap {
  const { autoChoices } = applyExpansionCascade(conflicts, choices);
  return choicesToFieldResolutionMap(conflicts, choices, autoChoices);
}

function resolveFieldChoice(
  gameId: number,
  field: SyncFieldName,
  fieldResolutions: FieldResolutionMap | undefined,
  fallback: ConflictResolution,
): FieldChoice | ConflictResolution {
  const perField = fieldResolutions?.[gameId]?.[field];
  if (perField) return perField;
  return fallback;
}

export function buildResolvableUpdate(
  existing: GameSyncRecord,
  incoming: Partial<Record<SyncFieldName, unknown>>,
  fields: SyncFieldName[],
  resolution: ConflictResolution = "keepManual",
  options?: {
    gameId?: number;
    fieldResolutions?: FieldResolutionMap;
  },
): {
  data: Prisma.GameUpdateInput;
  clearedManualFields: SyncFieldName[];
} {
  const data: Prisma.GameUpdateInput = {};
  const clearedManualFields: SyncFieldName[] = [];
  const manual = new Set(existing.manuallyEditedFields);
  const gameId = options?.gameId;
  const fieldResolutions = options?.fieldResolutions;

  for (const field of fields) {
    if (!(field in incoming)) continue;
    const incomingVal = incoming[field];
    const currentVal = existing[field];
    const isManual = manual.has(field);
    const differs = valuesDiffer(currentVal, incomingVal);

    const choice = gameId != null
      ? resolveFieldChoice(gameId, field, fieldResolutions, resolution)
      : resolution;

    if (isManual && differs) {
      if (choice === "keep" || choice === "keepManual") {
        continue;
      }
      if (choice === "overwrite" || choice === "overwriteAll") {
        clearedManualFields.push(field);
      }
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

export function applyBaseGameCleanup(
  existing: GameSyncRecord,
  updateData: Prisma.GameUpdateInput,
): Prisma.GameUpdateInput {
  const isExpansion =
    "isExpansion" in updateData
      ? updateData.isExpansion === true
      : existing.isExpansion === true;

  if (!isExpansion) {
    return { ...updateData, expandsGameIds: [] };
  }
  return updateData;
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
