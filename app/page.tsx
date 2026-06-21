import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "@/components/LoginForm";
import { MeetupOverviewCard } from "@/components/MeetupOverviewCard";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { NewMeetupButton } from "@/components/NewMeetupButton";
import { PageHeader } from "@/components/PageHeader";
import { HomeSpotlightCarousel } from "@/components/HomeSpotlightCarousel";
import { isMeetupPast } from "@/lib/meetup-time";
import type { GameCardGame, GameDetailData } from "@/lib/types/game";
import {
  berlinDateKey,
  findUpcomingMeetup,
  resolveGameOfTheDay,
  type GameOfTheDayCandidate,
} from "@/lib/game-of-the-day";
import { buildRecentGamesPool } from "@/lib/latest-game";
import {
  getHotnessSpotlight,
  type HotnessSpotlight,
} from "@/lib/bgg/hotness";
import {
  gameCardSelect,
  loadOwnedExpansionsByBaseGame,
  serializeExpansionsByBaseId,
} from "@/lib/owned-expansions";
import {
  buildRegisteredPlayers,
  groupPickVotersByMeetup,
} from "@/lib/meetup-participants";

export const dynamic = "force-dynamic";

type HomeMeetup = Awaited<
  ReturnType<
    typeof prisma.meetup.findMany<{
      include: {
        createdBy: { select: { id: true; name: true } };
        registrations: {
          include: { user: { select: { id: true; name: true } } };
        };
        _count: { select: { votes: true } };
      };
    }>
  >
>[number];

function HomeSpotlightSkeleton() {
  return (
    <div className="card overflow-hidden" aria-busy="true">
      <div className="aspect-[4/3] w-full animate-pulse bg-[var(--surface-2)]" />
      <div className="card-pad flex flex-col gap-3">
        <div className="h-3 w-28 animate-pulse rounded-full bg-[var(--surface-2)]" />
        <div className="h-5 w-3/4 animate-pulse rounded-full bg-[var(--surface-2)]" />
        <div className="h-4 w-1/2 animate-pulse rounded-full bg-[var(--surface-2)]" />
      </div>
      <p className="sr-only" role="status">
        Empfehlungen werden geladen …
      </p>
    </div>
  );
}

