export function expansionCountLabel(count: number): string {
  if (count === 1) return "1 Erweiterung";
  return `${count} Erweiterungen`;
}

export function expansionAvailableLabel(count: number): string {
  return `${expansionCountLabel(count)} verfügbar`;
}
