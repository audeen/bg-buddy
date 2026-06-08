"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { GameDetailView, type GameDetailData } from "@/components/GameDetailView";
import type { GameCardGame } from "@/components/GameCard";
import type { GameFilters } from "@/lib/game-filters";

const DRAG_CLOSE_THRESHOLD = 100;
const DRAG_MAXIMIZE_THRESHOLD = 80;
const PARTIAL_HEIGHT_RATIO = 0.85;

type SnapPoint = "partial" | "maximized";

type DragEndState = {
  height: number;
  translateY: number;
};

function computeDragState(rawDelta: number, startSnap: SnapPoint): DragEndState {
  const vh = window.innerHeight;
  const partialH = vh * PARTIAL_HEIGHT_RATIO;
  const maxH = vh;
  const heightTravel = maxH - partialH;

  if (startSnap === "partial") {
    if (rawDelta < 0) {
      const upAmount = Math.min(-rawDelta, heightTravel);
      return { height: partialH + upAmount, translateY: 0 };
    }
    return { height: partialH, translateY: rawDelta };
  }

  if (rawDelta > 0) {
    if (rawDelta <= heightTravel) {
      return { height: maxH - rawDelta, translateY: 0 };
    }
    return { height: partialH, translateY: rawDelta - heightTravel };
  }

  return { height: maxH, translateY: 0 };
}

type GameDetailModalProps = {
  game: GameDetailData | null;
  baseGame?: GameDetailData;
  onClose: () => void;
  playerCount?: number;
  activeFilters?: GameFilters;
  filterMode?: boolean;
  ownedExpansions?: GameCardGame[];
};

