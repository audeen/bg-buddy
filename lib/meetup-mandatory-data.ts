import { prisma } from "@/lib/prisma";
import {
  buildOwnedExpansionsByBaseGame,
  loadOwnedExpansionRows,
} from "@/lib/owned-expansions";
import type { MandatoryExpansionFamily } from "@/components/MeetupMandatoryExpansions";

export async function loadMandatoryExpansionFamilies(): Promise<
  MandatoryExpansionFamily[]
> {
  const expansions = await loadOwnedExpansionRows();
  const byBase = buildOwnedExpansionsByBaseGame(expansions);
  const baseIds = [...byBase.keys()];
  if (baseIds.length === 0) return [];

  const baseGames = await prisma.game.findMany({
    where: { id: { in: baseIds }, isExpansion: false },
    select: { id: true, name: true },
  });
  const baseNameById = new Map(baseGames.map((g) => [g.id, g.name]));

  const families: MandatoryExpansionFamily[] = [];
  for (const [baseGameId, exps] of byBase) {
    if (exps.length === 0) continue;
    families.push({
      baseGameId,
      baseGameName: baseNameById.get(baseGameId) ?? "Basisspiel",
      expansions: exps.map((e) => ({ id: e.id, name: e.name })),
    });
  }

  return families.sort((a, b) =>
    a.baseGameName.localeCompare(b.baseGameName, "de"),
  );
}

export function mandatoryExpansionKeys(
  rows: { baseGameId: number; expansionGameId: number }[],
): string[] {
  return rows.map((r) => `${r.baseGameId}:${r.expansionGameId}`);
}
