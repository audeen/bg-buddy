import { GameCover } from "@/components/GameCover";
import { CheckIcon } from "@/components/icons";
import { MAX_PICK_POINTS } from "@/lib/vote-limits";

export type PickedGame = {
  id: number;
  name: string;
  coverSrc: string | null;
  points: number;
};

function CardItem({ game }: { game: PickedGame }) {
  return (
    <li className="picked-games-strip-item">
      <GameCover
        src={game.coverSrc}
        alt={game.name}
        className="picked-games-strip-cover aspect-[3/4] w-full rounded-md border border-[var(--border)]"
      />
      <p className="line-clamp-2 w-full text-center text-[11px] font-medium leading-tight sm:text-xs">
        {game.name}
      </p>
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
      <ul className="picked-games-strip">
        {games.flatMap((game) =>
          Array.from({ length: game.points }, (_, i) => (
            <CardItem key={`${game.id}-${i}`} game={game} />
          )),
        )}
      </ul>
    </section>
  );
}
