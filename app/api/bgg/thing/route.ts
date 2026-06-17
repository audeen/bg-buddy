import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { bggClient } from "@/lib/bgg/client";
import type { BggHotItem } from "@/lib/bgg";
import { thingDetailsToGameDetailData } from "@/lib/bgg/hotness";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  let body: {
    id?: unknown;
    name?: unknown;
    year?: unknown;
    thumbnail?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  const id =
    typeof body.id === "number"
      ? body.id
      : typeof body.id === "string"
        ? Number.parseInt(body.id, 10)
        : NaN;
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json(
      { error: "Ungültige Spiel-ID." },
      { status: 400 },
    );
  }

  // Fallback-Werte aus der Hotness-Liste, falls die thing-API einzelne
  // Felder nicht liefert.
  const fallback: BggHotItem = {
    bggId: id,
    rank: 0,
    name: typeof body.name === "string" ? body.name : "",
    year: typeof body.year === "number" ? body.year : null,
    thumbnail: typeof body.thumbnail === "string" ? body.thumbnail : null,
  };

  let details;
  try {
    [details] = await bggClient.getThings([id]);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "BGG-Abruf fehlgeschlagen.",
      },
      { status: 502 },
    );
  }

  if (!details) {
    return NextResponse.json(
      { error: "Spiel nicht gefunden." },
      { status: 404 },
    );
  }

  return NextResponse.json({ game: thingDetailsToGameDetailData(details, fallback) });
}
