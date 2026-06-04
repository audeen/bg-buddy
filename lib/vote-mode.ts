/** @deprecated DB may still contain TINDER until migrate deploy runs everywhere */
export type VoteModeValue = "PICK" | "TINDER" | "DUEL";

export function isDuelMode(mode: string): boolean {
  return mode === "DUEL" || mode === "TINDER";
}

export function isPickMode(mode: string): boolean {
  return mode === "PICK";
}
