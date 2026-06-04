"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { GameCover } from "@/components/GameCover";
import { tinderVoteAction } from "@/app/actions";

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

function pickTwo(list: TinderGame[]): [TinderGame, TinderGame] | null {
  if (list.length < 2) return null;
  const a = Math.floor(Math.random() * list.length);
  let b = Math.floor(Math.random() * list.length);
  while (b === a) b = Math.floor(Math.random() * list.length);
  return [list[a], list[b]];
}

export function TinderClient({
  meetupId,
  expected,
  games,
}: {
  meetupId: string;
  expected: number;
  games: TinderGame[];
}) {
  // Sequence: expected first, then 3,4,5,... upwards (excluding expected),
  // only counts that have at least two eligible games.
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
  // bumping the seed draws a fresh pair; changing the count does so implicitly
  const [seed, setSeed] = useState(0);
  const [rounds, setRounds] = useState(0);
  const [busy, setBusy] = useState(false);

  const currentCount = sequence[seqIndex];

  const eligibleNow = useMemo(
    () => (currentCount ? games.filter((g) => eligible(g, currentCount)) : []),
    [games, currentCount],
  );

  const pair = useMemo(
    () => pickTwo(eligibleNow),
    // seed is an intentional dependency to re-roll the pair on demand
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [eligibleNow, seed],
  );

  const newPair = () => setSeed((s) => s + 1);

  const done = sequence.length === 0 || seqIndex >= sequence.length;

  async function choose(winnerId: number) {
    if (busy || !currentCount) return;
    setBusy(true);
    try {
      await tinderVoteAction(meetupId, winnerId, currentCount);
      setRounds((r) => r + 1);
      newPair();
    } finally {
      setBusy(false);
    }
  }

  function nextCount() {
    setSeqIndex((i) => i + 1);
    setRounds(0);
  }

  if (done) {
    return (
      <div className="card p-6 flex flex-col items-center gap-3 text-center">
        <p className="text-lg font-bold">Alle Runden durchgespielt! 🎉</p>
        <p className="text-[var(--muted)]">
          Schau dir an, welche Spiele vorne liegen.
        </p>
        <Link href={`/meetups/${meetupId}`} className="btn btn-primary">
          Zum Ranking
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="chip">
            {currentCount} Spieler{currentCount === expected ? " ★" : ""}
          </span>
          <span className="text-sm text-[var(--muted)]">
            Runde {seqIndex + 1} / {sequence.length} · {rounds} Wahlen
          </span>
        </div>
        <button type="button" className="btn btn-ghost" onClick={nextCount}>
          Nächste Spieleranzahl →
        </button>
      </div>

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

      <div className="flex justify-center gap-2">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={newPair}
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
