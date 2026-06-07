import type { PickPointsAtExpected, RegisteredPlayer } from "@/lib/meetup-participants";
import { canKickParticipant } from "@/lib/meetup-participants";
import { KickParticipantButton } from "@/components/KickParticipantButton";
import { ParticipantPickChip } from "@/components/ParticipantPickChip";

export function MeetupParticipants({
  expected,
  players,
  compact = false,
  pickPointsAtExpected,
  meetupId,
  kickEnabled = false,
  duelActive = false,
}: {
  expected: number;
  players: RegisteredPlayer[];
  compact?: boolean;
  pickPointsAtExpected?: PickPointsAtExpected;
  meetupId?: string;
  kickEnabled?: boolean;
  duelActive?: boolean;
}) {
  const registered = players.length;
  const fillPct = expected > 0 ? Math.min(100, (registered / expected) * 100) : 0;
  const isFull = registered >= expected;
  const showPickChips = pickPointsAtExpected != null;

  return (
    <div className={`flex flex-col ${compact ? "gap-1.5" : "gap-2"}`}>
      <div
        className={`flex flex-wrap items-baseline gap-x-2 gap-y-0.5 ${compact ? "text-xs" : "text-sm"}`}
      >
        <span className="text-[var(--muted)]">
          Erwartet:{" "}
          <span className="font-semibold text-[var(--foreground)] tabular-nums">
            {expected}
          </span>
        </span>
        <span className="text-[var(--muted)]" aria-hidden>
          ·
        </span>
        <span className="text-[var(--muted)]">
          Angemeldet:{" "}
          <span
            className={`font-semibold tabular-nums ${isFull ? "text-[var(--accent)]" : "text-[var(--foreground)]"}`}
          >
            {registered}
          </span>
        </span>
      </div>

      <div
        className="progress-bar"
        role="progressbar"
        aria-valuenow={registered}
        aria-valuemin={0}
        aria-valuemax={expected}
        aria-label={`${registered} von ${expected} Spielern angemeldet`}
      >
        <div
          className={`progress-bar-fill ${isFull ? "bg-[var(--accent)]" : "bg-[var(--muted)]"}`}
          style={{ width: `${fillPct}%` }}
        />
      </div>

      {players.length > 0 ? (
        <div className="chip-row">
          {players.map((p) => {
            const showKick =
              kickEnabled &&
              meetupId != null &&
              canKickParticipant({ isHost: true, targetIsHost: p.isHost });

            if (showPickChips) {
              return (
                <span key={p.userId} className="inline-flex items-center gap-0.5">
                  <ParticipantPickChip
                    name={p.name}
                    isHost={p.isHost}
                    points={pickPointsAtExpected.get(p.userId) ?? 0}
                  />
                  {showKick && (
                    <KickParticipantButton
                      meetupId={meetupId}
                      userId={p.userId}
                      name={p.name}
                      duelActive={duelActive}
                    />
                  )}
                </span>
              );
            }

            return (
              <span key={p.userId} className="inline-flex items-center gap-0.5">
                <span className="chip chip-meta">
                  {p.name}
                  {p.isHost ? " (Host)" : ""}
                </span>
                {showKick && (
                  <KickParticipantButton
                    meetupId={meetupId}
                    userId={p.userId}
                    name={p.name}
                    duelActive={duelActive}
                  />
                )}
              </span>
            );
          })}
        </div>
      ) : (
        <p className={`text-[var(--muted)] ${compact ? "text-xs" : "text-sm"}`}>
          Noch niemand angemeldet.
        </p>
      )}
    </div>
  );
}
