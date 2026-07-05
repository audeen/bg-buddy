"use client";

import { useViewportChromeSync } from "@/lib/bottom-chrome-sync";

/** @deprecated Use useViewportChromeSync from bottom-chrome-sync */
export function useVisualViewportBottom() {
  useViewportChromeSync();
}
