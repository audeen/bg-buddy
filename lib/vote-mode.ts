/** @deprecated DB may still contain TINDER until migrate deploy runs everywhere */
export type VoteModeValue = "PICK" | "TINDER" | "DUEL" | "EXPANSION_DUEL";

export function isDuelMode(mode: string): boolean {
  return mode === "DUEL" || mode === "TINDER";
}

export function isExpansionDuelMode(mode: string): boolean {
  return mode === "EXPANSION_DUEL";
}

export function isPickMode(mode: string): boolean {
  return mode === "PICK";
}
