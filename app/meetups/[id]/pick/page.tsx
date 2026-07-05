import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import Link from "next/link";
import { PickClient } from "@/components/PickClient";
import { PageHeader } from "@/components/PageHeader";
import { RoundSwitcher } from "@/components/RoundSwitcher";
import { isMeetupRegistered, resolveRound } from "@/lib/round-resolve";
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
  const roundParam = typeof sp.runde === "string" ? sp.runde : undefined;
  const activeFilters = parseGameFilters(sp);
  const sort = parseGameSort(sp);
  const user = await getCurrentUser();
  if (!user) redirect("/#login");

  const resolved = await resolveRound(id, roundParam);
  if (!resolved) notFound();
  const { rounds, activeRoundId, multiRound } = resolved;
  const roundQuery = multiRound ? `?runde=${activeRoundId}` : "";

  const meetup = await prisma.meetup.findUnique({
    where: { id },
    select: { title: true },
  });
  const round = await prisma.meetupRound.findUnique({
    where: { id: activeRoundId },
    select: {
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
  if (!meetup || !round) notFound();

  const hostChoiceGameIds = round.hostChoiceGames.map((g) => g.gameId);
  const hostForced = round.hostForcedGameId != null;

  // Nicht am Treffen angemeldet: Hinweis statt Vote-UI.
  const meetupRegistered = await isMeetupRegistered(id, user.id);
  if (!meetupRegistered) {
    return (
      <div className="container-app flex flex-col gap-6">
        <PageHeader
          id="pick-page-top"
          eyebrow={meetup.title}
          title="Stimmen vergeben"
        />
        {multiRound && (
          <RoundSwitcher
            meetupId={id}
            segment="pick"
            rounds={rounds}
            activeRoundId={activeRoundId}
          />
        )}
        <div className="card card-pad flex flex-col gap-3">
          <p className="text-sm text-[var(--muted)]">
            Du nimmst am Treffen noch nicht teil. Tritt oben beim Treffen bei,
            um mitzustimmen.
          </p>
          <Link href={`/meetups/${id}`} className="btn btn-primary w-fit">
            Zum Treffen
          </Link>
        </div>
      </div>
    );
  }

  const [games, guestGameIds, myVotes, { phase, summary }, expansionsByBase] = await Promise.all([
    prisma.game.findMany({
      where: pickGamesWhereForMeetup(
        id,
        round.hostChoiceMode,
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
      where: { roundId: activeRoundId, userId: user.id, mode: "PICK" },
      select: { gameId: true, playerCount: true, points: true },
    }),
    loadPickPhaseSummary(activeRoundId, round.expectedPlayerCount, prisma),
    loadOwnedExpansionsByBaseGame(),
  ]);

  return (
    <div className="container-app flex flex-col gap-6">
      <PageHeader
        id="pick-page-top"
        eyebrow={meetup.title}
        title="Stimmen vergeben"
      />

      <RoundSwitcher
        meetupId={id}
        segment="pick"
        rounds={rounds}
        activeRoundId={activeRoundId}
      />

      <PickClient
        key={activeRoundId}
        meetupId={id}
        roundId={activeRoundId}
        roundQuery={roundQuery}
        expected={round.expectedPlayerCount}
        games={games}
        initialPicks={myVotes}
        scrollTargetId="pick-page-top"
        picksLocked={phase.picksLocked}
        readyForDuels={phase.readyForDuels}
        pickPhaseSummary={summary}
        expansionsByBaseId={serializeExpansionsByBaseId(expansionsByBase)}
        guestGameIds={guestGameIds}
        hostChoiceGameIds={hostChoiceGameIds}
        hostChoiceMode={round.hostChoiceMode}
        hostForced={hostForced}
        hostForcedGame={round.hostForcedGame}
        activeFilters={activeFilters}
        sort={sort}
      />
    </div>
  );
}
