"use server";

import type { HostChoiceMode } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { loadGameMetadata, upsertGameRecord } from "@/lib/upsert-game";
import { getPickPhaseState } from "@/lib/pick-phase";
import { parseDuelFrozenData } from "@/lib/duel-pairs";
import { cancelActiveDuel } from "@/lib/meetup-participants";
import {
  normalizeBarcode,
  isGameExcludedFromRound,
  requireMeetupHost,
  requireRoundHost,
  revalidateMeetupPaths,
  validatePickPoolGame,
} from "@/app/actions/shared";
import type { AddGameActionResult } from "@/app/actions/collection";

const GUEST_GAME_HOST_ERROR = "Nur der Host kann temporäre Spiele verwalten.";
const HOST_SETTING_ERROR = "Nur der Host kann diese Einstellung ändern.";

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

  const hostCheck = await requireMeetupHost(meetupId, user.id, GUEST_GAME_HOST_ERROR);
  if ("error" in hostCheck) {
    return { error: hostCheck.error };
  }

  const existingLink = await prisma.meetupGuestGame.findUnique({
    where: { meetupId_gameId: { meetupId, gameId: bggId } },
    select: { id: true },
  });
  if (existingLink) {
    return { error: "Spiel ist bereits für dieses Treffen hinzugefügt." };
  }

  const normalizedBarcode = normalizeBarcode(options?.barcode);

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

    let base, enrichment;
    try {
      ({ base, enrichment } = await loadGameMetadata(bggId));
    } catch (err) {
      return {
        error:
          err instanceof Error ? err.message : "BGG-Abruf fehlgeschlagen.",
      };
    }
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

  const hostCheck = await requireMeetupHost(meetupId, user.id, GUEST_GAME_HOST_ERROR);
  if ("error" in hostCheck) {
    return { error: hostCheck.error };
  }

  const guestLinks = await prisma.meetupGuestGame.findMany({
    where: { meetupId },
    select: { gameId: true },
  });
  const gameIds = guestLinks.map((g) => g.gameId);
  if (gameIds.length === 0) {
    return { ok: true, removed: 0 };
  }

  const rounds = await prisma.meetupRound.findMany({
    where: { meetupId },
    select: { id: true, expectedPlayerCount: true },
  });
  const roundIds = rounds.map((r) => r.id);

  // Duell-Status je Runde vor dem Löschen festhalten.
  const lockedRounds: { id: string; expectedPlayerCount: number }[] = [];
  for (const round of rounds) {
    const phase = await getPickPhaseState(
      round.id,
      round.expectedPlayerCount,
      prisma,
    );
    if (phase.picksLocked) {
      lockedRounds.push({
        id: round.id,
        expectedPlayerCount: round.expectedPlayerCount,
      });
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.vote.deleteMany({
      where: {
        roundId: { in: roundIds },
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

  for (const round of lockedRounds) {
    await cancelActiveDuel(round.id, round.expectedPlayerCount, prisma);
  }

  revalidateMeetupPaths(meetupId);
  revalidatePath("/games");
  return { ok: true, removed: gameIds.length };
}

export async function forceMeetupGameAction(roundId: string, gameId: number) {
  const user = await getCurrentUser();
  if (!user) return { error: "Bitte zuerst anmelden." };

  const hostCheck = await requireRoundHost(roundId, user.id, HOST_SETTING_ERROR);
  if ("error" in hostCheck) return { error: hostCheck.error };
  const { round } = hostCheck;

  const gameCheck = await validatePickPoolGame(round.meetupId, gameId, {
    expansion: "Erweiterungen können nicht festgelegt werden.",
    notInPool: "Dieses Spiel ist nicht verfügbar.",
  });
  if ("error" in gameCheck) return { error: gameCheck.error };

  const phase = await getPickPhaseState(
    roundId,
    round.expectedPlayerCount,
    prisma,
  );

  await prisma.$transaction(async (tx) => {
    await tx.meetupHostChoiceGame.deleteMany({ where: { roundId } });
    await tx.meetupExcludedGame.deleteMany({ where: { roundId, gameId } });
    await tx.meetupRound.update({
      where: { id: roundId },
      data: {
        hostForcedGameId: gameId,
        hostForcedAt: new Date(),
        hostChoiceMode: "NONE",
      },
    });
  });

  if (phase.picksLocked) {
    await cancelActiveDuel(roundId, round.expectedPlayerCount, prisma);
  }

  revalidateMeetupPaths(round.meetupId);
  revalidatePath("/");
  return { ok: true as const, name: gameCheck.game.name };
}

export async function clearForcedMeetupGameAction(roundId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Bitte zuerst anmelden." };

  const hostCheck = await requireRoundHost(roundId, user.id, HOST_SETTING_ERROR);
  if ("error" in hostCheck) return { error: hostCheck.error };
  const { round } = hostCheck;
  if (round.hostForcedGameId == null) {
    return { ok: true };
  }

  await prisma.meetupRound.update({
    where: { id: roundId },
    data: { hostForcedGameId: null, hostForcedAt: null },
  });

  revalidateMeetupPaths(round.meetupId);
  revalidatePath("/");
  return { ok: true };
}

export async function addHostChoiceGameAction(roundId: string, gameId: number) {
  const user = await getCurrentUser();
  if (!user) return { error: "Bitte zuerst anmelden." };

  const hostCheck = await requireRoundHost(roundId, user.id, HOST_SETTING_ERROR);
  if ("error" in hostCheck) return { error: hostCheck.error };
  const { round } = hostCheck;
  if (round.hostForcedGameId != null) {
    return { error: "Spiel ist festgelegt — Vorauswahl nicht möglich." };
  }

  const gameCheck = await validatePickPoolGame(round.meetupId, gameId, {
    expansion: "Erweiterungen können nicht ausgewählt werden.",
    notInPool: "Dieses Spiel ist nicht verfügbar.",
  });
  if ("error" in gameCheck) return { error: gameCheck.error };
  if (await isGameExcludedFromRound(roundId, gameId)) {
    return { error: "Spiel ist für diese Runde ausgeschlossen." };
  }

  const existing = await prisma.meetupHostChoiceGame.findUnique({
    where: { roundId_gameId: { roundId, gameId } },
    select: { id: true },
  });
  if (existing) {
    return { error: "Spiel ist bereits in der Vorauswahl." };
  }

  const count = await prisma.meetupHostChoiceGame.count({ where: { roundId } });

  await prisma.meetupHostChoiceGame.create({
    data: { roundId, gameId, sortOrder: count },
  });

  if (round.hostChoiceMode === "NONE") {
    await prisma.meetupRound.update({
      where: { id: roundId },
      data: { hostChoiceMode: "HIGHLIGHT" },
    });
  }

  revalidateMeetupPaths(round.meetupId);
  return { ok: true as const, name: gameCheck.game.name };
}

export async function removeHostChoiceGameAction(
  roundId: string,
  gameId: number,
) {
  const user = await getCurrentUser();
  if (!user) return { error: "Bitte zuerst anmelden." };

  const hostCheck = await requireRoundHost(roundId, user.id, HOST_SETTING_ERROR);
  if ("error" in hostCheck) return { error: hostCheck.error };
  const { round } = hostCheck;
  if (round.hostForcedGameId != null) {
    return { error: "Spiel ist festgelegt — Vorauswahl nicht änderbar." };
  }

  await prisma.meetupHostChoiceGame.deleteMany({
    where: { roundId, gameId },
  });

  const remaining = await prisma.meetupHostChoiceGame.count({ where: { roundId } });
  if (remaining === 0 && round.hostChoiceMode !== "NONE") {
    await prisma.meetupRound.update({
      where: { id: roundId },
      data: { hostChoiceMode: "NONE" },
    });
  }

  revalidateMeetupPaths(round.meetupId);
  return { ok: true };
}

export async function setHostChoiceModeAction(
  roundId: string,
  mode: HostChoiceMode,
) {
  const user = await getCurrentUser();
  if (!user) return { error: "Bitte zuerst anmelden." };

  const hostCheck = await requireRoundHost(roundId, user.id, HOST_SETTING_ERROR);
  if ("error" in hostCheck) return { error: hostCheck.error };
  const { round } = hostCheck;
  if (round.hostForcedGameId != null) {
    return { error: "Spiel ist festgelegt — Vorauswahl nicht änderbar." };
  }

  if (mode !== "NONE") {
    const count = await prisma.meetupHostChoiceGame.count({ where: { roundId } });
    if (count === 0) {
      return { error: "Zuerst Spiele zur Vorauswahl hinzufügen." };
    }
  }

  await prisma.meetupRound.update({
    where: { id: roundId },
    data: { hostChoiceMode: mode === "NONE" ? "NONE" : mode },
  });

  revalidateMeetupPaths(round.meetupId);
  return { ok: true };
}

export async function clearHostChoiceGamesAction(roundId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Bitte zuerst anmelden." };

  const hostCheck = await requireRoundHost(roundId, user.id, HOST_SETTING_ERROR);
  if ("error" in hostCheck) return { error: hostCheck.error };
  const { round } = hostCheck;
  if (round.hostForcedGameId != null) {
    return { error: "Spiel ist festgelegt — Vorauswahl nicht änderbar." };
  }

  await prisma.$transaction([
    prisma.meetupHostChoiceGame.deleteMany({ where: { roundId } }),
    prisma.meetupRound.update({
      where: { id: roundId },
      data: { hostChoiceMode: "NONE" },
    }),
  ]);

  revalidateMeetupPaths(round.meetupId);
  return { ok: true };
}

export async function excludeGameFromRoundAction(
  roundId: string,
  gameId: number,
) {
  const user = await getCurrentUser();
  if (!user) return { error: "Bitte zuerst anmelden." };

  const hostCheck = await requireRoundHost(roundId, user.id, HOST_SETTING_ERROR);
  if ("error" in hostCheck) return { error: hostCheck.error };
  const { round } = hostCheck;

  if (round.hostForcedGameId === gameId) {
    return { error: "Festgelegtes Spiel kann nicht ausgeschlossen werden." };
  }

  const gameCheck = await validatePickPoolGame(round.meetupId, gameId, {
    expansion: "Erweiterungen können nicht ausgeschlossen werden.",
    notInPool: "Dieses Spiel ist nicht verfügbar.",
  });
  if ("error" in gameCheck) return { error: gameCheck.error };

  const [phase, roundRow, involvedVote] = await Promise.all([
    getPickPhaseState(roundId, round.expectedPlayerCount, prisma),
    prisma.meetupRound.findUnique({
      where: { id: roundId },
      select: { duelFrozenData: true },
    }),
    prisma.vote.findFirst({
      where: {
        roundId,
        OR: [{ gameId }, { opponentGameId: gameId }],
      },
      select: { id: true },
    }),
  ]);

  const frozen = parseDuelFrozenData(
    roundRow?.duelFrozenData,
    round.expectedPlayerCount,
  );
  const inFrozenPool = frozen?.poolGameIds.includes(gameId) ?? false;

  await prisma.$transaction(async (tx) => {
    await tx.meetupExcludedGame.upsert({
      where: { roundId_gameId: { roundId, gameId } },
      update: {},
      create: { roundId, gameId },
    });
    await tx.meetupHostChoiceGame.deleteMany({ where: { roundId, gameId } });
    await tx.meetupMandatoryExpansion.deleteMany({
      where: { roundId, baseGameId: gameId },
    });
    await tx.vote.deleteMany({
      where: {
        roundId,
        OR: [{ gameId }, { opponentGameId: gameId }],
      },
    });

    const remaining = await tx.meetupHostChoiceGame.count({ where: { roundId } });
    if (remaining === 0 && round.hostChoiceMode !== "NONE") {
      await tx.meetupRound.update({
        where: { id: roundId },
        data: { hostChoiceMode: "NONE" },
      });
    }
  });

  if ((phase.picksLocked || phase.duelComplete || inFrozenPool) && (involvedVote || inFrozenPool)) {
    await cancelActiveDuel(roundId, round.expectedPlayerCount, prisma);
  }

  revalidateMeetupPaths(round.meetupId);
  revalidatePath("/");
  return { ok: true as const, name: gameCheck.game.name };
}

export async function includeGameInRoundAction(roundId: string, gameId: number) {
  const user = await getCurrentUser();
  if (!user) return { error: "Bitte zuerst anmelden." };

  const hostCheck = await requireRoundHost(roundId, user.id, HOST_SETTING_ERROR);
  if ("error" in hostCheck) return { error: hostCheck.error };
  const { round } = hostCheck;

  await prisma.meetupExcludedGame.deleteMany({ where: { roundId, gameId } });

  revalidateMeetupPaths(round.meetupId);
  return { ok: true };
}

export async function searchCollectionGamesAction(
  query: string,
  meetupId?: string,
) {
  const user = await getCurrentUser();
  if (!user) return { error: "Bitte zuerst anmelden." };

  const q = query.trim();
  if (q.length < 2) {
    return { ok: true as const, games: [] as { id: number; name: string; thumbnail: string | null }[] };
  }

  const nameFilter = { contains: q, mode: "insensitive" as const };
  const baseSelect = { id: true, name: true, thumbnail: true } as const;

  const collectionGames = await prisma.game.findMany({
    where: {
      listedInCollection: true,
      isExpansion: false,
      lentOut: false,
      name: nameFilter,
    },
    select: baseSelect,
    orderBy: { name: "asc" },
    take: 20,
  });

  if (!meetupId) {
    return { ok: true as const, games: collectionGames };
  }

  const collectionIds = new Set(collectionGames.map((g) => g.id));
  const remaining = 20 - collectionGames.length;
  const guestGames =
    remaining > 0
      ? await prisma.game.findMany({
          where: {
            listedInCollection: false,
            isExpansion: false,
            lentOut: false,
            name: nameFilter,
            meetupGuestGames: { some: { meetupId } },
            id: { notIn: [...collectionIds] },
          },
          select: baseSelect,
          orderBy: { name: "asc" },
          take: remaining,
        })
      : [];

  return { ok: true as const, games: [...collectionGames, ...guestGames] };
}
