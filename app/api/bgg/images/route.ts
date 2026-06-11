import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  fetchGameGallery,
  type BggGalleryTag,
} from "@/lib/bgg/gallery";

export const dynamic = "force-dynamic";

const VALID_TAGS = new Set<string>([
  "BoxFront",
  "BoxBack",
  "Components",
  "Customized",
  "Play",
  "Miscellaneous",
]);

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

  const pageRaw = parseInt(searchParams.get("page") ?? "1", 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;

  const tagRaw = searchParams.get("tag");
  const tag =
    tagRaw && VALID_TAGS.has(tagRaw) ? (tagRaw as BggGalleryTag) : undefined;

  try {
    const gallery = await fetchGameGallery(gameId, { page, tag });
    return NextResponse.json(gallery, {
      headers: { "Cache-Control": "private, max-age=3600" },
    });
  } catch {
    return NextResponse.json(
      { error: "Galerie konnte nicht geladen werden." },
      { status: 502 },
    );
  }
}
