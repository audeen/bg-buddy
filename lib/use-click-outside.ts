"use client";

import { useEffect, type RefObject } from "react";

/** Ruft `onOutside` auf, wenn außerhalb des referenzierten Elements geklickt wird. */
export function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  onOutside: () => void,
  active = true,
) {
  useEffect(() => {
    if (!active) return;
    function handleClick(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) {
        onOutside();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [ref, onOutside, active]);
}
