import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { DuellClient } from "@/components/DuellClient";
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
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/#login");

  const meetup = await prisma.meetup.findUnique({
    where: { id },
    select: {
      title: true,
      expectedPlayerCount: true,
      duelFrozenData: true,
    },
  });
  if (!meetup) notFound();

  const expected = meetup.expectedPlayerCount;

  const [{ phase, summary }, groupPicks, duelVotes] = await Promise.all([
    loadPickPhaseSummary(id, expected, prisma),
    prisma.vote.findMany({
      where: { meetupId: id, mode: "PICK", playerCount: expected },
      select: { userId: true, gameId: true, points: true },
    }),
    prisma.vote.findMany({
      where: {
        meetupId: id,
        mode: { in: ["DUEL", "TINDER"] },
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
  const frozen = parseDuelFrozenData(meetup.duelFrozenData, expected);
  const ids = frozen?.poolGameIds ?? poolGameIds(pickCounts);

  const myPickSum = groupPicks
    .filter((p) => p.userId === user.id)
    .reduce((s, p) => s + p.points, 0);

  if (phase.poolSize < 2) {
    return (
      <div className="container-app flex flex-col gap-4">
        <PageHeader eyebrow={meetup.title} title="Duell-Modus" />
        <div
          className="card flex flex-col items-center gap-3 text-center"
          style={{ padding: "var(--space-card)" }}
        >
          <p className="text-lg font-bold">Noch zu wenige Stimmen</p>
          <p className="text-[var(--muted)] text-sm">
            Für {expected} Spieler ★ braucht es mindestens zwei nominierte
            Spiele von der Gruppe, bevor Duelle starten können.
          </p>
          <Link href={`/meetups/${id}/pick`} className="btn btn-primary btn-lg">
            Stimmen setzen
          </Link>
        </div>
      </div>
    );
  }

  if (myPickSum <= 0) {
    return (
      <div className="container-app flex flex-col gap-4">
        <PageHeader eyebrow={meetup.title} title="Duell-Modus" />
        <div
          className="card flex flex-col items-center gap-3 text-center"
          style={{ padding: "var(--space-card)" }}
        >
          <p className="text-lg font-bold">Erst Stimmen vergeben</p>
          <p className="text-[var(--muted)] text-sm">
            Du brauchst {MAX_PICK_POINTS}/{MAX_PICK_POINTS} Stimmen bei{" "}
            {expected} Spielern ★, um Duelle zu spielen.
          </p>
          <Link href={`/meetups/${id}/pick`} className="btn btn-primary btn-lg">
            Stimmen setzen
          </Link>
        </div>
      </div>
    );
  }

  if (myPickSum < MAX_PICK_POINTS) {
    return (
      <div className="container-app flex flex-col gap-4">
        <PageHeader eyebrow={meetup.title} title="Duell-Modus" />
        <div
          className="card flex flex-col items-center gap-3 text-center"
          style={{ padding: "var(--space-card)" }}
        >
          <p className="text-lg font-bold">Noch nicht alle Stimmen vergeben</p>
          <p className="text-[var(--muted)] text-sm">
            Du hast {myPickSum}/{MAX_PICK_POINTS} Stimmen bei {expected}{" "}
            Spielern ★. Setze alle {MAX_PICK_POINTS} Stimmen, bevor du
            duellieren kannst.
          </p>
          <p className="text-[var(--muted)] text-sm">
            Gruppe: {summary.fullPickCount}/{summary.expectedPlayerCount}{" "}
            Spieler fertig.
          </p>
          <Link href={`/meetups/${id}/pick`} className="btn btn-primary btn-lg">
            Stimmen setzen
          </Link>
        </div>
      </div>
    );
  }

  if (!phase.readyForDuels) {
    return (
      <div className="container-app flex flex-col gap-4">
        <PageHeader eyebrow={meetup.title} title="Duell-Modus" />
        <div
          className="card flex flex-col items-center gap-3 text-center"
          style={{ padding: "var(--space-card)" }}
        >
          <p className="text-lg font-bold">Warten auf alle Stimmen</p>
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
          <Link href={`/meetups/${id}/pick`} className="btn btn-primary btn-lg">
            Stimmen setzen
          </Link>
        </div>
      </div>
    );
  }

  const plan = buildDuellPlan({
    poolGameIds: ids,
    pickCounts: frozen?.pickCounts ?? pickCounts,
    userPoints: buildUserPointsMap(groupPicks),
    userId: user.id,
    participantIds: duelParticipantIds(groupPicks),
    meetupId: id,
    frozen,
  });

  const games = await prisma.game.findMany({
    where: { id: { in: ids }, isExpansion: false },
    select: {
      id: true,
      name: true,
      thumbnail: true,
      image: true,
      bestPlayerCounts: true,
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
          meetupId: id,
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
    meetupId: id,
    tieBreak,
    frozen,
  });
  const completedKeys = [
    ...completedPairKeysForUser(duelRows, user.id, expected),
  ];

  return (
    <div className="container-app flex flex-col gap-3 sm:gap-4">
      <PageHeader eyebrow={meetup.title} title="Duell-Modus" />

      <DuellClient
        meetupId={id}
        expected={expected}
        games={games}
        myPairs={plan.myPairs}
        phase={plan.phase}
        totalPairs={plan.totalPairs}
        groupDecidedPairs={groupDecidedPairs}
        finishedParticipants={finishedParticipants}
        totalParticipants={totalParticipants}
        initialCompletedKeys={completedKeys}
      />
    </div>
  );
}
