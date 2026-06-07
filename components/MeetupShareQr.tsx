"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import QRCode from "react-qr-code";

const DRAG_CLOSE_THRESHOLD = 100;

function QrIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h2v2h-2z" />
      <path d="M18 14h3v3h-3z" />
      <path d="M14 18h2v3h-2z" />
      <path d="M18 18h1v1h-1z" />
      <path d="M20 18h1v3h-1z" />
    </svg>
  );
}

export function MeetupShareQr({
  meetupId,
  title,
}: {
  meetupId: string;
  title: string;
}) {
  const titleId = useId();
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragStartYRef = useRef(0);
  const draggingRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);

  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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

  const close = useCallback(() => {
    clearDragVisuals();
    setOpen(false);
    setCopied(false);
  }, [clearDragVisuals]);

  function handleOpen() {
    setUrl(new URL(`/meetups/${meetupId}`, window.location.origin).href);
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, close]);

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
        close();
      } else {
        clearDragVisuals();
      }
    },
    [close, clearDragVisuals],
  );

  async function handleCopy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-ghost shrink-0"
        style={{ width: "2rem", height: "2rem", padding: 0 }}
        aria-label="Treffen teilen"
        title="QR-Code anzeigen"
        onClick={handleOpen}
      >
        <QrIcon />
      </button>

      {open && (
        <div
          ref={overlayRef}
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="modal-panel"
            style={{ maxWidth: "22rem" }}
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
              <h2 id={titleId} className="text-sm font-semibold text-[var(--muted)]">
                Treffen teilen
              </h2>
            </div>

            <div className="modal-body flex flex-col items-center gap-4 safe-bottom">
              <p className="text-sm text-center text-[var(--muted)]">{title}</p>

              {url ? (
                <div
                  className="rounded-lg p-3"
                  style={{ background: "#ffffff" }}
                >
                  <QRCode
                    value={url}
                    size={180}
                    fgColor="#000000"
                    bgColor="#ffffff"
                    level="M"
                  />
                </div>
              ) : (
                <div
                  className="rounded-lg"
                  style={{ width: 180, height: 180, background: "#ffffff" }}
                />
              )}

              {url && (
                <p className="w-full text-center text-xs text-[var(--muted)] break-all">
                  {url}
                </p>
              )}

              <button
                type="button"
                className="btn btn-primary w-full"
                disabled={!url}
                onClick={handleCopy}
              >
                {copied ? "Kopiert!" : "Link kopieren"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
