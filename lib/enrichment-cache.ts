import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ThingDetails } from "@/lib/bgg";

export const ENRICHMENT_CACHE_FILE = "bgg-enrichment.json";

export function enrichmentCachePath(): string {
  return join(process.cwd(), "data", ENRICHMENT_CACHE_FILE);
}

function toInt(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = parseInt(String(value).trim(), 10);
  return Number.isFinite(n) ? n : null;
}

function toStringOrNull(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s || null;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean);
}

/** Normalizes one cache entry from browser export or API prefetch. */
export function normalizeCacheEntry(
  raw: unknown,
  fallbackId?: number,
): ThingDetails | null {
  if (raw == null || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = toInt(o.id) ?? fallbackId ?? null;
  if (id == null) return null;

  const entry: ThingDetails = {
    id,
    description: toStringOrNull(o.description),
    image: toStringOrNull(o.image),
    thumbnail: toStringOrNull(o.thumbnail),
    categories: toStringArray(o.categories),
    mechanics: toStringArray(o.mechanics),
  };

  const descriptionDe = toStringOrNull(o.descriptionDe);
  const categoriesDe = toStringArray(o.categoriesDe);
  const mechanicsDe = toStringArray(o.mechanicsDe);
  if (descriptionDe) entry.descriptionDe = descriptionDe;
  if (categoriesDe.length > 0) entry.categoriesDe = categoriesDe;
  if (mechanicsDe.length > 0) entry.mechanicsDe = mechanicsDe;

  return entry;
}

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

/** Picks German display fields with English fallback. */
export function localizedEnrichmentFields(d: ThingDetails) {
  return {
    description: d.descriptionDe ?? d.description,
    categories:
      d.categoriesDe && d.categoriesDe.length > 0
        ? d.categoriesDe
        : d.categories,
    mechanics:
      d.mechanicsDe && d.mechanicsDe.length > 0 ? d.mechanicsDe : d.mechanics,
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
    enriched: hasEnrichmentContent(d),
  };
}

/**
 * Loads `data/bgg-enrichment.json` (object keyed by BGG id string).
 * Returns an empty map if the file is missing or invalid.
 */
export function loadEnrichmentCache(): Map<number, ThingDetails> {
  const path = enrichmentCachePath();
  if (!existsSync(path)) return new Map();

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return new Map();
  }

  if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return new Map();
  }

  const map = new Map<number, ThingDetails>();
  for (const [key, raw] of Object.entries(parsed as Record<string, unknown>)) {
    const entry = normalizeCacheEntry(raw, toInt(key) ?? undefined);
    if (entry) map.set(entry.id, entry);
  }
  return map;
}

export function enrichmentCacheEntryCount(): number {
  return loadEnrichmentCache().size;
}

function serializeCacheEntry(d: ThingDetails): Record<string, unknown> {
  const o: Record<string, unknown> = {
    id: d.id,
    description: d.description,
    image: d.image,
    thumbnail: d.thumbnail,
    categories: d.categories,
    mechanics: d.mechanics,
  };
  if (d.descriptionDe) o.descriptionDe = d.descriptionDe;
  if (d.categoriesDe?.length) o.categoriesDe = d.categoriesDe;
  if (d.mechanicsDe?.length) o.mechanicsDe = d.mechanicsDe;
  return o;
}

/** Serializes cache map to JSON file contents. */
export function serializeEnrichmentCache(
  map: Map<number, ThingDetails>,
): string {
  const out: Record<string, Record<string, unknown>> = {};
  for (const [id, d] of map) {
    out[String(id)] = serializeCacheEntry(d);
  }
  return JSON.stringify(out, null, 2);
}
