"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import {
  completeDummyDuelsAction,
  countDummyMeetupsAction,
  createDummyMeetupsAction,
  logoutAction,
  purgeDummyMeetupsAction,
} from "@/app/actions";
import { useClickOutside } from "@/lib/use-click-outside";
import { useSecretMenuReveal } from "@/lib/use-secret-menu-reveal";

function meetupIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/meetups\/([^/]+)/);
  return match?.[1] ?? null;
}

const ADMIN_NAV = [
  { href: "/admin/collection", label: "Sammlung" },
  { href: "/admin/import", label: "Import" },
] as const;

export function HeaderMenu({ userName }: { userName: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const meetupId = useMemo(() => meetupIdFromPath(pathname), [pathname]);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { revealed, registerClick } = useSecretMenuReveal();

  const closeMenu = useCallback(() => setOpen(false), []);
  useClickOutside(menuRef, closeMenu, open);

  function handleCreate() {
    setOpen(false);
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
    setOpen(false);
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
    setOpen(false);
    startTransition(async () => {
      await logoutAction();
    });
  }

  function handlePurge() {
    setOpen(false);
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

  return (
    <div className="relative flex flex-col items-end" ref={menuRef}>
      {revealed ? (
        <button
          type="button"
          className="btn btn-ghost min-w-[2.75rem] min-h-[2.75rem] px-3"
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label="Menü"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="text-xl leading-none" aria-hidden>
            ☰
          </span>
        </button>
      ) : (
        <button
          type="button"
          className="min-w-[2.75rem] min-h-[2.75rem] opacity-0"
          aria-hidden
          tabIndex={-1}
          onClick={registerClick}
        />
      )}

      {open && revealed && (
        <div
          role="menu"
          className="absolute top-full right-0 z-30 mt-1 min-w-[14rem] max-w-[calc(100vw-2rem)] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] shadow-lg py-1"
        >
          <p className="px-3 py-2 text-xs text-[var(--muted)] border-b border-[var(--border)]">
            Angemeldet als {userName}
          </p>

          <div className="py-1 border-b border-[var(--border)]">
            {ADMIN_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                className="btn btn-ghost w-full justify-start rounded-none"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="py-1">
            <p className="px-3 py-1.5 text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">
              Testdaten
            </p>
            <button
              type="button"
              role="menuitem"
              className="btn btn-ghost w-full justify-start rounded-none"
              disabled={pending}
              onClick={handleCreate}
            >
              {pending ? "Bitte warten…" : "Dummy-Treffen erzeugen"}
            </button>
            <button
              type="button"
              role="menuitem"
              className="btn btn-ghost w-full justify-start text-[var(--primary)] rounded-none"
              disabled={pending}
              onClick={handlePurge}
            >
              Dummy-Treffen löschen
            </button>
            {meetupId && (
              <button
                type="button"
                role="menuitem"
                className="btn btn-ghost w-full justify-start rounded-none"
                disabled={pending}
                onClick={handleCompleteDuels}
              >
                {pending ? "Bitte warten…" : "Dummy-Duelle abschließen"}
              </button>
            )}
          </div>

          <div className="py-1 border-t border-[var(--border)]">
            <button
              type="button"
              role="menuitem"
              className="btn btn-ghost w-full justify-start rounded-none"
              disabled={pending}
              onClick={handleLogout}
            >
              Abmelden
            </button>
          </div>
        </div>
      )}

      {(message || error) && (
        <p
          className={`text-xs mt-1 max-w-[12rem] text-right ${error ? "text-[var(--danger)]" : "text-[var(--muted)]"}`}
          role={error ? "alert" : "status"}
        >
          {error ?? message}
        </p>
      )}
    </div>
  );
}