export default async function Home() {
  const user = await getCurrentUser();

  const [meetups, gameCount] = await Promise.all([
    prisma.meetup.findMany({
      orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }],
      include: {
        createdBy: { select: { id: true, name: true } },
        registrations: {
          include: { user: { select: { id: true, name: true } } },
        },
        _count: { select: { votes: true } },
      },
    }),
    prisma.game.count({
      where: { isExpansion: false, listedInCollection: true },
    }),
  ]);

  const meetupIds = meetups.map((m) => m.id);
  const pickVotes =
    meetupIds.length > 0
      ? await prisma.vote.findMany({
          where: { meetupId: { in: meetupIds }, mode: "PICK" },
          select: {
            meetupId: true,
            userId: true,
            user: { select: { name: true } },
          },
        })
      : [];

  const pickVotersByMeetup = groupPickVotersByMeetup(pickVotes);

  const duelCounts =
    meetupIds.length > 0
      ? await prisma.vote.groupBy({
          by: ["meetupId"],
          where: {
            meetupId: { in: meetupIds },
            mode: "DUEL",
          },
          _count: { _all: true },
        })
      : [];

  const duelsStartedByMeetup = new Map(
    duelCounts.map((d) => [d.meetupId, d._count._all > 0]),
  );

  const now = new Date();
  const upcomingMeetups = meetups.filter((m) => !isMeetupPast(m, now));
  const pastMeetups = meetups
    .filter((m) => isMeetupPast(m, now))
    .sort(
      (a, b) =>
        (b.scheduledAt?.getTime() ?? 0) - (a.scheduledAt?.getTime() ?? 0),
    );

  const nextMeetup = upcomingMeetups[0] ?? null;
  const otherMeetups = upcomingMeetups.slice(1);
  const upcomingMeetup = findUpcomingMeetup(meetups, now);

  let gotdGame: GameOfTheDayCandidate | null = null;
  let gotdPlayerCount: number | null = null;
  let latestPool: GameDetailData[] = [];
  let spotlightExpansions: Record<string, GameCardGame[]> = {};
  let hotnessPromise: Promise<HotnessSpotlight | null> = Promise.resolve(null);

  if (gameCount > 0) {
    const [games, expansionsByBase] = await Promise.all([
      prisma.game.findMany({
        where: { isExpansion: false, listedInCollection: true },
        select: { ...gameCardSelect, lentOut: true, addedToCollectionAt: true },
      }),
      loadOwnedExpansionsByBaseGame(),
    ]);
    // Bewusst NICHT awaiten: Die (oft langsame, gedrosselte) BGG-Hotness
    // streamt ueber <Suspense> nach und blockiert so nicht den ersten
    // Seitenaufbau.
    hotnessPromise = getHotnessSpotlight(berlinDateKey(new Date())).catch(
      () => null,
    );
    const gotd = resolveGameOfTheDay(
      games,
      expansionsByBase,
      upcomingMeetup,
      berlinDateKey(new Date()),
    );
    gotdGame = gotd.game;
    gotdPlayerCount = gotd.playerCount;
    latestPool = buildRecentGamesPool(games);
    spotlightExpansions = serializeExpansionsByBaseId(expansionsByBase);
  }

  function renderMeetupCard(m: HomeMeetup) {
    const pickVoters = pickVotersByMeetup.get(m.id) ?? [];
    const manualRegistrations = m.registrations.map((r) => ({
      userId: r.userId,
      name: r.user.name,
    }));
    const players = buildRegisteredPlayers(
      m.createdBy,
      pickVoters,
      manualRegistrations,
    );

    return (
      <MeetupOverviewCard
        meetupId={m.id}
        title={m.title}
        scheduledAt={m.scheduledAt}
        durationMinutes={m.durationMinutes}
        location={m.location}
        expected={m.expectedPlayerCount}
        hostName={m.createdBy.name}
        voteCount={m._count.votes}
        players={players}
        duelsStarted={duelsStartedByMeetup.get(m.id) ?? false}
        currentUserId={user?.id}
        isLoggedIn={!!user}
      />
    );
  }

  const gotdSection =
    gameCount > 0 ? (
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Suspense fallback={<HomeSpotlightSkeleton />}>
          <HomeSpotlightCarousel
            gotdGame={gotdGame}
            gotdPlayerCount={gotdPlayerCount ?? undefined}
            expansionsByBaseId={spotlightExpansions}
            latestPool={latestPool}
            hotnessPromise={hotnessPromise}
          />
        </Suspense>
      </section>
    ) : null;

  const importBanner =
    gameCount === 0 ? (
      <section className="card card-pad border-dashed">
        <h2 className="section-title mb-1">Noch keine Spiele importiert</h2>
        <p className="text-sm text-[var(--muted)] mb-3">
          Lade deine BoardGameGeek-Collection (CSV-Export) hoch, um loszulegen.
        </p>
        <Link href="/admin/import" className="btn btn-primary">
          Zum Import
        </Link>
      </section>
    ) : null;

  return (
    <div className="container-app flex flex-col gap-8">
      {user ? (
        <>
          <header className="flex items-end justify-between gap-3">
            <div>
              <h1 className="page-title">BG Buddy</h1>
            </div>
            <NewMeetupButton />
          </header>

          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="section-title">Nächstes Treffen</h2>
            </div>
            {nextMeetup ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {renderMeetupCard(nextMeetup)}
              </div>
            ) : (
              <p className="text-[var(--muted)]">
                Noch keine Treffen. Lege das erste an!
              </p>
            )}
          </section>

          {gotdSection}
          {importBanner}

          {otherMeetups.length > 0 && (
            <section className="flex flex-col gap-4">
              <h2 className="section-title">Weitere Treffen</h2>
              <ul className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                {otherMeetups.map((m) => (
                  <li key={m.id}>{renderMeetupCard(m)}</li>
                ))}
              </ul>
            </section>
          )}

          {pastMeetups.length > 0 && (
            <CollapsibleSection
              title="Vergangene Treffen"
              count={pastMeetups.length}
            >
              <ul className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                {pastMeetups.map((m) => (
                  <li key={m.id}>{renderMeetupCard(m)}</li>
                ))}
              </ul>
            </CollapsibleSection>
          )}
        </>
      ) : (
        <>
          <PageHeader title="Was kommt heute auf den Tisch?">
            <p className="text-[var(--muted)] max-w-2xl">
              Gib deine Stimmen ab und lass deine Spiele gegen die Picks der
              anderen antreten. Finde heraus, über welche Regeln wir heute
              diskutieren!
            </p>
          </PageHeader>

          <section className="card card-pad max-w-md">
            <h2 className="section-title mb-3">Anmelden</h2>
            <LoginForm />
          </section>

          {importBanner}
        </>
      )}
    </div>
  );
}
