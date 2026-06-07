/**
 * Tests für effective-player-count und Erweiterungs-Filter.
 * Nutzung: npm run test:effective-player-count
 */
import assert from "node:assert/strict";
import {
  baseGameIdsBestViaExpansion,
  baseGameIdsPlayableViaExpansion,
  effectivePlayerRange,
  expansionNamesForPlayerCount,
  isPlayableAtCount,
  isPlayableWithOwnedExpansions,
  mergedBestPlayerCounts,
} from "../lib/effective-player-count";
import { buildGameWhere } from "../lib/game-filters";
import { parseGameFilters } from "../lib/game-filters";

const sevenWonders = { minPlayers: 2, maxPlayers: 7 };
const cities = {
  minPlayers: 2,
  maxPlayers: 8,
  expandsGameIds: [68448],
  bestPlayerCounts: [3, 4, 5, 6, 7, 8],
  name: "7 Wonders: Cities",
};
const catan = { minPlayers: 3, maxPlayers: 4 };
const catan56 = {
  minPlayers: 5,
  maxPlayers: 6,
  expandsGameIds: [13],
  bestPlayerCounts: [4, 5, 6],
  name: "Catan: 5-6 Player Expansion",
};

function testIsPlayableAtCount() {
  assert.equal(isPlayableAtCount(2, 7, 4), true);
  assert.equal(isPlayableAtCount(2, 7, 8), false);
  assert.equal(isPlayableAtCount(null, null, 5), true);
}

function testSevenWondersWithCities() {
  assert.equal(isPlayableWithOwnedExpansions(sevenWonders, [cities], 7), true);
  assert.equal(isPlayableWithOwnedExpansions(sevenWonders, [cities], 8), true);
  assert.equal(isPlayableWithOwnedExpansions(sevenWonders, [cities], 9), false);
  assert.equal(isPlayableWithOwnedExpansions(sevenWonders, [], 8), false);

  const range = effectivePlayerRange(sevenWonders, [cities]);
  assert.equal(range.min, 2);
  assert.equal(range.max, 8);

  assert.deepEqual(baseGameIdsPlayableViaExpansion([cities], 8), [68448]);
  assert.deepEqual(baseGameIdsPlayableViaExpansion([cities], 7), [68448]);
  assert.deepEqual(baseGameIdsPlayableViaExpansion([cities], 9), []);

  const names = expansionNamesForPlayerCount(
    sevenWonders,
    [cities],
    8,
  );
  assert.deepEqual(names, ["7 Wonders: Cities"]);
  assert.deepEqual(expansionNamesForPlayerCount(sevenWonders, [cities], 4), []);
}

function testCatanWithExpansion() {
  assert.equal(isPlayableWithOwnedExpansions(catan, [catan56], 4), true);
  assert.equal(isPlayableWithOwnedExpansions(catan, [catan56], 5), true);
  assert.equal(isPlayableWithOwnedExpansions(catan, [catan56], 6), true);
  assert.equal(isPlayableWithOwnedExpansions(catan, [], 5), false);

  const range = effectivePlayerRange(catan, [catan56]);
  assert.equal(range.min, 3);
  assert.equal(range.max, 6);

  assert.deepEqual(baseGameIdsPlayableViaExpansion([catan56], 5), [13]);
}

function testMergedBestPlayerCounts() {
  const base = { bestPlayerCounts: [3, 4, 5, 6, 7] };
  assert.deepEqual(mergedBestPlayerCounts(base, [cities]), [3, 4, 5, 6, 7, 8]);
  assert.deepEqual(baseGameIdsBestViaExpansion([cities], 8), [68448]);
}

function testBuildGameWhereWithExpansionIds() {
  const where = buildGameWhere(parseGameFilters({ players: "8" }), {
    expansionPlayableBaseIds: [68448],
  });
  assert.ok(where.AND);
  const and = where.AND as Record<string, unknown>[];
  const playerClause = and.find(
    (c) => typeof c === "object" && c != null && "OR" in c,
  ) as { OR: unknown[] };
  assert.ok(playerClause?.OR);
  assert.equal(playerClause.OR.length, 2);

  const bestWhere = buildGameWhere(parseGameFilters({ best: "8" }), {
    expansionBestBaseIds: [68448],
  });
  const bestAnd = bestWhere.AND as Record<string, unknown>[];
  const bestClause = bestAnd.find(
    (c) => typeof c === "object" && c != null && "OR" in c,
  ) as { OR: unknown[] };
  assert.equal(bestClause.OR.length, 2);
}

testIsPlayableAtCount();
testSevenWondersWithCities();
testCatanWithExpansion();
testMergedBestPlayerCounts();
testBuildGameWhereWithExpansionIds();

console.log("test-effective-player-count: all passed");
