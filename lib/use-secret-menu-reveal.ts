"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "bg-buddy:secret-menu";
const TRIPLE_CLICK_WINDOW_MS = 500;

export function useSecretMenuReveal() {
  const [revealed, setRevealed] = useState(false);
  const clicksRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setRevealed(sessionStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  const registerClick = useCallback(() => {
    clicksRef.current += 1;
    if (timerRef.current) clearTimeout(timerRef.current);

    if (clicksRef.current >= 3) {
      clicksRef.current = 0;
      setRevealed(true);
      sessionStorage.setItem(STORAGE_KEY, "1");
      return;
    }

    timerRef.current = setTimeout(() => {
      clicksRef.current = 0;
    }, TRIPLE_CLICK_WINDOW_MS);
  }, []);

  return { revealed, registerClick };
}
