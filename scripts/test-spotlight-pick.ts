/**
 * Tests für die Spotlight-Auswahl (Neuzugangs-Pool-Rotation).
 * Nutzung: npm run test:spotlight-pick
 */
import assert from "node:assert/strict";
import { pickLatestGameFromPool } from "../lib/spotlight-pick";

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

testEmptyAndSingle();
testFirstLatestPicksNewest();
testNoImmediateRepeat();
testRandomCoversPool();

console.log("test-spotlight-pick: all passed");
