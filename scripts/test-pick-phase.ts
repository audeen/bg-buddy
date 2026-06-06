import { assessPickPhase } from "../lib/pick-phase";
import { MAX_PICK_POINTS } from "../lib/vote-limits";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function picksForUsers(
  users: string[],
  gameIds: number[],
): { userId: string; gameId: number; points: number }[] {
  const rows: { userId: string; gameId: number; points: number }[] = [];
  let gameIdx = 0;
  for (const userId of users) {
    for (let i = 0; i < MAX_PICK_POINTS; i++) {
      rows.push({
        userId,
        gameId: gameIds[gameIdx % gameIds.length],
        points: 1,
      });
      gameIdx += 1;
    }
  }
  return rows;
}

const fourUsers = ["u1", "u2", "u3", "u4"];
const twoGames = [1, 2];

// 4 users with 3/3, pool >= 2
const ready = assessPickPhase(
  picksForUsers(fourUsers, twoGames),
  4,
  0,
);
assert(ready.readyForDuels, "4/4 full pickers should be ready");
assert(!ready.picksLocked, "no duel votes yet");
assert(!ready.duelComplete, "no duels yet");
assert(ready.fullPickCount === 4, "fullPickCount 4");
assert(ready.missingCount === 0, "missingCount 0");

// 3/4 full, rest with 0 picks
const threeFull = assessPickPhase(
  picksForUsers(fourUsers.slice(0, 3), twoGames),
  4,
  0,
);
assert(!threeFull.readyForDuels, "3/4 should not be ready");
assert(threeFull.missingCount === 1, "missing one player");

// 4 users but one partial (2/3)
const partial = assessPickPhase(
  [
    ...picksForUsers(fourUsers.slice(0, 3), twoGames),
    { userId: "u4", gameId: 1, points: 2 },
  ],
  4,
  0,
);
assert(!partial.readyForDuels, "partial picker blocks ready");
assert(partial.partialPickers.length === 1, "one partial picker");
assert(partial.partialPickers[0]?.sum === 2, "partial sum 2");

// duel votes lock picks while duels run
const locked = assessPickPhase(picksForUsers(fourUsers, twoGames), 4, 1, false);
assert(locked.picksLocked, "in-progress duels lock ★ picks");
assert(!locked.duelComplete, "duels not complete");
assert(locked.readyForDuels, "still ready when picks complete");

// completed duels unlock ★ picks
const unlocked = assessPickPhase(picksForUsers(fourUsers, twoGames), 4, 10, true);
assert(!unlocked.picksLocked, "completed duels unlock ★ picks");
assert(unlocked.duelComplete, "duels complete");

// pool too small
const oneGame = assessPickPhase(
  picksForUsers(fourUsers, [1]),
  4,
  0,
);
assert(!oneGame.readyForDuels, "single game in pool not enough");

console.log("test-pick-phase: OK");
