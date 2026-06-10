"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, useTransition } from "react";
import { deleteMeetupAction } from "@/app/actions";
import { useClickOutside } from "@/lib/use-click-outside";

export function MeetupActionsMenu({
  meetupId,
  title,
}: {
  meetupId: string;
  title: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => setOpen(false), []);
  useClickOutside(menuRef, closeMenu, open);

  function handleDelete() {
    setOpen(false);
    if (
      !window.confirm(
        `Treffen „${title}" wirklich löschen?\n\nAlle Stimmen (Pick & Duell) gehen verloren.`,
      )
    ) {
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await deleteMeetupAction(meetupId);
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      router.push("/");
      router.refresh();
    });
  }

  return (
    <div className="hidden md:flex flex-col items-end gap-1 relative" ref={menuRef}>
      <button
        type="button"
        className="btn btn-ghost"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        Menü
      </button>
      {open && (
        <div
          role="menu"
          className="absolute top-full right-0 z-10 mt-1 min-w-[12rem] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] shadow-lg py-1"
        >
          <button
            type="button"
            role="menuitem"
            className="btn btn-ghost w-full justify-start text-[var(--primary)] rounded-none"
            disabled={pending}
            onClick={handleDelete}
          >
            {pending ? "Wird gelöscht…" : "Treffen löschen"}
          </button>
        </div>
      )}
      {error && <p className="text-sm text-[var(--primary)]">{error}</p>}
    </div>
  );
}
