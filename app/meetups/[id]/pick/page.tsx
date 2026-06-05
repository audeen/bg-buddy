import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { PickClient } from "@/components/PickClient";
import { MeetupSubnav } from "@/components/MeetupSubnav";

export const dynamic = "force-dynamic";

export default async function PickPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/#login");

  const meetup = await prisma.meetup.findUnique({ where: { id } });
  if (!meetup) notFound();

  const [games, myVotes] = await Promise.all([
    prisma.game.findMany({
      where: { isExpansion: false },
      select: {
        id: true,
        name: true,
        year: true,
        description: true,
        thumbnail: true,
        image: true,
        minPlayers: true,
        maxPlayers: true,
        minPlaytime: true,
        maxPlaytime: true,
        playingTime: true,
        weight: true,
        bggRating: true,
        ageRange: true,
        isExpansion: true,
        categories: true,
        mechanics: true,
        bestPlayerCounts: true,
        recommendedPlayerCounts: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.vote.findMany({
      where: { meetupId: id, userId: user.id, mode: "PICK" },
      select: { gameId: true, playerCount: true },
    }),
  ]);

  return (
    <div className="container-app flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link
          href={`/meetups/${id}`}
          className="text-sm text-[var(--muted)] hover:underline"
        >
          ← {meetup.title}
        </Link>
        <h1 className="page-title">Direkt wählen</h1>
        <MeetupSubnav meetupId={id} active="pick" />
      </div>

      <PickClient
        meetupId={id}
        expected={meetup.expectedPlayerCount}
        games={games}
        initialPicks={myVotes}
      />
    </div>
  );
}
