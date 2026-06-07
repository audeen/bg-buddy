"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { GameCover } from "@/components/GameCover";
import { ExpansionFamilyNav } from "@/components/ExpansionFamilyNav";
import {
  expansionAvailableLabel,
  expansionCountLabel,
  expansionViewLabel,
} from "@/lib/expansion-label";
import { FilterChipButton } from "@/components/FilterChipButton";
import type { GameFilters } from "@/lib/game-filters";
import {
  buildGameTags,
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
  activeFilters?: GameFilters;
  filterMode?: boolean;
  selected?: boolean;
  selectedPoints?: number;
  ownedExpansions?: GameCardGame[];
  className?: string;
};

type ButtonProps = BaseProps & {
  href?: undefined;
  onClick: (displayedGame: GameCardGame) => void;
  onDetailsClick?: (displayedGame: GameCardGame) => void;
  disabled?: boolean;
};

type LinkProps = BaseProps & {
  href: string;
  onClick?: undefined;
  disabled?: undefined;
};

function TagRows({
  game,
  baseGame,
  playerCount,
  activeFilters,
  filterMode,
  ownedExpansions,
  onBaseView,
}: {
  game: GameCardGame;
  baseGame: GameCardGame;
  playerCount?: number;
  activeFilters?: GameFilters;
  filterMode?: boolean;
  ownedExpansions: GameCardGame[];
  onBaseView: boolean;
}) {
  const tags = buildGameTags(game, {
    playerCount,
    ownedExpansions: onBaseView ? ownedExpansions : undefined,
  });
  const { meta, content } = groupGameTags(tags);

  if (tags.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      {meta.length > 0 && (
        <div className="chip-row">
          {meta.map((t) => (
            <FilterChipButton
              key={t.label}
              tag={t}
              activeFilters={activeFilters}
              filterMode={filterMode}
            />
          ))}
        </div>
      )}
      {content.length > 0 && (
        <div className="chip-row">
          {content.map((t) => (
            <FilterChipButton
              key={t.label}
              tag={t}
              activeFilters={activeFilters}
              filterMode={filterMode}
            />
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
  baseGame,
  playerCount,
  activeFilters,
  filterMode,
  ownedExpansions,
  viewExpansionId,
  onSelectBase,
  onSelectExpansion,
}: {
  game: GameCardGame;
  baseGame: GameCardGame;
  playerCount?: number;
  activeFilters?: GameFilters;
  filterMode?: boolean;
  ownedExpansions: GameCardGame[];
  viewExpansionId: number | null;
  onSelectBase: () => void;
  onSelectExpansion: (id: number) => void;
}) {
  return (
    <div
      className="flex flex-col gap-2.5 flex-1"
      style={{ padding: "var(--space-card)" }}
    >
      <span className="font-semibold text-base leading-snug line-clamp-2">
        {game.name}
      </span>
      <TagRows
        game={game}
        baseGame={baseGame}
        playerCount={playerCount}
        activeFilters={activeFilters}
        filterMode={filterMode}
        ownedExpansions={ownedExpansions}
        onBaseView={viewExpansionId == null}
      />
      {ownedExpansions.length > 0 && (
        <ExpansionFamilyNav
          baseGame={baseGame}
          expansions={ownedExpansions}
          activeId={viewExpansionId}
          onSelectBase={onSelectBase}
          onSelectExpansion={onSelectExpansion}
          variant="card"
        />
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

function ExpansionCountBadge({
  count,
  expansionNames,
  baseGameName,
  viewExpansionId,
}: {
  count: number;
  expansionNames: string;
  baseGameName: string;
  viewExpansionId: number | null;
}) {
  const onExpansionView = viewExpansionId != null;
  const label = onExpansionView
    ? expansionViewLabel(baseGameName)
    : expansionCountLabel(count);

  return (
    <span
      className="absolute top-2.5 left-1/2 -translate-x-1/2 z-[1] shrink-0 h-7 max-w-[10rem] px-2 rounded-full text-[10px] font-bold border tracking-tight truncate bg-[var(--surface)] text-[var(--foreground)] border-[var(--border)] flex items-center justify-center pointer-events-none"
      style={{ boxShadow: "var(--shadow-md)" }}
      title={onExpansionView ? baseGameName : expansionNames}
      aria-label={
        onExpansionView
          ? expansionViewLabel(baseGameName)
          : expansionAvailableLabel(count)
      }
    >
      {label}
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

function useDisplayedGame(game: GameCardGame, ownedExpansions: GameCardGame[]) {
  const [viewExpansionId, setViewExpansionId] = useState<number | null>(null);

  useEffect(() => {
    setViewExpansionId(null);
  }, [game.id]);

  const displayedGame =
    viewExpansionId != null
      ? (ownedExpansions.find((e) => e.id === viewExpansionId) ?? game)
      : game;

  const showExpansionBadge =
    !game.isExpansion && ownedExpansions.length > 0;

  return {
    displayedGame,
    viewExpansionId,
    showExpansionBadge,
    selectBase: () => setViewExpansionId(null),
    selectExpansion: (id: number) => setViewExpansionId(id),
    expansionNames: ownedExpansions.map((e) => e.name).join(", "),
  };
}

export function GameCard(props: ButtonProps | LinkProps) {
  const {
    game,
    playerCount,
    activeFilters,
    filterMode,
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
    showExpansionBadge,
    selectBase,
    selectExpansion,
    expansionNames,
  } = useDisplayedGame(game, ownedExpansions);

  const cardClass = `card card-game w-full ${selected ? "card-game-selected" : ""} ${
    disabled ? "card-game-disabled opacity-50 cursor-not-allowed" : ""
  } ${className}`;

  const bodyProps = {
    game: displayedGame,
    baseGame: game,
    playerCount,
    activeFilters,
    filterMode,
    ownedExpansions,
    viewExpansionId,
    onSelectBase: selectBase,
    onSelectExpansion: selectExpansion,
  };

  const expansionBadge = showExpansionBadge ? (
    <ExpansionCountBadge
      count={ownedExpansions.length}
      expansionNames={expansionNames}
      baseGameName={game.name}
      viewExpansionId={viewExpansionId}
    />
  ) : null;

  if ("href" in props && props.href) {
    return (
      <Link href={props.href} className={`${cardClass} hover:shadow-md relative`}>
        <CardCover game={displayedGame} />
        <CardBody {...bodyProps} />
        {expansionBadge}
        {points > 0 && <StarsBadge points={points} />}
      </Link>
    );
  }

  const { onClick: cardOnClick } = props as ButtonProps;

  if (onDetailsClick) {
    return (
      <div className={`${cardClass} relative`}>
        <button
          type="button"
          onClick={() => cardOnClick(displayedGame)}
          disabled={disabled}
          className="flex flex-col w-full h-full text-left"
        >
          <CardCover game={displayedGame} />
          <CardBody {...bodyProps} />
        </button>
        <DetailsButton onClick={() => onDetailsClick(displayedGame)} />
        {expansionBadge}
        {points > 0 && <StarsBadge points={points} />}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => cardOnClick(displayedGame)}
      disabled={disabled}
      className={`${cardClass} relative`}
    >
      <CardCover game={displayedGame} />
      <CardBody {...bodyProps} />
      {expansionBadge}
      {points > 0 && <StarsBadge points={points} />}
    </button>
  );
}
