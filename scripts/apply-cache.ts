/**
 * Wendet data/bgg-enrichment.json auf alle passenden Spiele in der DB an.
 * Nutzung: npm run apply-cache
 *
 * DATABASE_URL muss auf die Ziel-DB zeigen (Neon = Production, nicht localhost).
 */
import { readFileSync } from "node:fs";
import { applyEnrichmentCacheToDb } from "../lib/apply-enrichment-cache";
import { prisma } from "../lib/prisma";

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

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (url.includes("localhost") || url.includes("127.0.0.1")) {
    console.warn(
      "Hinweis: DATABASE_URL zeigt auf localhost. Für Production die Neon-URL aus Vercel in .env setzen.",
    );
  }

  const result = await applyEnrichmentCacheToDb();

  if (result.cacheSize === 0) {
    console.log(
      "Keine Einträge in data/bgg-enrichment.json. Siehe docs/browser-prefetch-bgg.md",
    );
    return;
  }

  console.log(
    `${result.updated} Spiele aktualisiert (${result.cacheSize} im Cache, ${result.skipped} in DB nicht vorhanden).`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("Fehler:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
