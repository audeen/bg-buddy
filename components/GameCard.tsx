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
  selectedPoints?: number;
  className?: string;
};

type ButtonProps = BaseProps & {
  href?: undefined;
  onClick: () => void;
  onDetailsClick?: () => void;
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

function CardCover({ game }: { game: GameCardGame }) {
  return (
    <div className="relative shrink-0 card-game-cover overflow-hidden">
      <GameCover
        src={game.thumbnail ?? game.image}
        alt={game.name}
        className="w-full aspect-square"
      />
    </div>
  );
}

function CardBody({
  game,
  playerCount,
}: {
  game: GameCardGame;
  playerCount?: number;
}) {
  return (
    <div
      className="flex flex-col gap-2.5 flex-1"
      style={{ padding: "var(--space-card)" }}
    >
      <span className="font-semibold text-base leading-snug line-clamp-2">
        {game.name}
      </span>
      <TagRows game={game} playerCount={playerCount} />
      {game.isExpansion && <span className="chip w-fit">Erweiterung</span>}
    </div>
  );
}

function StarsBadge({ points }: { points: number }) {
  if (points <= 0) return null;
  return (
    <span
      className="absolute top-2.5 right-2.5 z-[1] bg-[var(--accent)] text-white rounded-full min-w-7 h-7 px-1.5 flex items-center justify-center text-xs font-bold tracking-tight"
      style={{ boxShadow: "var(--shadow-md)" }}
      aria-label={`${points} ${points === 1 ? "Stern" : "Sterne"}`}
    >
      {"★".repeat(points)}
    </span>
  );
}

function DetailsButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="absolute top-2.5 left-2.5 z-[1] bg-[var(--surface)] text-[var(--foreground)] rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold border border-[var(--border)] hover:bg-[var(--surface-2)]"
      style={{ boxShadow: "var(--shadow-md)" }}
      aria-label="Details anzeigen"
    >
      ℹ
    </button>
  );
}

export function GameCard(props: ButtonProps | LinkProps) {
  const { game, playerCount, selected, selectedPoints, className = "" } = props;
  const disabled = "disabled" in props ? props.disabled : false;
  const onDetailsClick =
    "onDetailsClick" in props ? props.onDetailsClick : undefined;
  const points = selectedPoints ?? 0;

  const cardClass = `card card-game w-full ${selected ? "card-game-selected" : ""} ${
    disabled ? "card-game-disabled opacity-50 cursor-not-allowed" : ""
  } ${className}`;

  if ("href" in props && props.href) {
    return (
      <Link href={props.href} className={`${cardClass} hover:shadow-md relative`}>
        <CardCover game={game} />
        <CardBody game={game} playerCount={playerCount} />
        {points > 0 && <StarsBadge points={points} />}
      </Link>
    );
  }

  if (onDetailsClick) {
    return (
      <div className={`${cardClass} relative`}>
        <button
          type="button"
          onClick={props.onClick}
          disabled={disabled}
          className="flex flex-col w-full h-full text-left"
        >
          <CardCover game={game} />
          <CardBody game={game} playerCount={playerCount} />
        </button>
        <DetailsButton onClick={onDetailsClick} />
        {points > 0 && <StarsBadge points={points} />}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={disabled}
      className={`${cardClass} relative`}
    >
      <CardCover game={game} />
      <CardBody game={game} playerCount={playerCount} />
      {points > 0 && <StarsBadge points={points} />}
    </button>
  );
}
