import type { HostChoiceMode } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

/** Revalidiert alle Seiten eines Treffens (Detail, Pick, Duell, Erweiterung). */
export function revalidateMeetupPaths(meetupId: string) {
  revalidatePath(`/meetups/${meetupId}`);
  revalidatePath(`/meetups/${meetupId}/pick`);
  revalidatePath(`/meetups/${meetupId}/duell`);
  revalidatePath(`/meetups/${meetupId}/erweiterung`);
}

/** Revalidiert die für Erweiterungs-Abstimmungen relevanten Seiten. */
export function revalidateExpansionPaths(meetupId: string) {
  revalidatePath(`/meetups/${meetupId}`);
  revalidatePath(`/meetups/${meetupId}/erweiterung`);
}

/** Revalidiert Sammlungs-Seiten (optional inkl. Spiel-Detailseite). */
export function revalidateCollectionPaths(gameId?: number) {
  revalidatePath("/games");
  revalidatePath("/admin/import");
  revalidatePath("/admin/collection");
  if (gameId != null) {
    revalidatePath(`/games/${gameId}`);
  }
}

export type HostMeetup = {
  id: string;
  createdById: string;
};

export type HostRound = {
  id: string;
  meetupId: string;
  createdById: string;
  expectedPlayerCount: number;
  hostForcedGameId: number | null;
  hostChoiceMode: HostChoiceMode;
};

/** Lädt ein Meetup und stellt sicher, dass der Nutzer der Host ist. */
export async function requireMeetupHost(
  meetupId: string,
  userId: string,
  notHostError: string,
): Promise<{ error: string } | { meetup: HostMeetup }> {
  const meetup = await prisma.meetup.findUnique({
    where: { id: meetupId },
    select: { id: true, createdById: true },
  });
  if (!meetup) return { error: "Treffen nicht gefunden." };
  if (meetup.createdById !== userId) {
    return { error: notHostError };
  }
  return { meetup };
}

/** Lädt eine Runde inkl. Treffen und stellt sicher, dass der Nutzer der Host ist. */
export async function requireRoundHost(
  roundId: string,
  userId: string,
  notHostError: string,
): Promise<{ error: string } | { round: HostRound }> {
  const round = await prisma.meetupRound.findUnique({
    where: { id: roundId },
    select: {
      id: true,
      meetupId: true,
      expectedPlayerCount: true,
      hostForcedGameId: true,
      hostChoiceMode: true,
      meetup: { select: { createdById: true } },
    },
  });
  if (!round) return { error: "Spielrunde nicht gefunden." };
  if (round.meetup.createdById !== userId) {
    return { error: notHostError };
  }
  return {
    round: {
      id: round.id,
      meetupId: round.meetupId,
      createdById: round.meetup.createdById,
      expectedPlayerCount: round.expectedPlayerCount,
      hostForcedGameId: round.hostForcedGameId,
      hostChoiceMode: round.hostChoiceMode,
    },
  };
}

/**
 * Prüft, ob ein Spiel für den Pick-Pool eines Treffens wählbar ist
 * (Basisspiel, nicht verliehen, in Sammlung oder als Gast-Spiel verknüpft).
 */
export async function validatePickPoolGame(
  meetupId: string,
  gameId: number,
  messages: { expansion: string; notInPool: string },
): Promise<{ error: string } | { game: { id: number; name: string } }> {
  if (!Number.isFinite(gameId)) {
    return { error: "Ungültige Spiel-ID." };
  }
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: {
      id: true,
      name: true,
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
    return { error: messages.expansion };
  }
  if (game.lentOut) {
    return { error: "Dieses Spiel ist verliehen." };
  }
  const inPickPool =
    game.listedInCollection || game.meetupGuestGames.length > 0;
  if (!inPickPool) {
    return { error: messages.notInPool };
  }
  return { game };
}

/** Normalisiert einen gescannten Barcode auf Ziffern (oder null). */
export function normalizeBarcode(raw?: string | null): string | null {
  if (!raw?.trim()) return null;
  return raw.replace(/\D/g, "") || null;
}
