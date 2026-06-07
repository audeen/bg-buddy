"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { GameCover } from "@/components/GameCover";
import {
  expansionAvailableLabel,
  expansionCountLabel,
} from "@/lib/expansion-label";
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
  ownedExpansions?: GameCardGame[];
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
  ownedExpansions,
  viewExpansionId,
  onShowExpansions,
}: {
  game: GameCardGame;
  playerCount?: number;
  ownedExpansions: GameCardGame[];
  viewExpansionId: number | null;
  onShowExpansions: () => void;
}) {
  const showExpansionHint =
    !game.isExpansion &&
    ownedExpansions.length > 0 &&
    viewExpansionId == null;

  return (
    <div
      className="flex flex-col gap-2.5 flex-1"
      style={{ padding: "var(--space-card)" }}
    >
      <span className="font-semibold text-base leading-snug line-clamp-2">
        {game.name}
      </span>
      <TagRows game={game} playerCount={playerCount} />
      {showExpansionHint && (
        <button
          type="button"
          className="chip chip-meta w-fit text-left"
          onClick={(e) => {
            e.stopPropagation();
            onShowExpansions();
          }}
        >
          {expansionAvailableLabel(ownedExpansions.length)}
        </button>
      )}
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

function ExpansionTabs({
  ownedExpansions,
  viewExpansionId,
  onSelectBase,
  onCycleExpansions,
}: {
  ownedExpansions: GameCardGame[];
  viewExpansionId: number | null;
  onSelectBase: () => void;
  onCycleExpansions: () => void;
}) {
  const tabClass = (active: boolean) =>
    `shrink-0 h-7 max-w-[8rem] px-2 rounded-full text-[10px] font-bold border tracking-tight truncate ${
      active
        ? "bg-[var(--accent)] text-white border-[var(--accent)]"
        : "bg-[var(--surface)] text-[var(--foreground)] border-[var(--border)] hover:bg-[var(--surface-2)]"
    }`;

  const expansionNames = ownedExpansions.map((e) => e.name).join(", ");
  const onBaseView = viewExpansionId == null;

  return (
    <div
      className="absolute top-2.5 left-1/2 -translate-x-1/2 z-[1] flex gap-1 max-w-[calc(100%-5.5rem)] overflow-x-auto pointer-events-auto"
      style={{ boxShadow: "var(--shadow-md)" }}
      role="tablist"
      aria-label="Erweiterungen"
      onClick={(e) => e.stopPropagation()}
    >
      {!onBaseView && (
        <button
          type="button"
          role="tab"
          aria-selected={false}
          className={tabClass(false)}
          onClick={onSelectBase}
        >
          Basis
        </button>
      )}
      <button
        type="button"
        role="tab"
        aria-selected={!onBaseView}
        title={expansionNames}
        className={tabClass(!onBaseView)}
        onClick={onCycleExpansions}
      >
        {expansionCountLabel(ownedExpansions.length)}
      </button>
    </div>
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

function useDisplayedGame(game: GameCardGame, ownedExpansions: GameCardGame[]) {
  const [viewExpansionId, setViewExpansionId] = useState<number | null>(null);

  useEffect(() => {
    setViewExpansionId(null);
  }, [game.id]);

  const displayedGame =
    viewExpansionId != null
      ? (ownedExpansions.find((e) => e.id === viewExpansionId) ?? game)
      : game;

  const showExpansionTabs =
    !game.isExpansion && ownedExpansions.length > 0;

  const showFirstExpansion = () => {
    if (ownedExpansions.length === 0) return;
    setViewExpansionId(ownedExpansions[0].id);
  };

  const cycleExpansions = () => {
    if (ownedExpansions.length === 0) return;
    if (viewExpansionId == null) {
      setViewExpansionId(ownedExpansions[0].id);
      return;
    }
    if (ownedExpansions.length === 1) {
      setViewExpansionId(null);
      return;
    }
    const idx = ownedExpansions.findIndex((e) => e.id === viewExpansionId);
    const next = ownedExpansions[(idx + 1) % ownedExpansions.length];
    setViewExpansionId(next.id);
  };

  return {
    displayedGame,
    viewExpansionId,
    showExpansionTabs,
    selectBase: () => setViewExpansionId(null),
    showFirstExpansion,
    cycleExpansions,
  };
}

export function GameCard(props: ButtonProps | LinkProps) {
  const {
    game,
    playerCount,
    selected,
    selectedPoints,
    ownedExpansions = [],
    className = "",
  } = props;
  const disabled = "disabled" in props ? props.disabled : false;
  const onDetailsClick =
    "onDetailsClick" in props ? props.onDetailsClick : undefined;
  const points = selectedPoints ?? 0;

  const {
    displayedGame,
    viewExpansionId,
    showExpansionTabs,
    selectBase,
    showFirstExpansion,
    cycleExpansions,
  } = useDisplayedGame(game, ownedExpansions);

  const cardClass = `card card-game w-full ${selected ? "card-game-selected" : ""} ${
    disabled ? "card-game-disabled opacity-50 cursor-not-allowed" : ""
  } ${className}`;

  const bodyProps = {
    game: displayedGame,
    playerCount,
    ownedExpansions,
    viewExpansionId,
    onShowExpansions: showFirstExpansion,
  };

  const expansionTabs = showExpansionTabs ? (
    <ExpansionTabs
      ownedExpansions={ownedExpansions}
      viewExpansionId={viewExpansionId}
      onSelectBase={selectBase}
      onCycleExpansions={cycleExpansions}
    />
  ) : null;

  if ("href" in props && props.href) {
    return (
      <Link href={props.href} className={`${cardClass} hover:shadow-md relative`}>
        <CardCover game={displayedGame} />
        <CardBody {...bodyProps} />
        {expansionTabs}
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
          <CardCover game={displayedGame} />
          <CardBody {...bodyProps} />
        </button>
        <DetailsButton onClick={onDetailsClick} />
        {expansionTabs}
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
      <CardCover game={displayedGame} />
      <CardBody {...bodyProps} />
      {expansionTabs}
      {points > 0 && <StarsBadge points={points} />}
    </button>
  );
}
