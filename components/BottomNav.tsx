"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { navigateToErgebnisse } from "@/lib/scroll-ergebnisse";
import { useScrollChromeHidden } from "@/lib/scroll-chrome";
import { useVisualViewportBottomGap } from "@/lib/visual-viewport-gap";
import { scrollBehavior } from "@/lib/scroll";
import {
  BallotIcon,
  CalendarIcon,
  DiceIcon,
  TrophyIcon,
} from "@/components/icons";

const LAST_MEETUP_KEY = "bg-buddy:last-meetup-id";

const lastMeetupListeners = new Set<() => void>();

function readStoredMeetupId(): string | null {
  return localStorage.getItem(LAST_MEETUP_KEY);
}

function storeMeetupId(id: string) {
  localStorage.setItem(LAST_MEETUP_KEY, id);
  for (const listener of lastMeetupListeners) listener();
}

function clearStoredMeetupId() {
  localStorage.removeItem(LAST_MEETUP_KEY);
  for (const listener of lastMeetupListeners) listener();
}

async function meetupExists(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/meetups/${id}/exists`);
    if (!res.ok) return false;
    const data = (await res.json()) as { exists?: boolean };
    return data.exists === true;
  } catch {
    return false;
  }
}

function subscribeStoredMeetupId(listener: () => void): () => void {
  lastMeetupListeners.add(listener);
  return () => {
    lastMeetupListeners.delete(listener);
  };
}

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
  icon: ReactNode;
  active: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  href?: string;
  onClick?: () => void;
};

const navItemClass = (active: boolean) =>
  `flex flex-col items-center justify-center gap-0.5 px-2 py-1 min-w-0 w-full text-[0.62rem] md:text-xs font-semibold transition-colors rounded-full ${
    active
      ? "nav-item-active"
      : "text-[var(--muted)] hover:text-[var(--foreground)]"
  }`;

const disabledNavItemClass =
  "flex flex-col items-center justify-center gap-0.5 px-2 py-1 min-w-0 w-full text-[0.62rem] font-semibold text-[var(--muted)] opacity-50";

export function BottomNav({ fallbackMeetupId }: { fallbackMeetupId: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const storedMeetupId = useSyncExternalStore(
    subscribeStoredMeetupId,
    readStoredMeetupId,
    () => null,
  );
  const [hash, setHash] = useState("");
  // IDs, deren Treffen nachweislich gelöscht wurde (deckt auch einen
  // veralteten fallbackMeetupId ab, da das Layout bei Client-Navigation
  // nicht neu rendert).
  const [invalidIds, setInvalidIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const markMeetupInvalid = useCallback((id: string) => {
    if (readStoredMeetupId() === id) clearStoredMeetupId();
    setInvalidIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const pathMeetupId = meetupIdFromPath(pathname);

  useEffect(() => {
    if (pathMeetupId && !invalidIds.has(pathMeetupId)) {
      storeMeetupId(pathMeetupId);
    }
  }, [pathMeetupId, invalidIds]);

  useEffect(() => {
    const syncHash = () => setHash(window.location.hash);
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, [pathname]);

  // Gespeicherte ID einmal gegen die Datenbank validieren, damit Buttons
  // nach dem Löschen eines Treffens korrekt deaktiviert werden.
  useEffect(() => {
    if (!storedMeetupId || storedMeetupId === pathMeetupId) return;
    let cancelled = false;
    void meetupExists(storedMeetupId).then((exists) => {
      if (cancelled || exists) return;
      clearStoredMeetupId();
      setInvalidIds((prev) => {
        const next = new Set(prev);
        next.add(storedMeetupId);
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [storedMeetupId, pathMeetupId]);

  const chromeHidden = useScrollChromeHidden();
  useVisualViewportBottomGap();
  const meetupId =
    [pathMeetupId, storedMeetupId, fallbackMeetupId].find(
      (id): id is string => id != null && !invalidIds.has(id),
    ) ?? null;

  const handleTreffenClick = useCallback(() => {
    if (!isMeetupDetailPage(pathname)) {
      if (!meetupId) {
        if (pathname !== "/") router.push("/");
        return;
      }
      void meetupExists(meetupId).then((exists) => {
        if (exists) {
          router.push(`/meetups/${meetupId}`);
          return;
        }
        markMeetupInvalid(meetupId);
        if (pathname !== "/") router.push("/");
      });
      return;
    }

    if (!isAtPageTop()) {
      document
        .getElementById("meetup-page-top")
        ?.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
      return;
    }

    router.push("/");
  }, [pathname, meetupId, router, markMeetupInvalid]);

  const handleVoteClick = useCallback(() => {
    if (!meetupId) return;
    const target = `/meetups/${meetupId}/pick`;
    if (pathname === target) return;
    void meetupExists(meetupId).then((exists) => {
      if (exists) {
        router.push(target);
        return;
      }
      markMeetupInvalid(meetupId);
      // Nur wegnavigieren, wenn man auf einer Seite des gelöschten
      // Treffens steht (z. B. dessen 404-Pick-Seite).
      if (pathMeetupId === meetupId) router.push("/");
    });
  }, [pathname, meetupId, pathMeetupId, router, markMeetupInvalid]);

  const handleErgebnisseClick = useCallback(() => {
    if (!meetupId) return;
    if (isMeetupDetailPage(pathname)) {
      navigateToErgebnisse(meetupId, pathname, router, () => setHash("#ergebnisse"));
      return;
    }
    void meetupExists(meetupId).then((exists) => {
      if (exists) {
        navigateToErgebnisse(meetupId, pathname, router, () => setHash("#ergebnisse"));
        return;
      }
      markMeetupInvalid(meetupId);
      if (pathMeetupId === meetupId) router.push("/");
    });
  }, [pathname, meetupId, pathMeetupId, router, markMeetupInvalid]);

  const items = useMemo(
    (): NavItem[] => [
      {
        key: "treffen",
        label: "Treffen",
        icon: <CalendarIcon />,
        active:
          pathname === "/" ||
          pathname === "/meetups/new" ||
          (isMeetupDetailPage(pathname) && hash !== "#ergebnisse"),
        onClick: handleTreffenClick,
      },
      {
        key: "vote",
        label: "Stimmen",
        icon: <BallotIcon />,
        ariaLabel: "Stimmen vergeben",
        active: /^\/meetups\/[^/]+\/pick$/.test(pathname),
        disabled: !meetupId,
        onClick: handleVoteClick,
      },
      {
        key: "ergebnisse",
        label: "Ergebnisse",
        icon: <TrophyIcon />,
        active: isMeetupDetailPage(pathname) && hash === "#ergebnisse",
        disabled: !meetupId,
        onClick: handleErgebnisseClick,
      },
      {
        key: "sammlung",
        label: "Sammlung",
        icon: <DiceIcon />,
        href: "/games",
        active: pathname.startsWith("/games"),
      },
    ],
    [
      pathname,
      hash,
      meetupId,
      handleTreffenClick,
      handleVoteClick,
      handleErgebnisseClick,
    ],
  );

  return (
    <nav
      className={`fixed left-0 right-0 z-30 px-3 safe-bottom bottom-nav-chrome pointer-events-none${chromeHidden ? " chrome-hidden" : ""}`}
      aria-label="Hauptnavigation"
    >
      <ul className="bottom-nav-dock pointer-events-auto mx-auto w-full max-w-md md:max-w-lg">
        {items.map((item) => (
          <li key={item.key} className="flex-1 flex items-center justify-center min-w-0 py-1">
            {item.disabled ? (
              <span className={disabledNavItemClass} aria-disabled>
                <span className="leading-none" aria-hidden>
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
                <span className="leading-none" aria-hidden>
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
                <span className="leading-none" aria-hidden>
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
