"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getCurrentUser } from "@/lib/auth";
import { parseCollectionCsv } from "@/lib/bgg";
import { applyCsvImport, previewCsvImport } from "@/lib/csv-import";
import { loadGameMetadata, upsertGameRecord } from "@/lib/upsert-game";
import {
  parseFieldResolutionMap,
  type ConflictResolution,
} from "@/lib/game-sync";
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
import {
  MAX_PICK_POINTS,
  MAX_POINTS_PER_GAME,
} from "@/lib/vote-limits";
import {
  completeDummyDuelsForMeetup,
  countDummyMeetups,
  createAllDummyMeetups,
  DUMMY_MEETUP_PREFIX,
  purgeDummyMeetups,
} from "@/lib/dummy-meetups";
import {
  cancelActiveDuel,
  loadMeetupParticipantData,
  removeUserFromMeetup,
  syncExpectedPlayerCount,
} from "@/lib/meetup-participants";

export async function loginAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { error: "Bitte gib einen Namen ein." };
  }
  if (name.length > 40) {
    return { error: "Name ist zu lang (max. 40 Zeichen)." };
  }

  const user = await prisma.user.upsert({
    where: { name },
    update: {},
    create: { name },
  });

  const session = await getSession();
  session.userId = user.id;
  session.name = user.name;
  await session.save();

  redirect("/");
}

export async function logoutAction() {
  const session = await getSession();
  session.destroy();
  redirect("/");
}

export async function createMeetupAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Bitte zuerst anmelden." };

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Bitte einen Titel angeben." };

  const dateRaw = String(formData.get("scheduledAt") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim() || null;
  const expected = parseInt(String(formData.get("expectedPlayerCount") ?? "4"), 10);

  const expectedCount = Number.isFinite(expected) ? Math.max(1, expected) : 4;

  const meetup = await prisma.meetup.create({
    data: {
      title,
      scheduledAt: dateRaw ? new Date(dateRaw) : null,
      location,
      expectedPlayerCount: expectedCount,
      initialExpectedPlayerCount: expectedCount,
      registrationPeakCount: 1,
      createdById: user.id,
    },
  });

  redirect(`/meetups/${meetup.id}`);
}

export async function deleteMeetupAction(meetupId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Bitte zuerst anmelden." };

  const id = meetupId.trim();
  if (!id) return { error: "Ungültiges Treffen." };

  try {
    await prisma.meetup.delete({ where: { id } });
  } catch {
    return { error: "Treffen nicht gefunden." };
  }

  revalidatePath("/");
  revalidatePath("/meetups", "layout");

  return { ok: true };
}

export async function updateExpectedCountAction(
  meetupId: string,
  count: number,
) {
  const user = await getCurrentUser();
  if (!user) return { error: "Bitte zuerst anmelden." };

  const meetup = await prisma.meetup.findUnique({
    where: { id: meetupId },
    select: { expectedPlayerCount: true, createdById: true },
  });
  if (!meetup) return { error: "Treffen nicht gefunden." };
  if (meetup.createdById !== user.id) {
    return { error: "Nur der Host kann die erwartete Spieleranzahl ändern." };
  }

  const phase = await getPickPhaseState(
    meetupId,
    meetup.expectedPlayerCount,
    prisma,
  );
  if (phase.picksLocked) {
    return {
      error:
        "Erwartete Spieleranzahl kann erst geändert werden, wenn die laufenden Duelle abgeschlossen sind.",
    };
  }

  await prisma.meetup.update({
    where: { id: meetupId },
    data: {
      expectedPlayerCount: Math.max(1, Math.round(count)),
      duelFrozenAt: null,
      duelFrozenData: Prisma.DbNull,
      expansionDuelStartedAt: null,
      expansionDuelFrozenData: Prisma.DbNull,
    },
  });
  await prisma.vote.deleteMany({
    where: { meetupId, mode: "EXPANSION_DUEL" },
  });
  revalidatePath(`/meetups/${meetupId}`);
  return { ok: true };
}

