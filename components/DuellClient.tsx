"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  DuelArena,
  DuelChoiceCard,
  DuelProgressBar,
} from "@/components/DuelArena";
import { duelVoteAction } from "@/app/actions";
import { pairKey, type DuelPair, type DuelPhase } from "@/lib/duel-pairs";
import { groupProgressText } from "@/lib/duel-progress";
import { useDuelVoting } from "@/lib/use-duel-voting";
import { markScrollToErgebnisse } from "@/lib/scroll-ergebnisse";

export interface DuellGame {
  id: number;
  name: string;
  thumbnail: string | null;
  image: string | null;
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

  const { busy, voteError, myDone, finished, current, outcomeFor, choose } =
    useDuelVoting({
      myPairs,
      initialCompletedKeys,
      vote: (winnerId, loserId) =>
        duelVoteAction(meetupId, winnerId, loserId, expected),
    });

  const gameA = current ? gameMap.get(current.a) : null;
  const gameB = current ? gameMap.get(current.b) : null;

  const progressLabel = groupProgressText(
    phase,
    groupDecidedPairs,
    totalPairs,
    finishedParticipants,
    totalParticipants,
  );

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
          <DuelProgressBar done={myDone} total={myPairs.length} complete />
        </div>
        {isHost && (
          <p className="text-[var(--muted)] text-sm">{progressLabel}</p>
        )}
        <Link
          href={`/meetups/${meetupId}`}
          scroll={false}
          onClick={() => markScrollToErgebnisse()}
          className="btn btn-primary btn-lg w-full max-w-sm"
        >
          Zum Ranking
        </Link>
      </div>
    );
  }

  const currentKey = current ? pairKey(current.a, current.b) : null;

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
        <DuelArena
          key={currentKey}
          busy={busy}
          left={
            <DuelChoiceCard
              coverSrc={gameA.thumbnail ?? gameA.image}
              label={gameA.name}
              side="left"
              outcome={outcomeFor(gameA.id)}
              disabled={busy}
              onClick={() => choose(gameA.id, current.b)}
            />
          }
          right={
            <DuelChoiceCard
              coverSrc={gameB.thumbnail ?? gameB.image}
              label={gameB.name}
              side="right"
              outcome={outcomeFor(gameB.id)}
              disabled={busy}
              onClick={() => choose(gameB.id, current.a)}
            />
          }
        />
      ) : (
        <p className="text-center text-[var(--muted)]">
          Spieldaten für dieses Paar fehlen.
        </p>
      )}

      <div className="sticky-above-nav -mx-4 px-4 py-3 mt-2 bg-[var(--background)] border-t border-[var(--border)] flex justify-center sm:static sm:border-0 sm:mx-0 sm:px-0 sm:mt-0">
        <Link
          href={`/meetups/${meetupId}`}
          scroll={false}
          onClick={() => markScrollToErgebnisse()}
          className="btn btn-primary w-full sm:w-auto text-center"
        >
          Zum Ranking
        </Link>
      </div>
    </div>
  );
}
