import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { DuellClient } from "@/components/DuellClient";
import { MeetupSubnav } from "@/components/MeetupSubnav";
import { PageHeader } from "@/components/PageHeader";
import { buildPickCounts, poolGameIds } from "@/lib/pick-pool";

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

  const [groupPicks, myDuelVotes] = await Promise.all([
    prisma.vote.findMany({
      where: { meetupId: id, mode: "PICK", playerCount: expected },
      select: { gameId: true },
    }),
    prisma.vote.findMany({
      where: {
        meetupId: id,
        userId: user.id,
        mode: { in: ["DUEL", "TINDER"] },
        playerCount: expected,
      },
      select: { gameId: true, playerCount: true },
    }),
  ]);

  const pickCounts = buildPickCounts(groupPicks);
  const ids = poolGameIds(pickCounts);

  if (ids.length < 2) {
    return (
      <div className="container-app flex flex-col gap-4">
        <PageHeader eyebrow={meetup.title} title="Duell-Modus">
          <MeetupSubnav meetupId={id} active="duell" pickPoolSize={ids.length} />
        </PageHeader>
        <div className="card flex flex-col items-center gap-3 text-center" style={{ padding: "var(--space-card)" }}>
          <p className="text-lg font-bold">Noch zu wenige Direkt-Picks</p>
          <p className="text-[var(--muted)] text-sm">
            Für {expected} Spieler ★ braucht es mindestens zwei verschiedene
            gepickte Spiele von der Gruppe, bevor Duelle starten können.
          </p>
          <Link href={`/meetups/${id}/pick`} className="btn btn-primary btn-lg">
            Direkt-Picks setzen
          </Link>
        </div>
      </div>
    );
  }

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

  return (
    <div className="container-app flex flex-col gap-4">
      <PageHeader eyebrow={meetup.title} title="Duell-Modus">
        <MeetupSubnav meetupId={id} active="duell" pickPoolSize={ids.length} />
      </PageHeader>

      <DuellClient
        meetupId={id}
        expected={expected}
        games={games}
        pickCounts={pickCounts}
        initialDuelWins={myDuelVotes}
      />
    </div>
  );
}
