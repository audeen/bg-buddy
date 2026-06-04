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

  return {
    id,
    description: toStringOrNull(o.description),
    image: toStringOrNull(o.image),
    thumbnail: toStringOrNull(o.thumbnail),
    categories: toStringArray(o.categories),
    mechanics: toStringArray(o.mechanics),
  };
}

/** True when the entry has anything useful for the UI (cover, text, or tags). */
export function hasEnrichmentContent(d: ThingDetails): boolean {
  return !!(
    d.image ||
    d.thumbnail ||
    d.description ||
    d.categories.length > 0 ||
    d.mechanics.length > 0
  );
}

export function thingDetailsToDbFields(d: ThingDetails) {
  return {
    description: d.description,
    image: d.image,
    thumbnail: d.thumbnail,
    categories: d.categories,
    mechanics: d.mechanics,
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

/** Serializes cache map to JSON file contents. */
export function serializeEnrichmentCache(
  map: Map<number, ThingDetails>,
): string {
  const out: Record<string, ThingDetails> = {};
  for (const [id, d] of map) {
    out[String(id)] = d;
  }
  return JSON.stringify(out, null, 2);
}
