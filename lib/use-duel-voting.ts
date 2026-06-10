"use client";

import { useMemo, useState } from "react";
import { pairKey, type DuelPair } from "@/lib/duel-pairs";
import { prefersReducedMotion, sleep } from "@/lib/motion";

const VOTE_ANIMATION_MS = 400;

type VoteResult = { ok?: boolean; error?: string } | { error: string };

/**
 * Gemeinsamer Vote-Flow für Duell-UIs: offene Paare, Busy-/Fehler-Status,
 * Gewinner-Animation und Abstimmen über eine übergebene Server Action.
 */
export function useDuelVoting({
  myPairs,
  initialCompletedKeys,
  vote,
}: {
  myPairs: DuelPair[];
  initialCompletedKeys: string[];
  vote: (winnerId: number, loserId: number) => Promise<VoteResult>;
}) {
  const [completed, setCompleted] = useState(
    () => new Set(initialCompletedKeys),
  );
  const [busy, setBusy] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [voteOutcome, setVoteOutcome] = useState<{ winnerId: number } | null>(
    null,
  );

  const pendingPairs = useMemo(
    () => myPairs.filter((p) => !completed.has(pairKey(p.a, p.b))),
    [myPairs, completed],
  );

  const myDone = myPairs.length - pendingPairs.length;
  const finished = pendingPairs.length === 0;
  const current = pendingPairs[0] ?? null;

  function outcomeFor(gameId: number): "winner" | "loser" | undefined {
    if (!voteOutcome) return undefined;
    if (voteOutcome.winnerId === gameId) return "winner";
    return "loser";
  }

  async function choose(winnerId: number, loserId: number) {
    if (busy || finished || !current) return;
    setVoteError(null);
    setBusy(true);
    setVoteOutcome({ winnerId });

    const key = pairKey(current.a, current.b);
    const animationMs = prefersReducedMotion() ? 0 : VOTE_ANIMATION_MS;

    try {
      const [res] = await Promise.all([
        vote(winnerId, loserId),
        sleep(animationMs),
      ]);
      if (!res || !("ok" in res) || !res.ok) {
        setVoteError(
          res && "error" in res && res.error
            ? res.error
            : "Abstimmung fehlgeschlagen. Bitte erneut versuchen.",
        );
        setVoteOutcome(null);
        return;
      }
      setVoteOutcome(null);
      setCompleted((prev) => new Set(prev).add(key));
    } finally {
      setBusy(false);
    }
  }

  return {
    busy,
    voteError,
    myDone,
    finished,
    current,
    outcomeFor,
    choose,
  };
}
