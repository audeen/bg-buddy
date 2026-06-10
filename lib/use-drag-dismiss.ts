"use client";

import { useCallback, useEffect, useRef, type PointerEvent } from "react";

const DRAG_CLOSE_THRESHOLD = 100;

/**
 * Drag-to-dismiss für Bottom-Sheet-Modals (nur Mobile):
 * Panel folgt dem Finger, ab Schwellwert wird `onDismiss` aufgerufen.
 */
export function useDragToDismiss(onDismiss: () => void) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragStartYRef = useRef(0);
  const draggingRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  });

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

  const onPointerDown = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button, a")) return;
    if (window.matchMedia("(min-width: 640px)").matches) return;

    draggingRef.current = true;
    pointerIdRef.current = e.pointerId;
    dragStartYRef.current = e.clientY;
    panelRef.current?.classList.add("modal-panel-dragging");
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current || e.pointerId !== pointerIdRef.current) return;

      const delta = Math.max(0, e.clientY - dragStartYRef.current);
      applyDragVisuals(delta);
      if (delta > 0) e.preventDefault();
    },
    [applyDragVisuals],
  );

  const onPointerEnd = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current || e.pointerId !== pointerIdRef.current) return;

      const delta = Math.max(0, e.clientY - dragStartYRef.current);
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }

      if (delta >= DRAG_CLOSE_THRESHOLD) {
        clearDragVisuals();
        onDismissRef.current();
      } else {
        clearDragVisuals();
      }
    },
    [clearDragVisuals],
  );

  return {
    overlayRef,
    panelRef,
    dragZoneHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerEnd,
      onPointerCancel: onPointerEnd,
    },
  };
}
