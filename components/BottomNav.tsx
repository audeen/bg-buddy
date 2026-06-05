"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const LAST_MEETUP_KEY = "bg-buddy:last-meetup-id";

function meetupIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/meetups\/([^/]+)/);
  if (!match || match[1] === "new") return null;
  return match[1];
}

function isErgebnissePage(pathname: string): boolean {
  return /^\/meetups\/[^/]+$/.test(pathname);
}

export function BottomNav({ fallbackMeetupId }: { fallbackMeetupId: string | null }) {
  const pathname = usePathname();
  const [storedMeetupId, setStoredMeetupId] = useState<string | null>(null);

  const pathMeetupId = meetupIdFromPath(pathname);

  useEffect(() => {
    const stored = localStorage.getItem(LAST_MEETUP_KEY);
    if (stored) setStoredMeetupId(stored);
  }, []);

  useEffect(() => {
    if (!pathMeetupId) return;
    localStorage.setItem(LAST_MEETUP_KEY, pathMeetupId);
    setStoredMeetupId(pathMeetupId);
  }, [pathMeetupId]);

  const meetupId = pathMeetupId ?? storedMeetupId ?? fallbackMeetupId;
  const ergebnisseHref = meetupId ? `/meetups/${meetupId}#ergebnisse` : "/";

  const items = useMemo(
    () => [
      {
        href: "/",
        label: "Treffen",
        icon: "📅",
        active: pathname === "/" || pathname === "/meetups/new",
      },
      {
        href: "/games",
        label: "Spiele",
        icon: "🎲",
        active: pathname.startsWith("/games"),
      },
      {
        href: ergebnisseHref,
        label: "Ergebnisse",
        icon: "🏆",
        active: isErgebnissePage(pathname),
        disabled: !meetupId,
      },
    ],
    [pathname, ergebnisseHref, meetupId],
  );

  return (
    <nav
      className="md:hidden fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] bg-[var(--surface)] safe-bottom header-shadow"
      aria-label="Hauptnavigation"
    >
      <ul className="flex items-stretch justify-around h-[var(--bottom-nav-height)] px-2">
        {items.map((item) => (
          <li key={item.label} className="flex-1 flex items-center justify-center">
            {item.disabled ? (
              <span
                className="flex flex-col items-center justify-center gap-0.5 px-4 py-1.5 min-w-[4.5rem] text-xs font-semibold text-[var(--muted)] opacity-50"
                aria-disabled
              >
                <span className="text-lg leading-none" aria-hidden>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </span>
            ) : (
              <Link
                href={item.href}
                className={`flex flex-col items-center justify-center gap-0.5 px-4 py-1.5 min-w-[4.5rem] text-xs font-semibold transition-colors ${
                  item.active
                    ? "nav-item-active"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
                aria-current={item.active ? "page" : undefined}
              >
                <span className="text-lg leading-none" aria-hidden>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </Link>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
