import Link from "next/link";
import { GameCover } from "@/components/GameCover";
import {
  buildGameTags,
  chipClassForVariant,
  type GameTagSource,
} from "@/lib/game-tags";

export interface GameCardGame extends GameTagSource {
  id: number;
  name: string;
  thumbnail: string | null;
  image: string | null;
  isExpansion?: boolean;
}

type BaseProps = {
  game: GameCardGame;
  playerCount?: number;
  selected?: boolean;
  className?: string;
};

type ButtonProps = BaseProps & {
  href?: undefined;
  onClick: () => void;
  disabled?: boolean;
};

type LinkProps = BaseProps & {
  href: string;
  onClick?: undefined;
  disabled?: undefined;
};

export function GameCard(props: ButtonProps | LinkProps) {
  const { game, playerCount, selected, className = "" } = props;
  const tags = buildGameTags(game, { playerCount });

  const inner = (
    <>
      <div className="relative shrink-0">
        <GameCover
          src={game.thumbnail ?? game.image}
          alt={game.name}
          className="w-full aspect-square"
        />
        {selected && (
          <span
            className="absolute top-3 right-3 bg-[var(--accent)] text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold shadow-md"
            aria-hidden
          >
            ✓
          </span>
        )}
      </div>
      <div className="p-4 flex flex-col gap-2.5 flex-1">
        <span className="font-semibold text-[0.95rem] leading-snug line-clamp-2">
          {game.name}
        </span>
        {tags.length > 0 && (
          <div className="chip-row">
            {tags.map((t) => (
              <span key={t.label} className={chipClassForVariant(t.variant)}>
                {t.label}
              </span>
            ))}
          </div>
        )}
        {game.isExpansion && (
          <span className="chip w-fit">Erweiterung</span>
        )}
      </div>
    </>
  );

  const cardClass = `card card-game w-full ${selected ? "card-game-selected" : ""} ${
    props.disabled ? "opacity-50 cursor-not-allowed" : ""
  } ${className}`;

  if ("href" in props && props.href) {
    return (
      <Link href={props.href} className={`${cardClass} hover:shadow-md`}>
        {inner}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      className={cardClass}
    >
      {inner}
    </button>
  );
}
