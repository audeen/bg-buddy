"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useMeetupPhaseRefresh } from "@/lib/use-meetup-phase-refresh";
import { startExpansionDuelAction } from "@/app/actions";

export function MeetupExpansionActions({
  meetupId,
  isHost,
  expansionDuelAvailable,
  expansionDuelStarted,
  expansionDuelComplete,
  winnerName,
  expansionResultLabel,
  optionalExpansionCount,
}: {
  meetupId: string;
  isHost: boolean;
  expansionDuelAvailable: boolean;
  expansionDuelStarted: boolean;
  expansionDuelComplete: boolean;
  winnerName: string | null;
  expansionResultLabel: string | null;
  optionalExpansionCount: number;
}) {
  useMeetupPhaseRefresh(true);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!winnerName) return null;

  if (expansionDuelComplete && expansionResultLabel) {
    return (
      <p className="text-sm text-[var(--muted)] border-t border-[var(--border)] pt-4">
        <span className="font-semibold text-[var(--foreground)]">
          {expansionResultLabel}
        </span>{" "}
        — gewählte Variante für {winnerName}
      </p>
    );
  }

  if (expansionDuelStarted) {
    return (
      <div className="flex flex-col gap-2 border-t border-[var(--border)] pt-4">
        <p className="text-sm text-[var(--muted)]">
          Erweiterungs-Abstimmung für{" "}
          <span className="font-semibold text-[var(--foreground)]">
            {winnerName}
          </span>
        </p>
        <Link
          href={`/meetups/${meetupId}/erweiterung`}
          className="btn btn-primary btn-lg w-full sm:w-auto text-center"
        >
          Erweiterungs-Duell
        </Link>
      </div>
    );
  }

  if (!expansionDuelAvailable || optionalExpansionCount === 0) return null;

  if (!isHost) {
    return (
      <p className="text-sm text-[var(--muted)] border-t border-[var(--border)] pt-4">
        {winnerName} hat {optionalExpansionCount} optionale Erweiterung
        {optionalExpansionCount === 1 ? "" : "en"} — der Host kann die
        Erweiterungs-Abstimmung starten.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2 border-t border-[var(--border)] pt-4">
      <p className="text-sm text-[var(--muted)]">
        {winnerName} gewann — {optionalExpansionCount} optionale Erweiterung
        {optionalExpansionCount === 1 ? "" : "en"} in der Sammlung.
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const res = await startExpansionDuelAction(meetupId);
            if (res && "error" in res && res.error) setError(res.error);
          });
        }}
        className="btn btn-primary btn-lg w-full sm:w-auto"
      >
        Über Erweiterungen abstimmen
      </button>
      {error && (
        <p className="text-xs text-[var(--accent)]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
