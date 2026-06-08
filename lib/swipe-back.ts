export const SWIPE_BACK_MOBILE_MQ = "(max-width: 767px)";

export function isMeetupDetailPath(pathname: string): boolean {
  return /^\/meetups\/(?!new$)[^/]+$/.test(pathname);
}

export function isAtPageTop(scrollTargetId = "meetup-page-top"): boolean {
  if (typeof document === "undefined") return false;
  const el = document.getElementById(scrollTargetId);
  if (!el) return window.scrollY <= 8;
  return el.getBoundingClientRect().top >= -8;
}

export function isSwipeBackCandidate(pathname: string): boolean {
  if (pathname === "/meetups/new") return true;
  if (/^\/meetups\/[^/]+\/(pick|duell|erweiterung)$/.test(pathname)) return true;
  if (isMeetupDetailPath(pathname)) return true;
  if (/^\/games\/\d+$/.test(pathname)) return true;
  if (/^\/admin\/collection\/\d+$/.test(pathname)) return true;
  return false;
}

export function resolveSwipeBackTarget(pathname: string): string | null {
  const pickMatch = pathname.match(/^\/meetups\/([^/]+)\/pick$/);
  if (pickMatch) return `/meetups/${pickMatch[1]}`;

  const duellMatch = pathname.match(/^\/meetups\/([^/]+)\/duell$/);
  if (duellMatch) return `/meetups/${duellMatch[1]}`;

  const erwMatch = pathname.match(/^\/meetups\/([^/]+)\/erweiterung$/);
  if (erwMatch) return `/meetups/${erwMatch[1]}`;

  if (pathname === "/meetups/new") return "/";

  if (isMeetupDetailPath(pathname)) {
    if (!isAtPageTop()) return null;
    return "/";
  }

  if (/^\/games\/\d+$/.test(pathname)) return "/games";

  if (/^\/admin\/collection\/\d+$/.test(pathname)) return "/admin/collection";

  return null;
}
