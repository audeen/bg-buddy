"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { parseCollectionCsv } from "@/lib/bgg";
import { applyCsvImport, previewCsvImport } from "@/lib/csv-import";
import { loadGameMetadata, upsertGameRecord } from "@/lib/upsert-game";
import {
  parseConflictResolution,
  parseFieldResolutionMap,
} from "@/lib/game-sync";
import {
  normalizeBarcode,
  revalidateCollectionPaths,
} from "@/app/actions/shared";

export async function importCsvPreviewAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Bitte zuerst anmelden." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Keine Datei ausgewählt." };
  }

  const text = await file.text();
  const games = parseCollectionCsv(text);
  if (games.length === 0) {
    return { error: "Keine Spiele in der CSV gefunden. Ist es ein BGG-Export?" };
  }

  const preview = await previewCsvImport(games);
  const expansions = games.filter((g) => g.isExpansion).length;

  return {
    ok: true,
    total: games.length,
    standalone: games.length - expansions,
    expansions,
    ...preview,
  };
}

export async function importCsvAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Bitte zuerst anmelden." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Keine Datei ausgewählt." };
  }

  const resolution = parseConflictResolution(
    String(formData.get("conflictResolution") ?? ""),
  );

  let fieldResolutions = null;
  const fieldResolutionsRaw = String(formData.get("fieldResolutions") ?? "").trim();
  if (fieldResolutionsRaw) {
    try {
      fieldResolutions = parseFieldResolutionMap(JSON.parse(fieldResolutionsRaw));
    } catch {
      return { error: "Ungültige Feld-Auswahl." };
    }
  }

  const text = await file.text();
  const games = parseCollectionCsv(text);
  if (games.length === 0) {
    return { error: "Keine Spiele in der CSV gefunden. Ist es ein BGG-Export?" };
  }

  await applyCsvImport(games, resolution, fieldResolutions ?? undefined);

  const expansions = games.filter((g) => g.isExpansion).length;
  revalidateCollectionPaths();
  return {
    ok: true,
    total: games.length,
    standalone: games.length - expansions,
    expansions,
  };
}

type GameMetadataInput = {
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
  description: string | null;
  image: string | null;
  thumbnail: string | null;
  categories: string[];
  mechanics: string[];
  expandsGameIds: number[];
};

function parseOptionalInt(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = parseInt(String(value).trim(), 10);
  return Number.isFinite(n) ? n : null;
}

function parseOptionalFloat(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = parseFloat(String(value).trim());
  return Number.isFinite(n) ? n : null;
}

