"use client";

import { useEffect } from "react";

const CSS_VAR = "--vv-visible-bottom";

/**
 * Eine große Differenz zwischen Layout- und sichtbarem Viewport stammt von der
 * Bildschirmtastatur — dann soll die Navigation nicht mitten im Bild schweben,
 * sondern (wie zuvor) am Layout-Boden hinter der Tastatur verschwinden.
 */
const KEYBOARD_THRESHOLD_PX = 140;

/**
 * Stellt als CSS-Variable `--vv-visible-bottom` bereit, wie weit (in px vom
 * oberen Layout-Viewport-Rand) der sichtbare Viewport unten endet.
 */
export function useVisualViewportBottom() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    let raf = 0;
    const update = () => {
      raf = 0;
      const offsetTop = Math.max(vv.offsetTop, 0);
      const visibleBottom = Math.round(offsetTop + vv.height);
      const keyboardGap = window.innerHeight - visibleBottom;
      const value =
        keyboardGap > KEYBOARD_THRESHOLD_PX ? window.innerHeight : visibleBottom;
      document.documentElement.style.setProperty(CSS_VAR, `${value}px`);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    vv.addEventListener("resize", schedule);
    vv.addEventListener("scroll", schedule);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      vv.removeEventListener("resize", schedule);
      vv.removeEventListener("scroll", schedule);
      document.documentElement.style.removeProperty(CSS_VAR);
    };
  }, []);
}
