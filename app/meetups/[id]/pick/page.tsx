import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { PickClient } from "@/components/PickClient";
import { PageHeader } from "@/components/PageHeader";

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
      <PageHeader
        id="pick-page-top"
        eyebrow={meetup.title}
        title="Direkt wählen"
      />

      <PickClient
        meetupId={id}
        expected={meetup.expectedPlayerCount}
        games={games}
        initialPicks={myVotes}
        scrollTargetId="pick-page-top"
      />
    </div>
  );
}
