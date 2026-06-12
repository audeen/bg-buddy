"use client";

import Link from "next/link";
import { useState, type MouseEvent, type PointerEvent } from "react";
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
import { HostRecommendationBanner } from "@/components/HostRecommendationBanner";
import { LentOutBanner } from "@/components/LentOutBanner";
import { FilterChipButton } from "@/components/FilterChipButton";
import type { GameFilters, GameSort } from "@/lib/game-filters";
import { buildGameTags, groupGameTags } from "@/lib/game-tags";
import { resolveCoverSrc } from "@/lib/cover-image";
import { CheckIcon } from "@/components/icons";
import type { GameCardGame } from "@/lib/types/game";

type BaseProps = {
  game: GameCardGame;
  playerCount?: number;
  activeFilters?: GameFilters;
  filterMode?: boolean;
  filterBasePath?: string;
  filterSort?: GameSort;
  filterScrollToId?: string;
  selected?: boolean;
  selectedPoints?: number;
  ownedExpansions?: GameCardGame[];
  className?: string;
  lentOut?: boolean;
  hostRecommendation?: boolean;
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
  playerCount,
  activeFilters,
  filterMode,
  filterBasePath,
  filterSort,
  filterScrollToId,
  ownedExpansions,
  onBaseView,
}: {
  game: GameCardGame;
  playerCount?: number;
  activeFilters?: GameFilters;
  filterMode?: boolean;
  filterBasePath?: string;
  filterSort?: GameSort;
  filterScrollToId?: string;
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
        <div className="card-stats">
          {meta.map((t) => (
            <FilterChipButton
              key={t.label}
              tag={t}
              activeFilters={activeFilters}
              filterMode={filterMode}
              basePath={filterBasePath}
              sort={filterSort}
              scrollToId={filterScrollToId}
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
              sort={filterSort}
              scrollToId={filterScrollToId}
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
  hostRecommendation,
}: {
  game: GameCardGame;
  playerCount?: number;
  baseGame: GameCardGame;
  ownedExpansions: GameCardGame[];
  showExpansionBanner: boolean;
  showExpansionVoteFollows?: boolean;
  lentOut?: boolean;
  hostRecommendation?: boolean;
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
    // `isolate` kapselt die z-Indizes im Cover (Bild z-1, Banner z-2) ein,
    // damit sie nicht mit der .card-overlay (z-1) konkurrieren — sonst
    // schluckt das Cover-Bild die Klicks der Overlay-Fläche.
    <div
      className="relative isolate shrink-0 card-game-cover overflow-hidden"
      aria-label={coverAriaLabel}
    >
      <GameCover
        src={resolveCoverSrc(game)}
        alt={game.name}
        className="w-full aspect-square"
      />
      {bannerLabel && <ExpansionRequiredBanner label={bannerLabel} />}
      {showExpansionVoteFollows && <ExpansionVoteFollowsBanner />}
      {lentOut && <LentOutBanner />}
      {hostRecommendation && <HostRecommendationBanner />}
      <div className="card-cover-scrim">
        <span className="card-cover-title line-clamp-2">{game.name}</span>
      </div>
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
  filterSort,
  filterScrollToId,
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
  filterSort?: GameSort;
  filterScrollToId?: string;
  ownedExpansions: GameCardGame[];
  viewExpansionId: number | null;
  onSelectBase: () => void;
  onSelectExpansion: (id: number) => void;
}) {
  return (
    <div className="card-pad flex flex-col gap-2.5 flex-1">
      <TagRows
        game={game}
        playerCount={playerCount}
        activeFilters={activeFilters}
        filterMode={filterMode}
        filterBasePath={filterBasePath}
        filterSort={filterSort}
        filterScrollToId={filterScrollToId}
        ownedExpansions={ownedExpansions}
        onBaseView={viewExpansionId == null}
      />
      {ownedExpansions.length > 0 && (
        <div className="relative z-[2]">
          <ExpansionFamilyNav
            baseGame={baseGame}
            expansions={ownedExpansions}
            activeId={viewExpansionId}
            onSelectBase={onSelectBase}
            onSelectExpansion={onSelectExpansion}
            variant="card"
          />
        </div>
      )}
    </div>
  );
}

function VoteBadge({ points }: { points: number }) {
  if (points <= 0) return null;
  return (
    <span
      className="absolute top-2.5 right-2.5 z-[3] pointer-events-none bg-[var(--accent)] text-white rounded-full min-w-7 h-7 px-2 flex items-center justify-center gap-0.5"
      style={{ boxShadow: "var(--shadow-md)" }}
      aria-label={`${points} ${points === 1 ? "Stimme" : "Stimmen"}`}
    >
      {Array.from({ length: points }, (_, i) => (
        <CheckIcon key={i} size={13} />
      ))}
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
      className="absolute top-2.5 left-1/2 -translate-x-1/2 z-[3] shrink-0 h-7 max-w-[10rem] px-2 rounded-full text-[0.72rem] font-bold border tracking-tight truncate bg-[var(--surface)] text-[var(--foreground)] border-[var(--border)] flex items-center justify-center pointer-events-none"
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
      className="absolute top-0.5 left-0.5 z-[3] flex min-h-[2.75rem] min-w-[2.75rem] items-center justify-center"
      aria-label="Details anzeigen"
    >
      <span
        aria-hidden
        className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--foreground)] text-sm font-bold border border-[var(--border)] hover:bg-[var(--surface-2)]"
        style={{ boxShadow: "var(--shadow-md)" }}
      >
        ℹ
      </span>
    </button>
  );
}

