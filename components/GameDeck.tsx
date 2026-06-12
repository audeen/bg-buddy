"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

function DeckArrow({
  direction,
  disabled,
  onClick,
}: {
  direction: "prev" | "next";
  disabled: boolean;
  onClick: () => void;
}) {
  const isPrev = direction === "prev";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={isPrev ? "Vorherige Karte" : "Nächste Karte"}
      className={`absolute top-1/2 -translate-y-1/2 z-[4] flex min-h-[2.75rem] min-w-[2.75rem] items-center justify-center disabled:opacity-0 disabled:pointer-events-none ${
        isPrev ? "left-0" : "right-0"
      }`}
    >
      <span
        aria-hidden
        className="flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-opacity hover:bg-black/65"
      >
        <svg
          width="15"
          height="15"
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
 * Swipebare Deck-Ansicht: eine Karte groß und zentriert, Nachbarn im
 * Anschnitt. Blättern per nativem Scroll-Snap (Touch-Wisch), Pfeilen
 * (Desktop/Maus) oder Tastatur (Scroll-Container ist fokussierbar).
 */
export function GameDeck<T>({
  items,
  getKey,
  renderItem,
  label,
}: {
  items: T[];
  getKey: (item: T) => string | number;
  renderItem: (item: T, index: number) => ReactNode;
  label: string;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  const rafRef = useRef<number | null>(null);
  const [index, setIndex] = useState(0);
  const count = items.length;

  const indexFromScroll = useCallback(() => {
    const list = listRef.current;
    if (!list) return 0;
    const center = list.scrollLeft + list.clientWidth / 2;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < list.children.length; i++) {
      const child = list.children[i] as HTMLElement;
      const dist = Math.abs(child.offsetLeft + child.offsetWidth / 2 - center);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    return best;
  }, []);

  const onScroll = () => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      setIndex(indexFromScroll());
    });
  };

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Neue Liste (Filter/Sortierung/Spieleranzahl) → zurück zur ersten Karte.
  const [prevItems, setPrevItems] = useState(items);
  if (items !== prevItems) {
    setPrevItems(items);
    setIndex(0);
  }
  useEffect(() => {
    listRef.current?.scrollTo({ left: 0, behavior: "instant" });
  }, [items]);

  const step = (delta: number) => {
    const list = listRef.current;
    if (!list) return;
    const target = Math.min(Math.max(index + delta, 0), count - 1);
    const child = list.children[target] as HTMLElement | undefined;
    if (!child) return;
    // behavior "auto" → respektiert scroll-behavior aus dem CSS.
    list.scrollTo({
      left: child.offsetLeft - (list.clientWidth - child.offsetWidth) / 2,
    });
  };

  return (
    <div
      className="flex flex-col gap-1.5"
      role="group"
      aria-roledescription="Karussell"
      aria-label={label}
    >
      <div className="relative game-deck-viewport">
        <ul ref={listRef} onScroll={onScroll} className="game-deck" tabIndex={0}>
          {items.map((item, i) => (
            <li key={getKey(item)} className="game-deck-item">
              {renderItem(item, i)}
            </li>
          ))}
        </ul>
        {count > 1 && (
          <>
            <DeckArrow
              direction="prev"
              onClick={() => step(-1)}
              disabled={index <= 0}
            />
            <DeckArrow
              direction="next"
              onClick={() => step(1)}
              disabled={index >= count - 1}
            />
          </>
        )}
      </div>
      {count > 1 && (
        <p
          className="text-center text-sm text-[var(--muted)] tabular-nums"
          aria-live="polite"
        >
          {Math.min(index + 1, count)} / {count}
        </p>
      )}
    </div>
  );
}
