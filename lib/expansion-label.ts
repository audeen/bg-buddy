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
