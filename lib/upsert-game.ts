import type { ThingDetails } from "@/lib/bgg";
import { bggClient } from "@/lib/bgg/client";
import { thingDetailsToDbFields } from "@/lib/enrichment-cache";
import { prisma } from "@/lib/prisma";

export type SingleGameInput = {
  bggId: number;
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
  barcode?: string | null;
  listedInCollection?: boolean;
};

function thingToPartialFields(d: ThingDetails): Omit<SingleGameInput, "bggId"> {
  return {
    name: d.name ?? null,
    year: d.year ?? null,
    minPlayers: d.minPlayers ?? null,
    maxPlayers: d.maxPlayers ?? null,
    playingTime: d.playingTime ?? null,
    minPlaytime: d.minPlaytime ?? null,
    maxPlaytime: d.maxPlaytime ?? null,
    weight: d.weight ?? null,
    bggRating: d.bggRating ?? null,
    rank: d.rank ?? null,
    isExpansion: d.isExpansion ?? false,
  };
}

/** Loads metadata for a single BGG id: cache → Geekdo → BGG thing API. */
export async function loadGameMetadata(bggId: number): Promise<{
  base: SingleGameInput;
  enrichment: ReturnType<typeof thingDetailsToDbFields> | null;
}> {
  const cache = bggClient.getCachedThings();
  const cached = cache.get(bggId);
  const enrichmentFromCache = cached ? thingDetailsToDbFields(cached) : null;

  let base: SingleGameInput = { bggId, name: null };
  let enrichment: ReturnType<typeof thingDetailsToDbFields> | null =
    enrichmentFromCache;

  if (cached) {
    base = { bggId, ...thingToPartialFields(cached) };
  }

  const geekdo = await bggClient.getThingFromGeekdo(bggId);
  if (geekdo) {
    base = { ...base, bggId, ...thingToPartialFields(geekdo) };
    if (!enrichment) {
      enrichment = thingDetailsToDbFields(geekdo);
    }
  }

  try {
    const bggItems = await bggClient.getThings([bggId]);
    const bgg = bggItems[0];
    if (bgg) {
      base = { ...base, bggId, ...thingToPartialFields(bgg) };
      if (!enrichment) {
        enrichment = thingDetailsToDbFields(bgg);
      }
    }
  } catch {
    // BGG token optional
  }

  if (!base.name?.trim()) {
    base.name = `Spiel ${bggId}`;
  }

  return { base, enrichment };
}

export async function upsertGameRecord(
  input: SingleGameInput,
  enrichmentOverride?: ReturnType<typeof thingDetailsToDbFields> | null,
): Promise<{
  created: boolean;
  name: string;
}> {
  const { bggId, barcode, ...rest } = input;
  const existing = await prisma.game.findUnique({ where: { id: bggId } });
  const created = !existing;

  const cache = bggClient.getCachedThings();
  const cached = cache.get(bggId);
  const enrichment =
    enrichmentOverride ?? (cached ? thingDetailsToDbFields(cached) : null);

  const name = rest.name?.trim() || existing?.name || `Spiel ${bggId}`;

  const data = {
    name,
    year: rest.year ?? existing?.year ?? null,
    minPlayers: rest.minPlayers ?? existing?.minPlayers ?? null,
    maxPlayers: rest.maxPlayers ?? existing?.maxPlayers ?? null,
    playingTime: rest.playingTime ?? existing?.playingTime ?? null,
    minPlaytime: rest.minPlaytime ?? existing?.minPlaytime ?? null,
    maxPlaytime: rest.maxPlaytime ?? existing?.maxPlaytime ?? null,
    weight: rest.weight ?? existing?.weight ?? null,
    bggRating: rest.bggRating ?? existing?.bggRating ?? null,
    rank: rest.rank ?? existing?.rank ?? null,
    isExpansion: rest.isExpansion ?? existing?.isExpansion ?? false,
    ...(barcode ? { barcode } : {}),
    ...(enrichment ?? {}),
  };

  if (created) {
    await prisma.game.create({
      data: {
        id: bggId,
        enriched: enrichment?.enriched ?? false,
        listedInCollection: rest.listedInCollection ?? true,
        bestPlayerCounts: [],
        recommendedPlayerCounts: [],
        categories: enrichment?.categories ?? [],
        mechanics: enrichment?.mechanics ?? [],
        expandsGameIds:
          data.isExpansion ? (enrichment?.expandsGameIds ?? []) : [],
        ...data,
      },
    });
  } else {
    await prisma.game.update({
      where: { id: bggId },
      data: {
        ...data,
        ...(barcode && !existing?.barcode ? { barcode } : {}),
      },
    });
  }

  return { created, name };
}
