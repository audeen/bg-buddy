"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  completeDummyDuelsAction,
  countDummyMeetupsAction,
  createDummyMeetupsAction,
  logoutAction,
  purgeDummyMeetupsAction,
} from "@/app/actions";
import { useEscapeKey } from "@/lib/use-escape-key";

function meetupIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/meetups\/([^/]+)/);
  return match?.[1] ?? null;
}

const ADMIN_NAV = [
  { href: "/admin/collection", label: "Sammlung verwalten" },
  { href: "/admin/import", label: "Import" },
] as const;

/** Admin-/Testdaten-Menü als Bottom-Sheet (ersetzt das alte Header-Dropdown). */
export function AdminMenuSheet({
  userName,
  open,
  onClose,
}: {
  userName: string;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const meetupId = useMemo(() => meetupIdFromPath(pathname), [pathname]);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEscapeKey(onClose, open);

  function handleCreate() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const res = await createDummyMeetupsAction();
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      const count = res && "count" in res ? res.count : 6;
      setMessage(`${count} Dummy-Treffen erstellt.`);
      router.refresh();
    });
  }

  function handleCompleteDuels() {
    if (!meetupId) return;
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const res = await completeDummyDuelsAction(meetupId);
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      const added =
        res && "votesAdded" in res && res.votesAdded != null
          ? res.votesAdded
          : 0;
      setMessage(
        added > 0
          ? `${added} Dummy-Duell-Stimmen gesetzt.`
          : "Alle Dummy-Duelle waren bereits fertig.",
      );
      router.refresh();
    });
  }

  function handleLogout() {
    startTransition(async () => {
      await logoutAction();
      onClose();
    });
  }

  function handlePurge() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const countRes = await countDummyMeetupsAction();
      const n =
        countRes && "count" in countRes && countRes.count != null
          ? countRes.count
          : 0;
      if (n === 0) {
        setMessage("Keine Dummy-Treffen vorhanden.");
        return;
      }
      if (
        !window.confirm(
          `${n} Dummy-Treffen wirklich löschen?\n\nEchte Treffen bleiben unberührt.`,
        )
      ) {
        return;
      }
      const res = await purgeDummyMeetupsAction();
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      const deleted = res && "deleted" in res ? res.deleted : n;
      setMessage(`${deleted} Dummy-Treffen gelöscht.`);
      router.refresh();
    });
  }

  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Admin-Menü"
        className="modal-panel"
      >
        <div className="modal-drag-zone">
          <span className="modal-handle" aria-hidden />
          <div className="flex w-full items-center justify-between gap-2">
            <span className="font-semibold text-sm">Admin-Menü</span>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost btn-sm"
              aria-label="Schließen"
            >
              ✕
            </button>
          </div>
        </div>
        <div className="modal-body flex flex-col gap-1">
          <p className="text-xs text-[var(--muted)] pb-2 border-b border-[var(--border)]">
            Angemeldet als {userName}
          </p>

          <div className="py-1 border-b border-[var(--border)] flex flex-col">
            {ADMIN_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="btn btn-ghost w-full justify-start border-transparent"
                onClick={onClose}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="py-1 flex flex-col">
            <p className="px-3 py-1.5 text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">
              Testdaten
            </p>
            <button
              type="button"
              className="btn btn-ghost w-full justify-start border-transparent"
              disabled={pending}
              onClick={handleCreate}
            >
              {pending ? "Bitte warten…" : "Dummy-Treffen erzeugen"}
            </button>
            <button
              type="button"
              className="btn btn-ghost w-full justify-start text-[var(--danger)] border-transparent"
              disabled={pending}
              onClick={handlePurge}
            >
              Dummy-Treffen löschen
            </button>
            {meetupId && (
              <button
                type="button"
                className="btn btn-ghost w-full justify-start border-transparent"
                disabled={pending}
                onClick={handleCompleteDuels}
              >
                {pending ? "Bitte warten…" : "Dummy-Duelle abschließen"}
              </button>
            )}
          </div>

          <div className="py-1 border-t border-[var(--border)] flex flex-col">
            <button
              type="button"
              className="btn btn-ghost w-full justify-start border-transparent"
              disabled={pending}
              onClick={handleLogout}
            >
              Abmelden
            </button>
          </div>

          {(message || error) && (
            <p
              className={`text-sm pt-2 ${error ? "text-[var(--danger)]" : "text-[var(--muted)]"}`}
              role={error ? "alert" : "status"}
            >
              {error ?? message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
