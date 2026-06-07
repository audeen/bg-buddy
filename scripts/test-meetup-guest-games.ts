import { PrismaClient } from "@prisma/client";
import { buildPickCounts, poolGameIds } from "../lib/pick-pool";
import { pickGamesWhere, collectionGamesWhere } from "../lib/meetup-guest-games";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const TEMP_BGG_ID = 999999001;

async function main() {
  const prisma = new PrismaClient();

  try {
    try {
      await prisma.$connect();
    } catch {
      console.log("test-meetup-guest-games: SKIP (database unavailable)");
      return;
    }

    const host = await prisma.user.upsert({
      where: { name: "GuestGame-Test-Host" },
      update: {},
      create: { name: "GuestGame-Test-Host" },
    });

    const meetup = await prisma.meetup.create({
      data: {
        title: "Test: Mitbringspiel",
        createdById: host.id,
        expectedPlayerCount: 4,
        initialExpectedPlayerCount: 4,
      },
    });

    await prisma.game.upsert({
      where: { id: TEMP_BGG_ID },
      update: {
        name: "Temporäres Testspiel",
        listedInCollection: false,
        isExpansion: false,
        categories: [],
        mechanics: [],
        bestPlayerCounts: [],
        recommendedPlayerCounts: [],
      },
      create: {
        id: TEMP_BGG_ID,
        name: "Temporäres Testspiel",
        listedInCollection: false,
        isExpansion: false,
        minPlayers: 2,
        maxPlayers: 4,
        categories: [],
        mechanics: [],
        bestPlayerCounts: [],
        recommendedPlayerCounts: [],
      },
    });

    await prisma.meetupGuestGame.create({
      data: {
        meetupId: meetup.id,
        gameId: TEMP_BGG_ID,
        addedById: host.id,
      },
    });

    const onPickPage = await prisma.game.findMany({
      where: pickGamesWhere(meetup.id),
      select: { id: true },
    });
    assert(
      onPickPage.some((g) => g.id === TEMP_BGG_ID),
      "guest game visible on pick query",
    );

    const inCollection = await prisma.game.findMany({
      where: { ...collectionGamesWhere, id: TEMP_BGG_ID },
    });
    assert(inCollection.length === 0, "guest game not in collection query");

    await prisma.vote.create({
      data: {
        meetupId: meetup.id,
        userId: host.id,
        gameId: TEMP_BGG_ID,
        playerCount: meetup.expectedPlayerCount,
        mode: "PICK",
        points: 1,
      },
    });

    const picks = await prisma.vote.findMany({
      where: {
        meetupId: meetup.id,
        mode: "PICK",
        playerCount: meetup.expectedPlayerCount,
      },
      select: { gameId: true, points: true },
    });
    const pool = poolGameIds(buildPickCounts(picks));
    assert(pool.includes(TEMP_BGG_ID), "guest game in duel pool after pick");

    await prisma.vote.deleteMany({
      where: {
        meetupId: meetup.id,
        OR: [
          { gameId: TEMP_BGG_ID },
          { opponentGameId: TEMP_BGG_ID },
        ],
      },
    });
    await prisma.meetupGuestGame.deleteMany({ where: { meetupId: meetup.id } });
    await prisma.game.delete({ where: { id: TEMP_BGG_ID } });
    await prisma.meetup.delete({ where: { id: meetup.id } });

    const gone = await prisma.game.findUnique({ where: { id: TEMP_BGG_ID } });
    assert(!gone, "orphan guest game removed after cleanup");

    console.log("test-meetup-guest-games: OK");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
