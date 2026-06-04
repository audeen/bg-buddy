"use client";

import { useState } from "react";
import { Ranking, type RankEntry } from "@/components/Ranking";
import { PickListByPlayer } from "@/components/PickListByPlayer";
import type { PickListPlayer } from "@/lib/vote-aggregation";

type Tab = "tinder" | "picks" | "combined";

const TABS: { id: Tab; label: string }[] = [
  { id: "tinder", label: "Tinder-Siege" },
  { id: "picks", label: "Direkt-Picks" },
  { id: "combined", label: "Gesamt" },
];

export function MeetupRankings({
  expected,
  playerCounts,
  tinderByCount,
  combinedByCount,
  picksByCount,
}: {
  expected: number;
  playerCounts: number[];
  tinderByCount: Record<number, RankEntry[]>;
  combinedByCount: Record<number, RankEntry[]>;
  picksByCount: Record<number, PickListPlayer[]>;
}) {
  const [tab, setTab] = useState<Tab>("tinder");

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-bold">Ergebnisse</h2>
        <div className="flex flex-wrap gap-1.5" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`btn ${tab === t.id ? "btn-primary" : "btn-ghost"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "tinder" && (
        <Ranking
          expected={expected}
          playerCounts={playerCounts}
          rankingByCount={tinderByCount}
          pointsLabel="Siege"
        />
      )}
      {tab === "picks" && (
        <PickListByPlayer
          expected={expected}
          playerCounts={playerCounts}
          picksByCount={picksByCount}
        />
      )}
      {tab === "combined" && (
        <Ranking
          expected={expected}
          playerCounts={playerCounts}
          rankingByCount={combinedByCount}
        />
      )}
    </section>
  );
}
