"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { useDragToDismiss } from "@/lib/use-drag-dismiss";
import { useEscapeKey } from "@/lib/use-escape-key";
import { MeetupForm } from "@/components/MeetupForm";

export function NewMeetupButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn btn-primary shrink-0"
        style={{ width: "2.75rem", height: "2.75rem", padding: 0 }}
        aria-label="Neues Treffen"
        title="Neues Treffen"
      >
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
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      {open && <NewMeetupModal onClose={() => setOpen(false)} />}
    </>
  );
}

function NewMeetupModal({ onClose }: { onClose: () => void }) {
  const titleId = useId();
  const { overlayRef, panelRef, dragZoneHandlers } = useDragToDismiss(onClose);

  useEscapeKey(onClose);

  useEffect(() => {
    panelRef.current?.focus();
  }, [panelRef]);

  return createPortal(
    <div
      ref={overlayRef}
      className="modal-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="modal-panel sm:max-w-xl"
        tabIndex={-1}
      >
        <div className="modal-drag-zone relative" {...dragZoneHandlers}>
          <div className="modal-handle" aria-hidden />
          <h2
            id={titleId}
            className="text-sm font-semibold text-[var(--muted)]"
          >
            Neues Treffen
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

        <div className="modal-body safe-bottom">
          <MeetupForm className="" onCancel={onClose} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
