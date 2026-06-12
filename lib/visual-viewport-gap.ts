"use client";

import { useEffect } from "react";

const CSS_VAR = "--vv-bottom-gap";

/**
 * Größere Lücken stammen von der Bildschirmtastatur — darüber soll die
 * Navigation nicht schweben. Browser-Toolbars (z.B. Firefox iOS) sind <100px.
 */
const MAX_GAP_PX = 140;

/**
 * Misst, wie weit der sichtbare Viewport-Boden über dem Layout-Viewport-Boden
 * endet, und stellt die Differenz als CSS-Variable `--vv-bottom-gap` bereit.
 *
 * Hintergrund: Firefox iOS verankert `position: fixed; bottom: 0` am
 * Layout-Viewport, dessen unterer Bereich von der einklappbaren
 * Browser-Toolbar überdeckt wird. Safari/Chrome passen den Layout-Viewport
 * an (Lücke = 0), dort ändert sich nichts.
 */
export function useVisualViewportBottomGap() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    let raf = 0;
    const update = () => {
      raf = 0;
      // Beim Überscrollen am Seitenanfang (Gummiband/Pull-to-Refresh) wird
      // offsetTop negativ — das ist keine Toolbar-Überdeckung und darf die
      // Lücke nicht vergrößern, sonst wandert die Nav nach oben.
      const offsetTop = Math.max(vv.offsetTop, 0);
      const gap = Math.round(window.innerHeight - (vv.height + offsetTop));
      const clamped = gap > 0 && gap <= MAX_GAP_PX ? gap : 0;
      document.documentElement.style.setProperty(CSS_VAR, `${clamped}px`);
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
