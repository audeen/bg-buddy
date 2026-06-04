/**
 * Ergänzt data/bgg-enrichment.json um deutsche Felder:
 * - categoriesDe / mechanicsDe via lib/bgg-taxonomy-de.ts
 * - descriptionDe aus data/bgg-descriptions-de.json (falls vorhanden)
 *
 * Nutzung: npm run translate-enrichment [collection.csv]
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseCollectionCsv } from "../lib/bgg";
import { translateTaxonomy } from "../lib/bgg-taxonomy-de";
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

function loadDescriptionsDe(): Record<string, string> {
  if (!existsSync(DESCRIPTIONS_DE_FILE)) return {};
  try {
    const parsed = JSON.parse(readFileSync(DESCRIPTIONS_DE_FILE, "utf8")) as Record<
      string,
      string
    >;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    console.warn(`Konnte ${DESCRIPTIONS_DE_FILE} nicht lesen.`);
    return {};
  }
}

async function main() {
  const csvPath = process.argv[2] ?? "collection.csv";
  const namesById = new Map<number, string>();
  try {
    for (const g of parseCollectionCsv(readFileSync(csvPath, "utf8"))) {
      namesById.set(g.id, g.name);
    }
  } catch {
    console.warn(`CSV ${csvPath} nicht gefunden — nur Cache-IDs werden verarbeitet.`);
  }

  const cache = loadEnrichmentCache();
  if (cache.size === 0) {
    console.error("Kein Cache unter data/bgg-enrichment.json.");
    process.exit(1);
  }

  const descriptionsDe = loadDescriptionsDe();
  let taxonomyUpdated = 0;
  let descUpdated = 0;
  let descMissing = 0;

  for (const [id, entry] of cache) {
    const name = namesById.get(id) ?? `#${id}`;
    entry.categoriesDe = translateTaxonomy(entry.categories);
    entry.mechanicsDe = translateTaxonomy(entry.mechanics);
    taxonomyUpdated += 1;

    const deText = descriptionsDe[String(id)];
    if (deText?.trim()) {
      entry.descriptionDe = deText.trim();
      descUpdated += 1;
    } else if (entry.description && !entry.descriptionDe) {
      descMissing += 1;
      console.warn(`  Keine descriptionDe für ${id} (${name})`);
    }
  }

  const path = enrichmentCachePath();
  writeFileSync(path, serializeEnrichmentCache(cache), "utf8");

  console.log(`Geschrieben: ${path}`);
  console.log(
    `  ${taxonomyUpdated} Einträge: Taxonomie DE | ${descUpdated} Beschreibungen DE | ${descMissing} fehlend`,
  );
  if (descMissing > 0) {
    console.log(
      `  Ergänze fehlende Texte in ${DESCRIPTIONS_DE_FILE} und führe das Skript erneut aus.`,
    );
    process.exit(descMissing > 0 ? 1 : 0);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
