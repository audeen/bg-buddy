import type { PrismaClient } from "@prisma/client";
import { completedPairKeysForUser } from "@/lib/copeland";
import {
  buildDuelFrozenSnapshot,
  buildDuellPlan,
  buildUserPointsMap,
  duelFrozenToJson,
  duelParticipantIds,
  pairCount,
  pairKey,
  parseDuelFrozenData,
  type DuelPair,
} from "@/lib/duel-pairs";
import { getPickPhaseState } from "@/lib/pick-phase";
import { prisma } from "@/lib/prisma";
import { poolGameIds, buildPickCounts } from "@/lib/pick-pool";
import { MAX_PICK_POINTS } from "@/lib/vote-limits";

export const DUMMY_MEETUP_PREFIX = "🧪 Dummy: ";

export const DUMMY_SCENARIO_COUNT = 7;

export const DUMMY_USER_NAMES = [
  "Dummy Alice",
  "Dummy Bob",
  "Dummy Carol",
  "Dummy Dave",
] as const;

const EXPECTED = 4;

/** 6 games = 15 pairs → Direktduelle (FULL). 8 games = 28 pairs → Gruppenduelle. */
export const DUMMY_POOL_FULL_SIZE = 6;
export const DUMMY_POOL_GROUP_SIZE = 8;
const POOL_FULL = DUMMY_POOL_FULL_SIZE;
const POOL_GROUP = DUMMY_POOL_GROUP_SIZE;

type PickRow = { userId: string; gameId: number; points: number };

type DummyUsers = {
  alice: string;
  bob: string;
  carol: string;
  dave: string;
  all: string[];
};

type Scenario = {
  label: string;
  poolSize: number;
  /** How many picks the logged-in creator still needs (1–3). */
  creatorPicksLeft?: 1 | 2 | 3;
  /** All four dummy users with 3/3 picks — duell-ready. */
  allReady?: boolean;
  /**
   * Offset in days relative to "now" for the scheduled date.
   * Negative values create past meetups so the "Vergangene Treffen" section
   * is testable in the dev environment.
   */
  dayOffset: number;
};

const SCENARIOS: Scenario[] = [
  { label: "Direktduelle · dir 3 Picks", poolSize: POOL_FULL, creatorPicksLeft: 3, dayOffset: -10 },
  { label: "Direktduelle · dir 2 Picks", poolSize: POOL_FULL, creatorPicksLeft: 2, dayOffset: -3 },
  { label: "Direktduelle · dir 1 Pick", poolSize: POOL_FULL, creatorPicksLeft: 1, dayOffset: 2 },
  { label: "Gruppenduelle · dir 3 Picks", poolSize: POOL_GROUP, creatorPicksLeft: 3, dayOffset: 5 },
  { label: "Gruppenduelle · dir 2 Picks", poolSize: POOL_GROUP, creatorPicksLeft: 2, dayOffset: 9 },
  { label: "Gruppenduelle · dir 1 Pick", poolSize: POOL_GROUP, creatorPicksLeft: 1, dayOffset: 14 },
  { label: "Duell bereit · 4/4", poolSize: POOL_FULL, allReady: true, dayOffset: 21 },
];

/** Scheduled date at 18:00 local time, `dayOffset` days from now. */
function scheduledAtFromOffset(dayOffset: number, now: Date = new Date()): Date {
  const d = new Date(now);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(18, 0, 0, 0);
  return d;
}

export async function ensureDummyUsers(
  db: PrismaClient = prisma,
): Promise<DummyUsers> {
  const ids: string[] = [];
  for (const name of DUMMY_USER_NAMES) {
    const user = await db.user.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    ids.push(user.id);
  }
  const [alice, bob, carol, dave] = ids;
  return { alice, bob, carol, dave, all: ids };
}

export async function eligibleGameIds(
  n: number,
  playerCount: number,
  db: PrismaClient = prisma,
): Promise<number[]> {
  const games = await db.game.findMany({
    where: {
      isExpansion: false,
      AND: [
        {
          OR: [{ minPlayers: null }, { minPlayers: { lte: playerCount } }],
        },
        {
          OR: [{ maxPlayers: null }, { maxPlayers: { gte: playerCount } }],
        },
      ],
    },
    orderBy: { name: "asc" },
    take: n,
    select: { id: true },
  });
  return games.map((g) => g.id);
}

