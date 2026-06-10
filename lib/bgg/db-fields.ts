import type { ThingDetails } from "@/lib/bgg";

/** True when the entry has anything useful for the UI (cover, text, or tags). */
export function hasEnrichmentContent(d: ThingDetails): boolean {
  return !!(
    d.image ||
    d.thumbnail ||
    d.description ||
    d.descriptionDe ||
    d.categories.length > 0 ||
    d.categoriesDe?.length ||
    d.mechanics.length > 0 ||
    d.mechanicsDe?.length
  );
}

/** German description; BGG categories/mechanics stay English. */
export function localizedEnrichmentFields(d: ThingDetails) {
  return {
    description: d.descriptionDe ?? d.description,
    categories: d.categories,
    mechanics: d.mechanics,
  };
}

export function thingDetailsToDbFields(d: ThingDetails) {
  const localized = localizedEnrichmentFields(d);
  return {
    description: localized.description,
    image: d.image,
    thumbnail: d.thumbnail,
    categories: localized.categories,
    mechanics: localized.mechanics,
    expandsGameIds: d.expandsGameIds ?? [],
    enriched: hasEnrichmentContent(d),
  };
}
