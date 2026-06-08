import assert from "node:assert/strict";
import {
  buildExpansionConfigs,
  buildExpansionCopelandWins,
  buildExpansionDuelPairs,
  expansionConfigsNeedDuel,
  pickExpansionWinner,
} from "../lib/expansion-duel";

const base = {
  id: 100,
  name: "Catan",
  thumbnail: null,
  image: null,
  minPlayers: 3,
  maxPlayers: 4,
};

const fiveSix = {
  id: 200,
  name: "5-6 Player",
  thumbnail: null,
  image: null,
  minPlayers: 3,
  maxPlayers: 6,
};

const seefahrer = {
  id: 201,
  name: "Seefahrer",
  thumbnail: null,
  image: null,
  minPlayers: 3,
  maxPlayers: 4,
};

const cities = {
  id: 300,
  name: "Cities",
  thumbnail: null,
  image: null,
  minPlayers: 2,
  maxPlayers: 8,
};

// Pflicht-Erweiterung nicht im Duell-Pool; optional nur wenn bei N spielbar
const catan6Mandatory = buildExpansionConfigs(
  base,
  [fiveSix, seefahrer],
  [fiveSix.id],
  6,
);
assert.equal(catan6Mandatory.length, 1, "Seefahrer max 4 — bei 6 nur Basis+Pflicht");
assert.equal(catan6Mandatory[0]?.label, "Catan · 5-6 Player");
assert.ok(!expansionConfigsNeedDuel(catan6Mandatory));

const catan4Optional = buildExpansionConfigs(
  base,
  [fiveSix, seefahrer],
  [],
  4,
);
assert.equal(catan4Optional.length, 3);
assert.equal(buildExpansionDuelPairs(catan4Optional).length, 2);

// 7 Wonders: Basis vs Cities + Leaders
const sevenBase = {
  id: 68448,
  name: "7 Wonders",
  thumbnail: null,
  image: null,
  minPlayers: 2,
  maxPlayers: 7,
};
const leaders = {
  id: 111661,
  name: "Leaders",
  thumbnail: null,
  image: null,
  minPlayers: 2,
  maxPlayers: 7,
};
const configs = buildExpansionConfigs(
  sevenBase,
  [cities, leaders],
  [],
  4,
);
assert.equal(configs.length, 3);
assert.equal(buildExpansionDuelPairs(configs).length, 2);

const wins = buildExpansionCopelandWins(configs, [
  { gameId: cities.id, opponentGameId: sevenBase.id, userId: "u1" },
  { gameId: cities.id, opponentGameId: sevenBase.id, userId: "u2" },
  { gameId: leaders.id, opponentGameId: sevenBase.id, userId: "u1" },
]);
const winner = pickExpansionWinner(configs, wins);
assert.equal(winner?.voteGameId, cities.id);

console.log("test-expansion-duel: ok");
