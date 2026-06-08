import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { PickClient } from "@/components/PickClient";
import { PageHeader } from "@/components/PageHeader";
import { loadPickPhaseSummary } from "@/lib/pick-phase";
import { loadOwnedExpansionsByBaseGame, serializeExpansionsByBaseId } from "@/lib/owned-expansions";
import { pickGamesWhere } from "@/lib/meetup-guest-games";

export const dynamic = "force-dynamic";

export default async function PickPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/#login");

  const meetup = await prisma.meetup.findUnique({ where: { id } });
  if (!meetup) notFound();

  const [games, guestGameIds, myVotes, { phase, summary }, expansionsByBase] = await Promise.all([
    prisma.game.findMany({
      where: pickGamesWhere(id),
      select: {
        id: true,
        name: true,
        year: true,
        description: true,
        thumbnail: true,
        image: true,
        minPlayers: true,
        maxPlayers: true,
        minPlaytime: true,
        maxPlaytime: true,
        playingTime: true,
        weight: true,
        bggRating: true,
        ageRange: true,
        isExpansion: true,
        categories: true,
        mechanics: true,
        bestPlayerCounts: true,
        recommendedPlayerCounts: true,
        lentOut: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.meetupGuestGame.findMany({
      where: { meetupId: id },
      select: { gameId: true },
    }).then((rows) => rows.map((r) => r.gameId)),
    prisma.vote.findMany({
      where: { meetupId: id, userId: user.id, mode: "PICK" },
      select: { gameId: true, playerCount: true, points: true },
    }),
    loadPickPhaseSummary(id, meetup.expectedPlayerCount, prisma),
    loadOwnedExpansionsByBaseGame(),
  ]);

  return (
    <div className="container-app flex flex-col gap-6">
      <PageHeader
        id="pick-page-top"
        eyebrow={meetup.title}
        title="Stimmen vergeben"
      />

      <Suspense
        fallback={
          <div className="filter-dropdown h-12 animate-pulse rounded-xl" />
        }
      >
        <PickClient
          key={meetup.expectedPlayerCount}
          meetupId={id}
          expected={meetup.expectedPlayerCount}
          games={games}
          initialPicks={myVotes}
          scrollTargetId="pick-page-top"
          picksLocked={phase.picksLocked}
          readyForDuels={phase.readyForDuels}
          pickPhaseSummary={summary}
          expansionsByBaseId={serializeExpansionsByBaseId(expansionsByBase)}
          guestGameIds={guestGameIds}
        />
      </Suspense>
    </div>
  );
}
