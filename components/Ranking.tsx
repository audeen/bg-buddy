"use client";

import { useState } from "react";
import Link from "next/link";
import { GameCover } from "@/components/GameCover";

export interface RankEntry {
  id: number;
  name: string;
  thumbnail: string | null;
  points: number;
  voters: number;
}

export function Ranking({
  expected,
  playerCounts,
  rankingByCount,
}: {
  expected: number;
  playerCounts: number[];
  rankingByCount: Record<number, RankEntry[]>;
}) {
  const initial = playerCounts.includes(expected)
    ? expected
    : (playerCounts[0] ?? expected);
  const [selected, setSelected] = useState(initial);

  const entries = rankingByCount[selected] ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {playerCounts.map((pc) => (
          <button
            key={pc}
            type="button"
            onClick={() => setSelected(pc)}
            className={`btn ${selected === pc ? "btn-primary" : "btn-ghost"}`}
          >
            {pc} Spieler{pc === expected ? " ★" : ""}
          </button>
        ))}
      </div>

      {entries.length === 0 ? (
        <p className="text-[var(--muted)] text-sm">
          Für {selected} Spieler gibt es noch keine Stimmen.
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {entries.map((e, i) => (
            <li key={e.id}>
              <Link
                href={`/games/${e.id}`}
                className="card p-2 flex items-center gap-3 hover:shadow-md transition-shadow"
              >
                <span className="w-7 text-center font-bold text-[var(--muted)]">
                  {i + 1}
                </span>
                <GameCover
                  src={e.thumbnail}
                  alt={e.name}
                  className="w-12 h-12 rounded-md shrink-0"
                />
                <span className="font-semibold flex-1 leading-tight">
                  {e.name}
                </span>
                <span className="chip">
                  {e.points} {e.points === 1 ? "Punkt" : "Punkte"}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
