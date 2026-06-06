"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { GameCover } from "@/components/GameCover";
import { duelVoteAction } from "@/app/actions";
import { pairKey, type DuelPair, type DuelPhase } from "@/lib/duel-pairs";

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
  initialCompletedKeys,
}: {
  meetupId: string;
  expected: number;
  games: DuellGame[];
  myPairs: DuelPair[];
  phase: DuelPhase;
  totalPairs: number;
  groupDecidedPairs: number;
  initialCompletedKeys: string[];
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

  async function choose(winnerId: number, loserId: number) {
    if (busy || finished || !current) return;
    setVoteError(null);
    setBusy(true);
    const key = pairKey(current.a, current.b);
    try {
      const res = await duelVoteAction(
        meetupId,
        winnerId,
        loserId,
        expected,
      );
      if (res && "error" in res && res.error) {
        setVoteError(res.error);
        return;
      }
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
        <p className="text-[var(--muted)] text-sm">
          Du hast alle {myDone} Vergleiche für {expected} Spieler ★ abgeschlossen.
        </p>
        {phase === "GROUP" && (
          <p className="text-[var(--muted)] text-sm">
            In der Gruppe sind {groupDecidedPairs} von {totalPairs} Vergleichen
            entschieden.
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-2 justify-center w-full max-w-sm">
          <Link
            href={`/meetups/${meetupId}`}
            className="btn btn-primary btn-lg"
          >
            Zum Ranking
          </Link>
          <Link
            href={`/meetups/${meetupId}/pick`}
            className="btn btn-ghost btn-lg"
          >
            Stimmen
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky-below-header -mx-1 filter-bar flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <span className="chip chip-accent">{expected} Spieler ★</span>
          <span className="text-sm font-semibold tabular-nums">
            Duell {myDone + 1} / {myPairs.length}
          </span>
        </div>
        {phase === "GROUP" && (
          <p className="text-xs text-[var(--muted)] tabular-nums">
            {groupDecidedPairs} / {totalPairs} entschieden
          </p>
        )}
      </div>

      {voteError && (
        <p className="text-sm text-center text-[var(--accent)]" role="alert">
          {voteError}
        </p>
      )}

      <p className="text-center text-sm text-[var(--muted)]">
        Welches würdest du mit {expected} Spielern lieber spielen?
      </p>

      {current && gameA && gameB ? (
        <div className="flex flex-col gap-3 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:gap-4 sm:items-center">
          {[gameA, gameB].map((g, idx) => (
            <div key={g.id} className="flex flex-col gap-3 sm:contents">
              {idx === 1 && (
                <>
                  <div className="flex items-center justify-center font-extrabold text-[var(--muted)] sm:hidden py-1">
                    oder
                  </div>
                  <div className="hidden sm:flex items-center justify-center font-extrabold text-[var(--muted)]">
                    VS
                  </div>
                </>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  choose(
                    g.id,
                    g.id === current.a ? current.b : current.a,
                  )
                }
                className="card card-game overflow-hidden flex flex-col w-full disabled:opacity-60 min-h-[44px]"
              >
                <GameCover
                  src={g.thumbnail ?? g.image}
                  alt={g.name}
                  className="w-full aspect-[4/3] sm:aspect-square card-game-cover"
                />
                <span className="p-3 font-bold text-base text-center leading-tight">
                  {g.name}
                </span>
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-center text-[var(--muted)]">
          Spieldaten für dieses Paar fehlen.
        </p>
      )}

      <div className="sticky-above-nav -mx-4 px-4 py-3 mt-2 bg-[var(--background)] border-t border-[var(--border)] flex justify-center sm:static sm:border-0 sm:mx-0 sm:px-0 sm:mt-0">
        <Link
          href={`/meetups/${meetupId}`}
          className="btn btn-primary w-full sm:w-auto text-center"
        >
          Zum Ranking
        </Link>
      </div>
    </div>
  );
}
