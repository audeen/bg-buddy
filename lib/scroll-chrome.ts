"use client";

import { useEffect, useState } from "react";

const MOBILE_MQ = "(max-width: 767px)";
const SCROLL_DELTA = 10;
const TOP_THRESHOLD = 16;
const SCROLLABLE_THRESHOLD_PX = 8;
const HTML_CLASS = "scroll-chrome-hidden";
const SITE_FOOTER_ID = "site-footer";
const NAV_ID = "bottom-nav-chrome";
/** Fallback bis #bottom-nav-chrome gemessen ist (entspricht --bottom-nav-height). */
const DEFAULT_NAV_HEIGHT_PX = 60;

function isPageScrollable(): boolean {
  return (
    document.documentElement.scrollHeight >
    window.innerHeight + SCROLLABLE_THRESHOLD_PX
  );
}

type Listener = (hidden: boolean) => void;

class ScrollChromeStore {
  private hidden = false;
  private scrollHidden = false;
  private footerHidden = false;
  private footerIntersecting = false;
  private listeners = new Set<Listener>();
  private subscriberCount = 0;
  private lastScrollY = 0;
  private navHeightPx = DEFAULT_NAV_HEIGHT_PX;
  private scrollHandler: (() => void) | null = null;
  private layoutHandler: (() => void) | null = null;
  private mq: MediaQueryList | null = null;
  private mqHandler: ((e: MediaQueryListEvent) => void) | null = null;
  private footerObserver: IntersectionObserver | null = null;
  private navResizeObserver: ResizeObserver | null = null;

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
        this.setScrollHidden(false);
      } else {
        const delta = y - this.lastScrollY;
        if (delta > SCROLL_DELTA) {
          this.setScrollHidden(true);
        } else if (delta < -SCROLL_DELTA) {
          this.setScrollHidden(false);
        }
      }
      this.lastScrollY = y;
    };

    this.layoutHandler = () => {
      if (!this.mq?.matches) return;
      this.syncFooterHidden();
    };

    this.mqHandler = (e: MediaQueryListEvent) => {
      if (e.matches) {
        this.setupFooterObserver();
      } else {
        this.teardownFooterObserver();
        this.footerIntersecting = false;
        this.setFooterHidden(false);
        this.setScrollHidden(false);
      }
    };

    window.addEventListener("scroll", this.scrollHandler, { passive: true });
    window.addEventListener("resize", this.layoutHandler);
    window.addEventListener("orientationchange", this.layoutHandler);
    this.mq.addEventListener("change", this.mqHandler);

    if (this.mq.matches) {
      this.setupFooterObserver();
    }
  }

  private detach(): void {
    if (this.scrollHandler) {
      window.removeEventListener("scroll", this.scrollHandler);
      this.scrollHandler = null;
    }
    if (this.layoutHandler) {
      window.removeEventListener("resize", this.layoutHandler);
      window.removeEventListener("orientationchange", this.layoutHandler);
      this.layoutHandler = null;
    }
    if (this.mq && this.mqHandler) {
      this.mq.removeEventListener("change", this.mqHandler);
      this.mqHandler = null;
    }
    this.teardownFooterObserver();
    this.mq = null;
    this.scrollHidden = false;
    this.footerHidden = false;
    this.footerIntersecting = false;
    this.applyHidden(false);
  }

  private readNavHeight(): number {
    const nav = document.getElementById(NAV_ID);
    if (!nav) return DEFAULT_NAV_HEIGHT_PX;
    return Math.ceil(nav.getBoundingClientRect().height) || DEFAULT_NAV_HEIGHT_PX;
  }

  private syncFooterHidden(): void {
    if (!this.mq?.matches) {
      this.setFooterHidden(false);
      return;
    }
    if (!isPageScrollable()) {
      this.setFooterHidden(false);
      return;
    }
    this.setFooterHidden(this.footerIntersecting);
  }

  private setupFooterObserver(): void {
    const footer = document.getElementById(SITE_FOOTER_ID);
    if (!footer) return;

    this.navHeightPx = this.readNavHeight();

    const nav = document.getElementById(NAV_ID);
    if (nav && !this.navResizeObserver) {
      this.navResizeObserver = new ResizeObserver(() => {
        const next = this.readNavHeight();
        if (next === this.navHeightPx) return;
        this.navHeightPx = next;
        this.setupFooterObserver();
      });
      this.navResizeObserver.observe(nav);
    }

    this.footerObserver?.disconnect();
    this.footerObserver = new IntersectionObserver(
      ([entry]) => {
        if (!this.mq?.matches) return;
        this.footerIntersecting = entry.isIntersecting;
        this.syncFooterHidden();
      },
      {
        root: null,
        rootMargin: `0px 0px -${this.navHeightPx}px 0px`,
        threshold: 0,
      },
    );
    this.footerObserver.observe(footer);
    this.syncFooterHidden();
  }

  private teardownFooterObserver(): void {
    this.footerObserver?.disconnect();
    this.footerObserver = null;
    this.navResizeObserver?.disconnect();
    this.navResizeObserver = null;
  }

  private setScrollHidden(value: boolean): void {
    if (this.scrollHidden === value) return;
    this.scrollHidden = value;
    this.applyHidden();
  }

  private setFooterHidden(value: boolean): void {
    if (this.footerHidden === value) return;
    this.footerHidden = value;
    this.applyHidden();
  }

  private applyHidden(force?: boolean): void {
    const value = force ?? (this.scrollHidden || this.footerHidden);
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
