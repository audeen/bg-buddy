/**
 * Reine Auswahl-Logik für die Startseiten-Spotlight-Karte
 * (GOTD vs. "Neu in der Sammlung"). Ohne DOM/Storage — testbar;
 * sessionStorage-Anbindung liegt in components/HomeSpotlightCard.tsx.
 */

export type SpotlightVariant = "gotd" | "latest";

/** Anteil der Seitenaufrufe (nach dem ersten), die die Latest-Karte zeigen. */
export const LATEST_VARIANT_PROBABILITY = 0.25;

/**
 * Entscheidet, welche Karte gezeigt wird. Erster Besuch der Session zeigt
 * immer die Latest-Karte (sofern es Neuzugänge gibt), danach gewichtet.
 */
export function pickSpotlightVariant(
  hasLatestPool: boolean,
  isFirstVisit: boolean,
  random: () => number = Math.random,
): SpotlightVariant {
  if (!hasLatestPool) return "gotd";
  if (isFirstVisit) return "latest";
  return random() < LATEST_VARIANT_PROBABILITY ? "latest" : "gotd";
}

/**
 * Wählt pro Anzeige ein Spiel aus dem Neuzugangs-Pool (sortiert: neueste
 * zuerst). Beim ersten Latest-Aufruf der Session das zuletzt hinzugefügte
 * Spiel; danach Zufall ohne direkte Wiederholung des zuletzt gezeigten.
 */
export function pickLatestGameFromPool<T extends { id: number }>(
  pool: readonly T[],
  lastShownId: number | null,
  isFirstLatestInSession: boolean,
  random: () => number = Math.random,
): T | null {
  if (pool.length === 0) return null;
  if (pool.length === 1) return pool[0];
  if (isFirstLatestInSession) return pool[0];

  const candidates =
    lastShownId == null ? pool : pool.filter((g) => g.id !== lastShownId);
  const effective = candidates.length > 0 ? candidates : pool;
  const index = Math.min(
    Math.floor(random() * effective.length),
    effective.length - 1,
  );
  return effective[index];
}
