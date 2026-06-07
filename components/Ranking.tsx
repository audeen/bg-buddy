"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GameCover } from "@/components/GameCover";
import { estimateRankingListHeight } from "@/lib/ranking-layout";
import { prefersReducedMotion, sleep } from "@/lib/motion";

export interface RankEntry {
  id: number;
  name: string;
  thumbnail: string | null;
  points: number;
  voters: number;
  pickCount?: number;
  duelWins?: number;
}

const PODIUM_DELAY_MS = 650;
const GOLD_DELAY_MS = 800;
const REST_STAGGER_MS = 80;

function podiumClasses(rank: number): string {
  if (rank === 1) return "ranking-podium ranking-podium-gold ranking-podium-gold-pop";
  if (rank === 2) return "ranking-podium ranking-podium-silver ranking-podium-enter";
  if (rank === 3) return "ranking-podium ranking-podium-bronze ranking-podium-enter";
  return "";
}

function RankingRow({
  entry,
  rank,
  pointsLabel,
  showPickDuelBreakdown,
  restStaggerIndex,
}: {
  entry: RankEntry;
  rank: number;
  pointsLabel: string;
  showPickDuelBreakdown: boolean;
  restStaggerIndex?: number;
}) {
  const isPodium = rank <= 3;
  const rowClass = isPodium
    ? podiumClasses(rank)
    : "ranking-row-reveal";

  const style =
    restStaggerIndex !== undefined
      ? { animationDelay: `${restStaggerIndex * REST_STAGGER_MS}ms` }
      : undefined;

  return (
    <li>
      <Link
        href={`/games/${entry.id}`}
        className={`card ranking-row p-2.5 flex items-center gap-3 min-h-[44px] ${rowClass}`}
        style={style}
      >
        <span
          className={`w-7 text-center font-bold shrink-0 ${
            rank === 1
              ? "text-[var(--warning)] text-lg"
              : "text-[var(--muted)]"
          }`}
        >
          {rank}
        </span>
        <GameCover
          src={entry.thumbnail}
          alt={entry.name}
          className={`rounded-md shrink-0 ${
            rank === 1 ? "w-14 h-14" : "w-12 h-12"
          }`}
        />
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 flex-1 min-w-0">
          <span className="font-semibold leading-tight truncate">
            {entry.name}
          </span>
          {showPickDuelBreakdown &&
          (entry.pickCount !== undefined || entry.duelWins !== undefined) ? (
            <span className="chip chip-meta text-xs shrink-0 w-fit">
              {entry.pickCount ?? 0} Stimmen + {entry.duelWins ?? 0} Siege
            </span>
          ) : (
            <span className="chip chip-accent shrink-0 w-fit sm:ml-auto">
              {entry.points}{" "}
              {entry.points === 1
                ? pointsLabel === "Siege"
                  ? "Sieg"
                  : "Punkt"
                : pointsLabel}
            </span>
          )}
        </div>
      </Link>
    </li>
  );
}

function isEntryVisible(
  index: number,
  entriesLength: number,
  podiumRevealed: number,
  restRevealed: number,
  revealDone: boolean,
): boolean {
  if (revealDone) return true;

  const podiumSize = Math.min(3, entriesLength);
  const podiumStart = podiumSize - podiumRevealed;

  if (index >= podiumStart && index < podiumSize) return true;
  if (index >= podiumSize && index < podiumSize + restRevealed) return true;
  return false;
}

function scenarioLabel(
  count: number,
  expected: number,
  completedCounts: number[],
): string | null {
  if (count === expected) return null;
  if (completedCounts.includes(count)) {
    return `Abgeschlossene Duell-Runde @ ${count} Spielern`;
  }
  return `Vorbereitung @ ${count} Spielern (nur Stimmen)`;
}