export async function joinMeetupAction(meetupId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Bitte zuerst anmelden." };

  const id = meetupId.trim();
  if (!id) return { error: "Ungültiges Treffen." };

  const meetup = await prisma.meetup.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!meetup) return { error: "Treffen nicht gefunden." };

  await prisma.meetupRegistration.upsert({
    where: { meetupId_userId: { meetupId: id, userId: user.id } },
    update: {},
    create: { meetupId: id, userId: user.id },
  });

  await syncExpectedPlayerCount(id, prisma, "up");

  revalidatePath("/");
  revalidatePath(`/meetups/${id}`);
  return { ok: true };
}

export async function leaveMeetupAction(meetupId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Bitte zuerst anmelden." };

  const id = meetupId.trim();
  if (!id) return { error: "Ungültiges Treffen." };

  const data = await loadMeetupParticipantData(id, prisma);
  if (!data) return { error: "Treffen nicht gefunden." };

  if (data.meetup.createdBy.id === user.id) {
    return { error: "Der Host kann sich nicht abmelden." };
  }

  if (data.duelsStarted) {
    return {
      error: "Abmelden nicht mehr möglich — Duelle laufen bereits.",
    };
  }

  if (!data.players.some((p) => p.userId === user.id)) {
    return { error: "Du bist für dieses Treffen nicht angemeldet." };
  }

  await removeUserFromMeetup(id, user.id, prisma);

  revalidatePath("/");
  revalidatePath(`/meetups/${id}`);
  revalidatePath(`/meetups/${id}/pick`);
  return { ok: true };
}

