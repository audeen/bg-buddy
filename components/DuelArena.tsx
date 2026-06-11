"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { GameCover } from "@/components/GameCover";
import { markScrollToErgebnisse } from "@/lib/scroll-ergebnisse";

/** Fortschrittsbalken für die eigenen Duelle. */
export function DuelProgressBar({
  done,
  total,
  complete = false,
}: {
  done: number;
  total: number;
  complete?: boolean;
}) {
  const pct = total > 0 ? (done / total) * 100 : 0;
  const isFull = complete || (total > 0 && done >= total);

  return (
    <div
      className="progress-bar w-full"
      role="progressbar"
      aria-valuenow={done}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuetext={`${done} von ${total} Duellen entschieden`}
      aria-label="Eigener Duell-Fortschritt"
    >
      <div
        className={`progress-bar-fill ${isFull ? "bg-[var(--accent)]" : ""}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** Wählbare Karte (Cover + Label) für eine Duell-Seite. */
export function DuelChoiceCard({
  coverSrc,
  label,
  disabled,
  side,
  outcome,
  onClick,
  labelLines = 2,
}: {
  coverSrc: string | null;
  label: string;
  disabled: boolean;
  side: "left" | "right";
  outcome?: "winner" | "loser";
  onClick: () => void;
  labelLines?: 2 | 3;
}) {
  const enterClass =
    side === "left" ? "duel-card-enter-left" : "duel-card-enter-right";
  const outcomeClass =
    outcome === "winner"
      ? "duel-card-winner"
      : outcome === "loser"
        ? "duel-card-loser"
        : "";
  const clampClass = labelLines === 3 ? "line-clamp-3" : "line-clamp-2";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`card card-game overflow-hidden flex flex-col h-full w-full min-h-[2.75rem] ${enterClass} ${outcomeClass}`}
    >
      <div className="relative flex-1 min-h-0 w-full">
        <GameCover
          src={coverSrc}
          alt={label}
          className="h-full w-full min-h-[8rem] card-game-cover sm:aspect-square sm:min-h-0"
        />
      </div>
      <span
        className={`p-2 sm:p-3 font-bold text-sm sm:text-base text-center leading-tight ${clampClass} shrink-0`}
      >
        {label}
      </span>
    </button>
  );
}

/** CTA zur Treffen-Seite, scrollt dort direkt zu den Ergebnissen. */
export function DuelRankingLink({
  meetupId,
  className = "btn btn-primary btn-lg w-full max-w-sm",
}: {
  meetupId: string;
  className?: string;
}) {
  return (
    <Link
      href={`/meetups/${meetupId}`}
      scroll={false}
      onClick={() => markScrollToErgebnisse()}
      className={className}
    >
      Zum Ranking
    </Link>
  );
}

/** Abschluss-Karte, wenn alle eigenen Duelle erledigt sind. */
export function DuelFinishedCard({
  meetupId,
  title,
  meta,
  done,
  total,
  extra,
}: {
  meetupId: string;
  title: string;
  meta: ReactNode;
  done: number;
  total: number;
  extra?: ReactNode;
}) {
  return (
    <div
      className="card flex flex-col items-center gap-3 text-center"
      style={{ padding: "1.5rem" }}
    >
      <p className="text-lg font-bold">{title}</p>
      <div className="w-full max-w-sm flex flex-col gap-2">
        <p className="text-[var(--muted)] text-sm tabular-nums">{meta}</p>
        <DuelProgressBar done={done} total={total} complete />
      </div>
      {extra}
      <DuelRankingLink meetupId={meetupId} />
    </div>
  );
}

/** Sticky Kopfzeile mit Fortschritt für eine Duell-Seite. */
export function DuelStickyBar({
  chipLabel,
  done,
  total,
  meta,
}: {
  chipLabel: string;
  done: number;
  total: number;
  meta?: ReactNode;
}) {
  // -mx-1 spiegelt das negative Margin der .duel-arena, damit Sticky-Bar und Arena bündig sind.
  return (
    <div className="sticky-below-header -mx-1 filter-bar flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="chip chip-accent">{chipLabel}</span>
        <span className="text-sm font-semibold tabular-nums">
          Duell {done + 1} von {total}
        </span>
      </div>
      <DuelProgressBar done={done} total={total} />
      {meta}
    </div>
  );
}

/** Fehlertext einer fehlgeschlagenen Duell-Stimme. */
export function DuelVoteError({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p className="text-sm text-center text-[var(--danger)]" role="alert">
      {error}
    </p>
  );
}

/** Sticky Fußzeile über der Bottom-Nav (mobil), statisch ab sm. */
export function DuelStickyFooter({ children }: { children: ReactNode }) {
  return (
    <div className="sticky-above-nav -mx-4 px-4 py-3 mt-2 bg-[var(--background)] border-t border-[var(--border)] flex justify-center sm:static sm:border-0 sm:mx-0 sm:px-0 sm:mt-0">
      {children}
    </div>
  );
}

/** Arena-Layout mit zwei Karten und VS-Badge. */
export function DuelArena({
  left,
  right,
  busy,
}: {
  left: ReactNode;
  right: ReactNode;
  busy: boolean;
}) {
  const vsPulseClass = busy ? "" : "duel-vs-pulse";

  return (
    <div className="duel-arena -mx-1">
      <div className="duel-arena-grid">
        {left}
        <div className="hidden sm:flex items-center justify-center self-center">
          <span className={`duel-vs-badge ${vsPulseClass}`} aria-hidden>
            VS
          </span>
        </div>
        {right}
      </div>
      <span
        className={`duel-vs-badge duel-vs-badge-overlay ${vsPulseClass}`}
        aria-hidden
      >
        VS
      </span>
    </div>
  );
}
