import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { bggClient } from "@/lib/bgg/client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH_SIZE = 20;

async function status() {
  const [total, enriched] = await Promise.all([
    prisma.game.count(),
    prisma.game.count({ where: { enriched: true } }),
  ]);
  return { total, enriched, remaining: total - enriched };
}

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const pending = await prisma.game.findMany({
    where: { enriched: false },
    select: { id: true },
    take: BATCH_SIZE,
    orderBy: { id: "asc" },
  });

  if (pending.length === 0) {
    return NextResponse.json({ processed: 0, ...(await status()), done: true });
  }

  const ids = pending.map((g) => g.id);

  let details;
  try {
    details = await bggClient.getThings(ids);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "BGG-Abruf fehlgeschlagen." },
      { status: 502 },
    );
  }

  const byId = new Map(details.map((d) => [d.id, d]));

  for (const id of ids) {
    const d = byId.get(id);
    // Liefert BGG keine Daten, nur als abgearbeitet markieren statt
    // vorhandene Felder mit null zu überschreiben.
    await prisma.game.update({
      where: { id },
      data: d
        ? {
            description: d.description ?? null,
            image: d.image ?? null,
            thumbnail: d.thumbnail ?? null,
            categories: d.categories,
            mechanics: d.mechanics,
            // Stammdaten aus den BGG-Polls nur setzen, wenn vorhanden.
            ...(d.rank != null ? { rank: d.rank } : {}),
            ...(d.ageRange ? { ageRange: d.ageRange } : {}),
            ...(d.languageDependence
              ? { languageDependence: d.languageDependence }
              : {}),
            ...(d.bestPlayerCounts?.length
              ? { bestPlayerCounts: d.bestPlayerCounts }
              : {}),
            ...(d.recommendedPlayerCounts?.length
              ? { recommendedPlayerCounts: d.recommendedPlayerCounts }
              : {}),
            enriched: true,
          }
        : { enriched: true },
    });
  }

  const s = await status();
  return NextResponse.json({
    processed: ids.length,
    ...s,
    done: s.remaining === 0,
  });
}
