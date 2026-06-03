import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { fetchThingBatch } from "@/lib/bgg";

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

export async function GET() {
  return NextResponse.json(await status());
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
    details = await fetchThingBatch(ids);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "BGG-Abruf fehlgeschlagen." },
      { status: 502 },
    );
  }

  const byId = new Map(details.map((d) => [d.id, d]));

  for (const id of ids) {
    const d = byId.get(id);
    await prisma.game.update({
      where: { id },
      data: {
        description: d?.description ?? null,
        image: d?.image ?? null,
        thumbnail: d?.thumbnail ?? null,
        categories: d?.categories ?? [],
        mechanics: d?.mechanics ?? [],
        enriched: true,
      },
    });
  }

  const s = await status();
  return NextResponse.json({
    processed: ids.length,
    ...s,
    done: s.remaining === 0,
  });
}
