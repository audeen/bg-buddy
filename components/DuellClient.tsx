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
      <div className="card p-6 flex flex-col items-center gap-3 text-center">
        <p className="text-lg font-bold">Duelle fertig!</p>
        <p className="text-[var(--muted)] text-sm">
          {duelsDone} von {DUEL_ROUND_COUNT} Duelle unter den gepickten Spielen
          für {expected} Spieler ★.
        </p>
        <div className="flex flex-wrap gap-2 justify-center">
          <Link href={`/meetups/${meetupId}`} className="btn btn-primary">
            Zum Ranking
          </Link>
          <Link href={`/meetups/${meetupId}/pick`} className="btn btn-ghost">
            Direkt-Picks
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-[var(--muted)]">
        {DUEL_ROUND_COUNT} Duelle nur unter{" "}
        <strong>{games.length} gepickten Spielen</strong> — häufiger gepickte
        treten öfter auf (Pick-Bonus). Max. {MAX_DUEL_WINS_PER_GAME} Sieg pro
        Spiel.
      </p>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="chip">{expected} Spieler ★</span>
        <span className="text-sm text-[var(--muted)]">
          Duell {duelsDone + 1} / {DUEL_ROUND_COUNT}
        </span>
      </div>

      {voteError && (
        <p className="text-sm text-center text-[var(--accent)]" role="alert">
          {voteError}
        </p>
      )}

      <p className="text-center text-sm text-[var(--muted)]">
        Welches würdest du mit {expected} Spielern lieber spielen?
      </p>

      {pair ? (
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-4 items-center">
          {[pair[0], pair[1]].map((g, idx) => (
            <div key={g.id} className="contents">
              {idx === 1 && (
                <div className="hidden sm:flex items-center justify-center font-extrabold text-[var(--muted)]">
                  VS
                </div>
              )}
              <button
                type="button"
                disabled={busy || wonIds.has(g.id)}
                onClick={() => choose(g.id)}
                className="card overflow-hidden flex flex-col hover:shadow-lg hover:ring-2 hover:ring-[var(--primary)] transition-all disabled:opacity-60"
              >
                <GameCover
                  src={g.thumbnail ?? g.image}
                  alt={g.name}
                  className="w-full aspect-square"
                />
                <span className="p-3 font-bold text-center leading-tight">
                  {g.name}
                </span>
                {(pickCounts[g.id] ?? 0) > 0 && (
                  <span className="pb-2 text-xs text-[var(--muted)] text-center">
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

      <div className="flex justify-center gap-2 flex-wrap">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={skipDuel}
          disabled={busy}
        >
          Überspringen
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setFinished(true)}
          disabled={busy}
        >
          Fertig ({duelsLeft} übrig)
        </button>
        <Link href={`/meetups/${meetupId}`} className="btn btn-ghost">
          Zum Ranking
        </Link>
      </div>
    </div>
  );
}
