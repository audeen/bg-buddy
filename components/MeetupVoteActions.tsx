"use client";

import Link from "next/link";
import type { HostChoiceMode } from "@prisma/client";
import { HostForcedGameBanner } from "@/components/HostForcedGameBanner";
import { useMeetupPhaseRefresh } from "@/lib/use-meetup-phase-refresh";
import { MAX_PICK_POINTS } from "@/lib/vote-limits";

export function MeetupVoteActions({
  meetupId,
  readyForDuels,
  picksLocked,
  duelComplete,
  pickPoolSize,
  fullPickCount,
  expectedPlayerCount,
  poolSize,
  duellLinkTitle,
  hostForced = false,
  hostForcedGameName = null,
  hostChoiceMode = "NONE",
}: {
  meetupId: string;
  readyForDuels: boolean;
  picksLocked: boolean;
  duelComplete: boolean;
  pickPoolSize: number;
  fullPickCount: number;
  expectedPlayerCount: number;
  poolSize: number;
  duellLinkTitle?: string;
  hostForced?: boolean;
  hostForcedGameName?: string | null;
  hostChoiceMode?: HostChoiceMode;
}) {
  useMeetupPhaseRefresh(true);

  const duellLinkDisabled = !readyForDuels || duelComplete;

  if (hostForced && hostForcedGameName) {
    return (
      <HostForcedGameBanner
        gameName={hostForcedGameName}
        description="Keine Abstimmung — das Spiel steht fest."
      />
    );
  }

  return (
    <>
      {hostChoiceMode === "RESTRICT" && (
        <p className="text-xs text-[var(--muted)] rounded-lg border border-[var(--border)] px-3 py-2">
          Nur Host-Vorauswahl wählbar — auf der Pick-Seite sind nur die vom
          Host ausgewählten Spiele verfügbar.
        </p>
      )}
      {hostChoiceMode === "HIGHLIGHT" && (
        <p className="text-xs text-[var(--muted)] rounded-lg border border-[var(--border)] px-3 py-2">
          Host-Empfehlungen sind auf der Pick-Seite oben hervorgehoben.
        </p>
      )}
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
      {picksLocked && (
        <p className="text-xs text-[var(--muted)]">
          ★-Stimmen gesperrt — Duelle laufen. Andere Spielerzahlen weiter über
          Stimmen vergeben bearbeitbar.
        </p>
      )}
      {!readyForDuels && !picksLocked && poolSize >= 2 && (
        <p className="text-xs text-[var(--muted)]">
          Duell-Modus ab {expectedPlayerCount} Spielern mit {MAX_PICK_POINTS}/
          {MAX_PICK_POINTS} Stimmen bei ★ — aktuell {fullPickCount}/
          {expectedPlayerCount}.
        </p>
      )}
    </>
  );
}
