"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useMeetupPhaseRefresh } from "@/lib/use-meetup-phase-refresh";
import { GameCard } from "@/components/GameCard";
import { GameDetailModal } from "@/components/GameDetailModal";
import type { GameDetailData } from "@/components/GameDetailView";
import { setPickPointsAction } from "@/app/actions";
import type { PickPhaseSummary } from "@/lib/pick-phase";
import { MAX_PICK_POINTS, MAX_POINTS_PER_GAME } from "@/lib/vote-limits";

export type PickGame = GameDetailData;

function eligible(g: PickGame, n: number): boolean {
  const min = g.minPlayers ?? 1;
  const max = g.maxPlayers ?? 99;
  return min <= n && n <= max;
}

function pointsKey(gameId: number, playerCount: number): string {
  return `${gameId}:${playerCount}`;
}

function pointsForCount(
  points: Record<string, number>,
  playerCount: number,
): number {
  let sum = 0;
  for (const [key, val] of Object.entries(points)) {
    if (key.endsWith(`:${playerCount}`)) sum += val;
  }
  return sum;
}

export function PickClient({
  meetupId,
  expected,
  games,
  initialPicks,
  scrollTargetId,
  picksLocked,
  readyForDuels,
  pickPhaseSummary,
}: {
  meetupId: string;
  expected: number;
  games: PickGame[];
  initialPicks: { gameId: number; playerCount: number; points: number }[];
  scrollTargetId: string;
  picksLocked: boolean;
  readyForDuels: boolean;
  pickPhaseSummary: PickPhaseSummary;
}) {
  const [selected, setSelected] = useState(expected);
  const [points, setPoints] = useState<Record<string, number>>(() => {
    const m: Record<string, number> = {};
    for (const p of initialPicks) {
      m[pointsKey(p.gameId, p.playerCount)] = p.points;
    }
    return m;
  });
  const [limitMsg, setLimitMsg] = useState<string | null>(null);
  const [detailGame, setDetailGame] = useState<PickGame | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [, startTransition] = useTransition();

  useMeetupPhaseRefresh(!picksLocked);

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

  const usedPoints = pointsForCount(points, selected);
  const budgetLeft = MAX_PICK_POINTS - usedPoints;
  const atLimit = budgetLeft <= 0;
  const progressPct = (usedPoints / MAX_PICK_POINTS) * 100;

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

  const expectedLocked = picksLocked && selected === expected;

  function cycleGamePoints(gameId: number) {
    if (expectedLocked) return;
    const key = pointsKey(gameId, selected);
    const current = points[key] ?? 0;
    setGamePoints(gameId, (current + 1) % 4);
  }

  function setGamePoints(gameId: number, next: number) {
    if (expectedLocked) return;
    const key = pointsKey(gameId, selected);
    const prev = points[key] ?? 0;
    const clamped = Math.max(0, Math.min(MAX_POINTS_PER_GAME, next));
    const newUsed = usedPoints - prev + clamped;
    if (newUsed > MAX_PICK_POINTS) {
      setLimitMsg(
        `Maximal ${MAX_PICK_POINTS} Stimmen für diese Spieleranzahl.`,
      );
      return;
    }
    setLimitMsg(null);
    setPoints((p) => {
      const copy = { ...p };
      if (clamped === 0) delete copy[key];
      else copy[key] = clamped;
      return copy;
    });
    startTransition(async () => {
      const res = await setPickPointsAction(
        meetupId,
        gameId,
        selected,
        clamped,
      );
      if (res && "error" in res && res.error) {
        setLimitMsg(res.error);
        setPoints((p) => {
          const copy = { ...p };
          if (prev === 0) delete copy[key];
          else copy[key] = prev;
          return copy;
        });
      }
    });
  }

  const phaseBanner = (() => {
    if (picksLocked) {
      return "Stimmen bei ★ gesperrt — Duelle laufen.";
    }
    if (readyForDuels) {
      return "Alle bereit — Duell-Modus ist frei. Picks bleiben änderbar bis zum ersten Duell.";
    }
    const { fullPickCount, expectedPlayerCount, partialPickerNames, missingCount } =
      pickPhaseSummary;
    let msg = `Duell-Modus ab ${expectedPlayerCount}/${expectedPlayerCount} Spielern mit ${MAX_PICK_POINTS}/${MAX_PICK_POINTS} Stimmen bei ★ (aktuell ${fullPickCount}/${expectedPlayerCount}).`;
    if (partialPickerNames.length > 0) {
      msg += ` Unvollständig: ${partialPickerNames.join(", ")}.`;
    } else if (missingCount > 0) {
      msg += ` Es fehlen noch ${missingCount} Spieler.`;
    }
    return msg;
  })();

  return (
    <div className="flex flex-col gap-6">
      <p
        className="text-sm text-[var(--muted)] leading-relaxed rounded-lg border border-[var(--border)] px-3 py-2"
        role="status"
      >
        {phaseBanner}
      </p>
      <div className="-mx-1 filter-bar flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold">Spieleranzahl</span>
          <span className="text-sm font-bold tabular-nums">
            {usedPoints} / {MAX_PICK_POINTS} Stimmen
          </span>
        </div>
        <div
          className="progress-bar"
          role="progressbar"
          aria-valuenow={usedPoints}
          aria-valuemin={0}
          aria-valuemax={MAX_PICK_POINTS}
          aria-label="Stimmen vergeben"
        >
          <div
            className="progress-bar-fill"
            style={{ width: `${progressPct}%` }}
          />
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
          Karte antippen für 1–3 Sterne (★ = erwartete Spieleranzahl). ℹ für
          Details.
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
            const key = pointsKey(g.id, selected);
            const gamePoints = points[key] ?? 0;
            return (
              <li key={g.id}>
                <GameCard
                  game={g}
                  playerCount={selected}
                  selected={gamePoints > 0}
                  selectedPoints={gamePoints}
                  disabled={expectedLocked}
                  onClick={() => cycleGamePoints(g.id)}
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
          title="Stimmen vergeben"
        >
          ↑
        </button>
      )}

      {atLimit && (
        <div className="sticky-above-nav -mx-4 px-4 py-3 mt-2 bg-[var(--background)] border-t border-[var(--border)] flex flex-col items-center gap-2 sm:static sm:border-0 sm:mx-0 sm:px-0 sm:mt-0">
          <p className="text-sm text-[var(--muted)]">
            {MAX_PICK_POINTS} Stimmen für {selected} Spieler vergeben
            {selected === expected ? " ★" : ""}.
            {selected === expected && readyForDuels && !picksLocked
              ? " Duell-Modus ist frei."
              : null}
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
