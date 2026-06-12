"use client";

import { useCallback, useState, type CSSProperties } from "react";
import { GameCard } from "@/components/GameCard";
import { GameDetailModal } from "@/components/GameDetailModal";
import type { GameCardGame, GameDetailData } from "@/lib/types/game";
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
  const closeDetail = useCallback(() => setDetail(null), []);

  if (games.length === 0) {
    return (
      <div className="card card-pad flex flex-col items-start gap-2">
        <h2 className="section-title">Keine Spiele gefunden</h2>
        <p className="text-sm text-[var(--muted)]">
          Passe die Filter an oder importiere zuerst deine Sammlung.
        </p>
      </div>
    );
  }

  return (
    <>
      <ul className="grid gap-3 sm:gap-5 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {games.map((g, i) => (
          <li
            key={g.id}
            className="card-reveal"
            style={{ "--reveal-i": i } as CSSProperties}
          >
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
        onClose={closeDetail}
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
