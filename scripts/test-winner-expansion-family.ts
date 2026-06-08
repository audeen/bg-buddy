import assert from "node:assert/strict";
import { isPlayableAtCount } from "../lib/effective-player-count";
import {
  mandatoryExpansionKeysForWinner,
  mandatoryExpansionKeys,
} from "../lib/meetup-mandatory-data";

const winnerId = 100;
const expansions = [
  { id: 200, name: "5-6", minPlayers: 3, maxPlayers: 6 },
  { id: 201, name: "Seefahrer", minPlayers: 3, maxPlayers: 4 },
];

const at6 = expansions.filter((e) =>
  isPlayableAtCount(e.minPlayers, e.maxPlayers, 6),
);
assert.equal(at6.length, 1);
assert.equal(at6[0]?.id, 200);

const at4 = expansions.filter((e) =>
  isPlayableAtCount(e.minPlayers, e.maxPlayers, 4),
);
assert.equal(at4.length, 2);

const keys = mandatoryExpansionKeysForWinner(
  [
    { baseGameId: 100, expansionGameId: 200 },
    { baseGameId: 99, expansionGameId: 300 },
  ],
  winnerId,
);
assert.deepEqual(keys, ["100:200"]);

assert.deepEqual(
  mandatoryExpansionKeys([{ baseGameId: 1, expansionGameId: 2 }]),
  ["1:2"],
);

console.log("test-winner-expansion-family: ok");
