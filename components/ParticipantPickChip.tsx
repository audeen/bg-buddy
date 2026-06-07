import { MAX_PICK_POINTS } from "@/lib/vote-limits";

export function ParticipantPickChip({
  name,
  isHost,
  points,
}: {
  name: string;
  isHost: boolean;
  points: number;
}) {
  const complete = points >= MAX_PICK_POINTS;
  const chipClass = complete ? "chip chip-accent" : "chip chip-rating";

  return (
    <span
      className={chipClass}
      title={
        complete
          ? `${MAX_PICK_POINTS}/${MAX_PICK_POINTS} Stimmen bei ★`
          : points > 0
            ? `${points}/${MAX_PICK_POINTS} Stimmen bei ★`
            : "Noch keine Stimmen bei ★"
      }
    >
      {name}
      {isHost ? " (Host)" : ""}
      <span
        className="inline-flex items-center gap-px ml-0.5"
        aria-label={
          complete
            ? `${MAX_PICK_POINTS} von ${MAX_PICK_POINTS} Stimmen vergeben`
            : points > 0
              ? `${points} von ${MAX_PICK_POINTS} Stimmen vergeben`
              : "Noch keine Stimmen vergeben"
        }
      >
        {Array.from({ length: MAX_PICK_POINTS }, (_, i) => (
          <span
            key={i}
            className={
              i < points
                ? "text-[var(--warning)]"
                : "text-[var(--foreground)] opacity-30"
            }
            aria-hidden
          >
            ★
          </span>
        ))}
      </span>
    </span>
  );
}
