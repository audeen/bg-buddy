"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { GameCover } from "@/components/GameCover";
import { duelVoteAction } from "@/app/actions";
import { pairKey, type DuelPair, type DuelPhase } from "@/lib/duel-pairs";
import { prefersReducedMotion, sleep } from "@/lib/motion";

const VOTE_ANIMATION_MS = 400;

export interface DuellGame {
  id: number;
  name: string;
  thumbnail: string | null;
  image: string | null;
}

function DuelChoiceCard({
  game,
  disabled,
  side,
  outcome,
  onClick,
}: {
  game: DuellGame;
  disabled: boolean;
  side: "left" | "right";
  outcome?: "winner" | "loser";
  onClick: () => void;
}) {
  const enterClass =
    side === "left" ? "duel-card-enter-left" : "duel-card-enter-right";
  const outcomeClass =
    outcome === "winner"
      ? "duel-card-winner"
      : outcome === "loser"
        ? "duel-card-loser"
        : "";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`card card-game overflow-hidden flex flex-col h-full min-h-0 w-full min-h-[44px] ${enterClass} ${outcomeClass}`}
    >
      <div className="relative flex-1 min-h-0 w-full">
        <GameCover
          src={game.thumbnail ?? game.image}
          alt={game.name}
          className="h-full w-full min-h-[8rem] object-cover card-game-cover sm:aspect-square sm:min-h-0"
        />
      </div>
      <span className="p-2 sm:p-3 font-bold text-sm sm:text-base text-center leading-tight line-clamp-2 shrink-0">
        {game.name}
      </span>
    </button>
  );
}

function groupProgressText(
  phase: DuelPhase,
  groupDecidedPairs: number,
  totalPairs: number,
  finishedParticipants: number,
  totalParticipants: number,
): string {
  if (phase === "GROUP") {
    return `Matrix: ${groupDecidedPairs}/${totalPairs} abgestimmt · ${finishedParticipants}/${totalParticipants} Spieler fertig`;
  }
  return `${groupDecidedPairs} / ${totalPairs} mit allen Stimmen`;
}

