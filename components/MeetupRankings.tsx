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
  groupDecidedPairs,
  totalPairs,
}: {
  expected: number;
  playerCounts: number[];
  combinedByCount: Record<number, RankEntry[]>;
  duelComplete: boolean;
  groupDecidedPairs: number;
  totalPairs: number;
}) {
  const [userRevealed, setUserRevealed] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  const revealed = duelComplete || userRevealed;

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
          {totalPairs > 0 && (
            <p className="text-sm text-[var(--muted)]">
              Noch {openPairs} von {totalPairs} Vergleichen offen.
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
          expected={expected}
          playerCounts={playerCounts}
          rankingByCount={combinedByCount}
          showPickDuelBreakdown
          animateReveal
        />
      )}
    </section>
  );
}
