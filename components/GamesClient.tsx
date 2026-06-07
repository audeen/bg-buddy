"use client";

import { useState } from "react";
import { GameCard, type GameCardGame } from "@/components/GameCard";
import { GameDetailModal } from "@/components/GameDetailModal";
import type { GameDetailData } from "@/components/GameDetailView";
import type { GameFilters } from "@/lib/game-filters";

export function GamesClient({
  games,
  playerCount,
  activeFilters,
  expansionsByBaseId,
}: {
  games: GameDetailData[];
  playerCount?: number;
  activeFilters: GameFilters;
  expansionsByBaseId: Record<string, GameCardGame[]>;
}) {
  const [detailGame, setDetailGame] = useState<GameDetailData | null>(null);

  if (games.length === 0) {
    return (
      <p className="text-[var(--muted)]">
        Keine Spiele gefunden. Passe die Filter an oder importiere zuerst deine
        Sammlung.
      </p>
    );
  }

  return (
    <>
      <ul className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {games.map((g) => (
          <li key={g.id}>
            <GameCard
              game={g}
              playerCount={playerCount}
              activeFilters={activeFilters}
              filterMode
              ownedExpansions={expansionsByBaseId[String(g.id)] ?? []}
              onClick={() => setDetailGame(g)}
            />
          </li>
        ))}
      </ul>

      <GameDetailModal
        game={detailGame}
        onClose={() => setDetailGame(null)}
        playerCount={playerCount}
        activeFilters={activeFilters}
        filterMode
        ownedExpansions={
          detailGame && !detailGame.isExpansion
            ? (expansionsByBaseId[String(detailGame.id)] ?? [])
            : []
        }
      />
    </>
  );
}
