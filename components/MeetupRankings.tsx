"use client";

import { useEffect, useState } from "react";
import { Ranking, type RankEntry } from "@/components/Ranking";
import { PickListByPlayer } from "@/components/PickListByPlayer";
import type { PickListPlayer } from "@/lib/vote-aggregation";

type Tab = "picks" | "duel" | "combined";

const TABS: { id: Tab; label: string; short: string }[] = [
  { id: "picks", label: "Stimmen", short: "Stimmen" },
  { id: "duel", label: "Duelle", short: "Duelle" },
  { id: "combined", label: "Gesamt", short: "Gesamt" },
];

export function MeetupRankings({
  expected,
  playerCounts,
  duelByCount,
  combinedByCount,
  picksByCount,
}: {
  expected: number;
  playerCounts: number[];
  duelByCount: Record<number, RankEntry[]>;
  combinedByCount: Record<number, RankEntry[]>;
  picksByCount: Record<number, PickListPlayer[]>;
}) {
  const [tab, setTab] = useState<Tab>("picks");

  useEffect(() => {
    if (window.location.hash !== "#ergebnisse") return;
    document.getElementById("ergebnisse")?.scrollIntoView({ behavior: "smooth" });
  }, []);

  return (
    <section id="ergebnisse" className="flex flex-col gap-3 scroll-mt-24">
      <div className="flex flex-col gap-2">
        <h2 className="section-title">Ergebnisse</h2>
        <div className="tabs-scroll" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`btn btn-tab shrink-0 ${tab === t.id ? "btn-primary" : "btn-ghost"}`}
            >
              <span className="sm:hidden">{t.short}</span>
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {tab === "picks" && (
        <PickListByPlayer
          expected={expected}
          playerCounts={playerCounts}
          picksByCount={picksByCount}
        />
      )}
      {tab === "duel" && (
        <>
          <p className="text-sm text-[var(--muted)]">
            Copeland-Siege aus Paarvergleichen (★ = erwartete Spieleranzahl).
          </p>
          <Ranking
            expected={expected}
            playerCounts={playerCounts}
            rankingByCount={duelByCount}
            pointsLabel="Siege"
          />
        </>
      )}
      {tab === "combined" && (
        <>
          <p className="text-sm text-[var(--muted)]">
            Gesamt = Stimmen der Gruppe + Copeland-Siege (stärker gewichtete
            Nominierungen starten mit Bonus).
          </p>
          <Ranking
            expected={expected}
            playerCounts={playerCounts}
            rankingByCount={combinedByCount}
            showPickDuelBreakdown
          />
        </>
      )}
    </section>
  );
}
