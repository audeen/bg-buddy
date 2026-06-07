import type { PickPointsAtExpected, RegisteredPlayer } from "@/lib/meetup-participants";
import { countFullPickers } from "@/lib/meetup-participants";
import { MAX_PICK_POINTS } from "@/lib/vote-limits";
import { PickStatusBadge } from "@/components/PickStatusBadge";

export function MeetupParticipants({
  expected,
  players,
  compact = false,
  pickPointsAtExpected,
}: {
  expected: number;
  players: RegisteredPlayer[];
  compact?: boolean;
  pickPointsAtExpected?: PickPointsAtExpected;
}) {
  const registered = players.length;
  const fillPct = expected > 0 ? Math.min(100, (registered / expected) * 100) : 0;
  const isFull = registered >= expected;
  const showPickStatus = pickPointsAtExpected != null;
  const fullPickers = showPickStatus
    ? countFullPickers(players, pickPointsAtExpected)
    : 0;

  function chipClass(userId: string): string {
    if (!showPickStatus) return "chip chip-meta";
    const points = pickPointsAtExpected.get(userId) ?? 0;
    if (points >= MAX_PICK_POINTS) return "chip chip-accent";
    if (points > 0) return "chip chip-rating";
    return "chip chip-meta opacity-70";
  }

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
        {showPickStatus && registered > 0 && (
          <>
            <span className="text-[var(--muted)]" aria-hidden>
              ·
            </span>
            <span className="text-[var(--muted)]">
              Gepickt:{" "}
              <span
                className={`font-semibold tabular-nums ${fullPickers >= expected ? "text-[var(--accent)]" : "text-[var(--foreground)]"}`}
              >
                {fullPickers}/{expected}
              </span>
              <span className="sr-only"> bei {expected} Spielern</span>
              <span aria-hidden> ★</span>
            </span>
          </>
        )}
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

      {showPickStatus && registered > 0 && (
        <div
          className="progress-bar h-1"
          role="progressbar"
          aria-valuenow={fullPickers}
          aria-valuemin={0}
          aria-valuemax={expected}
          aria-label={`${fullPickers} von ${expected} Spielern haben ${MAX_PICK_POINTS} Stimmen bei ★ vergeben`}
        >
          <div
            className={`progress-bar-fill h-1 ${fullPickers >= expected ? "bg-[var(--accent)]" : "bg-[var(--warning)]"}`}
            style={{
              width: `${expected > 0 ? Math.min(100, (fullPickers / expected) * 100) : 0}%`,
            }}
          />
        </div>
      )}

      {players.length > 0 ? (
        <ul className={`flex flex-col ${compact ? "gap-1" : "gap-1.5"}`}>
          {players.map((p) => {
            const points = pickPointsAtExpected?.get(p.userId) ?? 0;
            return (
              <li
                key={p.userId}
                className={`flex items-center justify-between gap-2 ${compact ? "text-xs" : "text-sm"}`}
              >
                <span className={`${chipClass(p.userId)} max-w-[65%] truncate`}>
                  {p.name}
                  {p.isHost ? " (Host)" : ""}
                </span>
                {showPickStatus && <PickStatusBadge points={points} />}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={`text-[var(--muted)] ${compact ? "text-xs" : "text-sm"}`}>
          Noch niemand angemeldet.
        </p>
      )}
    </div>
  );
}
