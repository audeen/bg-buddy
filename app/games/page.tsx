import { prisma } from "@/lib/prisma";
import { Suspense } from "react";
import { GamesClient } from "@/components/GamesClient";
import { GamesFilterBar } from "@/components/GamesFilterBar";
import { loadOwnedExpansionsByBaseGame, serializeExpansionsByBaseId } from "@/lib/owned-expansions";
import { buildGameOrderBy, buildGameWhere, parseGameFilters, parseGameSort } from "@/lib/game-filters";

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

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function GamesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const filters = parseGameFilters(sp);
  const sort = parseGameSort(sp);
  const where = buildGameWhere(filters);
  const orderBy = buildGameOrderBy(sort);

  const [games, allForGenres, expansionsByBase] = await Promise.all([
    prisma.game.findMany({
      where,
      select: gameSelect,
      orderBy,
    }),
    prisma.game.findMany({ select: { categories: true } }),
    loadOwnedExpansionsByBaseGame(),
  ]);

  const genres = Array.from(
    new Set(allForGenres.flatMap((g) => g.categories)),
  ).sort((a, b) => a.localeCompare(b));

  const playerCount =
    filters.players != null && Number.isFinite(filters.players)
      ? filters.players
      : undefined;

  return (
    <div className="container-app flex flex-col gap-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <h1 className="page-title">Spielesammlung</h1>
        <span className="text-sm text-[var(--muted)]">
          {games.length} {games.length === 1 ? "Spiel" : "Spiele"}
        </span>
      </div>

      <Suspense fallback={<div className="filter-bar h-24 animate-pulse rounded-xl" />}>
        <GamesFilterBar genres={genres} />
      </Suspense>

      <GamesClient
        games={games}
        playerCount={playerCount}
        activeFilters={filters}
        expansionsByBaseId={serializeExpansionsByBaseId(expansionsByBase)}
      />
    </div>
  );
}