export function GameDetailModal({
  game,
  baseGame,
  onClose,
  playerCount,
  activeFilters,
  filterMode,
  ownedExpansions = [],
}: GameDetailModalProps) {
  const titleId = useId();
  const [viewGame, setViewGame] = useState<GameDetailData | null>(null);
  const [snapPoint, setSnapPoint] = useState<SnapPoint>("partial");
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const historyPushedRef = useRef(false);
  const skipPopCloseRef = useRef(false);
  const dragStartYRef = useRef(0);
  const dragStartSnapRef = useRef<SnapPoint>("partial");
  const draggingRef = useRef(false);
  const sheetDragActiveRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const snapPointRef = useRef<SnapPoint>("partial");

  useEffect(() => {
    snapPointRef.current = snapPoint;
  }, [snapPoint]);

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
      panel.style.height = "";
      panel.style.maxHeight = "";
      panel.classList.remove("modal-panel-dragging");
    }
    if (overlay) {
      overlay.style.opacity = "";
    }
    draggingRef.current = false;
    sheetDragActiveRef.current = false;
    pointerIdRef.current = null;
    dragStartYRef.current = 0;
  }, []);

  const applyDragVisuals = useCallback((rawDelta: number, startSnap: SnapPoint) => {
    const panel = panelRef.current;
    const overlay = overlayRef.current;
    if (!panel) return;

    const { height, translateY } = computeDragState(rawDelta, startSnap);
    panel.style.height = `${height}px`;
    panel.style.maxHeight = `${height}px`;
    panel.style.transform = translateY > 0 ? `translateY(${translateY}px)` : "";

    if (overlay) {
      overlay.style.opacity =
        translateY > 0 ? String(Math.max(0.35, 1 - translateY / 400)) : "";
    }
  }, []);

  const resolveSnapOnRelease = useCallback(
    (rawDelta: number, startSnap: SnapPoint) => {
      const { height, translateY } = computeDragState(rawDelta, startSnap);
      const vh = window.innerHeight;
      const partialH = vh * PARTIAL_HEIGHT_RATIO;
      const maxH = vh;
      const mid = (partialH + maxH) / 2;

      if (translateY >= DRAG_CLOSE_THRESHOLD) {
        dismiss();
        return;
      }

      if (startSnap === "partial" && rawDelta < 0) {
        if (-rawDelta >= DRAG_MAXIMIZE_THRESHOLD || height >= mid) {
          setSnapPoint("maximized");
        } else {
          setSnapPoint("partial");
        }
        clearDragVisuals();
        return;
      }

      if (startSnap === "maximized" && rawDelta > 0) {
        const heightTravel = maxH - partialH;

        if (translateY === 0) {
          const progress = rawDelta / heightTravel;
          setSnapPoint(progress >= 0.5 ? "partial" : "maximized");
        } else {
          setSnapPoint("partial");
        }
        clearDragVisuals();
        return;
      }

      if (startSnap === "partial" && rawDelta > 0) {
        setSnapPoint("partial");
        clearDragVisuals();
        return;
      }

      clearDragVisuals();
    },
    [dismiss, clearDragVisuals],
  );

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

    setSnapPoint("partial");
    snapPointRef.current = "partial";
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

  const isMobileSheet = useCallback(() => {
    return window.matchMedia("(max-width: 639px)").matches;
  }, []);

  const onHandlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      if ((e.target as HTMLElement).closest("button, a")) return;
      if (!isMobileSheet()) return;

      draggingRef.current = true;
      sheetDragActiveRef.current = true;
      pointerIdRef.current = e.pointerId;
      dragStartYRef.current = e.clientY;
      dragStartSnapRef.current = snapPointRef.current;
      panelRef.current?.classList.add("modal-panel-dragging");
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [isMobileSheet],
  );

  const onHandlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!sheetDragActiveRef.current || e.pointerId !== pointerIdRef.current) {
        return;
      }

      const rawDelta = e.clientY - dragStartYRef.current;
      applyDragVisuals(rawDelta, dragStartSnapRef.current);
      e.preventDefault();
    },
    [applyDragVisuals],
  );

  const onHandlePointerEnd = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!sheetDragActiveRef.current || e.pointerId !== pointerIdRef.current) {
        return;
      }

      const rawDelta = e.clientY - dragStartYRef.current;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }

      resolveSnapOnRelease(rawDelta, dragStartSnapRef.current);
    },
    [resolveSnapOnRelease],
  );

  const onBodyPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      if ((e.target as HTMLElement).closest("button, a")) return;
      if (!isMobileSheet()) return;

      pointerIdRef.current = e.pointerId;
      dragStartYRef.current = e.clientY;
      dragStartSnapRef.current = snapPointRef.current;
      sheetDragActiveRef.current = false;
      draggingRef.current = false;
    },
    [isMobileSheet],
  );

  const onBodyPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerId !== pointerIdRef.current) return;

      const rawDelta = e.clientY - dragStartYRef.current;

      if (!sheetDragActiveRef.current) {
        if ((bodyRef.current?.scrollTop ?? 0) > 0) return;
        if (rawDelta <= 0) return;

        sheetDragActiveRef.current = true;
        draggingRef.current = true;
        panelRef.current?.classList.add("modal-panel-dragging");
        e.currentTarget.setPointerCapture(e.pointerId);
      }

      applyDragVisuals(rawDelta, dragStartSnapRef.current);
      e.preventDefault();
    },
    [applyDragVisuals],
  );

  const onBodyPointerEnd = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerId !== pointerIdRef.current) return;

      if (sheetDragActiveRef.current) {
        const rawDelta = e.clientY - dragStartYRef.current;
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
        resolveSnapOnRelease(rawDelta, dragStartSnapRef.current);
        return;
      }

      pointerIdRef.current = null;
      dragStartYRef.current = 0;
    },
    [resolveSnapOnRelease],
  );

  if (!game || !viewGame) return null;

  const effectiveBase = baseGame ?? game;
  const modalExpansions =
    effectiveBase && !effectiveBase.isExpansion && ownedExpansions.length > 0
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
        className={`modal-panel modal-panel-snap-transition${snapPoint === "maximized" ? " modal-panel-maximized" : ""}`}
        tabIndex={-1}
      >
        <div
          className="modal-drag-zone"
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerEnd}
          onPointerCancel={onHandlePointerEnd}
        >
          <div className="modal-handle" aria-hidden />
          <span className="text-sm font-semibold text-[var(--muted)]">
            Spielinfo
          </span>
        </div>

        <div
          ref={bodyRef}
          className="modal-body modal-body-chainable safe-bottom"
          onPointerDown={onBodyPointerDown}
          onPointerMove={onBodyPointerMove}
          onPointerUp={onBodyPointerEnd}
          onPointerCancel={onBodyPointerEnd}
        >
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
            onSelectBase={() => setViewGame(effectiveBase)}
            baseGameId={effectiveBase.id}
            baseGameName={effectiveBase.name}
          />
        </div>
      </div>
    </div>
  );
}
