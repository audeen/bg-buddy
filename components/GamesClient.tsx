"use client";

import { useState } from "react";
import { GameCard, type GameCardGame } from "@/components/GameCard";
import { GameDetailModal } from "@/components/GameDetailModal";
import type { GameDetailData } from "@/components/GameDetailView";
import { resolveDetailGameView } from "@/lib/expansion-detail";
import type { GameFilters } from "@/lib/game-filters";

type DetailState = {
  viewGame: GameDetailData;
  baseGame: GameDetailData;
};

export function GamesClient({
  games,
  playerCount,
  activeFilters,
  expansionsByBaseId,
}: {
  games: (GameDetailData & { lentOut?: boolean })[];
  playerCount?: number;
  activeFilters: GameFilters;
  expansionsByBaseId: Record<string, GameCardGame[]>;
}) {
  const [detail, setDetail] = useState<DetailState | null>(null);

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
              lentOut={g.lentOut}
              className={g.lentOut ? "opacity-50" : ""}
              onClick={(displayed) => {
                const expansions = expansionsByBaseId[String(g.id)] ?? [];
                setDetail({
                  baseGame: g,
                  viewGame: resolveDetailGameView(g, displayed, expansions),
                });
              }}
            />
          </li>
        ))}
      </ul>

      <GameDetailModal
        game={detail?.viewGame ?? null}
        baseGame={detail?.baseGame}
        onClose={() => setDetail(null)}
        playerCount={playerCount}
        activeFilters={activeFilters}
        filterMode
        ownedExpansions={
          detail
            ? (expansionsByBaseId[String(detail.baseGame.id)] ?? [])
            : []
        }
      />
    </>
  );
}
