"use client";

import { useMemo, useState, useTransition } from "react";
import { GameCard, type GameCardGame } from "@/components/GameCard";
import { togglePickVoteAction } from "@/app/actions";
import { MAX_PICKS_PER_COUNT } from "@/lib/vote-limits";

export type PickGame = GameCardGame;

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
    <div className="flex flex-col gap-6">
      <div className="sticky-below-header -mx-1 px-1 py-4 bg-[var(--background)] border-b border-[var(--border)] flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold">Spieleranzahl</span>
          <span className="text-sm font-bold tabular-nums">
            {pickCount} / {MAX_PICKS_PER_COUNT} gewählt
          </span>
        </div>
        <div className="tabs-scroll">
          {availableCounts.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => {
                setSelected(n);
                setLimitMsg(null);
              }}
              className={`btn btn-tab shrink-0 ${selected === n ? "btn-primary" : "btn-ghost"}`}
            >
              {n}
              {n === expected ? " ★" : ""}
            </button>
          ))}
        </div>
        <p className="text-xs text-[var(--muted)] mt-0.5">
          Bis zu {MAX_PICKS_PER_COUNT} pro Anzahl (★ = erwartet). Nochmal tippen
          entfernt die Stimme.
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
        <ul className="grid gap-5 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {visible.map((g) => {
            const on = picks.has(`${g.id}:${selected}`);
            const disabled = !on && atLimit;
            return (
              <li key={g.id}>
                <GameCard
                  game={g}
                  playerCount={selected}
                  selected={on}
                  disabled={disabled}
                  onClick={() => toggle(g.id)}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
