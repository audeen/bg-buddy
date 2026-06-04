"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { GameCover } from "@/components/GameCover";
import { tinderVoteAction } from "@/app/actions";
import {
  MAX_TINDER_WINS_PER_GAME,
  TINDER_DUEL_COUNT,
} from "@/lib/vote-limits";

export interface TinderGame {
  id: number;
  name: string;
  thumbnail: string | null;
  image: string | null;
  minPlayers: number | null;
  maxPlayers: number | null;
}

function eligible(g: TinderGame, n: number): boolean {
  const min = g.minPlayers ?? 1;
  const max = g.maxPlayers ?? 99;
  return min <= n && n <= max;
}

function pickTwoRandom(
  list: TinderGame[],
  wonIds: Set<number>,
): [TinderGame, TinderGame] | null {
  const prefer = list.filter((g) => !wonIds.has(g.id));
  const pool = prefer.length >= 2 ? prefer : list;
  if (pool.length < 2) return null;

  const a = Math.floor(Math.random() * pool.length);
  let b = Math.floor(Math.random() * pool.length);
  while (b === a) b = Math.floor(Math.random() * pool.length);
  return [pool[a], pool[b]];
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

export function TinderClient({
  meetupId,
  expected,
  games,
  initialTinderWins = [],
}: {
  meetupId: string;
  expected: number;
  games: TinderGame[];
  initialTinderWins?: { gameId: number; playerCount: number }[];
}) {
  const resume = useMemo(
    () => winsAtExpected(initialTinderWins, expected),
    [initialTinderWins, expected],
  );

  const [wonIds, setWonIds] = useState(() => new Set(resume.wonIds));
  const [duelsDone, setDuelsDone] = useState(resume.duelsDone);
  const [seed, setSeed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [finished, setFinished] = useState(
    resume.duelsDone >= TINDER_DUEL_COUNT,
  );

  const eligibleNow = useMemo(
    () => games.filter((g) => eligible(g, expected)),
    [games, expected],
  );

  const pair = useMemo(() => {
    if (finished || eligibleNow.length < 2) return null;
    return pickTwoRandom(eligibleNow, wonIds);
  }, [eligibleNow, wonIds, seed, finished]);

  const duelsLeft = Math.max(0, TINDER_DUEL_COUNT - duelsDone);

  function nextDuel() {
    setSeed((s) => s + 1);
    setDuelsDone((d) => {
      const next = d + 1;
      if (next >= TINDER_DUEL_COUNT) setFinished(true);
      return next;
    });
  }

  async function choose(winnerId: number) {
    if (busy || finished || !pair) return;
    setVoteError(null);
    setBusy(true);
    try {
      const res = await tinderVoteAction(meetupId, winnerId, expected);
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

  if (eligibleNow.length < 2) {
    return (
      <div className="card p-6 flex flex-col items-center gap-3 text-center">
        <p className="text-lg font-bold">Zu wenig Spiele für {expected} Spieler</p>
        <p className="text-[var(--muted)] text-sm">
          Mindestens zwei Spiele in der Sammlung nötig — oder Direkt-Picks nutzen.
        </p>
        <Link href={`/meetups/${meetupId}/pick`} className="btn btn-primary">
          Direkt wählen
        </Link>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="card p-6 flex flex-col items-center gap-3 text-center">
        <p className="text-lg font-bold">Duelle fertig!</p>
        <p className="text-[var(--muted)] text-sm">
          {duelsDone} von {TINDER_DUEL_COUNT} Duelle für {expected} Spieler ★.
          Setze jetzt bis zu 3 Direkt-Picks.
        </p>
        <div className="flex flex-wrap gap-2 justify-center">
          <Link
            href={`/meetups/${meetupId}/pick`}
            className="btn btn-primary"
          >
            Jetzt Direkt-Picks setzen
          </Link>
          <Link href={`/meetups/${meetupId}`} className="btn btn-ghost">
            Zum Ranking
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-[var(--muted)]">
        {TINDER_DUEL_COUNT} kurze Duelle für {expected} Spieler ★ — danach deine
        Top 3 per Direkt-Pick. Max. {MAX_TINDER_WINS_PER_GAME} Sieg pro Spiel.
      </p>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="chip">{expected} Spieler ★</span>
        <span className="text-sm text-[var(--muted)]">
          Duell {duelsDone + 1} / {TINDER_DUEL_COUNT}
        </span>
      </div>

      {voteError && (
        <p className="text-sm text-center text-[var(--accent)]" role="alert">
          {voteError}
        </p>
      )}

      <p className="text-center text-sm text-[var(--muted)]">
        Welches Spiel würdest du mit {expected} Spielern lieber spielen?
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
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-center text-[var(--muted)]">
          Keine weiteren Paare — alle verfügbaren Spiele haben schon einen Sieg.
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
        <Link href={`/meetups/${meetupId}/pick`} className="btn btn-ghost">
          Direkt-Picks
        </Link>
      </div>
    </div>
  );
}
