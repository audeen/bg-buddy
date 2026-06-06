import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { ExpectedCountControl } from "@/components/ExpectedCountControl";
import { MeetupActionsMenu } from "@/components/MeetupActionsMenu";
import { MeetupRankings } from "@/components/MeetupRankings";
import { PageHeader } from "@/components/PageHeader";
import {
  buildCombinedByCount,
  playerCountsFromVotes,
} from "@/lib/vote-aggregation";
import { buildPickCounts, poolGameIds } from "@/lib/pick-pool";
import { getDuelProgressForCount } from "@/lib/duel-pairs";

export const dynamic = "force-dynamic";

function formatDate(d: Date | null): string {
  if (!d) return "Termin offen";
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default async function MeetupDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();

  const meetup = await prisma.meetup.findUnique({
    where: { id },
    include: { createdBy: { select: { name: true } } },
  });
  if (!meetup) notFound();

  const votes = await prisma.vote.findMany({
    where: { meetupId: id },
    include: {
      game: { select: { id: true, name: true, thumbnail: true, image: true } },
      user: { select: { name: true } },
    },
  });

  const combinedByCount = buildCombinedByCount(votes);
  const playerCounts = playerCountsFromVotes(
    meetup.expectedPlayerCount,
    votes,
  );

  const expected = meetup.expectedPlayerCount;
  const groupPicks = votes.filter(
    (v) => v.mode === "PICK" && v.playerCount === expected,
  );
  const pickCounts = buildPickCounts(groupPicks);
  const poolIds = poolGameIds(pickCounts);
  const pickPoolSize = poolIds.length;

  const duelRows = votes
    .filter(
      (v) =>
        (v.mode === "DUEL" || v.mode === "TINDER") &&
        v.playerCount === expected,
    )
    .map((v) => ({
      gameId: v.gameId,
      opponentGameId: v.opponentGameId,
      userId: v.userId,
      playerCount: v.playerCount,
    }));

  const {
    totalPairs,
    decidedPairs: groupDecidedPairs,
    duelComplete,
  } = getDuelProgressForCount(poolIds, duelRows, expected);

  return (
    <div className="container-app flex flex-col gap-6">
      <PageHeader id="meetup-page-top" eyebrow="Treffen" title={meetup.title}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <p className="text-sm text-[var(--muted)]">
            {formatDate(meetup.scheduledAt)}
            {meetup.location ? ` · ${meetup.location}` : ""} · von{" "}
            {meetup.createdBy.name}
          </p>
          {user && (
            <MeetupActionsMenu meetupId={meetup.id} title={meetup.title} />
          )}
        </div>
      </PageHeader>

      <div className="card flex flex-col gap-4" style={{ padding: "var(--space-card)" }}>
        <ExpectedCountControl
          meetupId={meetup.id}
          value={meetup.expectedPlayerCount}
        />
        <div className="flex flex-col sm:flex-row gap-2">
          <Link
            href={`/meetups/${meetup.id}/pick`}
            className="btn btn-primary btn-lg sm:flex-1"
          >
            Stimmen vergeben
          </Link>
          <Link
            href={`/meetups/${meetup.id}/duell`}
            className={`btn btn-ghost btn-lg sm:flex-1 ${pickPoolSize < 2 ? "opacity-60" : ""}`}
            title={
              pickPoolSize < 2
                ? "Mindestens zwei gepickte Spiele nötig"
                : undefined
            }
          >
            Duell-Modus
            {pickPoolSize >= 2 ? ` (${pickPoolSize})` : ""}
          </Link>
        </div>
      </div>

      <MeetupRankings
        expected={expected}
        playerCounts={playerCounts}
        combinedByCount={combinedByCount}
        duelComplete={duelComplete}
        groupDecidedPairs={groupDecidedPairs}
        totalPairs={totalPairs}
      />
    </div>
  );
}
