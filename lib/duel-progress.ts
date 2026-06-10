import type { DuelPhase } from "@/lib/duel-pairs";

/** Status-Text zum Gruppen-Fortschritt der Duelle (Host-Ansicht). */
export function groupProgressText(
  phase: DuelPhase,
  groupDecidedPairs: number,
  totalPairs: number,
  finishedParticipants: number,
  totalParticipants: number,
): string {
  if (phase === "GROUP") {
    return `Matrix: ${groupDecidedPairs}/${totalPairs} abgestimmt · ${finishedParticipants}/${totalParticipants} Spieler fertig`;
  }
  return `${groupDecidedPairs} / ${totalPairs} mit allen Stimmen`;
}
