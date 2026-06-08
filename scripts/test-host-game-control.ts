import { PrismaClient } from "@prisma/client";
import {
  pickGamesWhere,
  pickGamesWhereForMeetup,
} from "../lib/meetup-guest-games";
import { loadExpansionPhaseState } from "../lib/expansion-phase";
import { getPickPhaseState } from "../lib/pick-phase";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const COLLECTION_GAME_A = 999999101;
const COLLECTION_GAME_B = 999999102;
const COLLECTION_GAME_C = 999999103;
const GUEST_GAME = 999999104;

async function main() {
  const prisma = new PrismaClient();

  try {
    try {
      await prisma.$connect();
    } catch {
      console.log("test-host-game-control: SKIP (database unavailable)");
      return;
    }

    const host = await prisma.user.upsert({
      where: { name: "HostControl-Test-Host" },
      update: {},
      create: { name: "HostControl-Test-Host" },
    });

    const guest = await prisma.user.upsert({
      where: { name: "HostControl-Test-Guest" },
      update: {},
      create: { name: "HostControl-Test-Guest" },
    });

    for (const [id, name] of [
      [COLLECTION_GAME_A, "HostControl A"],
      [COLLECTION_GAME_B, "HostControl B"],
      [COLLECTION_GAME_C, "HostControl C"],
    ] as const) {
      await prisma.game.upsert({
        where: { id },
        update: {
          name,
          listedInCollection: true,
          isExpansion: false,
          categories: [],
          mechanics: [],
          bestPlayerCounts: [],
          recommendedPlayerCounts: [],
        },
        create: {
          id,
          name,
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
    }

    const meetup = await prisma.meetup.create({
      data: {
        title: "Test: Host-Spielsteuerung",
        createdById: host.id,
        expectedPlayerCount: 4,
        initialExpectedPlayerCount: 4,
      },
    });

    await prisma.meetupHostChoiceGame.createMany({
      data: [
        { meetupId: meetup.id, gameId: COLLECTION_GAME_A, sortOrder: 0 },
        { meetupId: meetup.id, gameId: COLLECTION_GAME_B, sortOrder: 1 },
      ],
    });
    await prisma.meetup.update({
      where: { id: meetup.id },
      data: { hostChoiceMode: "RESTRICT" },
    });

    const restricted = await prisma.game.findMany({
      where: pickGamesWhereForMeetup(
        meetup.id,
        "RESTRICT",
        [COLLECTION_GAME_A, COLLECTION_GAME_B],
      ),
      select: { id: true },
    });
    const restrictedIds = restricted.map((g) => g.id).sort();
    assert(
      restrictedIds.join(",") ===
        [COLLECTION_GAME_A, COLLECTION_GAME_B].sort().join(","),
      "RESTRICT limits pick pool to host choice games",
    );

    const fullPool = await prisma.game.findMany({
      where: pickGamesWhere(meetup.id),
      select: { id: true },
    });
    assert(
      fullPool.some((g) => g.id === COLLECTION_GAME_C),
      "full pool still includes other collection games",
    );

    await prisma.game.upsert({
      where: { id: GUEST_GAME },
      update: {
        name: "HostControl Guest",
        listedInCollection: false,
        isExpansion: false,
        categories: [],
        mechanics: [],
        bestPlayerCounts: [],
        recommendedPlayerCounts: [],
      },
      create: {
        id: GUEST_GAME,
        name: "HostControl Guest",
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
        gameId: GUEST_GAME,
        addedById: host.id,
      },
    });
    await prisma.meetupHostChoiceGame.create({
      data: { meetupId: meetup.id, gameId: GUEST_GAME, sortOrder: 2 },
    });

    const guestChoice = await prisma.meetupHostChoiceGame.findFirst({
      where: { meetupId: meetup.id, gameId: GUEST_GAME },
    });
    assert(!!guestChoice, "guest game in MeetupHostChoiceGame");

    const guestInPool = await prisma.game.findMany({
      where: pickGamesWhereForMeetup(meetup.id, "RESTRICT", [
        COLLECTION_GAME_A,
        COLLECTION_GAME_B,
        GUEST_GAME,
      ]),
      select: { id: true },
    });
    assert(
      guestInPool.some((g) => g.id === GUEST_GAME),
      "guest game in host choice visible in pick pool",
    );

    await prisma.meetup.update({
      where: { id: meetup.id },
      data: {
        hostForcedGameId: COLLECTION_GAME_A,
        hostForcedAt: new Date(),
        hostChoiceMode: "NONE",
      },
    });
    await prisma.meetupHostChoiceGame.deleteMany({
      where: { meetupId: meetup.id },
    });

    const expansionPhase = await loadExpansionPhaseState(
      meetup.id,
      meetup.expectedPlayerCount,
      prisma,
    );
    assert(
      expansionPhase.mainDuelComplete && expansionPhase.winnerGameId === COLLECTION_GAME_A,
      "forced game sets winner in expansion phase",
    );
    assert(
      !expansionPhase.expansionDuelAvailable,
      "no expansion duel after host force",
    );

    const pickPhase = await getPickPhaseState(
      meetup.id,
      meetup.expectedPlayerCount,
      prisma,
    );
    assert(pickPhase.hostForced && pickPhase.picksLocked, "forced meetup locks picks");

    await prisma.meetup.update({
      where: { id: meetup.id },
      data: {
        expectedPlayerCount: 3,
        hostForcedGameId: null,
        hostForcedAt: null,
      },
    });
    const afterStar = await prisma.meetup.findUnique({
      where: { id: meetup.id },
      select: { hostForcedGameId: true },
    });
    assert(afterStar?.hostForcedGameId == null, "star change clears forced game");

    const foreignMeetup = await prisma.meetup.create({
      data: {
        title: "Test: HostControl foreign",
        createdById: guest.id,
        expectedPlayerCount: 4,
        initialExpectedPlayerCount: 4,
      },
    });
    assert(
      foreignMeetup.createdById !== host.id,
      "guest is not host of foreign meetup",
    );

    await prisma.game.deleteMany({
      where: {
        id: {
          in: [
            COLLECTION_GAME_A,
            COLLECTION_GAME_B,
            COLLECTION_GAME_C,
            GUEST_GAME,
          ],
        },
      },
    });
    await prisma.meetup.deleteMany({
      where: { id: { in: [meetup.id, foreignMeetup.id] } },
    });

    console.log("test-host-game-control: OK");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
