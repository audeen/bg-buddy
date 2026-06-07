"use client";

import { useCallback, useEffect, useState } from "react";
import { Ranking, type RankEntry } from "@/components/Ranking";
import type { DuelPhase } from "@/lib/duel-pairs";
import { sleep } from "@/lib/motion";

const UNLOCK_FADE_MS = 250;

export function MeetupRankings({
  expected,
  playerCounts,
  combinedByCount,
  duelComplete,
  completedCounts = [],
  duelPhase = "FULL",
  groupDecidedPairs,
  totalPairs,
  finishedParticipants = 0,
  totalParticipants = 0,
}: {
  expected: number;
  playerCounts: number[];
  combinedByCount: Record<number, RankEntry[]>;
  duelComplete: boolean;
  completedCounts?: number[];
  duelPhase?: DuelPhase;
  groupDecidedPairs: number;
  totalPairs: number;
  finishedParticipants?: number;
  totalParticipants?: number;
}) {
  const [userRevealed, setUserRevealed] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  const revealed = userRevealed || (duelComplete && totalPairs > 0);

  useEffect(() => {
    if (window.location.hash !== "#ergebnisse") return;
    document.getElementById("ergebnisse")?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const handleReveal = useCallback(async () => {
    setUnlocking(true);
    await sleep(UNLOCK_FADE_MS);
    setUserRevealed(true);
    setUnlocking(false);
  }, []);

  const openPairs = Math.max(0, totalPairs - groupDecidedPairs);

  const statusText =
    duelPhase === "GROUP" && totalPairs > 0
      ? `Matrix: ${groupDecidedPairs}/${totalPairs} abgestimmt · ${finishedParticipants}/${totalParticipants} Spieler fertig`
      : totalPairs > 0
        ? `Noch ${openPairs} von ${totalPairs} Vergleichen ohne alle Stimmen.`
        : `Ergebnisse für ${expected} Spieler ★ werden nach den Duellen freigegeben.`;

  return (
    <section id="ergebnisse" className="flex flex-col gap-3 scroll-mt-24">
      <h2 className="section-title">Ergebnisse</h2>

      {!revealed ? (
        <div
          className={`card flex flex-col items-center gap-3 text-center ${
            unlocking ? "ranking-unlock-exit" : ""
          }`}
          style={{ padding: "var(--space-card)" }}
        >
          <p className="text-sm text-[var(--muted)]">{statusText}</p>
          <button
            type="button"
            onClick={() => void handleReveal()}
            disabled={unlocking}
            className="btn btn-ghost btn-lg"
          >
            Ergebnisse anzeigen
          </button>
        </div>
      ) : (
        <Ranking
          key={expected}
          expected={expected}
          playerCounts={playerCounts}
          rankingByCount={combinedByCount}
          completedCounts={completedCounts}
          showPickDuelBreakdown
          animateReveal={totalPairs > 0 && (duelComplete || userRevealed)}
        />
      )}
    </section>
  );
}
