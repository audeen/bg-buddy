/**
 * Tests für den "Neu in der Sammlung"-Pool (buildRecentGamesPool).
 * Nutzung: npm run test:latest-game
 */
import assert from "node:assert/strict";
import {
  buildRecentGamesPool,
  LATEST_GAME_WINDOW_DAYS,
  type LatestGameCandidate,
} from "../lib/latest-game";

const NOW = new Date("2026-06-11T12:00:00Z");

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
}

function makeGame(
  id: number,
  overrides: Partial<LatestGameCandidate> = {},
): LatestGameCandidate {
  return {
    id,
    name: `Spiel ${id}`,
    year: 2024,
    description: null,
    image: null,
    thumbnail: null,
    minPlayers: 2,
    maxPlayers: 4,
    minPlaytime: 30,
    maxPlaytime: 60,
    playingTime: 45,
    weight: 2,
    bggRating: 7,
    ageRange: null,
    isExpansion: false,
    categories: [],
    mechanics: [],
    bestPlayerCounts: [],
    recommendedPlayerCounts: [],
    lentOut: false,
    addedToCollectionAt: daysAgo(1),
    ...overrides,
  };
}

function testWindowBoundary() {
  const pool = buildRecentGamesPool(
    [
      makeGame(1, { addedToCollectionAt: daysAgo(13) }),
      makeGame(2, { addedToCollectionAt: daysAgo(15) }),
      makeGame(3, { addedToCollectionAt: daysAgo(LATEST_GAME_WINDOW_DAYS) }),
    ],
    NOW,
  );
  assert.deepEqual(
    pool.map((g) => g.id),
    [1, 3],
    "Tag 13 und exakt 14 Tage im Pool, Tag 15 nicht",
  );
}

function testExclusions() {
  const pool = buildRecentGamesPool(
    [
      makeGame(1, { addedToCollectionAt: null }),
      makeGame(2, { lentOut: true }),
      makeGame(3, { isExpansion: true }),
      makeGame(4),
    ],
    NOW,
  );
  assert.deepEqual(
    pool.map((g) => g.id),
    [4],
    "null-Datum, verliehen und Erweiterungen ausgeschlossen",
  );
}

function testSortNewestFirst() {
  const pool = buildRecentGamesPool(
    [
      makeGame(10, { addedToCollectionAt: daysAgo(5) }),
      makeGame(20, { addedToCollectionAt: daysAgo(1) }),
      makeGame(30, { addedToCollectionAt: daysAgo(10) }),
      makeGame(5, { addedToCollectionAt: daysAgo(1) }),
    ],
    NOW,
  );
  assert.deepEqual(
    pool.map((g) => g.id),
    [5, 20, 10, 30],
    "neueste zuerst, ties nach id aufsteigend",
  );
}

function testEmptyPool() {
  assert.deepEqual(buildRecentGamesPool([], NOW), []);
  assert.deepEqual(
    buildRecentGamesPool([makeGame(1, { addedToCollectionAt: null })], NOW),
    [],
  );
}

testWindowBoundary();
testExclusions();
testSortNewestFirst();
testEmptyPool();

console.log("test-latest-game: all passed");
