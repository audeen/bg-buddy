"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  GameOfTheDayCard,
  GameOfTheDayEmpty,
} from "@/components/GameOfTheDayCard";
import type { GameCardGame, GameDetailData } from "@/lib/types/game";
import { pickLatestGameFromPool } from "@/lib/spotlight-pick";
import { prefersReducedMotion } from "@/lib/motion";

const SEEN_KEY = "bg-buddy-spotlight-seen";
const LAST_LATEST_ID_KEY = "bg-buddy-last-latest-id";
const AUTO_ADVANCE_MS = 10_000;
const SWIPE_THRESHOLD_PX = 40;

function decideLatestGame(latestPool: GameDetailData[]): GameDetailData | null {
  let isFirstVisit = false;
  let lastShownId: number | null = null;
  try {
    isFirstVisit = sessionStorage.getItem(SEEN_KEY) == null;
    const rawId = sessionStorage.getItem(LAST_LATEST_ID_KEY);
    const parsed = rawId != null ? parseInt(rawId, 10) : NaN;
    lastShownId = Number.isFinite(parsed) ? parsed : null;
  } catch {
    // sessionStorage nicht verfügbar (z.B. Privacy-Modus) → wie Folgebesuch.
  }
  return pickLatestGameFromPool(latestPool, lastShownId, isFirstVisit);
}

/** Wählt den Neuzugang einmal pro Mount, clientseitig nach Hydration. */
function createLatestGameStore(latestPool: GameDetailData[]) {
  let decided = false;
  let game: GameDetailData | null = null;
  return {
    subscribe: () => () => {},
    getSnapshot: (): GameDetailData | null => {
      if (!decided) {
        decided = true;
        game = decideLatestGame(latestPool);
      }
      return game;
    },
  };
}

const getServerSnapshot = (): GameDetailData | null => null;

function CarouselArrow({
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
      aria-label={isPrev ? "Vorherige Karte" : "Nächste Karte"}
      className={`absolute top-1/2 -translate-y-1/2 z-[2] flex min-h-[2.75rem] min-w-[2.75rem] items-center justify-center rounded-full ${
        isPrev ? "-left-4" : "-right-4"
      }`}
    >
      <span
        aria-hidden
        className="flex h-7 w-7 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-opacity hover:bg-black/65"
      >
        <svg
          width="14"
          height="14"
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

type Slide = {
  key: string;
  label: string;
  game: GameDetailData;
  playerCount?: number;
  ownedExpansions: GameCardGame[];
};

/**
 * Spotlight-Carousel der Startseite: "Spiel des Tages", "Neu in der Sammlung"
 * und "BGG Hotness" als Slides. Wechselt automatisch alle 10 s, solange die
 * Seite sichtbar ist und nicht interagiert wird; Pfeile, Punkte und Swipe
 * erlauben manuelles Wechseln (stoppt den Auto-Wechsel).
 * SSR rendert den ersten Slide; der Neuzugang wird nach der Hydration gewählt.
 */
export function HomeSpotlightCarousel({
  gotdGame,
  gotdPlayerCount,
  expansionsByBaseId,
  latestPool,
  hotnessGame,
  hotnessRank,
}: {
  gotdGame: GameDetailData | null;
  gotdPlayerCount?: number;
  expansionsByBaseId: Record<string, GameCardGame[]>;
  latestPool: GameDetailData[];
  hotnessGame: GameDetailData | null;
  hotnessRank?: number;
}) {
  const [store] = useState(() => createLatestGameStore(latestPool));
  const latestGame = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    getServerSnapshot,
  );

  useEffect(() => {
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
      if (latestGame) {
        sessionStorage.setItem(LAST_LATEST_ID_KEY, String(latestGame.id));
      }
    } catch {
      // ignorieren
    }
  }, [latestGame]);

  const slides = useMemo<Slide[]>(() => {
    const out: Slide[] = [];
    if (gotdGame) {
      out.push({
        key: "gotd",
        label: "Spiel des Tages",
        game: gotdGame,
        playerCount: gotdPlayerCount,
        ownedExpansions: expansionsByBaseId[String(gotdGame.id)] ?? [],
      });
    }
    if (latestGame) {
      out.push({
        key: `latest-${latestGame.id}`,
        label: "Neu in der Sammlung",
        game: latestGame,
        ownedExpansions: expansionsByBaseId[String(latestGame.id)] ?? [],
      });
    }
    if (hotnessGame) {
      out.push({
        key: "hotness",
        label:
          hotnessRank != null
            ? `Beliebt auf BGG · #${hotnessRank}`
            : "Beliebt auf BGG",
        game: hotnessGame,
        ownedExpansions: expansionsByBaseId[String(hotnessGame.id)] ?? [],
      });
    }
    return out;
  }, [gotdGame, gotdPlayerCount, latestGame, hotnessGame, hotnessRank, expansionsByBaseId]);

  const count = slides.length;
  const [index, setIndex] = useState(0);
  const [stopped, setStopped] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [pageHidden, setPageHidden] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const safeIndex = count > 0 ? index % count : 0;

  const step = useCallback(
    (delta: number, manual: boolean) => {
      if (manual) setStopped(true);
      setIndex((i) => {
        const next = (i + delta) % count;
        return next < 0 ? next + count : next;
      });
    },
    [count],
  );

  const goTo = useCallback((target: number) => {
    setStopped(true);
    setIndex(target);
  }, []);

  useEffect(() => {
    const onVisibility = () => setPageHidden(document.hidden);
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (stopped || hovering || modalOpen || pageHidden || count < 2) return;
    if (prefersReducedMotion()) return;
    const timer = setInterval(() => step(1, false), AUTO_ADVANCE_MS);
    return () => clearInterval(timer);
  }, [stopped, hovering, modalOpen, pageHidden, count, step]);

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

  const slide = slides[safeIndex] ?? null;
  if (!slide) return <GameOfTheDayEmpty />;

  return (
    <div
      className="flex flex-col gap-2"
      role="group"
      aria-roledescription="Karussell"
      aria-label="Spiele-Empfehlungen"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="relative">
        <div
          key={slide.key}
          className="spotlight-slide-enter"
          role="group"
          aria-roledescription="Slide"
          aria-label={`${slide.label} (${safeIndex + 1} von ${count})`}
        >
          <GameOfTheDayCard
            game={slide.game}
            playerCount={slide.playerCount}
            ownedExpansions={slide.ownedExpansions}
            label={slide.label}
            onOpenChange={setModalOpen}
          />
        </div>

        {count > 1 && (
          <>
            <CarouselArrow direction="prev" onClick={() => step(-1, true)} />
            <CarouselArrow direction="next" onClick={() => step(1, true)} />
          </>
        )}
      </div>

      {count > 1 && (
        <div className="flex items-center justify-center">
          {slides.map((s, i) => (
            <button
              key={s.key}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`${s.label} anzeigen`}
              aria-current={i === safeIndex ? "true" : undefined}
              className="flex min-h-[2.75rem] min-w-[1.75rem] items-center justify-center"
            >
              <span
                aria-hidden
                className={`h-2 rounded-full transition-all ${
                  i === safeIndex
                    ? "w-5 bg-[var(--gold)]"
                    : "w-2 bg-[var(--border)] hover:bg-[var(--muted)]"
                }`}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
