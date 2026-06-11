"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  DuelArena,
  DuelChoiceCard,
  DuelFinishedCard,
  DuelStickyBar,
  DuelStickyFooter,
  DuelVoteError,
} from "@/components/DuelArena";
import { expansionDuelVoteAction } from "@/app/actions";
import { pairKey, type DuelPair } from "@/lib/duel-pairs";
import { useDuelVoting } from "@/lib/use-duel-voting";
import { resolveCoverSrc } from "@/lib/cover-image";

export type ExpansionDuellChoice = {
  voteGameId: number;
  label: string;
  thumbnail: string | null;
  image: string | null;
  coverUrl?: string | null;
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
      <DuelFinishedCard
        meetupId={meetupId}
        title="Erweiterungs-Duelle erledigt!"
        meta={
          <>
            {winnerName} · {expected} Spieler ★
          </>
        }
        done={myDone}
        total={myPairs.length}
      />
    );
  }

  const currentKey = current ? pairKey(current.a, current.b) : null;

  return (
    <div className="flex flex-col gap-3">
      <DuelStickyBar
        chipLabel={`Erweiterung · ${expected} ★`}
        done={myDone}
        total={myPairs.length}
        meta={
          <p className="text-xs text-[var(--muted)] tabular-nums">
            Gruppe: {decidedPairs}/{totalPairs} Vergleiche
          </p>
        }
      />

      <DuelVoteError error={voteError} />

      <p className="text-center text-sm text-[var(--muted)]">
        Welche Variante von {winnerName} soll es bei {expected} Spielern sein?
      </p>

      {current && choiceA && choiceB && currentKey ? (
        <DuelArena
          key={currentKey}
          busy={busy}
          left={
            <DuelChoiceCard
              coverSrc={resolveCoverSrc(choiceA)}
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
              coverSrc={resolveCoverSrc(choiceB)}
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

      <DuelStickyFooter>
        <Link
          href={`/meetups/${meetupId}`}
          className="btn btn-ghost w-full sm:w-auto text-center"
        >
          Zurück zum Treffen
        </Link>
      </DuelStickyFooter>
    </div>
  );
}
