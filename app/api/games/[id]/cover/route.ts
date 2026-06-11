import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Liefert das eigene hochgeladene Cover eines Spiels aus der Datenbank.
 * Die URL enthält einen Cache-Buster (?v=<updatedAt>), daher darf die
 * Antwort aggressiv gecacht werden.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const gameId = parseInt(id, 10);
  if (!Number.isFinite(gameId)) {
    return NextResponse.json({ error: "Ungültige Spiel-ID." }, { status: 400 });
  }

  const cover = await prisma.gameCoverImage.findUnique({
    where: { gameId },
  });
  if (!cover) {
    return NextResponse.json({ error: "Kein Cover vorhanden." }, { status: 404 });
  }

  return new NextResponse(Buffer.from(cover.data), {
    headers: {
      "Content-Type": cover.mimeType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
