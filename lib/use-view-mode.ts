"use client";

import { useCallback, useSyncExternalStore } from "react";

export type GamesViewMode = "deck" | "grid";

const STORAGE_KEY = "bg-buddy-games-view";
const MOBILE_BREAKPOINT_PX = 768;

let cached: GamesViewMode | null = null;
const listeners = new Set<() => void>();

function readInitialMode(): GamesViewMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "deck" || stored === "grid") return stored;
  } catch {
    // localStorage nicht verfügbar (z.B. Privacy-Modus) → Viewport-Default.
  }
  return window.innerWidth < MOBILE_BREAKPOINT_PX ? "deck" : "grid";
}

function getSnapshot(): GamesViewMode {
  if (cached == null) cached = readInitialMode();
  return cached;
}

// SSR kennt weder Viewport noch localStorage → bis zur Hydration Grid rendern.
const getServerSnapshot = (): GamesViewMode | null => null;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Ansicht der Spielelisten ("deck" = Swipe-Karten, "grid" = klassisches Raster).
 * Default ohne gespeicherte Wahl: Deck auf Mobile, Grid auf Desktop.
 * Liefert `null` vor der Hydration (SSR-Snapshot).
 */
export function useGamesViewMode(): {
  viewMode: GamesViewMode | null;
  setViewMode: (mode: GamesViewMode) => void;
} {
  const viewMode = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const setViewMode = useCallback((mode: GamesViewMode) => {
    cached = mode;
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // ignorieren
    }
    for (const l of listeners) l();
  }, []);

  return { viewMode, setViewMode };
}