function DuelProgressBar({
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

export function DuellClient({
  meetupId,
  expected,
  games,
  myPairs,
  phase,
  totalPairs,
  groupDecidedPairs,
  finishedParticipants,
  totalParticipants,
  initialCompletedKeys,
  isHost,
}: {
  meetupId: string;
  expected: number;
  games: DuellGame[];
  myPairs: DuelPair[];
  phase: DuelPhase;
  totalPairs: number;
  groupDecidedPairs: number;
  finishedParticipants: number;
  totalParticipants: number;
  initialCompletedKeys: string[];
  isHost: boolean;
}) {
  const gameMap = useMemo(
    () => new Map(games.map((g) => [g.id, g])),
    [games],
  );

  const [completed, setCompleted] = useState(
    () => new Set(initialCompletedKeys),
  );
  const [busy, setBusy] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [voteOutcome, setVoteOutcome] = useState<{ winnerId: number } | null>(
    null,
  );

  const pendingPairs = useMemo(
    () =>
      myPairs.filter((p) => !completed.has(pairKey(p.a, p.b))),
    [myPairs, completed],
  );

  const myDone = myPairs.length - pendingPairs.length;
  const finished = pendingPairs.length === 0;
  const current = pendingPairs[0] ?? null;

  const gameA = current ? gameMap.get(current.a) : null;
  const gameB = current ? gameMap.get(current.b) : null;

  const progressLabel = groupProgressText(
    phase,
    groupDecidedPairs,
    totalPairs,
    finishedParticipants,
    totalParticipants,
  );

  function outcomeFor(gameId: number): "winner" | "loser" | undefined {
    if (!voteOutcome) return undefined;
    if (voteOutcome.winnerId === gameId) return "winner";
    return "loser";
  }

  async function choose(winnerId: number, loserId: number) {
    if (busy || finished || !current) return;
    setVoteError(null);
    setBusy(true);
    setVoteOutcome({ winnerId });

    const key = pairKey(current.a, current.b);
    const animationMs = prefersReducedMotion() ? 0 : VOTE_ANIMATION_MS;

    try {
      const [res] = await Promise.all([
        duelVoteAction(meetupId, winnerId, loserId, expected),
        sleep(animationMs),
      ]);
      if (!res || !("ok" in res) || !res.ok) {
        setVoteError(
          res && "error" in res && res.error
            ? res.error
            : "Abstimmung fehlgeschlagen. Bitte erneut versuchen.",
        );
        setVoteOutcome(null);
        return;
      }
      setVoteOutcome(null);
      setCompleted((prev) => new Set(prev).add(key));
    } finally {
      setBusy(false);
    }
  }

  if (finished) {
    return (
      <div
        className="card flex flex-col items-center gap-3 text-center"
        style={{ padding: "1.5rem" }}
      >
        <p className="text-lg font-bold">Deine Duelle sind erledigt!</p>
        <div className="w-full max-w-sm flex flex-col gap-2">
          <p className="text-[var(--muted)] text-sm tabular-nums">
            Duell {myDone} von {myPairs.length} · {expected} Spieler ★
          </p>
          <DuelProgressBar
            done={myDone}
            total={myPairs.length}
            complete
          />
        </div>
        {isHost && (
          <p className="text-[var(--muted)] text-sm">{progressLabel}</p>
        )}
        <Link
          href={`/meetups/${meetupId}#ergebnisse`}
          className="btn btn-primary btn-lg w-full max-w-sm"
        >
          Zum Ranking
        </Link>
      </div>
    );
  }

  const currentKey = current ? pairKey(current.a, current.b) : null;
  const vsPulseClass = busy ? "" : "duel-vs-pulse";

  return (
    <div className="flex flex-col gap-3">
      <div className="sticky-below-header -mx-1 filter-bar flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <span className="chip chip-accent">{expected} Spieler ★</span>
          <span className="text-sm font-semibold tabular-nums">
            Duell {myDone + 1} von {myPairs.length}
          </span>
        </div>
        <DuelProgressBar done={myDone} total={myPairs.length} />
        {isHost && (
          <p className="text-xs text-[var(--muted)] tabular-nums">
            {progressLabel}
          </p>
        )}
      </div>

      {voteError && (
        <p className="text-sm text-center text-[var(--accent)]" role="alert">
          {voteError}
        </p>
      )}

      <p className="text-center text-sm text-[var(--muted)]">
        Was möchtest du lieber mit {expected} Spielern spielen?
      </p>

      {current && gameA && gameB && currentKey ? (
        <div key={currentKey} className="duel-arena -mx-1">
          <div className="duel-arena-grid">
            <DuelChoiceCard
              game={gameA}
              side="left"
              outcome={outcomeFor(gameA.id)}
              disabled={busy}
              onClick={() => choose(gameA.id, current.b)}
            />
            <div className="hidden sm:flex items-center justify-center self-center">
              <span
                className={`duel-vs-badge ${vsPulseClass}`}
                aria-hidden
              >
                VS
              </span>
            </div>
            <DuelChoiceCard
              game={gameB}
              side="right"
              outcome={outcomeFor(gameB.id)}
              disabled={busy}
              onClick={() => choose(gameB.id, current.a)}
            />
          </div>
          <span
            className={`duel-vs-badge duel-vs-badge-overlay ${vsPulseClass}`}
            aria-hidden
          >
            VS
          </span>
        </div>
      ) : (
        <p className="text-center text-[var(--muted)]">
          Spieldaten für dieses Paar fehlen.
        </p>
      )}

      <div className="sticky-above-nav -mx-4 px-4 py-3 mt-2 bg-[var(--background)] border-t border-[var(--border)] flex justify-center sm:static sm:border-0 sm:mx-0 sm:px-0 sm:mt-0">
        <Link
          href={`/meetups/${meetupId}#ergebnisse`}
          className="btn btn-primary w-full sm:w-auto text-center"
        >
          Zum Ranking
        </Link>
      </div>
    </div>
  );
}
