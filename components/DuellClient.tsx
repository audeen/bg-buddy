"use client";

import { useMemo, useState } from "react";
import {
  DuelArena,
  DuelChoiceCard,
  DuelFinishedCard,
  DuelRankingLink,
  DuelStickyBar,
  DuelStickyFooter,
  DuelVoteError,
} from "@/components/DuelArena";
import { GameDetailModal } from "@/components/GameDetailModal";
import { duelVoteAction } from "@/app/actions";
import { pairKey, type DuelPair, type DuelPhase } from "@/lib/duel-pairs";
import { groupProgressText } from "@/lib/duel-progress";
import { useDuelVoting } from "@/lib/use-duel-voting";
import { resolveCoverSrc } from "@/lib/cover-image";
import { buildGameTags, chipClassForVariant } from "@/lib/game-tags";
import type { GameDetailData } from "@/lib/types/game";

export type DuellGame = GameDetailData;

/**
 * Kompakte Chip-Auswahl für eine Duell-Karte: Best-Fit zuerst, dann die
 * wichtigsten Meta-Chips (Spieleranzahl/Zeit/Komplexität). Bewusst auf max. 3
 * begrenzt, damit die zwei Karten auf Mobile nicht in die Höhe wachsen.
 */
function DuelCardChips({
  game,
  expected,
}: {
  game: GameDetailData;
  expected: number;
}) {
  const tags = buildGameTags(game, { playerCount: expected });
  const accent = tags.filter((t) => t.variant === "accent");
  const meta = tags.filter((t) => t.variant === "meta");
  const chosen = [...accent, ...meta].slice(0, 3);
  if (chosen.length === 0) return null;
  return (
    <>
      {chosen.map((tag) => (
        <span key={tag.label} className={chipClassForVariant(tag.variant)}>
          {tag.label}
        </span>
      ))}
    </>
  );
}

export function DuellClient({
  meetupId,
  roundId,
  roundQuery = "",
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
  roundId: string;
  roundQuery?: string;
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

  const [detailGame, setDetailGame] = useState<GameDetailData | null>(null);

  const { busy, voteError, myDone, finished, current, outcomeFor, choose } =
    useDuelVoting({
      myPairs,
      initialCompletedKeys,
      vote: (winnerId, loserId) =>
        duelVoteAction(roundId, winnerId, loserId, expected),
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
        hrefSuffix={roundQuery}
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
              chips={<DuelCardChips game={gameA} expected={expected} />}
              onInfo={() => setDetailGame(gameA)}
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
              chips={<DuelCardChips game={gameB} expected={expected} />}
              onInfo={() => setDetailGame(gameB)}
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
          hrefSuffix={roundQuery}
          className="btn btn-primary w-full sm:w-auto text-center"
        />
      </DuelStickyFooter>

      <GameDetailModal
        game={detailGame}
        onClose={() => setDetailGame(null)}
        playerCount={expected}
      />
    </div>
  );
}
