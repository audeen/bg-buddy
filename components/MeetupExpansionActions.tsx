"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useMeetupPhaseRefresh } from "@/lib/use-meetup-phase-refresh";
import { startExpansionDuelAction } from "@/app/actions";
import {
  MeetupMandatoryExpansions,
  type MandatoryExpansionFamily,
} from "@/components/MeetupMandatoryExpansions";

export function MeetupExpansionActions({
  meetupId,
  isHost,
  expansionDuelAvailable,
  expansionDuelStarted,
  expansionDuelComplete,
  winnerName,
  winnerFamily,
  mandatoryKeys,
  optionalExpansionCount,
  winnerHasExpansionsAtStar,
}: {
  meetupId: string;
  isHost: boolean;
  expansionDuelAvailable: boolean;
  expansionDuelStarted: boolean;
  expansionDuelComplete: boolean;
  winnerName: string | null;
  winnerFamily: MandatoryExpansionFamily | null;
  mandatoryKeys: string[];
  optionalExpansionCount: number;
  winnerHasExpansionsAtStar: boolean;
}) {
  useMeetupPhaseRefresh(true);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!winnerName || !winnerHasExpansionsAtStar || !winnerFamily) return null;

  if (expansionDuelComplete) {
    return (
      <p className="text-sm text-[var(--muted)] border-t border-[var(--border)] pt-4">
        Erweiterungs-Abstimmung abgeschlossen — Ergebnis im Varianten-Ranking.
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

  if (!isHost) {
    if (!expansionDuelAvailable) {
      return (
        <p className="text-sm text-[var(--muted)] border-t border-[var(--border)] pt-4">
          {winnerName} — der Host legt Pflicht-Erweiterungen fest. Kein
          Erweiterungs-Duell nötig.
        </p>
      );
    }
    return (
      <p className="text-sm text-[var(--muted)] border-t border-[var(--border)] pt-4">
        {winnerName} hat {optionalExpansionCount} optionale Erweiterung
        {optionalExpansionCount === 1 ? "" : "en"} bei ★ — der Host kann die
        Erweiterungs-Abstimmung starten.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-4">
      <p className="text-sm text-[var(--muted)]">
        <span className="font-semibold text-[var(--foreground)]">
          {winnerName}
        </span>{" "}
        gewann — Erweiterungen bei ★
      </p>

      <MeetupMandatoryExpansions
        meetupId={meetupId}
        family={winnerFamily}
        mandatoryKeys={mandatoryKeys}
      />

      {expansionDuelAvailable ? (
        <>
          <p className="text-xs text-[var(--muted)]">
            {optionalExpansionCount} optionale Erweiterung
            {optionalExpansionCount === 1 ? "" : "en"} zur Abstimmung.
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
        </>
      ) : (
        <p className="text-sm text-[var(--muted)]">
          Kein Erweiterungs-Duell nötig — nur Pflicht-Erweiterungen gelten.
        </p>
      )}
    </div>
  );
}
