"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { getPickPhaseState } from "@/lib/pick-phase";
import { isMeetupPast } from "@/lib/meetup-time";
import {
  cancelActiveDuel,
  loadRoundParticipantData,
  removeUserFromMeetup,
  removeUserFromRound,
  syncExpectedPlayerCount,
} from "@/lib/meetup-participants";
import { revalidateMeetupPaths } from "@/app/actions/shared";

const MAX_EXPECTED = 20;

function clampExpected(count: number): number {
  return Math.max(1, Math.min(MAX_EXPECTED, Math.round(count)));
}

export async function createMeetupAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Bitte zuerst anmelden." };

  const title = String(formData.get("title") ?? "").trim();
  const dateRaw = String(formData.get("scheduledAt") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim() || null;
  const expected = parseInt(String(formData.get("expectedPlayerCount") ?? "4"), 10);
  const durationHours = parseFloat(
    String(formData.get("durationHours") ?? "4"),
  );

  // Eingegebene Rohwerte fuer den Fall, dass eine Validierung fehlschlaegt:
  // So bleibt das Formular nach dem React-19-Reset gefuellt.
  const values = {
    title,
    scheduledAt: dateRaw,
    durationHours: String(formData.get("durationHours") ?? ""),
    expectedPlayerCount: String(formData.get("expectedPlayerCount") ?? ""),
    location: String(formData.get("location") ?? ""),
  };

  if (!title) return { error: "Bitte einen Titel angeben.", values };

  const expectedCount = Number.isFinite(expected) ? Math.max(1, expected) : 4;

  const durationMinutes =
    Number.isFinite(durationHours) && durationHours > 0
      ? Math.max(30, Math.round(durationHours * 60))
      : 240;

  const scheduledAt = dateRaw ? new Date(dateRaw) : null;
  if (scheduledAt && Number.isNaN(scheduledAt.getTime())) {
    return { error: "Ungültiges Datum.", values };
  }
  if (scheduledAt && isMeetupPast({ scheduledAt, durationMinutes })) {
    return { error: "Das Treffen darf nicht in der Vergangenheit liegen.", values };
  }

  const meetup = await prisma.meetup.create({
    data: {
      title,
      scheduledAt,
      durationMinutes,
      location,
      createdById: user.id,
      rounds: {
        create: {
          sortOrder: 0,
          expectedPlayerCount: expectedCount,
          initialExpectedPlayerCount: expectedCount,
          registrationPeakCount: 1,
        },
      },
    },
  });

  redirect(`/meetups/${meetup.id}`);
}

export async function deleteMeetupAction(meetupId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Bitte zuerst anmelden." };

  const id = meetupId.trim();
  if (!id) return { error: "Ungültiges Treffen." };

  const meetup = await prisma.meetup.findUnique({
    where: { id },
    select: { createdById: true },
  });
  if (!meetup) return { error: "Treffen nicht gefunden." };
  if (meetup.createdById !== user.id && !isAdmin(user)) {
    return { error: "Nur der Host kann das Treffen löschen." };
  }

  await prisma.meetup.delete({ where: { id } });

  revalidatePath("/");

  return { ok: true };
}

/** Fügt einem Treffen eine weitere Spielrunde hinzu (nur Host). */
export async function addRoundAction(
  meetupId: string,
  input: { label?: string | null; startsAt?: string | null; expectedPlayerCount?: number },
) {
  const user = await getCurrentUser();
  if (!user) return { error: "Bitte zuerst anmelden." };

  const id = meetupId.trim();
  if (!id) return { error: "Ungültiges Treffen." };

  const meetup = await prisma.meetup.findUnique({
    where: { id },
    select: {
      createdById: true,
      rounds: { select: { sortOrder: true } },
    },
  });
  if (!meetup) return { error: "Treffen nicht gefunden." };
  if (meetup.createdById !== user.id) {
    return { error: "Nur der Host kann Spielrunden hinzufügen." };
  }

  const label = input.label?.trim() || null;
  const startsAtRaw = input.startsAt?.trim() || "";
  const startsAt = startsAtRaw ? new Date(startsAtRaw) : null;
  if (startsAt && Number.isNaN(startsAt.getTime())) {
    return { error: "Ungültige Uhrzeit." };
  }
  const expectedCount = clampExpected(input.expectedPlayerCount ?? 4);

  const nextSortOrder =
    meetup.rounds.reduce((max, r) => Math.max(max, r.sortOrder), -1) + 1;

  await prisma.meetupRound.create({
    data: {
      meetupId: id,
      label,
      startsAt,
      sortOrder: nextSortOrder,
      expectedPlayerCount: expectedCount,
      initialExpectedPlayerCount: expectedCount,
      registrationPeakCount: 1,
    },
  });

  revalidateMeetupPaths(id);
  revalidatePath("/");
  return { ok: true as const };
}

