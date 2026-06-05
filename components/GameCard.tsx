import Link from "next/link";
import { GameCover } from "@/components/GameCover";
import {
  buildGameTags,
  chipClassForVariant,
  groupGameTags,
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

function TagRows({ game, playerCount }: { game: GameCardGame; playerCount?: number }) {
  const tags = buildGameTags(game, { playerCount });
  const { meta, content } = groupGameTags(tags);

  if (tags.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      {meta.length > 0 && (
        <div className="chip-row">
          {meta.map((t) => (
            <span key={t.label} className={chipClassForVariant(t.variant)}>
              {t.label}
            </span>
          ))}
        </div>
      )}
      {content.length > 0 && (
        <div className="chip-row">
          {content.map((t) => (
            <span key={t.label} className={chipClassForVariant(t.variant)}>
              {t.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function GameCard(props: ButtonProps | LinkProps) {
  const { game, playerCount, selected, className = "" } = props;
  const disabled = "disabled" in props ? props.disabled : false;

  const inner = (
    <>
      <div className="relative shrink-0 card-game-cover overflow-hidden">
        <GameCover
          src={game.thumbnail ?? game.image}
          alt={game.name}
          className="w-full aspect-square"
        />
        {selected && (
          <span
            className="absolute top-2.5 right-2.5 bg-[var(--accent)] text-white rounded-full w-7 h-7 flex items-center justify-center text-xs font-bold"
            style={{ boxShadow: "var(--shadow-md)" }}
            aria-hidden
          >
            ✓
          </span>
        )}
      </div>
      <div
        className="flex flex-col gap-2.5 flex-1"
        style={{ padding: "var(--space-card)" }}
      >
        <span className="font-semibold text-base leading-snug line-clamp-2">
          {game.name}
        </span>
        <TagRows game={game} playerCount={playerCount} />
        {game.isExpansion && (
          <span className="chip w-fit">Erweiterung</span>
        )}
      </div>
    </>
  );

  const cardClass = `card card-game w-full ${selected ? "card-game-selected" : ""} ${
    disabled ? "card-game-disabled opacity-50 cursor-not-allowed" : ""
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
      disabled={disabled}
      className={cardClass}
    >
      {inner}
    </button>
  );
}
