"use client";

import { useMemo, useState, useTransition } from "react";
import { GameCover } from "@/components/GameCover";
import { togglePickVoteAction } from "@/app/actions";
import { MAX_PICKS_PER_COUNT } from "@/lib/vote-limits";

export interface PickGame {
  id: number;
  name: string;
  thumbnail: string | null;
  image: string | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  bestPlayerCounts: number[];
}

function eligible(g: PickGame, n: number): boolean {
  const min = g.minPlayers ?? 1;
  const max = g.maxPlayers ?? 99;
  return min <= n && n <= max;
}

function picksForCount(
  picks: Set<string>,
  playerCount: number,
): number {
  let n = 0;
  for (const key of picks) {
    if (key.endsWith(`:${playerCount}`)) n++;
  }
  return n;
}

export function PickClient({
  meetupId,
  expected,
  games,
  initialPicks,
}: {
  meetupId: string;
  expected: number;
  games: PickGame[];
  initialPicks: { gameId: number; playerCount: number }[];
}) {
  const [selected, setSelected] = useState(expected);
  const [picks, setPicks] = useState<Set<string>>(
    () => new Set(initialPicks.map((p) => `${p.gameId}:${p.playerCount}`)),
  );
  const [limitMsg, setLimitMsg] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const pickCount = picksForCount(picks, selected);
  const atLimit = pickCount >= MAX_PICKS_PER_COUNT;

  const availableCounts = useMemo(() => {
    const maxP = games.reduce((m, g) => Math.max(m, g.maxPlayers ?? 0), 0);
    const counts: number[] = [];
    for (let n = 1; n <= Math.max(maxP, expected); n++) {
      if (n === expected || games.some((g) => eligible(g, n))) counts.push(n);
    }
    return counts;
  }, [games, expected]);

  const visible = useMemo(
    () =>
      games
        .filter((g) => eligible(g, selected))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [games, selected],
  );

  function toggle(gameId: number) {
    const key = `${gameId}:${selected}`;
    const isOn = picks.has(key);
    if (!isOn && atLimit) {
      setLimitMsg(
        `Maximal ${MAX_PICKS_PER_COUNT} Direkt-Picks für diese Spieleranzahl.`,
      );
      return;
    }
    setLimitMsg(null);
    setPicks((prev) => {
      const next = new Set(prev);
      if (isOn) next.delete(key);
      else next.add(key);
      return next;
    });
    startTransition(async () => {
      const res = await togglePickVoteAction(meetupId, gameId, selected);
      if (res && "error" in res && res.error) {
        setLimitMsg(res.error);
        setPicks((prev) => {
          const next = new Set(prev);
          if (isOn) next.add(key);
          else next.delete(key);
          return next;
        });
        return;
      }
      if (res && "voted" in res) {
        setPicks((prev) => {
          const next = new Set(prev);
          if (res.voted) next.add(key);
          else next.delete(key);
          return next;
        });
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold">Für wie viele Spieler?</span>
        <div className="flex flex-wrap gap-1.5">
          {availableCounts.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => {
                setSelected(n);
                setLimitMsg(null);
              }}
              className={`btn ${selected === n ? "btn-primary" : "btn-ghost"}`}
            >
              {n}
              {n === expected ? " ★" : ""}
            </button>
          ))}
        </div>
        <p className="text-xs text-[var(--muted)]">
          Bis zu {MAX_PICKS_PER_COUNT} Spiele pro Spieleranzahl (★ = erwartete
          Anzahl). Nochmal tippen entfernt die Stimme.
        </p>
        <p className="text-sm font-medium">
          {pickCount} / {MAX_PICKS_PER_COUNT} gewählt
        </p>
        {limitMsg && (
          <p className="text-sm text-[var(--accent)]" role="alert">
            {limitMsg}
          </p>
        )}
      </div>

      {visible.length === 0 ? (
        <p className="text-[var(--muted)]">
          Keine Spiele für {selected} Spieler in der Sammlung.
        </p>
      ) : (
        <ul className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((g) => {
            const on = picks.has(`${g.id}:${selected}`);
            const best = g.bestPlayerCounts.includes(selected);
            const disabled = !on && atLimit;
            return (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={() => toggle(g.id)}
                  disabled={disabled}
                  className={`card overflow-hidden flex flex-col h-full w-full text-left transition-all ${
                    on
                      ? "ring-2 ring-[var(--accent)] shadow-md"
                      : disabled
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:shadow-md"
                  }`}
                >
                  <div className="relative">
                    <GameCover
                      src={g.thumbnail ?? g.image}
                      alt={g.name}
                      className="w-full aspect-square"
                    />
                    {on && (
                      <span className="absolute top-2 right-2 bg-[var(--accent)] text-white rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold">
                        ✓
                      </span>
                    )}
                  </div>
                  <div className="p-2.5 flex flex-col gap-1">
                    <span className="font-semibold text-sm leading-tight line-clamp-2">
                      {g.name}
                    </span>
                    {best && (
                      <span className="chip w-fit">Beste Wahl</span>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
