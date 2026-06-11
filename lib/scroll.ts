"use client";

import { prefersReducedMotion } from "@/lib/motion";

/** Scroll-Verhalten, das `prefers-reduced-motion` respektiert. */
export function scrollBehavior(): ScrollBehavior {
  return prefersReducedMotion() ? "auto" : "smooth";
}

/** Scrollt zu einem Element per id (nach dem nächsten Frame, z. B. nach Navigation). */
export function scrollToElement(id: string) {
  requestAnimationFrame(() => {
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
  });
}
