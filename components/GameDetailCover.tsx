"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GameCover } from "@/components/GameCover";
import { resolveCoverSrc } from "@/lib/cover-image";
import type { BggGalleryImage, BggGalleryPage } from "@/lib/bgg/gallery";
import type { GameDetailData } from "@/lib/types/game";
import { prefersReducedMotion } from "@/lib/motion";

const AUTO_ADVANCE_MS = 10_000;
const SWIPE_THRESHOLD_PX = 40;

type Slide = {
  src: string;
  caption: string | null;
};

function ArrowButton({
  direction,
  onClick,
}: {
  direction: "prev" | "next";
  onClick: () => void;
}) {
  const isPrev = direction === "prev";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isPrev ? "Vorheriges Bild" : "Nächstes Bild"}
      className={`absolute top-1/2 -translate-y-1/2 z-[2] flex min-h-[2.75rem] min-w-[2.75rem] items-center justify-center ${
        isPrev ? "left-1" : "right-1"
      }`}
    >
      <span
        aria-hidden
        className="flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-opacity hover:bg-black/65"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          {isPrev ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 18l6-6-6-6" />}
        </svg>
      </span>
    </button>
  );
}

/**
 * Cover der Detailansicht: zeigt sofort das aufgelöste Cover und lädt die
 * BGG-Galerie lazy nach. Wechselt automatisch alle 10 s das Bild; Pfeile und
 * Swipe erlauben manuelles Steppen (pausiert den Auto-Wechsel).
 */
export function GameDetailCover({
  game,
  compact = false,
}: {
  game: GameDetailData;
  compact?: boolean;
}) {
  const coverSrc = resolveCoverSrc(game);
  const [galleryImages, setGalleryImages] = useState<BggGalleryImage[]>([]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/bgg/images?gameId=${game.id}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: BggGalleryPage | null) => {
        if (data?.images) setGalleryImages(data.images);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [game.id]);

  const slides = useMemo<Slide[]>(() => {
    const out: Slide[] = [];
    if (coverSrc) out.push({ src: coverSrc, caption: null });
    for (const img of galleryImages) {
      if (img.large === coverSrc) continue;
      out.push({ src: img.large, caption: img.caption });
    }
    return out;
  }, [coverSrc, galleryImages]);

  const count = slides.length;
  const safeIndex = count > 0 ? index % count : 0;

  const step = useCallback(
    (delta: number, manual: boolean) => {
      if (manual) setPaused(true);
      setIndex((i) => {
        const next = (i + delta) % count;
        return next < 0 ? next + count : next;
      });
    },
    [count],
  );

  useEffect(() => {
    if (paused || count < 2) return;
    if (prefersReducedMotion()) return;
    const timer = setInterval(() => step(1, false), AUTO_ADVANCE_MS);
    return () => clearInterval(timer);
  }, [paused, count, step]);

  // Nächstes Bild vorladen, damit der Wechsel ohne Flackern passiert.
  useEffect(() => {
    if (count < 2) return;
    const next = slides[(safeIndex + 1) % count];
    const img = new Image();
    img.src = next.src;
  }, [safeIndex, slides, count]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const startX = touchStartX.current;
    touchStartX.current = null;
    if (startX == null || count < 2) return;
    const endX = e.changedTouches[0]?.clientX ?? startX;
    const delta = endX - startX;
    if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return;
    step(delta < 0 ? 1 : -1, true);
  };

  const current = slides[safeIndex] ?? null;

  return (
    <div
      className="card overflow-hidden flex flex-col"
      style={{ boxShadow: "var(--shadow-md)" }}
    >
      <div
        className="relative"
        role="group"
        aria-roledescription="Karussell"
        aria-label={`Bilder von ${game.name}`}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <GameCover
          key={current?.src ?? "placeholder"}
          src={current?.src ?? null}
          alt={current?.caption ?? game.name}
          className={`w-full aspect-square ${compact ? "" : "md:aspect-auto md:min-h-[260px]"}`}
        />

        {count > 1 && (
          <>
            <ArrowButton direction="prev" onClick={() => step(-1, true)} />
            <ArrowButton direction="next" onClick={() => step(1, true)} />
            <span
              className="absolute bottom-2 right-2 z-[2] rounded-full bg-black/45 px-2 py-0.5 text-xs font-medium text-white backdrop-blur-sm"
              aria-live="polite"
            >
              {safeIndex + 1}/{count}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
