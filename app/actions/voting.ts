"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  buildDuelFrozenSnapshot,
  buildDuellPlan,
  buildUserPointsMap,
  duelFrozenToJson,
  duelParticipantIds,
  isPairInList,
  pairKey,
  parseDuelFrozenData,
} from "@/lib/duel-pairs";
import {
  buildExpansionConfigs,
  buildExpansionDuelPairs,
  expansionConfigsNeedDuel,
  expansionDuelFrozenToJson,
  parseExpansionDuelFrozenData,
  type ExpansionDuelFrozenData,
} from "@/lib/expansion-duel";
import { loadExpansionPhaseState } from "@/lib/expansion-phase";
import { isPlayableAtCount } from "@/lib/effective-player-count";
import { buildPickCounts, poolGameIds } from "@/lib/pick-pool";
import {
  formatDuellNotReadyMessage,
  getPickPhaseState,
} from "@/lib/pick-phase";
import { MAX_PICK_POINTS, MAX_POINTS_PER_GAME } from "@/lib/vote-limits";
import { loadMeetupParticipantData, syncExpectedPlayerCount } from "@/lib/meetup-participants";
import {
  revalidateExpansionPaths,
  validatePickPoolGame,
} from "@/app/actions/shared";

function revalidateMeetupVotePaths(meetupId: string) {
  revalidatePath(`/meetups/${meetupId}`);
  revalidatePath(`/meetups/${meetupId}/pick`);
  revalidatePath(`/meetups/${meetupId}/duell`);
}

function fetchGroupPicks(meetupId: string, playerCount: number) {
  return prisma.vote.findMany({
    where: { meetupId, mode: "PICK", playerCount },
    select: { userId: true, gameId: true, points: true },
  });
}

function userPickSum(
  picks: { userId: string; points: number }[],
  userId: string,
): number {
  return picks
    .filter((p) => p.userId === userId)
    .reduce((s, p) => s + p.points, 0);
}

/** Prüft, ob der Nutzer für dieses Paar (in beliebiger Richtung) schon abgestimmt hat. */
async function hasDuplicateDuelVote(
  meetupId: string,
  userId: string,
  playerCount: number,
  mode: "DUEL" | "EXPANSION_DUEL",
  winnerGameId: number,
  opponentGameId: number,
): Promise<boolean> {
  const existing = await prisma.vote.findFirst({
    where: {
      meetupId,
      userId,
      playerCount,
      mode,
      OR: [
        { gameId: winnerGameId, opponentGameId },
        { gameId: opponentGameId, opponentGameId: winnerGameId },
      ],
    },
    select: { id: true },
  });
  return existing != null;
}

export async function setPickPointsAction(
  meetupId: string,
  gameId: number,
  playerCount: number,
  points: number,
) {
  const user = await getCurrentUser();
  if (!user) return { error: "Bitte zuerst anmelden." };

  const meetup = await prisma.meetup.findUnique({
    where: { id: meetupId },
    select: { expectedPlayerCount: true, hostForcedGameId: true },
  });
  if (!meetup) return { error: "Treffen nicht gefunden." };
  if (meetup.hostForcedGameId != null) {
    return { error: "Der Host hat bereits ein Spiel festgelegt — keine Abstimmung." };
  }

  const gameCheck = await validatePickPoolGame(meetupId, gameId, {
    expansion: "Stimmen können nur für Basisspiele vergeben werden.",
    notInPool: "Dieses Spiel ist nicht in der Abstimmungsliste.",
  });
  if ("error" in gameCheck) return { error: gameCheck.error };

  const beforeData = await loadMeetupParticipantData(meetupId, prisma);
  const beforeCount = beforeData?.registeredCount ?? 0;

  const next = Math.round(points);
  if (next < 0 || next > MAX_POINTS_PER_GAME) {
    return { error: `Maximal ${MAX_POINTS_PER_GAME} Stimmen pro Spiel.` };
  }

  if (playerCount === meetup.expectedPlayerCount) {
    const phase = await getPickPhaseState(
      meetupId,
      meetup.expectedPlayerCount,
      prisma,
    );
    if (phase.picksLocked) {
      return { error: "Stimmen sind gesperrt — Duelle laufen bereits." };
    }
  }

  const existing = await prisma.vote.findFirst({
    where: {
      meetupId,
      userId: user.id,
      gameId,
      playerCount,
      mode: "PICK",
    },
  });

  const others = await prisma.vote.aggregate({
    where: {
      meetupId,
      userId: user.id,
      playerCount,
      mode: "PICK",
      ...(existing ? { NOT: { id: existing.id } } : {}),
    },
    _sum: { points: true },
  });
  const otherSum = others._sum.points ?? 0;
  if (otherSum + next > MAX_PICK_POINTS) {
    return {
      error: `Maximal ${MAX_PICK_POINTS} Stimmen für diese Spieleranzahl.`,
    };
  }

  if (next === 0) {
    if (existing) {
      await prisma.vote.delete({ where: { id: existing.id } });
    }
  } else if (existing) {
    await prisma.vote.update({
      where: { id: existing.id },
      data: { points: next },
    });
  } else {
    await prisma.vote.create({
      data: {
        meetupId,
        userId: user.id,
        gameId,
        playerCount,
        mode: "PICK",
        points: next,
      },
    });
  }

  const afterData = await loadMeetupParticipantData(meetupId, prisma);
  const afterCount = afterData?.registeredCount ?? beforeCount;
  if (afterCount > beforeCount) {
    await syncExpectedPlayerCount(meetupId, prisma, "up");
  } else if (afterCount < beforeCount) {
    await syncExpectedPlayerCount(meetupId, prisma, "down");
  }

  revalidatePath("/");
  revalidateMeetupVotePaths(meetupId);
  return { ok: true, points: next };
}

