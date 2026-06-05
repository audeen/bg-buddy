import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { ExpectedCountControl } from "@/components/ExpectedCountControl";
import { MeetupDeleteButton } from "@/components/MeetupDeleteButton";
import { MeetupRankings } from "@/components/MeetupRankings";
import { MeetupSubnav } from "@/components/MeetupSubnav";
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

      <header className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="page-title">{meetup.title}</h1>
            <p className="text-sm text-[var(--muted)] mt-1">
              {formatDate(meetup.scheduledAt)}
              {meetup.location ? ` · ${meetup.location}` : ""} · von{" "}
              {meetup.createdBy.name}
            </p>
          </div>
          {user && (
            <MeetupDeleteButton meetupId={meetup.id} title={meetup.title} />
          )}
        </div>
        <MeetupSubnav
          meetupId={meetup.id}
          active="detail"
          pickPoolSize={pickPoolSize}
        />
      </header>

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
            Direkt wählen
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
        expected={meetup.expectedPlayerCount}
        playerCounts={playerCounts}
        duelByCount={duelByCount}
        combinedByCount={combinedByCount}
        picksByCount={picksByCount}
      />
    </div>
  );
}
