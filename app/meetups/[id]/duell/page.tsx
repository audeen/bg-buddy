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
  participantIdsFromPicks,
} from "@/lib/duel-pairs";
import { completedPairKeysForUser } from "@/lib/copeland";
import { getDuelProgressForCount } from "@/lib/duel-pairs";

export const dynamic = "force-dynamic";

export default async function DuellPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/#login");

  const meetup = await prisma.meetup.findUnique({ where: { id } });
  if (!meetup) notFound();

  const expected = meetup.expectedPlayerCount;

  const [groupPicks, duelVotes] = await Promise.all([
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
  const ids = poolGameIds(pickCounts);

  const myPickSum = groupPicks
    .filter((p) => p.userId === user.id)
    .reduce((s, p) => s + p.points, 0);

  if (ids.length < 2) {
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
            Du brauchst mindestens 1 Stimme bei {expected} Spielern ★, um
            Duelle zu spielen.
          </p>
          <Link href={`/meetups/${id}/pick`} className="btn btn-primary btn-lg">
            Stimmen setzen
          </Link>
        </div>
      </div>
    );
  }

  const plan = buildDuellPlan({
    poolGameIds: ids,
    pickCounts,
    userPoints: buildUserPointsMap(groupPicks),
    userId: user.id,
    participantIds: participantIdsFromPicks(groupPicks),
    meetupId: id,
  });

  const games = await prisma.game.findMany({
    where: { id: { in: ids }, isExpansion: false },
    select: {
      id: true,
      name: true,
      thumbnail: true,
      image: true,
    },
    orderBy: { name: "asc" },
  });

  const duelRows = duelVotes.map((v) => ({
    gameId: v.gameId,
    opponentGameId: v.opponentGameId,
    userId: v.userId,
    playerCount: v.playerCount,
  }));

  const { decidedPairs: groupDecidedPairs } = getDuelProgressForCount(
    ids,
    duelRows,
    expected,
  );
  const completedKeys = [
    ...completedPairKeysForUser(duelRows, user.id, expected),
  ];

  return (
    <div className="container-app flex flex-col gap-4">
      <PageHeader eyebrow={meetup.title} title="Duell-Modus" />

      <DuellClient
        meetupId={id}
        expected={expected}
        games={games}
        pickCounts={pickCounts}
        myPairs={plan.myPairs}
        phase={plan.phase}
        totalPairs={plan.totalPairs}
        groupDecidedPairs={groupDecidedPairs}
        initialCompletedKeys={completedKeys}
      />
    </div>
  );
}
