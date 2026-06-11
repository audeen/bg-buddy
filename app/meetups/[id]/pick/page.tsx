import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { PickClient } from "@/components/PickClient";
import { PageHeader } from "@/components/PageHeader";
import { loadPickPhaseSummary } from "@/lib/pick-phase";
import { loadOwnedExpansionsByBaseGame, serializeExpansionsByBaseId } from "@/lib/owned-expansions";
import { pickGamesWhereForMeetup } from "@/lib/meetup-guest-games";
import { parseGameFilters, parseGameSort } from "@/lib/game-filters";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function PickPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const activeFilters = parseGameFilters(sp);
  const sort = parseGameSort(sp);
  const user = await getCurrentUser();
  if (!user) redirect("/#login");

  const meetup = await prisma.meetup.findUnique({
    where: { id },
    select: {
      title: true,
      expectedPlayerCount: true,
      hostChoiceMode: true,
      hostForcedGameId: true,
      hostForcedGame: {
        select: { id: true, name: true, thumbnail: true, image: true, coverUrl: true },
      },
      hostChoiceGames: {
        select: { gameId: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!meetup) notFound();

  const hostChoiceGameIds = meetup.hostChoiceGames.map((g) => g.gameId);
  const hostForced = meetup.hostForcedGameId != null;

  const [games, guestGameIds, myVotes, { phase, summary }, expansionsByBase] = await Promise.all([
    prisma.game.findMany({
      where: pickGamesWhereForMeetup(
        id,
        meetup.hostChoiceMode,
        hostChoiceGameIds,
      ),
      select: {
        id: true,
        name: true,
        year: true,
        description: true,
        thumbnail: true,
        image: true,
        coverUrl: true,
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
        hostChoiceGameIds={hostChoiceGameIds}
        hostChoiceMode={meetup.hostChoiceMode}
        hostForced={hostForced}
        hostForcedGame={meetup.hostForcedGame}
        activeFilters={activeFilters}
        sort={sort}
      />
    </div>
  );
}
