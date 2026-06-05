import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "@/components/LoginForm";
import { CollectionManagerClient } from "@/components/CollectionManagerClient";

export const dynamic = "force-dynamic";

export default async function CollectionAdminPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="container-app max-w-md flex flex-col gap-4">
        <h1 className="page-title">Sammlung bearbeiten</h1>
        <p className="text-[var(--muted)]">
          Bitte melde dich an, um Spiele zu verwalten.
        </p>
        <div className="card" style={{ padding: "var(--space-card)" }}>
          <LoginForm />
        </div>
      </div>
    );
  }

  const games = await prisma.game.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, year: true, isExpansion: true },
  });

  return (
    <div className="container-app max-w-2xl flex flex-col gap-6">
      <div>
        <h1 className="page-title">Sammlung bearbeiten</h1>
        <p className="text-[var(--muted)] text-sm">
          {games.length} {games.length === 1 ? "Spiel" : "Spiele"} in der Datenbank
        </p>
      </div>

      <CollectionManagerClient games={games} />

      <div className="flex flex-wrap gap-3">
        <Link href="/games" className="btn btn-ghost w-fit">
          Zur Spielesammlung →
        </Link>
        <Link href="/admin/import" className="btn btn-ghost w-fit">
          Import →
        </Link>
      </div>
    </div>
  );
}
