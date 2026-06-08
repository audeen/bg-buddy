/**
 * Tests für game-filters.
 * Nutzung: npm run test:game-filters
 */
import assert from "node:assert/strict";
import {
  activeFilterLabels,
  applyGameFilter,
  buildGameOrderBy,
  buildGameWhere,
  clearFilterKind,
  filtersToSearchParams,
  hasActiveFilters,
  isFilterActive,
  parseGameFilters,
  parseGameSort,
  playerRangeFilterValue,
  playtimeFilterValue,
  ratingBlockFromValue,
  ratingBlockLabel,
  ratingBlocksFromRatings,
  ratingTierOptions,
  toggleGameFilter,
  weightLevelFromValue,
  matchesGameFilters,
  sortGames,
  type GameFilterable,
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
    sort: "rating-desc",
  });

  assert.equal(filters.q, "catan");
  assert.equal(filters.players, 4);
  assert.equal(filters.time, "medium");
  assert.equal(filters.genre, "Strategie");
  assert.equal(filters.mechanic, "Worker Placement");
  assert.equal(filters.playerRange, "2-4");
  assert.equal(filters.playtime, "45");
  assert.equal(filters.weight, "mittel");
  assert.equal(filters.rating, 8);
  assert.equal(filters.best, 3);
  assert.equal(filters.includeExpansions, true);
  assert.equal(parseGameSort({ sort: "rating-desc" }), "rating-desc");
}

function testRatingBlocks() {
  assert.equal(ratingBlockFromValue(8.1), 8);
  assert.equal(ratingBlockFromValue(9.0), 9);
  assert.equal(ratingBlockFromValue(10.2), 10);
  assert.equal(ratingBlockLabel(8), "★ 8+");
  assert.equal(ratingBlockLabel(10), "★ 10");
  assert.equal(parseGameFilters({ rating: "8.2" }).rating, 8);
  assert.deepEqual(ratingBlocksFromRatings([7.2, 8.1, 8.9, null, 10]), [7, 8, 10]);
  assert.deepEqual(ratingTierOptions([7, 8, 10]), [
    { value: 7, label: "★ 7+" },
    { value: 8, label: "★ 8+" },
    { value: 10, label: "★ 10" },
  ]);
}

function testBuildGameWhere() {
  const where = buildGameWhere(
    parseGameFilters({ players: "3", genre: "Euro", time: "short", rating: "8" }),
  );
  assert.ok(where.AND);
  assert.equal(Array.isArray(where.AND), true);
}

function testBuildGameOrderBy() {
  assert.deepEqual(buildGameOrderBy("name"), [{ name: "asc" }]);
  assert.equal(buildGameOrderBy("rating-desc").length, 2);
  assert.equal(buildGameOrderBy("rating-asc").length, 2);
}

function testFiltersToSearchParamsRoundTrip() {
  const original = parseGameFilters({
    q: "azul",
    players: "2",
    time: "long",
    genre: "Familie",
    rating: "9",
    exp: "1",
  });
  const sort = parseGameSort({ sort: "rating-desc" });
  const params = filtersToSearchParams(original, sort);
  const roundTrip = parseGameFilters(Object.fromEntries(params.entries()));
  assert.deepEqual(roundTrip, original);
  assert.equal(parseGameSort(Object.fromEntries(params.entries())), sort);
}

function testActiveFilterLabels() {
  const labels = activeFilterLabels(
    parseGameFilters({ players: "4", time: "medium", rating: "8" }),
  );
  assert.equal(labels.length, 3);
  assert.equal(labels[2].label, "★ 8+");
}

function testHasActiveFiltersIgnoresSort() {
  assert.equal(hasActiveFilters(parseGameFilters({})), false);
  assert.equal(hasActiveFilters(parseGameFilters({ q: "x" })), true);
  assert.equal(hasActiveFilters(parseGameFilters({})), false);
}

function testToggleGameFilter() {
  const base = parseGameFilters({});
  const withGenre = applyGameFilter(base, { kind: "genre", value: "Euro" });
  assert.equal(withGenre.genre, "Euro");
  const toggledOff = toggleGameFilter(withGenre, { kind: "genre", value: "Euro" });
  assert.equal(toggledOff.genre, "");
}

function testIsFilterActiveRatingBlock() {
  const filters = parseGameFilters({ rating: "8" });
  assert.equal(isFilterActive(filters, { kind: "rating", value: "8" }), true);
  assert.equal(isFilterActive(filters, { kind: "rating", value: "8.1" }), true);
  assert.equal(isFilterActive(filters, { kind: "rating", value: "9" }), false);
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

const sampleGame: GameFilterable = {
  id: 1,
  name: "Catan",
  categories: ["Strategie", "Familie"],
  mechanics: ["Handel", "Würfeln"],
  minPlayers: 3,
  maxPlayers: 4,
  minPlaytime: 60,
  maxPlaytime: 90,
  playingTime: 75,
  weight: 2.3,
  bggRating: 7.1,
  bestPlayerCounts: [3, 4],
};

function testMatchesGameFilters() {
  assert.equal(
    matchesGameFilters(sampleGame, parseGameFilters({ genre: "Strategie" })),
    true,
  );
  assert.equal(
    matchesGameFilters(sampleGame, parseGameFilters({ genre: "Party" })),
    false,
  );
  assert.equal(
    matchesGameFilters(sampleGame, parseGameFilters({ rating: "7" })),
    true,
  );
  assert.equal(
    matchesGameFilters(sampleGame, parseGameFilters({ rating: "8" })),
    false,
  );
  assert.equal(
    matchesGameFilters(sampleGame, parseGameFilters({ players: "4" })),
    true,
  );
  assert.equal(
    matchesGameFilters(sampleGame, parseGameFilters({ players: "2" })),
    false,
  );
  assert.equal(
    matchesGameFilters(sampleGame, parseGameFilters({ players: "5" }), {
      expansions: [{ minPlayers: 5, maxPlayers: 6, bestPlayerCounts: [5] }],
    }),
    true,
  );
  assert.equal(
    matchesGameFilters(sampleGame, parseGameFilters({ best: "3" })),
    true,
  );
  assert.equal(
    matchesGameFilters(sampleGame, parseGameFilters({ mechanic: "Handel" })),
    true,
  );
}

function testSortGames() {
  const games: GameFilterable[] = [
    { ...sampleGame, id: 1, name: "Bravo", bggRating: 6 },
    { ...sampleGame, id: 2, name: "Alpha", bggRating: 8 },
    { ...sampleGame, id: 3, name: "Charlie", bggRating: 7 },
  ];
  assert.deepEqual(
    sortGames(games, "name").map((g) => g.name),
    ["Alpha", "Bravo", "Charlie"],
  );
  assert.deepEqual(
    sortGames(games, "rating-desc").map((g) => g.name),
    ["Alpha", "Charlie", "Bravo"],
  );
  assert.deepEqual(
    sortGames(games, "rating-asc").map((g) => g.name),
    ["Bravo", "Charlie", "Alpha"],
  );
}

testParseGameFilters();
testRatingBlocks();
testBuildGameWhere();
testBuildGameOrderBy();
testFiltersToSearchParamsRoundTrip();
testActiveFilterLabels();
testHasActiveFiltersIgnoresSort();
testToggleGameFilter();
testIsFilterActiveRatingBlock();
testClearFilterKind();
testPlayerRangeFilterValue();
testPlaytimeFilterValue();
testWeightLevelFromValue();
testMatchesGameFilters();
testSortGames();

console.log("test-game-filters: all passed");
