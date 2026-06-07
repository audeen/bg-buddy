export interface PlayerCountFields {
  minPlayers: number | null;
  maxPlayers: number | null;
}

export interface ExpansionForPlayerCount extends PlayerCountFields {
  expandsGameIds: number[];
}

export interface BestPlayerCountFields {
  bestPlayerCounts: number[];
}

const DEFAULT_MIN = 1;
const DEFAULT_MAX = 99;

export function isPlayableAtCount(
  min: number | null,
  max: number | null,
  n: number,
): boolean {
  const lo = min ?? DEFAULT_MIN;
  const hi = max ?? DEFAULT_MAX;
  return lo <= n && n <= hi;
}

export function isPlayableWithOwnedExpansions(
  base: PlayerCountFields,
  expansions: readonly PlayerCountFields[],
  n: number,
): boolean {
  if (isPlayableAtCount(base.minPlayers, base.maxPlayers, n)) return true;
  return expansions.some((exp) =>
    isPlayableAtCount(exp.minPlayers, exp.maxPlayers, n),
  );
}

export function effectivePlayerRange(
  base: PlayerCountFields,
  expansions: readonly PlayerCountFields[],
): { min: number | null; max: number | null } {
  const mins: number[] = [];
  const maxs: number[] = [];

  if (base.minPlayers != null) mins.push(base.minPlayers);
  if (base.maxPlayers != null) maxs.push(base.maxPlayers);

  for (const exp of expansions) {
    if (exp.minPlayers != null) mins.push(exp.minPlayers);
    if (exp.maxPlayers != null) maxs.push(exp.maxPlayers);
  }

  return {
    min: mins.length > 0 ? Math.min(...mins) : null,
    max: maxs.length > 0 ? Math.max(...maxs) : null,
  };
}

export function mergedBestPlayerCounts(
  base: BestPlayerCountFields,
  expansions: readonly BestPlayerCountFields[],
): number[] {
  const counts = new Set(base.bestPlayerCounts);
  for (const exp of expansions) {
    for (const n of exp.bestPlayerCounts) counts.add(n);
  }
  return Array.from(counts).sort((a, b) => a - b);
}

/** Base game ids playable at `n` only via an owned expansion (not base range). */
export function baseGameIdsPlayableViaExpansion(
  expansions: readonly ExpansionForPlayerCount[],
  n: number,
): number[] {
  const ids = new Set<number>();
  for (const exp of expansions) {
    if (!isPlayableAtCount(exp.minPlayers, exp.maxPlayers, n)) continue;
    for (const baseId of exp.expandsGameIds) ids.add(baseId);
  }
  return Array.from(ids);
}

/** Expansion names that enable player count `n` when the base game alone cannot. */
export function expansionNamesForPlayerCount(
  base: PlayerCountFields,
  expansions: readonly (PlayerCountFields & { name: string })[],
  n: number,
): string[] {
  if (isPlayableAtCount(base.minPlayers, base.maxPlayers, n)) return [];
  return expansions
    .filter((exp) => isPlayableAtCount(exp.minPlayers, exp.maxPlayers, n))
    .map((exp) => exp.name);
}

/** Player range for UI: base only, or extended when active count needs an expansion. */
export function displayPlayerRangeForBaseGame(
  base: PlayerCountFields,
  expansions: readonly PlayerCountFields[],
  playerCount?: number,
): { min: number | null; max: number | null } {
  const needsExpansion =
    playerCount != null &&
    expansionNamesForPlayerCount(
      base,
      expansions as (PlayerCountFields & { name: string })[],
      playerCount,
    ).length > 0;

  if (needsExpansion) return effectivePlayerRange(base, expansions);
  return { min: base.minPlayers, max: base.maxPlayers };
}

/** Base game ids whose merged best counts include `n` but base alone does not. */
export function baseGameIdsBestViaExpansion(
  expansions: readonly (ExpansionForPlayerCount & BestPlayerCountFields)[],
  n: number,
): number[] {
  const ids = new Set<number>();
  for (const exp of expansions) {
    if (!exp.bestPlayerCounts.includes(n)) continue;
    for (const baseId of exp.expandsGameIds) ids.add(baseId);
  }
  return Array.from(ids);
}
