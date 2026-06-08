"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { GameCover } from "@/components/GameCover";
import { expansionDuelVoteAction } from "@/app/actions";
import { pairKey, type DuelPair } from "@/lib/duel-pairs";
import { prefersReducedMotion, sleep } from "@/lib/motion";
import { markScrollToErgebnisse } from "@/lib/scroll-ergebnisse";

const VOTE_ANIMATION_MS = 400;

export type ExpansionDuellChoice = {
  voteGameId: number;
  label: string;
  thumbnail: string | null;
  image: string | null;
};

function ConfigChoiceCard({
  choice,
  disabled,
  side,
  outcome,
  onClick,
}: {
  choice: ExpansionDuellChoice;
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
          src={choice.thumbnail ?? choice.image}
          alt={choice.label}
          className="h-full w-full min-h-[8rem] object-cover card-game-cover sm:aspect-square sm:min-h-0"
        />
      </div>
      <span className="p-2 sm:p-3 font-bold text-sm sm:text-base text-center leading-tight line-clamp-3 shrink-0">
        {choice.label}
      </span>
    </button>
  );
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
    >
      <div
        className={`progress-bar-fill ${isFull ? "bg-[var(--accent)]" : ""}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function ExpansionDuellClient({
  meetupId,
  expected,
  winnerName,
  choices,
  myPairs,
  totalPairs,
  decidedPairs,
  initialCompletedKeys,
}: {
  meetupId: string;
  expected: number;
  winnerName: string;
  choices: ExpansionDuellChoice[];
  myPairs: DuelPair[];
  totalPairs: number;
  decidedPairs: number;
  initialCompletedKeys: string[];
}) {
  const choiceMap = useMemo(
    () => new Map(choices.map((c) => [c.voteGameId, c])),
    [choices],
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
    () => myPairs.filter((p) => !completed.has(pairKey(p.a, p.b))),
    [myPairs, completed],
  );

  const myDone = myPairs.length - pendingPairs.length;
  const finished = pendingPairs.length === 0;
  const current = pendingPairs[0] ?? null;

  const choiceA = current ? choiceMap.get(current.a) : null;
  const choiceB = current ? choiceMap.get(current.b) : null;

  function outcomeFor(voteGameId: number): "winner" | "loser" | undefined {
    if (!voteOutcome) return undefined;
    if (voteOutcome.winnerId === voteGameId) return "winner";
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
        expansionDuelVoteAction(meetupId, winnerId, loserId, expected),
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
        <p className="text-lg font-bold">Erweiterungs-Duelle erledigt!</p>
        <p className="text-sm text-[var(--muted)]">
          {winnerName} · {expected} Spieler ★
        </p>
        <DuelProgressBar done={myDone} total={myPairs.length} complete />
        <Link
          href={`/meetups/${meetupId}`}
          scroll={false}
          onClick={() => markScrollToErgebnisse()}
          className="btn btn-primary btn-lg w-full max-w-sm"
        >
          Zum Ergebnis
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
          <span className="chip chip-accent">Erweiterung · {expected} ★</span>
          <span className="text-sm font-semibold tabular-nums">
            {myDone + 1} / {myPairs.length}
          </span>
        </div>
        <DuelProgressBar done={myDone} total={myPairs.length} />
        <p className="text-xs text-[var(--muted)] tabular-nums">
          Gruppe: {decidedPairs}/{totalPairs} Vergleiche
        </p>
      </div>

      {voteError && (
        <p className="text-sm text-center text-[var(--accent)]" role="alert">
          {voteError}
        </p>
      )}

      <p className="text-center text-sm text-[var(--muted)]">
        Welche Variante von {winnerName} soll es bei {expected} Spielern sein?
      </p>

      {current && choiceA && choiceB && currentKey ? (
        <div key={currentKey} className="duel-arena -mx-1">
          <div className="duel-arena-grid">
            <ConfigChoiceCard
              choice={choiceA}
              side="left"
              outcome={outcomeFor(choiceA.voteGameId)}
              disabled={busy}
              onClick={() => choose(choiceA.voteGameId, choiceB.voteGameId)}
            />
            <div className="hidden sm:flex items-center justify-center self-center">
              <span className={`duel-vs-badge ${vsPulseClass}`} aria-hidden>
                VS
              </span>
            </div>
            <ConfigChoiceCard
              choice={choiceB}
              side="right"
              outcome={outcomeFor(choiceB.voteGameId)}
              disabled={busy}
              onClick={() => choose(choiceB.voteGameId, choiceA.voteGameId)}
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
          Konfigurationsdaten fehlen.
        </p>
      )}

      <div className="sticky-above-nav -mx-4 px-4 py-3 mt-2 bg-[var(--background)] border-t border-[var(--border)] flex justify-center sm:static sm:border-0 sm:mx-0 sm:px-0 sm:mt-0">
        <Link
          href={`/meetups/${meetupId}`}
          className="btn btn-ghost w-full sm:w-auto text-center"
        >
          Zurück zum Treffen
        </Link>
      </div>
    </div>
  );
}
