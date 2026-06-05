import { prisma } from "@/lib/prisma";
import { GamesClient } from "@/components/GamesClient";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const gameSelect = {
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
} as const;

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
    prisma.game.findMany({
      where,
      select: gameSelect,
      orderBy: { name: "asc" },
    }),
    prisma.game.findMany({ select: { categories: true } }),
  ]);

  const genres = Array.from(
    new Set(allForGenres.flatMap((g) => g.categories)),
  ).sort((a, b) => a.localeCompare(b));

  const playerCount =
    players && Number.isFinite(players) ? players : undefined;

  return (
    <div className="container-app flex flex-col gap-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <h1 className="page-title">Spielesammlung</h1>
        <span className="text-sm text-[var(--muted)]">
          {games.length} {games.length === 1 ? "Spiel" : "Spiele"}
        </span>
      </div>

      <form className="filter-bar grid gap-3 sm:grid-cols-4 items-end">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="games-q">
            Suche
          </label>
          <input
            id="games-q"
            name="q"
            defaultValue={q}
            className="input"
            placeholder="Spielname…"
          />
        </div>
        <div>
          <label className="label" htmlFor="games-players">
            Spieleranzahl
          </label>
          <select id="games-players" name="players" defaultValue={sp.players ?? ""} className="input">
            <option value="">egal</option>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <option key={n} value={n}>
                {n} Spieler
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="games-genre">
            Genre
          </label>
          <select id="games-genre" name="genre" defaultValue={genre} className="input">
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

      <GamesClient games={games} playerCount={playerCount} />
    </div>
  );
}
