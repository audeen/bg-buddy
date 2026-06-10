import type { Prisma } from "@prisma/client";
import type { ParsedGame } from "@/lib/bgg";
import { prisma } from "@/lib/prisma";
import {
  applyBaseGameCleanup,
  buildResolvableUpdate,
  CSV_SYNC_FIELDS,
  diffGameFields,
  parsedGameToCsvFields,
  type ConflictResolution,
  type FieldResolutionMap,
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
}> {
  const conflicts: GameSyncConflict[] = [];
  let wouldCreate = 0;
  let wouldUpdate = 0;

  for (const g of games) {
    const existing = await prisma.game.findUnique({
      where: { id: g.id },
      select: existingSelect,
    });

    if (!existing) {
      wouldCreate += 1;
      continue;
    }

    wouldUpdate += 1;
    const csvIncoming = parsedGameToCsvFields(g);
    const csvConflicts = diffGameFields(existing, csvIncoming, CSV_SYNC_FIELDS);

    if (csvConflicts.length > 0) {
      conflicts.push({
        gameId: g.id,
        name: existing.name,
        conflicts: csvConflicts,
      });
    }
  }

  return { conflicts, wouldCreate, wouldUpdate };
}

export async function applyCsvImport(
  games: ParsedGame[],
  resolution: ConflictResolution = "keepManual",
  fieldResolutions?: FieldResolutionMap,
): Promise<void> {
  for (const g of games) {
    const existing = await prisma.game.findUnique({
      where: { id: g.id },
      select: existingSelect,
    });

    if (!existing) {
      // Beschreibung/Cover/Kategorien kommen später über den Enrich-Lauf
      // (BGG-XML-API), deshalb startet das Spiel als nicht angereichert.
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
          barcode: g.barcode,
          enriched: false,
          description: null,
          image: null,
          thumbnail: null,
          categories: [],
          mechanics: [],
          expandsGameIds: [],
        },
      });
      continue;
    }

    const csvIncoming = parsedGameToCsvFields(g);
    const { data: csvData } = buildResolvableUpdate(
      existing,
      csvIncoming,
      CSV_SYNC_FIELDS,
      resolution,
      { gameId: g.id, fieldResolutions },
    );

    const updateData: Prisma.GameUpdateInput = applyBaseGameCleanup(
      existing,
      csvData,
    );

    if (Object.keys(updateData).length > 0) {
      await prisma.game.update({ where: { id: g.id }, data: updateData });
    }
  }
}
