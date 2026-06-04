/**
 * Holt Cover-Bilder über api.geekdo.com (kein BGG_TOKEN, kein Browser-CORS).
 * Schreibt/aktualisiert data/bgg-enrichment.json.
 *
 * Nutzung: npm run prefetch-covers [collection.csv]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { parseCollectionCsv } from "../lib/bgg";
import {
  loadEnrichmentCache,
  serializeEnrichmentCache,
  enrichmentCachePath,
} from "../lib/enrichment-cache";
import type { ThingDetails } from "../lib/bgg";

const DELAY_MS = 400;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchCover(id: number): Promise<Pick<ThingDetails, "image" | "thumbnail">> {
  const url =
    `https://api.geekdo.com/api/images?ajax=1&gallery=all&nosession=1` +
    `&objectid=${id}&objecttype=thing&pageid=1&showcount=1&size=thumb&sort=recent`;

  const res = await fetch(url);
  if (!res.ok) return { image: null, thumbnail: null };

  const j = (await res.json()) as {
    images?: { imageurl_lg?: string; imageurl?: string }[];
  };
  const img = j.images?.[0];
  return {
    image: img?.imageurl_lg ?? null,
    thumbnail: img?.imageurl ?? null,
  };
}

async function main() {
  const csvPath = process.argv[2] ?? "collection.csv";
  const games = parseCollectionCsv(readFileSync(csvPath, "utf8"));
  const ids = [...new Set(games.map((g) => g.id))];

  if (ids.length === 0) {
    console.error(`Keine IDs in ${csvPath}`);
    process.exit(1);
  }

  const cache = loadEnrichmentCache();
  console.log(`${ids.length} Spiele, Cover von Geekdo…`);

  for (const [i, id] of ids.entries()) {
    const cover = await fetchCover(id);
    const prev = cache.get(id);
    cache.set(id, {
      id,
      description: prev?.description ?? null,
      image: cover.image ?? prev?.image ?? null,
      thumbnail: cover.thumbnail ?? prev?.thumbnail ?? null,
      categories: prev?.categories ?? [],
      mechanics: prev?.mechanics ?? [],
    });
    if ((i + 1) % 10 === 0 || i === ids.length - 1) {
      console.log(`  ${i + 1}/${ids.length}`);
    }
    if (i < ids.length - 1) await sleep(DELAY_MS);
  }

  const path = enrichmentCachePath();
  writeFileSync(path, serializeEnrichmentCache(cache), "utf8");
  console.log(`Geschrieben: ${path}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
