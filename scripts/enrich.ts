/**
 * Lokales Enrichment: holt Beschreibung, Genre, Mechaniken und Cover von
 * BoardGameGeek und schreibt sie in die Datenbank (DATABASE_URL aus .env).
 *
 * Nutzung:  npm run enrich
 *
 * Tipp: Lokal von einem normalen Internetanschluss ausführen – BGG blockiert
 * Anfragen von vielen Cloud-/Server-IPs (Cloudflare).
 */
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { fetchThingBatch, chunk, BggBlockedError } from "../lib/bgg";

// Minimal .env loader (no extra dependency) so BGG_TOKEN/DATABASE_URL are set.
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
    // no .env file -> rely on the real environment
  }
}

loadEnv();

if (!process.env.BGG_TOKEN) {
  console.warn(
    "Warnung: BGG_TOKEN ist nicht gesetzt. Die BGG-XML-API verlangt seit 2025 " +
      "einen Token (https://boardgamegeek.com/applications). Ohne Token kommt 401.",
  );
}

const prisma = new PrismaClient();
const BATCH_SIZE = 20;
const DELAY_MS = 1500;

async function main() {
  const pending = await prisma.game.findMany({
    where: { enriched: false },
    select: { id: true },
    orderBy: { id: "asc" },
  });

  if (pending.length === 0) {
    console.log("Alle Spiele sind bereits angereichert. Nichts zu tun.");
    return;
  }

  console.log(`${pending.length} Spiele werden angereichert…`);
  const batches = chunk(
    pending.map((g) => g.id),
    BATCH_SIZE,
  );

  let done = 0;
  for (const [i, ids] of batches.entries()) {
    const details = await fetchThingBatch(ids);
    const byId = new Map(details.map((d) => [d.id, d]));
    for (const id of ids) {
      const d = byId.get(id);
      await prisma.game.update({
        where: { id },
        data: {
          description: d?.description ?? null,
          image: d?.image ?? null,
          thumbnail: d?.thumbnail ?? null,
          categories: d?.categories ?? [],
          mechanics: d?.mechanics ?? [],
          enriched: true,
        },
      });
    }
    done += ids.length;
    console.log(`  Batch ${i + 1}/${batches.length} – ${done}/${pending.length}`);
    if (i < batches.length - 1) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }
  console.log("Fertig.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    if (e instanceof BggBlockedError) {
      console.error("\n" + e.message);
    } else {
      console.error("Fehler:", e);
    }
    await prisma.$disconnect();
    process.exit(1);
  });
