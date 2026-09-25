"use client";

import { useEffect, useState } from "react";
import { prefersReducedMotion } from "@/lib/motion";

const MOBILE_MQ = "(max-width: 767px)";
const REDUCED_MOTION_MQ = "(prefers-reduced-motion: reduce)";
/** Jitter unterhalb dieser Distanz zählt nicht als Scroll-Geste. */
export const SCROLL_DEADZONE_PX = 4;
export const TOP_THRESHOLD_PX = 16;
const SNAP_IDLE_MS = 160;
const HTML_CLASS = "scroll-chrome-hidden";
const ANIMATING_CLASS = "chrome-animating";
const HIDE_VAR = "--nav-hide";
const NAV_ID = "bottom-nav-chrome";
/** Fallback bis die Leiste gemessen ist (entspricht --bottom-nav-height). */
const DEFAULT_NAV_RESERVE_PX = 60;

export function isMeaningfullyScrollable(options: {
  scrollHeight: number;
  viewportHeight: number;
  navReservePx: number;
  /** pb-nav ist gerade eingeklappt (Leiste voll versteckt). */
  paddingRemoved: boolean;
}): boolean {
  const reserve = Math.max(0, options.navReservePx);
  const overflow = options.scrollHeight - options.viewportHeight;
  const stableOverflow = overflow + (options.paddingRemoved ? reserve : 0);
  const contentOverflow = stableOverflow - reserve;
  return contentOverflow >= reserve;
}

export function nextHideProgress(options: {
  hide: number;
  deltaY: number;
  scrollY: number;
  navHeightPx: number;
  meaningfullyScrollable: boolean;
  reducedMotion: boolean;
}): number {
  if (!options.meaningfullyScrollable || options.scrollY <= TOP_THRESHOLD_PX) {
    return 0;
  }
  if (options.reducedMotion) {
    return options.deltaY > 0 ? 1 : 0;
  }
  const height = Math.max(1, options.navHeightPx);
  return clamp(options.hide + options.deltaY / height, 0, 1);
}

