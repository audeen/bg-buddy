"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  DuelArena,
  DuelChoiceCard,
  DuelProgressBar,
} from "@/components/DuelArena";
import { expansionDuelVoteAction } from "@/app/actions";
import { pairKey, type DuelPair } from "@/lib/duel-pairs";
import { useDuelVoting } from "@/lib/use-duel-voting";
import { markScrollToErgebnisse } from "@/lib/scroll-ergebnisse";

export type ExpansionDuellChoice = {
  voteGameId: number;
  label: string;
  thumbnail: string | null;
  image: string | null;
};

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

  const { busy, voteError, myDone, finished, current, outcomeFor, choose } =
    useDuelVoting({
      myPairs,
      initialCompletedKeys,
      vote: (winnerId, loserId) =>
        expansionDuelVoteAction(meetupId, winnerId, loserId, expected),
    });

  const choiceA = current ? choiceMap.get(current.a) : null;
  const choiceB = current ? choiceMap.get(current.b) : null;

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
        <DuelArena
          key={currentKey}
          busy={busy}
          left={
            <DuelChoiceCard
              coverSrc={choiceA.thumbnail ?? choiceA.image}
              label={choiceA.label}
              labelLines={3}
              side="left"
              outcome={outcomeFor(choiceA.voteGameId)}
              disabled={busy}
              onClick={() => choose(choiceA.voteGameId, choiceB.voteGameId)}
            />
          }
          right={
            <DuelChoiceCard
              coverSrc={choiceB.thumbnail ?? choiceB.image}
              label={choiceB.label}
              labelLines={3}
              side="right"
              outcome={outcomeFor(choiceB.voteGameId)}
              disabled={busy}
              onClick={() => choose(choiceB.voteGameId, choiceA.voteGameId)}
            />
          }
        />
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
