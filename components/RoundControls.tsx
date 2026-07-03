"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useDragToDismiss } from "@/lib/use-drag-dismiss";
import { useEscapeKey } from "@/lib/use-escape-key";
import {
  addRoundAction,
  updateRoundAction,
  deleteRoundAction,
  joinRoundAction,
  leaveRoundAction,
} from "@/app/actions";

type RoundFormValues = {
  label: string;
  startsAt: string;
  expectedPlayerCount: number;
};

function RoundFormModal({
  title,
  submitLabel,
  initial,
  showExpected,
  onClose,
  onSubmit,
}: {
  title: string;
  submitLabel: string;
  initial: RoundFormValues;
  showExpected: boolean;
  onClose: () => void;
  onSubmit: (values: RoundFormValues) => Promise<{ error?: string } | { ok: true }>;
}) {
  const titleId = useId();
  const { overlayRef, panelRef, dragZoneHandlers } = useDragToDismiss(onClose);
  const [label, setLabel] = useState(initial.label);
  const [startsAt, setStartsAt] = useState(initial.startsAt);
  const [expected, setExpected] = useState(initial.expectedPlayerCount);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEscapeKey(onClose);
  useEffect(() => {
    panelRef.current?.focus();
  }, [panelRef]);

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await onSubmit({
        label,
        startsAt,
        expectedPlayerCount: expected,
      });
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      onClose();
    });
  }

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
        className="modal-panel sm:max-w-md"
        tabIndex={-1}
      >
        <div className="modal-drag-zone relative" {...dragZoneHandlers}>
          <div className="modal-handle" aria-hidden />
          <h2 id={titleId} className="text-sm font-semibold text-[var(--muted)]">
            {title}
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

        <div className="modal-body safe-bottom flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Bezeichnung (optional)</span>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Aufwärmspiel"
              className="input w-full"
              autoComplete="off"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Startzeit (optional)</span>
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className="input w-full"
            />
          </label>
          {showExpected && (
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Erwartete Spieler</span>
              <input
                type="number"
                min={1}
                max={20}
                value={expected}
                onChange={(e) =>
                  setExpected(parseInt(e.target.value, 10) || 1)
                }
                className="input w-full"
              />
            </label>
          )}
          {error && (
            <p className="text-sm text-[var(--danger)]" role="alert">
              {error}
            </p>
          )}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              className="btn btn-primary flex-1"
              disabled={pending}
              aria-busy={pending}
              onClick={submit}
            >
              {pending ? "Speichere…" : submitLabel}
            </button>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Abbrechen
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function AddRoundButton({ meetupId }: { meetupId: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <button
        type="button"
        className="btn btn-ghost btn-sm self-start"
        onClick={() => setOpen(true)}
      >
        + Spielrunde hinzufügen
      </button>
      {open && (
        <RoundFormModal
          title="Spielrunde hinzufügen"
          submitLabel="Hinzufügen"
          showExpected
          initial={{ label: "", startsAt: "", expectedPlayerCount: 4 }}
          onClose={() => {
            setOpen(false);
            router.refresh();
          }}
          onSubmit={(values) =>
            addRoundAction(meetupId, {
              label: values.label,
              startsAt: values.startsAt,
              expectedPlayerCount: values.expectedPlayerCount,
            })
          }
        />
      )}
    </>
  );
}

export function RoundAdminBar({
  roundId,
  label,
  startsAtLocal,
  canDelete,
}: {
  roundId: string;
  label: string;
  startsAtLocal: string;
  canDelete: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const res = await deleteRoundAction(roundId);
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      setConfirmDelete(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setEditOpen(true)}
        >
          Bearbeiten
        </button>
        {canDelete && (
          <button
            type="button"
            className="btn btn-ghost btn-sm text-[var(--danger)]"
            disabled={pending}
            onClick={() => setConfirmDelete(true)}
          >
            Löschen
          </button>
        )}
      </div>
      {confirmDelete && (
        <div className="flex flex-col gap-2 rounded-lg border border-[var(--border)] p-3 text-left">
          <p className="text-sm">
            Diese Spielrunde inkl. aller Stimmen löschen?
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={pending}
              onClick={handleDelete}
            >
              Löschen
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setConfirmDelete(false)}
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}
      {error && (
        <p className="text-xs text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}
      {editOpen && (
        <RoundFormModal
          title="Spielrunde bearbeiten"
          submitLabel="Speichern"
          showExpected={false}
          initial={{ label, startsAt: startsAtLocal, expectedPlayerCount: 4 }}
          onClose={() => {
            setEditOpen(false);
            router.refresh();
          }}
          onSubmit={(values) =>
            updateRoundAction(roundId, {
              label: values.label,
              startsAt: values.startsAt,
            })
          }
        />
      )}
    </div>
  );
}

export function RoundParticipationToggle({
  roundId,
  isParticipant,
  canLeave,
}: {
  roundId: string;
  isParticipant: boolean;
  canLeave: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (isParticipant && !canLeave) {
    return <p className="text-xs text-[var(--muted)]">Du spielst mit</p>;
  }

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const res = isParticipant
        ? await leaveRoundAction(roundId)
        : await joinRoundAction(roundId);
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        className={`btn ${isParticipant ? "btn-ghost" : "btn-primary"} btn-sm`}
        onClick={handleClick}
        disabled={pending}
        aria-busy={pending}
      >
        {pending
          ? isParticipant
            ? "Melde ab…"
            : "Trete bei…"
          : isParticipant
            ? "Nicht mehr mitspielen"
            : "Ich spiele mit"}
      </button>
      {error && (
        <p className="text-xs text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
