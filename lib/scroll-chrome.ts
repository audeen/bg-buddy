"use client";

import { useEffect, useState } from "react";

const MOBILE_MQ = "(max-width: 767px)";
const SCROLL_DELTA = 10;
const TOP_THRESHOLD = 16;
const HTML_CLASS = "scroll-chrome-hidden";

type Listener = (hidden: boolean) => void;

class ScrollChromeStore {
  private hidden = false;
  private listeners = new Set<Listener>();
  private subscriberCount = 0;
  private lastScrollY = 0;
  private scrollHandler: (() => void) | null = null;
  private mq: MediaQueryList | null = null;
  private mqHandler: ((e: MediaQueryListEvent) => void) | null = null;

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    this.subscriberCount++;
    if (this.subscriberCount === 1) this.attach();
    listener(this.hidden);
    return () => {
      this.listeners.delete(listener);
      this.subscriberCount--;
      if (this.subscriberCount === 0) this.detach();
    };
  }

  private attach(): void {
    if (typeof window === "undefined") return;

    this.mq = window.matchMedia(MOBILE_MQ);
    this.lastScrollY = window.scrollY;

    this.scrollHandler = () => {
      if (!this.mq?.matches) return;

      const y = window.scrollY;
      if (y <= TOP_THRESHOLD) {
        this.setHidden(false);
      } else {
        const delta = y - this.lastScrollY;
        if (delta > SCROLL_DELTA) {
          this.setHidden(true);
        } else if (delta < -SCROLL_DELTA) {
          this.setHidden(false);
        }
      }
      this.lastScrollY = y;
    };

    this.mqHandler = (e: MediaQueryListEvent) => {
      if (!e.matches) this.setHidden(false);
    };

    window.addEventListener("scroll", this.scrollHandler, { passive: true });
    this.mq.addEventListener("change", this.mqHandler);
  }

  private detach(): void {
    if (this.scrollHandler) {
      window.removeEventListener("scroll", this.scrollHandler);
      this.scrollHandler = null;
    }
    if (this.mq && this.mqHandler) {
      this.mq.removeEventListener("change", this.mqHandler);
      this.mqHandler = null;
    }
    this.mq = null;
    this.setHidden(false);
  }

  private setHidden(value: boolean): void {
    if (this.hidden === value) return;
    this.hidden = value;
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle(HTML_CLASS, value);
    }
    for (const listener of this.listeners) {
      listener(value);
    }
  }
}

const scrollChromeStore = new ScrollChromeStore();

export function useScrollChromeHidden(): boolean {
  const [hidden, setHidden] = useState(false);

  useEffect(() => scrollChromeStore.subscribe(setHidden), []);

  return hidden;
}
