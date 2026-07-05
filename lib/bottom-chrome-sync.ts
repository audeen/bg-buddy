"use client";

import { useEffect } from "react";

export const BOTTOM_NAV_CHROME_ID = "bottom-nav-chrome";
export const SITE_FOOTER_CONTENT_ID = "site-footer-content";

export const BOTTOM_CHROME_HEIGHT_VAR = "--bottom-chrome-height";
export const BOTTOM_CHROME_RESERVE_VAR = "--bottom-chrome-reserve";
export const VV_VISIBLE_BOTTOM_VAR = "--vv-visible-bottom";

const MOBILE_MQ = "(max-width: 767px)";
const KEYBOARD_THRESHOLD_PX = 140;
const OVERLAP_BUFFER_PX = 8;

function isMobile(): boolean {
  return window.matchMedia(MOBILE_MQ).matches;
}

function isKeyboardOpen(visibleBottom: number): boolean {
  return window.innerHeight - visibleBottom > KEYBOARD_THRESHOLD_PX;
}

function readVisibleBottom(vv: VisualViewport): number {
  const offsetTop = Math.max(vv.offsetTop, 0);
  let visibleBottom = Math.round(offsetTop + vv.height);

  if (isKeyboardOpen(visibleBottom)) {
    return visibleBottom;
  }

  const clientHeight = document.documentElement.clientHeight;
  // Nav nie höher als der Layout-Viewport-Boden — verhindert vv-Dips (Toolbar-Animation).
  visibleBottom = Math.max(visibleBottom, clientHeight, window.innerHeight);

  return visibleBottom;
}

function readOverlapReserve(nav: HTMLElement): number {
  const footerContent = document.getElementById(SITE_FOOTER_CONTENT_ID);
  if (!footerContent || !isMobile()) return 0;

  const navTop = nav.getBoundingClientRect().top;
  const contentBottom = footerContent.getBoundingClientRect().bottom;
  const overlap = Math.ceil(contentBottom - navTop + OVERLAP_BUFFER_PX);
  return overlap > 0 ? overlap : 0;
}

function syncViewportChrome(): void {
  const nav = document.getElementById(BOTTOM_NAV_CHROME_ID);
  const vv = window.visualViewport;

  if (nav) {
    const navHeight = Math.ceil(nav.getBoundingClientRect().height);
    document.documentElement.style.setProperty(
      BOTTOM_CHROME_HEIGHT_VAR,
      `${navHeight}px`,
    );

    const reserve = readOverlapReserve(nav);
    document.documentElement.style.setProperty(
      BOTTOM_CHROME_RESERVE_VAR,
      `${reserve}px`,
    );
  }

  if (!vv) return;

  const visibleBottom = readVisibleBottom(vv);
  const anchorBottom = isKeyboardOpen(visibleBottom)
    ? window.innerHeight
    : visibleBottom;

  document.documentElement.style.setProperty(
    VV_VISIBLE_BOTTOM_VAR,
    `${anchorBottom}px`,
  );
}

/** Zentraler Sync für Nav-Höhe, Viewport-Unterkante und Footer-Overlap-Guard. */
export function useViewportChromeSync() {
  useEffect(() => {
    let raf = 0;
    let navObserver: ResizeObserver | null = null;
    let navClassObserver: MutationObserver | null = null;

    const schedule = () => {
      if (!raf) {
        raf = requestAnimationFrame(() => {
          raf = 0;
          syncViewportChrome();
        });
      }
    };

    const attachNavObservers = () => {
      const nav = document.getElementById(BOTTOM_NAV_CHROME_ID);
      if (!nav) return false;

      navObserver?.disconnect();
      navObserver = new ResizeObserver(schedule);
      navObserver.observe(nav);

      navClassObserver?.disconnect();
      navClassObserver = new MutationObserver(schedule);
      navClassObserver.observe(nav, {
        attributes: true,
        attributeFilter: ["class"],
      });

      return true;
    };

    if (!attachNavObservers()) {
      requestAnimationFrame(attachNavObservers);
    }

    const vv = window.visualViewport;
    vv?.addEventListener("resize", schedule);
    vv?.addEventListener("scroll", schedule);
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("orientationchange", schedule);

    schedule();

    return () => {
      if (raf) cancelAnimationFrame(raf);
      navObserver?.disconnect();
      navClassObserver?.disconnect();
      vv?.removeEventListener("resize", schedule);
      vv?.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("orientationchange", schedule);
      document.documentElement.style.removeProperty(BOTTOM_CHROME_HEIGHT_VAR);
      document.documentElement.style.removeProperty(BOTTOM_CHROME_RESERVE_VAR);
      document.documentElement.style.removeProperty(VV_VISIBLE_BOTTOM_VAR);
    };
  }, []);
}

/** @deprecated Use useViewportChromeSync */
export function useBottomChromeHeight() {
  useViewportChromeSync();
}
