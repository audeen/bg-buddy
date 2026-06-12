import { prisma } from "@/lib/prisma";
import { Suspense } from "react";
import { GamesClient } from "@/components/GamesClient";
import { GamesFilterBar } from "@/components/GamesFilterBar";
import { ScrollToTopButton } from "@/components/ScrollToTopButton";
import { loadOwnedExpansionsByBaseGame, loadOwnedExpansionRows, serializeExpansionsByBaseId } from "@/lib/owned-expansions";
import { buildGameOrderBy, buildGameWhere, parseGameFilters, parseGameSort, ratingBlocksFromRatings, type RatingBlock } from "@/lib/game-filters";
import {
  baseGameIdsBestViaExpansion,
  baseGameIdsPlayableViaExpansion,
} from "@/lib/effective-player-count";

export const dynamic = "force-dynamic";

const gameSelect = {
  id: true,
  name: true,
  year: true,
  description: true,
  thumbnail: true,
  image: true,
  coverUrl: true,
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
  lentOut: true,
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

  const [expansionRows, allForFilters, expansionsByBase] = await Promise.all([
    loadOwnedExpansionRows(),
    prisma.game.findMany({
      where: { isExpansion: false, listedInCollection: true },
      select: { categories: true, bggRating: true },
    }),
    loadOwnedExpansionsByBaseGame(),
  ]);

  const filterCtx = {
    expansionPlayableBaseIds:
      filters.players != null
        ? baseGameIdsPlayableViaExpansion(expansionRows, filters.players)
        : [],
    expansionBestBaseIds:
      filters.best != null
        ? baseGameIdsBestViaExpansion(expansionRows, filters.best)
        : [],
  };

  const where = buildGameWhere(filters, filterCtx);
  const orderBy = buildGameOrderBy(sort);

  const games = await prisma.game.findMany({
    where,
    select: gameSelect,
    orderBy,
  });

  const genres = Array.from(
    new Set(allForFilters.flatMap((g) => g.categories)),
  ).sort((a, b) => a.localeCompare(b));

  const ratingBlocks: RatingBlock[] = (() => {
    const blocks = ratingBlocksFromRatings(allForFilters.map((g) => g.bggRating));
    const active = filters.rating;
    if (active != null && !blocks.includes(active)) {
      return [...blocks, active].sort((a, b) => a - b);
    }
    return blocks;
  })();

  const playerCount =
    filters.players != null && Number.isFinite(filters.players)
      ? filters.players
      : undefined;

  return (
    <div className="container-app flex flex-col gap-6">
      <div
        id="games-page-top"
        className="flex items-end justify-between gap-3 flex-wrap"
      >
        <div className="flex flex-col gap-1">
          <p className="page-eyebrow">Deine Kollektion</p>
          <h1 className="page-title">Spielesammlung</h1>
        </div>
        <span className="text-sm text-[var(--muted)] tabular-nums">
          {games.length} {games.length === 1 ? "Spiel" : "Spiele"}
        </span>
      </div>

      <Suspense fallback={<div className="filter-dropdown h-12 animate-pulse rounded-xl" />}>
        <GamesFilterBar genres={genres} ratingBlocks={ratingBlocks} />
      </Suspense>

      <GamesClient
        games={games}
        playerCount={playerCount}
        activeFilters={filters}
        expansionsByBaseId={serializeExpansionsByBaseId(expansionsByBase)}
      />

      <ScrollToTopButton scrollTargetId="games-page-top" title="Nach oben" />
    </div>
  );
}
