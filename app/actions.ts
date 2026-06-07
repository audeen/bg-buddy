"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getCurrentUser } from "@/lib/auth";
import { parseCollectionCsv } from "@/lib/bgg";
import {
  loadEnrichmentCache,
  thingDetailsToDbFields,
} from "@/lib/enrichment-cache";
import {
  buildDuellPlan,
  buildUserPointsMap,
  isPairInList,
  pairKey,
  duelParticipantIds,
} from "@/lib/duel-pairs";
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
  countDummyMeetups,
  createAllDummyMeetups,
  DUMMY_MEETUP_PREFIX,
  purgeDummyMeetups,
} from "@/lib/dummy-meetups";
import {
  loadMeetupParticipantData,
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
    data: { expectedPlayerCount: Math.max(1, Math.round(count)) },
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

  await prisma.$transaction([
    prisma.meetupRegistration.deleteMany({
      where: { meetupId: id, userId: user.id },
    }),
    prisma.vote.deleteMany({
      where: { meetupId: id, userId: user.id, mode: "PICK" },
    }),
  ]);

  await syncExpectedPlayerCount(id, prisma, "down");

  revalidatePath("/");
  revalidatePath(`/meetups/${id}`);
  revalidatePath(`/meetups/${id}/pick`);
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
    select: { expectedPlayerCount: true },
  });
  if (!meetup) return { error: "Treffen nicht gefunden." };
  if (playerCount !== meetup.expectedPlayerCount) {
    return { error: "Duelle nur für die erwartete Spieleranzahl." };
  }

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
  const pool = poolGameIds(pickCounts);

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

  const plan = buildDuellPlan({
    poolGameIds: pool,
    pickCounts,
    userPoints: buildUserPointsMap(groupPicks),
    userId: user.id,
    participantIds: duelParticipantIds(groupPicks),
    meetupId,
  });

  const pair = { a: winnerGameId, b: opponentGameId };
  if (!isPairInList(pair, plan.myPairs)) {
    return { error: "Dieses Paar ist dir nicht zugewiesen." };
  }

  const key = pairKey(winnerGameId, opponentGameId);
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

  await prisma.vote.create({
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
  revalidatePath(`/meetups/${meetupId}`);
  revalidatePath(`/meetups/${meetupId}/pick`);
  revalidatePath(`/meetups/${meetupId}/duell`);
  return { ok: true };
}

export async function importCsvAction(formData: FormData) {
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

  const cache = loadEnrichmentCache();
  let cacheApplied = 0;

  for (const g of games) {
    const base = {
      name: g.name,
      year: g.year,
      minPlayers: g.minPlayers,
      maxPlayers: g.maxPlayers,
      playingTime: g.playingTime,
      minPlaytime: g.minPlaytime,
      maxPlaytime: g.maxPlaytime,
      weight: g.weight,
      bggRating: g.bggRating,
      rank: g.rank,
      ageRange: g.ageRange,
      languageDependence: g.languageDependence,
      isExpansion: g.isExpansion,
      bestPlayerCounts: g.bestPlayerCounts,
      recommendedPlayerCounts: g.recommendedPlayerCounts,
    };
    const cached = cache.get(g.id);
    const extra = cached ? thingDetailsToDbFields(cached) : {};
    if (cached) cacheApplied += 1;

    await prisma.game.upsert({
      where: { id: g.id },
      update: cached ? { ...base, ...extra } : base,
      create: {
        id: g.id,
        enriched: false,
        ...base,
        ...extra,
      },
    });
  }

  const expansions = games.filter((g) => g.isExpansion).length;
  revalidatePath("/games");
  revalidatePath("/admin/import");
  return {
    ok: true,
    total: games.length,
    standalone: games.length - expansions,
    expansions,
    cacheApplied,
  };
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
