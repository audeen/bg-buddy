import { PrismaClient } from "@prisma/client";
import {
  createAllDummyMeetups,
  DUMMY_MEETUP_PREFIX,
  ensureDummyUsers,
  isDummyMeetupTitle,
  verifyDummyDuelComplete,
} from "../lib/dummy-meetups";
import { getDuelProgressForCount } from "../lib/duel-pairs";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const prisma = new PrismaClient();

async function main() {
  assert(
    isDummyMeetupTitle(`${DUMMY_MEETUP_PREFIX}GROUP · fertig`),
    "prefix matcher",
  );
  assert(!isDummyMeetupTitle("Echtes Treffen"), "real meetup not dummy");

  const gameCount = await prisma.game.count({
    where: { isExpansion: false },
  });
  if (gameCount < 12) {
    console.log(
      `test-dummy-meetups: SKIP (need 12+ games, have ${gameCount})`,
    );
    return;
  }

  const user = await prisma.user.upsert({
    where: { name: "Dummy-Test-Runner" },
    update: {},
    create: { name: "Dummy-Test-Runner" },
  });

  await prisma.meetup.deleteMany({
    where: { title: { startsWith: DUMMY_MEETUP_PREFIX } },
  });

  const { meetupIds, count } = await createAllDummyMeetups(user.id, prisma);
  assert(count === 8, `expected 8 meetups, got ${count}`);
  assert(meetupIds.length === 8, "meetup ids length");

  await ensureDummyUsers(prisma);

  const titles = await prisma.meetup.findMany({
    where: { id: { in: meetupIds } },
    select: { title: true },
  });
  for (const m of titles) {
    assert(isDummyMeetupTitle(m.title), `title must have prefix: ${m.title}`);
  }

  const groupDone = await prisma.meetup.findFirst({
    where: { title: `${DUMMY_MEETUP_PREFIX}GROUP · fertig` },
    include: {
      votes: {
        select: {
          gameId: true,
          opponentGameId: true,
          userId: true,
          playerCount: true,
          mode: true,
          points: true,
        },
      },
    },
  });
  assert(!!groupDone, "GROUP · fertig meetup exists");

  const pickVotes = groupDone!.votes.filter((v) => v.mode === "PICK");
  const pickSum = pickVotes.reduce((s, v) => s + v.points, 0);
  assert(pickSum >= 12, `GROUP picks sum >= 12, got ${pickSum}`);

  const poolIds = [
    ...new Set(pickVotes.map((v) => v.gameId)),
  ].sort((a, b) => a - b);
  assert(poolIds.length === 12, `pool should be 12 games, got ${poolIds.length}`);

  const duelVotes = groupDone!.votes
    .filter((v) => v.mode === "DUEL")
    .map((v) => ({
      gameId: v.gameId,
      opponentGameId: v.opponentGameId,
      userId: v.userId,
      playerCount: v.playerCount,
    }));
  assert(
    verifyDummyDuelComplete(poolIds, duelVotes, 4),
    "GROUP · fertig should be duelComplete",
  );
  const progress = getDuelProgressForCount(poolIds, duelVotes, 4);
  assert(progress.duelComplete, "getDuelProgressForCount duelComplete");
  assert(progress.decidedPairs === 66, `expected 66 pairs, got ${progress.decidedPairs}`);

  const fullDone = await prisma.meetup.findFirst({
    where: { title: `${DUMMY_MEETUP_PREFIX}FULL · fertig` },
    include: {
      votes: {
        where: { mode: "DUEL" },
        select: {
          gameId: true,
          opponentGameId: true,
          userId: true,
          playerCount: true,
        },
      },
    },
  });
  assert(!!fullDone, "FULL · fertig meetup exists");

  const fullPool = [
    ...new Set(
      (
        await prisma.vote.findMany({
          where: { meetupId: fullDone!.id, mode: "PICK" },
          select: { gameId: true },
        })
      ).map((v) => v.gameId),
    ),
  ];
  assert(fullPool.length === 6, "FULL pool has 6 games");

  const fullProgress = getDuelProgressForCount(
    fullPool,
    fullDone!.votes,
    4,
  );
  assert(fullProgress.decidedPairs === 15, "FULL decided 15 pairs");
  assert(fullProgress.duelComplete, "FULL duelComplete");

  const realMeetup = await prisma.meetup.create({
    data: {
      title: "Echtes Treffen (Test)",
      expectedPlayerCount: 4,
      createdById: user.id,
    },
  });

  const purge = await prisma.meetup.deleteMany({
    where: { title: { startsWith: DUMMY_MEETUP_PREFIX } },
  });
  assert(purge.count === 8, `purge should delete 8, deleted ${purge.count}`);

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
