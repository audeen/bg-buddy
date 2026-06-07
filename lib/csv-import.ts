import type { Prisma } from "@prisma/client";
import type { ParsedGame } from "@/lib/bgg";
import { prisma } from "@/lib/prisma";
import {
  loadEnrichmentCache,
  thingDetailsToDbFields,
} from "@/lib/enrichment-cache";
import {
  buildResolvableUpdate,
  CSV_SYNC_FIELDS,
  diffGameFields,
  ENRICHMENT_SYNC_FIELDS,
  parsedGameToCsvFields,
  type ConflictResolution,
  type GameSyncConflict,
} from "@/lib/game-sync";

const existingSelect = {
  id: true,
  name: true,
  year: true,
  minPlayers: true,
  maxPlayers: true,
  playingTime: true,
  minPlaytime: true,
  maxPlaytime: true,
  weight: true,
  bggRating: true,
  rank: true,
  ageRange: true,
  languageDependence: true,
  isExpansion: true,
  bestPlayerCounts: true,
  recommendedPlayerCounts: true,
  description: true,
  image: true,
  thumbnail: true,
  categories: true,
  mechanics: true,
  expandsGameIds: true,
  enriched: true,
  manuallyEditedFields: true,
} as const;

export async function previewCsvImport(games: ParsedGame[]): Promise<{
  conflicts: GameSyncConflict[];
  wouldCreate: number;
  wouldUpdate: number;
  cacheApplied: number;
}> {
  const cache = loadEnrichmentCache();
  const conflicts: GameSyncConflict[] = [];
  let wouldCreate = 0;
  let wouldUpdate = 0;
  let cacheApplied = 0;

  for (const g of games) {
    const existing = await prisma.game.findUnique({
      where: { id: g.id },
      select: existingSelect,
    });

    const csvIncoming = parsedGameToCsvFields(g);
    const cached = cache.get(g.id);
    const enrichmentIncoming = cached ? thingDetailsToDbFields(cached) : {};
    if (cached) cacheApplied += 1;

    if (!existing) {
      wouldCreate += 1;
      continue;
    }

    wouldUpdate += 1;
    const csvConflicts = diffGameFields(existing, csvIncoming, CSV_SYNC_FIELDS);
    const enrichmentConflicts = cached
      ? diffGameFields(existing, enrichmentIncoming, ENRICHMENT_SYNC_FIELDS)
      : [];
    const allConflicts = [...csvConflicts, ...enrichmentConflicts];

    if (allConflicts.length > 0) {
      conflicts.push({
        gameId: g.id,
        name: existing.name,
        conflicts: allConflicts,
      });
    }
  }

  return { conflicts, wouldCreate, wouldUpdate, cacheApplied };
}

export async function applyCsvImport(
  games: ParsedGame[],
  resolution: ConflictResolution,
): Promise<{ cacheApplied: number }> {
  const cache = loadEnrichmentCache();
  let cacheApplied = 0;

  for (const g of games) {
    const existing = await prisma.game.findUnique({
      where: { id: g.id },
      select: existingSelect,
    });

    const csvIncoming = parsedGameToCsvFields(g);
    const cached = cache.get(g.id);
    const enrichmentIncoming = cached ? thingDetailsToDbFields(cached) : {};
    if (cached) cacheApplied += 1;

    if (!existing) {
      const enrichment = cached ? thingDetailsToDbFields(cached) : null;
      await prisma.game.create({
        data: {
          id: g.id,
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
          enriched: enrichment?.enriched ?? false,
          description: enrichment?.description ?? null,
          image: enrichment?.image ?? null,
          thumbnail: enrichment?.thumbnail ?? null,
          categories: enrichment?.categories ?? [],
          mechanics: enrichment?.mechanics ?? [],
          expandsGameIds: enrichment?.expandsGameIds ?? [],
        },
      });
      continue;
    }

    const { data: csvData } = buildResolvableUpdate(
      existing,
      csvIncoming,
      CSV_SYNC_FIELDS,
      resolution,
    );
    const csvManual =
      (csvData.manuallyEditedFields as string[] | undefined) ??
      existing.manuallyEditedFields;

    let enrichmentData: Prisma.GameUpdateInput = {};
    if (cached) {
      enrichmentData = buildResolvableUpdate(
        { ...existing, manuallyEditedFields: csvManual },
        enrichmentIncoming,
        ENRICHMENT_SYNC_FIELDS,
        resolution,
      ).data;
    }

    const mergedManual =
      (enrichmentData.manuallyEditedFields as string[] | undefined) ?? csvManual;

    const updateData: Prisma.GameUpdateInput = {
      ...csvData,
      ...enrichmentData,
      manuallyEditedFields: mergedManual,
    };

    if (Object.keys(updateData).length > 0) {
      await prisma.game.update({ where: { id: g.id }, data: updateData });
    }
  }

  return { cacheApplied };
}
