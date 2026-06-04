import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { ImportClient } from "@/components/ImportClient";
import { LoginForm } from "@/components/LoginForm";
import { enrichmentCacheEntryCount } from "@/lib/enrichment-cache";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="container-app max-w-md flex flex-col gap-4">
        <h1 className="text-2xl font-extrabold">Import</h1>
        <p className="text-[var(--muted)]">
          Bitte melde dich an, um Spiele zu importieren.
        </p>
        <div className="card p-5">
          <LoginForm />
        </div>
      </div>
    );
  }

  const [total, enriched, expansions] = await Promise.all([
    prisma.game.count(),
    prisma.game.count({ where: { enriched: true } }),
    prisma.game.count({ where: { isExpansion: true } }),
  ]);

  return (
    <div className="container-app max-w-2xl flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold">Sammlung importieren</h1>
        <p className="text-[var(--muted)] text-sm">
          Aktuell {total} Spiele in der Datenbank ({expansions} Erweiterungen),
          davon {enriched} mit Cover &amp; Details.
        </p>
      </div>

      <ImportClient
        total={total}
        enriched={enriched}
        cacheEntries={enrichmentCacheEntryCount()}
      />

      {total > 0 && (
        <div className="flex flex-wrap gap-3">
          <Link href="/games" className="btn btn-ghost w-fit">
            Zur Spielesammlung →
          </Link>
          <Link href="/admin/collection" className="btn btn-ghost w-fit">
            Sammlung bearbeiten →
          </Link>
        </div>
      )}
    </div>
  );
}
