"use client";

import { useEffect, useId, useRef } from "react";
import { ModalShell } from "@/components/ModalShell";

/**
 * Bestätigungs-Dialog für (destruktive) Aktionen — Ersatz für window.confirm.
 * Nutzt die bestehenden .modal-*-Klassen des Designsystems.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  pendingLabel = "Bitte warten…",
  cancelLabel = "Abbrechen",
  destructive = true,
  pending = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  pendingLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const descId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <ModalShell
      labelledBy={titleId}
      describedBy={description ? descId : undefined}
      role="alertdialog"
      panelClassName="sm:max-w-md"
      dismissDisabled={pending}
      onDismiss={onCancel}
    >
      <div className="modal-body flex flex-col gap-3 safe-bottom">
          <h2 id={titleId} className="section-title">
            {title}
          </h2>
          {description && (
            <p id={descId} className="text-sm text-[var(--muted)] whitespace-pre-line">
              {description}
            </p>
          )}
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-1">
            <button
              ref={cancelRef}
              type="button"
              className="btn btn-ghost"
              onClick={onCancel}
              disabled={pending}
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              className={`btn ${destructive ? "btn-danger" : "btn-primary"}`}
              onClick={onConfirm}
              disabled={pending}
              aria-busy={pending}
            >
              {pending ? pendingLabel : confirmLabel}
            </button>
          </div>
      </div>
    </ModalShell>
  );
}
