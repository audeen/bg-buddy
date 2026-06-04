import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { GameCover } from "@/components/GameCover";
import { playerRange, playtime, weightLabel } from "@/lib/format";
import { bggBoardgameUrl } from "@/lib/bgg-url";

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

  const time = playtime(game.minPlaytime, game.maxPlaytime, game.playingTime);
  const weight = weightLabel(game.weight);

  return (
    <div className="container-app flex flex-col gap-6">
      <Link href="/games" className="text-sm text-[var(--muted)] hover:underline">
        ← zurück zur Sammlung
      </Link>

      <div className="grid gap-6 md:grid-cols-[260px_1fr]">
        <GameCover
          src={game.image ?? game.thumbnail}
          alt={game.name}
          className="w-full rounded-xl border border-[var(--border)] aspect-square md:aspect-auto"
        />

        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-3xl font-extrabold">{game.name}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
              {game.year ? (
                <p className="text-[var(--muted)]">{game.year}</p>
              ) : null}
              <a
                href={bggBoardgameUrl(game.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[var(--accent)] hover:underline"
              >
                Auf BoardGameGeek ansehen ↗
              </a>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="chip">{playerRange(game.minPlayers, game.maxPlayers)}</span>
            {time && <span className="chip">{time}</span>}
            {weight && <span className="chip">{weight}</span>}
            {game.bggRating ? (
              <span className="chip">★ {game.bggRating.toFixed(1)}</span>
            ) : null}
            {game.ageRange && <span className="chip">ab {game.ageRange}</span>}
            {game.isExpansion && <span className="chip">Erweiterung</span>}
          </div>

          {game.bestPlayerCounts.length > 0 && (
            <p className="text-sm">
              <span className="font-semibold">Beste Spieleranzahl: </span>
              {game.bestPlayerCounts.join(", ")}
              {game.recommendedPlayerCounts.length > 0 && (
                <span className="text-[var(--muted)]">
                  {" "}
                  (empfohlen: {game.recommendedPlayerCounts.join(", ")})
                </span>
              )}
            </p>
          )}

          {game.categories.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {game.categories.map((c) => (
                <span key={c} className="chip">
                  {c}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {game.description ? (
        <section className="card p-5 whitespace-pre-line leading-relaxed">
          {game.description}
        </section>
      ) : (
        <p className="text-[var(--muted)] text-sm">
          Noch keine Beschreibung geladen. Starte das Anreichern im{" "}
          <Link href="/admin/import" className="underline">
            Import
          </Link>
          .
        </p>
      )}

      {game.mechanics.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-bold">Mechaniken</h2>
          <div className="flex flex-wrap gap-1.5">
            {game.mechanics.map((m) => (
              <span key={m} className="chip">
                {m}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