export function snapHideProgress(options: {
  hide: number;
  scrollY: number;
  lastDirection: "up" | "down" | null;
  meaningfullyScrollable: boolean;
}): number {
  if (!options.meaningfullyScrollable || options.scrollY <= TOP_THRESHOLD_PX) {
    return 0;
  }
  if (options.lastDirection === "up") return 0;
  if (options.hide > 0.5 && options.lastDirection === "down") return 1;
  return 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

type Listener = (hidden: boolean) => void;

class ScrollChromeStore {
  private hide = 0;
  private listeners = new Set<Listener>();
  private subscriberCount = 0;
  private lastScrollY = 0;
  private pendingDelta = 0;
  private lastDirection: "up" | "down" | null = null;
  /** Höhe der fixierten Leiste — Teiler für das 1:1-Mitlaufen. */
  private navHeightPx = DEFAULT_NAV_RESERVE_PX;
  /** In-Flow-Padding, das bei voll versteckter Leiste wegfällt (`--bottom-nav-height`). */
  private navReservePx = DEFAULT_NAV_RESERVE_PX;
  private reducedMotion = false;
  private writeGeneration = 0;
  private snapTimer: number | null = null;
  private scrollHandler: (() => void) | null = null;
  private scrollEndHandler: (() => void) | null = null;
  private layoutHandler: (() => void) | null = null;
  private mq: MediaQueryList | null = null;
  private mqHandler: ((e: MediaQueryListEvent) => void) | null = null;
  private motionMq: MediaQueryList | null = null;
  private motionHandler: ((e: MediaQueryListEvent) => void) | null = null;
  private resizeObserver: ResizeObserver | null = null;

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    this.subscriberCount++;
    if (this.subscriberCount === 1) this.attach();
    listener(this.hide >= 1);
    return () => {
      this.listeners.delete(listener);
      this.subscriberCount--;
      if (this.subscriberCount === 0) this.detach();
    };
  }

  private attach(): void {
    if (typeof window === "undefined") return;

    this.mq = window.matchMedia(MOBILE_MQ);
    this.motionMq = window.matchMedia(REDUCED_MOTION_MQ);
    this.reducedMotion = this.motionMq.matches || prefersReducedMotion();
    this.lastScrollY = window.scrollY;
    this.measureNav();
    this.writeHide(0, false);

    this.scrollHandler = () => this.onScroll();
    this.scrollEndHandler = () => this.finishGesture();
    this.layoutHandler = () => {
      this.measureNav();
      this.ensureVisibleIfNeeded(true);
    };

    this.mqHandler = (e: MediaQueryListEvent) => {
      if (!e.matches) this.writeHide(0, true);
      else this.ensureVisibleIfNeeded(true);
    };
    this.motionHandler = (e: MediaQueryListEvent) => {
      this.reducedMotion = e.matches;
    };

    window.addEventListener("scroll", this.scrollHandler, { passive: true });
    window.addEventListener("scrollend", this.scrollEndHandler);
    window.addEventListener("resize", this.layoutHandler);
    window.addEventListener("orientationchange", this.layoutHandler);
    this.mq.addEventListener("change", this.mqHandler);
    this.motionMq.addEventListener("change", this.motionHandler);

    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => {
        this.ensureVisibleIfNeeded(false);
      });
      this.resizeObserver.observe(document.documentElement);
    }
  }

  private detach(): void {
    if (this.scrollHandler) {
      window.removeEventListener("scroll", this.scrollHandler);
      this.scrollHandler = null;
    }
    if (this.scrollEndHandler) {
      window.removeEventListener("scrollend", this.scrollEndHandler);
      this.scrollEndHandler = null;
    }
    if (this.layoutHandler) {
      window.removeEventListener("resize", this.layoutHandler);
      window.removeEventListener("orientationchange", this.layoutHandler);
      this.layoutHandler = null;
    }
    if (this.mq && this.mqHandler) {
      this.mq.removeEventListener("change", this.mqHandler);
    }
    if (this.motionMq && this.motionHandler) {
      this.motionMq.removeEventListener("change", this.motionHandler);
    }
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.mq = null;
    this.mqHandler = null;
    this.motionMq = null;
    this.motionHandler = null;
    if (this.snapTimer != null) {
      window.clearTimeout(this.snapTimer);
      this.snapTimer = null;
    }
    this.pendingDelta = 0;
    this.lastDirection = null;
    this.writeHide(0, false);
  }

  private measureNav(): void {
    const nav = document.getElementById(NAV_ID);
    const height = nav ? Math.ceil(nav.getBoundingClientRect().height) : 0;
    this.navHeightPx = height || DEFAULT_NAV_RESERVE_PX;

    const probe = document.createElement("div");
    probe.style.cssText =
      "position:absolute;visibility:hidden;pointer-events:none;height:var(--bottom-nav-height);";
    document.documentElement.appendChild(probe);
    const reserve = Math.ceil(probe.getBoundingClientRect().height);
    probe.remove();
    this.navReservePx = reserve || DEFAULT_NAV_RESERVE_PX;
  }

  private pageCanHide(): boolean {
    if (!this.mq?.matches) return false;
    return isMeaningfullyScrollable({
      scrollHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight,
      navReservePx: this.navReservePx,
      paddingRemoved: document.documentElement.classList.contains(HTML_CLASS),
    });
  }

  private onScroll(): void {
    if (!this.mq?.matches) return;

    const y = window.scrollY;
    const delta = y - this.lastScrollY;
    this.lastScrollY = y;

    if (!this.pageCanHide() || y <= TOP_THRESHOLD_PX) {
      this.pendingDelta = 0;
      this.lastDirection = null;
      this.writeHide(0, true);
      return;
    }

    this.pendingDelta += delta;
    if (Math.abs(this.pendingDelta) < SCROLL_DEADZONE_PX) {
      this.armSnap();
      return;
    }

    const applied = this.pendingDelta;
    this.pendingDelta = 0;
    this.lastDirection = applied > 0 ? "down" : "up";
    const next = nextHideProgress({
      hide: this.hide,
      deltaY: applied,
      scrollY: y,
      navHeightPx: this.navHeightPx,
      meaningfullyScrollable: true,
      reducedMotion: this.reducedMotion,
    });
    this.writeHide(next, false);
    this.armSnap();
  }

  private armSnap(): void {
    if (this.snapTimer != null) window.clearTimeout(this.snapTimer);
    this.snapTimer = window.setTimeout(() => this.finishGesture(), SNAP_IDLE_MS);
  }

  private finishGesture(): void {
    if (this.snapTimer != null) {
      window.clearTimeout(this.snapTimer);
      this.snapTimer = null;
    }
    if (!this.mq?.matches) return;
    const next = snapHideProgress({
      hide: this.hide,
      scrollY: window.scrollY,
      lastDirection: this.lastDirection,
      meaningfullyScrollable: this.pageCanHide(),
    });
    this.pendingDelta = 0;
    this.writeHide(next, true);
  }

  private ensureVisibleIfNeeded(animate: boolean): void {
    if (!this.pageCanHide() || window.scrollY <= TOP_THRESHOLD_PX) {
      this.pendingDelta = 0;
      this.lastDirection = null;
      this.writeHide(0, animate);
    }
  }

  private writeHide(value: number, animate: boolean): void {
    const next = clamp(value, 0, 1);
    const hidden = next >= 1;
    const changed = Math.abs(this.hide - next) > 0.001;
    this.hide = next;
    if (typeof document === "undefined") return;

    const generation = ++this.writeGeneration;
    const apply = () => {
      if (generation !== this.writeGeneration) return;
      document.documentElement.style.setProperty(HIDE_VAR, this.hide.toFixed(4));
      document.documentElement.classList.toggle(HTML_CLASS, this.hide >= 1);
    };

    if (animate && changed && !this.reducedMotion) {
      document.documentElement.classList.add(ANIMATING_CLASS);
      requestAnimationFrame(apply);
    } else {
      document.documentElement.classList.remove(ANIMATING_CLASS);
      apply();
    }

    if (!changed) return;
    for (const listener of this.listeners) listener(hidden);
  }
}

const scrollChromeStore = new ScrollChromeStore();

export function useScrollChromeHidden(): boolean {
  const [hidden, setHidden] = useState(false);

  useEffect(() => scrollChromeStore.subscribe(setHidden), []);

  return hidden;
}
