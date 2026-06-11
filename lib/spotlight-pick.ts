/**
 * Reine Auswahl-Logik für den "Neu in der Sammlung"-Slide des
 * Startseiten-Carousels. Ohne DOM/Storage — testbar; die
 * sessionStorage-Anbindung liegt in components/HomeSpotlightCarousel.tsx.
 */

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
