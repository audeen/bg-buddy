"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { GameCover } from "@/components/GameCover";
import { duelVoteAction } from "@/app/actions";
import { DUEL_ROUND_COUNT, MAX_DUEL_WINS_PER_GAME } from "@/lib/vote-limits";

export interface DuellGame {
  id: number;
  name: string;
  thumbnail: string | null;
  image: string | null;
}

function pickTwoWeighted(
  list: DuellGame[],
  pickCounts: Record<number, number>,
  wonIds: Set<number>,
): [DuellGame, DuellGame] | null {
  const prefer = list.filter((g) => !wonIds.has(g.id));
  const pool = prefer.length >= 2 ? prefer : list;
  if (pool.length < 2) return null;

  const pickOne = (): DuellGame => {
    const weights = pool.map((g) => pickCounts[g.id] ?? 1);
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < pool.length; i++) {
      r -= weights[i];
      if (r <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  };

  const first = pickOne();
  const rest = pool.filter((g) => g.id !== first.id);
  const weights = rest.map((g) => pickCounts[g.id] ?? 1);
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  let second = rest[rest.length - 1];
  for (let i = 0; i < rest.length; i++) {
    r -= weights[i];
    if (r <= 0) {
      second = rest[i];
      break;
    }
  }
  return [first, second];
}

function winsAtExpected(
  votes: { gameId: number; playerCount: number }[],
  expected: number,
): { wonIds: Set<number>; duelsDone: number } {
  const wonIds = new Set<number>();
  let duelsDone = 0;
  for (const v of votes) {
    if (v.playerCount !== expected) continue;
    duelsDone++;
    wonIds.add(v.gameId);
  }
  return { wonIds, duelsDone };
}

export function DuellClient({
  meetupId,
  expected,
  games,
  pickCounts,
  initialDuelWins = [],
}: {
  meetupId: string;
  expected: number;
  games: DuellGame[];
  pickCounts: Record<number, number>;
  initialDuelWins?: { gameId: number; playerCount: number }[];
}) {
  const resume = useMemo(
    () => winsAtExpected(initialDuelWins, expected),
    [initialDuelWins, expected],
  );

  const [wonIds, setWonIds] = useState(() => new Set(resume.wonIds));
  const [duelsDone, setDuelsDone] = useState(resume.duelsDone);
  const [seed, setSeed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [finished, setFinished] = useState(
    resume.duelsDone >= DUEL_ROUND_COUNT,
  );

  const pair = useMemo(() => {
    if (finished || games.length < 2) return null;
    return pickTwoWeighted(games, pickCounts, wonIds);
  }, [games, pickCounts, wonIds, seed, finished]);

  const duelsLeft = Math.max(0, DUEL_ROUND_COUNT - duelsDone);

  function nextDuel() {
    setSeed((s) => s + 1);
    setDuelsDone((d) => {
      const next = d + 1;
      if (next >= DUEL_ROUND_COUNT) setFinished(true);
      return next;
    });
  }

  async function choose(winnerId: number) {
    if (busy || finished || !pair) return;
    setVoteError(null);
    setBusy(true);
    try {
      const res = await duelVoteAction(meetupId, winnerId, expected);
      if (res && "error" in res && res.error) {
        setVoteError(res.error);
        setSeed((s) => s + 1);
        return;
      }
      setWonIds((prev) => new Set(prev).add(winnerId));
      nextDuel();
    } finally {
      setBusy(false);
    }
  }

  function skipDuel() {
    if (finished) return;
    setVoteError(null);
    nextDuel();
  }

  if (finished) {
    return (
      <div className="card flex flex-col items-center gap-3 text-center" style={{ padding: "1.5rem" }}>
        <p className="text-lg font-bold">Duelle fertig!</p>
        <p className="text-[var(--muted)] text-sm">
          {duelsDone} von {DUEL_ROUND_COUNT} Duelle unter den gepickten Spielen
          für {expected} Spieler ★.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center w-full max-w-sm">
          <Link href={`/meetups/${meetupId}`} className="btn btn-primary btn-lg">
            Zum Ranking
          </Link>
          <Link href={`/meetups/${meetupId}/pick`} className="btn btn-ghost btn-lg">
            Direkt-Picks
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky-below-header -mx-1 filter-bar flex items-center justify-between gap-3">
        <span className="chip chip-accent">{expected} Spieler ★</span>
        <span className="text-sm font-semibold tabular-nums">
          Duell {duelsDone + 1} / {DUEL_ROUND_COUNT}
        </span>
      </div>

      <p className="text-sm text-[var(--muted)]">
        {DUEL_ROUND_COUNT} Duelle unter{" "}
        <strong>{games.length} gepickten Spielen</strong> — häufiger gepickte
        treten öfter auf. Max. {MAX_DUEL_WINS_PER_GAME} Sieg pro Spiel.
      </p>

      {voteError && (
        <p className="text-sm text-center text-[var(--accent)]" role="alert">
          {voteError}
        </p>
      )}

      <p className="text-center text-sm text-[var(--muted)]">
        Welches würdest du mit {expected} Spielern lieber spielen?
      </p>

      {pair ? (
        <div className="flex flex-col gap-3 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:gap-4 sm:items-center">
          {[pair[0], pair[1]].map((g, idx) => (
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
                disabled={busy || wonIds.has(g.id)}
                onClick={() => choose(g.id)}
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
                {(pickCounts[g.id] ?? 0) > 0 && (
                  <span className="pb-3 text-xs text-[var(--muted)] text-center">
                    {pickCounts[g.id]} Pick
                    {(pickCounts[g.id] ?? 0) === 1 ? "" : "s"}
                  </span>
                )}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-center text-[var(--muted)]">
          Keine weiteren Paare — alle Spiele haben schon einen Sieg von dir.
        </p>
      )}

      <div className="sticky-above-nav -mx-4 px-4 py-3 mt-2 bg-[var(--background)] border-t border-[var(--border)] flex flex-col gap-2 sm:flex-row sm:justify-center sm:flex-wrap sm:static sm:border-0 sm:mx-0 sm:px-0 sm:mt-0">
        <button
          type="button"
          className="btn btn-ghost w-full sm:w-auto"
          onClick={skipDuel}
          disabled={busy}
        >
          Überspringen
        </button>
        <button
          type="button"
          className="btn btn-ghost w-full sm:w-auto"
          onClick={() => setFinished(true)}
          disabled={busy}
        >
          Fertig ({duelsLeft} übrig)
        </button>
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
