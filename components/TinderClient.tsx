"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { GameCover } from "@/components/GameCover";
import { tinderVoteAction, togglePickVoteAction } from "@/app/actions";
import {
  MAX_EXPOSURE_PER_GAME,
  MAX_PICKS_PER_COUNT,
  MIN_TINDER_ROUNDS_BEFORE_PICK,
  maxTinderRoundsForPool,
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

function poolForPair(
  list: TinderGame[],
  exposure: Map<number, number>,
): TinderGame[] {
  const underCap = list.filter(
    (g) => (exposure.get(g.id) ?? 0) < MAX_EXPOSURE_PER_GAME,
  );
  return underCap.length >= 2 ? underCap : list;
}

function pickTwoFair(
  list: TinderGame[],
  exposure: Map<number, number>,
): [TinderGame, TinderGame] | null {
  const pool = poolForPair(list, exposure);
  if (pool.length < 2) return null;

  const pickOne = (): TinderGame => {
    const weights = pool.map((g) => 1 / (1 + (exposure.get(g.id) ?? 0)));
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
  const weights = rest.map((g) => 1 / (1 + (exposure.get(g.id) ?? 0)));
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

type Phase = "tinder" | "pick";

export function TinderClient({
  meetupId,
  expected,
  games,
  initialPicks = [],
}: {
  meetupId: string;
  expected: number;
  games: TinderGame[];
  initialPicks?: { gameId: number; playerCount: number }[];
}) {
  const sequence = useMemo(() => {
    const maxP = games.reduce((m, g) => Math.max(m, g.maxPlayers ?? 0), 0);
    const raw = [expected, ...Array.from({ length: maxP }, (_, i) => i + 3)];
    const seen = new Set<number>();
    const out: number[] = [];
    for (const n of raw) {
      if (n < 1 || seen.has(n)) continue;
      seen.add(n);
      if (games.filter((g) => eligible(g, n)).length >= 2) out.push(n);
    }
    return out;
  }, [games, expected]);

  const [seqIndex, setSeqIndex] = useState(0);
  const [seed, setSeed] = useState(0);
  const [rounds, setRounds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<Phase>("tinder");
  const exposureRef = useRef<Record<number, Record<number, number>>>({});
  const [sessionWins, setSessionWins] = useState<Record<number, number>>({});
  const [voteError, setVoteError] = useState<string | null>(null);
  const [picks, setPicks] = useState<Set<string>>(
    () => new Set(initialPicks.map((p) => `${p.gameId}:${p.playerCount}`)),
  );
  const [pickLimitMsg, setPickLimitMsg] = useState<string | null>(null);
  const [, startPickTransition] = useTransition();

  const currentCount = sequence[seqIndex];
  const isExpectedRound = currentCount === expected;

  const eligibleNow = useMemo(
    () => (currentCount ? games.filter((g) => eligible(g, currentCount)) : []),
    [games, currentCount],
  );

  const maxRounds = maxTinderRoundsForPool(eligibleNow.length);
  const roundsFull = rounds >= maxRounds;
  const canOfferPick =
    isExpectedRound &&
    phase === "tinder" &&
    (rounds >= MIN_TINDER_ROUNDS_BEFORE_PICK || roundsFull);

  const pair = useMemo(() => {
    if (phase !== "tinder" || !currentCount) return null;
    const raw = exposureRef.current[currentCount];
    const exposure = new Map(
      Object.entries(raw ?? {}).map(([k, v]) => [Number(k), v]),
    );
    return pickTwoFair(eligibleNow, exposure);
  }, [eligibleNow, seed, phase, currentCount]);

  function advancePair(shown: [TinderGame, TinderGame] | null) {
    if (shown && currentCount) {
      const countMap = { ...(exposureRef.current[currentCount] ?? {}) };
      for (const g of shown) {
        countMap[g.id] = (countMap[g.id] ?? 0) + 1;
      }
      exposureRef.current = {
        ...exposureRef.current,
        [currentCount]: countMap,
      };
    }
    setSeed((s) => s + 1);
  }

  const done = sequence.length === 0 || seqIndex >= sequence.length;

  const topFive = useMemo(() => {
    return Object.entries(sessionWins)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => games.find((g) => g.id === Number(id)))
      .filter((g): g is TinderGame => !!g);
  }, [sessionWins, games]);

  const pickCount = useMemo(() => {
    if (!expected) return 0;
    let n = 0;
    for (const key of picks) {
      if (key.endsWith(`:${expected}`)) n++;
    }
    return n;
  }, [picks, expected]);

  const pickAtLimit = pickCount >= MAX_PICKS_PER_COUNT;

  async function choose(winnerId: number) {
    if (busy || !currentCount || phase !== "tinder") return;
    setVoteError(null);
    setBusy(true);
    try {
      const res = await tinderVoteAction(meetupId, winnerId, currentCount);
      if (res && "error" in res && res.error) {
        setVoteError(res.error);
        return;
      }
      setRounds((r) => r + 1);
      if (isExpectedRound) {
        setSessionWins((w) => ({
          ...w,
          [winnerId]: (w[winnerId] ?? 0) + 1,
        }));
      }
      advancePair(pair);
    } finally {
      setBusy(false);
    }
  }

  function advanceAfterCount() {
    setSeqIndex((i) => i + 1);
    setSeed(0);
    setRounds(0);
    setPhase("tinder");
    setVoteError(null);
    setPickLimitMsg(null);
  }

  function goToPickPhase() {
    setPhase("pick");
    setVoteError(null);
  }

  function togglePick(gameId: number) {
    const key = `${gameId}:${expected}`;
    const isOn = picks.has(key);
    if (!isOn && pickAtLimit) {
      setPickLimitMsg(
        `Maximal ${MAX_PICKS_PER_COUNT} Direkt-Picks für diese Spieleranzahl.`,
      );
      return;
    }
    setPickLimitMsg(null);
    setPicks((prev) => {
      const next = new Set(prev);
      if (isOn) next.delete(key);
      else next.add(key);
      return next;
    });
    startPickTransition(async () => {
      const res = await togglePickVoteAction(meetupId, gameId, expected);
      if (res && "error" in res && res.error) {
        setPickLimitMsg(res.error);
        setPicks((prev) => {
          const next = new Set(prev);
          if (isOn) next.add(key);
          else next.delete(key);
          return next;
        });
        return;
      }
      if (res && "voted" in res) {
        setPicks((prev) => {
          const next = new Set(prev);
          if (res.voted) next.add(key);
          else next.delete(key);
          return next;
        });
      }
    });
  }

  if (done) {
    return (
      <div className="card p-6 flex flex-col items-center gap-3 text-center">
        <p className="text-lg font-bold">Alle Runden durchgespielt!</p>
        <p className="text-[var(--muted)]">
          Schau dir an, welche Spiele vorne liegen.
        </p>
        <Link href={`/meetups/${meetupId}`} className="btn btn-primary">
          Zum Ranking
        </Link>
      </div>
    );
  }

  if (phase === "pick" && isExpectedRound) {
    const eligiblePick = games.filter((g) => eligible(g, expected));
    return (
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="chip">
            {expected} Spieler ★ · Direktwahl
          </span>
          <span className="text-sm text-[var(--muted)]">
            {pickCount} / {MAX_PICKS_PER_COUNT} Picks
          </span>
        </div>
        <p className="text-sm text-[var(--muted)]">
          Wähle bis zu {MAX_PICKS_PER_COUNT} Spiele, die du mit der erwarteten
          Spieleranzahl spielen möchtest.
        </p>
        {pickLimitMsg && (
          <p className="text-sm text-[var(--accent)]" role="alert">
            {pickLimitMsg}
          </p>
        )}
        {topFive.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold">
              Deine Tinder-Favoriten
            </span>
            <div className="flex flex-wrap gap-2">
              {topFive.map((g) => {
                const on = picks.has(`${g.id}:${expected}`);
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => togglePick(g.id)}
                    disabled={!on && pickAtLimit}
                    className={`btn ${on ? "btn-primary" : "btn-ghost"} text-sm`}
                  >
                    {g.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <ul className="grid gap-3 grid-cols-2 sm:grid-cols-3">
          {eligiblePick.map((g) => {
            const on = picks.has(`${g.id}:${expected}`);
            return (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={() => togglePick(g.id)}
                  disabled={!on && pickAtLimit}
                  className={`card overflow-hidden flex flex-col w-full text-left ${
                    on ? "ring-2 ring-[var(--accent)]" : ""
                  } ${!on && pickAtLimit ? "opacity-50" : "hover:shadow-md"}`}
                >
                  <GameCover
                    src={g.thumbnail ?? g.image}
                    alt={g.name}
                    className="w-full aspect-square"
                  />
                  <span className="p-2 text-sm font-semibold leading-tight line-clamp-2">
                    {g.name}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex justify-center gap-2 flex-wrap">
          <button
            type="button"
            className="btn btn-primary"
            onClick={advanceAfterCount}
          >
            Weiter zur nächsten Spieleranzahl →
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={advanceAfterCount}
          >
            Überspringen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="chip">
            {currentCount} Spieler{currentCount === expected ? " ★" : ""}
          </span>
          <span className="text-sm text-[var(--muted)]">
            Runde {seqIndex + 1} / {sequence.length} · Wahl {rounds} /{" "}
            {maxRounds}
          </span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canOfferPick && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={goToPickPhase}
            >
              Zu Direktwahl →
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={advanceAfterCount}>
            Nächste Spieleranzahl →
          </button>
        </div>
      </div>

      {roundsFull && (
        <p className="text-sm text-center text-[var(--accent)]">
          Rundenlimit erreicht — Direktwahl oder nächste Spieleranzahl.
        </p>
      )}
      {voteError && (
        <p className="text-sm text-center text-[var(--accent)]" role="alert">
          {voteError}
        </p>
      )}

      <p className="text-center text-sm text-[var(--muted)]">
        Welches Spiel würdest du mit {currentCount} Spielern lieber spielen?
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
                disabled={busy}
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
          Nicht genug Spiele für {currentCount} Spieler.
        </p>
      )}

      <div className="flex justify-center gap-2 flex-wrap">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => advancePair(pair)}
          disabled={busy || !pair}
        >
          Anderes Paar zeigen
        </button>
        <Link href={`/meetups/${meetupId}`} className="btn btn-ghost">
          Fertig / Ranking
        </Link>
      </div>
    </div>
  );
}
