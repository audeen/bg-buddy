/**
 * Tests für Erweiterungs-Verknüpfungen.
 * Nutzung: npm run test:expansion-links
 */
import assert from "node:assert/strict";
import { parseExpandsGameIdsFromBggXmlLinks } from "../lib/expansion-links";
import { thingDetailsToDbFields } from "../lib/bgg/db-fields";

function testBggXmlLinks() {
  const ids = parseExpandsGameIdsFromBggXmlLinks([
    { type: "boardgameexpansion", id: "68448", value: "7 Wonders", inbound: "true" },
    { type: "boardgameexpansion", id: "999", value: "Other", inbound: "false" },
  ]);
  assert.deepEqual(ids, [68448]);
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

const tests = [testBggXmlLinks, testDbFieldsIncludeExpandsGameIds];

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