export async function duelVoteAction(
  meetupId: string,
  winnerGameId: number,
  opponentGameId: number,
  playerCount: number,
) {
  const user = await getCurrentUser();
  if (!user) return { error: "Bitte zuerst anmelden." };

  if (winnerGameId === opponentGameId) {
    return { error: "Gewinner und Gegner müssen verschieden sein." };
  }

  const meetup = await prisma.meetup.findUnique({
    where: { id: meetupId },
    select: {
      expectedPlayerCount: true,
      duelFrozenData: true,
      hostForcedGameId: true,
    },
  });
  if (!meetup) return { error: "Treffen nicht gefunden." };
  if (meetup.hostForcedGameId != null) {
    return { error: "Der Host hat bereits ein Spiel festgelegt — keine Duelle." };
  }
  if (playerCount !== meetup.expectedPlayerCount) {
    return { error: "Duelle nur für die erwartete Spieleranzahl." };
  }

  const frozenExisting = parseDuelFrozenData(
    meetup.duelFrozenData,
    playerCount,
  );

  const phase = await getPickPhaseState(meetupId, playerCount, prisma);
  if (phase.duelComplete) {
    return {
      error:
        "Duelle bei dieser Spieleranzahl sind abgeschlossen. Der Host kann ★ ändern, um eine neue Runde zu starten.",
    };
  }
  if (!phase.readyForDuels) {
    return { error: formatDuellNotReadyMessage(phase) };
  }

  const groupPicks = await fetchGroupPicks(meetupId, playerCount);

  const pickCounts = buildPickCounts(groupPicks);
  const pool = frozenExisting?.poolGameIds ?? poolGameIds(pickCounts);

  if (!pool.includes(winnerGameId) || !pool.includes(opponentGameId)) {
    return { error: "Beide Spiele müssen im Pick-Pool sein." };
  }

  if (userPickSum(groupPicks, user.id) < MAX_PICK_POINTS) {
    return {
      error: `Du brauchst ${MAX_PICK_POINTS}/${MAX_PICK_POINTS} Stimmen bei ★, bevor du duellieren kannst.`,
    };
  }

  const participantIds = duelParticipantIds(groupPicks);
  const frozen =
    frozenExisting ??
    buildDuelFrozenSnapshot({
      playerCount,
      picks: groupPicks,
      poolGameIds: pool,
    });

  const plan = buildDuellPlan({
    poolGameIds: pool,
    pickCounts: frozen.pickCounts,
    userPoints: buildUserPointsMap(groupPicks),
    userId: user.id,
    participantIds,
    meetupId,
    frozen,
  });

  const pair = { a: winnerGameId, b: opponentGameId };
  if (!isPairInList(pair, plan.myPairs)) {
    return { error: "Dieses Paar ist dir nicht zugewiesen." };
  }

  if (
    await hasDuplicateDuelVote(
      meetupId,
      user.id,
      playerCount,
      "DUEL",
      winnerGameId,
      opponentGameId,
    )
  ) {
    return { error: "Du hast für dieses Paar schon abgestimmt." };
  }

  await prisma.$transaction(async (tx) => {
    if (!frozenExisting) {
      await tx.meetup.update({
        where: { id: meetupId },
        data: {
          duelFrozenAt: new Date(),
          duelFrozenData: duelFrozenToJson(frozen),
        },
      });
    }

    await tx.vote.create({
      data: {
        meetupId,
        userId: user.id,
        gameId: winnerGameId,
        opponentGameId,
        playerCount,
        mode: "DUEL",
        points: 1,
      },
    });
  });

  revalidateMeetupVotePaths(meetupId);
  return { ok: true };
}

