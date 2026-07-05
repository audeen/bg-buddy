import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { fetchBggNameOptions } from "@/lib/bgg";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const gameId = parseInt(searchParams.get("gameId") ?? "", 10);
  if (!Number.isFinite(gameId) || gameId <= 0) {
    return NextResponse.json({ error: "Ungültige gameId." }, { status: 400 });
  }

  try {
    const names = await fetchBggNameOptions(gameId, { revalidate: 86400 });
    return NextResponse.json(
      { names },
      { headers: { "Cache-Control": "private, max-age=86400" } },
    );
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "BGG-Namen konnten nicht geladen werden.",
      },
      { status: 502 },
    );
  }
}
