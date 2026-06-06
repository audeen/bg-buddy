import { PrismaClient } from "@prisma/client";
import {
  createAllDummyMeetups,
  creatorPickSum,
  DUMMY_MEETUP_PREFIX,
  DUMMY_SCENARIO_COUNT,
  expectedDuelPhase,
  isDummyMeetupTitle,
  poolSizeFromPicks,
  purgeDummyMeetups,
} from "../lib/dummy-meetups";
import { pairCount } from "../lib/duel-pairs";
import { FULL_THRESHOLD } from "../lib/vote-limits";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const prisma = new PrismaClient();

async function main() {
  assert(
    isDummyMeetupTitle(`${DUMMY_MEETUP_PREFIX}Direktduelle · dir 1 Pick`),
    "prefix matcher",
  );
  assert(!isDummyMeetupTitle("Echtes Treffen"), "real meetup not dummy");

  assert(pairCount(6) === FULL_THRESHOLD, "6 games at FULL threshold");
  assert(expectedDuelPhase(6) === "FULL", "6 -> FULL");
  assert(expectedDuelPhase(8) === "GROUP", "8 -> GROUP");

  const gameCount = await prisma.game.count({
    where: { isExpansion: false },
  });
  if (gameCount < 8) {
    console.log(
      `test-dummy-meetups: SKIP (need 8+ games, have ${gameCount})`,
    );
    return;
  }

  const user = await prisma.user.upsert({
    where: { name: "Dummy-Test-Runner" },
    update: {},
    create: { name: "Dummy-Test-Runner" },
  });

  await purgeDummyMeetups(prisma);

  const { meetupIds, count } = await createAllDummyMeetups(user.id, prisma);
  assert(count === DUMMY_SCENARIO_COUNT, `expected ${DUMMY_SCENARIO_COUNT} meetups`);
  assert(meetupIds.length === DUMMY_SCENARIO_COUNT, "meetup ids length");

  const duelVoteCount = await prisma.vote.count({
    where: {
      meetupId: { in: meetupIds },
      mode: "DUEL",
    },
  });
  assert(duelVoteCount === 0, "dummy meetups must have no duel votes");

  for (const label of [
    "Direktduelle · dir 3 Picks",
    "Direktduelle · dir 2 Picks",
    "Direktduelle · dir 1 Pick",
    "Gruppenduelle · dir 3 Picks",
    "Gruppenduelle · dir 2 Picks",
    "Gruppenduelle · dir 1 Pick",
  ]) {
    const meetup = await prisma.meetup.findFirst({
      where: { title: `${DUMMY_MEETUP_PREFIX}${label}` },
      include: {
        votes: {
          where: { mode: "PICK", playerCount: 4 },
          select: { userId: true, gameId: true, points: true },
        },
      },
    });
    assert(!!meetup, `missing ${label}`);

    const picks = meetup!.votes;
    const poolSize = poolSizeFromPicks(picks);
    const creatorSum = creatorPickSum(picks, user.id);
    const wantsLeft = label.includes("dir 3")
      ? 3
      : label.includes("dir 2")
        ? 2
        : 1;
    assert(
      creatorSum === 3 - wantsLeft,
      `${label}: creator has ${creatorSum}, expected ${3 - wantsLeft}`,
    );

    if (label.startsWith("Direktduelle")) {
      assert(poolSize === 6, `${label}: pool 6, got ${poolSize}`);
    } else {
      assert(poolSize === 8, `${label}: pool 8, got ${poolSize}`);
    }
  }

  const realMeetup = await prisma.meetup.create({
    data: {
      title: "Echtes Treffen (Test)",
      expectedPlayerCount: 4,
      createdById: user.id,
    },
  });

  const deleted = await purgeDummyMeetups(prisma);
  assert(
    deleted === DUMMY_SCENARIO_COUNT,
    `purge should delete ${DUMMY_SCENARIO_COUNT}, deleted ${deleted}`,
  );

  const realStill = await prisma.meetup.findUnique({
    where: { id: realMeetup.id },
  });
  assert(!!realStill, "real meetup survives purge");

  await prisma.meetup.delete({ where: { id: realMeetup.id } });
  await prisma.user.delete({ where: { id: user.id } });

  console.log("test-dummy-meetups: OK");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("FEHLER:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