/** Ändert Label und Startzeit einer Spielrunde (nur Host). */
export async function updateRoundAction(
  roundId: string,
  input: { label?: string | null; startsAt?: string | null },
) {
  const user = await getCurrentUser();
  if (!user) return { error: "Bitte zuerst anmelden." };

  const round = await prisma.meetupRound.findUnique({
    where: { id: roundId },
    select: { meetupId: true, meetup: { select: { createdById: true } } },
  });
  if (!round) return { error: "Spielrunde nicht gefunden." };
  if (round.meetup.createdById !== user.id) {
    return { error: "Nur der Host kann Spielrunden bearbeiten." };
  }

  const label = input.label?.trim() || null;
  const startsAtRaw = input.startsAt?.trim() || "";
  const startsAt = startsAtRaw ? new Date(startsAtRaw) : null;
  if (startsAt && Number.isNaN(startsAt.getTime())) {
    return { error: "Ungültige Uhrzeit." };
  }

  await prisma.meetupRound.update({
    where: { id: roundId },
    data: { label, startsAt },
  });

  revalidateMeetupPaths(round.meetupId);
  return { ok: true as const };
}

/** Löscht eine Spielrunde (nur Host). Die letzte Runde kann nicht gelöscht werden. */
export async function deleteRoundAction(roundId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Bitte zuerst anmelden." };

  const round = await prisma.meetupRound.findUnique({
    where: { id: roundId },
    select: { meetupId: true, meetup: { select: { createdById: true } } },
  });
  if (!round) return { error: "Spielrunde nicht gefunden." };
  if (round.meetup.createdById !== user.id) {
    return { error: "Nur der Host kann Spielrunden löschen." };
  }

  const roundCount = await prisma.meetupRound.count({
    where: { meetupId: round.meetupId },
  });
  if (roundCount <= 1) {
    return { error: "Die letzte Spielrunde kann nicht gelöscht werden." };
  }

  await prisma.meetupRound.delete({ where: { id: roundId } });

  revalidateMeetupPaths(round.meetupId);
  revalidatePath("/");
  return { ok: true as const };
}

export async function updateExpectedCountAction(
  roundId: string,
  count: number,
) {
  const user = await getCurrentUser();
  if (!user) return { error: "Bitte zuerst anmelden." };

  const round = await prisma.meetupRound.findUnique({
    where: { id: roundId },
    select: {
      meetupId: true,
      expectedPlayerCount: true,
      meetup: { select: { createdById: true } },
    },
  });
  if (!round) return { error: "Spielrunde nicht gefunden." };
  if (round.meetup.createdById !== user.id) {
    return { error: "Nur der Host kann die erwartete Spieleranzahl ändern." };
  }

  const phase = await getPickPhaseState(
    roundId,
    round.expectedPlayerCount,
    prisma,
  );
  if (phase.picksLocked && !phase.hostForced) {
    return {
      error:
        "Erwartete Spieleranzahl kann erst geändert werden, wenn die laufenden Duelle abgeschlossen sind.",
    };
  }

  await prisma.meetupRound.update({
    where: { id: roundId },
    data: {
      expectedPlayerCount: clampExpected(count),
      duelFrozenAt: null,
      duelFrozenData: Prisma.DbNull,
      expansionDuelStartedAt: null,
      expansionDuelFrozenData: Prisma.DbNull,
      hostForcedGameId: null,
      hostForcedAt: null,
    },
  });
  await prisma.vote.deleteMany({
    where: { roundId, mode: "EXPANSION_DUEL" },
  });
  revalidateMeetupPaths(round.meetupId);
  return { ok: true };
}

/** Tritt einer einzelnen Spielrunde bei (Opt-in). */
export async function joinRoundAction(roundId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Bitte zuerst anmelden." };

  const round = await prisma.meetupRound.findUnique({
    where: { id: roundId },
    select: { id: true, meetupId: true },
  });
  if (!round) return { error: "Spielrunde nicht gefunden." };

  await prisma.$transaction([
    prisma.meetupRegistration.upsert({
      where: { meetupId_userId: { meetupId: round.meetupId, userId: user.id } },
      update: {},
      create: { meetupId: round.meetupId, userId: user.id },
    }),
    prisma.meetupRoundParticipant.upsert({
      where: { roundId_userId: { roundId, userId: user.id } },
      update: {},
      create: { roundId, userId: user.id },
    }),
  ]);

  await syncExpectedPlayerCount(roundId, prisma, "up");

  revalidatePath("/");
  revalidateMeetupPaths(round.meetupId);
  return { ok: true };
}

