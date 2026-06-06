"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  countDummyMeetupsAction,
  createDummyMeetupsAction,
  purgeDummyMeetupsAction,
} from "@/app/actions";

const MOBILE_NAV = [
  { href: "/games", label: "Spiele" },
  { href: "/", label: "Treffen" },
  { href: "/admin/collection", label: "Sammlung" },
  { href: "/admin/import", label: "Import" },
] as const;

export function HeaderMenu({ userName }: { userName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

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
      <button
        type="button"
        className="btn btn-ghost min-w-[44px] min-h-[44px] px-3"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Menü"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-xl leading-none" aria-hidden>
          ☰
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute top-full right-0 z-30 mt-1 min-w-[14rem] max-w-[calc(100vw-2rem)] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] shadow-lg py-1"
        >
          <p className="px-3 py-2 text-xs text-[var(--muted)] border-b border-[var(--border)] md:hidden">
            Angemeldet als {userName}
          </p>

          <div className="md:hidden py-1 border-b border-[var(--border)]">
            {MOBILE_NAV.map((item) => (
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
          </div>
        </div>
      )}

      {(message || error) && (
        <p
          className={`text-xs mt-1 max-w-[12rem] text-right ${error ? "text-[var(--primary)]" : "text-[var(--muted)]"}`}
          role={error ? "alert" : "status"}
        >
          {error ?? message}
        </p>
      )}
    </div>
  );
}
