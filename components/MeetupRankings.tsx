"use client";

import { useCallback, useEffect, useState } from "react";
import { Ranking, type RankEntry } from "@/components/Ranking";
import type { DuelPhase } from "@/lib/duel-pairs";
import { estimateRankingBlockHeight } from "@/lib/ranking-layout";
import { sleep } from "@/lib/motion";
import {
  followErgebnisseLayoutGrowth,
  retryScrollToErgebnisseElement,
  retryScrollToErgebnisseIfNeeded,
  shouldScrollToErgebnisse,
} from "@/lib/scroll-ergebnisse";

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
  isHost = false,
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
  isHost?: boolean;
}) {
  const [userRevealed, setUserRevealed] = useState(
    () =>
      typeof window !== "undefined" &&
      shouldScrollToErgebnisse() &&
      duelComplete &&
      totalPairs > 0,
  );
  const [unlocking, setUnlocking] = useState(false);

  const revealed = userRevealed || (duelComplete && totalPairs > 0);

  useEffect(() => {
    const cleanupMount = retryScrollToErgebnisseIfNeeded();

    const onHashChange = () => {
      if (!shouldScrollToErgebnisse()) return;
      retryScrollToErgebnisseElement();
    };

    window.addEventListener("hashchange", onHashChange);
    return () => {
      cleanupMount();
      window.removeEventListener("hashchange", onHashChange);
    };
  }, []);

  const handleReveal = useCallback(async () => {
    setUnlocking(true);
    await sleep(UNLOCK_FADE_MS);
    setUserRevealed(true);
    setUnlocking(false);
    followErgebnisseLayoutGrowth();
  }, []);

  const openPairs = Math.max(0, totalPairs - groupDecidedPairs);

  const statusText =
    duelPhase === "GROUP" && totalPairs > 0
      ? `Matrix: ${groupDecidedPairs}/${totalPairs} abgestimmt · ${finishedParticipants}/${totalParticipants} Spieler fertig`
      : totalPairs > 0
        ? `Noch ${openPairs} von ${totalPairs} Vergleichen ohne alle Stimmen.`
        : `Ergebnisse für ${expected} Spieler ★ werden nach den Duellen freigegeben.`;

  const expectedEntryCount = (combinedByCount[expected] ?? []).length;
  const sectionReserveMinHeight = unlocking
    ? estimateRankingBlockHeight(expectedEntryCount, {
        withTabs: playerCounts.length > 1,
      }) + 48
    : undefined;

  return (
    <section
      id="ergebnisse"
      className="flex flex-col gap-3 scroll-mt-24"
      style={
        sectionReserveMinHeight
          ? { minHeight: sectionReserveMinHeight }
          : undefined
      }
    >
      <h2 className="section-title">Ergebnisse</h2>

      {!revealed ? (
        <div
          className={`card flex flex-col items-center gap-3 text-center ${
            unlocking ? "ranking-unlock-exit" : ""
          }`}
          style={{ padding: "var(--space-card)" }}
        >
          {isHost && (
            <p className="text-sm text-[var(--muted)]">{statusText}</p>
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
