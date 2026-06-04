import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "@/components/LoginForm";

export const dynamic = "force-dynamic";

function formatDate(d: Date | null): string {
  if (!d) return "Termin offen";
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default async function Home() {
  const user = await getCurrentUser();

  const [meetups, gameCount] = await Promise.all([
    prisma.meetup.findMany({
      orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }],
      include: {
        createdBy: { select: { name: true } },
        _count: { select: { votes: true } },
      },
    }),
    prisma.game.count({ where: { isExpansion: false } }),
  ]);

  return (
    <div className="container-app flex flex-col gap-8">
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
          Was spielen wir heute?
        </h1>
        <p className="text-[var(--muted)] max-w-2xl">
          Eure Brettspielsammlung an einem Ort – stimmt gemeinsam ab, welches
          Spiel beim nächsten Treffen auf den Tisch kommt.
        </p>
      </section>

      {!user && (
        <section className="card p-5 max-w-md">
          <h2 className="font-bold mb-3">Anmelden</h2>
          <LoginForm />
        </section>
      )}

      {gameCount === 0 && (
        <section className="card p-5 border-dashed">
          <h2 className="font-bold mb-1">Noch keine Spiele importiert</h2>
          <p className="text-sm text-[var(--muted)] mb-3">
            Lade deine BoardGameGeek-Collection (CSV-Export) hoch, um loszulegen.
          </p>
          <Link href="/admin/import" className="btn btn-primary">
            Zum Import
          </Link>
        </section>
      )}

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-bold">Anstehende Treffen</h2>
          {user && (
            <Link href="/meetups/new" className="btn btn-primary btn-lg sm:w-auto">
              + Neues Treffen
            </Link>
          )}
        </div>

        {meetups.length === 0 ? (
          <p className="text-[var(--muted)]">
            Noch keine Treffen.{" "}
            {user
              ? "Lege das erste an!"
              : "Melde dich an, um ein Treffen zu erstellen."}
          </p>
        ) : (
          <ul className="grid gap-3 grid-cols-1 sm:grid-cols-2">
            {meetups.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/meetups/${m.id}`}
                  className="card p-4 flex flex-col gap-2 hover:shadow-md transition-shadow h-full"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-bold text-lg">{m.title}</span>
                    <span className="chip">{m.expectedPlayerCount} Spieler</span>
                  </div>
                  <span className="text-sm text-[var(--muted)]">
                    {formatDate(m.scheduledAt)}
                    {m.location ? ` · ${m.location}` : ""}
                  </span>
                  <span className="text-xs text-[var(--muted)]">
                    von {m.createdBy.name} · {m._count.votes} Stimmen
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
