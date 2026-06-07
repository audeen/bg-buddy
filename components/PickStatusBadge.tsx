import { MAX_PICK_POINTS } from "@/lib/vote-limits";

export function PickStatusBadge({ points }: { points: number }) {
  if (points >= MAX_PICK_POINTS) {
    return (
      <span
        className="inline-flex items-center gap-0.5 text-[var(--accent)]"
        title={`${MAX_PICK_POINTS}/${MAX_PICK_POINTS} Stimmen bei ★`}
        aria-label={`${MAX_PICK_POINTS} von ${MAX_PICK_POINTS} Stimmen vergeben`}
      >
        {Array.from({ length: MAX_PICK_POINTS }, (_, i) => (
          <span key={i} aria-hidden>
            ★
          </span>
        ))}
      </span>
    );
  }

  if (points > 0) {
    return (
      <span
        className="inline-flex items-center gap-0.5 tabular-nums text-[var(--warning)]"
        title={`${points}/${MAX_PICK_POINTS} Stimmen bei ★`}
        aria-label={`${points} von ${MAX_PICK_POINTS} Stimmen vergeben`}
      >
        {Array.from({ length: MAX_PICK_POINTS }, (_, i) => (
          <span
            key={i}
            className={i < points ? "opacity-100" : "opacity-25"}
            aria-hidden
          >
            ★
          </span>
        ))}
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-0.5 opacity-40"
      title="Noch keine Stimmen bei ★"
      aria-label="Noch keine Stimmen vergeben"
    >
      {Array.from({ length: MAX_PICK_POINTS }, (_, i) => (
        <span key={i} className="text-[var(--muted)]" aria-hidden>
          ★
        </span>
      ))}
    </span>
  );
}