export async function countDummyMeetups(
  db: PrismaClient = prisma,
): Promise<number> {
  return db.meetup.count({
    where: { title: { startsWith: DUMMY_MEETUP_PREFIX } },
  });
}

export async function purgeDummyMeetups(
  db: PrismaClient = prisma,
): Promise<number> {
  const result = await db.meetup.deleteMany({
    where: { title: { startsWith: DUMMY_MEETUP_PREFIX } },
  });
  return result.count;
}

function dummyPicksForPool(users: DummyUsers, pool: number[]): PickRow[] {
  const pickers = [users.alice, users.bob, users.carol];
  const picks: PickRow[] = [];
  let gameIdx = 0;
  for (const userId of pickers) {
    for (let i = 0; i < MAX_PICK_POINTS; i++) {
      picks.push({
        userId,
        gameId: pool[gameIdx % pool.length],
        points: 1,
      });
      gameIdx += 1;
    }
  }
  return picks;
}

function pickDuelWinner(
  pair: DuelPair,
  pickCounts: Record<number, number>,
): number {
  const weightA = pickCounts[pair.a] ?? 0;
  const weightB = pickCounts[pair.b] ?? 0;
  if (weightA > weightB) return pair.a;
  if (weightB > weightA) return pair.b;
  return Math.min(pair.a, pair.b);
}

function fullPicksForAll(users: DummyUsers, pool: number[]): PickRow[] {
  const picks: PickRow[] = [];
  let gameIdx = 0;
  for (const userId of users.all) {
    for (let i = 0; i < MAX_PICK_POINTS; i++) {
      picks.push({
        userId,
        gameId: pool[gameIdx % pool.length],
        points: 1,
      });
      gameIdx += 1;
    }
  }
  return picks;
}

function creatorPicks(
  createdById: string,
  pool: number[],
  picksLeft: 1 | 2 | 3,
): PickRow[] {
  const alreadySet = MAX_PICK_POINTS - picksLeft;
  if (alreadySet <= 0) return [];

  const picks: PickRow[] = [];
  let remaining = alreadySet;
  for (const gameId of pool) {
    if (remaining <= 0) break;
    const points = Math.min(remaining, MAX_PICK_POINTS);
    picks.push({ userId: createdById, gameId, points });
    remaining -= points;
  }
  return picks;
}

async function createMeetup(
  db: PrismaClient,
  createdById: string,
  label: string,
  scheduledAt: Date | null,
): Promise<{ meetupId: string; roundId: string }> {
  const meetup = await db.meetup.create({
    data: {
      title: `${DUMMY_MEETUP_PREFIX}${label}`,
      scheduledAt,
      createdById,
      rounds: {
        create: {
          sortOrder: 0,
          expectedPlayerCount: EXPECTED,
          initialExpectedPlayerCount: EXPECTED,
          registrationPeakCount: 1,
        },
      },
    },
    include: { rounds: { select: { id: true } } },
  });
  return { meetupId: meetup.id, roundId: meetup.rounds[0].id };
}

async function insertPicks(
  db: PrismaClient,
  roundId: string,
  picks: PickRow[],
  playerCount = EXPECTED,
): Promise<void> {
  if (picks.length === 0) return;
  await db.vote.createMany({
    data: picks.map((p) => ({
      roundId,
      userId: p.userId,
      gameId: p.gameId,
      playerCount,
      points: p.points,
      mode: "PICK" as const,
    })),
  });
}

