import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { applyEnrichmentCacheToDb } from "@/lib/apply-enrichment-cache";
import { enrichmentCacheEntryCount } from "@/lib/enrichment-cache";

export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
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

  const result = await applyEnrichmentCacheToDb();

  revalidatePath("/games");
  revalidatePath("/admin/import");

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
