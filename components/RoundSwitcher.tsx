import Link from "next/link";

export type RoundSwitcherRound = {
  id: string;
  label: string | null;
  startsAt: Date | null;
};

function roundTitle(round: RoundSwitcherRound, index: number): string {
  const parts = [`Runde ${index + 1}`];
  if (round.startsAt) {
    parts.push(
      new Intl.DateTimeFormat("de-DE", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(round.startsAt),
    );
  }
  if (round.label) parts.push(round.label);
  return parts.join(" · ");
}

/** Segmented-Control-Umschalter zwischen den Spielrunden eines Treffens. */
export function RoundSwitcher({
  meetupId,
  segment,
  rounds,
  activeRoundId,
}: {
  meetupId: string;
  segment: "pick" | "duell" | "erweiterung";
  rounds: RoundSwitcherRound[];
  activeRoundId: string;
}) {
  if (rounds.length <= 1) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-[var(--muted)]">Spielrunde</span>
      <div className="tabs-scroll">
        {rounds.map((round, index) => {
          const active = round.id === activeRoundId;
          return (
            <Link
              key={round.id}
              href={`/meetups/${meetupId}/${segment}?runde=${round.id}`}
              className={`btn btn-tab ${active ? "btn-primary" : "btn-ghost"}`}
              aria-current={active ? "true" : undefined}
            >
              {roundTitle(round, index)}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
