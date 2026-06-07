/**
 * Schnelltests für zweisprachigen Enrichment-Cache.
 * Nutzung: npm run test:enrichment-cache
 */
import assert from "node:assert/strict";
import {
  normalizeCacheEntry,
  thingDetailsToDbFields,
  localizedEnrichmentFields,
  hasEnrichmentContent,
} from "../lib/enrichment-cache";
import { translateTaxonomy } from "../lib/bgg-taxonomy-de";

function testNormalizeLegacyEnOnly() {
  const entry = normalizeCacheEntry({
    id: 13,
    description: "English text",
    categories: ["Economic"],
    mechanics: ["Trading"],
    image: null,
    thumbnail: null,
  });
  assert.ok(entry);
  assert.equal(entry.description, "English text");
  assert.equal(entry.descriptionDe, undefined);
  assert.deepEqual(entry.categories, ["Economic"]);
}

function testNormalizeBilingual() {
  const entry = normalizeCacheEntry({
    id: 13,
    description: "English",
    descriptionDe: "Deutsch",
    categories: ["Economic"],
    categoriesDe: ["Wirtschaft"],
    mechanics: ["Trading"],
    mechanicsDe: ["Tauschhandel"],
    image: "https://example.com/a.jpg",
    thumbnail: null,
  });
  assert.ok(entry);
  assert.equal(entry.descriptionDe, "Deutsch");
  assert.deepEqual(entry.categoriesDe, ["Wirtschaft"]);
}

function testDbFieldsPreferDe() {
  const d = thingDetailsToDbFields({
    id: 1,
    description: "EN",
    descriptionDe: "DE",
    categories: ["Card Game"],
    categoriesDe: ["Kartenspiel"],
    mechanics: [],
    mechanicsDe: ["Handmanagement"],
    image: null,
    thumbnail: null,
  });
  assert.equal(d.description, "DE");
  assert.deepEqual(d.categories, ["Card Game"]);
  assert.deepEqual(d.mechanics, []);
  assert.equal(d.enriched, true);
}

function testDbFieldsFallbackEn() {
  const d = thingDetailsToDbFields({
    id: 1,
    description: "EN only",
    categories: ["Dice"],
    mechanics: ["Dice Rolling"],
    image: null,
    thumbnail: null,
  });
  assert.equal(d.description, "EN only");
  assert.deepEqual(d.categories, ["Dice"]);
}

function testHasEnrichmentContentDeOnly() {
  assert.equal(
    hasEnrichmentContent({
      id: 1,
      description: null,
      descriptionDe: "Nur DE",
      categories: [],
      mechanics: [],
      image: null,
      thumbnail: null,
    }),
    true,
  );
}

function testTaxonomyTranslation() {
  const labels = translateTaxonomy(["Card Game", "Hand Management"]);
  assert.deepEqual(labels, ["Kartenspiel", "Handmanagement"]);
}

function testLocalizedFields() {
  const loc = localizedEnrichmentFields({
    id: 1,
    description: "EN",
    descriptionDe: "DE",
    categories: ["Economic"],
    categoriesDe: ["Wirtschaft"],
    mechanics: ["Trading"],
    mechanicsDe: [],
    image: null,
    thumbnail: null,
  });
  assert.equal(loc.description, "DE");
  assert.deepEqual(loc.categories, ["Economic"]);
  assert.deepEqual(loc.mechanics, ["Trading"]);
}

const tests = [
  testNormalizeLegacyEnOnly,
  testNormalizeBilingual,
  testDbFieldsPreferDe,
  testDbFieldsFallbackEn,
  testHasEnrichmentContentDeOnly,
  testTaxonomyTranslation,
  testLocalizedFields,
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
