"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GameCover } from "@/components/GameCover";
import { GameDetailModal } from "@/components/GameDetailModal";
import type { GameCardGame, GameDetailData } from "@/lib/types/game";
import { resolveCoverSrc } from "@/lib/cover-image";
import {
  buildGameTags,
  chipClassForVariant,
  groupGameTags,
  type GameTag,
} from "@/lib/game-tags";

function GotdChipMarquee({ label, meta }: { label: string; meta: GameTag[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [marquee, setMarquee] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    const track = trackRef.current;
    if (!container || !track || meta.length === 0) {
      setMarquee(false);
      return;
    }

    const update = () => {
      const contentWidth = marquee
        ? track.scrollWidth / 2
        : track.scrollWidth;
      const overflow = contentWidth > container.clientWidth + 1;
      setMarquee(overflow);
      if (overflow) {
        const duration = Math.max(10, contentWidth / 28);
        track.style.setProperty("--gotd-marquee-duration", `${duration}s`);
      }
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    observer.observe(track);
    return () => observer.disconnect();
  }, [meta, marquee]);

  function renderMetaChips(suffix: string, hidden = false) {
    return meta.map((tag) => (
      <span
        key={`${tag.label}${suffix}`}
        className={`${chipClassForVariant(tag.variant)} shrink-0`}
        aria-hidden={hidden || undefined}
      >
        {tag.label}
      </span>
    ));
  }

  return (
    <div className="gotd-chip-header">
      <span className="chip chip-accent shrink-0">{label}</span>
      {meta.length > 0 && (
        <div ref={containerRef} className="gotd-chip-marquee min-w-0 flex-1">
          <div
            ref={trackRef}
            className={`chip-row items-center gotd-chip-marquee-track${
              marquee ? " gotd-chip-marquee-animate" : ""
            }`}
          >
            {renderMetaChips("")}
            {marquee && renderMetaChips("-dup", true)}
          </div>
        </div>
      )}
    </div>
  );
}

export function GameOfTheDayCard({
  game,
  playerCount,
  ownedExpansions = [],
  label = "Spiel des Tages",
  onOpenChange,
}: {
  game: GameDetailData;
  playerCount?: number;
  ownedExpansions?: GameCardGame[];
  label?: string;
  /** Meldet das Öffnen/Schließen des Detail-Modals (z.B. zum Pausieren des Carousels). */
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const closeDetail = useCallback(() => setOpen(false), []);

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);
  const tags = buildGameTags(game, { playerCount, ownedExpansions });
  const { meta, content } = groupGameTags(tags);
  const coverSrc = resolveCoverSrc(game);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="card card-pad flex flex-col gap-3 hover:opacity-90 transition-opacity text-left w-full"
      >
        <GotdChipMarquee label={label} meta={meta} />

        <div className="flex gap-4 items-center">
          <GameCover
            src={coverSrc}
            alt={game.name}
            className="w-28 sm:w-32 aspect-[3/4] rounded-[var(--radius)] shrink-0"
          />
          <div className="flex flex-col gap-2 min-w-0 flex-1">
            <span className="font-bold text-lg leading-snug line-clamp-2">
              {game.name}
              {game.year != null && (
                <span className="font-normal text-[var(--muted)] text-base">
                  {" "}
                  ({game.year})
                </span>
              )}
            </span>
            {content.length > 0 && (
              <div className="chip-row">
                {content.map((tag) => (
                  <span
                    key={tag.label}
                    className={chipClassForVariant(tag.variant)}
                  >
                    {tag.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </button>

      <GameDetailModal
        game={open ? game : null}
        baseGame={game}
        onClose={closeDetail}
        playerCount={playerCount}
        ownedExpansions={ownedExpansions}
      />
    </>
  );
}

export function GameOfTheDayEmpty() {
  return (
    <div
      className="card card-pad flex flex-col gap-2"
    >
      <span className="chip chip-accent w-fit">Spiel des Tages</span>
      <p className="text-sm text-[var(--muted)]">
        Keine verfügbaren Spiele in der Sammlung.
      </p>
    </div>
  );
}
