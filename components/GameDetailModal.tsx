"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { GameDetailView, type GameDetailData } from "@/components/GameDetailView";
import type { GameCardGame } from "@/components/GameCard";
import type { GameFilters } from "@/lib/game-filters";

const DRAG_CLOSE_THRESHOLD = 100;

type GameDetailModalProps = {
  game: GameDetailData | null;
  onClose: () => void;
  playerCount?: number;
  activeFilters?: GameFilters;
  filterMode?: boolean;
  ownedExpansions?: GameCardGame[];
};

export function GameDetailModal({
  game,
  onClose,
  playerCount,
  activeFilters,
  filterMode,
  ownedExpansions = [],
}: GameDetailModalProps) {
  const titleId = useId();
  const [viewGame, setViewGame] = useState<GameDetailData | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const historyPushedRef = useRef(false);
  const skipPopCloseRef = useRef(false);
  const dragStartYRef = useRef(0);
  const draggingRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);

  useEffect(() => {
    setViewGame(game);
  }, [game]);

  const dismiss = useCallback(() => {
    if (historyPushedRef.current) {
      historyPushedRef.current = false;
      skipPopCloseRef.current = true;
      window.history.back();
    }
    onClose();
  }, [onClose]);

  const clearDragVisuals = useCallback(() => {
    const panel = panelRef.current;
    const overlay = overlayRef.current;
    if (panel) {
      panel.style.transform = "";
      panel.classList.remove("modal-panel-dragging");
    }
    if (overlay) {
      overlay.style.opacity = "";
    }
    draggingRef.current = false;
    pointerIdRef.current = null;
    dragStartYRef.current = 0;
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        dismiss();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button, a[href], [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [dismiss],
  );

  useEffect(() => {
    if (!game) return;

    window.history.pushState({ gameDetailModal: true }, "");
    historyPushedRef.current = true;
    clearDragVisuals();

    const onPopState = () => {
      if (skipPopCloseRef.current) {
        skipPopCloseRef.current = false;
        return;
      }
      historyPushedRef.current = false;
      onClose();
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    window.addEventListener("popstate", onPopState);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("popstate", onPopState);
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      clearDragVisuals();
      if (historyPushedRef.current) {
        historyPushedRef.current = false;
        skipPopCloseRef.current = true;
        window.history.back();
      }
    };
  }, [game, onClose, handleKeyDown, clearDragVisuals]);

  const applyDragVisuals = useCallback((delta: number) => {
    const panel = panelRef.current;
    const overlay = overlayRef.current;
    if (panel) {
      panel.style.transform = delta > 0 ? `translateY(${delta}px)` : "";
    }
    if (overlay) {
      overlay.style.opacity =
        delta > 0 ? String(Math.max(0.35, 1 - delta / 400)) : "";
    }
  }, []);

  const onDragPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      if ((e.target as HTMLElement).closest("button, a")) return;
      if (window.matchMedia("(min-width: 640px)").matches) return;

      draggingRef.current = true;
      pointerIdRef.current = e.pointerId;
      dragStartYRef.current = e.clientY;
      panelRef.current?.classList.add("modal-panel-dragging");
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [],
  );

  const onDragPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current || e.pointerId !== pointerIdRef.current) return;

      const delta = Math.max(0, e.clientY - dragStartYRef.current);
      applyDragVisuals(delta);
      if (delta > 0) e.preventDefault();
    },
    [applyDragVisuals],
  );

  const onDragPointerEnd = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current || e.pointerId !== pointerIdRef.current) return;

      const delta = Math.max(0, e.clientY - dragStartYRef.current);
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }

      if (delta >= DRAG_CLOSE_THRESHOLD) {
        dismiss();
      } else {
        clearDragVisuals();
      }
    },
    [dismiss, clearDragVisuals],
  );

  if (!game || !viewGame) return null;

  const baseGame = game;
  const modalExpansions =
    !baseGame.isExpansion && ownedExpansions.length > 0
      ? ownedExpansions
      : undefined;

  return (
    <div
      ref={overlayRef}
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) dismiss();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="modal-panel"
        tabIndex={-1}
      >
        <div
          className="modal-drag-zone"
          onPointerDown={onDragPointerDown}
          onPointerMove={onDragPointerMove}
          onPointerUp={onDragPointerEnd}
          onPointerCancel={onDragPointerEnd}
        >
          <div className="modal-handle" aria-hidden />
          <span className="text-sm font-semibold text-[var(--muted)]">
            Spielinfo
          </span>
        </div>

        <div className="modal-body safe-bottom">
          <GameDetailView
            game={viewGame}
            titleId={titleId}
            compact
            playerCount={playerCount}
            activeFilters={activeFilters}
            filterMode={filterMode}
            onFilterNavigate={dismiss}
            ownedExpansions={modalExpansions}
            onSelectExpansion={(id) => {
              const exp = ownedExpansions.find((e) => e.id === id);
              if (exp) setViewGame(exp as GameDetailData);
            }}
            onSelectBase={() => setViewGame(baseGame)}
            baseGameId={baseGame.id}
            baseGameName={baseGame.name}
          />
        </div>
      </div>
    </div>
  );
}
