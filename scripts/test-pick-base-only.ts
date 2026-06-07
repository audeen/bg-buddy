import { PrismaClient } from "@prisma/client";
import { pickGamesWhere } from "../lib/meetup-guest-games";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const TEMP_EXPANSION_ID = 999999101;
const TEMP_BASE_ID = 999999102;

async function main() {
  assert(
    pickGamesWhere("meetup-id").isExpansion === false,
    "pickGamesWhere excludes expansions",
  );

  const prisma = new PrismaClient();

  try {
    try {
      await prisma.$connect();
    } catch {
      console.log("test-pick-base-only: SKIP (database unavailable)");
      return;
    }

    const host = await prisma.user.upsert({
      where: { name: "PickBaseOnly-Test-Host" },
      update: {},
      create: { name: "PickBaseOnly-Test-Host" },
    });

    const meetup = await prisma.meetup.create({
      data: {
        title: "Test: Pick nur Basisspiel",
        createdById: host.id,
        expectedPlayerCount: 4,
        initialExpectedPlayerCount: 4,
      },
    });

    await prisma.game.upsert({
      where: { id: TEMP_EXPANSION_ID },
      update: {
        name: "Temporäre Test-Erweiterung",
        listedInCollection: true,
        isExpansion: true,
        expandsGameIds: [TEMP_BASE_ID],
        categories: [],
        mechanics: [],
        bestPlayerCounts: [],
        recommendedPlayerCounts: [],
      },
      create: {
        id: TEMP_EXPANSION_ID,
        name: "Temporäre Test-Erweiterung",
        listedInCollection: true,
        isExpansion: true,
        expandsGameIds: [TEMP_BASE_ID],
        minPlayers: 2,
        maxPlayers: 4,
        categories: [],
        mechanics: [],
        bestPlayerCounts: [],
        recommendedPlayerCounts: [],
      },
    });

    await prisma.game.upsert({
      where: { id: TEMP_BASE_ID },
      update: {
        name: "Temporäres Test-Basisspiel",
        listedInCollection: true,
        isExpansion: false,
        categories: [],
        mechanics: [],
        bestPlayerCounts: [],
        recommendedPlayerCounts: [],
      },
      create: {
        id: TEMP_BASE_ID,
        name: "Temporäres Test-Basisspiel",
        listedInCollection: true,
        isExpansion: false,
        minPlayers: 2,
        maxPlayers: 4,
        categories: [],
        mechanics: [],
        bestPlayerCounts: [],
        recommendedPlayerCounts: [],
      },
    });

    const pickGames = await prisma.game.findMany({
      where: pickGamesWhere(meetup.id),
      select: { id: true, isExpansion: true },
    });
    assert(
      !pickGames.some((g) => g.id === TEMP_EXPANSION_ID),
      "expansion not in pick list",
    );
    assert(
      pickGames.some((g) => g.id === TEMP_BASE_ID),
      "base game in pick list",
    );
    assert(
      pickGames.every((g) => !g.isExpansion),
      "pick list contains only base games",
    );

    const expansion = await prisma.game.findUnique({
      where: { id: TEMP_EXPANSION_ID },
      select: {
        isExpansion: true,
        listedInCollection: true,
        meetupGuestGames: {
          where: { meetupId: meetup.id },
          select: { id: true },
          take: 1,
        },
      },
    });
    assert(!!expansion, "expansion fixture exists");
    assert(expansion!.isExpansion, "fixture is expansion");
    const expansionInPickPool =
      expansion!.listedInCollection ||
      expansion!.meetupGuestGames.length > 0;
    assert(
      expansionInPickPool,
      "expansion would be in collection but still not pickable",
    );

    await prisma.game.delete({ where: { id: TEMP_EXPANSION_ID } });
    await prisma.game.delete({ where: { id: TEMP_BASE_ID } });
    await prisma.meetup.delete({ where: { id: meetup.id } });

    console.log("test-pick-base-only: OK");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
