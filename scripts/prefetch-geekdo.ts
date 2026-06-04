/**
 * Volle Anreicherung über api.geekdo.com/geekitems (kein BGG_TOKEN).
 * Schreibt data/bgg-enrichment.json mit Cover, Beschreibung, Genre, Mechanik.
 *
 * Nutzung: npm run prefetch-geekdo [collection.csv]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { parseCollectionCsv } from "../lib/bgg";
import { geekitemApiUrl, parseGeekitemJson } from "../lib/geekdo-item";
import {
  loadEnrichmentCache,
  serializeEnrichmentCache,
  enrichmentCachePath,
} from "../lib/enrichment-cache";

const DELAY_MS = 450;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchItem(id: number) {
  const res = await fetch(geekitemApiUrl(id), {
    headers: { Origin: "https://boardgamegeek.com" },
  });
  if (!res.ok) return null;
  return parseGeekitemJson(await res.json(), id);
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
  console.log(`${ids.length} Spiele via Geekdo geekitems…`);

  for (const [i, id] of ids.entries()) {
    const details = await fetchItem(id);
    if (details) {
      const prev = cache.get(id);
      cache.set(id, {
        ...details,
        descriptionDe: prev?.descriptionDe,
        categoriesDe: prev?.categoriesDe,
        mechanicsDe: prev?.mechanicsDe,
      });
    } else console.warn(`  Keine Daten für ${id}`);
    if ((i + 1) % 10 === 0 || i === ids.length - 1) {
      console.log(`  ${i + 1}/${ids.length}`);
    }
    if (i < ids.length - 1) await sleep(DELAY_MS);
  }

  const path = enrichmentCachePath();
  writeFileSync(path, serializeEnrichmentCache(cache), "utf8");
  console.log(`Geschrieben: ${path} (${cache.size} Einträge)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
