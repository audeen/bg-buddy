/**
 * Führt alle Unit-Test-Skripte sequenziell aus (npm test).
 *
 * Enthält nur Tests ohne Datenbank- oder Netzwerk-Abhängigkeit.
 * DB-Tests (test-meetup-guest-games, test-host-game-control,
 * test-pick-base-only, test-dummy-meetups) laufen separat über npm run test:*.
 */
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const UNIT_TESTS = [
  "test-expansion-links",
  "test-owned-expansions",
  "test-expansion-label",
  "test-expansion-detail",
  "test-duel-pairs",
  "test-duel-tiebreaker",
  "test-group-duels",
  "test-expansion-duel",
  "test-expansion-ranking",
  "test-winner-expansion-family",
  "test-pick-phase",
  "test-pick-points",
  "test-game-filters",
  "test-game-tags",
  "test-latest-game",
  "test-spotlight-pick",
  "test-effective-player-count",
  "test-barcode-lookup",
  "test-bgg-search",
  "test-bgg-thing-polls",
  "test-bgg-hotness",
  "test-cover-image",
  "test-bgg-gallery",
  "test-swipe-back",
];

let failed = 0;

for (const name of UNIT_TESTS) {
  const file = join("scripts", `${name}.ts`);
  const res = spawnSync("npx", ["tsx", file], {
    stdio: "inherit",
    cwd: process.cwd(),
  });
  if (res.status !== 0) {
    failed += 1;
    console.error(`FEHLGESCHLAGEN: ${name}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} von ${UNIT_TESTS.length} Test-Skripten fehlgeschlagen.`);
  process.exit(1);
}

console.log(`\nAlle ${UNIT_TESTS.length} Test-Skripte erfolgreich.`);
