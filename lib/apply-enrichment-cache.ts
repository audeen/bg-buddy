import { prisma } from "@/lib/prisma";
import { loadEnrichmentCache } from "@/lib/enrichment-cache";
import {
  buildResolvableUpdate,
  diffGameFields,
  ENRICHMENT_SYNC_FIELDS,
  thingDetailsToEnrichmentFields,
  type ConflictResolution,
  type GameSyncConflict,
} from "@/lib/game-sync";

const gameSelect = {
  id: true,
  name: true,
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

    const incoming = thingDetailsToEnrichmentFields(details);
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

    const incoming = thingDetailsToEnrichmentFields(details);
    const fieldConflicts = diffGameFields(existing, incoming, ENRICHMENT_SYNC_FIELDS);
    if (fieldConflicts.length > 0 && resolution === "keepManual") {
      conflictsSkipped += fieldConflicts.length;
    }

    const { data } = buildResolvableUpdate(
      existing,
      incoming,
      ENRICHMENT_SYNC_FIELDS,
      resolution,
    );

    if (Object.keys(data).length === 0) continue;

    await prisma.game.update({ where: { id }, data });
    updated += 1;
  }

  return { cacheSize: cache.size, updated, skipped, conflictsSkipped };
}
