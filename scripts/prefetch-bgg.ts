/**
 * Schreibt data/bgg-enrichment.json über die offizielle BGG XML-API (thing).
 * Nur sinnvoll mit BGG_TOKEN — optionaler Upgrade-Pfad nach Browser-Export.
 *
 * Nutzung: npm run prefetch-bgg [collection.csv]
 */
import { readFileSync, writeFileSync } from "node:fs";
import {
  fetchThingBatch,
  chunk,
  BggBlockedError,
  parseCollectionCsv,
} from "../lib/bgg";
import {
  loadEnrichmentCache,
  serializeEnrichmentCache,
  enrichmentCachePath,
} from "../lib/enrichment-cache";

function loadEnv(path = ".env") {
  try {
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const key = m[1];
      let val = m[2].trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  } catch {
    // rely on environment
  }
}

loadEnv();

const BATCH_SIZE = 20;
const DELAY_MS = 1500;

async function main() {
  if (!process.env.BGG_TOKEN?.trim()) {
    console.error(
      "BGG_TOKEN fehlt. Ohne Token: docs/browser-prefetch-bgg.md (Browser-Export).",
    );
    process.exit(1);
  }

  const csvPath = process.argv[2] ?? "collection.csv";
  let ids: number[];
  try {
    const games = parseCollectionCsv(readFileSync(csvPath, "utf8"));
    ids = games.map((g) => g.id);
  } catch {
    console.error(`CSV nicht lesbar: ${csvPath}`);
    process.exit(1);
  }

  if (ids.length === 0) {
    console.error("Keine objectids in der CSV.");
    process.exit(1);
  }

  const cache = loadEnrichmentCache();
  const batches = chunk(ids, BATCH_SIZE);

  console.log(`${ids.length} Spiele, ${batches.length} API-Batches…`);

  for (const [i, batch] of batches.entries()) {
    const details = await fetchThingBatch(batch);
    for (const d of details) {
      if (!d.id) continue;
      const prev = cache.get(d.id);
      cache.set(d.id, {
        ...d,
        descriptionDe: prev?.descriptionDe,
        categoriesDe: prev?.categoriesDe,
        mechanicsDe: prev?.mechanicsDe,
      });
    }
    console.log(`  Batch ${i + 1}/${batches.length}`);
    if (i < batches.length - 1) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  const path = enrichmentCachePath();
  writeFileSync(path, serializeEnrichmentCache(cache), "utf8");
  console.log(`Geschrieben: ${path} (${cache.size} Einträge)`);
}

main().catch((e) => {
  if (e instanceof BggBlockedError) {
    console.error("\n" + e.message);
  } else {
    console.error("Fehler:", e);
  }
  process.exit(1);
});
