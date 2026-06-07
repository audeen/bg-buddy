"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMeetupPhaseRefresh } from "@/lib/use-meetup-phase-refresh";
import { GameCard, type GameCardGame } from "@/components/GameCard";
import { GameDetailModal } from "@/components/GameDetailModal";
import type { GameDetailData } from "@/components/GameDetailView";
import { setPickPointsAction } from "@/app/actions";
import { resolveDetailGameView } from "@/lib/expansion-detail";
import {
  effectivePlayerRange,
  isPlayableWithOwnedExpansions,
} from "@/lib/effective-player-count";
import type { PickPhaseSummary } from "@/lib/pick-phase";
import {
  applyPickTap,
  pointsForCount,
  pointsKey,
} from "@/lib/pick-points";
import { MAX_PICK_POINTS } from "@/lib/vote-limits";

export type PickGame = GameDetailData;

type DetailState = {
  viewGame: PickGame;
  baseGame: PickGame;
};

function eligible(g: PickGame, n: number, expansions: GameCardGame[]): boolean {
  return isPlayableWithOwnedExpansions(g, expansions, n);
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
  expansionsByBaseId,
  guestGameIds = [],
}: {
  meetupId: string;
  expected: number;
  games: PickGame[];
  initialPicks: { gameId: number; playerCount: number; points: number }[];
  scrollTargetId: string;
  picksLocked: boolean;
  readyForDuels: boolean;
  pickPhaseSummary: PickPhaseSummary;
  expansionsByBaseId: Record<string, GameCardGame[]>;
  guestGameIds?: number[];
}) {
  const guestIdSet = useMemo(() => new Set(guestGameIds), [guestGameIds]);
  const [selected, setSelected] = useState(expected);
  const [points, setPoints] = useState<Record<string, number>>(() => {
    const m: Record<string, number> = {};
    for (const p of initialPicks) {
      m[pointsKey(p.gameId, p.playerCount)] = p.points;
    }
    return m;
  });
  const [limitMsg, setLimitMsg] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailState | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const pointsRef = useRef(points);
  pointsRef.current = points;
  const persistChainRef = useRef(Promise.resolve());

  useMeetupPhaseRefresh(true);

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
    let maxP = 0;
    for (const g of games) {
      const exps = expansionsByBaseId[String(g.id)] ?? [];
      const range =
        exps.length > 0 ? effectivePlayerRange(g, exps) : { max: g.maxPlayers };
      maxP = Math.max(maxP, range.max ?? 0);
    }
    const counts: number[] = [];
    for (let n = 1; n <= Math.max(maxP, expected); n++) {
      if (
        n === expected ||
        games.some((g) =>
          eligible(g, n, expansionsByBaseId[String(g.id)] ?? []),
        )
      ) {
        counts.push(n);
      }
    }
    return counts;
  }, [games, expected, expansionsByBaseId]);

  const visible = useMemo(() => {
    const filtered = games.filter((g) =>
      eligible(g, selected, expansionsByBaseId[String(g.id)] ?? []),
    );
    return filtered.sort((a, b) => {
      const aGuest = guestIdSet.has(a.id);
      const bGuest = guestIdSet.has(b.id);
      if (aGuest !== bGuest) return aGuest ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [games, selected, guestIdSet, expansionsByBaseId]);

  const expectedLocked = picksLocked && selected === expected;

  function persistPick(
    gameId: number,
    playerCount: number,
    attemptedPoints: number,
    snapshotBefore: Record<string, number>,
  ) {
    const key = pointsKey(gameId, playerCount);
    const prev = snapshotBefore[key] ?? 0;

    persistChainRef.current = persistChainRef.current
      .then(async () => {
        const res = await setPickPointsAction(
          meetupId,
          gameId,
          playerCount,
          attemptedPoints,
        );
        if (res && "error" in res && res.error) {
          if ((pointsRef.current[key] ?? 0) !== attemptedPoints) return;
          setLimitMsg(res.error);
          const copy = { ...pointsRef.current };
          if (prev === 0) delete copy[key];
          else copy[key] = prev;
          pointsRef.current = copy;
          setPoints(copy);
        }
      })
      .catch(() => {});
  }

  function cycleGamePoints(gameId: number) {
    if (expectedLocked) return;
    const snapshotBefore = pointsRef.current;
    const key = pointsKey(gameId, selected);
    const before = snapshotBefore[key] ?? 0;
    const result = applyPickTap(snapshotBefore, gameId, selected);
    if ("error" in result) {
      setLimitMsg(result.error);
      return;
    }
    if (result.gamePoints === before) return;
    setLimitMsg(null);
    pointsRef.current = result.nextPoints;
    setPoints(result.nextPoints);
    persistPick(gameId, selected, result.gamePoints, snapshotBefore);
  }

  const maxAvailableCount = availableCounts[availableCounts.length - 1] ?? expected;
  const suggestFallbackCount =
    expected < maxAvailableCount ? expected + 1 : null;

  const phaseBanner = (() => {
    if (picksLocked && selected === expected) {
      return `★-Stimmen gesperrt — Duelle laufen. Andere Spielerzahlen weiter bearbeitbar.`;
    }
    if (picksLocked && selected !== expected) {
      return `Vorbereitung für ${selected} Spieler — Duelle laufen nur bei ★ (${expected}).`;
    }
    if (selected !== expected) {
      return `Vorbereitung für ${selected} Spieler — Duelle laufen nur bei ★ (${expected}).`;
    }
    if (readyForDuels) {
      return "Alle bereit — Duell-Modus ist frei. ★-Stimmen änderbar bis die Duelle abgeschlossen sind.";
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
          Karte antippen: Stimmen vergeben (1–3). Bei vollem Budget entfernt ein
          Klick auf ein bewertetes Spiel alle Stimmen dort. ★ = vom Host
          festgelegte Spieleranzahl. ℹ für Details.
          {suggestFallbackCount !== null && selected === expected && (
            <>
              {" "}
              Stimme auch für {suggestFallbackCount} ab, falls jemand dazukommt.
            </>
          )}
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
            const isGuest = guestIdSet.has(g.id);
            return (
              <li key={g.id} className="flex flex-col gap-1">
                {isGuest && (
                  <span className="text-xs font-semibold text-[var(--accent)] px-0.5">
                    Temporär
                  </span>
                )}
                <GameCard
                  game={g}
                  playerCount={selected}
                  selected={gamePoints > 0}
                  selectedPoints={gamePoints}
                  ownedExpansions={expansionsByBaseId[String(g.id)] ?? []}
                  disabled={expectedLocked}
                  onClick={() => cycleGamePoints(g.id)}
                  onDetailsClick={(displayed) => {
                    const expansions = expansionsByBaseId[String(g.id)] ?? [];
                    setDetail({
                      baseGame: g,
                      viewGame: resolveDetailGameView(g, displayed, expansions),
                    });
                  }}
                />
              </li>
            );
          })}
        </ul>
      )}

      <GameDetailModal
        game={detail?.viewGame ?? null}
        baseGame={detail?.baseGame}
        onClose={() => setDetail(null)}
        playerCount={selected}
        ownedExpansions={
          detail
            ? (expansionsByBaseId[String(detail.baseGame.id)] ?? [])
            : []
        }
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
