"use client";

import { useCallback, useEffect, useState } from "react";
import { Ranking, type RankEntry } from "@/components/Ranking";
import { sleep } from "@/lib/motion";

const UNLOCK_FADE_MS = 250;

export function MeetupRankings({
  expected,
  playerCounts,
  combinedByCount,
  duelComplete,
  completedCounts = [],
  groupDecidedPairs,
  totalPairs,
}: {
  expected: number;
  playerCounts: number[];
  combinedByCount: Record<number, RankEntry[]>;
  duelComplete: boolean;
  completedCounts?: number[];
  groupDecidedPairs: number;
  totalPairs: number;
}) {
  const [userRevealed, setUserRevealed] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  // duelComplete is true when pool < 2 — only auto-reveal after real duels finished
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
          {totalPairs > 0 ? (
            <p className="text-sm text-[var(--muted)]">
              Noch {openPairs} von {totalPairs} Vergleichen ohne alle Stimmen.
            </p>
          ) : (
            <p className="text-sm text-[var(--muted)]">
              Ergebnisse für {expected} Spieler ★ werden nach den Duellen
              freigegeben.
            </p>
          )}
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
