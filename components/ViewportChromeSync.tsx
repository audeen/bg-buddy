"use client";

import { useBottomChromeHeight } from "@/lib/bottom-chrome-sync";
import { useVisualViewportBottom } from "@/lib/visual-viewport-gap";

/** Zentraler Mount für Viewport- und Bottom-Chrome-Sync (Nav-Höhe, sichtbare Unterkante). */
export function ViewportChromeSync() {
  useVisualViewportBottom();
  useBottomChromeHeight();
  return null;
}
