"use client";

import { useMemo } from "react";
import {
  DuelArena,
  DuelChoiceCard,
  DuelFinishedCard,
  DuelRankingLink,
  DuelStickyBar,
  DuelStickyFooter,
  DuelVoteError,
} from "@/components/DuelArena";
import { duelVoteAction } from "@/app/actions";
import { pairKey, type DuelPair, type DuelPhase } from "@/lib/duel-pairs";
import { groupProgressText } from "@/lib/duel-progress";
import { useDuelVoting } from "@/lib/use-duel-voting";
import { resolveCoverSrc } from "@/lib/cover-image";

export interface DuellGame {
  id: number;
  name: string;
  thumbnail: string | null;
  image: string | null;
  coverUrl?: string | null;
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
      <DuelFinishedCard
        meetupId={meetupId}
        title="Deine Duelle sind erledigt!"
        meta={
          <>
            Duell {myDone} von {myPairs.length} · {expected} Spieler ★
          </>
        }
        done={myDone}
        total={myPairs.length}
        extra={
          isHost ? (
            <p className="text-[var(--muted)] text-sm">{progressLabel}</p>
          ) : undefined
        }
      />
    );
  }

  const currentKey = current ? pairKey(current.a, current.b) : null;

  return (
    <div className="flex flex-col gap-3">
      <DuelStickyBar
        chipLabel={`${expected} Spieler ★`}
        done={myDone}
        total={myPairs.length}
        meta={
          isHost ? (
            <p className="text-xs text-[var(--muted)] tabular-nums">
              {progressLabel}
            </p>
          ) : undefined
        }
      />

      <DuelVoteError error={voteError} />

      <p className="text-center text-sm text-[var(--muted)]">
        Was möchtest du lieber mit {expected} Spielern spielen?
      </p>

      {current && gameA && gameB && currentKey ? (
        <DuelArena
          key={currentKey}
          busy={busy}
          left={
            <DuelChoiceCard
              coverSrc={resolveCoverSrc(gameA)}
              label={gameA.name}
              side="left"
              outcome={outcomeFor(gameA.id)}
              disabled={busy}
              onClick={() => choose(gameA.id, current.b)}
            />
          }
          right={
            <DuelChoiceCard
              coverSrc={resolveCoverSrc(gameB)}
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

      <DuelStickyFooter>
        <DuelRankingLink
          meetupId={meetupId}
          className="btn btn-primary w-full sm:w-auto text-center"
        />
      </DuelStickyFooter>
    </div>
  );
}
