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
const POOL_FULL = 6;
const POOL_GROUP = 8;

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
};

const SCENARIOS: Scenario[] = [
  { label: "Direktduelle · dir 3 Picks", poolSize: POOL_FULL, creatorPicksLeft: 3 },
  { label: "Direktduelle · dir 2 Picks", poolSize: POOL_FULL, creatorPicksLeft: 2 },
  { label: "Direktduelle · dir 1 Pick", poolSize: POOL_FULL, creatorPicksLeft: 1 },
  { label: "Gruppenduelle · dir 3 Picks", poolSize: POOL_GROUP, creatorPicksLeft: 3 },
  { label: "Gruppenduelle · dir 2 Picks", poolSize: POOL_GROUP, creatorPicksLeft: 2 },
  { label: "Gruppenduelle · dir 1 Pick", poolSize: POOL_GROUP, creatorPicksLeft: 1 },
  { label: "Duell bereit · 4/4", poolSize: POOL_FULL, allReady: true },
];

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
): Promise<string> {
  const meetup = await db.meetup.create({
    data: {
      title: `${DUMMY_MEETUP_PREFIX}${label}`,
      expectedPlayerCount: EXPECTED,
      initialExpectedPlayerCount: EXPECTED,
      registrationPeakCount: 1,
      createdById,
    },
  });
  return meetup.id;
}

async function insertPicks(
  db: PrismaClient,
  meetupId: string,
  picks: PickRow[],
  playerCount = EXPECTED,
): Promise<void> {
  if (picks.length === 0) return;
  await db.vote.createMany({
    data: picks.map((p) => ({
      meetupId,
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
    const id = await createMeetup(db, createdById, scenario.label);
    await insertPicks(db, id, picks);
    meetupIds.push(id);
  }

  return { meetupIds, count: meetupIds.length };
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
      expectedPlayerCount: true,
      duelFrozenData: true,
    },
  });
  if (!meetup) return { error: "Treffen nicht gefunden." };
  if (!isDummyMeetupTitle(meetup.title)) {
    return { error: "Nur für Dummy-Treffen verfügbar." };
  }

  const playerCount = meetup.expectedPlayerCount;
  const phase = await getPickPhaseState(meetupId, playerCount, db);
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
      meetupId,
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
    meetup.duelFrozenData,
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
      meetupId,
      mode: { in: ["DUEL", "TINDER"] },
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
    meetupId: string;
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
      meetupId,
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
        meetupId,
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
      await tx.meetup.update({
        where: { id: meetupId },
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
