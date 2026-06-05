import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { GameDetailView } from "@/components/GameDetailView";
import { PageHeader } from "@/components/PageHeader";

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
      <PageHeader eyebrow="Spielesammlung" />

      <GameDetailView game={game} />
    </div>
  );
}
