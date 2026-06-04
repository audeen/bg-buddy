import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { GameCover } from "@/components/GameCover";
import { playerRange, playtime } from "@/lib/format";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  q?: string;
  players?: string;
  genre?: string;
  exp?: string;
}>;

export default async function GamesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const players = sp.players ? parseInt(sp.players, 10) : null;
  const genre = (sp.genre ?? "").trim();
  const includeExpansions = sp.exp === "1";

  const where: Prisma.GameWhereInput = {};
  if (!includeExpansions) where.isExpansion = false;
  if (q) where.name = { contains: q, mode: "insensitive" };
  if (genre) where.categories = { has: genre };
  if (players && Number.isFinite(players)) {
    where.AND = [
      { minPlayers: { lte: players } },
      { maxPlayers: { gte: players } },
    ];
  }

  const [games, allForGenres] = await Promise.all([
    prisma.game.findMany({ where, orderBy: { name: "asc" } }),
    prisma.game.findMany({ select: { categories: true } }),
  ]);

  const genres = Array.from(
    new Set(allForGenres.flatMap((g) => g.categories)),
  ).sort((a, b) => a.localeCompare(b));

  return (
    <div className="container-app flex flex-col gap-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-extrabold">Spielesammlung</h1>
        <span className="text-sm text-[var(--muted)]">
          {games.length} {games.length === 1 ? "Spiel" : "Spiele"}
        </span>
      </div>

      <form className="card p-4 grid gap-3 sm:grid-cols-4 items-end">
        <div className="sm:col-span-2">
          <label className="text-xs font-semibold text-[var(--muted)]">
            Suche
          </label>
          <input
            name="q"
            defaultValue={q}
            className="input mt-1"
            placeholder="Spielname…"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-[var(--muted)]">
            Spieleranzahl
          </label>
          <select name="players" defaultValue={sp.players ?? ""} className="input mt-1">
            <option value="">egal</option>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <option key={n} value={n}>
                {n} Spieler
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-[var(--muted)]">
            Genre
          </label>
          <select name="genre" defaultValue={genre} className="input mt-1">
            <option value="">alle</option>
            {genres.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm sm:col-span-3">
          <input
            type="checkbox"
            name="exp"
            value="1"
            defaultChecked={includeExpansions}
          />
          Erweiterungen anzeigen
        </label>
        <button type="submit" className="btn btn-primary btn-lg sm:col-span-1 sm:w-auto">
          Filtern
        </button>
      </form>

      {games.length === 0 ? (
        <p className="text-[var(--muted)]">
          Keine Spiele gefunden. Passe die Filter an oder importiere zuerst deine
          Sammlung.
        </p>
      ) : (
        <ul className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {games.map((g) => {
            const time = playtime(g.minPlaytime, g.maxPlaytime, g.playingTime);
            return (
              <li key={g.id}>
                <Link
                  href={`/games/${g.id}`}
                  className="card overflow-hidden flex flex-col h-full hover:shadow-md transition-shadow"
                >
                  <GameCover
                    src={g.thumbnail ?? g.image}
                    alt={g.name}
                    className="w-full aspect-square"
                  />
                  <div className="p-3 flex flex-col gap-1">
                    <span className="font-semibold leading-tight line-clamp-2">
                      {g.name}
                    </span>
                    <span className="text-xs text-[var(--muted)]">
                      {playerRange(g.minPlayers, g.maxPlayers)}
                      {time ? ` · ${time}` : ""}
                    </span>
                    {g.isExpansion && (
                      <span className="chip w-fit">Erweiterung</span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
