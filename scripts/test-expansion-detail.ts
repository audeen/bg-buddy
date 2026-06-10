/**
 * Tests für resolveDetailGameView.
 * Nutzung: npm run test:expansion-detail
 */
import assert from "node:assert/strict";
import type { GameCardGame, GameDetailData } from "../lib/types/game";
import { resolveDetailGameView } from "../lib/expansion-detail";

const baseGame: GameDetailData = {
  id: 100,
  name: "Thurn and Taxis",
  year: 2006,
  description: "Base",
  image: null,
  thumbnail: null,
  minPlayers: 2,
  maxPlayers: 4,
  minPlaytime: 60,
  maxPlaytime: 60,
  playingTime: 60,
  weight: 2.3,
  bggRating: 7.1,
  ageRange: "10+",
  isExpansion: false,
  categories: [],
  mechanics: [],
  bestPlayerCounts: [3, 4],
  recommendedPlayerCounts: [2, 3, 4],
};

const expansions: GameCardGame[] = [
  {
    id: 200,
    name: "All Roads Lead to Rome",
    thumbnail: null,
    image: null,
    isExpansion: true,
    categories: [],
    mechanics: [],
    minPlayers: 2,
    maxPlayers: 4,
    minPlaytime: 60,
    maxPlaytime: 60,
    playingTime: 60,
    weight: 2.1,
    bggRating: 6.4,
    bestPlayerCounts: [],
    recommendedPlayerCounts: [],
  },
  {
    id: 201,
    name: "Power and Glory",
    thumbnail: null,
    image: null,
    isExpansion: true,
    categories: [],
    mechanics: [],
    minPlayers: 2,
    maxPlayers: 4,
    minPlaytime: 60,
    maxPlaytime: 60,
    playingTime: 60,
    weight: 2.3,
    bggRating: 7.2,
    bestPlayerCounts: [],
    recommendedPlayerCounts: [],
  },
];

function testReturnsBaseGame() {
  const result = resolveDetailGameView(baseGame, baseGame, expansions);
  assert.equal(result.id, 100);
  assert.equal(result.name, "Thurn and Taxis");
}

function testReturnsExpansion() {
  const result = resolveDetailGameView(baseGame, expansions[1], expansions);
  assert.equal(result.id, 201);
  assert.equal(result.name, "Power and Glory");
}

function testUnknownIdFallsBackToBase() {
  const unknown = { ...expansions[0], id: 999 };
  const result = resolveDetailGameView(baseGame, unknown, expansions);
  assert.equal(result.id, 100);
}

const tests = [testReturnsBaseGame, testReturnsExpansion, testUnknownIdFallsBackToBase];

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
