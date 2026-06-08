"use client";

import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import {
  isAtPageTop,
  isMeetupDetailPath,
  isSwipeBackCandidate,
} from "@/lib/swipe-back";
import { useSwipeBackEdge } from "@/lib/use-swipe-back-edge";

function subscribeMeetupPageTop(onStoreChange: () => void) {
  window.addEventListener("scroll", onStoreChange, { passive: true });
  return () => window.removeEventListener("scroll", onStoreChange);
}

function getMeetupPageTopSnapshot() {
  return isAtPageTop();
}

export function SwipeBackHandler() {
  const pathname = usePathname();
  const atPageTop = useSyncExternalStore(
    subscribeMeetupPageTop,
    getMeetupPageTopSnapshot,
    () => true,
  );

  const showHint =
    isSwipeBackCandidate(pathname) &&
    (!isMeetupDetailPath(pathname) || atPageTop);

  useEffect(() => {
    document.documentElement.classList.toggle("swipe-back-active", showHint);
    return () => {
      document.documentElement.classList.remove("swipe-back-active");
    };
  }, [showHint]);

  useSwipeBackEdge(pathname);

  if (!showHint) return null;

  return <div className="swipe-back-edge-hint" aria-hidden />;
}
