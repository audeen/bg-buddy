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
  MAX_DUEL_WINS_PER_GAME,
  MAX_PICKS_PER_COUNT,
} from "@/lib/vote-limits";

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

  const meetup = await prisma.meetup.create({
    data: {
      title,
      scheduledAt: dateRaw ? new Date(dateRaw) : null,
      location,
      expectedPlayerCount: Number.isFinite(expected) ? Math.max(1, expected) : 4,
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

  await prisma.meetup.update({
    where: { id: meetupId },
    data: { expectedPlayerCount: Math.max(1, Math.round(count)) },
  });
  revalidatePath(`/meetups/${meetupId}`);
  return { ok: true };
}

export async function togglePickVoteAction(
  meetupId: string,
  gameId: number,
  playerCount: number,
) {
  const user = await getCurrentUser();
  if (!user) return { error: "Bitte zuerst anmelden." };

  const existing = await prisma.vote.findFirst({
    where: {
      meetupId,
      userId: user.id,
      gameId,
      playerCount,
      mode: "PICK",
    },
  });

  if (existing) {
    await prisma.vote.delete({ where: { id: existing.id } });
    revalidatePath(`/meetups/${meetupId}`);
    return { voted: false };
  }

  const pickCount = await prisma.vote.count({
    where: {
      meetupId,
      userId: user.id,
      playerCount,
      mode: "PICK",
    },
  });
  if (pickCount >= MAX_PICKS_PER_COUNT) {
    return {
      error: `Maximal ${MAX_PICKS_PER_COUNT} Direkt-Picks für diese Spieleranzahl.`,
    };
  }

  await prisma.vote.create({
    data: {
      meetupId,
      userId: user.id,
      gameId,
      playerCount,
      mode: "PICK",
      points: 1,
    },
  });
  revalidatePath(`/meetups/${meetupId}`);
  revalidatePath(`/meetups/${meetupId}/duell`);
  return { voted: true };
}

export async function duelVoteAction(
  meetupId: string,
  winnerGameId: number,
  playerCount: number,
) {
  const user = await getCurrentUser();
  if (!user) return { error: "Bitte zuerst anmelden." };

  const meetup = await prisma.meetup.findUnique({
    where: { id: meetupId },
    select: { expectedPlayerCount: true },
  });
  if (!meetup) return { error: "Treffen nicht gefunden." };
  if (playerCount !== meetup.expectedPlayerCount) {
    return { error: "Duelle nur für die erwartete Spieleranzahl." };
  }

  const inPool = await prisma.vote.count({
    where: {
      meetupId,
      mode: "PICK",
      playerCount,
      gameId: winnerGameId,
    },
  });
  if (!inPool) {
    return { error: "Dieses Spiel wurde noch nicht direkt gepickt." };
  }

  const winCount = await prisma.vote.count({
    where: {
      meetupId,
      userId: user.id,
      gameId: winnerGameId,
      playerCount,
      mode: "DUEL",
    },
  });
  if (winCount >= MAX_DUEL_WINS_PER_GAME) {
    return {
      error: "Dieses Spiel hat hier schon genug Siege.",
    };
  }

  await prisma.vote.create({
    data: {
      meetupId,
      userId: user.id,
      gameId: winnerGameId,
      playerCount,
      mode: "DUEL",
      points: 1,
    },
  });
  revalidatePath(`/meetups/${meetupId}`);
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
