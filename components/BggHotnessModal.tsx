"use client";

import { useCallback, useId, useRef, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { GameCover } from "@/components/GameCover";
import { GameDetailModal } from "@/components/GameDetailModal";
import { useEscapeKey } from "@/lib/use-escape-key";
import type { BggHotItem } from "@/lib/bgg";
import type { GameDetailData } from "@/lib/types/game";

type ThingResponse = {
  game?: GameDetailData;
  error?: string;
};

/** Anzahl der initial sichtbaren Eintraege sowie Schrittweite pro "Weitere laden". */
const PAGE_SIZE = 10;

/** Zugschwelle (px) zum Maximieren (hoch) bzw. Schliessen (runter). */
const MAXIMIZE_THRESHOLD = 60;
const CLOSE_THRESHOLD = 100;
/** Begrenzt das visuelle Mitziehen nach oben, solange nicht maximiert. */
const UP_DRAG_CLAMP = 48;

/**
 * Zeigt die aktuelle BGG-Hotness-Top-10 als Liste. Ein Tippen auf einen
 * Eintrag laedt die BGG-Details on-demand und oeffnet das Detailmodal.
 */
export function BggHotnessModal({
  items,
  onClose,
}: {
  items: BggHotItem[];
  onClose: () => void;
}) {
  const titleId = useId();
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<GameDetailData | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const visibleItems = items.slice(0, visibleCount);
  const hasMore = visibleCount < items.length;

  const closeDetail = useCallback(() => setSelected(null), []);

  const [maximized, setMaximized] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const startYRef = useRef(0);
  const pointerIdRef = useRef<number | null>(null);

  // Escape schliesst bei offenem Detailmodal nur dieses (eigenes Handling).
  useEscapeKey(onClose, selected === null);

  const clearDragVisuals = useCallback(() => {
    const panel = panelRef.current;
    const overlay = overlayRef.current;
    if (panel) {
      panel.style.transform = "";
      panel.classList.remove("modal-panel-dragging");
    }
    if (overlay) overlay.style.opacity = "";
    draggingRef.current = false;
    pointerIdRef.current = null;
    startYRef.current = 0;
  }, []);

  const onDragPointerDown = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button, a")) return;
    // Drag/Maximieren ist ein Mobile-Gestenkonzept; Desktop nutzt x/Klick/Escape.
    if (window.matchMedia("(min-width: 640px)").matches) return;

    draggingRef.current = true;
    pointerIdRef.current = e.pointerId;
    startYRef.current = e.clientY;
    panelRef.current?.classList.add("modal-panel-dragging");
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const onDragPointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current || e.pointerId !== pointerIdRef.current) return;
      const panel = panelRef.current;
      const overlay = overlayRef.current;
      const delta = e.clientY - startYRef.current;

      if (delta > 0) {
        if (panel) panel.style.transform = `translateY(${delta}px)`;
        if (overlay) {
          overlay.style.opacity = String(Math.max(0.35, 1 - delta / 400));
        }
      } else if (!maximized) {
        // Leichtes Mitziehen nach oben als Feedback fuers Maximieren.
        if (panel) {
          panel.style.transform = `translateY(${Math.max(delta, -UP_DRAG_CLAMP)}px)`;
        }
      } else if (panel) {
        panel.style.transform = "";
      }
      e.preventDefault();
    },
    [maximized],
  );

  const onDragPointerEnd = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current || e.pointerId !== pointerIdRef.current) return;
      const delta = e.clientY - startYRef.current;
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Pointer wurde vom Browser bereits freigegeben – ignorieren.
      }

      if (delta <= -MAXIMIZE_THRESHOLD && !maximized) {
        setMaximized(true);
        clearDragVisuals();
      } else if (delta >= CLOSE_THRESHOLD) {
        clearDragVisuals();
        onClose();
      } else {
        clearDragVisuals();
      }
    },
    [maximized, clearDragVisuals, onClose],
  );

  const dragZoneHandlers = {
    onPointerDown: onDragPointerDown,
    onPointerMove: onDragPointerMove,
    onPointerUp: onDragPointerEnd,
    onPointerCancel: onDragPointerEnd,
  };

  const openDetail = useCallback(
    async (item: BggHotItem) => {
      if (loadingId != null) return;
      setLoadingId(item.bggId);
      setError(null);
      try {
        const res = await fetch("/api/bgg/thing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: item.bggId,
            name: item.name,
            year: item.year,
            thumbnail: item.thumbnail,
          }),
        });
        const data = (await res.json()) as ThingResponse;
        if (!res.ok || !data.game) {
          setError(data.error ?? "Details konnten nicht geladen werden.");
          return;
        }
        setSelected(data.game);
      } catch {
        setError("Details konnten nicht geladen werden.");
      } finally {
        setLoadingId(null);
      }
    },
    [loadingId],
  );

  return (
    <>
      {createPortal(
        <div
          ref={overlayRef}
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={`modal-panel max-w-md modal-panel-snap-transition${
              maximized ? " modal-panel-maximized" : ""
            }`}
            tabIndex={-1}
          >
            <div className="modal-drag-zone relative" {...dragZoneHandlers}>
              <div className="modal-handle" aria-hidden />
              <h2
                id={titleId}
                className="text-sm font-semibold text-[var(--muted)]"
              >
                Top 10 · Beliebt auf BGG
              </h2>
              <button
                type="button"
                className="btn btn-ghost absolute right-2 top-1/2 -translate-y-1/2 min-w-[2.75rem] min-h-[2.75rem] px-0 text-lg leading-none sm:static sm:ml-auto sm:translate-y-0"
                onClick={onClose}
                onPointerDown={(e) => e.stopPropagation()}
                aria-label="Schließen"
              >
                ×
              </button>
            </div>

            <div className="modal-body flex flex-col gap-2 safe-bottom">
              {error && (
                <p className="text-sm text-[var(--danger)]" role="alert">
                  {error}
                </p>
              )}

              <ul className="flex flex-col gap-2">
                {visibleItems.map((item) => {
                  const isLoading = loadingId === item.bggId;
                  return (
                    <li key={item.bggId}>
                      <button
                        type="button"
                        onClick={() => void openDetail(item)}
                        disabled={loadingId != null}
                        aria-busy={isLoading}
                        className="flex w-full items-center gap-3 rounded-lg border border-[var(--border)] p-2 text-left transition-colors hover:bg-[var(--surface-2)] disabled:opacity-60"
                      >
                        <span
                          className="w-6 shrink-0 text-center text-sm font-bold text-[var(--muted)]"
                          aria-hidden
                        >
                          {item.rank}
                        </span>
                        <GameCover
                          src={item.thumbnail}
                          alt={item.name}
                          className="h-14 w-11 shrink-0 rounded"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">
                            {item.name}
                            {item.year != null && (
                              <span className="font-normal text-[var(--muted)]">
                                {" "}
                                ({item.year})
                              </span>
                            )}
                          </span>
                          {isLoading && (
                            <span className="block text-xs text-[var(--muted)]">
                              Lade Details …
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              {hasMore && (
                <button
                  type="button"
                  className="btn btn-ghost w-full"
                  onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                >
                  Weitere laden
                </button>
              )}

              <button
                type="button"
                className="btn btn-ghost w-full"
                onClick={onClose}
              >
                Schließen
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      <GameDetailModal
        game={selected}
        baseGame={selected ?? undefined}
        onClose={closeDetail}
      />
    </>
  );
}
