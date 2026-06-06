import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  allPairs,
  assignGroupPairs,
  buildUserPointsMap,
  getDuelProgressForCount,
  participantIdsFromPicks,
  type DuelPair,
} from "@/lib/duel-pairs";

export const DUMMY_MEETUP_PREFIX = "🧪 Dummy: ";

export const DUMMY_USER_NAMES = [
  "Dummy Alice",
  "Dummy Bob",
  "Dummy Carol",
  "Dummy Dave",
] as const;

const EXPECTED = 4;

type PickRow = { userId: string; gameId: number; points: number };

type DummyUsers = {
  alice: string;
  bob: string;
  carol: string;
  dave: string;
  all: string[];
  trio: string[];
};

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
  return { alice, bob, carol, dave, all: ids, trio: ids.slice(0, 3) };
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

function flattenAssignments(
  assignments: Record<string, DuelPair[]>,
): { userId: string; pair: DuelPair }[] {
  const out: { userId: string; pair: DuelPair }[] = [];
  for (const [userId, list] of Object.entries(assignments)) {
    for (const pair of list) {
      out.push({ userId, pair });
    }
  }
  return out;
}

async function insertGroupDuels(
  db: PrismaClient,
  meetupId: string,
  pool: number[],
  picks: PickRow[],
  fraction = 1,
  playerCount = EXPECTED,
): Promise<void> {
  const participants = participantIdsFromPicks(picks);
  const userPoints = buildUserPointsMap(picks);
  const assignments = assignGroupPairs(
    allPairs(pool),
    participants,
    userPoints,
  );
  const assigned = flattenAssignments(assignments);
  const count = Math.max(0, Math.floor(assigned.length * fraction));
  const slice = assigned.slice(0, count);
  if (slice.length === 0) return;

  await db.vote.createMany({
    data: slice.map(({ userId, pair }) => ({
      meetupId,
      userId,
      gameId: pair.a,
      opponentGameId: pair.b,
      playerCount,
      points: 1,
      mode: "DUEL" as const,
    })),
  });
}

async function insertFullDuels(
  db: PrismaClient,
  meetupId: string,
  pool: number[],
  voterIds: string[],
  fraction = 1,
  playerCount = EXPECTED,
): Promise<void> {
  const pairs = allPairs(pool);
  const count = Math.max(0, Math.floor(pairs.length * fraction));
  if (count === 0 || voterIds.length < 2) return;

  const majority = voterIds.slice(0, 2);
  const minority = voterIds[2] ?? voterIds[0];
  const data: {
    meetupId: string;
    userId: string;
    gameId: number;
    opponentGameId: number;
    playerCount: number;
    points: number;
    mode: "DUEL";
  }[] = [];

  for (let i = 0; i < count; i++) {
    const pair = pairs[i];
    const winner = pair.a;
    const loser = pair.b;
    for (const userId of majority) {
      data.push({
        meetupId,
        userId,
        gameId: winner,
        opponentGameId: loser,
        playerCount,
        points: 1,
        mode: "DUEL",
      });
    }
    data.push({
      meetupId,
      userId: minority,
      gameId: loser,
      opponentGameId: winner,
      playerCount,
      points: 1,
      mode: "DUEL",
    });
  }

  await db.vote.createMany({ data });
}

async function insertSingleDuels(
  db: PrismaClient,
  meetupId: string,
  userId: string,
  winnerId: number,
  loserId: number,
  playerCount = EXPECTED,
): Promise<void> {
  await db.vote.create({
    data: {
      meetupId,
      userId,
      gameId: winnerId,
      opponentGameId: loserId,
      playerCount,
      points: 1,
      mode: "DUEL",
    },
  });
}

function groupPicksEven(
  users: DummyUsers,
  pool: number[],
): PickRow[] {
  const picks: PickRow[] = [];
  for (let i = 0; i < pool.length; i++) {
    picks.push({
      userId: users.all[i % 4],
      gameId: pool[i],
      points: 1,
    });
  }
  return picks;
}