export async function createAllDummyMeetups(
  createdById: string,
  db: PrismaClient = prisma,
): Promise<{ meetupIds: string[]; count: number }> {
  await purgeDummyMeetups(db);

  const users = await ensureDummyUsers(db);
  const games = await eligibleGameIds(POOL_GROUP, EXPECTED, db);
  if (games.length < POOL_GROUP) {
    throw new Error(
      `Mindestens ${POOL_GROUP} spielbare Spiele nötig (gefunden: ${games.length}). Bitte zuerst eine Sammlung importieren.`,
    );
  }

  const meetupIds: string[] = [];

  for (const scenario of SCENARIOS) {
    const pool = games.slice(0, scenario.poolSize);
    const picks = scenario.allReady
      ? fullPicksForAll(users, pool)
      : [
          ...dummyPicksForPool(users, pool),
          ...creatorPicks(createdById, pool, scenario.creatorPicksLeft ?? 3),
        ];
    const { meetupId, roundId } = await createMeetup(
      db,
      createdById,
      scenario.label,
      scheduledAtFromOffset(scenario.dayOffset),
    );
    await insertPicks(db, roundId, picks);
    meetupIds.push(meetupId);
  }

  return { meetupIds, count: meetupIds.length };
}

/** 8-game pool, all four dummy users at 3/3 — GROUP phase, duell-ready. */
export async function createGroupReadyMeetup(
  createdById: string,
  db: PrismaClient = prisma,
): Promise<{ meetupId: string; roundId: string; poolGameIds: number[] }> {
  const users = await ensureDummyUsers(db);
  const games = await eligibleGameIds(POOL_GROUP, EXPECTED, db);
  if (games.length < POOL_GROUP) {
    throw new Error(
      `Mindestens ${POOL_GROUP} spielbare Spiele nötig (gefunden: ${games.length}).`,
    );
  }
  const pool = games.slice(0, POOL_GROUP);
  const picks = fullPicksForAll(users, pool);
  const { meetupId, roundId } = await createMeetup(
    db,
    createdById,
    "Gruppenduelle · 4/4 (Test)",
    scheduledAtFromOffset(28),
  );
  await insertPicks(db, roundId, picks);
  return { meetupId, roundId, poolGameIds: pool };
}

function distributedPicksForUser(
  userId: string,
  pool: number[],
  startIdx: number,
): PickRow[] {
  const picks: PickRow[] = [];
  for (let i = 0; i < MAX_PICK_POINTS; i++) {
    picks.push({
      userId,
      gameId: pool[(startIdx + i) % pool.length],
      points: 1,
    });
  }
  return picks;
}

/** 8-game pool, Alice 3/3 on one game, others 3/3 distributed — GROUP, duell-ready. */
export async function createGroupConcentratedMeetup(
  createdById: string,
  db: PrismaClient = prisma,
): Promise<{
  meetupId: string;
  roundId: string;
  poolGameIds: number[];
  concentratedUserId: string;
  concentratedGameId: number;
}> {
  const users = await ensureDummyUsers(db);
  const games = await eligibleGameIds(POOL_GROUP, EXPECTED, db);
  if (games.length < POOL_GROUP) {
    throw new Error(
      `Mindestens ${POOL_GROUP} spielbare Spiele nötig (gefunden: ${games.length}).`,
    );
  }
  const pool = games.slice(0, POOL_GROUP);
  const concentratedGameId = pool[0];
  const picks: PickRow[] = [
    { userId: users.alice, gameId: concentratedGameId, points: 3 },
    ...distributedPicksForUser(users.bob, pool, 1),
    ...distributedPicksForUser(users.carol, pool, 4),
    ...distributedPicksForUser(users.dave, pool, 7),
  ];
  const { meetupId, roundId } = await createMeetup(
    db,
    createdById,
    "Gruppenduelle · 3 Punkte (Test)",
    scheduledAtFromOffset(35),
  );
  await insertPicks(db, roundId, picks);
  return {
    meetupId,
    roundId,
    poolGameIds: pool,
    concentratedUserId: users.alice,
    concentratedGameId,
  };
}

export function expectedDuelPhase(poolSize: number): "FULL" | "GROUP" {
  return pairCount(poolSize) <= 15 ? "FULL" : "GROUP";
}

export function creatorPickSum(
  picks: PickRow[],
  creatorId: string,
): number {
  return picks
    .filter((p) => p.userId === creatorId)
    .reduce((s, p) => s + p.points, 0);
}

export function poolSizeFromPicks(picks: PickRow[]): number {
  return poolGameIds(buildPickCounts(picks)).length;
}

