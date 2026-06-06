"use client";

import Link from "next/link";
import { useMeetupPhaseRefresh } from "@/lib/use-meetup-phase-refresh";
import { MAX_PICK_POINTS } from "@/lib/vote-limits";

export function MeetupVoteActions({
  meetupId,
  readyForDuels,
  picksLocked,
  pickPoolSize,
  fullPickCount,
  expectedPlayerCount,
  poolSize,
  duellLinkTitle,
}: {
  meetupId: string;
  readyForDuels: boolean;
  picksLocked: boolean;
  pickPoolSize: number;
  fullPickCount: number;
  expectedPlayerCount: number;
  poolSize: number;
  duellLinkTitle?: string;
}) {
  useMeetupPhaseRefresh(!picksLocked);

  const duellLinkDisabled = !readyForDuels;

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-2">
        <Link
          href={`/meetups/${meetupId}/pick`}
          className="btn btn-primary btn-lg sm:flex-1"
        >
          Stimmen vergeben
        </Link>
        {duellLinkDisabled ? (
          <span
            className="btn btn-ghost btn-lg sm:flex-1 opacity-60 cursor-not-allowed text-center"
            title={duellLinkTitle}
            aria-disabled
          >
            Duell-Modus
            {pickPoolSize >= 2
              ? ` (${pickPoolSize}) · ${fullPickCount}/${expectedPlayerCount}`
              : ""}
          </span>
        ) : (
          <Link
            href={`/meetups/${meetupId}/duell`}
            className="btn btn-ghost btn-lg sm:flex-1"
          >
            Duell-Modus
            {pickPoolSize >= 2 ? ` (${pickPoolSize})` : ""}
          </Link>
        )}
      </div>
      {!readyForDuels && poolSize >= 2 && (
        <p className="text-xs text-[var(--muted)]">
          Duell-Modus ab {expectedPlayerCount} Spielern mit {MAX_PICK_POINTS}/
          {MAX_PICK_POINTS} Stimmen bei ★ — aktuell {fullPickCount}/
          {expectedPlayerCount}.
        </p>
      )}
      {picksLocked && (
        <p className="text-xs text-[var(--muted)]">
          Stimmen bei ★ sind gesperrt — Duelle laufen.
        </p>
      )}
    </>
  );
}
