"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { GameDetailView, type GameDetailData } from "@/components/GameDetailView";
import type { GameCardGame } from "@/components/GameCard";
import type { GameFilters } from "@/lib/game-filters";

const DRAG_CLOSE_THRESHOLD = 100;
const DRAG_CLOSE_AFTER_DEMOTE = 60;
const DRAG_MAXIMIZE_THRESHOLD = 80;
const DRAG_CHAIN_DEADZONE = 5;
const PARTIAL_HEIGHT_RATIO = 0.85;

type SnapPoint = "partial" | "maximized";
type DragSource = "handle" | "body" | null;

type DragEndState = {
  height: number;
  translateY: number;
};

function isScrollAtTop(el: HTMLElement) {
  return el.scrollTop <= 1;
}

function isScrollAtBottom(el: HTMLElement) {
  return el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
}

function safeReleasePointerCapture(el: Element, pointerId: number) {
  try {
    if (el.hasPointerCapture(pointerId)) {
      el.releasePointerCapture(pointerId);
    }
  } catch {
    // pointer already released by browser
  }
}

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
  const chainEligibleRef = useRef(false);
  const gestureStartScrollTopRef = useRef(0);
  const gestureBlockedRef = useRef(false);
  const scrolledToBottomRef = useRef(false);
  const dragSourceRef = useRef<DragSource>(null);
  const pointerIdRef = useRef<number | null>(null);
  const captureTargetRef = useRef<Element | null>(null);
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
    chainEligibleRef.current = false;
    gestureStartScrollTopRef.current = 0;
    gestureBlockedRef.current = false;
    dragSourceRef.current = null;
    pointerIdRef.current = null;
    captureTargetRef.current = null;
    dragStartYRef.current = 0;
  }, []);

  const abortSheetDrag = useCallback(() => {
    if (captureTargetRef.current && pointerIdRef.current !== null) {
      safeReleasePointerCapture(
        captureTargetRef.current,
        pointerIdRef.current,
      );
    }
    clearDragVisuals();
  }, [clearDragVisuals]);

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

  const demoteToPartial = useCallback(() => {
    setSnapPoint("partial");
    bodyRef.current?.scrollTo({ top: 0 });
  }, []);

  const resolveSnapOnRelease = useCallback(
    (rawDelta: number, startSnap: SnapPoint) => {
      const { height, translateY } = computeDragState(rawDelta, startSnap);
      const vh = window.innerHeight;
      const partialH = vh * PARTIAL_HEIGHT_RATIO;
      const maxH = vh;
      const mid = (partialH + maxH) / 2;

      if (startSnap === "maximized" && rawDelta > 0) {
        const heightTravel = maxH - partialH;

        if (translateY === 0) {
          const progress = rawDelta / heightTravel;
          if (progress >= 0.5) {
            demoteToPartial();
          } else {
            setSnapPoint("maximized");
          }
        } else if (translateY >= DRAG_CLOSE_AFTER_DEMOTE) {
          dismiss();
        } else {
          demoteToPartial();
        }
        clearDragVisuals();
        return;
      }

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

      if (startSnap === "partial" && rawDelta > 0) {
        setSnapPoint("partial");
        clearDragVisuals();
        return;
      }

      clearDragVisuals();
    },
    [dismiss, clearDragVisuals, demoteToPartial],
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
    scrolledToBottomRef.current = false;
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

  const endSheetDrag = useCallback(
    (rawDelta: number) => {
      if (dragSourceRef.current === "body") {
        if (gestureBlockedRef.current || gestureStartScrollTopRef.current > 1) {
          abortSheetDrag();
          return;
        }

        const body = bodyRef.current;
        if (
          body &&
          isScrollAtBottom(body) &&
          gestureStartScrollTopRef.current > 1
        ) {
          abortSheetDrag();
          return;
        }
      }

      if (captureTargetRef.current && pointerIdRef.current !== null) {
        safeReleasePointerCapture(
          captureTargetRef.current,
          pointerIdRef.current,
        );
      }
      resolveSnapOnRelease(rawDelta, dragStartSnapRef.current);
    },
    [resolveSnapOnRelease, abortSheetDrag],
  );

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
      dragSourceRef.current = "handle";
      pointerIdRef.current = e.pointerId;
      dragStartYRef.current = e.clientY;
      dragStartSnapRef.current = snapPointRef.current;
      panelRef.current?.classList.add("modal-panel-dragging");
      captureTargetRef.current = e.currentTarget;
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
      endSheetDrag(rawDelta);
    },
    [endSheetDrag],
  );

  useEffect(() => {
    if (!game) return;

    const body = bodyRef.current;
    if (!body) return;

    const onScroll = () => {
      if (isScrollAtBottom(body)) {
        scrolledToBottomRef.current = true;
      }
      if (isScrollAtTop(body)) {
        scrolledToBottomRef.current = false;
      }
    };

    body.addEventListener("scroll", onScroll, { passive: true });
    return () => body.removeEventListener("scroll", onScroll);
  }, [game, viewGame]);

  useEffect(() => {
    if (!game) return;
    if (!window.matchMedia("(max-width: 639px)").matches) return;

    const scrollBody = bodyRef.current;
    if (!scrollBody) return;

    function initBodyGesture(
      body: HTMLDivElement,
      touchY: number,
      target: EventTarget | null,
    ) {
      if (!(target instanceof HTMLElement)) return false;
      if (target.closest("button, a")) return false;

      const scrollTop = body.scrollTop;
      gestureStartScrollTopRef.current = scrollTop;
      gestureBlockedRef.current =
        scrolledToBottomRef.current ||
        scrollTop > 1 ||
        isScrollAtBottom(body);
      chainEligibleRef.current =
        !gestureBlockedRef.current && isScrollAtTop(body);
      dragStartYRef.current = touchY;
      dragStartSnapRef.current = snapPointRef.current;
      sheetDragActiveRef.current = false;
      draggingRef.current = false;
      dragSourceRef.current = null;
      return true;
    }

    function onTouchStart(e: TouchEvent) {
      const body = bodyRef.current;
      if (!body || e.touches.length !== 1) return;
      initBodyGesture(body, e.touches[0].clientY, e.target);
    }

    function onTouchMove(e: TouchEvent) {
      const body = bodyRef.current;
      if (!body || e.touches.length !== 1) return;

      const touchY = e.touches[0].clientY;

      if (gestureBlockedRef.current) return;
      if (gestureStartScrollTopRef.current > 1) return;
      if (scrolledToBottomRef.current) return;

      if (!sheetDragActiveRef.current) {
        if (!chainEligibleRef.current) return;
        if (!isScrollAtTop(body)) return;
        if (isScrollAtBottom(body)) return;

        const rawDelta = touchY - dragStartYRef.current;
        if (rawDelta <= DRAG_CHAIN_DEADZONE) return;

        if (
          scrolledToBottomRef.current ||
          !isScrollAtTop(body) ||
          isScrollAtBottom(body)
        ) {
          gestureBlockedRef.current = true;
          return;
        }

        sheetDragActiveRef.current = true;
        draggingRef.current = true;
        dragSourceRef.current = "body";
        panelRef.current?.classList.add("modal-panel-dragging");
      } else {
        if (
          isScrollAtBottom(body) ||
          !isScrollAtTop(body) ||
          scrolledToBottomRef.current
        ) {
          gestureBlockedRef.current = true;
          return;
        }
      }

      const rawDelta = touchY - dragStartYRef.current;
      applyDragVisuals(rawDelta, dragStartSnapRef.current);
      e.preventDefault();
    }

    function onTouchEnd(e: TouchEvent) {
      if (sheetDragActiveRef.current && dragSourceRef.current === "body") {
        const touch = e.changedTouches[0];
        const rawDelta = touch ? touch.clientY - dragStartYRef.current : 0;
        endSheetDrag(rawDelta);
        return;
      }

      gestureStartScrollTopRef.current = 0;
      gestureBlockedRef.current = false;
      chainEligibleRef.current = false;
      dragStartYRef.current = 0;
    }

    scrollBody.addEventListener("touchstart", onTouchStart, { passive: true });
    scrollBody.addEventListener("touchmove", onTouchMove, { passive: false });
    scrollBody.addEventListener("touchend", onTouchEnd, { passive: true });
    scrollBody.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      scrollBody.removeEventListener("touchstart", onTouchStart);
      scrollBody.removeEventListener("touchmove", onTouchMove);
      scrollBody.removeEventListener("touchend", onTouchEnd);
      scrollBody.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [game, viewGame, applyDragVisuals, endSheetDrag]);

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

        <div ref={bodyRef} className="modal-body modal-body-chainable safe-bottom">
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
