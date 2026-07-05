"use client";

import { useViewportChromeSync } from "@/lib/bottom-chrome-sync";

/** Zentraler Mount für Viewport- und Bottom-Chrome-Sync (Nav-Höhe, sichtbare Unterkante, Footer-Guard). */
export function ViewportChromeSync() {
  useViewportChromeSync();
  return null;
}
