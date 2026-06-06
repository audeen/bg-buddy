import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { pairCount } from "@/lib/duel-pairs";
import { MAX_PICK_POINTS } from "@/lib/vote-limits";
import { poolGameIds, buildPickCounts } from "@/lib/pick-pool";

export const DUMMY_MEETUP_PREFIX = "🧪 Dummy: ";

export const DUMMY_SCENARIO_COUNT = 6;

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
  creatorPicksLeft: 1 | 2 | 3;
};

const SCENARIOS: Scenario[] = [
  { label: "Direktduelle · dir 3 Picks", poolSize: POOL_FULL, creatorPicksLeft: 3 },
  { label: "Direktduelle · dir 2 Picks", poolSize: POOL_FULL, creatorPicksLeft: 2 },
  { label: "Direktduelle · dir 1 Pick", poolSize: POOL_FULL, creatorPicksLeft: 1 },
  { label: "Gruppenduelle · dir 3 Picks", poolSize: POOL_GROUP, creatorPicksLeft: 3 },
  { label: "Gruppenduelle · dir 2 Picks", poolSize: POOL_GROUP, creatorPicksLeft: 2 },
  { label: "Gruppenduelle · dir 1 Pick", poolSize: POOL_GROUP, creatorPicksLeft: 1 },
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
  const usedByUser = new Map<string, number>();

  for (let i = 0; i < pool.length; i++) {
    const gameId = pool[i];
    let userId = pickers[i % pickers.length];
    let attempts = 0;
    while ((usedByUser.get(userId) ?? 0) >= MAX_PICK_POINTS && attempts < pickers.length) {
      userId = pickers[(i + attempts) % pickers.length];
      attempts++;
    }
    if ((usedByUser.get(userId) ?? 0) >= MAX_PICK_POINTS) continue;

    picks.push({ userId, gameId, points: 1 });
    usedByUser.set(userId, (usedByUser.get(userId) ?? 0) + 1);
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
    const picks = [
      ...dummyPicksForPool(users, pool),
      ...creatorPicks(createdById, pool, scenario.creatorPicksLeft),
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
