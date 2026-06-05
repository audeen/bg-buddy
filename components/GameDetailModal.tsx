"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef } from "react";
import { GameDetailView, type GameDetailData } from "@/components/GameDetailView";

type GameDetailModalProps = {
  game: GameDetailData | null;
  onClose: () => void;
  playerCount?: number;
};

export function GameDetailModal({
  game,
  onClose,
  playerCount,
}: GameDetailModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const historyPushedRef = useRef(false);
  const skipPopCloseRef = useRef(false);

  const dismiss = useCallback(() => {
    if (historyPushedRef.current) {
      historyPushedRef.current = false;
      skipPopCloseRef.current = true;
      window.history.back();
    }
    onClose();
  }, [onClose]);

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
    closeRef.current?.focus();
    window.addEventListener("popstate", onPopState);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("popstate", onPopState);
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      if (historyPushedRef.current) {
        historyPushedRef.current = false;
        skipPopCloseRef.current = true;
        window.history.back();
      }
    };
  }, [game, onClose, handleKeyDown]);

  if (!game) return null;

  return (
    <div
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
      >
        <div className="modal-handle" aria-hidden />

        <div className="modal-header">
          <span className="text-sm font-semibold text-[var(--muted)]">
            Spielinfo
          </span>
          <button
            ref={closeRef}
            type="button"
            onClick={dismiss}
            className="btn btn-ghost modal-close-btn"
          >
            Schließen
          </button>
        </div>

        <div className="modal-body">
          <GameDetailView
            game={game}
            titleId={titleId}
            compact
            playerCount={playerCount}
          />
        </div>

        <div className="modal-footer safe-bottom">
          <button
            type="button"
            onClick={dismiss}
            className="btn btn-primary btn-lg w-full"
          >
            Zurück zur Auswahl
          </button>
          <Link
            href={`/games/${game.id}`}
            className="text-sm text-center text-[var(--accent)] hover:underline"
          >
            Vollständige Seite öffnen
          </Link>
        </div>
      </div>
    </div>
  );
}
