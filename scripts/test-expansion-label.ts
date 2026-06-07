/**
 * Tests für expansionCountLabel / expansionAvailableLabel / expansionViewLabel.
 * Nutzung: npm run test:expansion-label
 */
import assert from "node:assert/strict";
import {
  expansionAvailableLabel,
  expansionCountLabel,
  expansionRequiredForCountLabel,
  expansionViewLabel,
} from "../lib/expansion-label";

function testSingular() {
  assert.equal(expansionCountLabel(1), "1 Erweiterung");
  assert.equal(expansionAvailableLabel(1), "1 Erweiterung verfügbar");
}

function testPlural() {
  assert.equal(expansionCountLabel(2), "2 Erweiterungen");
  assert.equal(expansionCountLabel(5), "5 Erweiterungen");
  assert.equal(expansionAvailableLabel(3), "3 Erweiterungen verfügbar");
}

function testExpansionViewLabelShort() {
  assert.equal(expansionViewLabel("Catan"), "Erweitert: Catan");
}

function testExpansionViewLabelTruncated() {
  assert.equal(
    expansionViewLabel("The Starfarers of Catan"),
    "Erweitert: The Starfarers…",
  );
}

function testExpansionRequiredForCountLabelSingular() {
  assert.equal(
    expansionRequiredForCountLabel(["7 Wonders: Cities"], 8),
    'Nur mit Erweiterung „7 Wonders: Cities" für 8 Personen spielbar',
  );
}

function testExpansionRequiredForCountLabelPlural() {
  assert.equal(
    expansionRequiredForCountLabel(["Cities", "Leaders"], 8),
    'Nur mit Erweiterungen „Cities", „Leaders" für 8 Personen spielbar',
  );
}

const tests = [
  testSingular,
  testPlural,
  testExpansionViewLabelShort,
  testExpansionViewLabelTruncated,
  testExpansionRequiredForCountLabelSingular,
  testExpansionRequiredForCountLabelPlural,
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
