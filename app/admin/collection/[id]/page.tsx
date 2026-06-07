import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "@/components/LoginForm";
import { GameEditClient } from "@/components/GameEditClient";

export const dynamic = "force-dynamic";

export default async function GameEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  const { id: idRaw } = await params;
  const id = parseInt(idRaw, 10);

  if (!user) {
    return (
      <div className="container-app max-w-md flex flex-col gap-4">
        <h1 className="page-title">Spiel bearbeiten</h1>
        <p className="text-[var(--muted)]">
          Bitte melde dich an, um Spiele zu bearbeiten.
        </p>
        <div className="card" style={{ padding: "var(--space-card)" }}>
          <LoginForm />
        </div>
      </div>
    );
  }

  if (!Number.isFinite(id)) notFound();

  const [game, baseGames] = await Promise.all([
    prisma.game.findUnique({ where: { id } }),
    prisma.game.findMany({
      where: { isExpansion: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!game) notFound();

  return (
    <div className="container-app max-w-2xl flex flex-col gap-6">
      <div>
        <h1 className="page-title">Spiel bearbeiten</h1>
        <p className="text-[var(--muted)] text-sm">
          BGG #{game.id}
          {game.manuallyEditedFields.length > 0 &&
            ` · ${game.manuallyEditedFields.length} manuell bearbeitete Felder`}
        </p>
      </div>

      <p className="text-sm text-[var(--muted)]">
        Gespeicherte Änderungen werden beim CSV-Import und Offline-Cache als
        Konflikt erkannt — du kannst sie dann behalten oder überschreiben.
      </p>

      <GameEditClient game={game} baseGames={baseGames} />

      <Link href="/admin/collection" className="btn btn-ghost w-fit">
        ← Zur Sammlung
      </Link>
    </div>
  );
}