export async function kickParticipantAction(
  meetupId: string,
  targetUserId: string,
) {
  const user = await getCurrentUser();
  if (!user) return { error: "Bitte zuerst anmelden." };

  const id = meetupId.trim();
  const targetId = targetUserId.trim();
  if (!id || !targetId) return { error: "Ungültiges Treffen." };

  const data = await loadMeetupParticipantData(id, prisma);
  if (!data) return { error: "Treffen nicht gefunden." };

  if (data.meetup.createdBy.id !== user.id) {
    return { error: "Nur der Host kann Teilnehmer entfernen." };
  }

  if (targetId === data.meetup.createdBy.id) {
    return { error: "Der Host kann nicht entfernt werden." };
  }

  if (!data.players.some((p) => p.userId === targetId)) {
    return { error: "Teilnehmer nicht gefunden." };
  }

  const phase = await getPickPhaseState(
    id,
    data.meetup.expectedPlayerCount,
    prisma,
  );

  await removeUserFromMeetup(id, targetId, prisma);

  if (phase.picksLocked) {
    await cancelActiveDuel(id, data.meetup.expectedPlayerCount, prisma);
  }

  revalidatePath("/");
  revalidatePath(`/meetups/${id}`);
  revalidatePath(`/meetups/${id}/pick`);
  revalidatePath(`/meetups/${id}/duell`);
  return { ok: true };
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
    select: { expectedPlayerCount: true },
  });
  if (!meetup) return { error: "Treffen nicht gefunden." };

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: {
      isExpansion: true,
      listedInCollection: true,
      lentOut: true,
      meetupGuestGames: {
        where: { meetupId },
        select: { id: true },
        take: 1,
      },
    },
  });
  if (!game) return { error: "Spiel nicht gefunden." };
  if (game.isExpansion) {
    return { error: "Stimmen können nur für Basisspiele vergeben werden." };
  }
  if (game.lentOut) {
    return { error: "Dieses Spiel ist verliehen." };
  }
  const inPickPool =
    game.listedInCollection || game.meetupGuestGames.length > 0;
  if (!inPickPool) {
    return { error: "Dieses Spiel ist nicht in der Abstimmungsliste." };
  }

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
  revalidatePath(`/meetups/${meetupId}`);
  revalidatePath(`/meetups/${meetupId}/pick`);
  revalidatePath(`/meetups/${meetupId}/duell`);
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
    select: { expectedPlayerCount: true, duelFrozenData: true },
  });
  if (!meetup) return { error: "Treffen nicht gefunden." };
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

  const groupPicks = await prisma.vote.findMany({
    where: { meetupId, mode: "PICK", playerCount },
    select: { userId: true, gameId: true, points: true },
  });

  const pickCounts = buildPickCounts(groupPicks);
  const pool = frozenExisting?.poolGameIds ?? poolGameIds(pickCounts);

  if (!pool.includes(winnerGameId) || !pool.includes(opponentGameId)) {
    return { error: "Beide Spiele müssen im Pick-Pool sein." };
  }

  const myPickSum = groupPicks
    .filter((p) => p.userId === user.id)
    .reduce((s, p) => s + p.points, 0);
  if (myPickSum < MAX_PICK_POINTS) {
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

  const existing = await prisma.vote.findFirst({
    where: {
      meetupId,
      userId: user.id,
      playerCount,
      mode: { in: ["DUEL", "TINDER"] },
      OR: [
        {
          gameId: winnerGameId,
          opponentGameId,
        },
        {
          gameId: opponentGameId,
          opponentGameId: winnerGameId,
        },
      ],
    },
  });
  if (existing) {
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

  revalidatePath(`/meetups/${meetupId}`);
  revalidatePath(`/meetups/${meetupId}/pick`);
  revalidatePath(`/meetups/${meetupId}/duell`);
  return { ok: true };
}

function revalidateExpansionPaths(meetupId: string) {
  revalidatePath(`/meetups/${meetupId}`);
  revalidatePath(`/meetups/${meetupId}/erweiterung`);
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
    select: { createdById: true },
  });
  if (!meetup) return { error: "Treffen nicht gefunden." };
  if (meetup.createdById !== user.id) {
    return { error: "Nur der Host kann Pflicht-Erweiterungen festlegen." };
  }

  const meetupFull = await prisma.meetup.findUnique({
    where: { id: meetupId },
    select: { expectedPlayerCount: true, expansionDuelStartedAt: true },
  });
  if (!meetupFull) return { error: "Treffen nicht gefunden." };
  if (meetupFull.expansionDuelStartedAt) {
    return {
      error: "Pflicht-Erweiterungen können nach Start der Abstimmung nicht mehr geändert werden.",
    };
  }

  const expansionPhase = await loadExpansionPhaseState(
    meetupId,
    meetupFull.expectedPlayerCount,
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
      meetupFull.expectedPlayerCount,
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

  const groupPicks = await prisma.vote.findMany({
    where: { meetupId, mode: "PICK", playerCount },
    select: { userId: true, gameId: true, points: true },
  });

  const myPickSum = groupPicks
    .filter((p) => p.userId === user.id)
    .reduce((s, p) => s + p.points, 0);
  if (myPickSum < MAX_PICK_POINTS) {
    return {
      error: `Du brauchst ${MAX_PICK_POINTS}/${MAX_PICK_POINTS} Stimmen bei ★.`,
    };
  }

  const existing = await prisma.vote.findFirst({
    where: {
      meetupId,
      userId: user.id,
      playerCount,
      mode: "EXPANSION_DUEL",
      OR: [
        { gameId: winnerGameId, opponentGameId },
        { gameId: opponentGameId, opponentGameId: winnerGameId },
      ],
    },
  });
  if (existing) {
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

function parseConflictResolution(value: string | null): ConflictResolution {
  return value === "overwriteAll" ? "overwriteAll" : "keepManual";
}

export async function importCsvPreviewAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Bitte zuerst anmelden." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Keine Datei ausgewählt." };
  }

  const text = await file.text();
  const games = parseCollectionCsv(text);
  if (games.length === 0) {
    return { error: "Keine Spiele in der CSV gefunden. Ist es ein BGG-Export?" };
  }

  const preview = await previewCsvImport(games);
  const expansions = games.filter((g) => g.isExpansion).length;

  return {
    ok: true,
    total: games.length,
    standalone: games.length - expansions,
    expansions,
    ...preview,
  };
}

