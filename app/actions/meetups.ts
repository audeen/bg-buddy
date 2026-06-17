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
  loadMeetupParticipantData,
  removeUserFromMeetup,
  syncExpectedPlayerCount,
} from "@/lib/meetup-participants";

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
  if (phase.picksLocked && !phase.hostForced) {
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
      hostForcedGameId: null,
      hostForcedAt: null,
    },
  });
  await prisma.vote.deleteMany({
    where: { meetupId, mode: "EXPANSION_DUEL" },
  });
  revalidatePath(`/meetups/${meetupId}`);
  revalidatePath(`/meetups/${meetupId}/pick`);
  revalidatePath(`/meetups/${meetupId}/duell`);
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