function useDisplayedGame(game: GameCardGame, ownedExpansions: GameCardGame[]) {
  const [viewExpansionId, setViewExpansionId] = useState<number | null>(null);

  // Springt zurück zum Basisspiel, wenn die Karte ein anderes Spiel zeigt.
  const [prevGameId, setPrevGameId] = useState(game.id);
  if (game.id !== prevGameId) {
    setPrevGameId(game.id);
    setViewExpansionId(null);
  }

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
    filterSort,
    filterScrollToId,
    selected,
    selectedPoints,
    ownedExpansions = [],
    className = "",
    lentOut,
    hostRecommendation,
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

  const isFoil = (displayedGame.bggRating ?? 0) >= 8;

  const cardClass = `card card-game w-full ${isFoil ? "card-game-foil" : ""} ${
    showVoteState && selected ? "card-game-selected" : ""
  } ${disabled ? "card-game-disabled opacity-50 cursor-not-allowed" : ""} ${className}`;

  const bodyProps = {
    game: displayedGame,
    baseGame: game,
    playerCount,
    activeFilters,
    filterMode,
    filterBasePath,
    filterSort,
    filterScrollToId,
    ownedExpansions,
    viewExpansionId,
    onSelectBase: selectBase,
    onSelectExpansion: selectExpansion,
  };

  const expansionBadge =
    showExpansionBadge && viewExpansionId == null ? (
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
    hostRecommendation,
  };

  // Die Karte selbst ist ein <div>; die Aktivierung läuft über eine unsichtbare
  // Overlay-Fläche (.card-overlay). So entstehen keine verschachtelten
  // interaktiven Elemente (Chips/Erweiterungs-Nav liegen per z-index darüber).
  if ("href" in props && props.href) {
    return (
      <div className={`${cardClass} relative`}>
        <Link
          href={props.href}
          className="card-overlay"
          aria-label={displayedGame.name}
        />
        <CardCover {...coverProps} />
        <CardBody {...bodyProps} />
        {expansionBadge}
        {showVoteState && points > 0 && <VoteBadge points={points} />}
      </div>
    );
  }

  const activateProps = onActivate
    ? {
        onPointerUp: (e: PointerEvent<HTMLButtonElement>) => {
          if (disabled || e.button !== 0) return;
          if (pickMode && !onBaseView) return;
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

  const overlayLabel = onActivate
    ? `${displayedGame.name} – Punkte vergeben`
    : `${displayedGame.name} – Details anzeigen`;

  return (
    <div className={`${cardClass} relative`}>
      <button
        type="button"
        {...activateProps}
        disabled={disabled}
        className="card-overlay"
        aria-label={overlayLabel}
      />
      <CardCover {...coverProps} />
      <CardBody {...bodyProps} />
      {onDetailsClick && (
        <DetailsButton onClick={() => onDetailsClick(displayedGame)} />
      )}
      {expansionBadge}
      {showVoteState && points > 0 && <VoteBadge points={points} />}
    </div>
  );
}
