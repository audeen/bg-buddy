import { prisma } from "@/lib/prisma";
import {
  loadEnrichmentCache,
  thingDetailsToDbFields,
} from "@/lib/enrichment-cache";

export async function applyEnrichmentCacheToDb(): Promise<{
  cacheSize: number;
  updated: number;
  skipped: number;
}> {
  const cache = loadEnrichmentCache();
  if (cache.size === 0) {
    return { cacheSize: 0, updated: 0, skipped: 0 };
  }

  let updated = 0;
  let skipped = 0;

  for (const [id, details] of cache) {
    const exists = await prisma.game.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      skipped += 1;
      continue;
    }

    await prisma.game.update({
      where: { id },
      data: thingDetailsToDbFields(details),
    });
    updated += 1;
  }

  return { cacheSize: cache.size, updated, skipped };
}
