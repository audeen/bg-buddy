/**
 * Lokales Enrichment: holt Beschreibung, Genre, Mechaniken und Cover von
 * BoardGameGeek und schreibt sie in die Datenbank (DATABASE_URL aus .env).
 *
 * Nutzung:  npm run enrich
 *
 * Tipp: Lokal von einem normalen Internetanschluss ausführen – BGG blockiert
 * Anfragen von vielen Cloud-/Server-IPs (Cloudflare).
 */
import { PrismaClient } from "@prisma/client";
import { fetchThingBatch, chunk, BggBlockedError } from "../lib/bgg";

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