export async function importCsvAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Bitte zuerst anmelden." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Keine Datei ausgewählt." };
  }

  const resolution = parseConflictResolution(
    String(formData.get("conflictResolution") ?? ""),
  );

  let fieldResolutions = null;
  const fieldResolutionsRaw = String(formData.get("fieldResolutions") ?? "").trim();
  if (fieldResolutionsRaw) {
    try {
      fieldResolutions = parseFieldResolutionMap(JSON.parse(fieldResolutionsRaw));
    } catch {
      return { error: "Ungültige Feld-Auswahl." };
    }
  }

  const text = await file.text();
  const games = parseCollectionCsv(text);
  if (games.length === 0) {
    return { error: "Keine Spiele in der CSV gefunden. Ist es ein BGG-Export?" };
  }

  const { cacheApplied } = await applyCsvImport(
    games,
    resolution,
    fieldResolutions ?? undefined,
  );

  const expansions = games.filter((g) => g.isExpansion).length;
  revalidatePath("/games");
  revalidatePath("/admin/import");
  revalidatePath("/admin/collection");
  return {
    ok: true,
    total: games.length,
    standalone: games.length - expansions,
    expansions,
    cacheApplied,
  };
}

export type GameMetadataInput = {
  name: string;
  year: number | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  playingTime: number | null;
  minPlaytime: number | null;
  maxPlaytime: number | null;
  weight: number | null;
  bggRating: number | null;
  rank: number | null;
  ageRange: string | null;
  languageDependence: string | null;
  isExpansion: boolean;
  bestPlayerCounts: number[];
  recommendedPlayerCounts: number[];
  description: string | null;
  image: string | null;
  thumbnail: string | null;
  categories: string[];
  mechanics: string[];
  expandsGameIds: number[];
};

function parseOptionalInt(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = parseInt(String(value).trim(), 10);
  return Number.isFinite(n) ? n : null;
}

function parseOptionalFloat(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = parseFloat(String(value).trim());
  return Number.isFinite(n) ? n : null;
}

