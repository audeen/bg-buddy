"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  GameOfTheDayCard,
  GameOfTheDayEmpty,
} from "@/components/GameOfTheDayCard";
import type { GameCardGame, GameDetailData } from "@/lib/types/game";
import {
  pickLatestGameFromPool,
  pickSpotlightVariant,
} from "@/lib/spotlight-pick";

const SEEN_KEY = "bg-buddy-spotlight-seen";
const LAST_LATEST_ID_KEY = "bg-buddy-last-latest-id";

type Spotlight = {
  variant: "gotd" | "latest";
  latestGame: GameDetailData | null;
};

function decideSpotlight(latestPool: GameDetailData[]): Spotlight {
  let isFirstVisit = false;
  let lastShownId: number | null = null;
  try {
    isFirstVisit = sessionStorage.getItem(SEEN_KEY) == null;
    const rawId = sessionStorage.getItem(LAST_LATEST_ID_KEY);
    const parsed = rawId != null ? parseInt(rawId, 10) : NaN;
    lastShownId = Number.isFinite(parsed) ? parsed : null;
  } catch {
    // sessionStorage nicht verfügbar (z.B. Privacy-Modus) → wie Folgebesuch.
  }

  const variant = pickSpotlightVariant(latestPool.length > 0, isFirstVisit);
  if (variant === "gotd") return { variant, latestGame: null };

  const latestGame = pickLatestGameFromPool(
    latestPool,
    lastShownId,
    lastShownId == null,
  );
  if (!latestGame) return { variant: "gotd", latestGame: null };
  return { variant: "latest", latestGame };
}

/** Berechnet die Entscheidung einmal pro Mount, clientseitig nach Hydration. */
function createSpotlightStore(latestPool: GameDetailData[]) {
  let decision: Spotlight | null = null;
  return {
    subscribe: () => () => {},
    getSnapshot: (): Spotlight | null => {
      decision ??= decideSpotlight(latestPool);
      return decision;
    },
  };
}

const getServerSnapshot = (): Spotlight | null => null;

/**
 * Wechselt zwischen "Spiel des Tages" und "Neu in der Sammlung":
 * Erster Besuch der Session zeigt den neuesten Neuzugang, danach
 * 25% Latest (rotierend ohne direkte Wiederholung) / 75% GOTD.
 * SSR rendert GOTD; die Entscheidung fällt nach der Hydration.
 */
export function HomeSpotlightCard({
  gotdGame,
  gotdPlayerCount,
  expansionsByBaseId,
  latestPool,
}: {
  gotdGame: GameDetailData | null;
  gotdPlayerCount?: number;
  expansionsByBaseId: Record<string, GameCardGame[]>;
  latestPool: GameDetailData[];
}) {
  const [store] = useState(() => createSpotlightStore(latestPool));
  const spotlight = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    getServerSnapshot,
  );

  useEffect(() => {
    if (!spotlight) return;
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
      if (spotlight.latestGame) {
        sessionStorage.setItem(
          LAST_LATEST_ID_KEY,
          String(spotlight.latestGame.id),
        );
      }
    } catch {
      // ignorieren
    }
  }, [spotlight]);

  const latestGame =
    spotlight?.variant === "latest" ? spotlight.latestGame : null;

  if (latestGame) {
    return (
      <GameOfTheDayCard
        key={`latest-${latestGame.id}`}
        game={latestGame}
        ownedExpansions={expansionsByBaseId[String(latestGame.id)] ?? []}
        label="Neu in der Sammlung"
      />
    );
  }

  if (!gotdGame) return <GameOfTheDayEmpty />;

  return (
    <GameOfTheDayCard
      game={gotdGame}
      playerCount={gotdPlayerCount}
      ownedExpansions={expansionsByBaseId[String(gotdGame.id)] ?? []}
    />
  );
}
