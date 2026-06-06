"use client";

import { useState } from "react";
import Link from "next/link";
import { GameCover } from "@/components/GameCover";
import type { PickListPlayer } from "@/lib/vote-aggregation";

export function PickListByPlayer({
  expected,
  playerCounts,
  picksByCount,
}: {
  expected: number;
  playerCounts: number[];
  picksByCount: Record<number, PickListPlayer[]>;
}) {
  const initial = playerCounts.includes(expected)
    ? expected
    : (playerCounts[0] ?? expected);
  const [selected, setSelected] = useState(initial);

  const players = picksByCount[selected] ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div className="tabs-scroll">
        {playerCounts.map((pc) => (
          <button
            key={pc}
            type="button"
            onClick={() => setSelected(pc)}
            className={`btn btn-tab shrink-0 ${selected === pc ? "btn-primary" : "btn-ghost"}`}
          >
            {pc} Spieler{pc === expected ? " ★" : ""}
          </button>
        ))}
      </div>

      {players.length === 0 ? (
        <p className="text-[var(--muted)] text-sm">
          Für {selected} Spieler gibt es noch keine Stimmen.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {players.map((p) => (
            <li key={p.userId} className="card p-3 flex flex-col gap-2">
              <span className="font-semibold">{p.userName}</span>
              <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
                {p.games.map((g) => (
                  <Link
                    key={g.id}
                    href={`/games/${g.id}`}
                    className="flex items-center gap-2 rounded-lg border border-[var(--border)] p-2 pr-3 hover:shadow-md transition-shadow w-full sm:w-auto min-h-[44px]"
                  >
                    <GameCover
                      src={g.thumbnail}
                      alt={g.name}
                      className="w-10 h-10 rounded-md shrink-0"
                    />
                    <span className="text-sm font-medium leading-tight line-clamp-2 min-w-0 flex-1">
                      {g.name}
                    </span>
                    {g.points > 1 && (
                      <span className="chip chip-accent text-xs shrink-0">
                        {g.points}×
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