export function isDummyMeetupTitle(title: string): boolean {
  return title.startsWith(DUMMY_MEETUP_PREFIX);
}

export async function completeDummyDuelsForMeetup(
  meetupId: string,
  db: PrismaClient = prisma,
): Promise<{ ok: true; votesAdded: number } | { error: string }> {
  const meetup = await db.meetup.findUnique({
    where: { id: meetupId },
    select: {
      title: true,
      rounds: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          expectedPlayerCount: true,
          duelFrozenData: true,
        },
      },
    },
  });
  if (!meetup) return { error: "Treffen nicht gefunden." };
  if (!isDummyMeetupTitle(meetup.title)) {
    return { error: "Nur für Dummy-Treffen verfügbar." };
  }
  const round = meetup.rounds[0];
  if (!round) return { error: "Spielrunde nicht gefunden." };

  const roundId = round.id;
  const playerCount = round.expectedPlayerCount;
  const phase = await getPickPhaseState(roundId, playerCount, db);
  if (phase.duelComplete) {
    return { error: "Duelle bei dieser Spieleranzahl sind bereits abgeschlossen." };
  }
  if (!phase.readyForDuels) {
    return {
      error: `Duelle noch nicht bereit (${phase.fullPickCount}/${phase.expectedPlayerCount} fertig).`,
    };
  }

  const users = await ensureDummyUsers(db);
  const dummyIds = new Set(users.all);

  const groupPicks = await db.vote.findMany({
    where: {
      roundId,
      mode: "PICK",
      playerCount,
    },
    select: { userId: true, gameId: true, points: true },
  });

  const participantIds = duelParticipantIds(groupPicks);
  const dummyParticipants = participantIds.filter((id) => dummyIds.has(id));
  if (dummyParticipants.length === 0) {
    return { error: "Keine Dummy-Teilnehmer mit vollen Picks gefunden." };
  }

  const pickCounts = buildPickCounts(groupPicks);
  const pool = poolGameIds(pickCounts);
  const frozenExisting = parseDuelFrozenData(
    round.duelFrozenData,
    playerCount,
  );
  const frozen =
    frozenExisting ??
    buildDuelFrozenSnapshot({
      playerCount,
      picks: groupPicks,
      poolGameIds: pool,
    });

  const existingDuelVotes = await db.vote.findMany({
    where: {
      roundId,
      mode: "DUEL",
      playerCount,
    },
    select: {
      gameId: true,
      opponentGameId: true,
      userId: true,
      playerCount: true,
    },
  });

  const votesToCreate: {
    roundId: string;
    userId: string;
    gameId: number;
    opponentGameId: number;
    playerCount: number;
    mode: "DUEL";
    points: number;
  }[] = [];

  const userPoints = buildUserPointsMap(groupPicks);

  for (const userId of dummyParticipants) {
    const plan = buildDuellPlan({
      poolGameIds: pool,
      pickCounts: frozen.pickCounts,
      userPoints,
      userId,
      participantIds: frozen.participantIds,
      meetupId: roundId,
      frozen,
    });

    const completed = completedPairKeysForUser(
      existingDuelVotes,
      userId,
      playerCount,
    );

    for (const pair of plan.myPairs) {
      const key = pairKey(pair.a, pair.b);
      if (completed.has(key)) continue;

      const winnerId = pickDuelWinner(pair, frozen.pickCounts);
      const loserId = winnerId === pair.a ? pair.b : pair.a;

      votesToCreate.push({
        roundId,
        userId,
        gameId: winnerId,
        opponentGameId: loserId,
        playerCount,
        mode: "DUEL",
        points: 1,
      });
      completed.add(key);
    }
  }

  if (votesToCreate.length === 0) {
    return { ok: true, votesAdded: 0 };
  }

  await db.$transaction(async (tx) => {
    if (!frozenExisting) {
      await tx.meetupRound.update({
        where: { id: roundId },
        data: {
          duelFrozenAt: new Date(),
          duelFrozenData: duelFrozenToJson(frozen),
        },
      });
    }

    await tx.vote.createMany({ data: votesToCreate });
  });

  return { ok: true, votesAdded: votesToCreate.length };
}
