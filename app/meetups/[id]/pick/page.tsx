import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { PickClient } from "@/components/PickClient";

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
        thumbnail: true,
        image: true,
        minPlayers: true,
        maxPlayers: true,
        bestPlayerCounts: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.vote.findMany({
      where: { meetupId: id, userId: user.id, mode: "PICK" },
      select: { gameId: true, playerCount: true },
    }),
  ]);

  return (
    <div className="container-app flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <Link
            href={`/meetups/${id}`}
            className="text-sm text-[var(--muted)] hover:underline"
          >
            ← {meetup.title}
          </Link>
          <h1 className="text-2xl font-extrabold">Direkt wählen</h1>
        </div>
        <Link href={`/meetups/${id}/duell`} className="btn btn-ghost">
          Zum Duell-Modus →
        </Link>
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
