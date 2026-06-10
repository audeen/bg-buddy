import type { ThingDetails } from "@/lib/bgg";
import { stripBggHtml } from "@/lib/bgg/html";
import { parseExpandsGameIdsFromGeekdoLinks } from "@/lib/expansion-links";

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

  const links = item.links as
    | Record<string, { name?: string; objectid?: string | number }[] | undefined>
    | undefined;
  const desc =
    stripBggHtml(item.description as string) ??
    stripBggHtml(item.short_description as string);

  const image =
    (item.topimageurl as string) ||
    (item.imageurl as string) ||
    null;
  const thumbnail = (item.imageurl as string) || image;

  const expandsGameIds = parseExpandsGameIdsFromGeekdoLinks(links);

  return {
    id,
    description: desc,
    image,
    thumbnail,
    categories: linkNames(links, "boardgamecategory"),
    mechanics: linkNames(links, "boardgamemechanic"),
    ...(expandsGameIds.length > 0 ? { expandsGameIds } : {}),
  };
}
