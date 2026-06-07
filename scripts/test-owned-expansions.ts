/**
 * Tests für owned-expansions Map-Bildung.
 * Nutzung: npm run test:owned-expansions
 */
import assert from "node:assert/strict";
import {
  buildOwnedExpansionsByBaseGame,
  serializeExpansionsByBaseId,
} from "../lib/owned-expansions";

const baseGameFields = {
  year: null,
  description: null,
  thumbnail: null,
  image: null,
  minPlayers: 2,
  maxPlayers: 4,
  minPlaytime: 30,
  maxPlaytime: 60,
  playingTime: 45,
  weight: 2,
  bggRating: 7.5,
  ageRange: null,
  isExpansion: true,
  categories: [],
  mechanics: [],
  bestPlayerCounts: [],
  recommendedPlayerCounts: [],
};

function testSingleExpansionSingleBase() {
  const map = buildOwnedExpansionsByBaseGame([
    {
      id: 111661,
      name: "7 Wonders: Cities",
      expandsGameIds: [68448],
      ...baseGameFields,
    },
  ]);
  assert.equal(map.size, 1);
  assert.deepEqual(map.get(68448)?.map((g) => g.id), [111661]);
  assert.equal(map.get(68448)?.[0].isExpansion, true);
}

function testExpansionMultipleBases() {
  const map = buildOwnedExpansionsByBaseGame([
    {
      id: 999,
      name: "Shared Expansion",
      expandsGameIds: [100, 200],
      ...baseGameFields,
    },
  ]);
  assert.equal(map.get(100)?.length, 1);
  assert.equal(map.get(200)?.length, 1);
}

function testSortByName() {
  const map = buildOwnedExpansionsByBaseGame([
    {
      id: 2,
      name: "Zebra Expansion",
      expandsGameIds: [1],
      ...baseGameFields,
    },
    {
      id: 3,
      name: "Alpha Expansion",
      expandsGameIds: [1],
      ...baseGameFields,
    },
  ]);
  assert.deepEqual(
    map.get(1)?.map((g) => g.name),
    ["Alpha Expansion", "Zebra Expansion"],
  );
}

function testSerialize() {
  const map = buildOwnedExpansionsByBaseGame([
    {
      id: 111661,
      name: "7 Wonders: Cities",
      expandsGameIds: [68448],
      ...baseGameFields,
    },
  ]);
  const serialized = serializeExpansionsByBaseId(map);
  assert.ok(serialized["68448"]);
  assert.equal(serialized["68448"][0].id, 111661);
  assert.equal("expandsGameIds" in serialized["68448"][0], false);
}

function testEmptyInput() {
  const map = buildOwnedExpansionsByBaseGame([]);
  assert.equal(map.size, 0);
}

const tests = [
  testSingleExpansionSingleBase,
  testExpansionMultipleBases,
  testSortByName,
  testSerialize,
  testEmptyInput,
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
