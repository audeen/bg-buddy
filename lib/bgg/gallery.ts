/**
 * Zugriff auf die öffentliche Geekdo-Bilder-API (Galerie eines Spiels).
 * Kein Token nötig; Antworten werden über den Next-Data-Cache gehalten.
 */

export type BggGalleryImage = {
  id: string;
  /** Kleines Vorschaubild (~400x300, Retina-Variante). */
  thumb: string;
  /** Große Variante (fit-in 1024x1024). */
  large: string;
  caption: string | null;
  /** Pfad zur Bildseite auf BGG (z. B. /image/123/catan). */
  href: string | null;
};

export type BggGalleryPage = {
  images: BggGalleryImage[];
  total: number;
  hasMore: boolean;
};

export type BggGalleryTag =
  | "BoxFront"
  | "BoxBack"
  | "Components"
  | "Customized"
  | "Play"
  | "Miscellaneous";

export type FetchGalleryOptions = {
  page?: number;
  perPage?: number;
  /** Kategorie-Filter der Geekdo-Galerie (z. B. "BoxFront"). */
  tag?: BggGalleryTag;
};

type RawGalleryImage = {
  imageid?: string | number;
  imageurl?: string;
  "imageurl@2x"?: string;
  imageurl_lg?: string;
  caption?: string;
  href?: string;
};

type RawGalleryResponse = {
  images?: RawGalleryImage[];
  pagination?: { perPage?: number; pageid?: number; total?: number };
};

export const GALLERY_PAGE_SIZE = 15;

/** Normalisiert die Geekdo-API-Antwort zu einer Galerie-Seite. */
export function parseGalleryResponse(
  raw: unknown,
  page: number,
  perPage: number,
): BggGalleryPage {
  const data = (raw ?? {}) as RawGalleryResponse;
  const rawImages = Array.isArray(data.images) ? data.images : [];

  const images: BggGalleryImage[] = [];
  for (const img of rawImages) {
    const large = img.imageurl_lg ?? img["imageurl@2x"] ?? img.imageurl;
    const thumb = img["imageurl@2x"] ?? img.imageurl ?? img.imageurl_lg;
    if (!large || !thumb || img.imageid == null) continue;
    images.push({
      id: String(img.imageid),
      thumb,
      large,
      caption: img.caption?.trim() || null,
      href: img.href ?? null,
    });
  }

  const total = data.pagination?.total ?? images.length;
  return {
    images,
    total,
    hasMore: page * perPage < total,
  };
}

export function buildGalleryUrl(
  bggId: number,
  options: FetchGalleryOptions = {},
): string {
  const { page = 1, perPage = GALLERY_PAGE_SIZE, tag } = options;
  const params = new URLSearchParams({
    ajax: "1",
    foritempage: "1",
    nosession: "1",
    objectid: String(bggId),
    objecttype: "thing",
    pageid: String(page),
    showcount: String(perPage),
    size: "thumb",
    sort: "hot",
  });
  // Nur Spiel-Fotos (keine People/Creative-Galerien).
  params.append("galleries[]", "game");
  if (tag) params.set("tag", tag);
  return `https://api.geekdo.com/api/images?${params.toString()}`;
}

/** Lädt eine Galerie-Seite für ein Spiel (gecacht für 24 h). */
export async function fetchGameGallery(
  bggId: number,
  options: FetchGalleryOptions = {},
): Promise<BggGalleryPage> {
  const { page = 1, perPage = GALLERY_PAGE_SIZE } = options;
  const res = await fetch(buildGalleryUrl(bggId, options), {
    headers: { Accept: "application/json" },
    next: { revalidate: 86400 },
  });
  if (!res.ok) {
    throw new Error(`Geekdo-Bilder-API antwortete mit HTTP ${res.status}`);
  }
  const raw = (await res.json()) as unknown;
  return parseGalleryResponse(raw, page, perPage);
}
