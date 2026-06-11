/**
 * Backfill: füllt fehlende Poll-Stammdaten (Rang, Alter, Sprachabhängigkeit,
 * beste/empfohlene Spielerzahl) für bestehende Spiele über die BGG-XML-API.
 *
 * Betrifft Spiele, die über Barcode/BGG-ID hinzugefügt wurden, bevor der
 * XML-Parser diese Felder ausgelesen hat. Es werden nur fehlende Felder
 * gesetzt, vorhandene Werte bleiben unangetastet.
 *
 * Nutzung:  npx tsx scripts/backfill-bgg-polls.ts
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

if (!process.env.BGG_TOKEN?.trim()) {
  console.error(
    "BGG_TOKEN ist nicht gesetzt. Die BGG-XML-API verlangt einen Token " +
      "(https://boardgamegeek.com/applications). In .env eintragen und erneut starten.",
  );
  process.exit(1);
}

const prisma = new PrismaClient();
const BATCH_SIZE = 20;
const DELAY_MS = 1500;

async function main() {
  const pending = await prisma.game.findMany({
    where: {
      OR: [
        { rank: null },
        { ageRange: null },
        { languageDependence: null },
        { bestPlayerCounts: { isEmpty: true } },
        { recommendedPlayerCounts: { isEmpty: true } },
      ],
    },
    select: {
      id: true,
      name: true,
      rank: true,
      ageRange: true,
      languageDependence: true,
      bestPlayerCounts: true,
      recommendedPlayerCounts: true,
    },
    orderBy: { id: "asc" },
  });

  if (pending.length === 0) {
    console.log("Alle Spiele haben vollständige Poll-Stammdaten. Nichts zu tun.");
    return;
  }

  console.log(`${pending.length} Spiele mit fehlenden Feldern…`);
  const byGameId = new Map(pending.map((g) => [g.id, g]));
  const batches = chunk(
    pending.map((g) => g.id),
    BATCH_SIZE,
  );

  let updated = 0;
  for (const [i, ids] of batches.entries()) {
    const details = await fetchThingBatch(ids);
    const byId = new Map(details.map((d) => [d.id, d]));

    for (const id of ids) {
      const d = byId.get(id);
      const game = byGameId.get(id);
      if (!d || !game) continue;

      const data: Record<string, unknown> = {};
      if (game.rank == null && d.rank != null) data.rank = d.rank;
      if (game.ageRange == null && d.ageRange) data.ageRange = d.ageRange;
      if (game.languageDependence == null && d.languageDependence) {
        data.languageDependence = d.languageDependence;
      }
      if (game.bestPlayerCounts.length === 0 && d.bestPlayerCounts?.length) {
        data.bestPlayerCounts = d.bestPlayerCounts;
      }
      if (
        game.recommendedPlayerCounts.length === 0 &&
        d.recommendedPlayerCounts?.length
      ) {
        data.recommendedPlayerCounts = d.recommendedPlayerCounts;
      }

      if (Object.keys(data).length === 0) continue;
      await prisma.game.update({ where: { id }, data });
      updated += 1;
      console.log(`  ${game.name}: ${Object.keys(data).join(", ")}`);
    }

    console.log(`Batch ${i + 1}/${batches.length} abgeschlossen.`);
    if (i < batches.length - 1) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }
  console.log(`Fertig – ${updated} Spiele aktualisiert.`);
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