export async function createAllDummyMeetups(
  createdById: string,
  db: PrismaClient = prisma,
): Promise<{ meetupIds: string[]; count: number }> {
  const users = await ensureDummyUsers(db);
  const games = await eligibleGameIds(12, EXPECTED, db);
  if (games.length < 12) {
    throw new Error(
      `Mindestens 12 spielbare Spiele nötig (gefunden: ${games.length}). Bitte zuerst eine Sammlung importieren.`,
    );
  }

  const pool12 = games.slice(0, 12);
  const pool8 = games.slice(0, 8);
  const pool6 = games.slice(0, 6);
  const pool2 = games.slice(0, 2);

  const meetupIds: string[] = [];

  // GROUP · nur Picks
  {
    const id = await createMeetup(db, createdById, "GROUP · nur Picks");
    await insertPicks(db, id, groupPicksEven(users, pool12));
    meetupIds.push(id);
  }

  // GROUP · Duell läuft (~17/66)
  {
    const picks = groupPicksEven(users, pool12);
    const id = await createMeetup(db, createdById, "GROUP · Duell läuft");
    await insertPicks(db, id, picks);
    await insertGroupDuels(db, id, pool12, picks, 17 / 66);
    meetupIds.push(id);
  }

  // GROUP · fertig
  {
    const picks = groupPicksEven(users, pool12);
    const id = await createMeetup(db, createdById, "GROUP · fertig");
    await insertPicks(db, id, picks);
    await insertGroupDuels(db, id, pool12, picks, 1);
    meetupIds.push(id);
  }

  // FULL · nur Picks
  {
    const id = await createMeetup(db, createdById, "FULL · nur Picks");
    await insertPicks(
      db,
      id,
      [
        { userId: users.alice, gameId: pool6[0], points: 1 },
        { userId: users.alice, gameId: pool6[1], points: 1 },
        { userId: users.alice, gameId: pool6[2], points: 1 },
        { userId: users.bob, gameId: pool6[3], points: 1 },
        { userId: users.bob, gameId: pool6[4], points: 1 },
        { userId: users.bob, gameId: pool6[5], points: 1 },
        { userId: users.carol, gameId: pool6[0], points: 1 },
        { userId: users.carol, gameId: pool6[2], points: 1 },
        { userId: users.carol, gameId: pool6[4], points: 1 },
      ],
    );
    meetupIds.push(id);
  }

  // FULL · fertig
  {
    const id = await createMeetup(db, createdById, "FULL · fertig");
    const picks = [
      { userId: users.alice, gameId: pool6[0], points: 1 },
      { userId: users.alice, gameId: pool6[1], points: 1 },
      { userId: users.alice, gameId: pool6[2], points: 1 },
      { userId: users.bob, gameId: pool6[3], points: 1 },
      { userId: users.bob, gameId: pool6[4], points: 1 },
      { userId: users.bob, gameId: pool6[5], points: 1 },
      { userId: users.carol, gameId: pool6[0], points: 1 },
      { userId: users.carol, gameId: pool6[2], points: 1 },
      { userId: users.carol, gameId: pool6[4], points: 1 },
    ];
    await insertPicks(db, id, picks);
    await insertFullDuels(db, id, pool6, users.trio, 1);
    meetupIds.push(id);
  }

  // Min · 2 Spiele
  {
    const id = await createMeetup(db, createdById, "Min · 2 Spiele");
    await insertPicks(db, id, [
      { userId: users.alice, gameId: pool2[0], points: 2 },
      { userId: users.alice, gameId: pool2[1], points: 1 },
      { userId: users.bob, gameId: pool2[0], points: 1 },
      { userId: users.bob, gameId: pool2[1], points: 2 },
    ]);
    await insertSingleDuels(db, id, users.alice, pool2[0], pool2[1]);
    meetupIds.push(id);
  }

  // Einzel · 3 Sterne
  {
    const id = await createMeetup(db, createdById, "Einzel · 3 Sterne");
    await insertPicks(db, id, [
      { userId: users.alice, gameId: pool6[0], points: 3 },
    ]);
    meetupIds.push(id);
  }

  // Gewichtet · läuft
  {
    const picks: PickRow[] = [
      { userId: users.alice, gameId: pool8[0], points: 3 },
      { userId: users.bob, gameId: pool8[1], points: 2 },
      { userId: users.bob, gameId: pool8[2], points: 1 },
      { userId: users.carol, gameId: pool8[3], points: 1 },
      { userId: users.carol, gameId: pool8[4], points: 1 },
      { userId: users.carol, gameId: pool8[5], points: 1 },
      { userId: users.dave, gameId: pool8[6], points: 1 },
      { userId: users.dave, gameId: pool8[7], points: 1 },
      { userId: users.dave, gameId: pool8[1], points: 1 },
    ];
    const id = await createMeetup(db, createdById, "Gewichtet · läuft");
    await insertPicks(db, id, picks);
    await insertGroupDuels(db, id, pool8, picks, 0.3);
    meetupIds.push(id);
  }

  return { meetupIds, count: meetupIds.length };
}

/** Validates GROUP-fertig and FULL-fertig duel progress (for tests). */
export function verifyDummyDuelComplete(
  pool: number[],
  duelVotes: {
    gameId: number;
    opponentGameId: number | null;
    userId: string;
    playerCount: number;
  }[],
  playerCount: number,
): boolean {
  return getDuelProgressForCount(pool, duelVotes, playerCount).duelComplete;
}

export function isDummyMeetupTitle(title: string): boolean {
  return title.startsWith(DUMMY_MEETUP_PREFIX);
}
