"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/actions";

export function MobileMenu({
  userName,
  isLoggedIn,
}: {
  userName: string | null;
  isLoggedIn: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="btn btn-ghost md:hidden px-3"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="mobile-menu-sheet"
        aria-label="Menü öffnen"
      >
        <span className="text-lg leading-none" aria-hidden>
          ☰
        </span>
      </button>

      {open && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          aria-label="Menü schließen"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        id="mobile-menu-sheet"
        className={`fixed top-0 right-0 z-50 h-full w-[min(100%,20rem)] bg-[var(--surface)] border-l border-[var(--border)] shadow-xl flex flex-col transition-transform duration-200 md:hidden safe-top safe-bottom ${
          open ? "translate-x-0" : "translate-x-full pointer-events-none"
        }`}
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--border)]">
          <span className="font-bold">Menü</span>
          <button
            type="button"
            className="btn btn-ghost px-3"
            onClick={() => setOpen(false)}
            aria-label="Menü schließen"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-2 p-4 flex-1 overflow-y-auto">
          {isLoggedIn && userName && (
            <p className="text-sm text-[var(--muted)] mb-1 px-1">
              Angemeldet als <span className="font-semibold text-[var(--foreground)]">{userName}</span>
            </p>
          )}

          <Link href="/admin/import" className="btn btn-ghost justify-start w-full" onClick={() => setOpen(false)}>
            Import
          </Link>

          {isLoggedIn && (
            <Link href="/meetups/new" className="btn btn-ghost justify-start w-full" onClick={() => setOpen(false)}>
              Neues Treffen
            </Link>
          )}

          <div className="mt-auto pt-4 border-t border-[var(--border)] flex flex-col gap-2">
            {isLoggedIn ? (
              <form action={logoutAction}>
                <button type="submit" className="btn btn-ghost w-full justify-start">
                  Abmelden
                </button>
              </form>
            ) : (
              <Link href="/#login" className="btn btn-primary w-full" onClick={() => setOpen(false)}>
                Anmelden
              </Link>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
