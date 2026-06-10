import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "@/components/LoginForm";
import { MeetupOverviewCard } from "@/components/MeetupOverviewCard";
import {
  GameOfTheDayCard,
  GameOfTheDayEmpty,
} from "@/components/GameOfTheDayCard";
import type { GameCardGame } from "@/lib/types/game";
import {
  berlinDateKey,
  findUpcomingMeetup,
  resolveGameOfTheDay,
  type GameOfTheDayCandidate,
} from "@/lib/game-of-the-day";
import {
  gameCardSelect,
  loadOwnedExpansionsByBaseGame,
} from "@/lib/owned-expansions";
import {
  buildRegisteredPlayers,
  groupPickVotersByMeetup,
} from "@/lib/meetup-participants";

export const dynamic = "force-dynamic";

function NewMeetupIconButton() {
  return (
    <Link
      href="/meetups/new"
      className="btn btn-primary shrink-0"
      style={{ width: "2.75rem", height: "2.75rem", padding: 0 }}
      aria-label="Neues Treffen"
      title="Neues Treffen"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M12 5v14M5 12h14" />
      </svg>
    </Link>
  );
}

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

  const nextMeetup = meetups[0] ?? null;
  const otherMeetups = meetups.slice(1);
  const upcomingMeetup = findUpcomingMeetup(meetups);

  let gotdGame: GameOfTheDayCandidate | null = null;
  let gotdPlayerCount: number | null = null;
  let gotdExpansions: GameCardGame[] = [];

  if (gameCount > 0) {
    const [games, expansionsByBase] = await Promise.all([
      prisma.game.findMany({
        where: { isExpansion: false, listedInCollection: true },
        select: { ...gameCardSelect, lentOut: true },
      }),
      loadOwnedExpansionsByBaseGame(),
    ]);
    const gotd = resolveGameOfTheDay(
      games,
      expansionsByBase,
      upcomingMeetup,
      berlinDateKey(new Date()),
    );
    gotdGame = gotd.game;
    gotdPlayerCount = gotd.playerCount;
    gotdExpansions =
      gotdGame != null ? (expansionsByBase.get(gotdGame.id) ?? []) : [];
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
      <section className="sm:max-w-[calc(50%-0.375rem)]">
        {gotdGame ? (
          <GameOfTheDayCard
            game={gotdGame}
            playerCount={gotdPlayerCount ?? undefined}
            ownedExpansions={gotdExpansions}
          />
        ) : (
          <GameOfTheDayEmpty />
        )}
      </section>
    ) : null;

  const importBanner =
    gameCount === 0 ? (
      <section className="card border-dashed" style={{ padding: "var(--space-card)" }}>
        <h2 className="font-bold mb-1">Noch keine Spiele importiert</h2>
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
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="section-title">Nächstes Treffen</h2>
              <NewMeetupIconButton />
            </div>
            {nextMeetup ? (
              <div className="sm:max-w-[calc(50%-0.375rem)]">
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
        </>
      ) : (
        <>
          <section className="flex flex-col gap-2">
            <h1 className="page-title">Was kommt heute auf den Tisch?</h1>
            <p className="text-[var(--muted)] max-w-2xl">
              Gib deine Stimmen ab und lass deine Spiele gegen die Picks der
              anderen antreten. Finde heraus, über welche Regeln wir heute
              diskutieren!
            </p>
          </section>

          <section className="card max-w-md" style={{ padding: "var(--space-card)" }}>
            <h2 className="section-title mb-3">Anmelden</h2>
            <LoginForm />
          </section>

          {importBanner}
        </>
      )}
    </div>
  );
}
