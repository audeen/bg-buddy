"use client";

import { useState } from "react";
import { GameCard } from "@/components/GameCard";
import { GameDetailModal } from "@/components/GameDetailModal";
import type { GameDetailData } from "@/components/GameDetailView";

export function GamesClient({
  games,
  playerCount,
}: {
  games: GameDetailData[];
  playerCount?: number;
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
              onClick={() => setDetailGame(g)}
            />
          </li>
        ))}
      </ul>

      <GameDetailModal
        game={detailGame}
        onClose={() => setDetailGame(null)}
        playerCount={playerCount}
      />
    </>
  );
}
