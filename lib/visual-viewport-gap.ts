"use client";

import { useEffect } from "react";
import { TOP_THRESHOLD_PX } from "@/lib/scroll-chrome";

const CSS_VAR = "--browser-bottom-inset";

/**
 * Eine große Differenz zwischen Layout- und sichtbarem Viewport stammt von der
 * Bildschirmtastatur — dann soll die Navigation nicht mitten im Bild schweben,
 * sondern am Layout-Boden hinter der Tastatur verschwinden.
 */
export const KEYBOARD_THRESHOLD_PX = 140;

/** Obergrenze, damit ein fehlgemessenes lvh/svh die Leiste nicht in die Mitte schiebt. */
const MAX_BROWSER_CHROME_PX = 128;

/** Ab diesem Überstand kann die Firefox-Toolbar beim Scrollen einklappen. */
const TOOLBAR_COLLAPSE_OVERFLOW_PX = 64;

export function browserBottomInset(options: {
  innerHeight: number;
  offsetTop: number;
  visualHeight: number;
  scrollY: number;
  pageCanCollapseToolbar: boolean;
  isFirefox: boolean;
  /** 100lvh − 100svh, gesamte dynamische Browser-Chrome. */
  viewportChromePx: number;
}): number {
  const gap =
    options.innerHeight - options.offsetTop - options.visualHeight;
  if (gap > KEYBOARD_THRESHOLD_PX) return 0;

  const reported = Math.max(0, Math.round(gap));
  if (reported >= 1 || !options.isFirefox) return reported;

  const topChrome = Math.max(0, Math.round(options.offsetTop));
  const bottomChrome = Math.min(
    MAX_BROWSER_CHROME_PX,
    Math.max(0, Math.round(options.viewportChromePx) - topChrome),
  );
  if (bottomChrome <= 0) return 0;
  if (
    !options.pageCanCollapseToolbar ||
    options.scrollY <= TOP_THRESHOLD_PX
  ) {
    return bottomChrome;
  }

  const factor = Math.max(
    0,
    1 - (options.scrollY - TOP_THRESHOLD_PX) / bottomChrome,
  );
  return Math.round(bottomChrome * factor);
}

function isFirefoxBrowser(): boolean {
  return /FxiOS|Firefox\//.test(navigator.userAgent);
}

function measureViewportChrome(): number {
  const el = document.createElement("div");
  el.style.cssText =
    "position:fixed;left:0;top:0;width:0;visibility:hidden;pointer-events:none;";
  const small = document.createElement("div");
  const large = document.createElement("div");
  small.style.height = "100svh";
  large.style.height = "100lvh";
  el.append(small, large);
  document.documentElement.appendChild(el);
  const diff =
    large.getBoundingClientRect().height - small.getBoundingClientRect().height;
  el.remove();
  return Math.max(0, Math.round(diff));
}

function pageCanCollapseToolbar(): boolean {
  return (
    document.documentElement.scrollHeight >
    window.innerHeight + TOOLBAR_COLLAPSE_OVERFLOW_PX
  );
}

/**
 * Setzt `--browser-bottom-inset`: Abstand der fixierten Leiste vom Layout-Boden,
 * damit sie über der Browser-Toolbar bleibt (Firefox meldet die oft nicht über
 * visualViewport, Bug 1978012).
 */
export function useVisualViewportBottom() {
  useEffect(() => {
    const vv = window.visualViewport;
    let raf = 0;
    let viewportChromePx = measureViewportChrome();
    const firefox = isFirefoxBrowser();

    const update = () => {
      raf = 0;
      const offsetTop = vv ? Math.max(vv.offsetTop, 0) : 0;
      const visualHeight = vv ? vv.height : window.innerHeight;
      const inset = browserBottomInset({
        innerHeight: window.innerHeight,
        offsetTop,
        visualHeight,
        scrollY: window.scrollY,
        pageCanCollapseToolbar: pageCanCollapseToolbar(),
        isFirefox: firefox,
        viewportChromePx,
      });
      document.documentElement.style.setProperty(CSS_VAR, `${inset}px`);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    const onResize = () => {
      viewportChromePx = measureViewportChrome();
      schedule();
    };

    update();
    vv?.addEventListener("resize", schedule);
    vv?.addEventListener("scroll", schedule);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      vv?.removeEventListener("resize", schedule);
      vv?.removeEventListener("scroll", schedule);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      document.documentElement.style.removeProperty(CSS_VAR);
    };
  }, []);
}
