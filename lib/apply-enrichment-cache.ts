import { prisma } from "@/lib/prisma";
import {
  loadEnrichmentCache,
  thingDetailsToDbFields,
} from "@/lib/enrichment-cache";
import {
  applyBaseGameCleanup,
  buildResolvableUpdate,
  diffGameFields,
  ENRICHMENT_SYNC_FIELDS,
  type ConflictResolution,
  type FieldResolutionMap,
  type GameSyncConflict,
} from "@/lib/game-sync";

const gameSelect = {
  id: true,
  name: true,
  isExpansion: true,
  description: true,
  image: true,
  thumbnail: true,
  categories: true,
  mechanics: true,
  expandsGameIds: true,
  enriched: true,
  manuallyEditedFields: true,
} as const;

export async function previewEnrichmentCacheConflicts(): Promise<{
  cacheSize: number;
  conflicts: GameSyncConflict[];
  wouldUpdate: number;
  skipped: number;
}> {
  const cache = loadEnrichmentCache();
  if (cache.size === 0) {
    return { cacheSize: 0, conflicts: [], wouldUpdate: 0, skipped: 0 };
  }

  const conflicts: GameSyncConflict[] = [];
  let wouldUpdate = 0;
  let skipped = 0;

  for (const [id, details] of cache) {
    const existing = await prisma.game.findUnique({
      where: { id },
      select: gameSelect,
    });
    if (!existing) {
      skipped += 1;
      continue;
    }

    const incoming = thingDetailsToDbFields(details);
    const fieldConflicts = diffGameFields(existing, incoming, ENRICHMENT_SYNC_FIELDS);
    if (fieldConflicts.length > 0) {
      conflicts.push({
        gameId: id,
        name: existing.name,
        conflicts: fieldConflicts,
      });
    }
    wouldUpdate += 1;
  }

  return { cacheSize: cache.size, conflicts, wouldUpdate, skipped };
}

export async function applyEnrichmentCacheToDb(
  resolution: ConflictResolution = "overwriteAll",
  fieldResolutions?: FieldResolutionMap,
): Promise<{
  cacheSize: number;
  updated: number;
  skipped: number;
  conflictsSkipped: number;
}> {
  const cache = loadEnrichmentCache();
  if (cache.size === 0) {
    return { cacheSize: 0, updated: 0, skipped: 0, conflictsSkipped: 0 };
  }

  let updated = 0;
  let skipped = 0;
  let conflictsSkipped = 0;

  for (const [id, details] of cache) {
    const existing = await prisma.game.findUnique({
      where: { id },
      select: gameSelect,
    });
    if (!existing) {
      skipped += 1;
      continue;
    }

    const incoming = thingDetailsToDbFields(details);
    const fieldConflicts = diffGameFields(existing, incoming, ENRICHMENT_SYNC_FIELDS);

    if (fieldResolutions) {
      for (const c of fieldConflicts) {
        const choice = fieldResolutions[id]?.[c.field];
        if (choice === "keep") conflictsSkipped += 1;
      }
    } else if (fieldConflicts.length > 0 && resolution === "keepManual") {
      conflictsSkipped += fieldConflicts.length;
    }

    const { data } = buildResolvableUpdate(
      existing,
      incoming,
      ENRICHMENT_SYNC_FIELDS,
      resolution,
      { gameId: id, fieldResolutions },
    );

    const updateData = applyBaseGameCleanup(existing, data);

    if (Object.keys(updateData).length === 0) continue;

    await prisma.game.update({ where: { id }, data: updateData });
    updated += 1;
  }

  return { cacheSize: cache.size, updated, skipped, conflictsSkipped };
}
