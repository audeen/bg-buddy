export function playerRange(
  min: number | null,
  max: number | null,
): string {
  if (min == null && max == null) return "? Spieler";
  if (min != null && max != null) {
    return min === max ? `${min} Spieler` : `${min}–${max} Spieler`;
  }
  return `${min ?? max} Spieler`;
}

export function playtime(
  min: number | null,
  max: number | null,
  fallback: number | null,
): string | null {
  if (min != null && max != null && min !== max) return `${min}–${max} Min`;
  const single = fallback ?? min ?? max;
  return single != null && single > 0 ? `${single} Min` : null;
}

export function weightLabel(weight: number | null): string | null {
  if (weight == null || weight <= 0) return null;
  return `Komplexität ${weight.toFixed(1)}/5`;
}

export function weightChipLabel(weight: number | null): string | null {
  if (weight == null || weight <= 0) return null;
  const level =
    weight < 2
      ? "Leicht"
      : weight < 3
        ? "Mittel"
        : weight < 4
          ? "Schwer"
          : "Experte";
  return `${level} · ${weight.toFixed(1)}`;
}
