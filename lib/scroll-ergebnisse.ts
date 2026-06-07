import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { prefersReducedMotion } from "@/lib/motion";

export const SCROLL_ERGEBNISSE_KEY = "bg-buddy:scroll-ergebnisse";

const ERGEBNISSE_HASH = "#ergebnisse";
const MAX_RAF_ATTEMPTS = 24;
const RESIZE_WATCH_MS = 3000;

export function isMeetupDetailPath(pathname: string): boolean {
  return /^\/meetups\/[^/]+$/.test(pathname);
}

export function shouldScrollToErgebnisse(): boolean {
  if (typeof window === "undefined") return false;
  if (window.location.hash === ERGEBNISSE_HASH) return true;
  try {
    return sessionStorage.getItem(SCROLL_ERGEBNISSE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markScrollToErgebnisse(): void {
  try {
    sessionStorage.setItem(SCROLL_ERGEBNISSE_KEY, "1");
  } catch {
    // ignore private browsing / storage errors
  }
}

export function clearScrollToErgebnisseMark(): void {
  try {
    sessionStorage.removeItem(SCROLL_ERGEBNISSE_KEY);
  } catch {
    // ignore
  }
}

export function scrollErgebnisseIntoView(): boolean {
  if (typeof document === "undefined") return false;

  const el = document.getElementById("ergebnisse");
  if (!el) return false;

  el.scrollIntoView({
    behavior: prefersReducedMotion() ? "auto" : "smooth",
    block: "start",
  });
  return true;
}

export function scrollToErgebnisseElement(): boolean {
  if (!scrollErgebnisseIntoView()) return false;

  const url = `${window.location.pathname}${ERGEBNISSE_HASH}`;
  if (`${window.location.pathname}${window.location.hash}` !== url) {
    window.history.replaceState(null, "", url);
    window.dispatchEvent(new Event("hashchange"));
  }

  clearScrollToErgebnisseMark();
  return true;
}

export function followErgebnisseLayoutGrowth(
  durationMs = RESIZE_WATCH_MS,
): () => void {
  if (typeof window === "undefined" || typeof ResizeObserver === "undefined") {
    return () => {};
  }

  const el = document.getElementById("ergebnisse");
  if (!el) return () => {};

  const observer = new ResizeObserver(() => {
    scrollErgebnisseIntoView();
  });

  observer.observe(el);
  const timeoutId = window.setTimeout(() => observer.disconnect(), durationMs);

  return () => {
    observer.disconnect();
    window.clearTimeout(timeoutId);
  };
}

export function retryScrollToErgebnisseElement(
  onSuccess?: () => void,
): () => void {
  let rafAttempts = 0;
  let rafId = 0;
  const timeoutIds: ReturnType<typeof setTimeout>[] = [];

  let done = false;

  const attempt = () => {
    if (done) return true;
    if (scrollToErgebnisseElement()) {
      done = true;
      onSuccess?.();
      return true;
    }
    return false;
  };

  const scheduleRaf = () => {
    if (done || rafAttempts >= MAX_RAF_ATTEMPTS) return;
    rafAttempts += 1;
    rafId = requestAnimationFrame(() => {
      if (!attempt()) scheduleRaf();
    });
  };

  attempt();
  scheduleRaf();
  for (const delay of [0, 50, 150]) {
    timeoutIds.push(setTimeout(attempt, delay));
  }

  const cleanupResizeWatch = followErgebnisseLayoutGrowth();

  return () => {
    done = true;
    cancelAnimationFrame(rafId);
    for (const id of timeoutIds) clearTimeout(id);
    cleanupResizeWatch();
  };
}

export function retryScrollToErgebnisseIfNeeded(
  onSuccess?: () => void,
): () => void {
  if (!shouldScrollToErgebnisse()) {
    return () => {};
  }
  return retryScrollToErgebnisseElement(onSuccess);
}

export function navigateToErgebnisse(
  meetupId: string,
  pathname: string,
  router: AppRouterInstance,
  onHashSynced?: () => void,
): void {
  if (isMeetupDetailPath(pathname)) {
    retryScrollToErgebnisseElement(onHashSynced);
    return;
  }

  markScrollToErgebnisse();
  router.push(`/meetups/${meetupId}`, { scroll: false });
}
