"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useEscapeKey } from "@/lib/use-escape-key";

/**
 * Gemeinsame Modal-Hülle: Overlay, Panel, ARIA, Escape, Click-outside,
 * initialer Fokus. Nutzt die .modal-*-Klassen aus globals.css.
 *
 * Für Bottom-Sheets mit Drag-Dismiss (GameDetailModal & Co.) bewusst nicht
 * gedacht — die behalten ihre spezialisierte Implementierung.
 */
export function ModalShell({
  labelledBy,
  describedBy,
  role = "dialog",
  panelClassName = "",
  dismissDisabled = false,
  onDismiss,
  children,
}: {
  /** id der Überschrift im Panel (aria-labelledby). */
  labelledBy: string;
  describedBy?: string;
  role?: "dialog" | "alertdialog";
  panelClassName?: string;
  /** Blockiert Escape/Click-outside, z. B. während einer laufenden Aktion. */
  dismissDisabled?: boolean;
  onDismiss: () => void;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEscapeKey(onDismiss, !dismissDisabled);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  // Portal nach document.body, damit transform-/animation-Vorfahren das
  // fixed-Overlay nicht einfangen (Containing Block & Stacking Context).
  return createPortal(
    <div
      className="modal-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !dismissDisabled) onDismiss();
      }}
    >
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        className={`modal-panel ${panelClassName}`}
        tabIndex={-1}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
