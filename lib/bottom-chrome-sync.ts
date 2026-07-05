"use client";

import { useEffect } from "react";

export const BOTTOM_NAV_CHROME_ID = "bottom-nav-chrome";
export const BOTTOM_CHROME_HEIGHT_VAR = "--bottom-chrome-height";

export function useBottomChromeHeight() {
  useEffect(() => {
    let observer: ResizeObserver | null = null;

    const attach = () => {
      const nav = document.getElementById(BOTTOM_NAV_CHROME_ID);
      if (!nav) return false;

      const update = () => {
        const height = Math.ceil(nav.getBoundingClientRect().height);
        document.documentElement.style.setProperty(
          BOTTOM_CHROME_HEIGHT_VAR,
          `${height}px`,
        );
      };

      observer?.disconnect();
      observer = new ResizeObserver(update);
      observer.observe(nav);
      update();
      return true;
    };

    if (!attach()) {
      const id = window.requestAnimationFrame(() => {
        attach();
      });
      return () => {
        window.cancelAnimationFrame(id);
        observer?.disconnect();
        document.documentElement.style.removeProperty(BOTTOM_CHROME_HEIGHT_VAR);
      };
    }

    return () => {
      observer?.disconnect();
      document.documentElement.style.removeProperty(BOTTOM_CHROME_HEIGHT_VAR);
    };
  }, []);
}
