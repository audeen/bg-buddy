import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { lookupBggByName } from "@/lib/bgg-search";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  let body: { query?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  const query = String(body.query ?? "").trim();
  if (!query) {
    return NextResponse.json({ error: "Suchbegriff fehlt." }, { status: 400 });
  }
  if (query.length < 2) {
    return NextResponse.json(
      { error: "Suchbegriff zu kurz (mindestens 2 Zeichen)." },
      { status: 400 },
    );
  }

  const result = await lookupBggByName(query);
  if (result.status === "error") {
    return NextResponse.json(result);
  }

  if (result.status === "found") {
    const existing = await prisma.game.findUnique({
      where: { id: result.bggId },
      select: { id: true, name: true, listedInCollection: true },
    });
    if (existing?.listedInCollection) {
      return NextResponse.json({
        status: "alreadyInCollection",
        query: result.query,
        bggId: existing.id,
        name: existing.name,
      });
    }
  }

  return NextResponse.json(result);
}
