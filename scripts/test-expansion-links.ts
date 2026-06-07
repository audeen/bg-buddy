/**
 * Tests für Erweiterungs-Verknüpfungen.
 * Nutzung: npm run test:expansion-links
 */
import assert from "node:assert/strict";
import {
  parseExpandsGameIdsFromGeekdoLinks,
  parseExpandsGameIdsFromBggXmlLinks,
} from "../lib/expansion-links";
import { parseGeekitemJson } from "../lib/geekdo-item";
import { normalizeCacheEntry, thingDetailsToDbFields } from "../lib/enrichment-cache";

function testGeekdoLinks() {
  const ids = parseExpandsGameIdsFromGeekdoLinks({
    expandsboardgame: [
      { objectid: "68448" },
      { objectid: 68448 },
    ],
  });
  assert.deepEqual(ids, [68448]);
}

function testBggXmlLinks() {
  const ids = parseExpandsGameIdsFromBggXmlLinks([
    { type: "boardgameexpansion", id: "68448", value: "7 Wonders", inbound: "true" },
    { type: "boardgameexpansion", id: "999", value: "Other", inbound: "false" },
  ]);
  assert.deepEqual(ids, [68448]);
}

function testGeekitemJsonFixture() {
  const details = parseGeekitemJson(
    {
      item: {
        objectid: 111661,
        description: "Test",
        links: {
          expandsboardgame: [{ objectid: "68448", name: "7 Wonders" }],
        },
      },
    },
    111661,
  );
  assert.ok(details);
  assert.deepEqual(details.expandsGameIds, [68448]);
}

function testCacheNormalizeExpandsGameIds() {
  const entry = normalizeCacheEntry({
    id: 111661,
    description: "Test",
    categories: [],
    mechanics: [],
    expandsGameIds: [68448, 68448],
    image: null,
    thumbnail: null,
  });
  assert.ok(entry);
  assert.deepEqual(entry.expandsGameIds, [68448]);
}

function testDbFieldsIncludeExpandsGameIds() {
  const d = thingDetailsToDbFields({
    id: 111661,
    description: null,
    categories: [],
    mechanics: [],
    expandsGameIds: [68448],
    image: null,
    thumbnail: null,
  });
  assert.deepEqual(d.expandsGameIds, [68448]);
}

const tests = [
  testGeekdoLinks,
  testBggXmlLinks,
  testGeekitemJsonFixture,
  testCacheNormalizeExpandsGameIds,
  testDbFieldsIncludeExpandsGameIds,
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
