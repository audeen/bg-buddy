"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

const LAST_MEETUP_KEY = "bg-buddy:last-meetup-id";

function meetupIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/meetups\/([^/]+)/);
  if (!match || match[1] === "new") return null;
  return match[1];
}

function isMeetupDetailPage(pathname: string): boolean {
  return /^\/meetups\/[^/]+$/.test(pathname);
}

function isAtPageTop(scrollTargetId = "meetup-page-top"): boolean {
  const el = document.getElementById(scrollTargetId);
  if (!el) return window.scrollY <= 8;
  return el.getBoundingClientRect().top >= -8;
}

type NavItem = {
  key: string;
  label: string;
  icon: string;
  active: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  href?: string;
  onClick?: () => void;
};

const navItemClass = (active: boolean) =>
  `flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 min-w-0 w-full text-[0.65rem] font-semibold transition-colors ${
    active
      ? "nav-item-active"
      : "text-[var(--muted)] hover:text-[var(--foreground)]"
  }`;

const disabledNavItemClass =
  "flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 min-w-0 w-full text-[0.65rem] font-semibold text-[var(--muted)] opacity-50";

export function BottomNav({ fallbackMeetupId }: { fallbackMeetupId: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [storedMeetupId, setStoredMeetupId] = useState<string | null>(null);
  const [hash, setHash] = useState("");

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

  useEffect(() => {
    const syncHash = () => setHash(window.location.hash);
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, [pathname]);

  const meetupId = pathMeetupId ?? storedMeetupId ?? fallbackMeetupId;
  const ergebnisseHref = meetupId ? `/meetups/${meetupId}#ergebnisse` : "/";
  const voteHref = meetupId ? `/meetups/${meetupId}/pick` : "/";

  const handleTreffenClick = useCallback(() => {
    if (!isMeetupDetailPage(pathname)) {
      router.push(meetupId ? `/meetups/${meetupId}` : "/");
      return;
    }

    if (!isAtPageTop()) {
      document
        .getElementById("meetup-page-top")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    router.push("/");
  }, [pathname, meetupId, router]);

  const items = useMemo(
    (): NavItem[] => [
      {
        key: "treffen",
        label: "Treffen",
        icon: "📅",
        active:
          pathname === "/" ||
          pathname === "/meetups/new" ||
          (isMeetupDetailPage(pathname) && hash !== "#ergebnisse"),
        onClick: handleTreffenClick,
      },
      {
        key: "spiele",
        label: "Spiele",
        icon: "🎲",
        href: "/games",
        active: pathname.startsWith("/games"),
      },
      {
        key: "vote",
        label: "Vote",
        icon: "🗳️",
        ariaLabel: "Stimmen vergeben",
        href: voteHref,
        active: /^\/meetups\/[^/]+\/pick$/.test(pathname),
        disabled: !meetupId,
      },
      {
        key: "ergebnisse",
        label: "Ergebnisse",
        icon: "🏆",
        href: ergebnisseHref,
        active: isMeetupDetailPage(pathname) && hash === "#ergebnisse",
        disabled: !meetupId,
      },
    ],
    [pathname, hash, ergebnisseHref, voteHref, meetupId, handleTreffenClick],
  );

  return (
    <nav
      className="md:hidden fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] bg-[var(--surface)] safe-bottom header-shadow"
      aria-label="Hauptnavigation"
    >
      <ul className="flex items-stretch justify-around h-[var(--bottom-nav-height)] px-1">
        {items.map((item) => (
          <li key={item.key} className="flex-1 flex items-center justify-center min-w-0">
            {item.disabled ? (
              <span className={disabledNavItemClass} aria-disabled>
                <span className="text-lg leading-none" aria-hidden>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </span>
            ) : item.onClick ? (
              <button
                type="button"
                onClick={item.onClick}
                className={navItemClass(item.active)}
                aria-current={item.active ? "page" : undefined}
                aria-label={item.ariaLabel}
              >
                <span className="text-lg leading-none" aria-hidden>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </button>
            ) : (
              <Link
                href={item.href!}
                className={navItemClass(item.active)}
                aria-current={item.active ? "page" : undefined}
                aria-label={item.ariaLabel}
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