function parseIntList(value: unknown): number[] {
  if (!value) return [];
  const raw = String(value)
    .split(/[,;\s]+/)
    .map((t) => parseInt(t.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  return [...new Set(raw)].sort((a, b) => a - b);
}

function parseStringList(value: unknown): string[] {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseGameMetadataForm(formData: FormData): GameMetadataInput | { error: string } {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name ist erforderlich." };

  const isExpansion = formData.get("isExpansion") === "on";

  return {
    name,
    year: parseOptionalInt(formData.get("year")),
    minPlayers: parseOptionalInt(formData.get("minPlayers")),
    maxPlayers: parseOptionalInt(formData.get("maxPlayers")),
    playingTime: parseOptionalInt(formData.get("playingTime")),
    minPlaytime: parseOptionalInt(formData.get("minPlaytime")),
    maxPlaytime: parseOptionalInt(formData.get("maxPlaytime")),
    weight: parseOptionalFloat(formData.get("weight")),
    bggRating: parseOptionalFloat(formData.get("bggRating")),
    rank: parseOptionalInt(formData.get("rank")),
    ageRange: String(formData.get("ageRange") ?? "").trim() || null,
    languageDependence:
      String(formData.get("languageDependence") ?? "").trim() || null,
    isExpansion,
    bestPlayerCounts: parseIntList(formData.get("bestPlayerCounts")),
    recommendedPlayerCounts: parseIntList(formData.get("recommendedPlayerCounts")),
    description: String(formData.get("description") ?? "").trim() || null,
    image: String(formData.get("image") ?? "").trim() || null,
    thumbnail: String(formData.get("thumbnail") ?? "").trim() || null,
    categories: parseStringList(formData.get("categories")),
    mechanics: parseStringList(formData.get("mechanics")),
    expandsGameIds: isExpansion
      ? parseIntList(formData.get("expandsGameIds"))
      : [],
  };
}

const EDITABLE_FIELDS = [
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
  "description",
  "image",
  "thumbnail",
  "categories",
  "mechanics",
  "expandsGameIds",
] as const;

export async function updateGameMetadataAction(gameId: number, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Bitte zuerst anmelden." };

  if (!Number.isFinite(gameId)) {
    return { error: "Ungültige Spiel-ID." };
  }

  const parsed = parseGameMetadataForm(formData);
  if ("error" in parsed) return parsed;

  const existing = await prisma.game.findUnique({
    where: { id: gameId },
    select: {
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
      manuallyEditedFields: true,
    },
  });

  if (!existing) return { error: "Spiel nicht gefunden." };

  const changedFields: string[] = [];
  for (const field of EDITABLE_FIELDS) {
    const next = parsed[field];
    const prev = existing[field];
    if (JSON.stringify(next) !== JSON.stringify(prev)) {
      changedFields.push(field);
    }
  }

  const manuallyEditedFields = [
    ...new Set([...existing.manuallyEditedFields, ...changedFields]),
  ];

  await prisma.game.update({
    where: { id: gameId },
    data: {
      ...parsed,
      manuallyEditedFields,
      enriched:
        !!(
          parsed.description ||
          parsed.image ||
          parsed.thumbnail ||
          parsed.categories.length > 0 ||
          parsed.mechanics.length > 0
        ),
    },
  });

  revalidateCollectionPaths(gameId);
  revalidatePath(`/admin/collection/${gameId}`);

  return { ok: true, changedFields };
}

export type AddGameActionResult =
  | { ok: true; name: string; bggId: number; created?: boolean; alreadyExists?: boolean }
  | { error: string };

export async function addGameByBggIdAction(
  bggId: number,
  options?: { barcode?: string | null; name?: string | null },
): Promise<AddGameActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Bitte zuerst anmelden." };

  if (!Number.isFinite(bggId) || bggId <= 0) {
    return { error: "Ungültige BGG-ID." };
  }

  const normalizedBarcode = normalizeBarcode(options?.barcode);

  const existing = await prisma.game.findUnique({
    where: { id: bggId },
    select: { id: true, name: true, listedInCollection: true, barcode: true },
  });
  if (existing?.listedInCollection) {
    return {
      ok: true as const,
      alreadyExists: true,
      name: existing.name,
      bggId: existing.id,
    };
  }

  if (normalizedBarcode) {
    const barcodeTaken = await prisma.game.findUnique({
      where: { barcode: normalizedBarcode },
      select: { id: true, name: true },
    });
    if (barcodeTaken && barcodeTaken.id !== bggId) {
      return {
        error: `Barcode ist bereits „${barcodeTaken.name}" zugeordnet (BGG ${barcodeTaken.id}).`,
      };
    }
  }

  if (existing) {
    // Spiel existiert nur als Gast-Spiel-Eintrag — wieder in die Sammlung aufnehmen.
    await prisma.game.update({
      where: { id: bggId },
      data: {
        listedInCollection: true,
        ...(normalizedBarcode ? { barcode: normalizedBarcode } : {}),
      },
    });

    revalidateCollectionPaths(bggId);

    return { ok: true as const, created: true, name: existing.name, bggId };
  }

  let base, enrichment;
  try {
    ({ base, enrichment } = await loadGameMetadata(bggId));
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "BGG-Abruf fehlgeschlagen.",
    };
  }

  const { created, name } = await upsertGameRecord(
    {
      ...base,
      bggId,
      name: options?.name?.trim() || base.name,
      barcode: normalizedBarcode,
    },
    enrichment,
  );

  revalidateCollectionPaths(bggId);

  return { ok: true as const, created, name, bggId };
}

export async function setGameLentOutAction(gameId: number, lentOut: boolean) {
  const user = await getCurrentUser();
  if (!user) return { error: "Bitte zuerst anmelden." };

  if (!Number.isFinite(gameId)) {
    return { error: "Ungültige Spiel-ID." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.game.update({
        where: { id: gameId },
        data: { lentOut },
      });
      if (lentOut) {
        await tx.vote.deleteMany({
          where: { gameId, mode: "PICK" },
        });
      }
    });
  } catch {
    return { error: "Spiel nicht gefunden." };
  }

  revalidateCollectionPaths(gameId);

  return { ok: true };
}

export async function removeGameFromCollectionAction(gameId: number) {
  const user = await getCurrentUser();
  if (!user) return { error: "Bitte zuerst anmelden." };

  if (!Number.isFinite(gameId)) {
    return { error: "Ungültige Spiel-ID." };
  }

  try {
    await prisma.game.delete({ where: { id: gameId } });
  } catch {
    return { error: "Spiel nicht gefunden." };
  }

  revalidateCollectionPaths(gameId);

  return { ok: true };
}

export async function purgeCollectionAction() {
  const user = await getCurrentUser();
  if (!user) return { error: "Bitte zuerst anmelden." };

  const deleted = await prisma.$transaction(async (tx) => {
    const count = await tx.game.count();
    if (count === 0) return 0;

    await tx.game.deleteMany({});
    await tx.meetup.updateMany({
      data: { duelFrozenAt: null, duelFrozenData: Prisma.DbNull },
    });
    return count;
  });

  revalidateCollectionPaths();

  return { ok: true, deleted };
}
