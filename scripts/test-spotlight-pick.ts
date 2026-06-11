/**
 * Tests für die Spotlight-Auswahl (GOTD vs. Latest, Pool-Rotation).
 * Nutzung: npm run test:spotlight-pick
 */
import assert from "node:assert/strict";
import {
  LATEST_VARIANT_PROBABILITY,
  pickLatestGameFromPool,
  pickSpotlightVariant,
} from "../lib/spotlight-pick";

function testVariantWithoutPool() {
  assert.equal(pickSpotlightVariant(false, true), "gotd");
  assert.equal(pickSpotlightVariant(false, false), "gotd");
}

function testVariantFirstVisit() {
  assert.equal(pickSpotlightVariant(true, true, () => 0.99), "latest");
}

function testVariantWeighting() {
  assert.equal(
    pickSpotlightVariant(true, false, () => LATEST_VARIANT_PROBABILITY - 0.01),
    "latest",
  );
  assert.equal(
    pickSpotlightVariant(true, false, () => LATEST_VARIANT_PROBABILITY),
    "gotd",
  );
  assert.equal(pickSpotlightVariant(true, false, () => 0.9), "gotd");
}

const pool = [{ id: 1 }, { id: 2 }, { id: 3 }];

function testEmptyAndSingle() {
  assert.equal(pickLatestGameFromPool([], null, true), null);
  assert.equal(pickLatestGameFromPool([{ id: 7 }], null, true)?.id, 7);
  // Einziges Spiel darf sich wiederholen.
  assert.equal(pickLatestGameFromPool([{ id: 7 }], 7, false)?.id, 7);
}

function testFirstLatestPicksNewest() {
  assert.equal(pickLatestGameFromPool(pool, null, true, () => 0.99)?.id, 1);
}

function testNoImmediateRepeat() {
  for (let i = 0; i < 50; i++) {
    const picked = pickLatestGameFromPool(pool, 2, false);
    assert.notEqual(picked?.id, 2, "zuletzt gezeigtes Spiel nie wiederholen");
  }
}

function testRandomCoversPool() {
  const seen = new Set<number>();
  let calls = 0;
  const random = () => {
    calls += 1;
    return ((calls * 7) % 10) / 10;
  };
  for (let i = 0; i < 30; i++) {
    const picked = pickLatestGameFromPool(pool, 1, false, random);
    if (picked) seen.add(picked.id);
  }
  assert.deepEqual([...seen].sort(), [2, 3], "rotiert über Pool ohne lastShownId");
}

testVariantWithoutPool();
testVariantFirstVisit();
testVariantWeighting();
testEmptyAndSingle();
testFirstLatestPicksNewest();
testNoImmediateRepeat();
testRandomCoversPool();

console.log("test-spotlight-pick: all passed");
