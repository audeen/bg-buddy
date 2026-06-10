import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  applyEnrichmentCacheToDb,
  previewEnrichmentCacheConflicts,
} from "@/lib/apply-enrichment-cache";
import { enrichmentCacheEntryCount } from "@/lib/enrichment-cache";
import {
  parseConflictResolution,
  parseFieldResolutionMap,
  type ConflictResolution,
} from "@/lib/game-sync";

export const dynamic = "force-dynamic";

function parseResolution(body: unknown): ConflictResolution {
  if (body && typeof body === "object" && "conflictResolution" in body) {
    return parseConflictResolution(
      (body as { conflictResolution?: string }).conflictResolution,
    );
  }
  return "keepManual";
}

function parseFieldResolutionsFromBody(body: unknown) {
  if (body && typeof body === "object" && "fieldResolutions" in body) {
    return parseFieldResolutionMap(
      (body as { fieldResolutions?: unknown }).fieldResolutions,
    );
  }
  return null;
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const url = new URL(request.url);
  if (url.searchParams.get("preview") !== "1") {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  const cacheEntries = enrichmentCacheEntryCount();
  if (cacheEntries === 0) {
    return NextResponse.json(
      {
        error:
          "Keine data/bgg-enrichment.json auf dem Server (Deploy prüfen oder Datei fehlt).",
      },
      { status: 404 },
    );
  }

  const preview = await previewEnrichmentCacheConflicts();
  return NextResponse.json({ ...preview, cacheEntries });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const url = new URL(request.url);
  if (url.searchParams.get("preview") === "1") {
    const cacheEntries = enrichmentCacheEntryCount();
    if (cacheEntries === 0) {
      return NextResponse.json(
        {
          error:
            "Keine data/bgg-enrichment.json auf dem Server (Deploy prüfen oder Datei fehlt).",
        },
        { status: 404 },
      );
    }
    const preview = await previewEnrichmentCacheConflicts();
    return NextResponse.json({ ...preview, cacheEntries });
  }

  const cacheEntries = enrichmentCacheEntryCount();
  if (cacheEntries === 0) {
    return NextResponse.json(
      {
        error:
          "Keine data/bgg-enrichment.json auf dem Server (Deploy prüfen oder Datei fehlt).",
      },
      { status: 404 },
    );
  }

  let resolution: ConflictResolution = "overwriteAll";
  let fieldResolutions = null;
  try {
    const body = await request.json();
    resolution = parseResolution(body);
    fieldResolutions = parseFieldResolutionsFromBody(body);
  } catch {
    resolution = "overwriteAll";
  }

  const result = await applyEnrichmentCacheToDb(
    fieldResolutions ? "keepManual" : resolution,
    fieldResolutions ?? undefined,
  );

  revalidatePath("/games");
  revalidatePath("/admin/import");
  revalidatePath("/admin/collection");

  const [total, enriched] = await Promise.all([
    prisma.game.count(),
    prisma.game.count({ where: { enriched: true } }),
  ]);

  return NextResponse.json({
    ...result,
    total,
    enriched,
  });
}