export async function toggleMandatoryExpansionAction(
  meetupId: string,
  baseGameId: number,
  expansionGameId: number,
  mandatory: boolean,
) {
  const user = await getCurrentUser();
  if (!user) return { error: "Bitte zuerst anmelden." };

  const meetup = await prisma.meetup.findUnique({
    where: { id: meetupId },
    select: {
      createdById: true,
      expectedPlayerCount: true,
      expansionDuelStartedAt: true,
    },
  });
  if (!meetup) return { error: "Treffen nicht gefunden." };
  if (meetup.createdById !== user.id) {
    return { error: "Nur der Host kann Pflicht-Erweiterungen festlegen." };
  }
  if (meetup.expansionDuelStartedAt) {
    return {
      error: "Pflicht-Erweiterungen können nach Start der Abstimmung nicht mehr geändert werden.",
    };
  }

  const expansionPhase = await loadExpansionPhaseState(
    meetupId,
    meetup.expectedPlayerCount,
    prisma,
  );
  if (!expansionPhase.mainDuelComplete || !expansionPhase.winnerGameId) {
    return { error: "Pflicht-Erweiterungen erst nach dem Haupt-Duell." };
  }
  if (baseGameId !== expansionPhase.winnerGameId) {
    return { error: "Pflicht-Erweiterungen nur für das Sieger-Spiel." };
  }

  const expansion = await prisma.game.findUnique({
    where: { id: expansionGameId },
    select: {
      isExpansion: true,
      expandsGameIds: true,
      listedInCollection: true,
      minPlayers: true,
      maxPlayers: true,
    },
  });
  if (
    !expansion?.isExpansion ||
    !expansion.expandsGameIds.includes(baseGameId) ||
    !expansion.listedInCollection
  ) {
    return { error: "Ungültige Erweiterung für dieses Basisspiel." };
  }

  if (
    !isPlayableAtCount(
      expansion.minPlayers,
      expansion.maxPlayers,
      meetup.expectedPlayerCount,
    )
  ) {
    return { error: "Erweiterung ist bei der erwarteten Spieleranzahl nicht spielbar." };
  }

  if (mandatory) {
    await prisma.meetupMandatoryExpansion.upsert({
      where: {
        meetupId_baseGameId_expansionGameId: {
          meetupId,
          baseGameId,
          expansionGameId,
        },
      },
      update: {},
      create: { meetupId, baseGameId, expansionGameId },
    });
  } else {
    await prisma.meetupMandatoryExpansion.deleteMany({
      where: { meetupId, baseGameId, expansionGameId },
    });
  }

  revalidateExpansionPaths(meetupId);
  return { ok: true };
}

