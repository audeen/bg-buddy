"use client";

import { useCallback, useRef, useSyncExternalStore } from "react";

const STORAGE_KEY = "bg-buddy:secret-menu";
const TRIPLE_CLICK_WINDOW_MS = 500;

const listeners = new Set<() => void>();

function readRevealed(): boolean {
  return sessionStorage.getItem(STORAGE_KEY) === "1";
}

function reveal() {
  sessionStorage.setItem(STORAGE_KEY, "1");
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useSecretMenuReveal() {
  const revealed = useSyncExternalStore(subscribe, readRevealed, () => false);
  const clicksRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const registerClick = useCallback(() => {
    clicksRef.current += 1;
    if (timerRef.current) clearTimeout(timerRef.current);

    if (clicksRef.current >= 3) {
      clicksRef.current = 0;
      reveal();
      return;
    }

    timerRef.current = setTimeout(() => {
      clicksRef.current = 0;
    }, TRIPLE_CLICK_WINDOW_MS);
  }, []);

  return { revealed, registerClick };
}
