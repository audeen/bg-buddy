"use client";

import type { ReactNode } from "react";
import { GameCover } from "@/components/GameCover";

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
      className={`card card-game overflow-hidden flex flex-col h-full w-full min-h-[44px] ${enterClass} ${outcomeClass}`}
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
