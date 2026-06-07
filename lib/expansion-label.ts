export function expansionCountLabel(count: number): string {
  if (count === 1) return "1 Erweiterung";
  return `${count} Erweiterungen`;
}

export function expansionAvailableLabel(count: number): string {
  return `${expansionCountLabel(count)} verfügbar`;
}

export function expansionViewLabel(baseGameName: string): string {
  const short =
    baseGameName.length > 16
      ? `${baseGameName.slice(0, 14)}…`
      : baseGameName;
  return `Erweitert: ${short}`;
}

export function expansionRequiredForCountLabel(
  expansionNames: string[],
  playerCount: number,
): string {
  const quoted = expansionNames.map((n) => `„${n}"`).join(", ");
  const expWord = expansionNames.length === 1 ? "Erweiterung" : "Erweiterungen";
  return `Nur mit ${expWord} ${quoted} für ${playerCount} Personen spielbar`;
}
