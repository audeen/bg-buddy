"use client";

import { useEffect } from "react";

const CSS_VAR = "--vv-visible-bottom";

/**
 * Eine große Differenz zwischen Layout- und sichtbarem Viewport stammt von der
 * Bildschirmtastatur — dann soll die Navigation nicht mitten im Bild schweben,
 * sondern (wie zuvor) am Layout-Boden hinter der Tastatur verschwinden.
 * Browser-Toolbars (z. B. Firefox iOS) sind deutlich kleiner.
 */
const KEYBOARD_THRESHOLD_PX = 140;

/**
 * Stellt als CSS-Variable `--vv-visible-bottom` bereit, wie weit (in px vom
 * oberen Layout-Viewport-Rand) der sichtbare Viewport unten endet.
 *
 * Hintergrund: Firefox iOS verkleinert beim Einblenden der Toolbar sowohl
 * `window.innerHeight` als auch `visualViewport.height` gemeinsam, sodass eine
 * Höhen-*Differenz* die Toolbar nicht erkennt. Gleichzeitig verankert der
 * Browser `position: fixed; bottom: 0` weiterhin hinter der Toolbar
 * (Firefox-Bug 1978012). Statt den Boden zu korrigieren, verankern wir feste
 * Elemente per `top: var(--vv-visible-bottom)` direkt an der sichtbaren
 * Unterkante — diesen Wert melden Safari, Chrome und Firefox auf iOS konsistent.
 */
export function useVisualViewportBottom() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    let raf = 0;
    const update = () => {
      raf = 0;
      // Beim Überscrollen am Seitenanfang (Gummiband/Pull-to-Refresh) wird
      // offsetTop negativ — das darf die sichtbare Unterkante nicht verschieben.
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