export async function startExpansionDuelAction(meetupId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Bitte zuerst anmelden." };

  const meetup = await prisma.meetup.findUnique({
    where: { id: meetupId },
    select: {
      expectedPlayerCount: true,
      createdById: true,
      expansionDuelStartedAt: true,
      mandatoryExpansions: {
        select: { baseGameId: true, expansionGameId: true },
      },
    },
  });
  if (!meetup) return { error: "Treffen nicht gefunden." };
  if (meetup.createdById !== user.id) {
    return { error: "Nur der Host kann die Erweiterungs-Abstimmung starten." };
  }
  if (meetup.expansionDuelStartedAt) {
    return { error: "Erweiterungs-Abstimmung läuft bereits." };
  }

  const expected = meetup.expectedPlayerCount;
  const expansionPhase = await loadExpansionPhaseState(meetupId, expected, prisma);
  if (!expansionPhase.mainDuelComplete || !expansionPhase.winnerGameId) {
    return { error: "Haupt-Duelle müssen zuerst abgeschlossen sein." };
  }
  if (expansionPhase.optionalExpansionCount === 0) {
    return { error: "Keine optionalen Erweiterungen zum Abstimmen." };
  }

  await prisma.meetupMandatoryExpansion.deleteMany({
    where: {
      meetupId,
      baseGameId: { not: expansionPhase.winnerGameId },
    },
  });

  const mandatory = meetup.mandatoryExpansions
    .filter((m) => m.baseGameId === expansionPhase.winnerGameId)
    .map((m) => m.expansionGameId);

  const baseGame = await prisma.game.findUnique({
    where: { id: expansionPhase.winnerGameId },
    select: {
      id: true,
      name: true,
      thumbnail: true,
      image: true,
      coverUrl: true,
      minPlayers: true,
      maxPlayers: true,
    },
  });
  if (!baseGame) return { error: "Sieger-Spiel nicht gefunden." };

  const ownedExpansions = await prisma.game.findMany({
    where: {
      isExpansion: true,
      listedInCollection: true,
      expandsGameIds: { has: baseGame.id },
    },
    select: {
      id: true,
      name: true,
      thumbnail: true,
      image: true,
      coverUrl: true,
      minPlayers: true,
      maxPlayers: true,
    },
  });

  const configs = buildExpansionConfigs(
    baseGame,
    ownedExpansions,
    mandatory,
    expected,
  );
  if (!expansionConfigsNeedDuel(configs)) {
    return { error: "Keine Abstimmung nötig — nur Pflicht-Erweiterungen." };
  }

  const frozen: ExpansionDuelFrozenData = {
    baseGameId: baseGame.id,
    playerCount: expected,
    configs,
    poolVoteGameIds: configs.map((c) => c.voteGameId),
  };

  await prisma.meetup.update({
    where: { id: meetupId },
    data: {
      expansionDuelStartedAt: new Date(),
      expansionDuelFrozenData: expansionDuelFrozenToJson(frozen),
    },
  });

  revalidateExpansionPaths(meetupId);
  return { ok: true };
}

export async function expansionDuelVoteAction(
  meetupId: string,
  winnerGameId: number,
  opponentGameId: number,
  playerCount: number,
) {
  const user = await getCurrentUser();
  if (!user) return { error: "Bitte zuerst anmelden." };

  if (winnerGameId === opponentGameId) {
    return { error: "Gewinner und Gegner müssen verschieden sein." };
  }

  const meetup = await prisma.meetup.findUnique({
    where: { id: meetupId },
    select: {
      expectedPlayerCount: true,
      expansionDuelStartedAt: true,
      expansionDuelFrozenData: true,
    },
  });
  if (!meetup) return { error: "Treffen nicht gefunden." };
  if (!meetup.expansionDuelStartedAt) {
    return { error: "Erweiterungs-Abstimmung wurde noch nicht gestartet." };
  }
  if (playerCount !== meetup.expectedPlayerCount) {
    return { error: "Abstimmung nur für die erwartete Spieleranzahl." };
  }

  const frozen = parseExpansionDuelFrozenData(
    meetup.expansionDuelFrozenData,
    playerCount,
  );
  if (!frozen) return { error: "Erweiterungs-Duell-Daten fehlen." };

  const pool = new Set(frozen.poolVoteGameIds);
  if (!pool.has(winnerGameId) || !pool.has(opponentGameId)) {
    return { error: "Ungültige Konfiguration." };
  }

  const pairs = buildExpansionDuelPairs(frozen.configs);
  const key = pairKey(
    Math.min(winnerGameId, opponentGameId),
    Math.max(winnerGameId, opponentGameId),
  );
  if (!pairs.some((p) => pairKey(p.a, p.b) === key)) {
    return { error: "Dieses Paar ist nicht vorgesehen." };
  }

  const groupPicks = await fetchGroupPicks(meetupId, playerCount);

  if (userPickSum(groupPicks, user.id) < MAX_PICK_POINTS) {
    return {
      error: `Du brauchst ${MAX_PICK_POINTS}/${MAX_PICK_POINTS} Stimmen bei ★.`,
    };
  }

  if (
    await hasDuplicateDuelVote(
      meetupId,
      user.id,
      playerCount,
      "EXPANSION_DUEL",
      winnerGameId,
      opponentGameId,
    )
  ) {
    return { error: "Du hast für dieses Paar schon abgestimmt." };
  }

  await prisma.vote.create({
    data: {
      meetupId,
      userId: user.id,
      gameId: winnerGameId,
      opponentGameId,
      playerCount,
      mode: "EXPANSION_DUEL",
      points: 1,
    },
  });

  revalidateExpansionPaths(meetupId);
  return { ok: true };
}
