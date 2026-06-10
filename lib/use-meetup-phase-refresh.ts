"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const POLL_MS = 5000;

/** Re-fetch server props while pick/duell phase may still change (others voting). */
export function useMeetupPhaseRefresh(active: boolean) {
  const router = useRouter();

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") router.refresh();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [router]);

  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [active, router]);
}
