/**
 * Wendet deutsche Beschreibungen und Taxonomie auf data/bgg-enrichment.json an.
 * Beschreibungen aus data/bgg-descriptions-de.json, Taxonomie aus lib/bgg-taxonomy-de.ts.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BGG_TAXONOMY_DE } from "../lib/bgg-taxonomy-de";
import {
  enrichmentCachePath,
  loadEnrichmentCache,
  serializeEnrichmentCache,
} from "../lib/enrichment-cache";

const DESCRIPTIONS_DE_FILE = join(
  process.cwd(),
  "data",
  "bgg-descriptions-de.json",
);

function translateTaxonomyLabels(en: string[]): string[] {
  return en.map((label) => BGG_TAXONOMY_DE[label] ?? label);
}

function loadDescriptionsDe(): Record<string, string> {
  const parsed = JSON.parse(
    readFileSync(DESCRIPTIONS_DE_FILE, "utf8"),
  ) as Record<string, string>;
  return parsed;
}

function main() {
  const descriptionsDe = loadDescriptionsDe();
  const cache = loadEnrichmentCache();
  let descApplied = 0;
  let taxonomyApplied = 0;
  const missing: string[] = [];

  for (const [id, entry] of cache) {
    entry.categoriesDe = translateTaxonomyLabels(entry.categories);
    entry.mechanicsDe = translateTaxonomyLabels(entry.mechanics);
    taxonomyApplied += 1;

    const deText = descriptionsDe[String(id)]?.trim();
    if (deText) {
      entry.descriptionDe = deText;
      descApplied += 1;
    } else if (entry.description) {
      missing.push(String(id));
    }
  }

  const path = enrichmentCachePath();
  writeFileSync(path, serializeEnrichmentCache(cache), "utf8");

  console.log(`Geschrieben: ${path}`);
  console.log(
    `  ${taxonomyApplied} Taxonomie | ${descApplied} Beschreibungen`,
  );
  if (missing.length > 0) {
    console.error(`  Fehlend in bgg-descriptions-de.json: ${missing.join(", ")}`);
    process.exit(1);
  }
}

main();
