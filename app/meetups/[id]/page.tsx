import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { ExpectedCountControl } from "@/components/ExpectedCountControl";
import { MeetupDeleteButton } from "@/components/MeetupDeleteButton";
import { MeetupRankings } from "@/components/MeetupRankings";
import {
  buildCombinedByCount,
  buildPicksByCount,
  buildRankingByCount,
  playerCountsFromVotes,
} from "@/lib/vote-aggregation";
import { buildPickCounts, poolGameIds } from "@/lib/pick-pool";

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

  const duelByCount = buildRankingByCount(votes, "DUEL");
  const combinedByCount = buildCombinedByCount(votes);
  const picksByCount = buildPicksByCount(votes);
  const playerCounts = playerCountsFromVotes(
    meetup.expectedPlayerCount,
    votes,
  );

  const pickPoolSize = poolGameIds(
    buildPickCounts(
      votes.filter(
        (v) =>
          v.mode === "PICK" &&
          v.playerCount === meetup.expectedPlayerCount,
      ),
    ),
  ).length;

  return (
    <div className="container-app flex flex-col gap-6">
      <Link href="/" className="text-sm text-[var(--muted)] hover:underline">
        ← alle Treffen
      </Link>

      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold">{meetup.title}</h1>
          <p className="text-[var(--muted)]">
            {formatDate(meetup.scheduledAt)}
            {meetup.location ? ` · ${meetup.location}` : ""} · von{" "}
            {meetup.createdBy.name}
          </p>
        </div>
        {user && (
          <MeetupDeleteButton meetupId={meetup.id} title={meetup.title} />
        )}
      </header>

      <div className="card p-4 flex flex-wrap items-center justify-between gap-4">
        <ExpectedCountControl
          meetupId={meetup.id}
          value={meetup.expectedPlayerCount}
        />
        <div className="flex gap-2 flex-wrap">
          <Link href={`/meetups/${meetup.id}/pick`} className="btn btn-primary">
            Direkt wählen
          </Link>
          <Link
            href={`/meetups/${meetup.id}/duell`}
            className={`btn btn-ghost ${pickPoolSize < 2 ? "opacity-60" : ""}`}
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
        expected={meetup.expectedPlayerCount}
        playerCounts={playerCounts}
        duelByCount={duelByCount}
        combinedByCount={combinedByCount}
        picksByCount={picksByCount}
      />
    </div>
  );
}
