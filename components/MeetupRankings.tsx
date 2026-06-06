"use client";

import { useEffect, useState } from "react";
import { Ranking, type RankEntry } from "@/components/Ranking";

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
  const [revealed, setRevealed] = useState(duelComplete);

  useEffect(() => {
    if (duelComplete) setRevealed(true);
  }, [duelComplete]);

  useEffect(() => {
    if (window.location.hash !== "#ergebnisse") return;
    document.getElementById("ergebnisse")?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const openPairs = Math.max(0, totalPairs - groupDecidedPairs);

  return (
    <section id="ergebnisse" className="flex flex-col gap-3 scroll-mt-24">
      <h2 className="section-title">Ergebnisse</h2>

      {!revealed ? (
        <div className="card flex flex-col items-center gap-3 text-center" style={{ padding: "var(--space-card)" }}>
          {totalPairs > 0 && (
            <p className="text-sm text-[var(--muted)]">
              Noch {openPairs} von {totalPairs} Vergleichen offen.
            </p>
          )}
          <button
            type="button"
            onClick={() => setRevealed(true)}
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
        />
      )}
    </section>
  );
}