/** Verlässt eine einzelne Spielrunde. */
export async function leaveRoundAction(roundId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Bitte zuerst anmelden." };

  const data = await loadRoundParticipantData(roundId, prisma);
  if (!data) return { error: "Spielrunde nicht gefunden." };

  if (data.meetup.createdBy.id === user.id) {
    return { error: "Der Host kann sich nicht abmelden." };
  }
  if (data.duelsStarted) {
    return { error: "Abmelden nicht mehr möglich — Duelle laufen bereits." };
  }
  if (!data.players.some((p) => p.userId === user.id)) {
    return { error: "Du nimmst an dieser Runde nicht teil." };
  }

  await removeUserFromRound(roundId, user.id, prisma);

  revalidatePath("/");
  revalidateMeetupPaths(data.meetup.id);
  return { ok: true };
}

export async function joinMeetupAction(meetupId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Bitte zuerst anmelden." };

  const id = meetupId.trim();
  if (!id) return { error: "Ungültiges Treffen." };

  const meetup = await prisma.meetup.findUnique({
    where: { id },
    select: {
      id: true,
      rounds: { select: { id: true }, orderBy: { sortOrder: "asc" } },
    },
  });
  if (!meetup) return { error: "Treffen nicht gefunden." };

  await prisma.meetupRegistration.upsert({
    where: { meetupId_userId: { meetupId: id, userId: user.id } },
    update: {},
    create: { meetupId: id, userId: user.id },
  });

  // Bei genau einer Runde automatisch dieser Runde beitreten, damit sich das
  // Standard-Treffen (eine Runde) wie bisher verhält.
  if (meetup.rounds.length === 1) {
    const roundId = meetup.rounds[0].id;
    await prisma.meetupRoundParticipant.upsert({
      where: { roundId_userId: { roundId, userId: user.id } },
      update: {},
      create: { roundId, userId: user.id },
    });
    await syncExpectedPlayerCount(roundId, prisma, "up");
  }

  revalidatePath("/");
  revalidateMeetupPaths(id);
  return { ok: true };
}

export async function leaveMeetupAction(meetupId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Bitte zuerst anmelden." };

  const id = meetupId.trim();
  if (!id) return { error: "Ungültiges Treffen." };

  const meetup = await prisma.meetup.findUnique({
    where: { id },
    select: {
      createdById: true,
      rounds: { select: { id: true } },
    },
  });
  if (!meetup) return { error: "Treffen nicht gefunden." };

  if (meetup.createdById === user.id) {
    return { error: "Der Host kann sich nicht abmelden." };
  }

  const roundIds = meetup.rounds.map((r) => r.id);
  const duelVoteCount = await prisma.vote.count({
    where: { roundId: { in: roundIds }, mode: "DUEL" },
  });
  if (duelVoteCount > 0) {
    return { error: "Abmelden nicht mehr möglich — Duelle laufen bereits." };
  }

  await removeUserFromMeetup(id, user.id, prisma);

  revalidatePath("/");
  revalidateMeetupPaths(id);
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

  const meetup = await prisma.meetup.findUnique({
    where: { id },
    select: {
      createdById: true,
      rounds: { select: { id: true, expectedPlayerCount: true } },
    },
  });
  if (!meetup) return { error: "Treffen nicht gefunden." };

  if (meetup.createdById !== user.id) {
    return { error: "Nur der Host kann Teilnehmer entfernen." };
  }
  if (targetId === meetup.createdById) {
    return { error: "Der Host kann nicht entfernt werden." };
  }

  // Duell-Status pro Runde vor dem Entfernen festhalten.
  const lockedRounds: { id: string; expectedPlayerCount: number }[] = [];
  for (const round of meetup.rounds) {
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

  await removeUserFromMeetup(id, targetId, prisma);

  for (const round of lockedRounds) {
    await cancelActiveDuel(round.id, round.expectedPlayerCount, prisma);
  }

  revalidatePath("/");
  revalidateMeetupPaths(id);
  return { ok: true };
}
