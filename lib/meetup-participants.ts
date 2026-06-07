import { Prisma, type PrismaClient } from "@prisma/client";
import { MAX_PICK_POINTS } from "@/lib/vote-limits";

export type RegisteredPlayer = {
  userId: string;
  name: string;
  isHost: boolean;
};

export type PickPointsAtExpected = Map<string, number>;

export function buildRegisteredPlayers(
  host: { id: string; name: string },
  pickVoters: { userId: string; name: string }[],
  manualRegistrations: { userId: string; name: string }[],
): RegisteredPlayer[] {
  const byId = new Map<string, RegisteredPlayer>();

  byId.set(host.id, { userId: host.id, name: host.name, isHost: true });

  for (const v of pickVoters) {
    if (!byId.has(v.userId)) {
      byId.set(v.userId, {
        userId: v.userId,
        name: v.name,
        isHost: v.userId === host.id,
      });
    }
  }

  for (const r of manualRegistrations) {
    if (!byId.has(r.userId)) {
      byId.set(r.userId, {
        userId: r.userId,
        name: r.name,
        isHost: r.userId === host.id,
      });
    }
  }

  const players = [...byId.values()];
  players.sort((a, b) => {
    if (a.isHost !== b.isHost) return a.isHost ? -1 : 1;
    return a.name.localeCompare(b.name, "de");
  });
  return players;
}

export function isUserRegistered(
  userId: string,
  players: RegisteredPlayer[],
): boolean {
  return players.some((p) => p.userId === userId);
}

export function canLeaveMeetup({
  isHost,
  isRegistered,
  duelsStarted,
}: {
  isHost: boolean;
  isRegistered: boolean;
  duelsStarted: boolean;
}): boolean {
  return isRegistered && !isHost && !duelsStarted;
}

export function canKickParticipant({
  isHost,
  targetIsHost,
}: {
  isHost: boolean;
  targetIsHost: boolean;
}): boolean {
  return isHost && !targetIsHost;
}

export async function removeUserFromMeetup(
  meetupId: string,
  userId: string,
  db: PrismaClient,
): Promise<void> {
  await db.$transaction([
    db.meetupRegistration.deleteMany({
      where: { meetupId, userId },
    }),
    db.vote.deleteMany({
      where: { meetupId, userId, mode: "PICK" },
    }),
  ]);
  await syncExpectedPlayerCount(meetupId, db, "down");
}

export async function cancelActiveDuel(
  meetupId: string,
  expectedPlayerCount: number,
  db: PrismaClient,
): Promise<void> {
  await db.$transaction([
    db.vote.deleteMany({
      where: {
        meetupId,
        playerCount: expectedPlayerCount,
        mode: { in: ["DUEL", "TINDER"] },
      },
    }),
    db.meetup.update({
      where: { id: meetupId },
      data: {
        duelFrozenAt: null,
        duelFrozenData: Prisma.DbNull,
      },
    }),
  ]);
}

const MAX_EXPECTED = 20;

export async function loadMeetupParticipantData(
  meetupId: string,
  db: PrismaClient,
) {
  const meetup = await db.meetup.findUnique({
    where: { id: meetupId },
    include: {
      createdBy: { select: { id: true, name: true } },
      registrations: {
        include: { user: { select: { id: true, name: true } } },
      },
    },
  });
  if (!meetup) return null;

  const pickVotes = await db.vote.findMany({
    where: { meetupId, mode: "PICK" },
    select: { userId: true, user: { select: { id: true, name: true } } },
    distinct: ["userId"],
  });

  const pickVoters = pickVotes.map((v) => ({
    userId: v.userId,
    name: v.user.name,
  }));

  const manualRegistrations = meetup.registrations.map((r) => ({
    userId: r.userId,
    name: r.user.name,
  }));

  const players = buildRegisteredPlayers(
    meetup.createdBy,
    pickVoters,
    manualRegistrations,
  );

  const duelVoteCount = await db.vote.count({
    where: {
      meetupId,
      mode: { in: ["DUEL", "TINDER"] },
    },
  });

  return {
    meetup,
    players,
    registeredCount: players.length,
    duelVoteCount,
    duelsStarted: duelVoteCount > 0,
  };
}

export async function syncExpectedPlayerCount(
  meetupId: string,
  db: PrismaClient,
  mode: "up" | "down",
): Promise<number> {
  const data = await loadMeetupParticipantData(meetupId, db);
  if (!data) return 0;

  const { meetup, registeredCount, duelsStarted } = data;
  if (duelsStarted) return meetup.expectedPlayerCount;

  const peak = Math.max(meetup.registrationPeakCount, registeredCount);
  let expected = meetup.expectedPlayerCount;

  if (mode === "up" && registeredCount > expected) {
    expected = Math.min(MAX_EXPECTED, registeredCount);
  } else if (mode === "down" && registeredCount < expected) {
    const floor =
      peak > meetup.initialExpectedPlayerCount
        ? 1
        : meetup.initialExpectedPlayerCount;
    expected = Math.max(registeredCount, floor);
  }

  if (
    expected !== meetup.expectedPlayerCount ||
    peak !== meetup.registrationPeakCount
  ) {
    await db.meetup.update({
      where: { id: meetupId },
      data: {
        expectedPlayerCount: expected,
        registrationPeakCount: peak,
      },
    });
  }

  return expected;
}

export function groupPickVotersByMeetup(
  votes: { meetupId: string; userId: string; user: { name: string } }[],
): Map<string, { userId: string; name: string }[]> {
  const map = new Map<string, Map<string, string>>();
  for (const v of votes) {
    let users = map.get(v.meetupId);
    if (!users) {
      users = new Map();
      map.set(v.meetupId, users);
    }
    if (!users.has(v.userId)) {
      users.set(v.userId, v.user.name);
    }
  }
  const result = new Map<string, { userId: string; name: string }[]>();
  for (const [meetupId, users] of map) {
    result.set(
      meetupId,
      [...users.entries()].map(([userId, name]) => ({ userId, name })),
    );
  }
  return result;
}

type PickVoteRow = {
  userId: string;
  playerCount: number;
  points: number;
};

export function sumPickPointsAtExpected(
  picks: PickVoteRow[],
  expectedPlayerCount: number,
): PickPointsAtExpected {
  const sums = new Map<string, number>();
  for (const p of picks) {
    if (p.playerCount !== expectedPlayerCount) continue;
    sums.set(p.userId, (sums.get(p.userId) ?? 0) + p.points);
  }
  return sums;
}

export function groupPickPointsByMeetup(
  picks: (PickVoteRow & { meetupId: string })[],
  expectedByMeetup: Map<string, number>,
): Map<string, PickPointsAtExpected> {
  const byMeetup = new Map<string, PickVoteRow[]>();
  for (const p of picks) {
    const list = byMeetup.get(p.meetupId) ?? [];
    list.push(p);
    byMeetup.set(p.meetupId, list);
  }

  const result = new Map<string, PickPointsAtExpected>();
  for (const [meetupId, rows] of byMeetup) {
    const expected = expectedByMeetup.get(meetupId);
    if (expected == null) continue;
    result.set(meetupId, sumPickPointsAtExpected(rows, expected));
  }
  return result;
}

export function countFullPickers(
  players: RegisteredPlayer[],
  pickPoints: PickPointsAtExpected,
): number {
  return players.filter(
    (p) => (pickPoints.get(p.userId) ?? 0) >= MAX_PICK_POINTS,
  ).length;
}
