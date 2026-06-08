import assert from "node:assert/strict";
import {
  buildExpansionConfigs,
  type ExpansionConfigGame,
} from "../lib/expansion-duel";
import {
  buildExpansionRankingEntries,
  coverByVoteGameIdForConfigs,
} from "../lib/expansion-ranking";

const base: ExpansionConfigGame = {
  id: 68448,
  name: "7 Wonders",
  thumbnail: "base-thumb.jpg",
  image: "base-image.jpg",
  minPlayers: 2,
  maxPlayers: 7,
};

const leaders: ExpansionConfigGame = {
  id: 111661,
  name: "Leaders",
  thumbnail: "leaders-thumb.jpg",
  image: null,
  minPlayers: 2,
  maxPlayers: 7,
};

const cities: ExpansionConfigGame = {
  id: 92539,
  name: "Cities",
  thumbnail: null,
  image: "cities-image.jpg",
  minPlayers: 2,
  maxPlayers: 8,
};

const configs = buildExpansionConfigs(base, [leaders, cities], [], 7);
assert.equal(configs.length, 3);

const gamesById = new Map([
  [base.id, base],
  [leaders.id, leaders],
  [cities.id, cities],
]);

const covers = coverByVoteGameIdForConfigs(configs, gamesById, base);
assert.equal(covers.get(base.id)?.thumbnail, "base-thumb.jpg");
assert.equal(covers.get(leaders.id)?.thumbnail, "leaders-thumb.jpg");
assert.equal(covers.get(cities.id)?.image, "cities-image.jpg");

// Duell-Paare: Basis vs Cities, Basis vs Leaders (kein Cities vs Leaders)
const votes = [
  { gameId: cities.id, opponentGameId: base.id, userId: "u1" },
  { gameId: cities.id, opponentGameId: base.id, userId: "u2" },
  { gameId: leaders.id, opponentGameId: base.id, userId: "u1" },
  { gameId: leaders.id, opponentGameId: base.id, userId: "u2" },
];

const ranking = buildExpansionRankingEntries(configs, votes, covers);
assert.equal(ranking.length, 3);
assert.equal(ranking[0]?.id, cities.id);
assert.equal(ranking[0]?.name, "7 Wonders · Cities");
assert.equal(ranking[0]?.points, 1);
assert.equal(ranking[0]?.duelWins, 1);
assert.equal(ranking[0]?.thumbnail, "cities-image.jpg");

assert.equal(ranking[1]?.id, leaders.id);
assert.equal(ranking[1]?.points, 1);

assert.equal(ranking[2]?.id, base.id);
assert.equal(ranking[2]?.points, 0);

console.log("test-expansion-ranking: ok");
