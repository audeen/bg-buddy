"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "@/lib/motion";
import {
  resolveSwipeBackTarget,
  SWIPE_BACK_MOBILE_MQ,
} from "@/lib/swipe-back";

const EDGE_ZONE_PX = 24;
const COMMIT_THRESHOLD_PX = 80;
const DIRECTION_DEADZONE_PX = 8;
const VERTICAL_RATIO = 1.5;
const VELOCITY_COMMIT_PX_MS = 0.45;
const MAIN_ID = "app-main";

function isMobileViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(SWIPE_BACK_MOBILE_MQ).matches;
}

function isModalOpen(): boolean {
  return !!document.querySelector('[role="dialog"][aria-modal="true"]');
}

function getMainEl(): HTMLElement | null {
  return document.getElementById(MAIN_ID);
}

function clearMainTransform(main: HTMLElement) {
  main.style.transform = "";
  main.classList.remove("swipe-back-transition");
}

function setMainTransform(main: HTMLElement, deltaX: number) {
  main.style.transform = `translateX(${deltaX}px)`;
}

export function useSwipeBackEdge(pathname: string) {
  const router = useRouter();

  const dragRef = useRef({
    active: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastTime: 0,
    blocked: false,
    target: null as string | null,
  });

  useEffect(() => {
    const drag = dragRef.current;

    function resetDrag() {
      drag.active = false;
      drag.pointerId = -1;
      drag.blocked = false;
      drag.target = null;
      document.documentElement.classList.remove("swipe-back-dragging");
      const main = getMainEl();
      if (main) clearMainTransform(main);
    }

    function commitNavigation(target: string) {
      resetDrag();
      router.push(target, { scroll: false });
    }

    function onPointerDown(e: PointerEvent) {
      if (!isMobileViewport()) return;
      if (e.pointerType === "mouse") return;
      if (isModalOpen()) return;
      if (e.clientX > EDGE_ZONE_PX) return;

      const target = resolveSwipeBackTarget(pathname);
      if (!target) return;

      drag.active = true;
      drag.pointerId = e.pointerId;
      drag.startX = e.clientX;
      drag.startY = e.clientY;
      drag.lastX = e.clientX;
      drag.lastTime = e.timeStamp;
      drag.blocked = false;
      drag.target = target;

      document.documentElement.classList.add("swipe-back-dragging");
    }

    function onPointerMove(e: PointerEvent) {
      if (!drag.active || e.pointerId !== drag.pointerId) return;

      const deltaX = e.clientX - drag.startX;
      const deltaY = e.clientY - drag.startY;

      if (!drag.blocked) {
        if (deltaX < -DIRECTION_DEADZONE_PX) {
          resetDrag();
          return;
        }
        if (
          Math.abs(deltaY) > DIRECTION_DEADZONE_PX &&
          Math.abs(deltaY) > Math.abs(deltaX) * VERTICAL_RATIO
        ) {
          drag.blocked = true;
          resetDrag();
          return;
        }
        if (deltaX < DIRECTION_DEADZONE_PX) return;
      }

      const main = getMainEl();
      if (!main || prefersReducedMotion()) return;

      setMainTransform(main, Math.max(0, deltaX));
      drag.lastX = e.clientX;
      drag.lastTime = e.timeStamp;
    }

    function onPointerEnd(e: PointerEvent) {
      if (!drag.active || e.pointerId !== drag.pointerId) return;

      const target = drag.target;
      if (!target) {
        resetDrag();
        return;
      }

      const deltaX = Math.max(0, e.clientX - drag.startX);
      const dt = Math.max(1, e.timeStamp - drag.lastTime);
      const velocity = (e.clientX - drag.lastX) / dt;

      const shouldCommit =
        deltaX >= COMMIT_THRESHOLD_PX || velocity >= VELOCITY_COMMIT_PX_MS;

      const main = getMainEl();

      if (shouldCommit) {
        if (main && !prefersReducedMotion()) {
          main.classList.add("swipe-back-transition");
          setMainTransform(main, window.innerWidth);
          window.setTimeout(() => commitNavigation(target), 250);
        } else {
          commitNavigation(target);
        }
        return;
      }

      if (main && !prefersReducedMotion()) {
        main.classList.add("swipe-back-transition");
        setMainTransform(main, 0);
        window.setTimeout(() => resetDrag(), 250);
      } else {
        resetDrag();
      }
    }

    document.addEventListener("pointerdown", onPointerDown, { passive: true });
    document.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerup", onPointerEnd, { passive: true });
    document.addEventListener("pointercancel", onPointerEnd, { passive: true });

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerEnd);
      document.removeEventListener("pointercancel", onPointerEnd);
      resetDrag();
    };
  }, [router, pathname]);
}
