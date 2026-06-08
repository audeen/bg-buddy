"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

type RankingView = "expansion" | "base";

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
  expansionRanking = [],
  expansionDuelComplete = false,
  expansionRankingAvailable = false,
  winnerName = null,
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
  expansionRanking?: RankEntry[];
  expansionDuelComplete?: boolean;
  expansionRankingAvailable?: boolean;
  winnerName?: string | null;
}) {
  const defaultView: RankingView =
    expansionDuelComplete && expansionRankingAvailable ? "expansion" : "base";

  const [view, setView] = useState<RankingView>(defaultView);
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
    if (revealed && expansionDuelComplete && expansionRankingAvailable) {
      setView("expansion");
    }
  }, [revealed, expansionDuelComplete, expansionRankingAvailable]);

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

  const baseStatusText =
    duelPhase === "GROUP" && totalPairs > 0
      ? `Matrix: ${groupDecidedPairs}/${totalPairs} abgestimmt · ${finishedParticipants}/${totalParticipants} Spieler fertig`
      : totalPairs > 0
        ? `Noch ${openPairs} von ${totalPairs} Vergleichen ohne alle Stimmen.`
        : `Ergebnisse für ${expected} Spieler ★ werden nach den Duellen freigegeben.`;

  const expansionRankingByCount = useMemo(
    () => ({ [expected]: expansionRanking }),
    [expected, expansionRanking],
  );

  const activeRankingByCount =
    view === "expansion" && expansionRankingAvailable
      ? expansionRankingByCount
      : combinedByCount;

  const activeEntryCount = (activeRankingByCount[expected] ?? []).length;
  const sectionReserveMinHeight = unlocking
    ? estimateRankingBlockHeight(activeEntryCount, {
        withTabs:
          view === "base" && playerCounts.length > 1,
      }) + 48
    : undefined;

  const expansionSubtitle =
    winnerName != null
      ? `Erweiterungen für ${winnerName} bei ${expected} ★`
      : `Erweiterungen bei ${expected} ★`;

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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="section-title">Ergebnisse</h2>
        {revealed && expansionRankingAvailable && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`btn btn-tab ${view === "expansion" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setView("expansion")}
            >
              Varianten
            </button>
            <button
              type="button"
              className={`btn btn-tab ${view === "base" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setView("base")}
            >
              Basisspiele
            </button>
          </div>
        )}
      </div>

      {!revealed ? (
        <div
          className={`card flex flex-col items-center gap-3 text-center ${
            unlocking ? "ranking-unlock-exit" : ""
          }`}
          style={{ padding: "var(--space-card)" }}
        >
          {isHost && (
            <p className="text-sm text-[var(--muted)]">{baseStatusText}</p>
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
          key={`${expected}-${view}`}
          expected={expected}
          playerCounts={playerCounts}
          rankingByCount={activeRankingByCount}
          completedCounts={completedCounts}
          showPickDuelBreakdown={view === "base"}
          pointsLabel={view === "expansion" ? "Siege" : "Punkte"}
          animateReveal={totalPairs > 0 && (duelComplete || userRevealed)}
          subtitle={view === "expansion" ? expansionSubtitle : undefined}
          hidePlayerCountTabs={view === "expansion"}
        />
      )}
    </section>
  );
}