function parseIntList(value: unknown): number[] {
  if (!value) return [];
  const raw = String(value)
    .split(/[,;\s]+/)
    .map((t) => parseInt(t.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  return [...new Set(raw)].sort((a, b) => a - b);
}

function parseStringList(value: unknown): string[] {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseGameMetadataForm(formData: FormData): GameMetadataInput | { error: string } {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name ist erforderlich." };

  const isExpansion = formData.get("isExpansion") === "on";

  return {
    name,
    year: parseOptionalInt(formData.get("year")),
    minPlayers: parseOptionalInt(formData.get("minPlayers")),
    maxPlayers: parseOptionalInt(formData.get("maxPlayers")),
    playingTime: parseOptionalInt(formData.get("playingTime")),
    minPlaytime: parseOptionalInt(formData.get("minPlaytime")),
    maxPlaytime: parseOptionalInt(formData.get("maxPlaytime")),
    weight: parseOptionalFloat(formData.get("weight")),
    bggRating: parseOptionalFloat(formData.get("bggRating")),
    rank: parseOptionalInt(formData.get("rank")),
    ageRange: String(formData.get("ageRange") ?? "").trim() || null,
    languageDependence:
      String(formData.get("languageDependence") ?? "").trim() || null,
    isExpansion,
    bestPlayerCounts: parseIntList(formData.get("bestPlayerCounts")),
    recommendedPlayerCounts: parseIntList(formData.get("recommendedPlayerCounts")),
    description: String(formData.get("description") ?? "").trim() || null,
    image: String(formData.get("image") ?? "").trim() || null,
    thumbnail: String(formData.get("thumbnail") ?? "").trim() || null,
    categories: parseStringList(formData.get("categories")),
    mechanics: parseStringList(formData.get("mechanics")),
    expandsGameIds: isExpansion
      ? parseIntList(formData.get("expandsGameIds"))
      : [],
  };
}

const EDITABLE_FIELDS = [
  "name",
  "year",
  "minPlayers",
  "maxPlayers",
  "playingTime",
  "minPlaytime",
  "maxPlaytime",
  "weight",
  "bggRating",
  "rank",
  "ageRange",
  "languageDependence",
  "isExpansion",
  "bestPlayerCounts",
  "recommendedPlayerCounts",
  "description",
  "image",
  "thumbnail",
  "categories",
  "mechanics",
  "expandsGameIds",
] as const;

export async function updateGameMetadataAction(gameId: number, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Bitte zuerst anmelden." };

  if (!Number.isFinite(gameId)) {
    return { error: "Ungültige Spiel-ID." };
  }

  const parsed = parseGameMetadataForm(formData);
  if ("error" in parsed) return parsed;

  const existing = await prisma.game.findUnique({
    where: { id: gameId },
    select: {
      id: true,
      name: true,
      year: true,
      minPlayers: true,
      maxPlayers: true,
      playingTime: true,
      minPlaytime: true,
      maxPlaytime: true,
      weight: true,
      bggRating: true,
      rank: true,
      ageRange: true,
      languageDependence: true,
      isExpansion: true,
      bestPlayerCounts: true,
      recommendedPlayerCounts: true,
      description: true,
      image: true,
      thumbnail: true,
      categories: true,
      mechanics: true,
      expandsGameIds: true,
      manuallyEditedFields: true,
    },
  });

  if (!existing) return { error: "Spiel nicht gefunden." };

  const changedFields: string[] = [];
  for (const field of EDITABLE_FIELDS) {
    const next = parsed[field];
    const prev = existing[field];
    if (JSON.stringify(next) !== JSON.stringify(prev)) {
      changedFields.push(field);
    }
  }

  const manuallyEditedFields = [
    ...new Set([...existing.manuallyEditedFields, ...changedFields]),
  ];

  await prisma.game.update({
    where: { id: gameId },
    data: {
      ...parsed,
      manuallyEditedFields,
      enriched:
        !!(
          parsed.description ||
          parsed.image ||
          parsed.thumbnail ||
          parsed.categories.length > 0 ||
          parsed.mechanics.length > 0
        ),
    },
  });

  revalidatePath("/games");
  revalidatePath("/admin/collection");
  revalidatePath(`/admin/collection/${gameId}`);
  revalidatePath(`/games/${gameId}`);
  revalidatePath("/admin/import");

  return { ok: true, changedFields };
}

export type AddGameActionResult =
  | { ok: true; name: string; bggId: number; created?: boolean; alreadyExists?: boolean }
  | { error: string };

export async function addGameByBggIdAction(
  bggId: number,
  options?: { barcode?: string | null; name?: string | null },
): Promise<AddGameActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Bitte zuerst anmelden." };

  if (!Number.isFinite(bggId) || bggId <= 0) {
    return { error: "Ungültige BGG-ID." };
  }

  const normalizedBarcode = options?.barcode?.trim()
    ? options.barcode.replace(/\D/g, "") || null
    : null;

  const existing = await prisma.game.findUnique({
    where: { id: bggId },
    select: { id: true, name: true },
  });
  if (existing) {
    return {
      ok: true as const,
      alreadyExists: true,
      name: existing.name,
      bggId: existing.id,
    };
  }

  if (normalizedBarcode) {
    const barcodeTaken = await prisma.game.findUnique({
      where: { barcode: normalizedBarcode },
      select: { id: true, name: true },
    });
    if (barcodeTaken) {
      return {
        error: `Barcode ist bereits „${barcodeTaken.name}" zugeordnet (BGG ${barcodeTaken.id}).`,
      };
    }
  }

  const { base, enrichment } = await loadGameMetadata(bggId);

  const { created, name } = await upsertGameRecord(
    {
      ...base,
      bggId,
      name: options?.name?.trim() || base.name,
      barcode: normalizedBarcode,
    },
    enrichment,
  );

  revalidatePath("/games");
  revalidatePath("/admin/import");
  revalidatePath("/admin/collection");
  revalidatePath(`/games/${bggId}`);

  return { ok: true as const, created, name, bggId };
}

async function assertMeetupHost(meetupId: string, userId: string) {
  const meetup = await prisma.meetup.findUnique({
    where: { id: meetupId },
    select: { createdById: true, expectedPlayerCount: true },
  });
  if (!meetup) return { error: "Treffen nicht gefunden." as const };
  if (meetup.createdById !== userId) {
    return { error: "Nur der Host kann temporäre Spiele verwalten." as const };
  }
  return { meetup };
}

function revalidateMeetupPaths(meetupId: string) {
  revalidatePath(`/meetups/${meetupId}`);
  revalidatePath(`/meetups/${meetupId}/pick`);
  revalidatePath(`/meetups/${meetupId}/duell`);
  revalidatePath(`/meetups/${meetupId}/erweiterung`);
}

export async function addGuestGameToMeetupAction(
  meetupId: string,
  bggId: number,
  options?: { barcode?: string | null; name?: string | null },
): Promise<AddGameActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Bitte zuerst anmelden." };

  if (!Number.isFinite(bggId) || bggId <= 0) {
    return { error: "Ungültige BGG-ID." };
  }

  const hostCheck = await assertMeetupHost(meetupId, user.id);
  if ("error" in hostCheck && hostCheck.error) {
    return { error: hostCheck.error };
  }

  const existingLink = await prisma.meetupGuestGame.findUnique({
    where: { meetupId_gameId: { meetupId, gameId: bggId } },
    select: { id: true },
  });
  if (existingLink) {
    return { error: "Spiel ist bereits für dieses Treffen hinzugefügt." };
  }

  const normalizedBarcode = options?.barcode?.trim()
    ? options.barcode.replace(/\D/g, "") || null
    : null;

  const existing = await prisma.game.findUnique({
    where: { id: bggId },
    select: { id: true, name: true, isExpansion: true, listedInCollection: true },
  });

  if (existing?.isExpansion) {
    return { error: "Erweiterungen können nicht als temporäres Spiel hinzugefügt werden." };
  }

  if (!existing) {
    if (normalizedBarcode) {
      const barcodeTaken = await prisma.game.findUnique({
        where: { barcode: normalizedBarcode },
        select: { id: true, name: true },
      });
      if (barcodeTaken) {
        return {
          error: `Barcode ist bereits „${barcodeTaken.name}" zugeordnet (BGG ${barcodeTaken.id}).`,
        };
      }
    }

    const { base, enrichment } = await loadGameMetadata(bggId);
    if (base.isExpansion) {
      return { error: "Erweiterungen können nicht als temporäres Spiel hinzugefügt werden." };
    }

    const { name } = await upsertGameRecord(
      {
        ...base,
        bggId,
        name: options?.name?.trim() || base.name,
        barcode: normalizedBarcode,
        listedInCollection: false,
      },
      enrichment,
    );

    await prisma.meetupGuestGame.create({
      data: { meetupId, gameId: bggId, addedById: user.id },
    });

    revalidateMeetupPaths(meetupId);
    return { ok: true as const, name, bggId, created: true };
  }

  await prisma.meetupGuestGame.create({
    data: { meetupId, gameId: bggId, addedById: user.id },
  });

  revalidateMeetupPaths(meetupId);
  return {
    ok: true as const,
    name: existing.name,
    bggId: existing.id,
    alreadyExists: existing.listedInCollection,
  };
}

export async function removeAllGuestGamesFromMeetupAction(meetupId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Bitte zuerst anmelden." };

  const hostCheck = await assertMeetupHost(meetupId, user.id);
  if ("error" in hostCheck && hostCheck.error) {
    return { error: hostCheck.error };
  }
  const { meetup } = hostCheck;

  const guestLinks = await prisma.meetupGuestGame.findMany({
    where: { meetupId },
    select: { gameId: true },
  });
  const gameIds = guestLinks.map((g) => g.gameId);
  if (gameIds.length === 0) {
    return { ok: true, removed: 0 };
  }

  const phase = await getPickPhaseState(
    meetupId,
    meetup.expectedPlayerCount,
    prisma,
  );

  await prisma.$transaction(async (tx) => {
    await tx.vote.deleteMany({
      where: {
        meetupId,
        OR: [
          { gameId: { in: gameIds } },
          { opponentGameId: { in: gameIds } },
        ],
      },
    });
    await tx.meetupGuestGame.deleteMany({ where: { meetupId } });

    const orphanCandidates = await tx.game.findMany({
      where: {
        id: { in: gameIds },
        listedInCollection: false,
        meetupGuestGames: { none: {} },
        votesAsWinner: { none: {} },
        votesAsOpponent: { none: {} },
      },
      select: { id: true },
    });
    if (orphanCandidates.length > 0) {
      await tx.game.deleteMany({
        where: { id: { in: orphanCandidates.map((g) => g.id) } },
      });
    }
  });

  if (phase.picksLocked) {
    await cancelActiveDuel(meetupId, meetup.expectedPlayerCount, prisma);
  }

  revalidateMeetupPaths(meetupId);
  revalidatePath("/games");
  return { ok: true, removed: gameIds.length };
}

export async function setGameLentOutAction(gameId: number, lentOut: boolean) {
  const user = await getCurrentUser();
  if (!user) return { error: "Bitte zuerst anmelden." };

  if (!Number.isFinite(gameId)) {
    return { error: "Ungültige Spiel-ID." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.game.update({
        where: { id: gameId },
        data: { lentOut },
      });
      if (lentOut) {
        await tx.vote.deleteMany({
          where: { gameId, mode: "PICK" },
        });
      }
    });
  } catch {
    return { error: "Spiel nicht gefunden." };
  }

  revalidatePath("/games");
  revalidatePath("/admin/collection");
  revalidatePath(`/games/${gameId}`);
  revalidatePath("/meetups", "layout");

  return { ok: true };
}

