import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { GameDetailView } from "@/components/GameDetailView";

export const dynamic = "force-dynamic";

export default async function GameDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const gameId = parseInt(id, 10);
  if (!Number.isFinite(gameId)) notFound();

  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game) notFound();

  return (
    <div className="container-app flex flex-col gap-6">
      <Link href="/games" className="text-sm text-[var(--muted)] hover:underline">
        ← zurück zur Sammlung
      </Link>

      <GameDetailView game={game} />
    </div>
  );
}
