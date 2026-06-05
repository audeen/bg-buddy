"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { GameCard } from "@/components/GameCard";
import { GameDetailModal } from "@/components/GameDetailModal";
import type { GameDetailData } from "@/components/GameDetailView";
import { togglePickVoteAction } from "@/app/actions";
import { MAX_PICKS_PER_COUNT } from "@/lib/vote-limits";

export type PickGame = GameDetailData;

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
  scrollTargetId,
}: {
  meetupId: string;
  expected: number;
  games: PickGame[];
  initialPicks: { gameId: number; playerCount: number }[];
  scrollTargetId: string;
}) {
  const [selected, setSelected] = useState(expected);
  const [picks, setPicks] = useState<Set<string>>(
    () => new Set(initialPicks.map((p) => `${p.gameId}:${p.playerCount}`)),
  );
  const [limitMsg, setLimitMsg] = useState<string | null>(null);
  const [detailGame, setDetailGame] = useState<PickGame | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const el = document.getElementById(scrollTargetId);
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => setShowScrollTop(!entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [scrollTargetId]);

  function scrollToPageTop() {
    document
      .getElementById(scrollTargetId)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const pickCount = picksForCount(picks, selected);
  const atLimit = pickCount >= MAX_PICKS_PER_COUNT;
  const progressPct = (pickCount / MAX_PICKS_PER_COUNT) * 100;

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
      <div className="-mx-1 filter-bar flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold">Spieleranzahl</span>
          <span className="text-sm font-bold tabular-nums">
            {pickCount} / {MAX_PICKS_PER_COUNT} gewählt
          </span>
        </div>
        <div className="progress-bar" role="progressbar" aria-valuenow={pickCount} aria-valuemin={0} aria-valuemax={MAX_PICKS_PER_COUNT} aria-label="Direkt-Picks">
          <div className="progress-bar-fill" style={{ width: `${progressPct}%` }} />
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
              className={`btn btn-tab ${selected === n ? "btn-primary" : "btn-ghost"} ${
                n === expected ? "btn-tab-expected" : ""
              }`}
            >
              {n}
              {n === expected ? " ★" : ""}
            </button>
          ))}
        </div>
        <p className="text-xs text-[var(--muted)] leading-relaxed">
          Bis zu {MAX_PICKS_PER_COUNT} pro Anzahl (★ = erwartet). Nochmal tippen
          entfernt die Stimme. ℹ für Details.
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
        <ul className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
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
                  onDetailsClick={() => setDetailGame(g)}
                />
              </li>
            );
          })}
        </ul>
      )}

      <GameDetailModal
        game={detailGame}
        onClose={() => setDetailGame(null)}
        playerCount={selected}
      />

      {showScrollTop && (
        <button
          type="button"
          onClick={scrollToPageTop}
          className={`scroll-to-top btn btn-ghost ${atLimit ? "scroll-to-top-above-footer" : ""}`}
          aria-label="Nach oben"
          title="Direkt wählen"
        >
          ↑
        </button>
      )}

      {atLimit && (
        <div className="sticky-above-nav -mx-4 px-4 py-3 mt-2 bg-[var(--background)] border-t border-[var(--border)] flex flex-col items-center gap-2 sm:static sm:border-0 sm:mx-0 sm:px-0 sm:mt-0">
          <p className="text-sm text-[var(--muted)]">
            {MAX_PICKS_PER_COUNT} Picks für {selected} Spieler gewählt
            {selected === expected ? " ★" : ""}.
          </p>
          <Link
            href={`/meetups/${meetupId}`}
            className="btn btn-primary btn-lg w-full sm:w-auto text-center"
          >
            Fertig
          </Link>
        </div>
      )}
    </div>
  );
}