export async function removeGameFromCollectionAction(gameId: number) {
  const user = await getCurrentUser();
  if (!user) return { error: "Bitte zuerst anmelden." };

  if (!Number.isFinite(gameId)) {
    return { error: "Ungültige Spiel-ID." };
  }

  try {
    await prisma.game.delete({ where: { id: gameId } });
  } catch {
    return { error: "Spiel nicht gefunden." };
  }

  revalidatePath("/games");
  revalidatePath("/admin/import");
  revalidatePath("/admin/collection");
  revalidatePath(`/games/${gameId}`);
  revalidatePath("/meetups", "layout");

  return { ok: true };
}

export async function purgeCollectionAction() {
  const user = await getCurrentUser();
  if (!user) return { error: "Bitte zuerst anmelden." };

  const deleted = await prisma.$transaction(async (tx) => {
    const count = await tx.game.count();
    if (count === 0) return 0;

    await tx.game.deleteMany({});
    await tx.meetup.updateMany({
      data: { duelFrozenAt: null, duelFrozenData: Prisma.DbNull },
    });
    return count;
  });

  revalidatePath("/games");
  revalidatePath("/admin/import");
  revalidatePath("/admin/collection");
  revalidatePath("/meetups", "layout");

  return { ok: true, deleted };
}

export async function countDummyMeetupsAction() {
  const user = await getCurrentUser();
  if (!user) return { error: "Bitte zuerst anmelden." };

  const count = await countDummyMeetups();
  return { ok: true, count };
}

export async function createDummyMeetupsAction() {
  const user = await getCurrentUser();
  if (!user) return { error: "Bitte zuerst anmelden." };

  try {
    const { count } = await createAllDummyMeetups(user.id);
    revalidatePath("/");
    revalidatePath("/meetups", "layout");
    return { ok: true, count };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Dummy-Treffen konnten nicht erstellt werden.";
    return { error: message };
  }
}

export async function purgeDummyMeetupsAction() {
  const user = await getCurrentUser();
  if (!user) return { error: "Bitte zuerst anmelden." };

  const deleted = await purgeDummyMeetups();

  revalidatePath("/");
  revalidatePath("/meetups", "layout");

  return { ok: true, deleted };
}

export async function completeDummyDuelsAction(meetupId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Bitte zuerst anmelden." };

  const result = await completeDummyDuelsForMeetup(meetupId);
  if ("error" in result) return { error: result.error };

  revalidatePath(`/meetups/${meetupId}`);
  revalidatePath(`/meetups/${meetupId}/pick`);
  revalidatePath(`/meetups/${meetupId}/duell`);
  revalidatePath("/");

  return { ok: true, votesAdded: result.votesAdded };
}
