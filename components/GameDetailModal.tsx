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

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
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
    [onClose],
  );

  useEffect(() => {
    if (!game) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [game, handleKeyDown]);

  if (!game) return null;

  return (
    <div
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
        className="modal-panel"
      >
        <div className="modal-header">
          <Link
            href={`/games/${game.id}`}
            className="text-sm text-[var(--accent)] hover:underline"
          >
            Vollständige Seite öffnen
          </Link>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="btn btn-ghost btn-sm"
            aria-label="Schließen"
          >
            ✕
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
      </div>
    </div>
  );
}
