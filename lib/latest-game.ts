import type { GameOfTheDayCandidate } from "@/lib/game-of-the-day";

/** Zeitfenster, in dem ein Neuzugang als "Neu in der Sammlung" gilt. */
export const LATEST_GAME_WINDOW_DAYS = 14;

export type LatestGameCandidate = GameOfTheDayCandidate & {
  addedToCollectionAt: Date | null;
};

/**
 * Filtert die Spiele auf Neuzugänge im Zeitfenster und sortiert sie nach
 * Hinzufügedatum (neueste zuerst, ties nach id). Die Anzeige-Auswahl aus
 * dem Pool passiert clientseitig pro Seitenaufruf (lib/spotlight-pick.ts).
 */
export function buildRecentGamesPool<T extends LatestGameCandidate>(
  games: T[],
  now: Date = new Date(),
): T[] {
  const cutoff = now.getTime() - LATEST_GAME_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  return games
    .filter(
      (game) =>
        !game.lentOut &&
        !game.isExpansion &&
        game.addedToCollectionAt != null &&
        game.addedToCollectionAt.getTime() >= cutoff,
    )
    .sort((a, b) => {
      const diff =
        (b.addedToCollectionAt?.getTime() ?? 0) -
        (a.addedToCollectionAt?.getTime() ?? 0);
      return diff !== 0 ? diff : a.id - b.id;
    });
}
