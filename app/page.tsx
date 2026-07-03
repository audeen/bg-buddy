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
import { roundOrderBy } from "@/lib/round-resolve";

export const dynamic = "force-dynamic";

type HomeMeetup = Awaited<
  ReturnType<
    typeof prisma.meetup.findMany<{
      include: {
        createdBy: { select: { id: true; name: true } };
        registrations: {
          include: { user: { select: { id: true; name: true } } };
        };
        rounds: {
          select: { id: true; expectedPlayerCount: true; sortOrder: true };
        };
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
        rounds: {
          orderBy: [...roundOrderBy],
          select: { id: true, expectedPlayerCount: true, sortOrder: true },
        },
      },
    }),
    prisma.game.count({
      where: { isExpansion: false, listedInCollection: true },
    }),
  ]);

  // Runden -> Treffen-Zuordnung, um runden-scoped Votes je Treffen zu aggregieren.
  const roundToMeetup = new Map<string, string>();
  for (const m of meetups) {
    for (const r of m.rounds) roundToMeetup.set(r.id, m.id);
  }
  const roundIds = [...roundToMeetup.keys()];

  const pickVotes =
    roundIds.length > 0
      ? await prisma.vote.findMany({
          where: { roundId: { in: roundIds }, mode: "PICK" },
          select: {
            roundId: true,
            userId: true,
            user: { select: { name: true } },
          },
        })
      : [];

  const pickVotersByMeetup = groupPickVotersByMeetup(
    pickVotes.map((v) => ({
      meetupId: roundToMeetup.get(v.roundId) ?? v.roundId,
      userId: v.userId,
      user: v.user,
    })),
  );

  const voteGroups =
    roundIds.length > 0
      ? await prisma.vote.groupBy({
          by: ["roundId"],
          where: { roundId: { in: roundIds } },
          _count: { _all: true },
        })
      : [];
  const voteCountByMeetup = new Map<string, number>();
  for (const g of voteGroups) {
    const mId = roundToMeetup.get(g.roundId);
    if (!mId) continue;
    voteCountByMeetup.set(
      mId,
      (voteCountByMeetup.get(mId) ?? 0) + g._count._all,
    );
  }

  const duelGroups =
    roundIds.length > 0
      ? await prisma.vote.groupBy({
          by: ["roundId"],
          where: { roundId: { in: roundIds }, mode: "DUEL" },
          _count: { _all: true },
        })
      : [];
  const duelsStartedByMeetup = new Map<string, boolean>();
  for (const g of duelGroups) {
    const mId = roundToMeetup.get(g.roundId);
    if (!mId) continue;
    if (g._count._all > 0) duelsStartedByMeetup.set(mId, true);
  }

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
  const upcomingMeetup = findUpcomingMeetup(
    meetups.map((m) => ({
      id: m.id,
      title: m.title,
      scheduledAt: m.scheduledAt,
      durationMinutes: m.durationMinutes,
      expectedPlayerCount: m.rounds[0]?.expectedPlayerCount ?? 4,
    })),
    now,
  );

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
        expected={m.rounds[0]?.expectedPlayerCount ?? 4}
        hostName={m.createdBy.name}
        voteCount={voteCountByMeetup.get(m.id) ?? 0}
        roundCount={m.rounds.length}
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
