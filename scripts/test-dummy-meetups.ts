import { PrismaClient } from "@prisma/client";
import {
  completeDummyDuelsForMeetup,
  createAllDummyMeetups,
  createGroupConcentratedMeetup,
  createGroupReadyMeetup,
  creatorPickSum,
  DUMMY_MEETUP_PREFIX,
  DUMMY_SCENARIO_COUNT,
  ensureDummyUsers,
  expectedDuelPhase,
  isDummyMeetupTitle,
  poolSizeFromPicks,
  purgeDummyMeetups,
} from "../lib/dummy-meetups";
import {
  buildDuelFrozenSnapshot,
  buildDuellPlan,
  buildUserPointsMap,
  duelParticipantIds,
  pairCount,
} from "../lib/duel-pairs";
import { assessPickPhase } from "../lib/pick-phase";
import { FULL_THRESHOLD } from "../lib/vote-limits";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function assertOwnPickRepresentation(
  userId: string,
  ownPoints: Record<number, number>,
  pairs: { a: number; b: number }[],
) {
  const ownGameIds = new Set(
    Object.entries(ownPoints)
      .filter(([, pts]) => (pts ?? 0) > 0)
      .map(([g]) => Number(g)),
  );
  const seen = new Map<number, number>();
  for (const p of pairs) {
    assert(
      !(ownGameIds.has(p.a) && ownGameIds.has(p.b)),
      `user ${userId} must not judge own-vs-own pair ${p.a}:${p.b}`,
    );
    for (const g of [p.a, p.b]) {
      if (ownGameIds.has(g)) {
        seen.set(g, (seen.get(g) ?? 0) + 1);
      }
    }
  }
  for (const g of ownGameIds) {
    const count = seen.get(g) ?? 0;
    assert(
      count <= (ownPoints[g] ?? 0),
      `user ${userId} own game ${g} represented ${count}x, max ${ownPoints[g]}`,
    );
  }
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

  const dummyUsers = await ensureDummyUsers(prisma);
  const dummyPickerIds = new Set([
    dummyUsers.alice,
    dummyUsers.bob,
    dummyUsers.carol,
  ]);

  const { meetupIds, count } = await createAllDummyMeetups(user.id, prisma);
  assert(count === DUMMY_SCENARIO_COUNT, `expected ${DUMMY_SCENARIO_COUNT} meetups`);
  assert(meetupIds.length === DUMMY_SCENARIO_COUNT, "meetup ids length");

  const duelVoteCount = await prisma.vote.count({
    where: {
      round: { meetupId: { in: meetupIds } },
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
        rounds: {
          include: {
            votes: {
              where: { mode: "PICK", playerCount: 4 },
              select: { userId: true, gameId: true, points: true },
            },
          },
        },
      },
    });
    assert(!!meetup, `missing ${label}`);

    const picks = meetup!.rounds.flatMap((r) => r.votes);
    const poolSize = poolSizeFromPicks(picks);

    for (const pickerId of dummyPickerIds) {
      const sum = picks
        .filter((p) => p.userId === pickerId)
        .reduce((s, p) => s + p.points, 0);
      assert(sum === 3, `${label}: dummy picker ${pickerId} has ${sum}/3 picks`);
    }

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

  const allReadyMeetup = await prisma.meetup.findFirst({
    where: { title: `${DUMMY_MEETUP_PREFIX}Duell bereit · 4/4` },
    include: {
      rounds: {
        include: {
          votes: {
            where: { mode: "PICK", playerCount: 4 },
            select: { userId: true, gameId: true, points: true },
          },
        },
      },
    },
  });
  assert(!!allReadyMeetup, "missing Duell bereit · 4/4");
  const allReadyPicks = allReadyMeetup!.rounds.flatMap((r) => r.votes);
  const allReadyPhase = assessPickPhase(allReadyPicks, 4, 0);
  assert(allReadyPhase.readyForDuels, "Duell bereit · 4/4: should be duell-ready");
  assert(
    poolSizeFromPicks(allReadyPicks) === 6,
    "Duell bereit · 4/4: pool 6",
  );
  for (const dummyId of dummyUsers.all) {
    const sum = allReadyPicks
      .filter((p) => p.userId === dummyId)
      .reduce((s, p) => s + p.points, 0);
    assert(sum === 3, `Duell bereit · 4/4: ${dummyId} has ${sum}/3 picks`);
  }

  const completeRes = await completeDummyDuelsForMeetup(
    allReadyMeetup!.id,
    prisma,
  );
  assert(!("error" in completeRes), "complete dummy duels should succeed");
  if ("error" in completeRes) throw new Error(completeRes.error);
  assert(
    completeRes.votesAdded > 0,
    `expected duel votes added, got ${completeRes.votesAdded}`,
  );

  const dummyDuelVotes = await prisma.vote.count({
    where: {
      round: { meetupId: allReadyMeetup!.id },
      mode: "DUEL",
      userId: { in: [...dummyUsers.all] },
    },
  });
  assert(dummyDuelVotes > 0, "dummy users should have duel votes");

  // GROUP phase with 4/4 full picks: each dummy user sees own picks at most once.
  const groupReady = await createGroupReadyMeetup(user.id, prisma);
  const groupMeetup = await prisma.meetup.findUnique({
    where: { id: groupReady.meetupId },
    include: {
      rounds: {
        include: {
          votes: {
            where: { mode: "PICK", playerCount: 4 },
            select: { userId: true, gameId: true, points: true },
          },
        },
      },
    },
  });
  assert(!!groupMeetup, "group ready meetup exists");
  const groupPicks = groupMeetup!.rounds.flatMap((r) => r.votes);
  assert(
    assessPickPhase(groupPicks, 4, 0).readyForDuels,
    "group ready: all four participants duell-ready",
  );
  assert(poolSizeFromPicks(groupPicks) === 8, "group ready: pool 8");
  assert(expectedDuelPhase(8) === "GROUP", "8 games -> GROUP");

  const frozen = buildDuelFrozenSnapshot({
    playerCount: 4,
    picks: groupPicks,
    poolGameIds: groupReady.poolGameIds,
  });
  assert(frozen.phase === "GROUP", "frozen snapshot is GROUP");
  assert(frozen.assignments != null, "frozen has assignments");

  const assignedTotal = Object.values(frozen.assignments!).reduce(
    (sum, list) => sum + list.length,
    0,
  );
  assert(
    assignedTotal + (frozen.autoPairs?.length ?? 0) === pairCount(8),
    "all 28 pairs accounted for in group ready snapshot",
  );

  const userPoints = buildUserPointsMap(groupPicks);
  const participantIds = duelParticipantIds(groupPicks);
  assert(participantIds.length === 4, "four duel participants in group ready");

  for (const userId of dummyUsers.all) {
    const plan = buildDuellPlan({
      poolGameIds: groupReady.poolGameIds,
      pickCounts: frozen.pickCounts,
      userPoints,
      userId,
      participantIds,
      meetupId: groupReady.meetupId,
      frozen,
    });
    assert(plan.phase === "GROUP", `user ${userId}: GROUP phase`);
    assert(plan.myPairs.length >= 1, `user ${userId} gets at least one pair`);
    assertOwnPickRepresentation(userId, userPoints[userId] ?? {}, plan.myPairs);
  }

  const groupComplete = await completeDummyDuelsForMeetup(
    groupReady.meetupId,
    prisma,
  );
  assert(!("error" in groupComplete), "complete group dummy duels should succeed");
  if ("error" in groupComplete) throw new Error(groupComplete.error);
  assert(
    groupComplete.votesAdded > 0,
    `group ready: expected duel votes added, got ${groupComplete.votesAdded}`,
  );

  const groupRound = await prisma.meetupRound.findUnique({
    where: { id: groupReady.roundId },
    select: { duelFrozenData: true },
  });
  assert(groupRound?.duelFrozenData != null, "group ready: duelFrozenData persisted");

  // GROUP phase with one player concentrating 3 points on a single game.
  const concentrated = await createGroupConcentratedMeetup(user.id, prisma);
  const concMeetup = await prisma.meetup.findUnique({
    where: { id: concentrated.meetupId },
    include: {
      rounds: {
        include: {
          votes: {
            where: { mode: "PICK", playerCount: 4 },
            select: { userId: true, gameId: true, points: true },
          },
        },
      },
    },
  });
  assert(!!concMeetup, "concentrated group meetup exists");
  const concPicks = concMeetup!.rounds.flatMap((r) => r.votes);
  assert(
    assessPickPhase(concPicks, 4, 0).readyForDuels,
    "concentrated: all four participants duell-ready",
  );
  const concFrozen = buildDuelFrozenSnapshot({
    playerCount: 4,
    picks: concPicks,
    poolGameIds: concentrated.poolGameIds,
  });
  const concUserPoints = buildUserPointsMap(concPicks);
  const concParticipants = duelParticipantIds(concPicks);
  const concPlan = buildDuellPlan({
    poolGameIds: concentrated.poolGameIds,
    pickCounts: concFrozen.pickCounts,
    userPoints: concUserPoints,
    userId: concentrated.concentratedUserId,
    participantIds: concParticipants,
    meetupId: concentrated.meetupId,
    frozen: concFrozen,
  });
  assert(concPlan.phase === "GROUP", "concentrated: GROUP phase");
  const concGameId = concentrated.concentratedGameId;
  const withConcGame = concPlan.myPairs.filter(
    (p) => p.a === concGameId || p.b === concGameId,
  );
  assert(
    withConcGame.length === 3,
    `concentrated user must get 3 duels for game ${concGameId}, got ${withConcGame.length}`,
  );
  for (const p of withConcGame) {
    const other = p.a === concGameId ? p.b : p.a;
    assert(
      (concUserPoints[concentrated.concentratedUserId]?.[other] ?? 0) === 0,
      `concentrated duel must be vs non-own game, got ${p.a}:${p.b}`,
    );
  }
  assertOwnPickRepresentation(
    concentrated.concentratedUserId,
    concUserPoints[concentrated.concentratedUserId] ?? {},
    concPlan.myPairs,
  );

  const concComplete = await completeDummyDuelsForMeetup(
    concentrated.meetupId,
    prisma,
  );
  assert(!("error" in concComplete), "complete concentrated dummy duels should succeed");
  if ("error" in concComplete) throw new Error(concComplete.error);
  assert(
    concComplete.votesAdded > 0,
    `concentrated: expected duel votes added, got ${concComplete.votesAdded}`,
  );
  const concRound = await prisma.meetupRound.findUnique({
    where: { id: concentrated.roundId },
    select: { duelFrozenData: true },
  });
  assert(concRound?.duelFrozenData != null, "concentrated: duelFrozenData persisted");

  const realMeetup = await prisma.meetup.create({
    data: {
      title: "Echtes Treffen (Test)",
      createdById: user.id,
      rounds: {
        create: {
          sortOrder: 0,
          expectedPlayerCount: 4,
          initialExpectedPlayerCount: 4,
          registrationPeakCount: 1,
        },
      },
    },
  });

  const deleted = await purgeDummyMeetups(prisma);
  assert(
    deleted === DUMMY_SCENARIO_COUNT + 2,
    `purge should delete ${DUMMY_SCENARIO_COUNT + 2}, deleted ${deleted}`,
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
