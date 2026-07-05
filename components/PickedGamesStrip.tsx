import { GameCover } from "@/components/GameCover";
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