export function Ranking({
  expected,
  playerCounts,
  rankingByCount,
  completedCounts = [],
  pointsLabel = "Punkte",
  showPickDuelBreakdown = false,
  animateReveal = false,
}: {
  expected: number;
  playerCounts: number[];
  rankingByCount: Record<number, RankEntry[]>;
  completedCounts?: number[];
  pointsLabel?: string;
  showPickDuelBreakdown?: boolean;
  animateReveal?: boolean;
}) {
  const initial = playerCounts.includes(expected)
    ? expected
    : (playerCounts[0] ?? expected);
  const [selected, setSelected] = useState(initial);

  const [hasAnimated, setHasAnimated] = useState(false);
  const [podiumRevealed, setPodiumRevealed] = useState(0);
  const [restRevealed, setRestRevealed] = useState(0);
  const [revealDone, setRevealDone] = useState(!animateReveal);

  const entries = rankingByCount[selected] ?? [];

  useEffect(() => {
    if (!animateReveal || hasAnimated || entries.length === 0) return;

    let cancelled = false;

    async function runReveal() {
      const len = entries.length;
      const podiumSize = Math.min(3, len);
      const restCount = Math.max(0, len - podiumSize);

      if (prefersReducedMotion()) {
        if (!cancelled) {
          setPodiumRevealed(podiumSize);
          setRestRevealed(restCount);
          setRevealDone(true);
          setHasAnimated(true);
        }
        return;
      }

      setPodiumRevealed(0);
      setRestRevealed(0);
      setRevealDone(false);

      for (let step = 1; step <= podiumSize; step++) {
        if (cancelled) return;
        setPodiumRevealed(step);
        const delay = step === podiumSize ? GOLD_DELAY_MS : PODIUM_DELAY_MS;
        await sleep(delay);
      }

      for (let step = 1; step <= restCount; step++) {
        if (cancelled) return;
        setRestRevealed(step);
        await sleep(REST_STAGGER_MS);
      }

      if (!cancelled) {
        setRevealDone(true);
        setHasAnimated(true);
      }
    }

    void runReveal();

    return () => {
      cancelled = true;
    };
  }, [animateReveal, hasAnimated, entries.length]);

  function handleTabChange(pc: number) {
    setSelected(pc);
    if (!revealDone) {
      const tabEntries = rankingByCount[pc] ?? [];
      const podiumSize = Math.min(3, tabEntries.length);
      setPodiumRevealed(podiumSize);
      setRestRevealed(Math.max(0, tabEntries.length - podiumSize));
      setRevealDone(true);
      setHasAnimated(true);
    }
  }

  const showPlayerCountTabs = playerCounts.length > 1;
  const label = scenarioLabel(selected, expected, completedCounts);
  const reserveRevealHeight = animateReveal && !revealDone && entries.length > 0;

  return (
    <div className="flex flex-col gap-3">
      {label && (
        <p className="text-sm text-[var(--muted)]">{label}</p>
      )}
      {showPlayerCountTabs && (
        <div className="tabs-scroll">
          {playerCounts.map((pc) => (
            <button
              key={pc}
              type="button"
              onClick={() => handleTabChange(pc)}
              className={`btn btn-tab shrink-0 ${selected === pc ? "btn-primary" : "btn-ghost"} ${
                pc === expected ? "btn-tab-expected" : ""
              }`}
            >
              {pc} Spieler{pc === expected ? " ★" : ""}
            </button>
          ))}
        </div>
      )}

      {entries.length === 0 ? (
        <p className="text-[var(--muted)] text-sm">
          Für {selected} Spieler gibt es noch keine Stimmen.
        </p>
      ) : (
        <ol
          className="flex flex-col gap-2"
          style={
            reserveRevealHeight
              ? { minHeight: estimateRankingListHeight(entries.length) }
              : undefined
          }
        >
          {entries.map((e, i) => {
            const visible = isEntryVisible(
              i,
              entries.length,
              podiumRevealed,
              restRevealed,
              revealDone,
            );

            if (!visible) {
              return (
                <li
                  key={e.id}
                  aria-hidden
                  className="min-h-[44px] p-2.5 opacity-0 pointer-events-none"
                />
              );
            }

            const restStaggerIndex =
              i >= 3 && !revealDone ? i - 3 : undefined;

            return (
              <RankingRow
                key={e.id}
                entry={e}
                rank={i + 1}
                pointsLabel={pointsLabel}
                showPickDuelBreakdown={showPickDuelBreakdown}
                restStaggerIndex={restStaggerIndex}
              />
            );
          })}
        </ol>
      )}
    </div>
  );
}
