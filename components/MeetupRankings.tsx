"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HostForcedGameBanner } from "@/components/HostForcedGameBanner";
import { Ranking } from "@/components/Ranking";
import type { RankEntry } from "@/lib/types/ranking";
import type { DuelPhase } from "@/lib/duel-pairs";
import { groupProgressText } from "@/lib/duel-progress";
import { estimateRankingBlockHeight } from "@/lib/ranking-layout";
import { prefersReducedMotion, sleep } from "@/lib/motion";
import {
  followErgebnisseLayoutGrowth,
  retryScrollToErgebnisseElement,
  retryScrollToErgebnisseIfNeeded,
  shouldScrollToErgebnisse,
} from "@/lib/scroll-ergebnisse";

const UNLOCK_FADE_MS = 250;

type RankingView = "expansion" | "base";

function rankingViewStorageKey(meetupId: string): string {
  return `bg-buddy:ranking-view:${meetupId}`;
}

function readStoredRankingView(meetupId: string): RankingView | null {
  try {
    const raw = sessionStorage.getItem(rankingViewStorageKey(meetupId));
    return raw === "expansion" || raw === "base" ? raw : null;
  } catch {
    return null;
  }
}

function storeRankingView(meetupId: string, view: RankingView): void {
  try {
    sessionStorage.setItem(rankingViewStorageKey(meetupId), view);
  } catch {
    // ignore private browsing / storage errors
  }
}

export function MeetupRankings({
  meetupId,
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
  hostForced = false,
  hostForcedGameName = null,
}: {
  meetupId: string;
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
  hostForced?: boolean;
  hostForcedGameName?: string | null;
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

  const revealed =
    hostForced ||
    userRevealed ||
    (duelComplete && totalPairs > 0);

  // Nur einmalig auf "Varianten" umschalten, damit eine manuelle
  // Tab-Auswahl nicht bei jedem Refresh überschrieben wird.
  const autoSwitched = useRef(false);

  // Manuelle Tab-Wahl überlebt auch einen vollen Reload (sessionStorage).
  // Bewusst im Effect statt im useState-Initializer, um Hydration-Mismatches
  // zu vermeiden.
  useEffect(() => {
    const stored = readStoredRankingView(meetupId);
    if (stored) {
      autoSwitched.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- bewusst: sessionStorage erst nach Hydration lesen, sonst Hydration-Mismatch
      setView(stored === "expansion" && !expansionRankingAvailable ? "base" : stored);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetupId]);

  const selectView = useCallback(
    (next: RankingView) => {
      autoSwitched.current = true;
      setView(next);
      storeRankingView(meetupId, next);
    },
    [meetupId],
  );

  useEffect(() => {
    if (
      !autoSwitched.current &&
      revealed &&
      expansionDuelComplete &&
      expansionRankingAvailable
    ) {
      autoSwitched.current = true;
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
    if (prefersReducedMotion()) {
      setUserRevealed(true);
      followErgebnisseLayoutGrowth();
      return;
    }
    setUnlocking(true);
    await sleep(UNLOCK_FADE_MS);
    setUserRevealed(true);
    setUnlocking(false);
    followErgebnisseLayoutGrowth();
  }, []);

  const openPairs = Math.max(0, totalPairs - groupDecidedPairs);

  const baseStatusText =
    duelPhase === "GROUP" && totalPairs > 0
      ? groupProgressText(
          duelPhase,
          groupDecidedPairs,
          totalPairs,
          finishedParticipants,
          totalParticipants,
        )
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

  if (hostForced && hostForcedGameName) {
    return (
      <section
        id="ergebnisse"
        className="flex flex-col gap-3 scroll-mt-24"
      >
        <h2 className="section-title">Ergebnisse</h2>
        <HostForcedGameBanner
          gameName={hostForcedGameName}
          description="Keine Abstimmung — dieses Spiel wird gespielt."
        />
      </section>
    );
  }

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
              onClick={() => selectView("expansion")}
            >
              Varianten
            </button>
            <button
              type="button"
              className={`btn btn-tab ${view === "base" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => selectView("base")}
            >
              Basisspiele
            </button>
          </div>
        )}
      </div>

      {!revealed ? (
        <div
          className={`card card-pad flex flex-col items-center gap-3 text-center ${
            unlocking ? "ranking-unlock-exit" : ""
          }`}
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
