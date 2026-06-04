import type { ThingDetails } from "@/lib/bgg";

function stripHtml(html: string | null | undefined): string | null {
  if (html == null || html === "") return null;
  let text = String(html);
  text = text
    .replace(/&#10;/g, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text || null;
}

function linkNames(
  links: Record<string, { name?: string }[] | undefined> | undefined,
  key: string,
): string[] {
  const arr = links?.[key];
  if (!Array.isArray(arr)) return [];
  return [...new Set(arr.map((x) => x.name?.trim()).filter(Boolean) as string[])];
}

export function geekitemApiUrl(objectid: number): string {
  return (
    `https://api.geekdo.com/api/geekitems?ajax=1&action=thing` +
    `&objectid=${objectid}&objecttype=thing&nosession=1`
  );
}

/** Maps geekdo geekitems JSON (action=thing) to ThingDetails. */
export function parseGeekitemJson(
  data: unknown,
  fallbackId?: number,
): ThingDetails | null {
  const item = (data as { item?: Record<string, unknown> })?.item;
  if (!item) return null;

  const id =
    parseInt(String(item.objectid ?? item.id ?? fallbackId ?? ""), 10) ||
    fallbackId ||
    null;
  if (id == null || !Number.isFinite(id)) return null;

  const links = item.links as Record<string, { name?: string }[]> | undefined;
  const desc =
    stripHtml(item.description as string) ??
    stripHtml(item.short_description as string);

  const image =
    (item.topimageurl as string) ||
    (item.imageurl as string) ||
    null;
  const thumbnail = (item.imageurl as string) || image;

  return {
    id,
    description: desc,
    image,
    thumbnail,
    categories: linkNames(links, "boardgamecategory"),
    mechanics: linkNames(links, "boardgamemechanic"),
  };
}
