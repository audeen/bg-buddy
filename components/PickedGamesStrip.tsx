import { GameCover } from "@/components/GameCover";
import { CheckIcon } from "@/components/icons";
import { MAX_PICK_POINTS } from "@/lib/vote-limits";

export type PickedGame = {
  id: number;
  name: string;
  coverSrc: string | null;
  points: number;
};

function PointsBadge({ points }: { points: number }) {
  return (
    <span
      className="inline-flex items-center gap-px text-[10px] leading-none"
      aria-label={`${points} von ${MAX_PICK_POINTS} Stimmen`}
    >
      {Array.from({ length: MAX_PICK_POINTS }, (_, i) => (
        <span
          key={i}
          className={i < points ? "text-[var(--warning)]" : "text-[var(--muted)]"}
          aria-hidden
        >
          ★
        </span>
      ))}
    </span>
  );
}

function CardItem({ game }: { game: PickedGame }) {
  return (
    <li className="flex w-[3.25rem] shrink-0 flex-col gap-1 sm:w-[3.75rem]">
      <div className="relative">
        <GameCover
          src={game.coverSrc}
          alt={game.name}
          className="aspect-[3/4] w-full rounded-md border border-[var(--border)]"
        />
      </div>
      <div className="flex flex-col gap-0.5">
        <p className="line-clamp-2 text-[11px] font-medium leading-tight">
          {game.name}
        </p>
        <PointsBadge points={game.points} />
      </div>
    </li>
  );
}

/**
 * Kompakte Fortschrittsanzeige: MAX_PICK_POINTS Slots, wobei jeder vergebene
 * Punkt durch das Cover des gewählten Spiels belegt wird. Freie Punkte bleiben
 * als leere Checkmarks sichtbar. Ersetzt die getrennte Vote-Check- und
 * Picks-Anzeige und passt so auch auf schmale Screens.
 */
export function PickProgress({ games }: { games: PickedGame[] }) {
  const used = games.reduce((sum, g) => sum + g.points, 0);
  const slots: (PickedGame | null)[] = [];
  for (const game of games) {
    for (let i = 0; i < game.points && slots.length < MAX_PICK_POINTS; i++) {
      slots.push(game);
    }
  }
  while (slots.length < MAX_PICK_POINTS) slots.push(null);

  return (
    <span
      className="pick-progress"
      role="status"
      aria-label={`${used} von ${MAX_PICK_POINTS} Stimmen vergeben`}
    >
      {slots.map((game, i) =>
        game ? (
          <span
            key={i}
            className="pick-progress-slot pick-progress-slot-filled"
            title={game.name}
          >
            <GameCover
              src={game.coverSrc}
              alt={game.name}
              className="h-full w-full"
            />
          </span>
        ) : (
          <span key={i} className="pick-progress-slot" aria-hidden>
            <CheckIcon size={13} />
          </span>
        ),
      )}
    </span>
  );
}

/** Kompakte Anzeige der eigenen gepickten Spiele. */
export function PickedGamesStrip({
  games,
  title,
}: {
  games: PickedGame[];
  title?: string;
}) {
  if (games.length === 0) return null;

  return (
    <section className="card card-pad flex flex-col gap-3">
      {title && <h3 className="text-sm font-semibold">{title}</h3>}
      <ul className="flex gap-2.5 overflow-x-auto pb-0.5">
        {games.map((game) => (
          <CardItem key={game.id} game={game} />
        ))}
      </ul>
    </section>
  );
}
