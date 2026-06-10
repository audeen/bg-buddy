"use server";

import type { HostChoiceMode } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { loadGameMetadata, upsertGameRecord } from "@/lib/upsert-game";
import { getPickPhaseState } from "@/lib/pick-phase";
import { cancelActiveDuel } from "@/lib/meetup-participants";
import {
  normalizeBarcode,
  requireMeetupHost,
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

  const hostCheck = await requireMeetupHost(meetupId, user.id, GUEST_GAME_HOST_ERROR);
  if ("error" in hostCheck) {
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

export async function forceMeetupGameAction(meetupId: string, gameId: number) {
  const user = await getCurrentUser();
  if (!user) return { error: "Bitte zuerst anmelden." };

  const hostCheck = await requireMeetupHost(meetupId, user.id, HOST_SETTING_ERROR);
  if ("error" in hostCheck) return { error: hostCheck.error };

  const gameCheck = await validatePickPoolGame(meetupId, gameId, {
    expansion: "Erweiterungen können nicht festgelegt werden.",
    notInPool: "Dieses Spiel ist nicht verfügbar.",
  });
  if ("error" in gameCheck) return { error: gameCheck.error };

  const phase = await getPickPhaseState(
    meetupId,
    hostCheck.meetup.expectedPlayerCount,
    prisma,
  );

  await prisma.$transaction(async (tx) => {
    await tx.meetupHostChoiceGame.deleteMany({ where: { meetupId } });
    await tx.meetup.update({
      where: { id: meetupId },
      data: {
        hostForcedGameId: gameId,
        hostForcedAt: new Date(),
        hostChoiceMode: "NONE",
      },
    });
  });

  if (phase.picksLocked) {
    await cancelActiveDuel(
      meetupId,
      hostCheck.meetup.expectedPlayerCount,
      prisma,
    );
  }

  revalidateMeetupPaths(meetupId);
  revalidatePath("/");
  return { ok: true as const, name: gameCheck.game.name };
}

export async function clearForcedMeetupGameAction(meetupId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Bitte zuerst anmelden." };

  const hostCheck = await requireMeetupHost(meetupId, user.id, HOST_SETTING_ERROR);
  if ("error" in hostCheck) return { error: hostCheck.error };
  if (hostCheck.meetup.hostForcedGameId == null) {
    return { ok: true };
  }

  await prisma.meetup.update({
    where: { id: meetupId },
    data: { hostForcedGameId: null, hostForcedAt: null },
  });

  revalidateMeetupPaths(meetupId);
  revalidatePath("/");
  return { ok: true };
}

export async function addHostChoiceGameAction(meetupId: string, gameId: number) {
  const user = await getCurrentUser();
  if (!user) return { error: "Bitte zuerst anmelden." };

  const hostCheck = await requireMeetupHost(meetupId, user.id, HOST_SETTING_ERROR);
  if ("error" in hostCheck) return { error: hostCheck.error };
  if (hostCheck.meetup.hostForcedGameId != null) {
    return { error: "Spiel ist festgelegt — Vorauswahl nicht möglich." };
  }

  const gameCheck = await validatePickPoolGame(meetupId, gameId, {
    expansion: "Erweiterungen können nicht ausgewählt werden.",
    notInPool: "Dieses Spiel ist nicht verfügbar.",
  });
  if ("error" in gameCheck) return { error: gameCheck.error };

  const existing = await prisma.meetupHostChoiceGame.findUnique({
    where: { meetupId_gameId: { meetupId, gameId } },
    select: { id: true },
  });
  if (existing) {
    return { error: "Spiel ist bereits in der Vorauswahl." };
  }

  const count = await prisma.meetupHostChoiceGame.count({ where: { meetupId } });

  await prisma.meetupHostChoiceGame.create({
    data: { meetupId, gameId, sortOrder: count },
  });

  if (hostCheck.meetup.hostChoiceMode === "NONE") {
    await prisma.meetup.update({
      where: { id: meetupId },
      data: { hostChoiceMode: "HIGHLIGHT" },
    });
  }

  revalidateMeetupPaths(meetupId);
  return { ok: true as const, name: gameCheck.game.name };
}

export async function removeHostChoiceGameAction(
  meetupId: string,
  gameId: number,
) {
  const user = await getCurrentUser();
  if (!user) return { error: "Bitte zuerst anmelden." };

  const hostCheck = await requireMeetupHost(meetupId, user.id, HOST_SETTING_ERROR);
  if ("error" in hostCheck) return { error: hostCheck.error };
  if (hostCheck.meetup.hostForcedGameId != null) {
    return { error: "Spiel ist festgelegt — Vorauswahl nicht änderbar." };
  }

  await prisma.meetupHostChoiceGame.deleteMany({
    where: { meetupId, gameId },
  });

  const remaining = await prisma.meetupHostChoiceGame.count({ where: { meetupId } });
  if (remaining === 0 && hostCheck.meetup.hostChoiceMode !== "NONE") {
    await prisma.meetup.update({
      where: { id: meetupId },
      data: { hostChoiceMode: "NONE" },
    });
  }

  revalidateMeetupPaths(meetupId);
  return { ok: true };
}

export async function setHostChoiceModeAction(
  meetupId: string,
  mode: HostChoiceMode,
) {
  const user = await getCurrentUser();
  if (!user) return { error: "Bitte zuerst anmelden." };

  const hostCheck = await requireMeetupHost(meetupId, user.id, HOST_SETTING_ERROR);
  if ("error" in hostCheck) return { error: hostCheck.error };
  if (hostCheck.meetup.hostForcedGameId != null) {
    return { error: "Spiel ist festgelegt — Vorauswahl nicht änderbar." };
  }

  if (mode !== "NONE") {
    const count = await prisma.meetupHostChoiceGame.count({ where: { meetupId } });
    if (count === 0) {
      return { error: "Zuerst Spiele zur Vorauswahl hinzufügen." };
    }
  }

  await prisma.meetup.update({
    where: { id: meetupId },
    data: { hostChoiceMode: mode === "NONE" ? "NONE" : mode },
  });

  revalidateMeetupPaths(meetupId);
  return { ok: true };
}

export async function clearHostChoiceGamesAction(meetupId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Bitte zuerst anmelden." };

  const hostCheck = await requireMeetupHost(meetupId, user.id, HOST_SETTING_ERROR);
  if ("error" in hostCheck) return { error: hostCheck.error };
  if (hostCheck.meetup.hostForcedGameId != null) {
    return { error: "Spiel ist festgelegt — Vorauswahl nicht änderbar." };
  }

  await prisma.$transaction([
    prisma.meetupHostChoiceGame.deleteMany({ where: { meetupId } }),
    prisma.meetup.update({
      where: { id: meetupId },
      data: { hostChoiceMode: "NONE" },
    }),
  ]);

  revalidateMeetupPaths(meetupId);
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
