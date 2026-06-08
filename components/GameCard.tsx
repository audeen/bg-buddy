"use client";

import Link from "next/link";
import { useEffect, useState, type MouseEvent, type PointerEvent } from "react";
import { GameCover } from "@/components/GameCover";
import { ExpansionFamilyNav } from "@/components/ExpansionFamilyNav";
import {
  expansionAvailableLabel,
  expansionCountLabel,
  expansionRequiredForCountLabel,
  expansionViewLabel,
} from "@/lib/expansion-label";
import { expansionNamesForPlayerCount } from "@/lib/effective-player-count";
import { ExpansionRequiredBanner } from "@/components/ExpansionRequiredBanner";
import { ExpansionVoteFollowsBanner } from "@/components/ExpansionVoteFollowsBanner";
import { LentOutBanner } from "@/components/LentOutBanner";
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
  filterBasePath?: string;
  selected?: boolean;
  selectedPoints?: number;
  ownedExpansions?: GameCardGame[];
  className?: string;
  lentOut?: boolean;
};

type ButtonProps = BaseProps & {
  href?: undefined;
  onClick?: (displayedGame: GameCardGame) => void;
  /** One activation per pointer gesture; suppresses duplicate synthetic clicks. */
  onActivate?: () => void;
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
  filterBasePath,
  ownedExpansions,
  onBaseView,
}: {
  game: GameCardGame;
  baseGame: GameCardGame;
  playerCount?: number;
  activeFilters?: GameFilters;
  filterMode?: boolean;
  filterBasePath?: string;
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
              basePath={filterBasePath}
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
              basePath={filterBasePath}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CardCover({
  game,
  playerCount,
  baseGame,
  ownedExpansions,
  showExpansionBanner,
  showExpansionVoteFollows,
  lentOut,
}: {
  game: GameCardGame;
  playerCount?: number;
  baseGame: GameCardGame;
  ownedExpansions: GameCardGame[];
  showExpansionBanner: boolean;
  showExpansionVoteFollows?: boolean;
  lentOut?: boolean;
}) {
  const requiredExpansions =
    showExpansionBanner && playerCount != null
      ? expansionNamesForPlayerCount(baseGame, ownedExpansions, playerCount)
      : [];
  const bannerLabel =
    requiredExpansions.length > 0 && playerCount != null
      ? expansionRequiredForCountLabel(requiredExpansions, playerCount)
      : null;
  const coverAriaLabel = lentOut
    ? "Verliehen"
    : bannerLabel ?? undefined;

  return (
    <div
      className="relative shrink-0 card-game-cover overflow-hidden"
      aria-label={coverAriaLabel}
    >
      <GameCover
        src={game.thumbnail ?? game.image}
        alt={game.name}
        className="w-full aspect-square"
      />
      {bannerLabel && <ExpansionRequiredBanner label={bannerLabel} />}
      {showExpansionVoteFollows && <ExpansionVoteFollowsBanner />}
      {lentOut && <LentOutBanner />}
    </div>
  );
}

function CardBody({
  game,
  baseGame,
  playerCount,
  activeFilters,
  filterMode,
  filterBasePath,
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
  filterBasePath?: string;
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
        filterBasePath={filterBasePath}
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
      className="absolute top-2.5 right-2.5 z-[3] bg-[var(--accent)] text-white rounded-full min-w-7 h-7 px-1.5 flex items-center justify-center text-xs font-bold tracking-tight"
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
      className="absolute top-2.5 left-1/2 -translate-x-1/2 z-[3] shrink-0 h-7 max-w-[10rem] px-2 rounded-full text-[10px] font-bold border tracking-tight truncate bg-[var(--surface)] text-[var(--foreground)] border-[var(--border)] flex items-center justify-center pointer-events-none"
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
      className="absolute top-2.5 left-2.5 z-[3] bg-[var(--surface)] text-[var(--foreground)] rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold border border-[var(--border)] hover:bg-[var(--surface-2)]"
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
    filterBasePath,
    selected,
    selectedPoints,
    ownedExpansions = [],
    className = "",
    lentOut,
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

  const { onClick: cardOnClick, onActivate } = props as ButtonProps;
  const pickMode = !!onActivate;
  const onBaseView = viewExpansionId == null;
  const showVoteState = !pickMode || onBaseView;

  const cardClass = `card card-game w-full ${
    showVoteState && selected ? "card-game-selected" : ""
  } ${disabled ? "card-game-disabled opacity-50 cursor-not-allowed" : ""} ${className}`;

  const bodyProps = {
    game: displayedGame,
    baseGame: game,
    playerCount,
    activeFilters,
    filterMode,
    filterBasePath,
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

  const showExpansionBanner = viewExpansionId == null && !game.isExpansion;
  const showExpansionVoteFollows =
    pickMode &&
    onBaseView &&
    !game.isExpansion &&
    ownedExpansions.length > 0 &&
    points > 0;

  const coverProps = {
    game: displayedGame,
    playerCount,
    baseGame: game,
    ownedExpansions,
    showExpansionBanner,
    showExpansionVoteFollows,
    lentOut,
  };

  if ("href" in props && props.href) {
    return (
      <Link href={props.href} className={`${cardClass} hover:shadow-md relative`}>
        <CardCover {...coverProps} />
        <CardBody {...bodyProps} />
        {expansionBadge}
        {showVoteState && points > 0 && <StarsBadge points={points} />}
      </Link>
    );
  }

  const activateProps = onActivate
    ? {
        onPointerUp: (e: PointerEvent<HTMLButtonElement>) => {
          if (disabled || e.button !== 0) return;
          if (pickMode && !onBaseView) return;
          if ((e.target as HTMLElement).closest(".chip-interactive")) return;
          e.preventDefault();
          onActivate();
        },
        onClick: (e: MouseEvent) => {
          e.preventDefault();
        },
      }
    : {
        onClick: () => cardOnClick?.(displayedGame),
      };

  if (onDetailsClick) {
    return (
      <div className={`${cardClass} relative`}>
        <button
          type="button"
          {...activateProps}
          disabled={disabled}
          className="flex flex-col w-full h-full text-left"
        >
          <CardCover {...coverProps} />
          <CardBody {...bodyProps} />
        </button>
        <DetailsButton onClick={() => onDetailsClick(displayedGame)} />
        {expansionBadge}
        {showVoteState && points > 0 && <StarsBadge points={points} />}
      </div>
    );
  }

  return (
    <button
      type="button"
      {...activateProps}
      disabled={disabled}
      className={`${cardClass} relative`}
    >
      <CardCover {...coverProps} />
      <CardBody {...bodyProps} />
      {expansionBadge}
      {showVoteState && points > 0 && <StarsBadge points={points} />}
    </button>
  );
}
