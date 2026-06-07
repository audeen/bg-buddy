"use client";

import { useScrollChromeHidden } from "@/lib/scroll-chrome";

export function HeaderChrome({ children }: { children: React.ReactNode }) {
  const chromeHidden = useScrollChromeHidden();

  return (
    <header
      className={`border-b border-[var(--border)] bg-[var(--surface)] sticky top-0 z-20 safe-top header-shadow header-chrome${chromeHidden ? " chrome-hidden" : ""}`}
    >
      {children}
    </header>
  );
}
