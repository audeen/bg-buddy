import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { ExpectedCountControl } from "@/components/ExpectedCountControl";
import { MeetupDeleteButton } from "@/components/MeetupDeleteButton";
import { Ranking, type RankEntry } from "@/components/Ranking";

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
    },
  });

  // Aggregate points per (playerCount -> gameId)
  const byCount = new Map<
    number,
    Map<number, { entry: RankEntry; voters: Set<string> }>
  >();

  for (const v of votes) {
    if (!byCount.has(v.playerCount)) byCount.set(v.playerCount, new Map());
    const games = byCount.get(v.playerCount)!;
    if (!games.has(v.gameId)) {
      games.set(v.gameId, {
        entry: {
          id: v.game.id,
          name: v.game.name,
          thumbnail: v.game.thumbnail ?? v.game.image,
          points: 0,
          voters: 0,
        },
        voters: new Set(),
      });
    }
    const g = games.get(v.gameId)!;
    g.entry.points += v.points;
    g.voters.add(v.userId);
  }

  const rankingByCount: Record<number, RankEntry[]> = {};
  for (const [pc, games] of byCount) {
    rankingByCount[pc] = Array.from(games.values())
      .map(({ entry, voters }) => ({ ...entry, voters: voters.size }))
      .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  }

  const playerCounts = Array.from(
    new Set([meetup.expectedPlayerCount, ...byCount.keys()]),
  ).sort((a, b) => a - b);

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
        <div className="flex gap-2">
          <Link href={`/meetups/${meetup.id}/pick`} className="btn btn-primary">
            Direkt wählen
          </Link>
          <Link href={`/meetups/${meetup.id}/tinder`} className="btn btn-ghost">
            Tinder-Modus
          </Link>
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold">Ranking</h2>
        <Ranking
          expected={meetup.expectedPlayerCount}
          playerCounts={playerCounts}
          rankingByCount={rankingByCount}
        />
      </section>
    </div>
  );
}
