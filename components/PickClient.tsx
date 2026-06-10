"use client";

import Link from "next/link";
import type { HostChoiceMode } from "@prisma/client";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMeetupPhaseRefresh } from "@/lib/use-meetup-phase-refresh";
import { GameCard } from "@/components/GameCard";
import { GamesFilterBar } from "@/components/GamesFilterBar";
import { GameDetailModal } from "@/components/GameDetailModal";
import { HostForcedGameBanner } from "@/components/HostForcedGameBanner";
import { ScrollToTopButton } from "@/components/ScrollToTopButton";
import type { GameCardGame, GameDetailData } from "@/lib/types/game";
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
import { enqueuePickTap } from "@/lib/pick-tap-queue";
import {
  filtersToSearchParams,
  hasActiveFilters,
  matchesGameFilters,
  ratingBlocksFromRatings,
  sortGames,
  type GameFilters,
  type GameSort,
  type RatingBlock,
} from "@/lib/game-filters";
import { MAX_PICK_POINTS } from "@/lib/vote-limits";

export type PickGame = GameDetailData & { lentOut?: boolean };

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
  hostChoiceGameIds = [],
  hostChoiceMode = "NONE",
  hostForced = false,
  hostForcedGame = null,
  activeFilters,
  sort,
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
  hostChoiceGameIds?: number[];
  hostChoiceMode?: HostChoiceMode;
  hostForced?: boolean;
  hostForcedGame?: {
    id: number;
    name: string;
    thumbnail: string | null;
    image: string | null;
  } | null;
  activeFilters: GameFilters;
  sort: GameSort;
}) {
  const filters = activeFilters;
  const filterBasePath = `/meetups/${meetupId}/pick`;
  const filterListKey = filtersToSearchParams(filters, sort).toString();

  const genres = useMemo(
    () =>
      Array.from(new Set(games.flatMap((g) => g.categories))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [games],
  );

  const ratingBlocks = useMemo((): RatingBlock[] => {
    const blocks = ratingBlocksFromRatings(games.map((g) => g.bggRating));
    const active = filters.rating;
    if (active != null && !blocks.includes(active)) {
      return [...blocks, active].sort((a, b) => a - b);
    }
    return blocks;
  }, [games, filters.rating]);

  const guestIdSet = useMemo(() => new Set(guestGameIds), [guestGameIds]);
  const hostChoiceIdSet = useMemo(
    () => new Set(hostChoiceGameIds),
    [hostChoiceGameIds],
  );
  const [selected, setSelected] = useState(expected);
  const [points, setPoints] = useState<Record<string, number>>(() => {
    const m: Record<string, number> = {};
    for (const p of initialPicks) {
      m[pointsKey(p.gameId, p.playerCount)] = p.points;
    }
    return m;
  });
  const pointsRef = useRef<Record<string, number>>(points);
  const [limitMsg, setLimitMsg] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailState | null>(null);
  const closeDetail = useCallback(() => setDetail(null), []);
  const persistChainRef = useRef(Promise.resolve());
  const tapQueueRef = useRef<Array<() => void>>([]);
  const tapFlushScheduledRef = useRef(false);

  useMeetupPhaseRefresh(true);

  useEffect(() => {
    document.documentElement.classList.add("pick-page");
    return () => document.documentElement.classList.remove("pick-page");
  }, []);

  const usedPoints = pointsForCount(points, selected);
  const budgetLeft = MAX_PICK_POINTS - usedPoints;
  const atLimit = budgetLeft <= 0;

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

  const eligibleGames = useMemo(
    () =>
      games.filter((g) =>
        eligible(g, selected, expansionsByBaseId[String(g.id)] ?? []),
      ),
    [games, selected, expansionsByBaseId],
  );

  const filteredEligible = useMemo(
    () =>
      eligibleGames.filter((g) =>
        matchesGameFilters(g, filters, {
          expansions: expansionsByBaseId[String(g.id)] ?? [],
        }),
      ),
    [eligibleGames, filters, expansionsByBaseId],
  );

  const hostChoiceVisible = useMemo(() => {
    if (hostChoiceMode !== "HIGHLIGHT" || hostChoiceIdSet.size === 0) {
      return [];
    }
    const hostGames = filteredEligible.filter((g) => hostChoiceIdSet.has(g.id));
    return sortGames(hostGames, sort);
  }, [filteredEligible, hostChoiceMode, hostChoiceIdSet, sort]);

  const visible = useMemo(() => {
    const pool =
      hostChoiceMode === "HIGHLIGHT" && hostChoiceIdSet.size > 0
        ? filteredEligible.filter((g) => !hostChoiceIdSet.has(g.id))
        : filteredEligible;
    const sorted = sortGames(pool, sort);
    return sorted.sort((a, b) => {
      const aGuest = guestIdSet.has(a.id);
      const bGuest = guestIdSet.has(b.id);
      if (aGuest !== bGuest) return aGuest ? -1 : 1;
      return 0;
    });
  }, [filteredEligible, hostChoiceMode, hostChoiceIdSet, sort, guestIdSet]);

  const expectedLocked =
    hostForced || (picksLocked && selected === expected);

  function renderGameCard(g: PickGame, options?: { hostRecommendation?: boolean }) {
    const key = pointsKey(g.id, selected);
    const gamePoints = points[key] ?? 0;
    const isGuest = guestIdSet.has(g.id);
    const isLent = !!g.lentOut;
    const isHostRec = options?.hostRecommendation ?? false;
    return (
      <li key={g.id} className="flex flex-col gap-1">
        {!isHostRec && isGuest && (
          <span className="text-xs font-semibold text-[var(--accent)] px-0.5">
            Temporär
          </span>
        )}
        <GameCard
          game={g}
          playerCount={selected}
          activeFilters={filters}
          filterMode
          filterBasePath={filterBasePath}
          filterSort={sort}
          filterScrollToId={scrollTargetId}
          selected={gamePoints > 0}
          selectedPoints={gamePoints}
          ownedExpansions={expansionsByBaseId[String(g.id)] ?? []}
          lentOut={isLent}
          hostRecommendation={isHostRec}
          disabled={expectedLocked || isLent}
          onActivate={() => cycleGamePoints(g.id)}
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
  }

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

  function applyPickTapForGame(gameId: number, playerCount: number) {
    const snapshotBefore = pointsRef.current;
    const key = pointsKey(gameId, playerCount);
    const before = snapshotBefore[key] ?? 0;
    const result = applyPickTap(snapshotBefore, gameId, playerCount);
    if ("error" in result) {
      setLimitMsg(result.error);
      return;
    }
    if (result.gamePoints === before) return;
    setLimitMsg(null);
    pointsRef.current = result.nextPoints;
    setPoints(result.nextPoints);
    persistPick(gameId, playerCount, result.gamePoints, snapshotBefore);
  }

  function cycleGamePoints(gameId: number) {
    if (expectedLocked) return;
    if (games.find((g) => g.id === gameId)?.lentOut) return;
    const playerCount = selected;
    enqueuePickTap(tapQueueRef, tapFlushScheduledRef, () => {
      applyPickTapForGame(gameId, playerCount);
    });
  }

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

  const scrollTopClass = atLimit
    ? "scroll-to-top-above-picker-at-limit"
    : "scroll-to-top-above-picker";

  const pickerPaddingClass = hostForced
    ? ""
    : atLimit
      ? "pb-sticky-picker-at-limit"
      : "pb-sticky-picker";

  if (hostForced && hostForcedGame) {
    return (
      <div className="flex flex-col gap-6">
        <HostForcedGameBanner
          gameName={hostForcedGame.name}
          description="Der Host hat dieses Spiel festgelegt — keine Abstimmung nötig."
          coverSrc={hostForcedGame.thumbnail ?? hostForcedGame.image}
        >
          <Link href={`/meetups/${meetupId}`} className="btn btn-primary">
            Zurück zum Treffen
          </Link>
        </HostForcedGameBanner>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-6 ${pickerPaddingClass}`}>
      <p
        className="text-sm text-[var(--muted)] leading-relaxed rounded-lg border border-[var(--border)] px-3 py-2"
        role="status"
      >
        {hostChoiceMode === "RESTRICT" && hostChoiceIdSet.size > 0
          ? "Nur Host-Vorauswahl — wähle aus den vom Host vorgeschlagenen Spielen."
          : phaseBanner}
      </p>

      <Suspense
        fallback={
          <div className="filter-dropdown h-12 animate-pulse rounded-xl" />
        }
      >
        <GamesFilterBar
          genres={genres}
          ratingBlocks={ratingBlocks}
          basePath={filterBasePath}
          hideExpansions
          scrollToId={scrollTargetId}
        />
      </Suspense>

      {hostChoiceVisible.length > 0 && (
        <section className="flex flex-col gap-3">
          <ul className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {hostChoiceVisible.map((g) =>
              renderGameCard(g, { hostRecommendation: true }),
            )}
          </ul>
        </section>
      )}

      {visible.length === 0 && hostChoiceVisible.length === 0 ? (
        <p className="text-[var(--muted)]">
          {eligibleGames.length === 0
            ? `Keine Spiele für ${selected} Spieler in der Sammlung.`
            : hasActiveFilters(filters)
              ? "Keine Spiele für die gewählten Filter."
              : `Keine Spiele für ${selected} Spieler in der Sammlung.`}
        </p>
      ) : visible.length > 0 ? (
        <ul
          key={filterListKey}
          className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
        >
          {visible.map((g) => renderGameCard(g))}
        </ul>
      ) : null}

      <GameDetailModal
        game={detail?.viewGame ?? null}
        baseGame={detail?.baseGame}
        onClose={closeDetail}
        playerCount={selected}
        activeFilters={filters}
        filterMode
        filterBasePath={filterBasePath}
        filterSort={sort}
        filterScrollToId={scrollTargetId}
        ownedExpansions={
          detail
            ? (expansionsByBaseId[String(detail.baseGame.id)] ?? [])
            : []
        }
      />

      <ScrollToTopButton
        scrollTargetId={scrollTargetId}
        className={scrollTopClass}
        title="Stimmen vergeben"
      />

      <div className="sticky-above-nav picker-sticky-bar safe-bottom">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold">Spieleranzahl</span>
          <span
            className="text-xs font-bold tabular-nums text-[var(--muted)]"
            role="status"
            aria-label={`${usedPoints} von ${MAX_PICK_POINTS} Stimmen abgegeben`}
          >
            {usedPoints} / {MAX_PICK_POINTS} Stimmen abgegeben
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
              className={`btn btn-tab ${selected === n ? "btn-primary" : "btn-ghost"} ${
                n === expected ? "btn-tab-expected" : ""
              }`}
            >
              {n}
              {n === expected ? " ★" : ""}
            </button>
          ))}
        </div>
        {limitMsg && (
          <p className="text-xs text-[var(--accent)]" role="alert">
            {limitMsg}
          </p>
        )}
        {atLimit && (
          <div className="flex flex-col gap-1.5 sm:items-center sm:gap-2">
            <p className="text-xs text-[var(--muted)] sm:text-center">
              {MAX_PICK_POINTS} Stimmen für {selected} Spieler vergeben
              {selected === expected ? " ★" : ""}.
              {selected === expected && readyForDuels && !picksLocked
                ? " Duell-Modus ist frei."
                : null}
            </p>
            <Link
              href={`/meetups/${meetupId}`}
              className="btn btn-primary w-full sm:w-auto text-center"
            >
              Fertig
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
