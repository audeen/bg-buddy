import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { DuellClient } from "@/components/DuellClient";
import { DuellGateCard } from "@/components/DuellGateCard";
import { DuellSessionGuard } from "@/components/DuellSessionGuard";
import { RoundSwitcher } from "@/components/RoundSwitcher";
import { isMeetupRegistered, resolveRound } from "@/lib/round-resolve";
import { PageHeader } from "@/components/PageHeader";
import { buildPickCounts, poolGameIds } from "@/lib/pick-pool";
import {
  buildDuellPlan,
  buildUserPointsMap,
  duelParticipantIds,
  getDuelProgressForCount,
  parseDuelFrozenData,
} from "@/lib/duel-pairs";
import { buildGameTieMetaMap } from "@/lib/duel-tiebreaker";
import { completedPairKeysForUser } from "@/lib/copeland";
import { loadPickPhaseSummary } from "@/lib/pick-phase";
import { MAX_PICK_POINTS } from "@/lib/vote-limits";

export const dynamic = "force-dynamic";

export default async function DuellPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const roundParam = typeof sp.runde === "string" ? sp.runde : undefined;
  const user = await getCurrentUser();
  if (!user) redirect("/#login");

  const resolved = await resolveRound(id, roundParam);
  if (!resolved) notFound();
  const { rounds, activeRoundId, multiRound } = resolved;
  const roundQuery = multiRound ? `?runde=${activeRoundId}` : "";

  const meetup = await prisma.meetup.findUnique({
    where: { id },
    select: { title: true, createdBy: { select: { id: true } } },
  });
  const round = await prisma.meetupRound.findUnique({
    where: { id: activeRoundId },
    select: {
      expectedPlayerCount: true,
      duelFrozenData: true,
      hostForcedGameId: true,
    },
  });
  if (!meetup || !round) notFound();

  if (round.hostForcedGameId != null) {
    redirect(`/meetups/${id}${roundQuery}`);
  }

  const isHost = user.id === meetup.createdBy.id;
  const expected = round.expectedPlayerCount;

  // Nicht am Treffen angemeldet: Hinweis statt Duell-UI.
  if (!(await isMeetupRegistered(id, user.id))) {
    return (
      <div className="container-app flex flex-col gap-4">
        <PageHeader eyebrow={meetup.title} title="Duell-Modus" />
        {multiRound && (
          <RoundSwitcher
            meetupId={id}
            segment="duell"
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

  const [{ phase, summary }, groupPicks, duelVotes] = await Promise.all([
    loadPickPhaseSummary(activeRoundId, expected, prisma),
    prisma.vote.findMany({
      where: { roundId: activeRoundId, mode: "PICK", playerCount: expected },
      select: { userId: true, gameId: true, points: true },
    }),
    prisma.vote.findMany({
      where: {
        roundId: activeRoundId,
        mode: "DUEL",
        playerCount: expected,
      },
      select: {
        userId: true,
        gameId: true,
        opponentGameId: true,
        playerCount: true,
      },
    }),
  ]);

  const pickCounts = buildPickCounts(groupPicks);
  const frozen = parseDuelFrozenData(round.duelFrozenData, expected);
  const ids = frozen?.poolGameIds ?? poolGameIds(pickCounts);
  const initialDuelVoteCount = duelVotes.length;

  function withSessionGuard(content: React.ReactNode) {
    return (
      <DuellSessionGuard
        meetupId={id}
        roundId={multiRound ? activeRoundId : undefined}
        initialDuelVoteCount={initialDuelVoteCount}
      >
        {content}
      </DuellSessionGuard>
    );
  }

  const myPickSum = groupPicks
    .filter((p) => p.userId === user.id)
    .reduce((s, p) => s + p.points, 0);

  if (phase.poolSize < 2) {
    return withSessionGuard(
      <div className="container-app flex flex-col gap-4">
        <PageHeader eyebrow={meetup.title} title="Duell-Modus" />
        <DuellGateCard title="Noch zu wenige Stimmen" ctaHref={`/meetups/${id}/pick${roundQuery}`}>
          <p className="text-[var(--muted)] text-sm">
            Für {expected} Spieler ★ braucht es mindestens zwei nominierte
            Spiele von der Gruppe, bevor Duelle starten können.
          </p>
        </DuellGateCard>
      </div>,
    );
  }

  if (myPickSum <= 0) {
    return withSessionGuard(
      <div className="container-app flex flex-col gap-4">
        <PageHeader eyebrow={meetup.title} title="Duell-Modus" />
        <DuellGateCard title="Erst Stimmen vergeben" ctaHref={`/meetups/${id}/pick${roundQuery}`}>
          <p className="text-[var(--muted)] text-sm">
            Du brauchst {MAX_PICK_POINTS}/{MAX_PICK_POINTS} Stimmen bei{" "}
            {expected} Spielern ★, um Duelle zu spielen.
          </p>
        </DuellGateCard>
      </div>,
    );
  }

  if (myPickSum < MAX_PICK_POINTS) {
    return withSessionGuard(
      <div className="container-app flex flex-col gap-4">
        <PageHeader eyebrow={meetup.title} title="Duell-Modus" />
        <DuellGateCard
          title="Noch nicht alle Stimmen vergeben"
          ctaHref={`/meetups/${id}/pick${roundQuery}`}
        >
          <p className="text-[var(--muted)] text-sm">
            Du hast {myPickSum}/{MAX_PICK_POINTS} Stimmen bei {expected}{" "}
            Spielern ★. Setze alle {MAX_PICK_POINTS} Stimmen, bevor du
            duellieren kannst.
          </p>
          <p className="text-[var(--muted)] text-sm">
            Gruppe: {summary.fullPickCount}/{summary.expectedPlayerCount}{" "}
            Spieler fertig.
          </p>
        </DuellGateCard>
      </div>,
    );
  }

  if (!phase.readyForDuels) {
    return withSessionGuard(
      <div className="container-app flex flex-col gap-4">
        <PageHeader eyebrow={meetup.title} title="Duell-Modus" />
        <DuellGateCard title="Warten auf alle Stimmen" ctaHref={`/meetups/${id}/pick${roundQuery}`}>
          <p className="text-[var(--muted)] text-sm">
            Duell-Modus startet, wenn {expected} Spieler je {MAX_PICK_POINTS}/
            {MAX_PICK_POINTS} Stimmen bei ★ gesetzt haben.
          </p>
          <p className="text-sm font-semibold tabular-nums">
            {summary.fullPickCount}/{summary.expectedPlayerCount} Spieler fertig
          </p>
          {summary.partialPickerNames.length > 0 && (
            <p className="text-[var(--muted)] text-sm">
              Unvollständig: {summary.partialPickerNames.join(", ")}
            </p>
          )}
          {summary.missingCount > 0 && summary.partialPickerNames.length === 0 && (
            <p className="text-[var(--muted)] text-sm">
              Es fehlen noch {summary.missingCount} Spieler mit{" "}
              {MAX_PICK_POINTS}/{MAX_PICK_POINTS} Stimmen.
            </p>
          )}
        </DuellGateCard>
      </div>,
    );
  }

  const plan = buildDuellPlan({
    poolGameIds: ids,
    pickCounts: frozen?.pickCounts ?? pickCounts,
    userPoints: buildUserPointsMap(groupPicks),
    userId: user.id,
    participantIds: duelParticipantIds(groupPicks),
    meetupId: activeRoundId,
    frozen,
  });

  const games = await prisma.game.findMany({
    where: { id: { in: ids }, isExpansion: false },
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
      ageRange: true,
      isExpansion: true,
      categories: true,
      mechanics: true,
      bestPlayerCounts: true,
      recommendedPlayerCounts: true,
      rank: true,
      bggRating: true,
    },
    orderBy: { name: "asc" },
  });

  const duelRows = duelVotes.map((v) => ({
    gameId: v.gameId,
    opponentGameId: v.opponentGameId,
    userId: v.userId,
    playerCount: v.playerCount,
  }));

  const tieBreak =
    ids.length >= 2
      ? {
          meetupId: activeRoundId,
          expectedPlayerCount: expected,
          pickCounts,
          games: buildGameTieMetaMap(games),
        }
      : undefined;

  const {
    decidedPairs: groupDecidedPairs,
    finishedParticipants,
    totalParticipants,
  } = getDuelProgressForCount(ids, duelRows, expected, {
    picks: groupPicks,
    meetupId: activeRoundId,
    tieBreak,
    frozen,
  });
  const completedKeys = [
    ...completedPairKeysForUser(duelRows, user.id, expected),
  ];

  return withSessionGuard(
    <div className="container-app flex flex-col gap-3 sm:gap-4">
      <PageHeader eyebrow={meetup.title} title="Duell-Modus" />

      <RoundSwitcher
        meetupId={id}
        segment="duell"
        rounds={rounds}
        activeRoundId={activeRoundId}
      />

      <DuellClient
        meetupId={id}
        roundId={activeRoundId}
        roundQuery={roundQuery}
        expected={expected}
        games={games}
        myPairs={plan.myPairs}
        phase={plan.phase}
        totalPairs={plan.totalPairs}
        groupDecidedPairs={groupDecidedPairs}
        finishedParticipants={finishedParticipants}
        totalParticipants={totalParticipants}
        initialCompletedKeys={completedKeys}
        isHost={isHost}
      />
    </div>,
  );
}
