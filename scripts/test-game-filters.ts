/**
 * Tests für game-filters.
 * Nutzung: npm run test:game-filters
 */
import assert from "node:assert/strict";
import {
  activeFilterLabels,
  applyGameFilter,
  buildGameWhere,
  clearFilterKind,
  filtersToSearchParams,
  hasActiveFilters,
  isFilterActive,
  parseGameFilters,
  playerRangeFilterValue,
  playtimeFilterValue,
  toggleGameFilter,
  weightLevelFromValue,
} from "../lib/game-filters";

function testParseGameFilters() {
  const filters = parseGameFilters({
    q: "catan",
    players: "4",
    time: "medium",
    genre: "Strategie",
    mechanic: "Worker Placement",
    playerRange: "2-4",
    playtime: "45",
    weight: "mittel",
    rating: "8.2",
    best: "3",
    exp: "1",
  });

  assert.equal(filters.q, "catan");
  assert.equal(filters.players, 4);
  assert.equal(filters.time, "medium");
  assert.equal(filters.genre, "Strategie");
  assert.equal(filters.mechanic, "Worker Placement");
  assert.equal(filters.playerRange, "2-4");
  assert.equal(filters.playtime, "45");
  assert.equal(filters.weight, "mittel");
  assert.equal(filters.rating, 8.2);
  assert.equal(filters.best, 3);
  assert.equal(filters.includeExpansions, true);
}

function testBuildGameWhere() {
  const where = buildGameWhere(
    parseGameFilters({ players: "3", genre: "Euro", time: "short" }),
  );
  assert.ok(where.AND);
  assert.equal(Array.isArray(where.AND), true);
}

function testFiltersToSearchParamsRoundTrip() {
  const original = parseGameFilters({
    q: "azul",
    players: "2",
    time: "long",
    genre: "Familie",
    exp: "1",
  });
  const params = filtersToSearchParams(original);
  const roundTrip = parseGameFilters(Object.fromEntries(params.entries()));
  assert.deepEqual(roundTrip, original);
}

function testActiveFilterLabels() {
  const labels = activeFilterLabels(
    parseGameFilters({ players: "4", time: "medium", genre: "Strategie" }),
  );
  assert.equal(labels.length, 3);
  assert.equal(labels[0].kind, "players");
  assert.equal(labels[1].kind, "time");
  assert.equal(labels[2].kind, "genre");
}

function testHasActiveFilters() {
  assert.equal(hasActiveFilters(parseGameFilters({})), false);
  assert.equal(hasActiveFilters(parseGameFilters({ q: "x" })), true);
}

function testToggleGameFilter() {
  const base = parseGameFilters({});
  const withGenre = applyGameFilter(base, { kind: "genre", value: "Euro" });
  assert.equal(withGenre.genre, "Euro");
  const toggledOff = toggleGameFilter(withGenre, { kind: "genre", value: "Euro" });
  assert.equal(toggledOff.genre, "");
}

function testIsFilterActive() {
  const filters = parseGameFilters({ genre: "Euro" });
  assert.equal(isFilterActive(filters, { kind: "genre", value: "Euro" }), true);
  assert.equal(isFilterActive(filters, { kind: "genre", value: "Party" }), false);
}

function testClearFilterKind() {
  const filters = parseGameFilters({ q: "test", players: "2" });
  const cleared = clearFilterKind(filters, "q");
  assert.equal(cleared.q, "");
  assert.equal(cleared.players, 2);
}

function testPlayerRangeFilterValue() {
  assert.equal(playerRangeFilterValue(2, 4), "2-4");
  assert.equal(playerRangeFilterValue(3, 3), "3-3");
  assert.equal(playerRangeFilterValue(null, null), null);
}

function testPlaytimeFilterValue() {
  assert.equal(playtimeFilterValue(30, 60, null), "30-60");
  assert.equal(playtimeFilterValue(null, null, 45), "45");
}

function testWeightLevelFromValue() {
  assert.equal(weightLevelFromValue(1.5), "leicht");
  assert.equal(weightLevelFromValue(2.5), "mittel");
  assert.equal(weightLevelFromValue(3.5), "schwer");
  assert.equal(weightLevelFromValue(4.2), "experte");
}

testParseGameFilters();
testBuildGameWhere();
testFiltersToSearchParamsRoundTrip();
testActiveFilterLabels();
testHasActiveFilters();
testToggleGameFilter();
testIsFilterActive();
testClearFilterKind();
testPlayerRangeFilterValue();
testPlaytimeFilterValue();
testWeightLevelFromValue();

console.log("test-game-filters: all passed");
