/**
 * Tests für buildGameTags Spieler-Chip mit Erweiterungen.
 * Nutzung: npm run test:game-tags
 */
import assert from "node:assert/strict";
import { displayPlayerRangeForBaseGame } from "../lib/effective-player-count";
import { buildGameTags } from "../lib/game-tags";

const baseGameFields = {
  minPlaytime: 30,
  maxPlaytime: 30,
  playingTime: 30,
  weight: 2.3,
  bggRating: 7.7,
  categories: [],
  mechanics: [],
  bestPlayerCounts: [3, 4, 5, 6, 7],
  recommendedPlayerCounts: [4, 5],
};

const sevenWonders = {
  ...baseGameFields,
  minPlayers: 2,
  maxPlayers: 7,
  bestPlayerCounts: [3, 4, 5, 6, 7],
};

const cities = {
  name: "7 Wonders: Cities",
  minPlayers: 2,
  maxPlayers: 8,
  bestPlayerCounts: [3, 4, 5, 6, 7, 8],
};

const illuminati = {
  ...baseGameFields,
  minPlayers: 2,
  maxPlayers: 6,
  bestPlayerCounts: [4],
  recommendedPlayerCounts: [3, 4, 5, 6],
};

const bavarianFireDrill = {
  name: "Illuminati: Bavarian Fire Drill",
  minPlayers: 2,
  maxPlayers: 8,
  bestPlayerCounts: [4],
};

function playerTagLabel(
  game: typeof sevenWonders,
  options?: Parameters<typeof buildGameTags>[1],
): string | undefined {
  return buildGameTags(game, options).find((t) => t.label.includes("Spieler"))
    ?.label;
}

function testDisplayRangeWithoutActiveCount() {
  const range = displayPlayerRangeForBaseGame(illuminati, [bavarianFireDrill]);
  assert.equal(range.min, 2);
  assert.equal(range.max, 6);
}

function testDisplayRangeWithBannerContext() {
  const range = displayPlayerRangeForBaseGame(
    sevenWonders,
    [cities],
    8,
  );
  assert.equal(range.min, 2);
  assert.equal(range.max, 8);
}

function testDisplayRangeWhenBaseCoversCount() {
  const range = displayPlayerRangeForBaseGame(sevenWonders, [cities], 4);
  assert.equal(range.max, 7);
}

function testChipWithoutPlayerCount() {
  assert.equal(
    playerTagLabel(illuminati, { ownedExpansions: [bavarianFireDrill] }),
    "2–6 Spieler",
  );
}

function testChipWithExpansionOnlyCount() {
  assert.equal(
    playerTagLabel(sevenWonders, {
      playerCount: 8,
      ownedExpansions: [cities],
    }),
    "2–8 Spieler",
  );
}

function testChipWhenBaseCoversCount() {
  assert.equal(
    playerTagLabel(sevenWonders, {
      playerCount: 4,
      ownedExpansions: [cities],
    }),
    "2–7 Spieler",
  );
}

function testNoBestTagFromExpansionOnly() {
  const tags = buildGameTags(sevenWonders, {
    playerCount: 8,
    ownedExpansions: [cities],
  });
  assert.equal(
    tags.some((t) => t.label === "Best · 8P"),
    false,
  );
}

const tests = [
  testDisplayRangeWithoutActiveCount,
  testDisplayRangeWithBannerContext,
  testDisplayRangeWhenBaseCoversCount,
  testChipWithoutPlayerCount,
  testChipWithExpansionOnlyCount,
  testChipWhenBaseCoversCount,
  testNoBestTagFromExpansionOnly,
];

let failed = 0;
for (const t of tests) {
  try {
    t();
    console.log(`✓ ${t.name}`);
  } catch (e) {
    failed += 1;
    console.error(`✗ ${t.name}`, e);
  }
}

if (failed > 0) process.exit(1);
console.log(`Alle ${tests.length} Tests bestanden.`);
